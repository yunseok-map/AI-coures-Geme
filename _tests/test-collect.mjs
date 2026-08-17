// 용어 수집 검증 — 획득/읽음 분리, 옛 저장 호환, 챕터 집계.
//
// 여기서 잡으려는 사고가 둘이다.
//   1) 저장 구조를 건드려서 **이미 진행한 사람의 기록이 날아가는 것.**
//      화면에서는 절대 안 보인다 — 내 브라우저에는 새 구조가 이미 들어 있으니까.
//   2) 세 화면(상단바·코스맵·결과 카드)이 각자 세서 숫자가 어긋나는 것.
//
// state.js 는 localStorage 를 쓰므로 Node 에서 최소한의 가짜 저장소를 깔아 준다.

const KEY = 'ai-course-v1';
let store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('  OK   ' + n); }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };

// 저장소를 갈아 끼운 뒤 state 를 새로 읽어야 그 저장을 반영한다.
// import 는 캐시되므로 주소에 꼬리를 붙여 다시 불러온다.
let gen = 0;
async function freshState(saved) {
  store = {};
  if (saved !== undefined) store[KEY] = JSON.stringify(saved);
  const m = await import(`../src/core/state.js?v=${++gen}`);
  return m.state;
}

console.log('\n== 빈 상태 ==');
{
  const s = await freshState();
  check('획득 0', s.earnedCount === 0, String(s.earnedCount));
  check('읽음 0', s.unlockedCount === 0, String(s.unlockedCount));
  check('hasEarned 는 false', s.hasEarned('훅') === false);
}

console.log('\n== 도감을 펼쳐 읽으면 읽음만 늘어난다 (이 판의 핵심) ==');
{
  const s = await freshState();
  s.unlockTerm('훅');
  s.unlockTerm('가드레일');
  check('읽음 2', s.unlockedCount === 2, String(s.unlockedCount));
  // 읽기가 곧 획득이면 68개를 탭질로 다 채울 수 있어서 모을 이유가 사라진다
  check('획득은 그대로 0', s.earnedCount === 0, String(s.earnedCount));
  check('hasTerm 은 true', s.hasTerm('훅') === true);
  check('hasEarned 는 false', s.hasEarned('훅') === false);
  check('같은 용어를 두 번 읽어도 안 늘어난다',
    s.unlockTerm('훅') === false && s.unlockedCount === 2, String(s.unlockedCount));
}

console.log('\n== 게임에서 따면 획득과 읽음이 같이 늘어난다 ==');
{
  const s = await freshState();
  const fresh = s.record('prevent-accident',
    { grade: 'pass', score: 100, unlocked: ['훅', '가드레일'] });
  check('획득 2', s.earnedCount === 2, String(s.earnedCount));
  check('읽음도 2 — 딴 것은 읽은 것이다', s.unlockedCount === 2, String(s.unlockedCount));
  check('hasEarned 가 true', s.hasEarned('훅') === true);
  // 해설 패널이 "새로 모았다"를 구분하려면 이 반환값이 필요하다.
  // 패널은 record 다음에 그려지므로 그때 state 를 봐서는 알 수 없다.
  check('record 가 새로 딴 목록을 돌려준다',
    Array.isArray(fresh) && fresh.length === 2, JSON.stringify(fresh));
}

console.log('\n== 다시 해도 "새로 딴 것"은 비어야 한다 ==');
{
  const s = await freshState();
  s.record('prevent-accident', { grade: 'pass', score: 100, unlocked: ['훅'] });
  const again = s.record('prevent-accident', { grade: 'pass', score: 100, unlocked: ['훅'] });
  check('두 번째는 새로 딴 것이 없다', again.length === 0, JSON.stringify(again));
  check('획득 수가 늘지 않는다', s.earnedCount === 1, String(s.earnedCount));
}

console.log('\n== 읽은 뒤에 게임으로 따면 획득으로 올라간다 ==');
{
  const s = await freshState();
  s.unlockTerm('훅');
  const fresh = s.record('prevent-accident', { grade: 'pass', score: 100, unlocked: ['훅'] });
  check('획득 1', s.earnedCount === 1, String(s.earnedCount));
  check('읽음은 1 그대로 (중복 안 됨)', s.unlockedCount === 1, String(s.unlockedCount));
  check('처음 딴 것으로 잡힌다', fresh.length === 1 && fresh[0] === '훅', JSON.stringify(fresh));
}

console.log('\n== 옛 저장이 안 깨진다 (earnedTerms 가 없던 시절) ==');
{
  // earnedTerms 필드가 아예 없는 저장. VERSION 은 그대로 1 이어야 한다 —
  // 올렸으면 load() 가 조용히 초기화해서 기록이 전부 날아갔다.
  const old = {
    version: 1,
    cleared: { 'prevent-accident': { grade: 'pass', score: 100, at: '2026-08-01' } },
    unlockedTerms: ['훅', '가드레일', '샌드박스'],
    lastNode: 'prevent-accident'
  };
  const s = await freshState(old);
  check('깬 기록이 살아 있다', s.isCleared('prevent-accident') === true);
  check('읽음 3 이 살아 있다', s.unlockedCount === 3, String(s.unlockedCount));
  check('획득은 0 에서 시작한다', s.earnedCount === 0, String(s.earnedCount));
  check('settings 도 빈 객체로 채워진다', typeof s.setting('sfx', false) === 'boolean');
  // 옛 기록을 획득으로 옮겨 주지 않는 것이 맞다 — 실제로 딴 게 아닐 수 있고,
  // 없던 기록을 만들어 주는 쪽이 더 나쁘다.
  check('읽음을 획득으로 승격하지 않는다', s.hasEarned('훅') === false);
}

console.log('\n== 저장소가 망가진 경우에도 돌아간다 ==');
{
  store = {}; store[KEY] = '{ 이건 JSON 이 아니다';
  const m = await import(`../src/core/state.js?v=${++gen}`);
  check('빈 상태로 시작한다', m.state.earnedCount === 0 && m.state.unlockedCount === 0);
}
{
  // earnedTerms 가 배열이 아닌 쓰레기로 들어와도 터지지 않아야 한다
  const s = await freshState({ version: 1, earnedTerms: '훅', unlockedTerms: null });
  check('배열 아닌 값을 배열로 되돌린다', s.earnedCount === 0 && s.unlockedCount === 0,
    `${s.earnedCount}/${s.unlockedCount}`);
}

console.log('\n== 처음부터 를 누르면 획득도 지워진다 ==');
{
  const s = await freshState();
  s.record('prevent-accident', { grade: 'pass', score: 100, unlocked: ['훅'] });
  s.reset();
  check('획득 0', s.earnedCount === 0, String(s.earnedCount));
  check('읽음 0', s.unlockedCount === 0, String(s.unlockedCount));
  check('저장 키도 지워진다', store[KEY] === undefined);
}

console.log('\n== 챕터 집계 (collect.js) ==');
{
  // 주의: collect.js 는 '../core/state.js' 를 **꼬리 없이** import 한다.
  // 그래서 freshState() 가 만든 state.js?v=N 인스턴스와는 다른 물건을 본다.
  // 여기서는 저장소를 먼저 비우고 **꼬리 없는** state 를 함께 써야 같은 인스턴스가 된다.
  store = {};
  const collect = await import('../src/shell/collect.js');
  const s = (await import('../src/core/state.js')).state;
  const { terms } = await import('../src/data/terms.js');

  const st0 = collect.status();
  check('총계가 도감 개수와 같다', st0.total === terms.length, `${st0.total} vs ${terms.length}`);
  check('챕터 합이 총계와 같다',
    st0.chapters.reduce((n, c) => n + c.total, 0) === terms.length);
  check('빈 상태에서 완성된 챕터가 없다', st0.chapters.every(c => !c.done));
  check('빈 상태 pct 는 0', st0.pct === 0, String(st0.pct));

  // 챕터 하나를 다 채우면 done 이 뜨고 도장이 찍힌다
  const ch = st0.chapters[0];
  const inCh = terms.filter(t => t.chapter === ch.ch).map(t => t.term);
  s.record('x', { grade: 'pass', score: 100, unlocked: inCh });
  const st1 = collect.status();
  const c1 = st1.chapters.find(c => c.ch === ch.ch);
  check('그 챕터가 done 이 된다', c1.done === true);
  check('그 챕터 pct 100', c1.pct === 100, String(c1.pct));
  check('다른 챕터는 여전히 미완성', st1.chapters.filter(c => c.done).length === 1);
  check('전체 획득 수가 맞다', st1.earned === inCh.length, `${st1.earned} vs ${inCh.length}`);

  // 번외는 "챕터 9"가 아니다
  check('번외 라벨에 챕터 번호가 없다', collect.chapterLabel(9) === '번외',
    collect.chapterLabel(9));
  check('일반 챕터 라벨에 번호가 있다', /^챕터 2 — /.test(collect.chapterLabel(2)),
    collect.chapterLabel(2));
}

console.log('\n== 챕터 머리글 markup ==');
{
  // DOM 이 필요한 최소한만 흉내 낸다 — chapterHead 가 만드는 문자열만 보면 된다.
  globalThis.document = {
    createElement: () => ({
      className: '', _html: '',
      set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; }
    })
  };
  const collect = await import('../src/shell/collect.js');
  const zero = collect.chapterHead({ ch: 1, label: '챕터 1 — X', total: 14, earned: 0, done: false, pct: 0 });
  const some = collect.chapterHead({ ch: 1, label: '챕터 1 — X', total: 14, earned: 1, done: false, pct: 7 });
  const all  = collect.chapterHead({ ch: 1, label: '챕터 1 — X', total: 14, earned: 14, done: true, pct: 100 });
  check('0개면 "아직 하나도 없다"', /아직 하나도 없다/.test(zero.innerHTML));
  check('0개면 막대 표시 클래스가 없다', !/bar--some/.test(zero.innerHTML));
  // 68개 중 1개는 1.5% 라 안 보인다. 빈 막대는 "아무것도 없다"로 읽혀서
  // 하나라도 모았으면 반드시 눈에 띄어야 한다.
  check('1개면 막대 표시 클래스가 붙는다', /bar--some/.test(some.innerHTML));
  check('1개면 "13개 남았다"', /13개 남았다/.test(some.innerHTML), some.innerHTML);
  check('다 모으면 "다 모았다"', /다 모았다/.test(all.innerHTML));
  check('다 모으면 done 클래스', /codex__groupname--done/.test(all.className), all.className);
  // 검색 중이면 챕터 총수와 화면에 보이는 수가 다르다 — 헷갈리지 않게 밝혀야 한다
  const partial = collect.chapterHead({ ch: 1, label: '챕터 1 — X', total: 14, earned: 2, done: false, pct: 14 }, 3);
  check('보이는 수가 다르면 밝힌다', /3개 보임/.test(partial.innerHTML), partial.innerHTML);
  const same = collect.chapterHead({ ch: 1, label: '챕터 1 — X', total: 14, earned: 2, done: false, pct: 14 }, 14);
  check('보이는 수가 같으면 안 밝힌다', !/보임/.test(same.innerHTML));
  delete globalThis.document;
}

console.log('\n== 어느 판에서 딸 수 있나 ==');
{
  const collect = await import('../src/shell/collect.js');
  const map = await collect.sourceMap();
  check('지도가 비어 있지 않다', map.size > 0, String(map.size));
  // 게임으로 나오지 않는 용어가 있는 것은 설계다(도감을 읽게 만드는 것도 목적).
  // 다만 그 수가 절반을 넘으면 수집판이 성립하지 않는다.
  const { terms } = await import('../src/data/terms.js');
  const reachable = terms.filter(t => map.has(t.term)).length;
  console.log(`       게임으로 딸 수 있는 용어: ${reachable} / ${terms.length}`);
  check('게임으로 딸 수 있는 용어가 절반을 넘는다', reachable > terms.length / 2,
    `${reachable}/${terms.length}`);
  check('안내하는 판 정보가 온전하다',
    [...map.values()].every(v => v.id && v.no && v.title));
  // 여러 판이 같은 용어를 주면 번호가 앞선 판을 안내해야 한다 — 코스 순서상 가장 가깝다
  const { manifest } = await import('../src/games/index.js');
  const byId = new Map(manifest.map(m => [m.id, m]));
  check('안내하는 판이 매니페스트에 있다',
    [...map.values()].every(v => byId.has(v.id)));
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
