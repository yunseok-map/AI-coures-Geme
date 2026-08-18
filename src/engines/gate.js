// 엔진 M — 권한 게이트. 에이전트와 시스템 사이 케이블 위의 **문을 하나씩 연다.**
//
// 왜 이 조작인가:
//   예전 9번은 시스템마다 권한 카드를 하나 골라 칸에 넣는 판이었다. 그러면
//   "읽기만 / 전부" 둘 중 하나를 고르는 객관식이 되고, 최소 권한은 고를 수
//   있는 값이 되어 버린다. 실무에서 최소 권한이 어려운 이유는 고르기 어려워서가
//   아니라 **일마다 필요한 동작이 다르고, 그걸 직접 추려야 하기 때문**이다.
//   그래서 문을 하나씩 연다. 열 수 있는 문이 열 개가 넘고, 정답은 그중 셋이다.
//
// 이 판의 심장 — **시험 가동과 본 가동이 알려 주는 것이 다르다.**
//   시험 가동은 업무만 돌린다. 그래서 "모자라지 않다"는 확인해 준다.
//   그런데 "남지 않았다"는 **아무리 돌려도 안 알려 준다.** 남는 권한은
//   누가 그리로 들어오기 전까지 아무 증상이 없기 때문이다.
//   권한을 넉넉히 열어 두는 습관이 사라지지 않는 진짜 이유가 이것이다.
//   그래서 시험 가동은 몇 번을 해도 공짜로 둔다. 그게 함정이다.
//
// 통과 규칙은 core/perm.js 가 한다 — 화면에서 막힌 것과 판정이 막았다고 한 것이
// 어긋나면 이 판은 아무것도 못 가르친다.
// 판정은 game.simulate({ open, work, attack }) 가 한다. 엔진은 내용을 모른다.

import { el, esc, say, Bin, header, actions, runner } from './base.js';
import { shake, enter, cardIn, pulse, wait, isReduced } from '../core/motion.js';
import { key, runSteps, width } from '../core/perm.js';

let bin = new Bin();

export function unmount() { bin.clear(); }

export function mount(root, game, ctx) {
  unmount();
  bin = new Bin();

  const d = game.data;
  const systems = d.systems || [];
  const work = d.work || [];
  const attack = d.attack || [];
  const L = d.labels || {};
  const startedAt = Date.now();

  /** 열린 문 — 'sysId:gateId' 문자열 */
  const open = new Set();
  /** 시험 가동을 몇 번 돌렸나. 세어서 결과에 넘긴다 */
  let trials = 0;
  let over = false;
  /** 본 가동이 끝난 뒤에만 채워진다 — 그 전에는 문에 색이 붙지 않는다 */
  let usedBy = null;

  const gateNodes = new Map();   // 열쇠 → 버튼
  const rowNodes = new Map();    // 시스템 id → { row, cable, count }

  root.innerHTML = '';
  root.append(header(game));

  // ---- 맡길 일 ----
  if (d.brief) {
    const t = el('article', 'ticket');
    t.innerHTML = `<div class="ticket__no">${esc(d.briefCap || '맡길 일')}</div>` +
                  `<div class="ticket__body">${esc(d.brief)}</div>`;
    root.append(t);
  }

  const hint = el('p', 'gt__hint');
  root.append(hint);

  // ---- 배선판 ----
  const board = el('section', 'gt__board');
  const agent = el('div', 'gt__agent');
  agent.innerHTML = `<span class="gt__agent__dot" aria-hidden="true"></span>` +
                    `<span>${esc(L.agent || 'AI 에이전트')}</span>`;
  board.append(agent);

  const rows = el('div', 'gt__rows');
  board.append(rows);

  for (const sys of systems) {
    const row = el('div', 'gt__row');

    const head = el('div', 'gt__row__head');
    head.innerHTML = `<span class="gt__sys">${esc(sys.label)}</span>` +
                     `<span class="gt__count" aria-hidden="true"></span>`;

    const cable = el('div', 'gt__cable');
    for (const g of sys.gates) {
      const b = el('button', 'gt__gate');
      b.type = 'button';
      b.dataset.k = key(sys.id, g.id);
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = `<span class="gt__gate__ring" aria-hidden="true"></span>` +
                    `<span class="gt__gate__name">${esc(g.label)}</span>` +
                    `<span class="gt__gate__mark"></span>`;
      bin.on(b, 'click', () => toggle(sys, g, b));
      cable.append(b);
      gateNodes.set(key(sys.id, g.id), b);
    }

    row.append(head, cable);
    rows.append(row);
    rowNodes.set(sys.id, { row, cable, count: head.querySelector('.gt__count') });
  }

  root.append(board);

  // ---- 로그가 붙는 자리 ----
  const feedback = el('div', 'gt__feedback');
  root.append(feedback);

  const bar = actions([
    { id: 'trial', label: L.trial || '시험 가동' },
    { id: 'reset', label: L.reset || '전부 닫기' },
    { id: 'run',   label: L.run || '본 가동', primary: true }
  ]);
  root.append(bar.node);
  bin.on(bar.btn.trial, 'click', () => trial());
  bin.on(bar.btn.reset, 'click', () => resetAll());
  bin.on(bar.btn.run, 'click', () => run());

  paint();
  enter([...rowNodes.values()].map(r => r.row));
  say(d.sayStart || '문을 눌러 연다. 연 만큼만 에이전트가 움직인다.');

  // ------------------------------------------------------------ 조작

  function toggle(sys, g, node) {
    if (over) return;
    const k = key(sys.id, g.id);
    if (open.has(k)) {
      open.delete(k);
      say(`${sys.label} ${g.label} — ${L.sayShut || '닫았다'}`);
    } else {
      open.add(k);
      pulse(node);
      say(`${sys.label} ${g.label} — ${L.sayOpen || '열었다'}`);
    }
    paint();
  }

  function resetAll() {
    if (over) return;
    open.clear();
    trials = 0;
    feedback.innerHTML = '';
    paint();
    say(L.sayReset || '문을 전부 닫았다.');
  }

  // ------------------------------------------------------------ 그리기

  function paint() {
    for (const sys of systems) {
      const w = width(sys, open);
      const r = rowNodes.get(sys.id);
      // 굵기는 0~3 네 단계다. 열수록 케이블이 굵어지는 것을 눈으로 보게 한다.
      // 문이 둘뿐인 시스템도 다 열면 빨개져야 한다 — 굵기가 아니라 '다 열었나'가 신호다.
      r.cable.dataset.w = String(Math.min(3, w));
      r.cable.dataset.full = w && w === sys.gates.length ? '1' : '';
      r.row.classList.toggle('gt__row--live', w > 0);
      r.count.textContent = w ? `${w}${L.gateUnit || '문 열림'}` : '';
      for (const g of sys.gates) {
        const k = key(sys.id, g.id);
        const b = gateNodes.get(k);
        const on = open.has(k);
        b.classList.toggle('gt__gate--on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        const mark = b.querySelector('.gt__gate__mark');
        mark.textContent = '';
        mark.className = 'gt__gate__mark';
        if (usedBy) {
          const u = usedBy.get(k);
          if (u === 'work')   { mark.textContent = L.markWork || '업무가 씀'; mark.classList.add('gt__gate__mark--ok'); }
          if (u === 'attack') { mark.textContent = L.markAttack || '공격이 지나감'; mark.classList.add('gt__gate__mark--no'); }
          if (u === 'idle')   { mark.textContent = L.markIdle || '아무도 안 씀'; mark.classList.add('gt__gate__mark--idle'); }
        }
      }
    }

    bar.btn.run.disabled = over || open.size === 0;
    bar.btn.trial.disabled = over || open.size === 0;
    bar.btn.reset.disabled = over || open.size === 0;

    if (over) { hint.textContent = ''; return; }
    // 모자란 것도 남는 것도 여기서는 안 알려 준다 — 그걸 알려 주면 판이 끝난다.
    hint.textContent = open.size
      ? `${L.hintOpen || '열어 둔 문'} ${open.size}${L.hintUnit || '개'}`
      : (d.hint || '');
  }

  // ------------------------------------------------------------ 시험 가동

  async function trial() {
    if (over) return;
    trials++;
    bar.btn.trial.disabled = bar.btn.run.disabled = bar.btn.reset.disabled = true;
    feedback.innerHTML = '';

    const rows2 = runSteps(work, open);
    const r = runner(L.trialCaption || '시험 가동 — 업무만 돌려 본다');
    feedback.append(r.node);
    r.node.scrollIntoView({ block: 'nearest' });

    const steps = rows2.map(s => ({
      kind: s.passed ? 'do' : 'warn',
      text: s.passed ? s.ok : s.no
    }));
    const blocked = rows2.filter(s => !s.passed).length;
    steps.push(blocked
      ? { kind: 'fail', text: `${blocked}${L.trialBlocked || '건이 막혀서 일이 끝나지 않았다'}` }
      : { kind: 'ok', text: L.trialDone || '업무는 끝까지 돌아간다' });
    // 시험 가동이 절대 말해 주지 않는 것. 이 한 줄이 이 판의 교훈이다.
    steps.push({ kind: 'read', text: L.trialBlind || '시험 가동으로는 여기까지만 알 수 있다' });

    await r.play(steps);
    over = false;
    paint();
  }

  // ------------------------------------------------------------ 본 가동

  async function run() {
    over = true;
    bar.btn.trial.disabled = bar.btn.reset.disabled = bar.btn.run.disabled = true;
    for (const b of gateNodes.values()) b.disabled = true;
    feedback.innerHTML = '';

    const workRows = runSteps(work, open);
    const attackRows = runSteps(attack, open);

    const r = runner(d.runCaption || '본 가동 — 연 대로 에이전트가 움직인다');
    feedback.append(r.node);
    r.node.scrollIntoView({ block: 'nearest' });

    const sim = game.simulate({ open: [...open], trials, work, attack }, d);
    await r.play(sim.steps);
    await wait(160);

    // 문마다 누가 지나갔는지 색으로 남긴다 — 숫자보다 이게 읽힌다
    usedBy = new Map();
    for (const k of open) usedBy.set(k, 'idle');
    for (const s of workRows) if (s.passed) usedBy.set(key(s.sys, s.gate), 'work');
    for (const s of attackRows) if (s.passed) usedBy.set(key(s.sys, s.gate), 'attack');
    paint();

    const hit = attackRows.filter(s => s.passed);
    if (hit.length && !isReduced()) {
      for (const s of hit) {
        const n = gateNodes.get(key(s.sys, s.gate));
        if (n) shake(n);
      }
    }

    const box = sheet(workRows, attackRows);
    feedback.append(box);
    cardIn(box);
    box.scrollIntoView({ block: 'nearest' });
    await wait(420);

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

  /** 마지막 정리표 — 업무가 쓴 문과 공격이 지나간 문을 나란히 놓는다 */
  function sheet(workRows, attackRows) {
    const box = el('section', 'gt__sheet');
    box.append(el('h3', 'gt__sheet__cap', esc(L.sheetCap || '누가 어느 문으로 지나갔나')));

    const add = (cap, list, cls) => {
      if (!list.length) return;
      const g = el('div', 'gt__grp ' + cls);
      g.append(el('div', 'gt__grp__cap', esc(cap)));
      for (const s of list) {
        const sys = systems.find(x => x.id === s.sys);
        const gate = sys && sys.gates.find(x => x.id === s.gate);
        const item = el('div', 'gt__grp__row');
        item.innerHTML =
          `<b>${esc(sys ? sys.label : s.sys)} ${esc(gate ? gate.label : s.gate)}</b>` +
          `<span>${esc(s.passed ? s.ok : s.no)}</span>`;
        g.append(item);
      }
      box.append(g);
    };

    add(L.capWork || '업무가 지나간 문', workRows.filter(s => s.passed), 'gt__grp--ok');
    add(L.capStuck || '막혀서 못 한 일', workRows.filter(s => !s.passed), 'gt__grp--stuck');
    add(L.capHit || '공격이 지나간 문', attackRows.filter(s => s.passed), 'gt__grp--no');
    add(L.capHeld || '공격이 막힌 문', attackRows.filter(s => !s.passed), 'gt__grp--held');

    const idle = [...open].filter(k => !workRows.some(s => s.passed && key(s.sys, s.gate) === k) &&
                                       !attackRows.some(s => s.passed && key(s.sys, s.gate) === k));
    if (idle.length) {
      const g = el('div', 'gt__grp gt__grp--idle');
      g.append(el('div', 'gt__grp__cap', esc(L.capIdle || '열었지만 아무도 안 쓴 문')));
      for (const k of idle) {
        const [sid, gid] = k.split(':');
        const sys = systems.find(x => x.id === sid);
        const gate = sys && sys.gates.find(x => x.id === gid);
        const item = el('div', 'gt__grp__row');
        item.innerHTML = `<b>${esc(sys ? sys.label : sid)} ${esc(gate ? gate.label : gid)}</b>` +
                         `<span>${esc(L.idleWhy || '이번에는 아무 일도 없었다. 다음에도 없다는 뜻은 아니다.')}</span>`;
        g.append(item);
      }
      box.append(g);
    }
    return box;
  }
}
