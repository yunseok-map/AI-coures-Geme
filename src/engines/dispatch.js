// 엔진 R — 실시간 관제. 들어오는 일감을 창구로 보낸다.
//
// 왜 이 엔진이 필요한가:
//   "어디서 할까?"를 통 다섯 개짜리 분류 게임으로 가르치고 있었다. 카드를 읽고
//   통을 고르면 맞다/틀리다가 나오는 판이다. 그런데 표면 선택은 **맞고 틀림이
//   아니라 비용**이다. 채팅으로도 대부분 된다 — 다만 매번 다시 설명해야 하고,
//   창구가 하나라서 줄이 선다. 그 사실은 O/X 로는 절대 안 나온다.
//
//   여기서는 시계가 돈다. 잘못 보내도 오답 표시가 뜨지 않는다 —
//   **일감이 시간을 먹고 되돌아온다.** 한 창구에 몰면 줄이 서고, 대기줄이 넘치면
//   일감이 밀려난다. 그래서 "어디서 할까"가 취향이 아니라 오늘의 처리량이 된다.
//
// 조작은 두 번 누르기다. 대기줄의 일감을 누르고, 보낼 창구를 누른다.
// 비어 있는 창구를 그냥 누르면 그 창구가 어떤 곳인지 알려 준다.
//
// 시간 계산은 core/dispatch.js 가 한다 — 막대 길이와 판정이 같은 답을 봐야 한다.
// 판정은 game.simulate({ plan, lost, elapsed }) 가 한다. 엔진은 내용을 모른다.

import { el, esc, say, Bin, header, actions, runner } from './base.js';
import { enter, cardIn, pulse, shake, wait, isReduced } from '../core/motion.js';
import { createLoop } from '../core/loop.js';
import { sfx } from '../core/sfx.js';
import { cost, commit, newState } from '../core/dispatch.js';

let bin = new Bin();
let loop = null;
let counting = null;

export function unmount() {
  bin.clear();
  if (loop) { loop.stop(); loop = null; }
  if (counting) { clearTimeout(counting); counting = null; }
}

export function mount(root, game, ctx) {
  unmount();
  bin = new Bin();

  const d = game.data;
  const items = (d.items || []).map(x => ({ ...x, state: 'soon' }));
  const surfaces = d.surfaces || [];
  const DAY = d.day || 55;
  const CAP = d.queueCap || 3;
  const startedAt = Date.now();

  /** 보낸 순서 — 순서가 결과를 바꾼다(자료를 언제 올렸나) */
  const plan = [];
  const state = newState();
  const queue = [];
  const desks = new Map();

  let t = 0;
  let phase = 'idle';
  let armed = null;
  let lost = 0, done = 0;

  root.innerHTML = '';
  root.append(header(game));

  // ---- 시계 ----
  const top = el('section', 'dp__top');
  const clock = el('div', 'dp__clock');
  const clockFill = el('i', 'dp__clock__fill');
  clock.append(clockFill);
  const stats = el('div', 'dp__stats');
  top.append(clock, stats);
  root.append(top);

  // ---- 대기줄 ----
  const queueBox = el('section', 'dp__queue');
  queueBox.append(el('div', 'dp__cap', esc(d.queueLabel || '대기줄 — 넘치면 밀려난다')));
  const queueRail = el('div', 'dp__rail');
  queueBox.append(queueRail);
  root.append(queueBox);

  // ---- 창구 ----
  const deskBox = el('section', 'dp__desks');
  for (const s of surfaces) {
    const node = el('button', 'dp__desk');
    node.type = 'button';
    node.dataset.id = s.id;
    node.innerHTML =
      `<span class="dp__desk__name">${esc(s.label)}</span>` +
      `<span class="dp__desk__note">${esc(s.note || '')}</span>` +
      `<span class="dp__desk__now"></span>` +
      `<span class="dp__desk__bar"><i></i></span>` +
      `<span class="dp__desk__keep"></span>`;
    deskBox.append(node);
    desks.set(s.id, {
      def: s, node,
      now: node.querySelector('.dp__desk__now'),
      bar: node.querySelector('.dp__desk__bar i'),
      keep: node.querySelector('.dp__desk__keep'),
      busy: null, left: 0, total: 0
    });
    bin.on(node, 'click', () => tapDesk(s.id));
  }
  root.append(deskBox);

  const feedback = el('div');
  root.append(feedback);

  const bar = actions([
    { id: 'sound', label: sfx.on ? '소리 끄기' : '소리 켜기' },
    { id: 'go', label: d.goLabel || '오늘 시작', primary: true }
  ]);
  root.append(bar.node);
  bin.on(bar.btn.sound, 'click', () => {
    sfx.toggle();
    bar.btn.sound.textContent = sfx.on ? '소리 끄기' : '소리 켜기';
  });
  bin.on(bar.btn.go, 'click', () => { if (phase === 'idle') begin(); });

  drawStats();
  drawQueue();
  drawDesks();
  enter([...deskBox.children], { each: 40 });

  // ------------------------------------------------------------ 화면

  function drawStats() {
    const left = Math.max(0, Math.ceil(DAY - t));
    stats.innerHTML =
      `<span class="dp__stat"><b>${done}</b> 처리</span>` +
      `<span class="dp__stat dp__stat--bad"><b>${lost}</b> 놓침</span>` +
      `<span class="dp__stat">남은 일 <b>${items.filter(i => i.state !== 'done' && i.state !== 'lost').length}</b></span>` +
      `<span class="dp__stat dp__stat--time">${left}초</span>`;
    clockFill.style.width = Math.min(100, (t / DAY) * 100) + '%';
    clock.classList.toggle('is-late', t / DAY > 0.75);
  }

  function drawQueue() {
    queueRail.innerHTML = '';
    for (let i = 0; i < CAP; i++) {
      const it = queue[i];
      if (!it) { queueRail.append(el('div', 'dp__slot dp__slot--empty')); continue; }
      const b = el('button', 'dp__job' + (armed === it.id ? ' dp__job--armed' : '') +
        (it.bounced ? ' dp__job--back' : ''));
      b.type = 'button';
      b.dataset.id = it.id;
      b.innerHTML =
        `<span class="dp__job__text">${esc(it.label)}</span>` +
        (it.bounced ? `<span class="dp__job__back">${esc(d.backTag || '되돌아옴')}</span>` : '');
      bin.on(b, 'click', () => tapJob(it));
      queueRail.append(b);
    }
    queueRail.classList.toggle('is-full', queue.length >= CAP);
  }

  function drawDesks() {
    for (const [id, k] of desks) {
      k.node.classList.toggle('dp__desk--busy', !!k.busy);
      k.node.classList.toggle('dp__desk--open', !k.busy && armed != null);
      k.now.textContent = k.busy ? k.busy.label : '';
      k.bar.style.width = k.busy && k.total ? ((1 - k.left / k.total) * 100) + '%' : '0%';
      // 창구에 남는 것 — 프로젝트에 올려 둔 자료, 아티팩트로 만들어 둔 결과물.
      // 이게 보여야 "두 번째부터 빨라진다"가 눈으로 이어진다.
      const kept = id === 'project' ? [...state.loaded] : id === 'artifact' ? [...state.made] : [];
      k.keep.textContent = kept.length ? (d.keepLabel || '남아 있다') + ' · ' + kept.join(' · ') : '';
    }
  }

  // ------------------------------------------------------------ 조작

  function tapJob(it) {
    if (phase !== 'run') return;
    armed = armed === it.id ? null : it.id;
    drawQueue();
    drawDesks();
    if (armed) say(`${it.label} 집었다. 보낼 창구를 고르세요.`);
  }

  function tapDesk(id) {
    const k = desks.get(id);
    if (!k) return;
    if (phase !== 'run') { note(k.def.about || k.def.note || ''); return; }
    if (!armed) { note(k.def.about || k.def.note || ''); return; }
    if (k.busy) { shake(k.node); note(d.busyNote || '이 창구는 지금 일하는 중이다.'); return; }

    const it = items.find(x => x.id === armed);
    if (!it) return;
    const idx = queue.indexOf(it);
    if (idx >= 0) queue.splice(idx, 1);

    const c = cost(it, id, state);
    commit(it, id, state);
    plan.push({ itemId: it.id, surfaceId: id });

    it.state = 'busy';
    it.bounced = false;
    k.busy = it;
    k.total = c.sec;
    k.left = c.sec;
    k.result = c;
    armed = null;

    sfx.play('shot');
    pop(k.node, `${c.sec}초`, c.ok ? 'go' : 'bad');
    drawQueue();
    drawDesks();
  }

  function note(text) {
    if (!text) return;
    say(text);
    pop(deskBox, text, 'say');
  }

  function pop(host, text, kind) {
    const p = el('span', 'dp__pop dp__pop--' + kind, esc(text));
    host.append(p);
    cardIn(p);
    setTimeout(() => p.remove(), 1300);
  }

  // ------------------------------------------------------------ 흐름

  async function begin() {
    phase = 'count';
    bar.btn.go.disabled = true;
    await countdown();
    if (phase !== 'count') return;

    phase = 'run';
    say(d.runNote || '일감이 들어옵니다. 대기줄에서 집어 창구로 보내세요.');
    loop = createLoop(tick, {
      onPause: () => veil(d.pauseTitle || '잠깐 멈췄습니다',
        '다른 창이나 탭으로 가면 브라우저가 화면을 멈춥니다. 고장이 아닙니다. ' +
        '멈춘 사이에는 아무 일도 진행되지 않았습니다.'),
      onResume: unveil
    });
    loop.start();
  }

  function countdown() {
    if (isReduced()) return Promise.resolve();
    return new Promise(finish => {
      let n = 3;
      const beat = () => {
        if (phase !== 'count') { finish(); return; }
        if (n === 0) { unveil(); finish(); return; }
        veil(String(n), '');
        sfx.play('count');
        n--;
        counting = setTimeout(beat, 480);
      };
      beat();
    });
  }

  function tick(dt) {
    t += dt;

    // 들어오는 일감
    for (const it of items) {
      if (it.state !== 'soon' || t < it.at) continue;
      it.state = 'wait';
      push(it);
    }

    // 돌아가는 창구
    for (const k of desks.values()) {
      if (!k.busy) continue;
      k.left -= dt;
      if (k.left > 0) continue;
      finishDesk(k);
    }

    drawStats();
    drawDesks();

    const over = items.every(i => i.state === 'done' || i.state === 'lost');
    if (over || t >= DAY) end();
  }

  /** 대기줄에 넣는다. 넘치면 제일 오래 기다린 것이 밀려난다. */
  function push(it) {
    if (queue.length >= CAP) {
      const outed = queue.shift();
      outed.state = 'lost';
      lost++;
      if (armed === outed.id) armed = null;
      sfx.play('leak');
      pop(queueBox, `${outed.label} ${d.lostTag || '밀려남'}`, 'bad');
    }
    queue.push(it);
    drawQueue();
  }

  function finishDesk(k) {
    const it = k.busy;
    const c = k.result;
    k.busy = null; k.left = 0; k.total = 0; k.result = null;

    if (c.ok) {
      it.state = 'done';
      done++;
      sfx.play('block');
      pop(k.node, d.doneTag || '끝', 'ok');
    } else {
      // 오답 표시가 뜨지 않는다. 시간만 먹고 되돌아온다 — 이 판의 요점이다.
      it.state = 'wait';
      it.bounced = true;
      sfx.play('wrong');
      pop(k.node, d.backTag || '되돌아옴', 'bad');
      push(it);
    }
    drawQueue();
  }

  async function end() {
    if (phase === 'end') return;
    phase = 'end';
    if (loop) { loop.stop(); loop = null; }
    armed = null;

    for (const it of items) {
      if (it.state === 'done' || it.state === 'lost') continue;
      it.state = 'lost';
      lost++;
    }
    for (const k of desks.values()) { k.busy = null; k.left = 0; k.total = 0; }

    drawStats();
    drawQueue();
    drawDesks();
    unveil();
    bar.node.hidden = true;

    const sim = game.simulate({
      plan: [...plan],
      lost,
      done,
      elapsed: Math.min(t, DAY)
    }, d);

    const r = runner(d.runCaption || '오늘 하루를 되짚는다');
    feedback.append(r.node);
    r.node.scrollIntoView({ block: 'nearest' });
    sfx.play(sim.grade === 'fail' ? 'fail' : 'pass');
    await r.play(sim.steps);
    await wait(120);

    ctx.finish({
      grade: sim.grade,
      score: sim.score,
      elapsed: Math.round((Date.now() - startedAt) / 1000),
      mistakes: [],
      faults: sim.faults || [],
      gains: sim.gains || [],
      unlocked: sim.grade === 'fail' ? [] : (game.concept || [])
    });
  }

  // ---- 멈춤 안내 ----
  const shade = el('div', 'dp__veil');
  shade.hidden = true;
  root.append(shade);

  function veil(title, body) {
    shade.hidden = false;
    shade.innerHTML = `<strong class="dp__veil__t">${esc(title)}</strong>` +
                      (body ? `<span class="dp__veil__b">${esc(body)}</span>` : '');
    if (body) {
      const b = el('button', 'btn-primary', '이어서 하기');
      b.type = 'button';
      bin.on(b, 'click', () => { unveil(); loop && loop.resume(); });
      shade.append(b);
    }
  }

  function unveil() { shade.hidden = true; shade.innerHTML = ''; }
}
