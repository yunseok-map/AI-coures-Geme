// 엔진 W(배선형) 검사 — 그래프 계산과 11·12번 판정.
//
// 이 판들은 "어떻게 이었느냐"가 전부다. 화면에서 손으로 이어 보는 것으로는
// 되돌아오는 선, 걷어 오지 않은 일, 확인이 한 칸 앞선 경우 같은 오답 경로를
// 다 밟을 수 없다. 여기서 선 목록을 직접 만들어 전부 돌린다.
//
// 엔진이 simulate 에 넘기는 것과 **같은 방법으로** sched 를 만든다 —
// 엔진과 판정이 다른 답을 보면 화면에는 6칸이라 떠 있는데 판정은 7칸이 된다.

const ROOT = '../src';
const { schedule, reaches, wouldCycle, normalize, overlaps, widest } =
  await import(`${ROOT}/core/graph.js`);
const g11 = (await import(`${ROOT}/games/11-team-layout.js`)).default;
const g12 = (await import(`${ROOT}/games/12-auto-line.js`)).default;

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };

/** 엔진이 하는 것과 같은 준비 */
function play(game, links) {
  const nodes = game.data.nodes;
  const ls = normalize(links.map(([from, to]) => ({ from, to })));
  return game.simulate({ links: ls, nodes, sched: schedule(nodes, ls) }, game.data);
}
const names = r => r.faults.map(f => f.name);
const gains = r => r.gains.map(f => f.name);

// ---------------------------------------------------------------- 그래프 계산
console.log('\n== core/graph.js ==');
{
  const N = [{ id: 'a', dur: 2 }, { id: 'b', dur: 2 }, { id: 'c', dur: 2 }, { id: 'm', dur: 2 }];

  const serial = schedule(N, [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'm' }]);
  check('한 줄로 이으면 차례로 돈다', serial.finish === 8, String(serial.finish));
  check('한 줄에서는 겹치는 것이 없다', !overlaps(serial, 'a', 'b'));

  const fan = schedule(N, [{ from: 'a', to: 'm' }, { from: 'b', to: 'm' }, { from: 'c', to: 'm' }]);
  check('갈라 이으면 같이 돈다', fan.finish === 4, String(fan.finish));
  check('셋이 나란히 돈 것을 센다', widest(fan, ['a', 'b', 'c']) === 3, String(widest(fan, ['a', 'b', 'c'])));
  check('취합은 셋이 다 끝난 뒤 시작한다', fan.start.m === 2, String(fan.start.m));

  const half = schedule(N, [{ from: 'a', to: 'b' }, { from: 'b', to: 'm' }, { from: 'c', to: 'm' }]);
  check('둘만 줄 세우면 그만큼만 늘어난다', half.finish === 6, String(half.finish));

  // 되돌아오는 선
  check('되돌아오는 선을 미리 알아본다', wouldCycle([{ from: 'a', to: 'b' }], 'b', 'a'));
  check('자기 자신도 막는다', wouldCycle([], 'a', 'a'));
  check('멀쩡한 선은 안 막는다', !wouldCycle([{ from: 'a', to: 'b' }], 'b', 'c'));
  const loop = schedule(N, [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }]);
  check('순환에 걸린 것은 돌지 않는다', loop.cycle.sort().join() === 'a,b', loop.cycle.join());
  check('순환 밖은 그대로 돈다', loop.end.c === 2, String(loop.end.c));

  check('선을 따라 멀리까지 닿는다', reaches([{ from: 'a', to: 'b' }, { from: 'b', to: 'm' }], 'a', 'm'));
  check('반대 방향으로는 못 닿는다', !reaches([{ from: 'a', to: 'b' }], 'b', 'a'));
  check('같은 선을 두 번 넣어도 하나로 본다',
    normalize([{ from: 'a', to: 'b' }, { from: 'a', to: 'b' }]).length === 1);
  check('선을 하나도 안 그으면 전부 0칸에 시작한다',
    schedule(N, []).finish === 2 && schedule(N, []).start.m === 0);
}

// ---------------------------------------------------------------- 11번 팀 배치
console.log('\n== 11번 팀 배치 ==');
{
  // 정답 — 셋을 서로 잇지 않고 각각 취합으로
  const good = play(g11, [['a', 'merge'], ['b', 'merge'], ['c', 'merge']]);
  check('나란히 이으면 통과', good.grade === 'pass', `${good.grade} ${good.score}`);
  check('사고 없음', good.faults.length === 0, names(good).join(', '));
  check('병렬 처리를 잘한 점으로 준다', gains(good).includes('병렬 처리'), gains(good).join(', '));
  check('컨텍스트 격리도 준다', gains(good).includes('컨텍스트 격리'));
  check('마감 안에 끝났다고 적는다', good.steps.some(s => s.text.includes('마감 안에')));

  // 오답 1 — 한 줄로 줄 세우기
  const line = play(g11, [['a', 'b'], ['b', 'c'], ['c', 'merge']]);
  check('줄 세우면 마감을 넘긴다', names(line).includes('마감 초과'), names(line).join(', '));
  check('줄 세우기 자체도 짚는다', names(line).includes('줄 세우기'), names(line).join(', '));
  check('줄 세우면 통과가 아니다', line.grade !== 'pass', `${line.grade} ${line.score}`);

  // 오답 2 — 시켜만 놓고 걷어 오지 않음
  const drop = play(g11, [['a', 'merge'], ['b', 'merge']]);
  check('걷어 오지 않은 조사를 잡는다', names(drop).includes('걷어 오지 않은 일'), names(drop).join(', '));
  check('빠진 채로 표가 만들어졌다고 알린다',
    drop.steps.some(s => s.text.includes('빠진 채로')), '');
  check('그래도 합류 실패로도 기록된다', names(drop).includes('합류 실패'), names(drop).join(', '));

  // 오답 3 — 취합에 아무것도 안 들어옴
  const empty = play(g11, [['a', 'b']]);
  check('빈 표는 실패다', empty.grade === 'fail', `${empty.grade} ${empty.score}`);
  check('취합 없음을 짚는다', names(empty).includes('취합 없음'), names(empty).join(', '));

  // 오답 4 — 반만 줄 세우기: 마감에 딱 맞춰 들어온다
  const half = play(g11, [['a', 'b'], ['b', 'merge'], ['c', 'merge']]);
  check('반만 줄 세우면 마감에 걸치되 넘지는 않는다',
    !names(half).includes('마감 초과'), names(half).join(', '));
}

// ---------------------------------------------------------------- 12번 자동화 라인
console.log('\n== 12번 자동화 라인 ==');
{
  const CHAIN = [['collect', 'classify'], ['classify', 'draft']];

  // 정답 — 초안과 발송 사이에 확인 하나
  const good = play(g12, [...CHAIN, ['draft', 'check1'], ['check1', 'send']]);
  check('발송 직전에 확인을 두면 통과', good.grade === 'pass', `${good.grade} ${good.score}`);
  check('사고 없음', good.faults.length === 0, names(good).join(', '));
  check('휴먼 인 더 루프를 준다', gains(good).includes('휴먼 인 더 루프'), gains(good).join(', '));
  check('휴먼 온 더 루프도 준다', gains(good).includes('휴먼 온 더 루프'), gains(good).join(', '));

  // 오답 1 — 확인 없이 바로 발송
  const bare = play(g12, [...CHAIN, ['draft', 'send']]);
  check('확인이 없으면 검토 없음', names(bare).includes('검토 없음'), names(bare).join(', '));
  check('되돌릴 수 없다고 알린다', bare.steps.some(s => s.text.includes('되돌릴 수 없다')));
  check('확인 없이 보내면 실패', bare.grade === 'fail', `${bare.grade} ${bare.score}`);

  // 오답 2 — 확인이 앞쪽에만 있다 (초안 뒤에 고친 것은 아무도 안 본다)
  const early = play(g12, [['collect', 'check1'], ['check1', 'classify'],
                           ['classify', 'draft'], ['draft', 'send']]);
  check('확인 위치가 틀린 것을 짚는다', names(early).includes('확인 위치'), names(early).join(', '));
  check('앞쪽 확인만으로는 통과가 아니다', early.grade !== 'pass', `${early.grade} ${early.score}`);
  check('앞쪽 확인은 검토 없음으로 세지 않는다', !names(early).includes('검토 없음'));

  // 오답 3 — 확인을 둘 다 끼워 넣음
  const many = play(g12, [['collect', 'check1'], ['check1', 'classify'], ['classify', 'draft'],
                          ['draft', 'check2'], ['check2', 'send']]);
  check('확인 과다를 짚는다', names(many).includes('확인 과다'), names(many).join(', '));
  check('확인이 둘이면 휴먼 온 더 루프를 안 준다', !gains(many).includes('휴먼 온 더 루프'));
  check('그래도 발송 직전 확인은 인정한다', gains(many).includes('휴먼 인 더 루프'));

  // 오답 4 — 순서 뒤바뀜
  const swap = play(g12, [['collect', 'draft'], ['draft', 'classify'],
                          ['classify', 'check1'], ['check1', 'send']]);
  check('순서가 뒤집힌 것을 잡는다', names(swap).includes('순서 뒤바뀜'), names(swap).join(', '));

  // 오답 5 — 라인에 안 걸린 단계
  const loose = play(g12, [['draft', 'check1'], ['check1', 'send']]);
  check('이어지지 않은 단계를 잡는다', names(loose).includes('빠진 단계'), names(loose).join(', '));

  // 오답 6 — 아무것도 안 이었을 때도 조용히 통과하지 않는다
  const none = play(g12, []);
  check('선이 없으면 통과가 아니다', none.grade !== 'pass', `${none.grade} ${none.score}`);
}

// ---------------------------------------------------------------- 판 데이터 모양
console.log('\n== 배선형 판 데이터 ==');
for (const g of [g11, g12]) {
  const ids = g.data.nodes.map(n => n.id);
  check(`${g.title} 상자 id 에 중복이 없다`, new Set(ids).size === ids.length);
  check(`${g.title} 모든 상자에 이름이 있다`, g.data.nodes.every(n => n.label));
  check(`${g.title} 모든 상자에 자리가 있다`,
    g.data.nodes.every(n => Number.isFinite(n.col) && Number.isFinite(n.row)));
  // 같은 칸에 둘을 놓으면 겹쳐서 하나가 안 보인다
  const cells = g.data.nodes.map(n => `${n.col},${n.row}`);
  check(`${g.title} 같은 칸에 두 상자가 없다`, new Set(cells).size === cells.length, cells.join(' / '));
  check(`${g.title} 걸리는 시간이 1칸 이상이다`, g.data.nodes.every(n => (n.dur ?? 1) >= 1));
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
