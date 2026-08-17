// 엔진 H — 검토 라인형. 서류가 창구를 지나가는 동안 승인/반려를 찍는다.
//
// 이 엔진이 가르치는 구조:
//   **안 찍으면 통과된다.** 시간 안에 판단하지 못한 것은 그대로 다음 단계로 간다.
//   현실의 결재가 정확히 그렇게 굴러가고, 그래서 알맹이 없는 산출물이 통과된다.
//   "바빠서 못 봤다"가 곧 "승인했다"가 되는 것을 규칙으로 겪게 만든다.
//
//   그리고 승인도 행동이다. 슈팅 엔진(G)은 "나쁜 것만 누른다"라서 가만히 있으면
//   중립인데, 여기서는 가만히 있는 것도 결과를 만든다 — 결재자의 자리가 그렇다.
//
// 부드러운 압박(사용자 확정): 놓쳐도 게임오버 없다. 끝까지 흐르고 등급만 내려간다.
//
// 엔진은 특정 미니게임을 모른다. game.simulate(setup) 이 판정한다. (CLAUDE.md §1-3)

import { el, esc, strong, say, Bin, header, actions, runner } from './base.js';
import { icon } from '../core/art.js';
import { createLoop } from '../core/loop.js';
import { sfx } from '../core/sfx.js';
import { animate, isReduced, cardIn, shake, burst } from '../core/motion.js';

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
  const travel = d.travelSec || 7;
  const gap = d.gapSec ?? 2.6;
  const bandFrom = d.bandFrom ?? 0.42;   // 창구 구간 (0..1)
  const bandTo = d.bandTo ?? 0.78;

  const L = Object.assign({
    approve: '승인', reject: '반려',
    okApprove: '옳게 승인', okReject: '옳게 반려',
    badApprove: '통과시켰다', badReject: '잘못 반려', auto: '못 보고 통과',
    waiting: '다음 서류를 기다린다'
  }, d.labels || {});

  const items = d.items.map((it, i) => ({
    ...it,
    at: it.at ?? i * gap,
    y: -0.18, live: false, done: false, node: null, seen: false
  }));

  const out = { okReject: [], okApprove: [], passed: [], wrongReject: [], auto: [] };
  let combo = 0, bestCombo = 0, t = 0, phase = 'setup', active = null;

  // ---------------------------------------------------------------- 화면
  root.innerHTML = '';
  root.append(header(game));

  if (d.source && d.source.body) {
    const s = el('section', 'source');
    s.innerHTML =
      `<div class="source__cap">${esc(d.source.cap || '판단 기준')}</div>` +
      `<div>${strong(d.source.body)}</div>`;
    root.append(s);
    cardIn(s);
  }

  const hud = el('div', 'ax__hud');
  root.append(hud);

  const field = el('section', 'ax__field');
  const track = el('div', 'ax__track');
  // 창구 — 여기 있는 동안만 도장을 찍을 수 있다
  const band = el('div', 'qc__band');
  band.style.top = (bandFrom * 100) + '%';
  band.style.height = ((bandTo - bandFrom) * 100) + '%';
  band.innerHTML = `<span class="qc__band__cap">${esc(d.bandLabel || '검토 창구')}</span>`;
  track.append(band);
  const foot = el('div', 'ax__foot ax__foot--line',
    `${icon('send')}<span>${esc(d.lineLabel || '여기를 지나가면 그대로 다음 단계로 간다')}</span>`);
  const veil = el('div', 'ax__veil');
  veil.hidden = true;
  field.append(track, foot, veil);
  root.append(field);

  const dock = el('div', 'ax__dock');
  const hint = el('p', 'ax__traycap', esc(d.prompt || '창구에 온 서류를 판단하시오'));
  const bar = actions([
    { id: 'go', label: d.runLabel || '시작', primary: true }
  ]);
  dock.append(hint, bar.node);
  root.append(dock);
  bin.on(bar.btn.go, 'click', begin);

  // 판단 버튼 두 개 — 웨이브가 시작되면 실행 버튼 자리를 대신한다
  const judgeBar = actions([
    { id: 'no', label: L.reject, disabled: true },
    { id: 'yes', label: L.approve, primary: true, disabled: true }
  ]);
  judgeBar.node.classList.add('qc__judge');
  judgeBar.btn.no.classList.add('btn-danger');
  bin.on(judgeBar.btn.no, 'click', () => stamp(false));
  bin.on(judgeBar.btn.yes, 'click', () => stamp(true));

  const feedback = el('div');
  root.append(feedback);

  drawHud();

  // ---------------------------------------------------------------- 계기판

  function drawHud() {
    const left = items.filter(i => !i.done).length;
    hud.innerHTML =
      `<span class="ax__stat ax__stat--ok"><b>${out.okReject.length + out.okApprove.length}</b> 정확</span>` +
      `<span class="ax__stat ax__stat--bad"><b>${out.passed.length + out.auto.length}</b> 통과</span>` +
      `<span class="ax__stat">오반려 <b>${out.wrongReject.length}</b></span>` +
      (phase === 'run' ? `<span class="ax__stat">남은 서류 <b>${left}</b></span>` : '') +
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
    bar.node.replaceWith(judgeBar.node);
    hint.textContent = d.runHint || '창구에 들어온 서류만 판단할 수 있다. 지나가면 그대로 통과된다';
    drawHud();
    say('시작했습니다. 창구에 들어온 서류를 판단하세요.');

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

      const inBand = it.y >= bandFrom && it.y <= bandTo;
      if (inBand && active !== it) enterBand(it);
      if (!inBand && active === it) leaveBand(it);

      if (it.y >= 1) fallThrough(it);
    }

    if (items.every(i => i.done)) end();
  }

  function enterBand(it) {
    active = it;
    it.seen = true;
    it.node.classList.add('qc__card--active');
    band.classList.add('qc__band--busy');
    judgeBar.btn.no.disabled = false;
    judgeBar.btn.yes.disabled = false;
    say(it.label);
  }

  function leaveBand(it) {
    active = null;
    if (it.node) it.node.classList.remove('qc__card--active');
    band.classList.remove('qc__band--busy');
    judgeBar.btn.no.disabled = true;
    judgeBar.btn.yes.disabled = true;
    // 창구를 지났는데 아직 판단 안 했다 = 못 보고 통과시킨 것이다
    if (!it.done) autoPass(it);
  }

  /** 도장을 찍는다. approve=true 면 승인 */
  function stamp(approve) {
    const it = active;
    if (!it || it.done || phase !== 'run') return;
    it.done = true;
    active = null;
    judgeBar.btn.no.disabled = true;
    judgeBar.btn.yes.disabled = true;
    band.classList.remove('qc__band--busy');

    if (approve && !it.bad) {
      out.okApprove.push(it.id);
      good(it, L.okApprove);
    } else if (!approve && it.bad) {
      out.okReject.push(it.id);
      good(it, L.okReject);
    } else if (approve && it.bad) {
      // 알맹이 없는 것을 승인했다
      out.passed.push(it.id);
      bad(it, L.badApprove, 'miss');
    } else {
      // 멀쩡한 것을 반려했다
      out.wrongReject.push(it.id);
      bad(it, L.badReject, 'over');
    }
    drawHud();
  }

  function good(it, text) {
    combo++; bestCombo = Math.max(bestCombo, combo);
    sfx.play('block');
    if (combo > 1) sfx.play('combo', combo);
    mark(it, 'hit', `${text}${combo > 1 ? ` ×${combo}` : ''}`, 'ok');
    if (!isReduced()) burst(it.node, 7);
  }

  function bad(it, text, kind) {
    combo = 0;
    sfx.play(kind === 'miss' ? 'leak' : 'wrong');
    mark(it, kind, text, kind === 'miss' ? 'bad' : 'over');
    if (!isReduced()) shake(it.node);
  }

  /** 창구를 지나쳤다 — 판단하지 않은 것도 결과를 만든다 */
  function autoPass(it) {
    it.done = true;
    out.auto.push(it.id);
    combo = 0;
    sfx.play('leak');
    mark(it, it.bad ? 'miss' : 'pass', L.auto, it.bad ? 'bad' : 'pass');
    if (it.bad) {
      foot.classList.add('ax__foot--hit');
      setTimeout(() => foot.classList.remove('ax__foot--hit'), 600);
    }
    say(`${L.auto} — ${it.label}`);
    drawHud();
  }

  /** 이미 판단이 끝난 서류가 바닥에 닿았다 */
  function fallThrough(it) {
    if (!it.done) autoPass(it);
    if (it.node) { it.node.remove(); it.node = null; }
  }

  function cardNode(it) {
    // 판정 전에는 전부 똑같이 생긴다 — 색으로 정답이 새면 안 된다
    const n = el('div', 'ax__card ax__card--inert qc__card');
    n.style.top = '0%';
    n.innerHTML =
      `<span class="ax__card__ico">${icon(d.cardIcon || 'doc')}</span>` +
      `<span class="ax__card__label">${esc(it.label)}</span>`;
    n.setAttribute('role', 'img');
    n.setAttribute('aria-label', `서류: ${it.label}`);
    return n;
  }

  function mark(it, kind, popText, popKind) {
    const n = it.node;
    if (n) {
      n.classList.remove('qc__card--active');
      n.classList.add('qc__card--' + kind);
      if (it.why && kind !== 'pass') {
        n.querySelector('.ax__card__label')
          .insertAdjacentHTML('beforeend', `<span class="sh__why">${strong(it.why)}</span>`);
      }
    }
    pop(it.y, popText, popKind);
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
    judgeBar.btn.no.disabled = judgeBar.btn.yes.disabled = true;

    const setup = {
      okReject: out.okReject.slice(),
      okApprove: out.okApprove.slice(),
      passed: out.passed.slice(),
      wrongReject: out.wrongReject.slice(),
      auto: out.auto.slice(),
      bestCombo
    };

    const r = runner(d.runCaption || '결재한 대로 다음 단계로 넘어간다');
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
