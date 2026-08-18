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
//   **라운드가 여러 번 돈다.** 한 라운드가 끝나면 그 라운드의 결과가 다음 라운드의
//   물량이 된다. 무엇이 얼마나 되돌아오는지는 엔진이 정하지 않는다 —
//   게임이 `plan(no, pending)` 과 `carry(out)` 으로 알려 준다. 엔진은 받은 목록을
//   창구에 흘려보내고, 되돌아온 것에 표를 붙이고, 못 흘려보낸 것을 더미로 그린다.
//   (CLAUDE.md §1-3 — 엔진은 특정 미니게임을 모른다)
//
// 부드러운 압박(사용자 확정): 놓쳐도 게임오버 없다. 끝까지 흐르고 등급만 내려간다.

import { el, esc, strong, say, Bin, header, actions, runner } from './base.js';
import { icon } from '../core/art.js';
import { createLoop } from '../core/loop.js';
import { sfx } from '../core/sfx.js';
import { animate, isReduced, cardIn, shake, burst } from '../core/motion.js';

let bin = new Bin();
let loop = null;
let counting = 0;
let hold = 0;
let host = null;

export function unmount() {
  bin.clear();
  if (loop) { loop.stop(); loop = null; }
  if (counting) { clearTimeout(counting); counting = 0; }
  if (hold) { clearTimeout(hold); hold = 0; }
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
  const roundCount = Math.max(1, d.roundCount || 1);

  const L = Object.assign({
    approve: '승인', reject: '반려',
    okApprove: '옳게 승인', okReject: '옳게 반려',
    badApprove: '통과시켰다', badReject: '잘못 반려', auto: '못 보고 통과',
    round: '라운드', rework: '재작업', pile: '되돌아온 일감', next: '이어서',
    empty: '되돌아온 일감이 없다'
  }, d.labels || {});

  // 라운드 상태
  let round = 0;
  let pending = [];        // 다음 라운드로 넘어가는 일감 (되돌아온 것 + 밀린 것)
  let items = [];          // 이번 라운드에 창구로 흐르는 서류
  let out = null;          // 이번 라운드 기록
  const log = [];          // 라운드별 기록 — 판정으로 넘어간다
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

  // 밀린 더미 — 숫자만 커지면 안 읽힌다. 서류 모양이 실제로 쌓여야 한다.
  const pile = el('section', 'qcl__pile');
  const pileCap = el('span', 'qcl__pile__cap');
  const pileStack = el('span', 'qcl__pile__stack');
  pileStack.setAttribute('aria-hidden', 'true');   // 개수는 위 문구가 이미 말한다
  pile.append(pileCap, pileStack);
  root.append(pile);

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

  drawPile(0);
  drawHud();

  // ---------------------------------------------------------------- 계기판

  function drawHud() {
    const left = items.filter(i => !i.done).length;
    const tally = log.concat(out ? [out] : []);
    const good = sum(tally, r => r.okReject.length + r.okApprove.length);
    const gone = sum(tally, r => r.passed.length + r.auto.length);
    const wrong = sum(tally, r => r.wrongReject.length);

    hud.innerHTML =
      (roundCount > 1
        ? `<span class="ax__stat">${esc(L.round)} <b>${Math.max(1, round)}</b>/${roundCount}</span>` : '') +
      `<span class="ax__stat ax__stat--ok"><b>${good}</b> 정확</span>` +
      `<span class="ax__stat ax__stat--bad"><b>${gone}</b> 통과</span>` +
      `<span class="ax__stat">오반려 <b>${wrong}</b></span>` +
      (phase === 'run' ? `<span class="ax__stat">남은 서류 <b>${left}</b></span>` : '') +
      (combo > 1 ? `<span class="ax__combo">${combo}연속</span>` : '');
    hud.append(soundBtn());
  }

  function sum(list, f) { return list.reduce((n, r) => n + f(r), 0); }

  function soundBtn() {
    const b = el('button', 'ax__mute');
    b.type = 'button';
    b.textContent = sfx.on ? '소리 끄기' : '소리 켜기';
    b.setAttribute('aria-label', sfx.on ? '효과음 끄기' : '효과음 켜기');
    bin.on(b, 'click', () => { sfx.toggle(); drawHud(); });
    return b;
  }

  /** 되돌아온 일감이 눈으로 쌓인다. 라운드가 끝날 때마다 한 번 더 커진다. */
  function drawPile(n, grew) {
    pileCap.innerHTML = `${esc(L.pile)} <b>${n}</b>건`;
    pileStack.innerHTML = '';
    const shown = Math.min(n, 14);
    for (let i = 0; i < shown; i++) pileStack.append(el('i'));
    if (n > shown) pileStack.append(el('span', 'qcl__pile__n', `+${n - shown}`));
    pile.style.setProperty('--n', String(n));
    pile.classList.toggle('qcl__pile--some', n > 0);
    pile.classList.toggle('qcl__pile--heavy', n >= 5);
    pile.classList.toggle('qcl__pile--buried', n >= 10);
    if (grew && n && !isReduced()) {
      pile.classList.remove('qcl__pile--grew');
      void pile.offsetWidth;
      pile.classList.add('qcl__pile--grew');
    }
  }

  // ---------------------------------------------------------------- 라운드

  async function begin() {
    if (phase !== 'setup') return;
    phase = 'count';
    bar.btn.go.disabled = true;

    await countdown();
    if (phase !== 'count') return;

    bar.node.replaceWith(judgeBar.node);
    hint.textContent = d.runHint || '창구에 들어온 서류만 판단할 수 있다. 지나가면 그대로 통과된다';
    say('시작했습니다. 창구에 들어온 서류를 판단하세요.');
    startRound();
  }

  /** 이번 라운드에 흘려보낼 서류를 게임에서 받아 창구에 건다 */
  function startRound() {
    round++;
    const built = (typeof game.plan === 'function')
      ? game.plan(round, pending)
      : { items: (d.items || []).slice(), backlog: [] };

    pending = built.backlog || [];
    items = (built.items || []).map((it, i) => ({
      ...it, at: i * gap, y: -0.18, live: false, done: false, node: null, seen: false
    }));
    out = { no: round, size: items.length,
      okReject: [], okApprove: [], passed: [], wrongReject: [], auto: [] };

    t = 0; active = null; phase = 'run';
    for (const n of track.querySelectorAll('.qc__card, .ax__pop')) n.remove();
    band.classList.remove('qc__band--busy');
    judgeBar.btn.no.disabled = judgeBar.btn.yes.disabled = true;

    drawPile(pending.length);
    drawHud();

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
      // 도장을 찍은 서류는 그 자리에 멈춰 선다 — 왜 그렇게 됐는지를 읽을 시간이다.
      // 라운드가 바뀔 때 창구를 통째로 비운다.
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

    if (items.every(i => i.done)) endRound();
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
    // 판정 전에는 전부 똑같이 생긴다 — 색으로 정답이 새면 안 된다.
    // 되돌아온 것만 표가 붙는다. 그 표는 "다시 왔다"만 말하고 좋고 나쁨은 말하지 않는다.
    const n = el('div', 'ax__card ax__card--inert qc__card' + (it.rework ? ' qcl__card--back' : ''));
    n.style.top = '0%';
    n.innerHTML =
      `<span class="ax__card__ico">${icon(d.cardIcon || 'doc')}</span>` +
      `<span class="ax__card__label">` +
      (it.rework ? `<span class="qcl__tag">${esc(L.rework)}</span>` : '') +
      `${esc(it.label)}</span>`;
    n.setAttribute('role', 'img');
    n.setAttribute('aria-label', `${it.rework ? L.rework + ' ' : ''}서류: ${it.label}`);
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

  // ---------------------------------------------------------------- 라운드 마무리

  function endRound() {
    if (phase !== 'run') return;
    phase = 'wrap';
    if (loop) { loop.stop(); loop = null; }
    judgeBar.btn.no.disabled = judgeBar.btn.yes.disabled = true;

    log.push(out);
    const leaked = out.passed.length + out.auto.filter(id => isBad(id)).length;
    const back = (typeof game.carry === 'function') ? game.carry(out) : [];
    const stuck = pending.length;
    pending = pending.concat(back);

    // 마지막 도장을 눈으로 확인할 틈을 준 뒤에 더미가 커진다
    hold = setTimeout(() => {
      hold = 0;
      drawPile(pending.length, true);
      drawHud();
      if (round < roundCount) {
        phase = 'break';
        const body = breakText(leaked, back, stuck);
        say(body);
        showVeil(`${round + 1}${L.round}`, body, L.next, () => { hideVeil(); startRound(); });
      } else {
        finish();
      }
    }, isReduced() ? 200 : 800);
  }

  function isBad(id) {
    const it = items.find(x => x.id === id);
    return !!(it && it.bad);
  }

  /**
   * 라운드 사이 화면. 설명이 길면 아무도 안 읽는다 — 두 문장까지만 남긴다.
   *
   * 되돌아오는 것의 종류(`kind`)는 게임이 정한다. 엔진은 `rework`(통과시킨 것이
   * 불어나서 돌아온 것)와 나머지(다시 올라온 것)를 세기만 한다.
   */
  function breakText(leaked, back, stuck) {
    const rework = back.filter(b => b.kind === 'rework').length;
    const redo = back.length - rework;
    const line = [];
    if (leaked) line.push(`통과시킨 ${leaked}건이 ${L.rework} ${rework}건으로 돌아온다.`);
    if (stuck) line.push(`창구에 못 온 ${stuck}건은 그대로 밀린다.`);
    if (redo) line.push(`반려한 것이 ${redo}건 다시 올라온다.`);
    if (!line.length) line.push(L.empty + '.');
    return line.slice(0, 2).join(' ');
  }

  // ---------------------------------------------------------------- 판정

  async function finish() {
    phase = 'done';
    hideVeil();
    hint.textContent = '판정 중';
    judgeBar.btn.no.disabled = judgeBar.btn.yes.disabled = true;

    const setup = {
      rounds: log.map(r => ({
        no: r.no, size: r.size,
        okReject: r.okReject.slice(), okApprove: r.okApprove.slice(),
        passed: r.passed.slice(), wrongReject: r.wrongReject.slice(),
        auto: r.auto.slice()
      })),
      backlog: pending.length,
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
