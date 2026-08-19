// 엔진 P(예측형) 검사 — 7번 판정.
//
// 이 판의 핵심은 정답 개수가 아니라 **어느 쪽으로 기울었는가**다.
// 화면에서 손으로 여덟 번 걸어 보는 것으로는 "전부 못 한다에 걸었을 때",
// "전부 된다에 걸었을 때" 같은 극단을 확인할 수 없다. 여기서 다 밟는다.

const ROOT = '../src';
const g7 = (await import(`${ROOT}/games/07-name-trap.js`)).default;

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };

const ITEMS = g7.data.items;
const CAN = ITEMS.filter(i => i.axis === 'can');

/** 엔진이 하는 것과 같은 준비 — 항목마다 무엇을 걸었는지만 넘긴다 */
const play = bets => g7.simulate({ bets }, g7.data);
const all = fn => ITEMS.map(i => ({ id: i.id, bet: fn(i) }));
const names = r => r.faults.map(f => f.name);
const gains = r => r.gains.map(f => f.name);
const text = r => r.steps.map(s => s.text).join(' | ');

// ---------------------------------------------------------------- 판 데이터
console.log('\n== 7번 데이터 모양 ==');
check('문항이 일곱 개다', ITEMS.length === 7, String(ITEMS.length));
check('id 에 중복이 없다', new Set(ITEMS.map(i => i.id)).size === ITEMS.length);
check('모든 문항에 답이 있다', ITEMS.every(i => typeof i.answer === 'boolean'));
check('모든 문항에 실행 기록이 있다', ITEMS.every(i => Array.isArray(i.run) && i.run.length >= 3));
check('실행 기록에 종류와 글이 다 있다',
  ITEMS.every(i => i.run.every(s => s.kind && s.text && Number.isFinite(s.ms))));
check('모든 문항에 사실 설명이 있다', ITEMS.every(i => (i.truth || '').length >= 30));
check('축이 can/id 둘 중 하나다', ITEMS.every(i => i.axis === 'can' || i.axis === 'id'));
check('“시킬 수 있나” 문항이 과반이다', CAN.length > ITEMS.length / 2, String(CAN.length));
// 한쪽으로만 답이 몰리면 "전부 같은 쪽에 걸기"로 이긴다
check('can 문항의 답이 한쪽으로 몰려 있지 않다',
  CAN.some(i => i.answer) && CAN.some(i => !i.answer));
check('축이 다른 문항은 자기 질문을 갖는다',
  ITEMS.filter(i => i.axis === 'id').every(i => i.ask && i.yes && i.no));

// 카드만 보고 답할 수 있어야 한다 — 외워야 답하는 문항은 찍기가 된다.
// 지침 파일 세 개가 같은 일을 하냐는 문항이 여기 있었는데, 그건 10번 판이
// 가르치는 내용이라 배우기 전에 물은 셈이었다. 되돌아오면 여기서 잡는다.
check('아직 안 배운 것을 미리 묻지 않는다',
  !ITEMS.some(i => /AGENTS\.md|GEMINI\.md/.test(i.text || '')),
  ITEMS.map(i => i.id).join(', '));
// codex 문항은 "폐기됐다"와 "동료가 지금 쓴다"가 한 카드 안에서 부딪혀야 답이 갈린다.
// 그 근거를 카드에서 빼면 다시 암기 문제가 된다.
{
  const cx = ITEMS.find(i => i.id === 'codex');
  check('codex 문항 카드에 답을 가를 근거가 들어 있다',
    !!cx && /폐기/.test(cx.text) && /지금/.test(cx.text), cx ? cx.text : '없음');
}

// ---------------------------------------------------------------- 판정
console.log('\n== 7번 판정 ==');
{
  const perfect = play(all(i => i.answer));
  check('전부 맞히면 통과', perfect.grade === 'pass', `${perfect.grade} ${perfect.score}`);
  check('전부 맞히면 사고 없음', perfect.faults.length === 0, names(perfect).join(', '));
  check('범위 감각을 잘한 점으로 준다', gains(perfect).includes('범위 감각'), gains(perfect).join(', '));
  check('전부 맞힌 것을 건수로 짚는다', text(perfect).includes(`${ITEMS.length}건을 전부`));

  // 잘한 점이 점수를 올리면 100점 상한에서 잘리고, 그 잘린 만큼이 빗나간 한 건을
  // 덮는다. 실제로 codex 를 틀리고도 만점이 나왔다. 한 건이라도 빗나가면 만점이 아니다.
  const oneOff = all(i => i.axis === 'id' ? !i.answer : i.answer);
  check('한 건 빗나가면 만점이 아니다', play(oneOff).score < 100, String(play(oneOff).score));
  check('한 건 빗나가도 통과는 한다', play(oneOff).grade === 'pass', `${play(oneOff).grade} ${play(oneOff).score}`);

  // 이 판의 임팩트 — "못 한다" 쪽으로 기운 사람
  const scared = play(all(i => i.axis === 'can' ? false : i.answer));
  check('전부 못 한다에 걸면 이름이 만든 진입장벽을 짚는다',
    names(scared).includes('이름이 만든 진입장벽'), names(scared).join(', '));
  check('몇 건을 그쪽에 걸었는지 숫자로 말한다',
    text(scared).includes(`${CAN.length}건 중 ${CAN.length}건`), text(scared).slice(0, 120));
  check('실제로 못 하는 건수도 같이 말한다', /실제로 못 시키는 것은 \d건/.test(text(scared)));
  check('한쪽으로 몰면 통과가 아니다', scared.grade !== 'pass', `${scared.grade} ${scared.score}`);

  // 반대쪽으로 기운 사람
  const bold = play(all(i => i.axis === 'can' ? true : i.answer));
  check('전부 된다에 걸면 범위 착각을 짚는다',
    names(bold).includes('범위 착각'), names(bold).join(', '));
  check('두 편향이 같은 이름을 쓰지 않는다',
    !names(bold).includes('이름이 만든 진입장벽'));

  // 개수는 맞았는데 방향이 어긋난 경우 — 편향은 없지만 빗나감은 있다
  const swapped = all(i => i.answer);
  const a = CAN.find(i => i.answer), b = CAN.find(i => !i.answer);
  swapped.find(x => x.id === a.id).bet = false;
  swapped.find(x => x.id === b.id).bet = true;
  const even = play(swapped);
  check('기울지 않았으면 편향 사유가 안 붙는다',
    !names(even).includes('이름이 만든 진입장벽') && !names(even).includes('범위 착각'),
    names(even).join(', '));
  check('그래도 빗나간 것은 기록한다', text(even).includes('빗나감'));

  // 아무것도 안 걸고 끝낼 수는 없지만, 판정이 터지지는 않아야 한다
  const empty = play([]);
  check('건 것이 없어도 판정이 돈다', typeof empty.score === 'number', String(empty.score));
  check('건 것이 없으면 통과가 아니다', empty.grade !== 'pass', `${empty.grade} ${empty.score}`);
}

// ---------------------------------------------------------------- 등급 폭
console.log('\n== 등급 ==');
{
  // 예측 판은 틀리라고 만든 판이다. **반려로 떨어지면 안 된다** —
  // 이 판이 겨냥한 사람(이름 보고 미리 접는 사람)만 용어를 못 받게 된다.
  for (const [name, fn] of [
    ['세 건 빗나감', () => { const b = all(i => i.answer); for (const x of b.slice(0, 3)) x.bet = !x.bet; return b; }],
    ['can 을 전부 못 한다로', () => all(i => i.axis === 'can' ? false : i.answer)],
    ['can 을 전부 된다로', () => all(i => i.axis === 'can' ? true : i.answer)],
    ['전부 반대로', () => all(i => !i.answer)]
  ]) {
    const r = play(fn());
    check(`${name} — 반려는 아니다`, r.grade !== 'fail', `${r.grade} ${r.score}`);
  }

  // 고르게 틀린 사람이 만점으로 끝나면 안 된다 (편향만 보면 그렇게 된다)
  const evenTwo = all(i => i.answer);
  const t = CAN.find(i => i.answer), f = CAN.find(i => !i.answer);
  evenTwo.find(x => x.id === t.id).bet = false;
  evenTwo.find(x => x.id === f.id).bet = true;
  const ev = play(evenTwo);
  check('편향이 없어도 빗나간 만큼은 깎인다', ev.score < 100, String(ev.score));
  check('두 건 빗나감은 통과로 남는다', ev.grade === 'pass', `${ev.grade} ${ev.score}`);

  // 이 판이 겨냥한 사람 — 여섯 중 다섯을 "못 시킨다" 쪽에 건 경우
  const scaredish = all(i => i.answer);
  for (const x of scaredish) if (byIdCan(x.id) && byIdCan(x.id).answer) x.bet = false;
  const s2 = play(scaredish);
  check('네 건을 이름 때문에 접으면 통과가 아니다', s2.grade === 'partial', `${s2.grade} ${s2.score}`);
  check('그래도 용어는 받는다', s2.grade !== 'fail');
}

function byIdCan(id) { return CAN.find(i => i.id === id); }

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
