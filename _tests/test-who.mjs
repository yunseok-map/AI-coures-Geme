// 학습자 칸 검증 — 공용 PC 에서 진도가 섞이지 않는지.
//
// 여기서 잡으려는 사고가 셋이다.
//   1) **이미 진행한 사람의 기록이 날아가는 것.** 1번 사람은 예전 키를 그대로
//      써야 한다. 접미사를 붙이는 순간 전원이 빈 화면에서 다시 시작한다.
//   2) 사람을 나눴는데 진도가 섞이는 것. 화면에서는 잘 안 보인다 —
//      내 브라우저에는 어차피 내 기록만 있으니까.
//   3) 사람을 지웠는데 진행도 키가 남아, 다음에 같은 번호를 받은 사람이
//      남의 기록을 물려받는 것.
//
// localStorage 를 쓰므로 Node 에서 최소한의 가짜 저장소를 깔아 준다.

const BASE = 'ai-course-v1';
const REG = 'ai-course-who';
let store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};

// 시작 화면(`shell/enter.js`)이 "이 탭에서 이미 들어왔나"를 여기에 적는다.
// **탭 하나짜리 저장소**인 것이 설계다 — 창을 닫으면 지워져서 다음 사람에게
// 이름부터 다시 묻는다. 그래서 localStorage 와 따로 흉내 낸다.
let ses = {};
globalThis.sessionStorage = {
  getItem: (k) => (k in ses ? ses[k] : null),
  setItem: (k, v) => { ses[k] = String(v); },
  removeItem: (k) => { delete ses[k]; }
};
/** 탭을 닫았다 다시 연다 — localStorage 는 남고 sessionStorage 만 사라진다 */
const newTab = () => { ses = {}; };

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('  OK   ' + n); }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };

let gen = 0;

/**
 * 등록부 읽기 검사용 — 주소에 꼬리를 붙여 who.js 를 새로 불러온다.
 * state.js 와는 짝이 되지 않는다: state.js 는 './who.js' 를 꼬리 없이
 * import 하므로 언제나 **꼬리 없는 인스턴스** 하나만 본다.
 */
async function freshWho(saved) {
  store = {};
  if (saved !== undefined) store[REG] = JSON.stringify(saved);
  const m = await import(`../src/core/who.js?v=${++gen}`);
  return m.who;
}

/**
 * state.js 와 함께 쓸 때는 **꼬리 없는** who 를 써야 같은 등록부를 본다.
 * wipe() 로 메모리에 남은 사람 목록까지 초기화한다 — 저장소만 비우면
 * 모듈이 들고 있는 목록이 그대로 남아 앞 검사가 다음 검사에 새어 든다.
 */
async function resetShared() {
  store = {};
  const w = (await import('../src/core/who.js')).who;
  w.wipe();
  return w;
}

/** 새로고침을 흉내 낸다 — 그 시점의 등록부로 state 를 다시 읽는다 */
async function reload() {
  return (await import(`../src/core/state.js?v=${++gen}`)).state;
}

console.log('\n== 처음 열었을 때 ==');
{
  const w = await freshWho();
  check('사람이 한 명', w.list.length === 1, String(w.list.length));
  check('나눠 쓰는 상태가 아니다', w.many === false);
  check('1번 사람 키는 옛 키 그대로', w.key() === BASE, w.key());
  // 등록부를 만들지 않는 것이 중요하다. 혼자 쓰는 사람의 localStorage 는
  // 예전과 똑같이 키 하나여야 한다 — 그래야 '처음부터'가 전부 지운다.
  check('등록부를 쓰지 않는다', store[REG] === undefined, JSON.stringify(store));
}

console.log('\n== 이미 진행한 사람의 기록이 그대로 열린다 (제일 중요) ==');
{
  await resetShared();
  store[BASE] = JSON.stringify({
    version: 1,
    cleared: { 'context-bag': { grade: 'pass', score: 92, at: '2026-08-01' } },
    unlockedTerms: ['토큰', '훅'],
    earnedTerms: ['토큰'],
    lastNode: 'context-bag'
  });
  const s = await reload();
  check('깬 기록이 살아 있다', s.isCleared('context-bag') === true);
  check('획득 1 이 살아 있다', s.earnedCount === 1, String(s.earnedCount));
  check('읽음 2 가 살아 있다', s.unlockedCount === 2, String(s.unlockedCount));
}

console.log('\n== 사람을 추가하면 저장 칸이 갈라진다 ==');
{
  const w = await freshWho();
  const n = w.add('둘째');
  check('2번이 만들어진다', n === 2, String(n));
  check('추가한 사람으로 넘어간다', w.active.n === 2 && w.active.name === '둘째',
    JSON.stringify(w.active));
  check('나눠 쓰는 상태가 된다', w.many === true);
  check('2번 키에 접미사가 붙는다', w.key() === `${BASE}:2`, w.key());
  check('1번 키는 그대로', w.key(1) === BASE, w.key(1));
  check('등록부가 생긴다', typeof store[REG] === 'string');
}

console.log('\n== 두 사람의 진도가 섞이지 않는다 (이 기능의 존재 이유) ==');
{
  const w = await resetShared();
  store[BASE] = JSON.stringify({
    version: 1, cleared: { 'context-bag': { grade: 'pass', score: 90, at: '2026-08-01' } },
    unlockedTerms: ['토큰'], earnedTerms: ['토큰'], lastNode: 'context-bag'
  });
  w.add('둘째');            // 등록부에 2번을 넣고 지금 사람을 2번으로 바꾼다

  const s2 = await reload();  // 새로고침 — 이제 2번 칸을 읽는다
  check('새로 뜬 화면이 2번을 가리킨다', w.active.n === 2, String(w.active.n));
  check('2번은 빈 화면에서 시작한다',
    s2.earnedCount === 0 && s2.isCleared('context-bag') === false,
    `${s2.earnedCount}/${s2.isCleared('context-bag')}`);

  s2.record('hallucination', { grade: 'pass', score: 80, unlocked: ['환각'] });
  check('2번 기록은 2번 키에 들어간다', typeof store[`${BASE}:2`] === 'string');

  const one = JSON.parse(store[BASE]);
  check('1번 기록이 안 바뀐다',
    one.earnedTerms.length === 1 && one.cleared['context-bag'].score === 90,
    JSON.stringify(one.earnedTerms));
  check('1번에 2번 기록이 안 섞인다', one.cleared.hallucination === undefined);

  // 다시 1번으로 넘어가면 1번 기록이 그대로 보여야 한다
  w.switchTo(1);
  const s1 = await reload();
  check('1번으로 돌아오면 1번 기록이 보인다',
    s1.isCleared('context-bag') === true && s1.earnedCount === 1,
    `${s1.isCleared('context-bag')}/${s1.earnedCount}`);
  check('1번 화면에 2번이 깬 판이 안 보인다', s1.isCleared('hallucination') === false);
}

console.log('\n== 사람 바꾸기 ==');
{
  const w = await freshWho();
  w.add('둘째');
  check('1번으로 되돌아간다', w.switchTo(1) === true && w.active.n === 1);
  check('없는 사람으로는 못 바꾼다', w.switchTo(99) === false && w.active.n === 1);
  const on = w.list.filter(s => s.active);
  check('지금 사람은 언제나 한 명', on.length === 1, String(on.length));
}

console.log('\n== 이름 ==');
{
  const w = await freshWho();
  w.add('둘째');
  w.rename(2, '  김  가  나  ');
  check('앞뒤 공백과 겹친 공백을 정리한다', w.active.name === '김 가 나', `"${w.active.name}"`);
  w.rename(2, '');
  check('비우면 번호가 이름이 된다', w.active.name === '2번', w.active.name);
  w.rename(2, '가'.repeat(40));
  check(`${w.nameMax}자로 자른다`, w.active.name.length === w.nameMax,
    String(w.active.name.length));
  check('없는 사람 이름은 못 고친다', w.rename(99, 'x') === false);
  const blankName = w.add('   ');
  check('빈 이름으로 추가해도 번호가 붙는다',
    w.list.find(s => s.n === blankName).name === '3번',
    JSON.stringify(w.list));
}

console.log('\n== 사람 지우기 — 진행도 키까지 지워야 한다 ==');
{
  const w = await freshWho();
  w.add('둘째');
  store[`${BASE}:2`] = JSON.stringify({ version: 1, earnedTerms: ['환각'] });

  check('지워진다', w.remove(2) === true);
  // 이름만 지우고 진행도를 남기면, 다음에 2번을 받은 사람이 남의 기록을 물려받는다
  check('진행도 키도 같이 지워진다', store[`${BASE}:2`] === undefined,
    JSON.stringify(Object.keys(store)));
  check('남은 사람으로 넘어간다', w.active.n === 1, String(w.active.n));
  check('혼자 상태로 돌아간다', w.many === false);
  check('마지막 한 명은 못 지운다', w.remove(1) === false);
  check('없는 사람은 못 지운다', w.remove(99) === false);
}

console.log('\n== 지운 번호를 다시 쓰지 않는다 ==');
{
  // 번호를 재사용하면 지워진 사람의 키를 새 사람이 물려받을 수 있다.
  // remove 가 키를 지우니 지금도 안전하지만, 번호까지 안 겹치는 쪽이 더 안전하다.
  const w = await freshWho();
  w.add('둘째');   // 2
  w.add('셋째');   // 3
  w.remove(2);
  const n = w.add('넷째');
  check('가장 큰 번호 다음을 쓴다', n === 4, String(n));
}

console.log('\n== 사람 수 상한 ==');
{
  const w = await freshWho();
  for (let i = 2; i <= w.max; i++) w.add(`${i}번째`);
  check(`${w.max}명이면 꽉 찬다`, w.full === true && w.list.length === w.max,
    String(w.list.length));
  check('넘겨서 추가하면 null', w.add('넘침') === null);
  check('넘쳐도 목록이 안 늘어난다', w.list.length === w.max, String(w.list.length));
}

console.log('\n== 등록부가 망가진 경우에도 돌아간다 ==');
{
  store = {}; store[REG] = '{ 이건 JSON 이 아니다';
  const w = (await import(`../src/core/who.js?v=${++gen}`)).who;
  check('한 명으로 시작한다', w.list.length === 1 && w.active.n === 1);
  check('1번 키는 옛 키 그대로', w.key() === BASE, w.key());
}
{
  // 쓰레기가 섞인 목록 — 쓸 수 있는 칸만 남아야 한다
  const w = await freshWho({ version: 1, active: 7,
    list: [{ n: 1, name: '가' }, null, { n: 0 }, { n: 2.5 }, { n: 3, name: '나' }, { n: 3, name: '중복' }] });
  check('쓸 수 있는 칸만 남는다', w.list.length === 2,
    JSON.stringify(w.list.map(s => s.n)));
  check('중복 번호를 걸러낸다', w.list.filter(s => s.n === 3).length === 1);
  // active 가 없는 사람을 가리키면 아무 화면도 안 뜨거나 남의 칸을 열 수 있다
  check('없는 사람을 가리키던 active 를 되돌린다', w.active.n === 1, String(w.active.n));
}
{
  const w = await freshWho({ version: 9, list: [{ n: 5, name: '미래' }] });
  check('버전이 다르면 초기화한다', w.list.length === 1 && w.active.n === 1);
}
{
  const w = await freshWho({ version: 1, list: 'X' });
  check('목록이 배열이 아니면 초기화한다', w.list.length === 1 && w.active.n === 1);
}

console.log('\n== 이 브라우저 전체 지우기 ==');
{
  const w = await freshWho();
  w.add('둘째');
  store[BASE] = 'x'; store[`${BASE}:2`] = 'y';
  w.wipe();
  check('모든 사람의 진행도가 지워진다',
    store[BASE] === undefined && store[`${BASE}:2`] === undefined,
    JSON.stringify(Object.keys(store)));
  check('등록부도 지워진다', store[REG] === undefined);
  check('한 명 상태로 돌아간다', w.list.length === 1 && w.active.n === 1);
}

console.log('\n== 지금 사람만 처음부터 ==');
{
  const w = await resetShared();
  store[BASE] = JSON.stringify({ version: 1, cleared: {}, unlockedTerms: [], earnedTerms: ['토큰'] });
  w.add('둘째');
  store[`${BASE}:2`] = JSON.stringify({ version: 1, cleared: {}, unlockedTerms: [], earnedTerms: ['환각'] });

  const s = await reload();   // 2번이 지금 사람인 상태로 열린다
  check('2번 기록을 읽고 있다', s.earnedCount === 1 && s.hasEarned('환각') === true,
    String(s.earnedCount));
  s.reset();
  check('지금 사람 키만 지워진다', store[`${BASE}:2`] === undefined);
  check('다른 사람 기록은 남는다', typeof store[BASE] === 'string',
    JSON.stringify(Object.keys(store)));
}

// ---------------------------------------------------------------- 시작 화면
//
// 이름을 먼저 묻게 만든 장치(`shell/enter.js`)가 기대는 것들을 여기서 못 박는다.
// 이 판정이 틀리면 공용 PC 에서 **다음 사람이 앞사람 진도를 그대로 물려받는다** —
// 화면에는 아무 이상이 없어 보이고, 그 사람만 아무것도 못 배운 채 끝난다.
console.log('\n== 시작 화면 (이름부터 묻기) ==');
{
  const w = await resetShared();
  newTab();

  check('처음 열면 이름을 묻는다', w.entered === false);
  check('아무도 안 깬 브라우저는 빈 브라우저다', w.fresh === true);

  // ① 첫 사람은 **1번 칸의 이름만 바꾼다.** 새 칸을 만들면 접미사 없는 옛 키를
  //    쥔 진도 0 짜리 '1번' 이 유령으로 남아 목록에 끼어든다.
  w.rename(1, '민수');
  w.enter();
  check('첫 사람이 1번 칸을 쓴다', w.list.length === 1 && w.active.name === '민수',
    JSON.stringify(w.list));
  check('1번은 접미사 없는 옛 키 그대로다', w.key(1) === BASE, w.key(1));
  check('한 번 들어오면 다시 묻지 않는다', w.entered === true);

  // ② 민수가 두 판 깼다. 그 상태에서 다음 사람이 같은 컴퓨터에 앉는다.
  store[BASE] = JSON.stringify({ version: 1, cleared: { a: {}, b: {} },
    unlockedTerms: [], earnedTerms: [] });
  check('깬 판 수를 이름 옆에 붙일 수 있다', w.done(1) === 2, String(w.done(1)));
  check('이제 빈 브라우저가 아니다', w.fresh === false);

  newTab();   // 앞사람이 창을 닫고 다음 사람이 새로 연다
  check('다음 사람에게는 다시 묻는다', w.entered === false);

  // ③ 같은 이름은 막는다 — 목록에서 자기 칸을 구별할 수 없게 된다
  check('이미 있는 이름을 알아본다', w.taken('민수') === true);
  check('앞뒤 공백이 달라도 같은 이름이다', w.taken('  민수 ') === true);
  check('다른 이름은 통과한다', w.taken('영희') === false);

  // ④ 새 사람은 다음 칸을 받고, 진도는 0 에서 시작한다
  const before = w.active.n;
  const n = w.add('영희');
  // **add() 는 만들면서 곧바로 그 사람으로 넘어간다.** 시작 화면이 "새로고침이
  // 필요한가"를 add() **뒤에** 판단하면 언제나 "같다"가 나와서 새로고침을 건너뛰고,
  // 새로 들어온 사람 화면에 앞사람 진도가 그대로 뜬다. 실제로 그렇게 났던 사고다.
  check('새 사람을 만들면 그 사람으로 넘어가 있다', w.active.n === n && before !== n,
    `${before} → ${w.active.n}`);
  w.enter();
  check('새 사람은 2번 칸을 받는다', n === 2 && w.key(2) === `${BASE}:2`, w.key(2));
  check('새 사람 진도는 0 이다', w.done(2) === 0, String(w.done(2)));
  check('앞사람 진도는 그대로다', w.done(1) === 2, String(w.done(1)));

  const s = await reload();
  check('영희 화면에는 앞사람 기록이 없다',
    s.isCleared('a') === false && s.isCleared('b') === false,
    `a=${s.isCleared('a')} b=${s.isCleared('b')}`);
}

console.log('\n== 처음부터 지우면 이름부터 다시 묻는다 ==');
{
  // '처음부터'로 브라우저를 통째로 비우고도 계속 안 물으면, 지운 사람이
  // 앞사람 이름표를 그대로 달고 새로 시작하게 된다.
  const w = await resetShared();
  w.enter();
  check('들어온 표시가 있다', w.entered === true);
  w.wipe();
  check('전부 지우면 표시도 지워진다', w.entered === false);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
