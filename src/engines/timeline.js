// 엔진 D — 배치형. 일을 타임라인에 순서대로 / 나란히 놓는다.
//
// 흐름·순서·위임을 가르치는 엔진이다. 병렬로 몰면 빨라지지만 합치기에서 깨지고,
// 순서대로만 하면 마감을 넘긴다 — 그걸 말로 설명하지 않고 **직접 배치해서 겪게** 한다.
//
// 배치가 끝나면 [실행]을 누른다. 그러면 **내가 만든 라인이 한 칸씩 실제로 흐르고**(재생),
// 그 다음에 무슨 일이 있었는지 로그가 나온다. 판정은 game.simulate(plan) 이 한다.
//
// 재생을 넣은 이유: 배치하고 로그만 읽으면 "왜 이 배치가 틀렸는지"가 글자로만 남는다.
// 마감선을 넘어가는 것과 취합이 너무 일찍 시작되는 것은 **눈으로 봐야** 남는다.

import { el, esc, say, Bin, header, actions, runner } from './base.js';
import { shake, enter, wipeIn, pulse } from '../core/motion.js';
import { eulReul } from '../core/ko.js';

let bin = new Bin();
let play = null;   // 재생 타이머

export function unmount() {
  bin.clear();
  if (play) { clearInterval(play); play = null; }
}

export function mount(root, game, ctx) {
  unmount();
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

  // 눈금. 마감이 있는 판은 그 칸에 선을 그어 둔다 —
  // 마감을 글로만 알려주면 배치하면서 잊는다.
  const scale = el('div', 'tick-scale');
  for (let i = 0; i < TICKS; i++) {
    const s = el('span', null, String(i + 1));
    if (d.deadline && i + 1 === d.deadline) {
      s.classList.add('tick--deadline');
      s.title = '마감';
    }
    scale.append(s);
  }
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
        // 마감 다음 칸부터는 배치해도 늦는다는 것을 칸 자체로 알려 준다
        if (d.deadline && t + 1 > d.deadline) c.classList.add('cell--late');
        const id = grid[l][t];
        if (id) {
          const p = plan.find(x => x.item.id === id);
          c.classList.add(p.kind === 'gate' ? 'cell--gate' : 'cell--job');
          // 되돌릴 수 없는 단계는 배치하는 동안에도 눈에 띄어야 한다
          if (p.item.irreversible) c.classList.add('cell--final');
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

  /**
   * 재생 — 내가 만든 라인이 한 칸씩 흐른다.
   *
   * 여기서는 loop.js 를 쓰지 않는다. 그쪽은 "탭을 벗어나면 멈추고 사용자가 이어서 누른다"가
   * 규칙인데, 재생은 사용자가 조작하는 구간이 아니라서 멈추면 이어 줄 사람이 없다.
   * 재생이 느리게 흐르는 것은 아무 손해가 아니므로 단순 타이머로 끝까지 굴린다.
   * 그래도 어떤 이유로든 안 끝나면 판정까지는 반드시 가도록 안전망을 둔다.
   */
  function playback() {
    const STEP = Math.round((d.playSec ?? 0.4) * 1000);
    return new Promise(done => {
      let t = -1, finished = false, guard = 0;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (play) { clearInterval(play); play = null; }
        if (guard) { clearTimeout(guard); guard = 0; }
        for (const row of cellNodes) for (const c of row) c.classList.remove('cell--now');
        done();
      };

      // 타이머를 먼저 만들고 안전망을 나중에 건다.
      // 순서가 반대면 안전망이 먼저 떴을 때 아직 없는 타이머를 지우려 해서
      // 재생이 멈추지 않고 계속 돈다.
      play = setInterval(() => {
        if (finished) return;
        t++;
        if (t >= TICKS) { finish(); return; }
        for (let l = 0; l < LANES; l++) {
          for (let k = 0; k < TICKS; k++) cellNodes[l][k].classList.toggle('cell--now', k === t);
          if (grid[l][t]) cellNodes[l][t].classList.add('cell--ran');
        }
        if (d.deadline && t + 1 === d.deadline) say('마감 칸입니다.');
      }, STEP);

      guard = setTimeout(finish, TICKS * STEP * 3 + 3000);
    });
  }

  async function run() {
    bar.btn.run.disabled = true;
    bar.btn.reset.disabled = true;
    for (const n of itemNodes.values()) n.disabled = true;
    for (const row of cellNodes) for (const c of row) c.disabled = true;

    say('배치한 라인이 흐릅니다.');
    await playback();

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
