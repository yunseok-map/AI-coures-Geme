// 엔진 G — 슈팅형. 내려오는 문장 중 **거짓인 것만** 쏜다.
//
// 이 엔진이 가르치는 구조:
//   판별에는 **시간이 든다.** 옆에 근거 자료를 두고 대조해야 하는데 문장은 계속 내려온다.
//   그래서 "말투가 자연스러우면 그냥 넘긴다"는 실수를 손으로 겪는다 —
//   설명으로 백 번 말해도 안 되는 것이 한 판이면 된다.
//   맞는 문장을 쏘면 감점이다. 의심만 하면 되는 게 아니라 근거를 봐야 한다.
//
// 카드는 판정 전까지 **전부 똑같이 생겨야 한다.** 색으로 정답이 새면 게임이 성립하지 않는다.
// (디펜스는 반대다 — 거기서는 "빨간 것이 위험"이 규칙이다.)
//
// 부드러운 압박(사용자 확정): 놓쳐도 게임오버가 없다. 끝까지 흐르고 등급만 내려간다.
//
// 엔진은 특정 미니게임을 모른다. game.simulate(setup) 이 판정한다. (CLAUDE.md §1-3)

import { el, esc, strong, say, Bin, header, actions, runner, scarLine } from './base.js';
import { icon } from '../core/art.js';
import { createLoop } from '../core/loop.js';
import { sfx } from '../core/sfx.js';
import { animate, isReduced, cardIn, shake, pulse, burst } from '../core/motion.js';

let bin = new Bin();
let loop = null;
let counting = 0;
let host = null;

export function unmount() {
  bin.clear();
  if (loop) { loop.stop(); loop = null; }
  if (counting) { clearTimeout(counting); counting = 0; }
  if (host) { host.classList.remove('stage--arcade'); host = null; }
}

export function mount(root, game, ctx) {
  unmount();
  bin = new Bin();
  host = root;
  root.classList.add('stage--arcade');

  const d = game.data;
  const startedAt = Date.now();
  const travel = d.travelSec || 8;
  const gap = d.gapSec ?? 2.3;

  const items = d.items.map((it, i) => ({
    ...it,
    at: it.at ?? i * gap,
    y: -0.16, live: false, done: false, node: null
  }));

  // 화면에 나가는 낱말은 전부 게임 파일이 정한다. 엔진은 "쏠 것/안 쏠 것"만 안다.
  // (엔진에 "거짓" 같은 말이 박히면 다른 미니게임에서 문장이 어긋난다 — CLAUDE.md §1-3)
  const L = Object.assign({
    hit: '적발', miss: '놓쳤다', over: '이건 문제 없다', pass: '통과',
    tap: '문제가 있다고 판단하면 누르세요',
    sayHit: '문제가 있는 것을 적발했습니다.',
    sayMiss: '문제가 있는 것이 그대로 통과했습니다.',
    sayOver: '문제 없는 것을 쐈습니다.'
  }, d.labels || {});

  const out = { hit: [], overshot: [], missed: [], clean: [] };
  let combo = 0, bestCombo = 0, t = 0, phase = 'setup';

  // ---------------------------------------------------------------- 화면
  root.innerHTML = '';
  root.append(header(game));

  // 근거 자료 — 이 판의 핵심이다. 이걸 보면서 대조해야 한다.
  if (d.source && d.source.body) {
    const s = el('section', 'source');
    s.innerHTML =
      `<div class="source__cap">${esc(d.source.cap || '대조할 근거 자료')}</div>` +
      `<div>${esc(d.source.body)}</div>`;
    root.append(s);
    cardIn(s);
  }

  const hud = el('div', 'ax__hud');
  root.append(hud);

  const field = el('section', 'ax__field');
  const track = el('div', 'ax__track');
  const foot = el('div', 'ax__foot ax__foot--line',
    `${icon('check')}<span>${esc(d.lineLabel || '여기를 지나가면 사실로 인정된다')}</span>`);
  const veil = el('div', 'ax__veil');
  veil.hidden = true;
  field.append(track, foot, veil);
  root.append(field);

  const dock = el('div', 'ax__dock');
  const hint = el('p', 'ax__traycap', esc(d.prompt || '거짓인 문장을 눌러 쏘시오'));
  const bar = actions([
    { id: 'go', label: d.runLabel || '시작', primary: true }
  ]);
  dock.append(hint, bar.node);
  root.append(dock);
  bin.on(bar.btn.go, 'click', begin);

  const feedback = el('div');
  root.append(feedback);

  drawHud();

  // ---------------------------------------------------------------- 계기판

  function drawHud() {
    hud.innerHTML =
      `<span class="ax__stat ax__stat--ok"><b>${out.hit.length}</b> 적발</span>` +
      `<span class="ax__stat ax__stat--bad"><b>${out.missed.length}</b> 놓침</span>` +
      `<span class="ax__stat">오사격 <b>${out.overshot.length}</b></span>` +
      (phase === 'run'
        ? `<span class="ax__stat">남은 문장 <b>${items.filter(i => !i.done).length}</b></span>` : '') +
      (combo > 1 ? `<span class="ax__combo">${combo}연속</span>` : '');
    hud.append(soundBtn());
  }

  function soundBtn() {
    const b = el('button', 'ax__mute');
    b.type = 'button';
    b.textContent = sfx.on ? '소리 끄기' : '소리 켜기';
    b.setAttribute('aria-label', sfx.on ? '효과음 끄기' : '효과음 켜기');
    bin.on(b, 'click', () => { sfx.toggle(); drawHud(); });
    return b;
  }

  // ---------------------------------------------------------------- 웨이브

  async function begin() {
    if (phase !== 'setup') return;
    phase = 'count';
    bar.btn.go.disabled = true;

    await countdown();
    if (phase !== 'count') return;

    phase = 'run';
    hint.textContent = d.runHint || '거짓인 문장을 눌러 쏜다. 맞는 문장은 그냥 지나가게 둔다';
    drawHud();
    say('시작했습니다. 거짓인 문장을 눌러 쏘세요.');

    loop = createLoop(tick, {
      onPause: () => showVeil(
        '잠깐 멈췄습니다',
        '다른 창이나 탭으로 가면 브라우저가 화면을 멈춥니다. 고장이 아닙니다. ' +
        '멈춘 사이에는 아무 일도 진행되지 않았습니다.',
        '이어서 하기', () => { hideVeil(); loop && loop.resume(); }),
      onResume: hideVeil
    });
    loop.start();
  }

  function countdown() {
    if (isReduced()) return Promise.resolve();
    return new Promise(done => {
      let n = 3;
      const beat = () => {
        if (phase !== 'count') { done(); return; }
        if (n === 0) { hideVeil(); done(); return; }
        showVeil(String(n), '', '', null);
        sfx.play('count');
        n--;
        counting = setTimeout(beat, 520);
      };
      beat();
    });
  }

  function tick(dt) {
    t += dt;

    for (const it of items) {
      if (it.done) continue;

      if (!it.live) {
        if (t < it.at) continue;
        it.live = true;
        it.node = cardNode(it);
        track.append(it.node);
      }

      it.y += dt / travel;
      it.node.style.top = (it.y * 100) + '%';

      if (it.y >= 1) cross(it);
    }

    if (items.every(i => i.done)) end();
  }

  /** 카드를 눌렀다 = "이건 거짓이다" */
  function shootAt(it) {
    if (it.done || phase !== 'run') return;
    it.done = true;
    sfx.play('shot');
    beam(it);

    if (it.bad) {
      out.hit.push(it.id);
      combo++; bestCombo = Math.max(bestCombo, combo);
      sfx.play('block');
      if (combo > 1) sfx.play('combo', combo);
      mark(it, 'hit', `${L.hit}${combo > 1 ? ` ×${combo}` : ''}`, 'ok');
      if (!isReduced()) burst(it.node, 8);
      say(L.sayHit);
    } else {
      // 문제 없는 것을 쐈다. 의심만으로는 안 된다는 것을 여기서 배운다.
      out.overshot.push(it.id);
      combo = 0;
      sfx.play('wrong');
      mark(it, 'over', L.over, 'over');
      if (!isReduced()) shake(it.node);
      say(L.sayOver);
    }
    drawHud();
  }

  /** 판독선을 지나갔다 = "이건 사실이다"로 인정 */
  function cross(it) {
    it.done = true;
    if (it.bad) {
      out.missed.push(it.id);
      combo = 0;
      sfx.play('leak');
      mark(it, 'miss', L.miss, 'bad');
      foot.classList.add('ax__foot--hit');
      setTimeout(() => foot.classList.remove('ax__foot--hit'), 600);
      // 판독선을 그냥 지나간 것은 "사실로 인정된" 것이다. 그 자국이 선에 남는다 —
      // 깜빡임만 있으면 세 번 놓쳐도 화면은 매번 원래대로 돌아온다.
      scarLine(foot, out.missed.length, L.miss);
      say(L.sayMiss);
    } else {
      out.clean.push(it.id);
      mark(it, 'pass', L.pass, 'pass');
    }
    drawHud();
  }

  function cardNode(it) {
    // 판정 전에는 전부 똑같이 생긴다 — 색으로 정답이 새면 안 된다
    const b = el('button', 'ax__card sh__card' + (it.tag ? ' sh__card--tagged' : ''));
    b.type = 'button';
    b.style.top = '0%';
    b.innerHTML =
      `<span class="ax__card__ico">${icon(d.cardIcon || 'doc')}</span>` +
      (it.tag ? `<span class="sh__tag">${esc(it.tag)}</span>` : '') +
      `<span class="ax__card__label">${esc(it.label)}</span>`;
    b.setAttribute('aria-label', `${it.tag ? it.tag + ' ' : ''}${it.label}. ${L.tap}`);
    bin.on(b, 'click', () => shootAt(it));
    return b;
  }

  /** 판정 결과를 카드에 남기고 사유를 띄운다 */
  function mark(it, kind, popText, popKind) {
    const n = it.node;
    if (n) {
      n.disabled = true;
      n.classList.add('sh__card--' + kind);
      // 왜 그런지를 카드에 바로 붙인다. 나중에 몰아서 보면 안 읽는다.
      if (it.why && kind !== 'pass') {
        n.querySelector('.ax__card__label')
          .insertAdjacentHTML('beforeend', `<span class="sh__why">${strong(it.why)}</span>`);
      }
    }
    pop(it.y, popText, popKind);
    if (n) fade(n);
  }

  function fade(n) {
    if (isReduced()) { setTimeout(() => n.remove(), 1200); return; }
    const kill = setTimeout(() => n.remove(), 2200);
    animate(n, { opacity: [1, 1, 0], duration: 1600, ease: 'linear' })
      .then(() => { clearTimeout(kill); n.remove(); });
  }

  /** 판독선에서 카드로 뻗는 광선 — 쐈다는 느낌의 전부다 */
  function beam(it) {
    if (isReduced()) return;
    const b = el('span', 'sh__beam');
    const yPct = Math.min(1, Math.max(0, it.y)) * 100;
    b.style.top = yPct + '%';
    b.style.height = (100 - yPct) + '%';
    track.append(b);
    const kill = setTimeout(() => b.remove(), 500);
    animate(b, { opacity: [0.9, 0], scaleX: [1, 0.3], duration: 260, ease: 'outQuad' })
      .then(() => { clearTimeout(kill); b.remove(); });
  }

  function pop(y, text, kind) {
    const p = el('span', 'ax__pop ax__pop--' + kind, esc(text));
    p.style.top = (Math.min(1, Math.max(0, y)) * 100) + '%';
    track.append(p);
    if (isReduced()) { setTimeout(() => p.remove(), 900); return; }
    const kill = setTimeout(() => p.remove(), 1200);
    animate(p, { opacity: [0, 1, 1, 0], translateY: [6, -26], duration: 900, ease: 'outQuad' })
      .then(() => { clearTimeout(kill); p.remove(); });
  }

  // ---------------------------------------------------------------- 마무리

  async function end() {
    if (phase !== 'run') return;
    phase = 'done';
    if (loop) { loop.stop(); loop = null; }
    hideVeil();
    hint.textContent = '판정 중';

    const setup = {
      hit: out.hit.slice(),
      overshot: out.overshot.slice(),
      missed: out.missed.slice(),
      clean: out.clean.slice(),
      bestCombo
    };

    const r = runner(d.runCaption || '고른 대로 결과가 어떻게 달라지나');
    feedback.append(r.node);
    const sim = game.simulate(setup, d);
    await r.play(sim.steps);

    sfx.play(sim.grade === 'fail' ? 'fail' : 'pass');

    ctx.finish({
      grade: sim.grade,
      score: sim.score,
      elapsed: Math.round((Date.now() - startedAt) / 1000),
      mistakes: sim.mistakes || [],
      faults: sim.faults || [],
      gains: sim.gains || [],
      unlocked: sim.grade === 'fail' ? [] : (game.concept || [])
    });
  }

  // ---------------------------------------------------------------- 덮개

  function showVeil(title, body, btnLabel, onBtn) {
    veil.hidden = false;
    veil.innerHTML =
      `<strong class="ax__veil__t">${esc(title)}</strong>` +
      (body ? `<span class="ax__veil__b">${esc(body)}</span>` : '');
    if (btnLabel && onBtn) {
      const b = el('button', 'btn-primary');
      b.type = 'button';
      b.textContent = btnLabel;
      bin.on(b, 'click', onBtn);
      veil.append(b);
      b.focus();
    }
  }

  function hideVeil() {
    veil.hidden = true;
    veil.innerHTML = '';
  }
}
