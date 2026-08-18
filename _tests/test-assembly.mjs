// 엔진 L(조립 라인) 검사 — 6번의 출고 판정과 마무리 판정.
//
// 이 판은 판정이 두 겹이다. judge() 가 출고 한 건을 그 자리에서 켜 보고,
// simulate() 가 하루치를 모아 본다. 화면에서는 네 주문을 한 번에 다 밟을 수 없으므로
// 여기서 조합을 직접 만든다 — 특히 **엔진만 출고한 경우**(이 판의 핵심)를.

const ROOT = '../src';
const g6 = (await import(`${ROOT}/games/06-model-or-product.js`)).default;

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };

const D = g6.data;
const ORDERS = D.orders;
const orderOf = id => ORDERS.find(o => o.id === id);
const text = r => r.steps.map(s => s.text).join(' | ');
const names = r => r.faults.map(f => f.name);
const gains = r => r.gains.map(f => f.name);

const judge = (engine, chassis, orderId) =>
  g6.judge({ orderId, engine, chassis }, orderOf(orderId), D);
const day = builds => g6.simulate({ builds }, D);

// ---------------------------------------------------------------- 데이터
console.log('\n== 6번 데이터 모양 ==');
check('엔진이 둘 이상이다', D.engines.length >= 2, String(D.engines.length));
check('차체가 셋 이상이다', D.chassis.length >= 3, String(D.chassis.length));
check('엔진 id 에 중복이 없다', new Set(D.engines.map(e => e.id)).size === D.engines.length);
check('차체 id 에 중복이 없다', new Set(D.chassis.map(c => c.id)).size === D.chassis.length);
check('모든 차체에 표면이 있다', D.chassis.every(c => Array.isArray(c.surfaces) && c.surfaces.length));
check('모든 차체에 하는 일이 있다', D.chassis.every(c => (c.can || '').length >= 10));
check('주문이 셋 이상이다', ORDERS.length >= 3, String(ORDERS.length));
check('주문이 요구하는 차체가 실제로 있다',
  ORDERS.every(o => !o.want || D.chassis.some(c => c.id === o.want)),
  ORDERS.filter(o => o.want && !D.chassis.some(c => c.id === o.want)).map(o => o.id).join(', '));
// 같은 엔진을 다시 쓰게 하는 주문이 있어야 1:N 을 겪는다
check('같은 엔진을 요구하는 주문이 있다', ORDERS.some(o => o.sameEngineAs));
check('엔진 이름만 적힌 함정 주문이 있다', ORDERS.some(o => o.trap));

// ---------------------------------------------------------------- 출고 한 건
console.log('\n== 출고 한 건을 켜 본다 ==');
{
  const good = judge('opus', 'cli', 'o1');
  check('맞는 조합은 통과', good.ok === true);
  check('도는 곳을 알려 준다', text(good).includes('터미널'), text(good));
  check('무엇을 하는지 알려 준다', text(good).includes('파일을 읽고'), text(good));

  // 이 판의 핵심 — 엔진만 출고
  const husk = judge('opus', null, 'o1');
  check('엔진만 출고하면 실패', husk.ok === false);
  check('켤 수 없다고 말한다', text(husk).includes('켤 수 있는 물건이 아니다'), text(husk));
  check('엔진 이름을 조사와 함께 읽는다', text(husk).includes('Claude Opus를'), text(husk));

  const empty = judge(null, 'cli', 'o1');
  check('엔진 없이 껍데기만 출고하면 실패', empty.ok === false);
  check('엔진이 빠졌다고 말한다', text(empty).includes('엔진이 빠졌다'), text(empty));

  const nothing = judge(null, null, 'o1');
  check('아무것도 안 올려도 판정이 돈다', nothing.ok === false);

  const wrong = judge('opus', 'chat', 'o1');
  check('주문과 다른 차체는 반품', wrong.ok === false);
  check('무엇이 필요했는지 알려 준다', text(wrong).includes('CLI 에이전트가'), text(wrong));

  // 함정 주문 — 엔진 이름만 적혀 있다. 차체를 붙여야 쓸 수 있는 것이 된다.
  const trapOk = judge('gpt', 'chat', 'o3');
  check('함정 주문은 어떤 차체를 붙여도 켜진다', trapOk.ok === true);
  check('주문서가 잘못됐다고 짚는다', text(trapOk).includes('엔진 이름이다'), text(trapOk));
  const trapHusk = judge('gpt', null, 'o3');
  check('함정 주문이라도 엔진만 내보내면 실패', trapHusk.ok === false);
}

// ---------------------------------------------------------------- 하루치
console.log('\n== 하루치 마무리 ==');
{
  // 정답 경로 — o1·o2 는 같은 엔진, 차체는 주문대로
  const best = [
    { orderId: 'o1', engine: 'opus', chassis: 'cli' },
    { orderId: 'o2', engine: 'opus', chassis: 'work' },
    { orderId: 'o3', engine: 'gpt', chassis: 'chat' },
    { orderId: 'o4', engine: 'gemini', chassis: 'chat' }
  ];
  const r = day(best);
  check('정답 경로는 통과', r.grade === 'pass', `${r.grade} ${r.score}`);
  check('사고 없음', r.faults.length === 0, names(r).join(', '));
  check('1대N 을 잘한 점으로 준다', gains(r).includes('모델과 제품의 관계'), gains(r).join(', '));
  check('같은 엔진이 몇 대에 들어갔는지 센다', /하나가 서로 다른 완성품 2대/.test(text(r)), text(r));

  // 엔진만 내보낸 하루
  const husks = day(ORDERS.map(o => ({ orderId: o.id, engine: 'opus', chassis: null })));
  check('엔진만 내보내면 반려', husks.grade === 'fail', `${husks.grade} ${husks.score}`);
  check('켤 수 없는 물건을 짚는다', names(husks).includes('켤 수 없는 물건'), names(husks).join(', '));

  // 껍데기만 내보낸 하루
  const shells = day(ORDERS.map(o => ({ orderId: o.id, engine: null, chassis: 'chat' })));
  check('껍데기만 내보내도 통과가 아니다', shells.grade !== 'pass', `${shells.grade} ${shells.score}`);
  check('빈 껍데기를 짚는다', names(shells).includes('빈 껍데기'), names(shells).join(', '));

  // 같은 엔진을 요구한 주문을 어겼을 때
  const swapped = best.map(b => b.orderId === 'o2' ? { ...b, engine: 'gemini' } : b);
  const sw = day(swapped);
  check('엔진 바꿔치기를 잡는다', names(sw).includes('엔진 바꿔치기'), names(sw).join(', '));

  // 차체를 잘못 고른 경우
  const badCh = best.map(b => b.orderId === 'o1' ? { ...b, chassis: 'chat' } : b);
  const bc = day(badCh);
  check('차체 선택을 잡는다', names(bc).includes('차체 선택'), names(bc).join(', '));
  check('차체를 틀리면 통과가 아니다', bc.grade !== 'pass', `${bc.grade} ${bc.score}`);

  // 엔진을 매번 바꾸면 1:N 을 못 본다
  const allDiff = [
    { orderId: 'o1', engine: 'opus', chassis: 'cli' },
    { orderId: 'o2', engine: 'opus', chassis: 'work' }
  ];
  check('두 건만 있어도 1대N 을 센다', gains(day(allDiff)).includes('모델과 제품의 관계'));

  const noReuse = [
    { orderId: 'o1', engine: 'opus', chassis: 'cli' },
    { orderId: 'o4', engine: 'gemini', chassis: 'chat' }
  ];
  check('엔진을 매번 바꾸면 1대N 을 못 봤다고 말한다',
    text(day(noReuse)).includes('여러 완성품에 들어가는 것을 보지 못했다'));

  check('출고가 없어도 판정이 돈다', typeof day([]).score === 'number');
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
