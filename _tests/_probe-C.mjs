// _probe-C.mjs — READ-ONLY difficulty probe for engine-C games 1 / 10 / 16.
// Temporary audit script. It writes nothing and modifies no src file.
// Output is deliberately ASCII-labelled so Windows consoles cannot mangle it.

// --- localStorage stub must exist BEFORE games/16 (-> core/state.js) loads, ---
// --- otherwise the 3 advanced parts never appear in ticket.data.parts.      ---
const CLEARED = {
  version: 1,
  cleared: {
    'team-layout':      { grade: 'pass', score: 100, at: 0 },
    'prevent-accident': { grade: 'pass', score: 100, at: 0 },
    'auto-line':        { grade: 'pass', score: 100, at: 0 }
  },
  unlockedTerms: [], earnedTerms: [], lastNode: null, settings: {}
};
globalThis.localStorage = {
  getItem: k => (k === 'ai-course-v1' ? JSON.stringify(CLEARED) : null),
  setItem: () => {}, removeItem: () => {}
};

const { newDesk, arrive, takeOff, fold, live, dimmed, settle, used } =
  await import('../src/core/bag.js');

// Expose the PRE-CLAMP score. finish() does Math.min(100, ...) before grading,
// so the raw total is what says how much slack a configuration really has.
// Runtime-only patch: adds a field, changes no scoring, writes no file.
const simMod = await import('../src/core/sim.js');
const origFinish = simMod.Run.prototype.finish;
simMod.Run.prototype.finish = function (cut, extra) {
  const out = origFinish.call(this, cut, extra);
  out.raw = this.score;
  out.cut = cut;
  return out;
};

const bag    = (await import('../src/games/01-context-bag.js')).default;
const doc    = (await import('../src/games/10-onboarding-doc.js')).default;
const ticket = (await import('../src/games/16-work-ticket.js')).default;

const pct = (a, b) => (b ? (100 * a / b).toFixed(2) : '0.00') + '%';
const line = s => console.log(s);
const hr = () => console.log('-'.repeat(78));
const F = s => `grade=${s.grade} score=${s.score} raw=${s.raw}` +
  ` faults=[${s.faults.map(x => x.name).join(', ')}]` +
  ` gains=[${s.gains.map(x => x.name).join(', ')}]`;

// ============================================================ helpers (copied)
// play() / pack() are copied verbatim from _tests/test-bag.mjs so this probe
// builds `setup` exactly the way engines/build.js does.

function play(script = []) {
  const d = bag.data;
  let desk = newDesk(d.budget);
  const shots = [];
  for (let i = 0; i < d.rounds.length; i++) {
    if (i > 0) desk = settle(desk, i);
    const list = (d.rounds[i].arrive || []).map(id => d.parts.find(p => p.id === id));
    desk = arrive(desk, list, i + 1);
    const act = script[i] || {};
    if (act.fold) desk = fold(desk, act.fold, i + 1, `요약본 ${desk.folds + 1}`);
    for (const id of act.drop || []) desk = takeOff(desk, id, i + 1);
    shots.push(desk);
  }
  desk = settle(desk, d.rounds.length);
  const setup = {
    desk, kept: live(desk), evicted: dimmed(desk),
    used: used(desk), cap: desk.cap, slots: {}, all: desk.items.slice(), runNo: 1
  };
  return { desk, shots, sim: bag.simulate(setup) };
}

function pack(ids, runNo = 1) {
  const cap = doc.data.budget;
  const pool = ids.map(id => doc.data.parts.find(p => p.id === id));
  let n = 0; const kept = [], out = [];
  for (let i = pool.length - 1; i >= 0; i--) {
    const c = pool[i].cost ?? 1;
    if (n + c <= cap) { n += c; kept.unshift(pool[i]); }
    else out.unshift(pool[i]);
  }
  return { kept, evicted: out, used: n, cap, slots: {}, all: pool, runNo };
}

/** engines/build.js slot-mode setup */
const slotSetup = (map, runNo = 1) => ({
  kept: [], evicted: [], slots: map,
  all: Object.values(map).flat(), used: 0, cap: 0, runNo
});

function subsets(arr) {
  const out = [[]];
  for (const x of arr) for (const s of out.slice()) out.push(s.concat(x));
  return out;
}
function combos(arr, k) {
  const out = [];
  (function go(start, cur) {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (let i = start; i < arr.length; i++) { cur.push(arr[i]); go(i + 1, cur); cur.pop(); }
  })(0, []);
  return out;
}

// ============================================================ GAME 1
line('');
line('############### GAME 1  01-context-bag.js (engine C, rounds) ###############');
line('pass=85 partial=55   (from r.finish({ pass: 85, partial: 55 }))');
line(`desk budget = ${bag.data.budget} slots`);
{
  const cost = id => bag.data.parts.find(p => p.id === id).cost;
  const need = ['q3', 'q2', 'memo', 'voc'];
  const noise = ['notice', 'board', 'rival'];
  line(`  deadline needs ${need.join(',')} = ${need.reduce((n, i) => n + cost(i), 0)} slots`);
  line(`  noise ${noise.join(',')} = ${noise.reduce((n, i) => n + cost(i), 0)} slots`);
  line(`  everything = ${bag.data.parts.reduce((n, p) => n + p.cost, 0)} slots`);
  line(`  arrivals per round: ${bag.data.rounds.map((r, i) =>
    `r${i + 1}=${(r.arrive || []).reduce((n, id) => n + cost(id), 0)}`).join(' ')}`);
}

// ---- exhaustive enumeration ---------------------------------------------
// A human-plausible round = any sequence of the moves the UI actually offers:
//   [내리기]      drop any non-empty selection of desk items (enabled when picked>0)
//   [셋을 하나로] fold exactly 3 desk items                  (enabled when picked===3)
// Both buttons stay live all round, so several ops per round are possible.
// Consecutive drops are merged (takeOff is order-independent within a round),
// so drop-after-drop is forbidden and ops/round is capped at MAXOPS.
const MAXOPS = 2;

const deskKey = d => JSON.stringify({
  c: d.cap, f: d.folds,
  i: d.items.map(x => [x.id, x.at, x.blurAt, x.cost, x.folded ? 1 : 0, x.details.map(y => y.id)]),
  g: d.gone.map(x => [x.id, x.why, x.round, x.details.map(y => y.id)]),
  l: d.log.map(x => [x.kind, x.round, x.id, x.lost ?? ''])
});

function roundMoves(desk, round) {
  const out = [];
  (function go(d, depth, lastDrop) {
    out.push(d);
    if (depth >= MAXOPS) return;
    const ids = live(d).map(x => x.id);
    for (const t of combos(ids, 3)) {
      const nd = fold(d, t, round, `요약본 ${d.folds + 1}`);
      if (nd !== d) go(nd, depth + 1, false);
    }
    if (!lastDrop) {
      for (const s of subsets(ids)) {
        if (!s.length) continue;
        let nd = d;
        for (const id of s) nd = takeOff(nd, id, round);
        go(nd, depth + 1, true);
      }
    }
  })(desk, 0, false);
  return out;
}

{
  const d = bag.data;
  let frontier = new Map();
  const start = newDesk(d.budget);
  frontier.set(deskKey(start), { desk: start, n: 1 });

  for (let i = 0; i < d.rounds.length; i++) {
    const next = new Map();
    for (const { desk: dk0, n } of frontier.values()) {
      let dk = dk0;
      if (i > 0) dk = settle(dk, i);
      const list = (d.rounds[i].arrive || []).map(id => d.parts.find(p => p.id === id));
      dk = arrive(dk, list, i + 1);
      for (const m of roundMoves(dk, i + 1)) {
        const k = deskKey(m);
        const cur = next.get(k);
        if (cur) cur.n += n; else next.set(k, { desk: m, n });
      }
    }
    frontier = next;
    let seqs = 0; for (const v of frontier.values()) seqs += v.n;
    line(`  round ${i + 1}: distinct desks = ${frontier.size}, move-sequences so far = ${seqs}`);
  }

  let total = 0, p = 0, part = 0, f = 0, best = -1, bestRaw = -1;
  let cleanTot = 0, cleanPass = 0;
  const hist = new Map();
  for (const { desk: dk0, n } of frontier.values()) {
    const dk = settle(dk0, d.rounds.length);
    const setup = {
      desk: dk, kept: live(dk), evicted: dimmed(dk),
      used: used(dk), cap: dk.cap, slots: {}, all: dk.items.slice(), runNo: 1
    };
    const sim = bag.simulate(setup);
    total += n;
    if (sim.grade === 'pass') p += n; else if (sim.grade === 'partial') part += n; else f += n;
    if (!setup.evicted.length) { cleanTot += n; if (sim.grade === 'pass') cleanPass += n; }
    if (sim.score > best) best = sim.score;
    if (sim.raw > bestRaw) bestRaw = sim.raw;
    hist.set(sim.score, (hist.get(sim.score) || 0) + n);
  }
  line('');
  line(`GAME1 ENUMERATION (exhaustive; <=${MAXOPS} ops/round, consecutive drops merged)`);
  line(`  move-sequences total = ${total}`);
  line(`  pass    = ${p} (${pct(p, total)})`);
  line(`  partial = ${part} (${pct(part, total)})`);
  line(`  fail    = ${f} (${pct(f, total)})`);
  line(`  MAX SCORE = ${best}   (max pre-clamp raw = ${bestRaw}; slack over pass line = ${bestRaw - 85})`);
  const ss = [...hist.keys()].sort((a, b) => b - a);
  line(`  score histogram: ${ss.map(s => s + 'x' + hist.get(s)).join('  ')}`);
  line(`  sub-population "desk never overflowed at a round boundary":`);
  line(`    ${cleanTot} sequences, pass = ${cleanPass} (${pct(cleanPass, cleanTot)})`);
}

// ---- named players -------------------------------------------------------
line('');
line('GAME1 NAMED PLAYERS');
{
  const show = (label, script) => line(`  ${label}\n    ${F(play(script).sim)}`);
  show('THOUGHTLESS  press [다음]x3 then [보고서 쓰기], touch nothing:', []);
  show('THOUGHTFUL   drop each noise file as it arrives (notice / board / rival):',
    [{ drop: ['notice'] }, { drop: ['board'] }, { drop: ['rival'] }]);
  show('THOUGHTFUL-B fold r1 (q3+notice+q2), drop board r2:',
    [{ fold: ['q3', 'notice', 'q2'] }, { drop: ['board'] }]);
  show('NEAR-MISS-A  same 3 drops but all at the deadline round (acted too late):',
    [{}, {}, {}, { drop: ['notice', 'board', 'rival'] }]);
  show('NEAR-MISS-B  keeps 경쟁사 가격 변동(rival) as a plausible cause, drops the other 2:',
    [{ drop: ['notice'] }, { drop: ['board'] }]);
  show('NEAR-MISS-C  drops only the obvious junk (notice + board):',
    [{ drop: ['notice'] }, { drop: ['board'] }]);
  show('OVER-FOLDER  keeps folding to make room:',
    [{ fold: ['q3', 'notice', 'q2'] }, { fold: ['fold-1', 'memo', 'board'] }]);
}

// ============================================================ GAME 10
line('');
hr();
line('############## GAME 10  10-onboarding-doc.js (engine C, budget) ##############');
line('pass=85 partial=55');
line(`  budget = ${doc.data.budget} slots, repair runs = ${doc.data.repair.runs}`);
line(`  rules total cost = ${doc.data.parts.reduce((n, p) => n + (p.cost ?? 1), 0)} slots`);
{
  const ids = doc.data.parts.map(p => p.id);
  const memo = new Map();
  const run = pool => {
    // reproduce engines/build.js paint()/run(): fill from the newest backwards
    const cap = doc.data.budget;
    let n = 0; const kept = [], out = [];
    for (let i = pool.length - 1; i >= 0; i--) {
      const c = doc.data.parts.find(p => p.id === pool[i]).cost ?? 1;
      if (n + c <= cap) { n += c; kept.unshift(pool[i]); } else out.unshift(pool[i]);
    }
    const key = kept.join(',') + '|' + out.join(',');
    let r = memo.get(key);
    if (!r) {
      const sim = doc.simulate({
        kept: kept.map(id => doc.data.parts.find(p => p.id === id)),
        evicted: out.map(id => doc.data.parts.find(p => p.id === id)),
        used: n, cap, slots: {},
        all: pool.map(id => doc.data.parts.find(p => p.id === id)), runNo: 1
      });
      r = { grade: sim.grade, score: sim.score, raw: sim.raw };
      memo.set(key, r);
    }
    return r;
  };

  let total = 0, p = 0, part = 0, f = 0, best = -1, bestRaw = -1, bestPool = null;
  const hist = new Map();
  const cur = [], seen = new Array(ids.length).fill(false);
  (function go() {
    if (cur.length) {
      const r = run(cur);
      total++;
      if (r.grade === 'pass') p++; else if (r.grade === 'partial') part++; else f++;
      hist.set(r.score, (hist.get(r.score) || 0) + 1);
      if (r.raw > bestRaw) bestRaw = r.raw;
      if (r.score > best) { best = r.score; bestPool = cur.slice(); }
    }
    if (cur.length === ids.length) return;
    for (let i = 0; i < ids.length; i++) {
      if (seen[i]) continue;
      seen[i] = true; cur.push(ids[i]); go(); cur.pop(); seen[i] = false;
    }
  })();

  line('');
  line('GAME10 ENUMERATION (exhaustive: every ordered tap-sequence of distinct rules)');
  line(`  move-sequences total = ${total}   (distinct kept|evicted outcomes = ${memo.size})`);
  line(`  pass    = ${p} (${pct(p, total)})`);
  line(`  partial = ${part} (${pct(part, total)})`);
  line(`  fail    = ${f} (${pct(f, total)})`);
  line(`  MAX SCORE = ${best}   (max pre-clamp raw = ${bestRaw}; slack over pass line = ${bestRaw - 85})`);
  line(`  one maximal pool = [${bestPool.join(', ')}]`);
  const ss = [...hist.keys()].sort((a, b) => b - a);
  line(`  score histogram: ${ss.map(s => s + 'x' + hist.get(s)).join('  ')}`);
}
line('');
line('GAME10 NAMED PLAYERS');
{
  const all = doc.data.parts.map(p => p.id);
  const dumbPack = pack(all);
  line('  THOUGHTLESS  tap every rule in tray order ("put everything in"):');
  line(`    kept=[${dumbPack.kept.map(x => x.id).join(', ')}] evicted=[${dumbPack.evicted.map(x => x.id).join(', ')}]`);
  line(`    ${F(doc.simulate(dumbPack))}`);
  line('  THOUGHTLESS-B tap the first 5 rules in tray order (exactly fills the budget):');
  line(`    ${F(doc.simulate(pack(all.slice(0, 5))))}`);
  line('  THOUGHTFUL   4 concrete non-conflicting rules, 1 slot left spare:');
  line(`    ${F(doc.simulate(pack(['blank-mark', 'no-pii', 'ask', 'format'])))}`);
  line('  THOUGHTFUL on run 2 (repair mode re-run):');
  line(`    ${F(doc.simulate(pack(['blank-mark', 'no-pii', 'ask', 'format'], 2)))}`);
}

// ============================================================ GAME 16
line('');
hr();
line('############### GAME 16  16-work-ticket.js (engine C, slots) ###############');
line('pass=85 partial=55');
{
  const parts = ticket.data.parts;
  const idp = id => parts.find(p => p.id === id);
  line(`  parts visible with advanced unlocked = ${parts.length}: ${parts.map(p => p.id).join(', ')}`);
  for (const s of ticket.data.slots) {
    line(`  slot ${s.id} capacity=${s.capacity} accepts=${s.accepts.join(',')}`);
  }
  const BASE = new Set(['s-rules', 's-cases', 's-web', 's-memo', 'm-chat', 'm-project',
                        'g-cite', 'g-human', 'g-none']);

  const enumerate = pool => {
    const pick = t => pool.filter(p => p.tags.includes(t)).map(p => p.id);
    const srcOpts = subsets(pick('source')).filter(s => s.length <= 2);
    const metOpts = [[]].concat(pick('method').map(m => [m]));
    const grdOpts = subsets(pick('guard')).filter(s => s.length <= 2);
    const out = [];
    for (const a of srcOpts) for (const b of metOpts) for (const c of grdOpts) {
      if (!a.length && !b.length && !c.length) continue;   // [실행] stays disabled
      out.push({ a, b, c });
    }
    return out;
  };
  const runCfg = c => ticket.simulate(slotSetup({
    source: c.a.map(idp), method: c.b.map(idp), guard: c.c.map(idp)
  }), ticket.data);

  for (const [label, pool] of [
    ['BASE ONLY (required course cleared)', parts.filter(p => BASE.has(p.id))],
    ['WITH ADVANCED PARTS (deep course cleared)', parts]
  ]) {
    const all = enumerate(pool);
    let p = 0, part = 0, f = 0, best = -1, bestRaw = -1, bestCfg = null;
    const hist = new Map();
    for (const c of all) {
      const sim = runCfg(c);
      if (sim.grade === 'pass') p++; else if (sim.grade === 'partial') part++; else f++;
      hist.set(sim.score, (hist.get(sim.score) || 0) + 1);
      if (sim.raw > bestRaw) { bestRaw = sim.raw; bestCfg = c; }
      if (sim.score > best) best = sim.score;
    }
    line('');
    line(`GAME16 ENUMERATION - ${label} (exhaustive; no part placed twice)`);
    line(`  configurations total = ${all.length}`);
    line(`  pass    = ${p} (${pct(p, all.length)})`);
    line(`  partial = ${part} (${pct(part, all.length)})`);
    line(`  fail    = ${f} (${pct(f, all.length)})`);
    line(`  MAX SCORE = ${best}   (max pre-clamp raw = ${bestRaw}; slack over pass line = ${bestRaw - 85})`);
    line(`  maximal cfg: source=[${bestCfg.a}] method=[${bestCfg.b}] guard=[${bestCfg.c}]`);
    const ss = [...hist.keys()].sort((a, b) => b - a);
    line(`  score histogram: ${ss.map(s => s + 'x' + hist.get(s)).join('  ')}`);
    const full = all.filter(c => c.a.length === 2 && c.b.length === 1 && c.c.length === 2);
    let fp = 0, fq = 0, ff = 0;
    for (const c of full) {
      const g = runCfg(c).grade;
      if (g === 'pass') fp++; else if (g === 'partial') fq++; else ff++;
    }
    line(`  sub-population "just fills every slot to capacity": ${full.length} configs, ` +
         `pass=${fp} (${pct(fp, full.length)}) partial=${fq} fail=${ff}`);
  }

  line('');
  line('GAME16 NAMED PLAYERS (base-only pool = what a required-course player sees)');
  const first = (t, n) => parts.filter(p => p.tags.includes(t) && BASE.has(p.id)).slice(0, n);
  line('  THOUGHTLESS  fill every slot to capacity with the FIRST parts in tray order:');
  line(`    source=[${first('source', 2).map(p => p.id)}] method=[${first('method', 1).map(p => p.id)}] guard=[${first('guard', 2).map(p => p.id)}]`);
  line(`    ${F(ticket.simulate(slotSetup({ source: first('source', 2), method: first('method', 1), guard: first('guard', 2) }), ticket.data))}`);
  line('  THOUGHTLESS-B place a single part and hit run:');
  line(`    ${F(ticket.simulate(slotSetup({ source: first('source', 1), method: [], guard: [] }), ticket.data))}`);
  line('  THOUGHTLESS-C take the flagged/lazy parts (s-web+s-memo / m-chat / g-none):');
  line(`    ${F(ticket.simulate(slotSetup({ source: [idp('s-web'), idp('s-memo')], method: [idp('m-chat')], guard: [idp('g-none')] }), ticket.data))}`);
  line('  THOUGHTFUL   s-rules+s-cases / m-project / g-cite+g-human:');
  line(`    ${F(ticket.simulate(slotSetup({ source: [idp('s-rules'), idp('s-cases')], method: [idp('m-project')], guard: [idp('g-cite'), idp('g-human')] }), ticket.data))}`);

  line('');
  line('GAME16 SENSITIVITY - break the thoughtful config one slot at a time:');
  const variants = [
    ['method m-project -> m-chat (the punished method)',
      ['s-rules', 's-cases'], ['m-chat'], ['g-cite', 'g-human']],
    ['method -> empty (never chose a method at all)',
      ['s-rules', 's-cases'], [], ['g-cite', 'g-human']],
    ['source s-cases -> s-web (the danger-flagged source)',
      ['s-rules', 's-web'], ['m-project'], ['g-cite', 'g-human']],
    ['source s-cases -> s-memo (the rot-inducing source)',
      ['s-rules', 's-memo'], ['m-project'], ['g-cite', 'g-human']],
    ['source -> s-web only (no rulebook + danger source)',
      ['s-web'], ['m-project'], ['g-cite', 'g-human']],
    ['guard g-human -> g-none ("send it with no review")',
      ['s-rules', 's-cases'], ['m-project'], ['g-cite', 'g-none']],
    ['guard -> g-none only',
      ['s-rules', 's-cases'], ['m-project'], ['g-none']],
    ['guard -> g-human only (no citation)',
      ['s-rules', 's-cases'], ['m-project'], ['g-human']],
    ['guard -> g-cite only (no human check)',
      ['s-rules', 's-cases'], ['m-project'], ['g-cite']]
  ];
  for (const [label, a, b, c] of variants) {
    const sim = ticket.simulate(slotSetup({
      source: a.map(idp), method: b.map(idp), guard: c.map(idp)
    }), ticket.data);
    line(`  ${label}\n    grade=${sim.grade} score=${sim.score} raw=${sim.raw} faults=[${sim.faults.map(x => x.name).join(', ')}]`);
  }
}

line('');
line('==== probe done ====');
