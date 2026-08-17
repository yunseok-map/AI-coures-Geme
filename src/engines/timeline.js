// 엔진 D — 배치형. 일을 타임라인에 순서대로 / 나란히 놓는다.
//
// 흐름·순서·위임을 가르치는 엔진이다. 병렬로 몰면 빨라지지만 합치기에서 깨지고,
// 순서대로만 하면 마감을 넘긴다 — 그걸 말로 설명하지 않고 **직접 배치해서 겪게** 한다.
//
// 배치가 끝나면 [실행]을 눌러 로그를 본다. 판정은 game.simulate(plan) 이 한다.

import { el, esc, say, Bin, header, actions, runner } from './base.js';
import { press, shake, enter, wipeIn, pulse } from '../core/motion.js';
import { eulReul } from '../core/ko.js';

let bin = new Bin();
export function unmount() { bin.clear(); }

export function mount(root, game, ctx) {
  bin.clear();
  bin = new Bin();

  const d = game.data;
  const LANES = d.lanes ?? 2;
  const TICKS = d.ticks ?? 8;
  const startedAt = Date.now();

  /** 배치 결과: [{ item, kind:'job'|'gate', lane, tick }] */
  const plan = [];
  /** 점유 격자 — 겹쳐 놓지 못하게 */
  const grid = Array.from({ length: LANES }, () => Array(TICKS).fill(null));
  let armed = null;   // 집어 든 일감/게이트

  root.innerHTML = '';
  root.append(header(game));

  if (d.brief) {
    const t = el('article', 'ticket');
    t.innerHTML = `<div class="ticket__no">${esc(d.briefCap || '상황')}</div>` +
                  `<div class="ticket__body">${esc(d.brief)}</div>`;
    root.append(t);
  }

  const scale = el('div', 'tick-scale');
  for (let i = 0; i < TICKS; i++) scale.append(el('span', null, String(i + 1)));
  root.append(scale);

  const lanesWrap = el('div', 'lanes');
  const cellNodes = [];
  for (let l = 0; l < LANES; l++) {
    const lane = el('div', 'lane');
    lane.append(el('span', 'lane__cap', (d.laneNames && d.laneNames[l]) || `줄 ${l + 1}`));
    const track = el('div', 'lane__track');
    const row = [];
    for (let t = 0; t < TICKS; t++) {
      const c = el('button', 'cell');
      c.type = 'button';
      c.setAttribute('aria-label', `${l + 1}번 줄 ${t + 1}번 칸`);
      bin.on(c, 'click', () => tapCell(l, t));
      track.append(c);
      row.push(c);
    }
    cellNodes.push(row);
    lane.append(track);
    lanesWrap.append(lane);
  }
  root.append(lanesWrap);

  // 사고 지점 표시 (게임 13)
  if (d.hazards && d.hazards.length) {
    const hz = el('div', 'hint');
    hz.innerHTML = '<b>사고가 날 수 있는 지점</b><br>' +
      d.hazards.map(h => `${h.atTick}번 칸 — ${esc(h.label)}`).join('<br>');
    root.append(hz);
  }

  root.append(el('div', 'slot__cap', esc(d.trayLabel || '배치할 것 — 눌러서 집고, 칸을 눌러 놓는다')));
  const tray = el('div', 'tray');
  root.append(tray);

  const itemNodes = new Map();
  const allItems = [
    ...(d.jobs || []).map(j => ({ ...j, kind: 'job' })),
    ...(d.gates || []).map(g => ({ ...g, kind: 'gate', dur: g.dur ?? 1 }))
  ];
  for (const it of allItems) {
    const b = el('button', 'part');
    b.type = 'button';
    b.innerHTML = `<span>${esc(it.label)}</span>` +
                  `<span class="part__cost">${it.kind === 'gate' ? '검토' : (it.dur ?? 1) + '칸'}</span>`;
    bin.on(b, 'click', () => tapItem(it, b));
    tray.append(b);
    itemNodes.set(it.id, b);
  }
  enter([...itemNodes.values()], { each: 25 });

  const feedback = el('div');
  root.append(feedback);

  const bar = actions([
    { id: 'reset', label: '비우기' },
    { id: 'run', label: d.runLabel || '실행', primary: true, disabled: true }
  ]);
  root.append(bar.node);
  bin.on(bar.btn.reset, 'click', resetAll);
  bin.on(bar.btn.run, 'click', run);

  paint();

  // ------------------------------------------------------------

  function tapItem(it, node) {
    if (plan.some(p => p.item.id === it.id)) { remove(it.id); return; }
    armed = armed && armed.id === it.id ? null : it;
    for (const n of itemNodes.values()) n.classList.remove('part--in');
    if (armed) {
      node.classList.add('part--in');
      say(`${eulReul(it.label)} 집었다. 놓을 칸을 고르세요.`);
    }
    paint();
  }

  function tapCell(lane, tick) {
    if (!armed) {
      const here = grid[lane][tick];
      if (here) remove(here);
      return;
    }
    const dur = armed.dur ?? 1;
    if (tick + dur > TICKS) { shake(cellNodes[lane][tick]); say('칸이 모자랍니다.'); return; }
    for (let i = 0; i < dur; i++) {
      if (grid[lane][tick + i]) { shake(cellNodes[lane][tick]); say('이미 다른 일이 있습니다.'); return; }
    }
    for (let i = 0; i < dur; i++) grid[lane][tick + i] = armed.id;
    plan.push({ item: armed, kind: armed.kind, lane, tick, dur });
    itemNodes.get(armed.id).classList.add('part--in');
    const filled = [];
    for (let i = 0; i < dur; i++) filled.push(cellNodes[lane][tick + i]);
    armed = null;
    paint();
    wipeIn(filled);   // 놓인 칸이 쓸리듯 채워진다
  }

  function remove(id) {
    const at = plan.findIndex(p => p.item.id === id);
    if (at < 0) return;
    const p = plan[at];
    for (let i = 0; i < p.dur; i++) grid[p.lane][p.tick + i] = null;
    plan.splice(at, 1);
    itemNodes.get(id).classList.remove('part--in');
    paint();
  }

  function resetAll() {
    plan.length = 0;
    for (let l = 0; l < LANES; l++) grid[l].fill(null);
    for (const n of itemNodes.values()) n.classList.remove('part--in');
    armed = null;
    feedback.innerHTML = '';
    paint();
  }

  function paint() {
    for (let l = 0; l < LANES; l++) {
      for (let t = 0; t < TICKS; t++) {
        const c = cellNodes[l][t];
        c.className = 'cell';
        c.textContent = '';
        const id = grid[l][t];
        if (id) {
          const p = plan.find(x => x.item.id === id);
          c.classList.add(p.kind === 'gate' ? 'cell--gate' : 'cell--job');
          if (p.tick === t) c.textContent = p.item.label;
        } else if (armed) {
          c.classList.add('cell--armed');
        }
        const hz = (d.hazards || []).find(h => h.atTick === t + 1);
        if (hz && !id) { c.classList.add('cell--hazard'); c.textContent = '!'; }
      }
    }
    const jobsPlaced = plan.filter(p => p.kind === 'job').length;
    const was = bar.btn.run.disabled;
    bar.btn.run.disabled = jobsPlaced === 0;
    if (was && !bar.btn.run.disabled) pulse(bar.btn.run, 1);
  }

  async function run() {
    bar.btn.run.disabled = true;
    bar.btn.reset.disabled = true;
    for (const n of itemNodes.values()) n.disabled = true;
    for (const row of cellNodes) for (const c of row) c.disabled = true;

    const r = runner(d.runCaption || '배치한 대로 돌려 본다');
    feedback.append(r.node);
    r.node.scrollIntoView({ block: 'nearest' });

    const sim = game.simulate({ plan: plan.slice(), lanes: LANES, ticks: TICKS }, d);
    await r.play(sim.steps);

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
