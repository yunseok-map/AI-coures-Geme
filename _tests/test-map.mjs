// 엔진 N(지형 답사) 검사 — 발품 계산과 17번 판의 판정.
//
// 이 판은 화면에서 한 번에 한 경로밖에 못 밟는다. 그런데 배워야 할 것이
// "같은 일도 갈래마다 대가가 다르다"라서 **경로를 나란히 놓고 비교해야** 증명된다.
// 여기서 그 비교를 한다 — 특히 두 가지를 숫자로 못 박는다:
//   ① 제일 좋은 길이 실제로 제일 높은 점수인가 (전수 탐색으로 확인한다)
//   ② 벽이 없는 길(애그리게이터)로만 가면 통과선 아래로 떨어지는가

const ROOT = '../src';
const g17 = (await import(`${ROOT}/games/17-which-ai.js`)).default;
const { route, walk, can, HARD, WALL_LEGWORK, DETOUR_LEGWORK } =
  await import(`${ROOT}/core/terrain.js`);

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };

const D = g17.data;
const JOBS = D.jobs;
const TERRAINS = D.terrains;
const job = id => JOBS.find(j => j.id === id);
const land = id => TERRAINS.find(t => t.id === id);
const names = r => r.faults.map(f => f.name);
const gains = r => r.gains.map(f => f.name);
const text = r => r.steps.map(s => s.text).join(' | ');
const to = (jobId, terrainId) => ({ jobId, terrainId });
const run = (picks) => g17.simulate({ picks }, D);

// ---------------------------------------------------------------- 벽
console.log('\n== 아예 못 하는 일은 둘뿐이다 ==');
{
  check('벽이 딱 두 종류다', HARD.length === 2, HARD.join(','));
  check('그림은 이미지·영상 갈래에서 된다', can(land('visual'), 'make'));
  check('그림은 회의록 갈래에서 안 된다', !can(land('meeting'), 'make'));
  check('말소리는 회의록 갈래에서 된다', can(land('meeting'), 'listen'));
  check('말소리는 챗봇에서 안 된다', !can(land('chat'), 'listen'));
  check('애그리게이터에는 벽이 없다',
    ['make', 'listen', 'write', 'find', 'bulk'].every(k => can(land('hub'), k)));
  check('나머지 일은 어느 갈래에서도 되기는 된다',
    TERRAINS.every(t => can(t, 'write') && can(t, 'find') && can(t, 'bulk')));

  const bounce = route(job('q3'), land('meeting'));
  check('벽에 부딪히면 되돌아온다', bounce.ok === false);
  check('되돌아와도 발품은 나간다', bounce.legwork === WALL_LEGWORK, String(bounce.legwork));
}

// ---------------------------------------------------------------- 대가
console.log('\n== 같은 일도 갈래마다 대가가 다르다 ==');
{
  const q1 = job('q1');   // 찾는 일 · 제대로 파야 하고 남이 이어받아야 한다
  const bySearch = route(q1, land('search'));
  const byChat = route(q1, land('chat'));
  const byHub = route(q1, land('hub'));
  const byCode = route(q1, land('code'));

  check('전담 갈래로 가면 먼 길이 아니다', bySearch.why === '' && bySearch.own === true);
  check('전담 갈래는 요구를 다 채운다', bySearch.missed.length === 0, bySearch.missed.join(','));
  check('챗봇도 찾는 일을 한다', byChat.ok && byChat.why === '', byChat.why);
  check('챗봇은 더 싸지만 넘기지 못한다',
    byChat.legwork < bySearch.legwork && byChat.missed.includes('hand'),
    `${byChat.legwork} vs ${bySearch.legwork} / ${byChat.missed.join(',')}`);
  check('애그리게이터가 제일 싸다',
    byHub.legwork < byChat.legwork && byHub.legwork < bySearch.legwork, String(byHub.legwork));
  check('애그리게이터는 얕다', byHub.why === 'shallow' && byHub.own === false);
  check('애그리게이터는 아무 요구도 못 채운다', byHub.met.length === 0, byHub.met.join(','));
  check('전담이 아닌 갈래는 먼 길이다', byCode.why === 'detour');
  check('먼 길은 발품이 더 든다',
    byCode.legwork === land('code').legwork + DETOUR_LEGWORK, String(byCode.legwork));

  // 요구가 없는 일에서는 제일 싼 길이 맞다 — "애그리게이터는 나쁘다"로 배우면 안 된다
  const q3 = job('q3');
  check('요구가 없는 의뢰가 하나 있다', q3.asks.length === 0);
  check('그 일은 애그리게이터가 제일 싸다',
    route(q3, land('hub')).legwork < route(q3, land('visual')).legwork);
  check('그 일은 어느 쪽으로 가도 못 채운 요구가 없다',
    route(q3, land('hub')).missed.length === 0 && route(q3, land('visual')).missed.length === 0);
}

// ---------------------------------------------------------------- 갈림길
console.log('\n== 한 의뢰에 되는 길이 둘 이상이고 발품이 다르다 ==');
for (const j of JOBS) {
  const open = TERRAINS.map(t => route(j, t)).filter(r => r.ok);
  check(`${j.short}: 되는 길이 둘 이상`, open.length >= 2, String(open.length));
  check(`${j.short}: 길마다 발품이 같지 않다`,
    new Set(open.map(r => r.legwork)).size >= 2, open.map(r => r.legwork).join(','));
}

// ---------------------------------------------------------------- 재생
console.log('\n== 고른 순서가 결과를 바꾼다 ==');
{
  const w = walk(JOBS, TERRAINS, [to('q1', 'search'), to('q1', 'chat')], D.budget);
  check('이미 끝낸 의뢰는 두 번 안 센다', w.steps.length === 1, String(w.steps.length));

  const poor = walk(JOBS, TERRAINS, [to('q4', 'code')], 3);
  check('발품이 모자라면 그 길로 못 간다', poor.steps[0].afford === false);
  check('못 간 길은 발품도 안 나간다', poor.spent === 0, String(poor.spent));

  const back = walk(JOBS, TERRAINS, [to('q3', 'meeting')], D.budget);
  check('되돌아온 의뢰는 끝난 것이 아니다', back.undone.includes('q3'));
  check('되돌아와도 발품은 줄었다', back.spent === WALL_LEGWORK, String(back.spent));

  check('없는 의뢰는 무시한다', walk(JOBS, TERRAINS, [to('없음', 'chat')], 9).steps.length === 0);
  check('빈 계획도 돈다', walk(JOBS, TERRAINS, [], 9).spent === 0);
  check('빈 계획이면 전부 미처리다', walk(JOBS, TERRAINS, [], 9).undone.length === JOBS.length);
}

// ---------------------------------------------------------------- 판정
console.log('\n== 하루 판정 ==');

// 제일 좋은 길. 요구가 없는 q3 를 애그리게이터로 넘겨야 마지막 의뢰까지 발품이 닿는다.
const BEST = [
  to('q1', 'search'), to('q2', 'meeting'), to('q3', 'hub'),
  to('q4', 'code'), to('q5', 'chat'), to('q6', 'search')
];

{
  const r = run(BEST);
  check('제대로 읽으면 통과', r.grade === 'pass', `${r.grade} ${r.score}`);
  check('사고 없음', r.faults.length === 0, names(r).join(', '));
  check('요구를 다 채운 길을 잘한 점으로', gains(r).includes('요구를 다 채운 길'));
  check('가벼운 일을 가볍게 넘긴 것도 잘한 점으로', gains(r).includes('가벼운 일은 가볍게'));
  check('마지막 줄에 끝낸 의뢰와 발품이 있다', /끝낸 의뢰 6건/.test(text(r)), text(r));

  const spent = walk(JOBS, TERRAINS, BEST, D.budget);
  check('제일 좋은 길이 오늘치 발품 안에 들어온다', spent.left >= 0, String(spent.left));
  check('여유가 지나치게 크지도 않다', spent.left <= 2, `남은 발품 ${spent.left}`);
}

// ---- 오답 경로 ① 벽이 없는 길로만 간다 ("그냥 다 되는 거 아니야?") ----
{
  const allHub = JOBS.map(j => to(j.id, 'hub'));
  const r = run(allHub);
  check('전부 애그리게이터로 가면 되돌아오는 일이 없다', !names(r).includes('되돌아온 의뢰'));
  check('전부 애그리게이터로 가면 손도 못 댄 의뢰도 없다', !names(r).includes('손도 못 댄 의뢰'));
  check('그런데 통과선 아래로 떨어진다', r.grade !== 'pass', `${r.grade} ${r.score}`);
  check('남는 게 없다를 짚는다', names(r).includes('남는 게 없다'), names(r).join(', '));
  check('넘길 수 없다를 짚는다', names(r).includes('넘길 수 없다'));
  check('얕게 끝났다를 짚는다', names(r).includes('얕게 끝났다'));

  const w = walk(JOBS, TERRAINS, allHub, D.budget);
  check('발품은 제일 적게 든다', w.spent < walk(JOBS, TERRAINS, BEST, D.budget).spent,
    `${w.spent} vs ${walk(JOBS, TERRAINS, BEST, D.budget).spent}`);
  check('그래도 점수는 제일 좋은 길보다 낮다', r.score < run(BEST).score,
    `${r.score} vs ${run(BEST).score}`);
}

// ---- 오답 경로 ② 전부 챗봇 — 벽 둘에 부딪히고 남는 것이 없다 ----
{
  const allChat = JOBS.map(j => to(j.id, 'chat'));
  const r = run(allChat);
  check('전부 챗봇으로 가면 반려', r.grade === 'fail', `${r.grade} ${r.score}`);
  check('되돌아온 의뢰를 짚는다', names(r).includes('되돌아온 의뢰'), names(r).join(', '));
  check('되돌아온 것이 둘이다', names(r).filter(n => n === '되돌아온 의뢰').length === 2);
  check('손도 못 댄 의뢰를 짚는다', names(r).includes('손도 못 댄 의뢰'));
  check('먼 길로 돌아간 것을 짚는다', names(r).includes('먼 길로 돌아갔다'));
}

// ---- 오답 경로 ③ 무거운 길만 고른다 (감당 못 할 것을 골랐다) ----
{
  const heavy = [
    to('q1', 'search'), to('q2', 'meeting'), to('q3', 'visual'),
    to('q4', 'code'), to('q5', 'code'), to('q6', 'search')
  ];
  const w = walk(JOBS, TERRAINS, heavy, D.budget);
  const r = run(heavy);
  check('무거운 길만 고르면 발품이 먼저 떨어진다', w.undone.length > 0, w.undone.join(','));
  check('그래서 손도 못 댄 의뢰가 생긴다', names(r).includes('손도 못 댄 의뢰'), names(r).join(', '));
  check('되돌아온 것은 없다 — 길을 잘못 고른 게 아니다', !names(r).includes('되돌아온 의뢰'));
  check('그래도 통과는 아니다', r.grade !== 'pass', `${r.grade} ${r.score}`);
}

// ---- 오답 경로 ④ 앞에서 발품을 흘리면 마지막 의뢰에서 요구를 포기한다 ----
{
  const leak = [
    to('q1', 'search'), to('q2', 'meeting'), to('q3', 'visual'),
    to('q4', 'code'), to('q5', 'chat'), to('q6', 'hub')
  ];
  const w = walk(JOBS, TERRAINS, leak, D.budget);
  const r = run(leak);
  check('요구가 없는 일에 무거운 길을 쓰면 발품이 바닥난다', w.left === 0, String(w.left));
  check('마지막 의뢰는 싼 길밖에 못 고른다', w.undone.length === 0, w.undone.join(','));
  check('그 대가로 남는 게 없다', names(r).includes('남는 게 없다'), names(r).join(', '));
  check('제일 좋은 길보다는 낮다', r.score < run(BEST).score, `${r.score} vs ${run(BEST).score}`);
}

// ---- 오답 경로 ⑤ 아무것도 안 골랐다 ----
{
  const none = run([]);
  check('하나도 안 고르면 반려', none.grade === 'fail', `${none.grade} ${none.score}`);
  check('여섯 건 다 손도 못 댄 것으로 센다',
    names(none).filter(n => n === '손도 못 댄 의뢰').length === JOBS.length);
  check('빈 setup 으로도 판정이 돈다', typeof g17.simulate({}, D).score === 'number');
}

// ---------------------------------------------------------------- 점수 곡선
console.log('\n== 점수 곡선 — 제일 좋은 길이 정말 제일 높은가 ==');
{
  // 의뢰마다 갈래 하나씩, 가능한 조합을 전부 돌린다 (6^6).
  // "정답을 하나 정해 두고 그것만 확인"하는 검사는 곡선을 증명하지 못한다.
  const ids = TERRAINS.map(t => t.id);
  let top = -1, topCount = 0, topPlan = null;
  const scores = [];

  const walkAll = (i, plan) => {
    if (i === JOBS.length) {
      const s = g17.simulate({ picks: plan }, D).score;
      scores.push(s);
      if (s > top) { top = s; topCount = 1; topPlan = plan.slice(); }
      else if (s === top) topCount++;
      return;
    }
    for (const t of ids) walkAll(i + 1, plan.concat([to(JOBS[i].id, t)]));
  };
  walkAll(0, []);

  check('돌려 본 조합이 6의 6제곱이다', scores.length === Math.pow(ids.length, JOBS.length),
    String(scores.length));
  check('제일 높은 점수가 제일 좋은 길이다',
    JSON.stringify(topPlan) === JSON.stringify(BEST),
    topPlan ? topPlan.map(p => p.terrainId).join(' ') : '없음');
  check('그 길이 유일하다', topCount === 1, `${topCount}가지가 최고점`);
  check('최고점이 만점이다', top === 100, String(top));

  // 통과선 아래로 떨어지는 길이 충분히 많아야 "고민할 것"이 있는 판이다
  const passes = scores.filter(s => s >= 80).length;
  check('통과하는 조합이 전체의 일부뿐이다', passes / scores.length < 0.05,
    `${passes} / ${scores.length}`);
  check('전부 애그리게이터로 간 조합은 통과선 아래다',
    run(JOBS.map(j => to(j.id, 'hub'))).score < 80,
    String(run(JOBS.map(j => to(j.id, 'hub'))).score));

  // 곡선을 눈으로도 남긴다 — 숫자가 화면에 안 보이면 아무도 확인하지 않는다
  const SHOW = [
    ['제일 좋은 길', BEST],
    ['전부 애그리게이터', JOBS.map(j => to(j.id, 'hub'))],
    ['전부 챗봇', JOBS.map(j => to(j.id, 'chat'))],
    ['무거운 길만', [to('q1', 'search'), to('q2', 'meeting'), to('q3', 'visual'),
                     to('q4', 'code'), to('q5', 'code'), to('q6', 'search')]],
    ['앞에서 발품을 흘림', [to('q1', 'search'), to('q2', 'meeting'), to('q3', 'visual'),
                            to('q4', 'code'), to('q5', 'chat'), to('q6', 'hub')]],
    ['아무것도 안 고름', []]
  ];
  console.log('   경로                 점수  등급     쓴 발품  손도 못 댐');
  for (const [nm, plan] of SHOW) {
    const r = run(plan);
    const w = walk(JOBS, TERRAINS, plan, D.budget);
    console.log(`   ${nm.padEnd(20)}${String(r.score).padStart(3)}  ${r.grade.padEnd(8)}` +
                `${String(w.spent).padStart(6)}${String(w.undone.length).padStart(10)}`);
  }
}

// ---------------------------------------------------------------- 데이터
console.log('\n== 17번 데이터 모양 ==');
{
  check('갈래가 여섯이다', TERRAINS.length === 6, String(TERRAINS.length));
  check('갈래마다 한 줄 설명이 있다', TERRAINS.every(t => (t.line || '').length >= 8));
  check('갈래 id 에 중복이 없다', new Set(TERRAINS.map(t => t.id)).size === TERRAINS.length);
  check('벽이 없는 갈래는 하나뿐이다', TERRAINS.filter(t => t.all).length === 1);
  check('제일 싼 갈래가 바로 그 갈래다',
    TERRAINS.slice().sort((a, b) => a.legwork - b.legwork)[0].all === true);
  check('남는 갈래와 안 남는 갈래가 둘 다 있다',
    TERRAINS.some(t => t.keeps) && TERRAINS.some(t => !t.keeps));
  check('넘기는 갈래와 못 넘기는 갈래가 둘 다 있다',
    TERRAINS.some(t => t.hands) && TERRAINS.some(t => !t.hands));

  check('의뢰가 여섯이다', JOBS.length === 6, String(JOBS.length));
  check('의뢰 id 에 중복이 없다', new Set(JOBS.map(j => j.id)).size === JOBS.length);
  check('의뢰마다 짧은 이름이 있다', JOBS.every(j => (j.short || '').length >= 2));
  check('요구가 세 종류 다 나온다',
    ['deep', 'keep', 'hand'].every(a => JOBS.some(j => (j.asks || []).includes(a))));
  check('요구가 없는 의뢰가 있다', JOBS.some(j => (j.asks || []).length === 0));
  check('벽 두 종류가 다 나온다',
    HARD.every(k => JOBS.some(j => j.kind === k)));
  check('요구 이름이 전부 화면 문구로 번역된다',
    JOBS.every(j => (j.asks || []).every(a => !!D.askLabels[a])));

  check('발품 예산이 정해져 있다', D.budget > 0, String(D.budget));
  const need = walk(JOBS, TERRAINS, BEST, D.budget).spent;
  check('다 해 볼 수는 없다 — 제일 좋은 길조차 예산을 거의 다 쓴다',
    need >= D.budget - 2, `${need} / ${D.budget}`);
  const allBest = JOBS.reduce((n, j) => {
    const own = TERRAINS.map(t => route(j, t)).filter(r => r.ok && r.missed.length === 0);
    return n + Math.max(...own.map(r => r.legwork));
  }, 0);
  check('무거운 길만 고르면 예산을 넘는다', allBest > D.budget, `${allBest} / ${D.budget}`);

  check('엔진 글자가 N 이다', g17.engine === 'N', g17.engine);
  check('통에 넣는 데이터가 남아 있지 않다', !D.bins && !D.cards);
  check('되돌아옴 문구가 있다', !!D.notes.wall && !!D.look.anyway);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
