// 엔진 R(실시간 관제) 검사 — 시간 계산과 5번 판의 판정.
//
// 이 판은 화면에서 한 번에 한 경로밖에 못 밟는다. 그런데 배워야 할 것이
// "같은 일도 창구마다 시간이 다르다"라서 **경로를 나란히 놓고 비교해야** 증명된다.
// 여기서 그 비교를 한다 — 특히 "세 번째부터 프로젝트가 이긴다"를 숫자로.

const ROOT = '../src';
const g5 = (await import(`${ROOT}/games/05-where-to-work.js`)).default;
const { cost, can, commit, newState, replay, WALL } =
  await import(`${ROOT}/core/dispatch.js`);

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };

const D = g5.data;
const ITEMS = D.items;
const item = id => ITEMS.find(i => i.id === id);
const names = r => r.faults.map(f => f.name);
const gains = r => r.gains.map(f => f.name);
const text = r => r.steps.map(s => s.text).join(' | ');
const run = (plan, lost = 0) => g5.simulate({ plan, lost, done: ITEMS.length - lost }, D);
const to = (itemId, surfaceId) => ({ itemId, surfaceId });

// ---------------------------------------------------------------- 벽
console.log('\n== 진짜 벽은 둘뿐이다 ==');
{
  check('파일 일감은 CLI 에이전트에서만 된다', can('cli', 'file') && !can('chat', 'file'));
  check('통째로 맡기는 일은 Cowork 에서만 된다', can('cowork', 'multi') && !can('project', 'multi'));
  check('나머지 일감은 어느 창구에서도 된다',
    ['chat', 'project', 'artifact', 'cli', 'cowork'].every(s =>
      can(s, 'quick') && can(s, 'context') && can(s, 'artifact')));
  check('벽이 딱 두 종류다', Object.keys(WALL).length === 2, Object.keys(WALL).join(','));

  const bounce = cost(item('j4'), 'chat', newState());
  check('벽에 부딪히면 되돌아온다', bounce.ok === false);
  check('되돌아와도 시간은 먹는다', bounce.sec > 0, String(bounce.sec));
}

// ---------------------------------------------------------------- 비용
console.log('\n== 같은 일도 창구마다 시간이 다르다 ==');
{
  const s = newState();
  const j2 = item('j2');   // 배경 자료가 있는 일

  check('채팅은 배경을 매번 다시 설명한다', cost(j2, 'chat', s).why === 'explain');
  check('배경이 없는 일은 채팅이 제일 싸다',
    cost(item('j1'), 'chat', s).sec === item('j1').sec);
  check('프로젝트는 처음 한 번이 비싸다', cost(j2, 'project', s).why === 'setup');
  check('처음 한 번은 채팅보다 비싸다',
    cost(j2, 'project', s).sec > cost(j2, 'chat', s).sec);

  const s2 = newState();
  commit(j2, 'project', s2);
  check('올려 둔 뒤에는 공짜다', cost(item('j6'), 'project', s2).why === 'ready');
  check('두 번째부터는 채팅보다 싸다',
    cost(item('j6'), 'project', s2).sec < cost(item('j6'), 'chat', s2).sec);

  // 이 판의 수치가 성립하는지 — 같은 배경 일감 셋을 두 경로로 나란히 돌린다
  const bgJobs = ITEMS.filter(i => i.bg === '규정집');
  check('같은 배경 일감이 셋 이상이다', bgJobs.length >= 3, String(bgJobs.length));

  const total = (surfaceId) => {
    const st = newState();
    let sum = 0;
    for (const j of bgJobs) { sum += cost(j, surfaceId, st).sec; commit(j, surfaceId, st); }
    return sum;
  };
  const byChat = total('chat'), byProject = total('project');
  check('세 번이면 프로젝트가 이긴다', byProject < byChat, `프로젝트 ${byProject}초 vs 채팅 ${byChat}초`);

  // 한 건뿐이면 반대다 — "무조건 프로젝트"가 정답이 아니어야 한다
  const one = newState();
  check('한 건뿐이면 채팅이 이긴다',
    cost(bgJobs[0], 'chat', one).sec < cost(bgJobs[0], 'project', one).sec);
}

console.log('\n== 결과물과 파일 ==');
{
  const s = newState();
  const j3 = item('j3');
  check('아티팩트에 처음 만들 때는 그대로다', cost(j3, 'artifact', s).sec === j3.sec);
  commit(j3, 'artifact', s);
  check('같은 결과물을 이어 고치면 빨라진다', cost(item('j8'), 'artifact', s).why === 'again');
  check('결과물이 아닌 일을 아티팩트에서 하면 겉돈다',
    cost(item('j1'), 'artifact', newState()).why === 'offtrack');
  check('파일 일감은 CLI 에서 그대로다',
    cost(item('j4'), 'cli', newState()).sec === item('j4').sec);
  check('파일이 아닌 일을 CLI 로 보내면 먼 길이다',
    cost(item('j1'), 'cli', newState()).why === 'heavy');
  check('Cowork 는 통째로 맡기는 대신 두 배 걸린다',
    cost(item('j5'), 'cowork', newState()).sec === item('j5').sec * 2);
  check('짧은 일을 Cowork 에 맡기면 그냥 기다리는 것이다',
    cost(item('j1'), 'cowork', newState()).why === 'oversize');
}

// ---------------------------------------------------------------- 재생
console.log('\n== 보낸 순서가 결과를 바꾼다 ==');
{
  const early = replay(ITEMS, [to('j2', 'project'), to('j6', 'project'), to('j9', 'project')]);
  const late = replay(ITEMS, [to('j2', 'chat'), to('j6', 'chat'), to('j9', 'project')]);
  check('한 번 올려 두면 나머지가 싸다', early.spent < late.spent,
    `${early.spent}초 vs ${late.spent}초`);
  check('재생이 보낸 건수를 다 센다', early.runs.length === 3);
  check('없는 일감은 무시한다', replay(ITEMS, [to('없음', 'chat')]).runs.length === 0);
  check('빈 계획도 돈다', replay(ITEMS, []).spent === 0);
}

// ---------------------------------------------------------------- 판정
console.log('\n== 하루 판정 ==');
const BEST = [
  to('j1', 'chat'), to('j2', 'project'), to('j3', 'artifact'), to('j4', 'cli'),
  to('j5', 'cowork'), to('j6', 'project'), to('j7', 'chat'), to('j8', 'artifact'),
  to('j9', 'project')
];
{
  const r = run(BEST);
  check('제대로 보내면 통과', r.grade === 'pass', `${r.grade} ${r.score}`);
  check('사고 없음', r.faults.length === 0, names(r).join(', '));
  check('올려 두고 다시 쓴 것을 잘한 점으로', gains(r).includes('올려 두고 다시 쓴 자료'));
  check('이어 고친 결과물을 잘한 점으로', gains(r).includes('이어 고친 결과물'));
  check('통째로 맡긴 것을 잘한 점으로', gains(r).includes('통째로 맡긴 일'));
  check('파일을 제자리로 보낸 것을 잘한 점으로', gains(r).includes('파일은 파일 다루는 곳으로'));
  check('마지막 줄에 처리 건수와 시간이 있다', /9건 처리/.test(text(r)), text(r));

  // 전부 채팅 — 벽 둘에 부딪히고 배경을 세 번 다시 설명한다
  const allChat = ITEMS.map(i => to(i.id, 'chat'));
  const c = run(allChat, 2);
  check('전부 채팅으로 보내면 반려', c.grade === 'fail', `${c.grade} ${c.score}`);
  check('되돌아온 일감을 짚는다', names(c).includes('되돌아온 일감'), names(c).join(', '));
  check('되돌아온 것이 둘이다', names(c).filter(n => n === '되돌아온 일감').length === 2);
  check('매번 다시 설명을 짚는다', names(c).includes('매번 다시 설명'));
  check('밀려난 일감을 짚는다', names(c).includes('놓친 일감'));
  // 되돌아온 이유는 결과 화면의 사유 줄에 있다 (steps 가 아니라 faults 쪽)
  const whys = c.faults.map(f => f.why).join(' | ');
  check('벽에 부딪힌 이유를 창구 이름으로 말한다',
    /CLI 에이전트가 아니면/.test(whys) && /Cowork 가 아니면/.test(whys), whys);

  // 배경 일감만 채팅으로 — 되기는 되지만 시간을 흘린다
  const lazy = BEST.map(x => (item(x.itemId).bg === '규정집' ? to(x.itemId, 'chat') : x));
  const l = run(lazy);
  check('배경을 매번 설명해도 되돌아오진 않는다', !names(l).includes('되돌아온 일감'));
  check('그래도 감점은 있다', l.score < 100, String(l.score));
  check('세 번 설명하면 통과가 아니다', l.grade !== 'pass', `${l.grade} ${l.score}`);

  // 아무것도 못 보낸 하루
  const none = run([], ITEMS.length);
  check('하나도 못 보내면 반려', none.grade === 'fail', `${none.grade} ${none.score}`);
  check('빈 setup 으로도 판정이 돈다', typeof g5.simulate({}, D).score === 'number');
}

// ---------------------------------------------------------------- 데이터
console.log('\n== 5번 데이터 모양 ==');
{
  check('창구가 다섯이다', D.surfaces.length === 5, String(D.surfaces.length));
  check('창구마다 설명이 있다', D.surfaces.every(s => (s.about || '').length >= 20));
  check('일감이 여덟 이상이다', ITEMS.length >= 8, String(ITEMS.length));
  check('일감 id 에 중복이 없다', new Set(ITEMS.map(i => i.id)).size === ITEMS.length);
  check('일감이 시간 순으로 들어온다', ITEMS.every((x, i) => i === 0 || ITEMS[i - 1].at <= x.at));
  check('마지막 일감이 하루 안에 들어온다',
    ITEMS[ITEMS.length - 1].at < D.day, `${ITEMS[ITEMS.length - 1].at} / ${D.day}`);
  check('벽 두 종류가 다 나온다',
    ITEMS.some(i => i.needs === 'file') && ITEMS.some(i => i.needs === 'multi'));
  check('대기줄이 좁다', D.queueCap <= 3, String(D.queueCap));

  // 제대로 보내면 하루 안에 끝나는가 — 창구별로 나눠 도는 것을 흉내 낸다
  const st = newState();
  const busy = {};
  let last = 0;
  for (const step of BEST) {
    const it = item(step.itemId);
    const c = cost(it, step.surfaceId, st);
    commit(it, step.surfaceId, st);
    const start = Math.max(it.at, busy[step.surfaceId] || 0);
    busy[step.surfaceId] = start + c.sec;
    last = Math.max(last, busy[step.surfaceId]);
  }
  check('제대로 보내면 하루 안에 끝난다', last <= D.day, `${last}초 / ${D.day}초`);
  check('여유가 지나치게 크지도 않다', last > D.day * 0.5, `${last}초 / ${D.day}초`);

  // 전부 한 창구로 몰면 줄이 서서 하루를 넘긴다
  const st2 = newState();
  let one = 0;
  for (const it of ITEMS) {
    const c = cost(it, 'chat', st2);
    commit(it, 'chat', st2);
    one = Math.max(it.at, one) + c.sec;
  }
  check('한 창구에 몰면 하루를 넘기거나 아슬아슬하다', one >= D.day * 0.85, `${one}초 / ${D.day}초`);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
