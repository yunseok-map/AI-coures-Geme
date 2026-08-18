// 엔진 T — 발동 타임라인. 하루를 미리 짜 두고, 한 번 돌려 본다.
//
// 왜 이 엔진이 필요한가:
//   커맨드 · 스킬 · 훅 · 서브에이전트 · 플러그인을 통 여섯 개짜리 분류 게임으로
//   가르치고 있었다. 상황 카드를 읽고 이름을 고르는 일이라, **다섯의 진짜 차이가
//   화면에 안 나온다.** 그 차이는 뜻이 아니라 **발동 시점**이다.
//
//   여기서는 도구를 하루의 어느 순간에 걸어 두면, 그 도구가 실제로 발동할 자리에
//   표시가 곧바로 찍힌다. 훅을 걸면 같은 종류의 순간마다 표시가 세 개 찍히고,
//   스킬을 같은 자리에 걸면 두 개만 찍힌다 — 하나는 사람이 하는 일이라서.
//   커맨드는 아예 걸 수 없다. 손에 들고 있다가 재생 중에 내가 눌러야 한다.
//
//   그래서 이 판의 배움은 글이 아니라 **표시가 몇 개 찍히느냐**로 온다.
//
// 조작:
//   선반의 도구를 누르고 → 타임라인의 순간을 누른다. 다시 누르면 내려온다.
//   플러그인 상자는 걸 수 없다. 열면 안에 든 도구들이 선반에 쏟아진다.
//   커맨드는 손패에 있다. 재생이 도는 동안 직접 눌러야 발동한다.
//
// 발동 계산은 core/fire.js 가 한다 — 미리보기 표시와 판정이 같은 답을 봐야 한다.
// 판정은 game.simulate({ placed, presses, opened }) 가 한다. 엔진은 내용을 모른다.

import { el, esc, say, Bin, header, actions, runner } from './base.js';
import { enter, cardIn, pulse, shake, wait, press as pressFx } from '../core/motion.js';
import { coverage, laneSpan } from '../core/fire.js';

let bin = new Bin();
let timer = null;

export function unmount() {
  bin.clear();
  if (timer) { clearTimeout(timer); timer = null; }
}

export function mount(root, game, ctx) {
  unmount();
  bin = new Bin();

  const d = game.data;
  const moments = d.moments || [];
  const tools = d.tools || [];
  const goals = d.goals || [];
  const box = d.box || null;
  const TICK = d.tick || 950;
  const startedAt = Date.now();

  /** 도구 id → 걸어 둔 순간 번호 */
  const placed = {};
  /** 재생 중 손으로 누른 것 [{ toolId, tick }] */
  const presses = [];
  /** 지금 손에 있는 도구 — 상자를 열면 늘어난다 */
  const owned = new Set(tools.filter(t => !t.inBox).map(t => t.id));

  let armed = null;
  let running = false;
  let opened = false;
  let now = -1;

  const toolOf = (id) => tools.find(t => t.id === id) || null;

  root.innerHTML = '';
  root.append(header(game));

  // ---- 오늘 지켜야 할 것 ----
  const goalBoard = el('section', 'tl__goals');
  goalBoard.append(el('div', 'tl__goals__cap', esc(d.goalsLabel || '오늘 지켜야 할 것')));
  const goalRail = el('div', 'tl__goals__rail');
  const goalNodes = new Map();
  for (const g of goals) {
    const c = el('div', 'tl__goal', `<i aria-hidden="true"></i><span>${esc(g.text)}</span>`);
    goalRail.append(c);
    goalNodes.set(g.id, c);
  }
  goalBoard.append(goalRail);
  root.append(goalBoard);

  const hint = el('p', 'tl__hint');
  root.append(hint);

  // ---- 하루 ----
  const day = el('ol', 'tl__day');
  const rowNodes = [];
  moments.forEach((m, i) => {
    const li = el('li');
    const row = el('div', 'tl__row');
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    row.innerHTML =
      `<span class="tl__clock">${esc(m.clock || '')}</span>` +
      `<span class="tl__what">${esc(m.label)}</span>` +
      `<span class="tl__who ${m.byAi ? 'is-ai' : 'is-human'}">` +
        `${esc(m.byAi ? (d.byAiLabel || 'AI가 한다') : (d.byHumanLabel || '사람이 한다'))}</span>`;
    const marks = el('span', 'tl__marks');
    const lane = el('span', 'tl__lane');
    lane.setAttribute('aria-hidden', 'true');
    row.append(marks, lane);
    li.append(row);
    day.append(li);
    rowNodes.push({ node: row, marks, lane });

    const put = () => drop(i);
    bin.on(row, 'click', put);
    bin.on(row, 'keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); put(); }
    });
  });
  root.append(day);

  // ---- 선반 ----
  const tray = el('section', 'tl__tray');
  root.append(tray);

  // ---- 손패 ----
  const hand = el('section', 'tl__hand');
  root.append(hand);

  const feedback = el('div');
  root.append(feedback);

  const bar = actions([
    { id: 'clear', label: d.clearLabel || '전부 내리기' },
    { id: 'run', label: d.runLabel || '하루를 돌린다', primary: true }
  ]);
  root.append(bar.node);
  bin.on(bar.btn.clear, 'click', () => {
    if (running) return;
    for (const k of Object.keys(placed)) delete placed[k];
    armed = null;
    paint();
    say(d.clearedNote || '전부 내렸다.');
  });
  bin.on(bar.btn.run, 'click', () => { if (!running) run(); });

  paint();
  enter([...tray.children], { each: 30 });

  // ------------------------------------------------------------ 조작

  function drop(i) {
    if (running || armed == null) return;
    const t = toolOf(armed);
    if (!t) return;

    // 커맨드는 걸 수 없다. 이 거절이 이 판에서 커맨드를 가르치는 방법이다.
    if (t.mode === 'manual') {
      shake(rowNodes[i].node);
      note(d.manualNote || '커맨드는 걸어 둘 수 없다. 재생 중에 직접 눌러야 발동한다.');
      armed = null;
      paint();
      return;
    }

    placed[t.id] = i;
    const hit = coverage(moments, t, i);
    armed = null;
    paint();

    // 몇 군데서 발동하는지를 곧바로 말해 준다 — 표시는 이미 찍혔고, 이건 그 확인이다.
    if (!hit.length) {
      note(t.dead || d.deadNote || '여기서는 한 번도 발동하지 않는다.');
      shake(rowNodes[i].node);
    } else {
      note((t.putNote || '') + ' ' + fireCount(t, hit));
    }
  }

  function fireCount(t, hit) {
    if (t.mode === 'lane') {
      const end = hit[0];
      return end < moments.length
        ? `${moments[end].clock || (end + 1)}쯤 요약을 갖고 돌아온다.`
        : (d.lateNote || '하루가 끝나도 못 돌아온다.');
    }
    return `오늘 ${hit.length}번 발동한다.`;
  }

  function note(text) {
    hint.textContent = text.trim();
    hint.classList.remove('is-new');
    void hint.offsetWidth;
    hint.classList.add('is-new');
    say(text);
  }

  // ------------------------------------------------------------ 그리기

  function paint() {
    drawTray();
    drawHand();
    drawMarks();
    for (const r of rowNodes) r.node.classList.toggle('tl__row--target', armed != null && !running);
  }

  function drawTray() {
    tray.innerHTML = '';
    tray.append(el('div', 'tl__tray__cap', esc(d.trayLabel || '도구 선반')));
    const rail = el('div', 'tl__rail');

    for (const t of tools) {
      if (!owned.has(t.id) || t.mode === 'manual') continue;
      const b = el('button', 'tl__tool tl__tool--' + t.mode);
      b.type = 'button';
      b.dataset.id = t.id;
      const at = placed[t.id];
      if (armed === t.id) b.classList.add('tl__tool--armed');
      if (at != null) b.classList.add('tl__tool--set');
      b.innerHTML =
        `<span class="tl__tool__label">${esc(t.label)}</span>` +
        `<span class="tl__tool__note">${esc(at != null
          ? (moments[at].clock || '') + ' ' + moments[at].label
          : (t.note || ''))}</span>`;
      bin.on(b, 'click', () => {
        if (running) return;
        if (placed[t.id] != null) { delete placed[t.id]; armed = t.id; paint(); return; }
        armed = armed === t.id ? null : t.id;
        paint();
        if (armed) note(d.armNote || '걸어 둘 순간을 누른다.');
      });
      rail.append(b);
    }

    // 플러그인 상자 — 걸 수 있는 도구가 아니라 **도구가 든 상자**다.
    if (box && !opened) {
      const b = el('button', 'tl__box');
      b.type = 'button';
      b.innerHTML =
        `<span class="tl__box__label">${esc(box.label)}</span>` +
        `<span class="tl__box__note">${esc(box.note || '')}</span>`;
      bin.on(b, 'click', () => {
        if (running) return;
        opened = true;
        for (const t of tools) if (t.inBox) owned.add(t.id);
        armed = null;
        paint();
        const got = tools.filter(t => t.inBox).map(t => t.label);
        note((box.openNote || '상자를 열었다.') + ' ' + got.join(' · ') + `가 선반에 들어왔다.`);
        enter([...tray.querySelectorAll('.tl__tool')], { each: 60 });
      });
      rail.append(b);
    }

    tray.append(rail);
  }

  function drawHand() {
    hand.innerHTML = '';
    const mine = tools.filter(t => owned.has(t.id) && t.mode === 'manual');
    hand.hidden = !mine.length;
    if (!mine.length) return;

    hand.append(el('div', 'tl__hand__cap', esc(
      running ? (d.handLiveLabel || '지금 누를 수 있다') : (d.handLabel || '손에 든 것 — 재생 중에 내가 누른다'))));
    const rail = el('div', 'tl__rail');
    for (const t of mine) {
      const b = el('button', 'tl__key');
      b.type = 'button';
      b.innerHTML = `<span class="tl__key__label">${esc(t.label)}</span>` +
                    `<span class="tl__key__note">${esc(t.note || '')}</span>`;
      b.classList.toggle('tl__key--live', running);
      bin.on(b, 'click', () => {
        if (!running || now < 0) {
          if (!running) { note(d.handIdleNote || '재생이 도는 동안에만 발동한다.'); shake(b); }
          return;
        }
        presses.push({ toolId: t.id, tick: now });
        const m = el('span', 'tl__mark tl__mark--manual is-fired', esc(t.label));
        rowNodes[now].marks.append(m);
        cardIn(m);
        pressFx(b);
        say(`${moments[now].clock || ''} ${t.label} 발동`);
      });
      rail.append(b);
    }
    hand.append(rail);
  }

  function drawMarks() {
    for (const r of rowNodes) {
      // 재생 중 손으로 찍은 표시는 남긴다 — 그게 내가 한 일의 기록이다
      for (const m of [...r.marks.children]) {
        if (!m.classList.contains('tl__mark--manual')) m.remove();
      }
      r.lane.className = 'tl__lane';
    }

    for (const t of tools) {
      const at = placed[t.id];
      if (at == null) continue;

      for (const i of coverage(moments, t, at)) {
        if (i < 0 || i >= moments.length) continue;
        const m = el('span', 'tl__mark tl__mark--' + t.mode + (i === at ? ' is-anchor' : ''),
          esc(t.short || t.label));
        rowNodes[i].marks.prepend(m);
      }

      const span = laneSpan(moments, t, at);
      if (!span) continue;
      for (let i = span.from; i < Math.min(span.to, moments.length); i++) {
        rowNodes[i].lane.classList.add('is-run');
      }
      if (span.to < moments.length) rowNodes[span.to].lane.classList.add('is-end');
      else rowNodes[moments.length - 1].lane.classList.add('is-over');
    }
  }

  // ------------------------------------------------------------ 재생

  async function run() {
    running = true;
    armed = null;
    bar.btn.run.disabled = true;
    bar.btn.clear.disabled = true;
    paint();
    // 선반은 치우고 손패를 화면 아래에 고정한다. 재생 중에 고를 것은 없고,
    // 누를 것은 하나뿐이며 그건 늘 같은 자리에 있어야 한다.
    tray.hidden = true;
    hand.classList.add('tl__hand--live');
    say(d.runNote || '하루가 시작된다.');

    for (let t = 0; t < moments.length; t++) {
      now = t;
      const r = rowNodes[t];
      r.node.classList.add('is-now');
      try { r.node.scrollIntoView({ block: 'center' }); } catch { /* 구형 브라우저 */ }
      say(`${moments[t].clock || ''} ${moments[t].label}`);

      for (const m of r.marks.children) m.classList.add('is-fired');
      if (r.lane.classList.contains('is-end')) r.lane.classList.add('is-back');

      await wait(TICK);
      r.node.classList.remove('is-now');
      r.node.classList.add('is-past');
    }

    now = -1;
    running = false;
    hand.classList.remove('tl__hand--live');
    hand.hidden = true;

    const sim = game.simulate({ placed: { ...placed }, presses: [...presses], opened }, d);

    // 지켜야 할 것들이 하나씩 판정된다 — 이 판의 결말은 점수가 아니라 이 줄들이다.
    for (const g of goals) {
      const c = goalNodes.get(g.id);
      if (!c) continue;
      c.classList.add(sim.met && sim.met[g.id] ? 'tl__goal--met' : 'tl__goal--miss');
      pulse(c, 1);
      await wait(240);
    }
    try { goalBoard.scrollIntoView({ block: 'nearest' }); } catch { /* 구형 브라우저 */ }

    const rn = runner(d.runCaption || '오늘 무슨 일이 있었나');
    feedback.append(rn.node);
    await rn.play(sim.steps);

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
}
