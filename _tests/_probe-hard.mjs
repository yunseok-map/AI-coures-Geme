// _probe-hard.mjs — 7·8·15번 난이도 전수 조사 (읽기 전용, 아무것도 안 고친다)
//
// 사용자가 "이 셋이 어렵다"고 했다. 짐작으로 숫자를 만지지 않으려고 먼저 센다.
// CLAUDE.md 의 네 칸을 본다: 이길 수 있나 · 잘한 사람이 통과하나 ·
// 아무 생각 없는 사람이 못 하나 · 둘의 점수가 다른가.

const g7 = (await import('../src/games/07-name-trap.js')).default;
const g8 = (await import('../src/games/08-when-fires.js')).default;
const g15 = (await import('../src/games/15-spot-risk.js')).default;

const pct = (a, b) => `${a} (${(a / b * 100).toFixed(1)}%)`;

// ─────────────────────────────────────────────── 7번 이름에 속지 마라
console.log('\n############### 7번 이름에 속지 마라 (전수 2^8) ###############');
{
  const items = g7.data.items;
  const n = items.length;
  const tally = { pass: 0, partial: 0, fail: 0 };
  const hist = new Map();
  let best = -1, bestBets = null;

  for (let mask = 0; mask < (1 << n); mask++) {
    const bets = items.map((it, i) => ({ id: it.id, bet: !!(mask & (1 << i)) }));
    const s = g7.simulate({ bets }, g7.data);
    tally[s.grade]++;
    hist.set(s.score, (hist.get(s.score) || 0) + 1);
    if (s.score > best) { best = s.score; bestBets = bets; }
  }
  const total = 1 << n;
  console.log(`  통과 기준 pass=70 partial=25`);
  console.log(`  경우의 수 ${total}`);
  console.log(`  pass    = ${pct(tally.pass, total)}`);
  console.log(`  partial = ${pct(tally.partial, total)}`);
  console.log(`  fail    = ${pct(tally.fail, total)}`);
  console.log(`  최고 점수 ${best}`);
  console.log('  점수 분포: ' + [...hist.entries()].sort((a, b) => b[0] - a[0])
    .map(([s, c]) => `${s}x${c}`).join(' '));

  const say = (name, fn) => {
    const bets = items.map(it => ({ id: it.id, bet: fn(it) }));
    const s = g7.simulate({ bets }, g7.data);
    console.log(`  ${name}: ${s.grade} ${s.score}점 · 사유 [${s.faults.map(f => f.name).join(', ')}]`);
  };
  say('전부 맞힌 사람            ', it => it.answer);
  say('전부 "시킬 수 있다"       ', () => true);
  say('전부 "못 시킨다"          ', () => false);
  // 이 판이 겨냥한 사람 — 이름 때문에 내 일이 아니라고 접는 쪽
  say('내 노트북 일만 된다고 본 사람', it => it.cap === '내 노트북에 쌓인 일');
}

// ─────────────────────────────────────────────── 8번 언제 발동하나
console.log('\n############### 8번 언제 발동하나 (지켜야 할 것 몇 개까지 통과하나) ###############');
{
  const d = g8.data;
  const M = d.moments, T = d.tools;
  const at = (mid) => M.findIndex(m => m.id === mid);
  const tool = (id) => T.find(t => t.id === id);

  // 다섯을 다 지키는 배치 하나 (설계가 의도한 정답 경로)
  const perfect = {
    placed: { hook1: at('m3'), hook2: at('m8'), skill: at('m1'), agent: at('m2') },
    presses: [{ tick: at('m5') }]
  };
  const run = (name, setup) => {
    const s = g8.simulate(setup, d);
    const met = Object.values(s.met).filter(Boolean).length;
    console.log(`  ${name}: ${s.grade} ${s.score}점 · 지킨 것 ${met}/5 · ` +
      `사유 [${s.faults.map(f => f.name).join(', ')}]`);
    return s;
  };
  console.log(`  통과 기준 pass=85 partial=45 · 못 지킨 것 하나당 -22`);
  run('다섯 다 지킨 사람        ', perfect);
  // 하나씩 빼 본다 — 넷만 지켜도 통과하는가
  const drop = (k) => {
    const p = { placed: { ...perfect.placed }, presses: [...perfect.presses] };
    if (k === 'press') p.presses = [];
    else delete p.placed[k];
    return p;
  };
  run('커맨드를 못 누른 사람     ', drop('press'));
  run('서브에이전트를 안 쓴 사람 ', drop('agent'));
  run('스킬을 안 건 사람        ', drop('skill'));
  run('훅 하나만 건 사람        ', drop('hook2'));
  // 상자를 안 연 사람 — 도구가 둘뿐이다(훅1·커맨드)
  run('플러그인 상자를 안 연 사람', { placed: { hook1: at('m3') }, presses: [{ tick: at('m5') }] });
  run('아무것도 안 한 사람      ', { placed: {}, presses: [] });
}

// ─────────────────────────────────────────────── 15번 숨은 지시
console.log('\n############### 15번 숨은 지시 (전수: 심을 자리 × 시킬 일 × 대응책 조합) ###############');
{
  const d = g15.data;
  const wheres = d.wheres.map(w => w.id);
  const whats = d.whats.map(w => w.id);
  const guards = d.guards.map(g => g.id);
  const budget = d.budget;

  // 예산 안에서 고를 수 있는 대응책 조합 전부 (0개 ~ budget개)
  const combos = [];
  const walk = (i, cur) => {
    if (cur.length <= budget) combos.push([...cur]);
    if (cur.length === budget) return;
    for (let k = i; k < guards.length; k++) { cur.push(guards[k]); walk(k + 1, cur); cur.pop(); }
  };
  walk(0, []);

  const tally = { pass: 0, partial: 0, fail: 0 };
  let best = -1, bestCfg = null;
  const passing = [];
  let total = 0;
  for (const w of wheres) for (const t of whats) for (const c of combos) {
    const s = g15.simulate({ whereId: w, whatId: t, guardIds: c }, d);
    tally[s.grade]++; total++;
    if (s.grade === 'pass') passing.push(`${w}/${t}/[${c.join('+')}] ${s.score}`);
    if (s.score > best) { best = s.score; bestCfg = `${w} / ${t} / [${c.join(' + ')}]`; }
  }
  console.log(`  통과 기준 pass=82 partial=50 · 대응책 예산 ${budget}개 (전체 ${guards.length}개)`);
  console.log(`  심을 자리 ${wheres.length} × 시킬 일 ${whats.length} × 대응책 조합 ${combos.length} = ${total}`);
  console.log(`  pass    = ${pct(tally.pass, total)}`);
  console.log(`  partial = ${pct(tally.partial, total)}`);
  console.log(`  fail    = ${pct(tally.fail, total)}`);
  console.log(`  최고 점수 ${best} — ${bestCfg}`);
  console.log(`  통과하는 조합 ${passing.length}개:`);
  for (const p of passing.slice(0, 12)) console.log(`    ${p}`);

  // 대응책만 따로 — 심기는 성공했다고 두고 어떤 조합이 세 건을 다 막나
  console.log('  대응책 조합별 (심기는 성공한 경우):');
  const okWhere = d.agent.reads[0], okWhat = d.whats.find(w =>
    d.agent.tools.includes(w.tool || w.id) || true).id;
  for (const c of combos) {
    const s = g15.simulate({ whereId: okWhere, whatId: okWhat, guardIds: c }, d);
    const th = (s.out || '');
    console.log(`    [${c.join(' + ') || '없음'}] → ${s.grade} ${s.score}점 ` +
      `[${s.faults.map(f => f.name).join(', ')}]`);
  }
}

console.log('\n==== probe done ====');
