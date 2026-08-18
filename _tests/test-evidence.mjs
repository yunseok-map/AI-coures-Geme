// 엔진 V(증거판) 검사 — 잇기 규칙과 2번 판 판정.
//
// 이 판은 "어디에 걸었느냐"가 전부다. 화면에서 손으로 이어 보는 것으로는
// 무근거를 무근거로 표시한 경우 · 근거 있는 문장을 지운 경우 · 엉뚱한 조항에
// 건 경우를 다 밟을 수 없다. 여기서 표를 직접 만들어 전부 돌린다.
//
// 엔진이 마지막 화면을 그릴 때 쓰는 함수와 simulate 가 쓰는 함수가 같다
// (core/evidence.js 의 judge). 그래서 여기서 judge 를 잡으면 화면도 같이 잡힌다.

const ROOT = '../src';
const { NONE, KIND, judge, judgeLine, tally, linkedTo, toneTrap } =
  await import(`${ROOT}/core/evidence.js`);
const game = (await import(`${ROOT}/games/02-hallucination.js`)).default;

const d = game.data;
const lines = d.lines;
const spans = d.spans;

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('  OK   ' + n); }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };

/** 전부 제자리에 건 표 */
function perfect() {
  const m = {};
  for (const l of lines) m[l.id] = l.src || NONE;
  return m;
}
const play = (marks) => game.simulate({ marks, lines, spans }, d);
const names = (r) => r.faults.map(f => f.name);

const grounded = lines.filter(l => l.src);
const ungrounded = lines.filter(l => !l.src);
/** 이 문장의 근거가 아닌 다른 조항 */
const otherSpan = (l) => spans.find(s => s.id !== l.src).id;

// ---------------------------------------------------------------- 잇기 규칙
console.log('\n== core/evidence.js — 한 문장씩 ==');
{
  const g = grounded[0];
  const u = ungrounded[0];

  check('무근거 문장을 무근거로 표시하면 맞다',
    judgeLine(u, NONE).ok && judgeLine(u, NONE).kind === KIND.NONE_OK,
    judgeLine(u, NONE).kind);

  check('근거 있는 문장을 무근거로 표시하면 틀리다',
    !judgeLine(g, NONE).ok && judgeLine(g, NONE).kind === KIND.NONE_MISS,
    judgeLine(g, NONE).kind);

  check('엉뚱한 구간에 이으면 틀리다',
    !judgeLine(g, otherSpan(g)).ok && judgeLine(g, otherSpan(g)).kind === KIND.LINK_WRONG,
    judgeLine(g, otherSpan(g)).kind);

  check('제 근거에 이으면 맞다',
    judgeLine(g, g.src).ok && judgeLine(g, g.src).kind === KIND.LINK_OK);

  check('무근거 문장을 어딘가에 이으면 틀리다',
    !judgeLine(u, spans[0].id).ok && judgeLine(u, spans[0].id).kind === KIND.LINK_NONE,
    judgeLine(u, spans[0].id).kind);

  check('아직 표시 안 한 문장은 맞지도 틀리지도 않는다',
    judgeLine(g, null).kind === KIND.BLANK && !judgeLine(g, null).ok);

  check('무근거 문장이 바라는 자리는 무근거다', judgeLine(u, null).want === NONE);
  check('근거 있는 문장이 바라는 자리는 그 구간이다', judgeLine(g, null).want === g.src);
}

console.log('\n== core/evidence.js — 표 전체 ==');
{
  const empty = tally(lines, {});
  check('아무것도 안 하면 표시 0', empty.marked === 0 && !empty.done, String(empty.marked));
  check('남은 문장을 셀 수 있다', empty.left === lines.length, String(empty.left));

  const half = { [lines[0].id]: lines[0].src || NONE };
  check('한 문장만 표시하면 아직 안 끝났다', !tally(lines, half).done);
  check('전부 표시하면 끝난 것으로 본다', tally(lines, perfect()).done);
  check('전부 제자리면 맞은 수가 문장 수와 같다',
    tally(lines, perfect()).right === lines.length, String(tally(lines, perfect()).right));

  // Map 으로 넘겨도 같아야 한다 — 엔진은 Map 을 쓰고 판정은 객체를 받는다
  const asMap = new Map(Object.entries(perfect()));
  check('Map 과 객체가 같은 답을 낸다',
    tally(lines, asMap).right === tally(lines, perfect()).right);

  check('한 구간에 걸린 문장을 찾을 수 있다',
    linkedTo(lines, grounded[0].src).includes(grounded[0].id));
  check('무근거 문장은 무근거 쪽에 모인다',
    linkedTo(lines, NONE).length === ungrounded.length,
    String(linkedTo(lines, NONE).length));
}

// ---------------------------------------------------------------- 데이터 짜임새
console.log('\n== 데이터 짜임새 ==');
{
  check('문장이 6~8개다', lines.length >= 6 && lines.length <= 8, String(lines.length));
  check('근거 구간이 둘 이상이다', spans.length >= 2, String(spans.length));
  check('문장 아이디가 중복되지 않는다', new Set(lines.map(l => l.id)).size === lines.length);
  check('구간 아이디가 중복되지 않는다', new Set(spans.map(s => s.id)).size === spans.length);
  check('구간에 표시 글자가 다 있다', spans.every(s => s.mark) &&
    new Set(spans.map(s => s.mark)).size === spans.length);

  const ids = new Set(spans.map(s => s.id));
  check('문장이 가리키는 구간이 실제로 있다', lines.every(l => !l.src || ids.has(l.src)),
    lines.filter(l => l.src && !ids.has(l.src)).map(l => l.id).join(', '));

  check('무근거 문장이 둘 이상 있다', ungrounded.length >= 2, String(ungrounded.length));
  check('근거 있는 문장이 둘 이상 있다', grounded.length >= 2, String(grounded.length));
  check('문장마다 사유가 적혀 있다', lines.every(l => l.why && l.why.length > 10));

  // 아무 문장도 안 걸리는 조항이 있어야 "그럴듯한 자리에 잘못 걸기"가 성립한다
  const unused = spans.filter(s => !lines.some(l => l.src === s.id));
  check('아무 문장도 안 걸리는 조항이 있다', unused.length >= 1, String(unused.length));

  // 화면에는 정답이 안 나가야 한다 — src·tone·why 는 판이 끝나기 전에는 안 그린다
  check('구간 글에 정답 표시가 섞이지 않았다',
    spans.every(s => !/무근거|근거 없/.test(s.text)));
}

console.log('\n== 말투가 함정인가 (데이터 검사) ==');
{
  const t = toneTrap(lines);
  check('자신 있게 쓰인 문장이 둘 이상 있다', t.sure >= 2, String(t.sure));
  check('자신 있게 쓰인 문장이 실제로는 전부 무근거다', t.sure === t.sureUngrounded,
    `자신 있는 ${t.sure}개 중 무근거 ${t.sureUngrounded}개`);
  check('애매하게 쓰인 문장이 하나 있다', t.vague >= 1, String(t.vague));
  check('그 애매한 문장은 근거가 있다', t.vague === t.vagueGrounded,
    `애매한 ${t.vague}개 중 근거 있는 것 ${t.vagueGrounded}개`);

  // 숫자가 붙은 문장일수록 그럴듯하다 — 무근거 문장에 숫자가 실제로 들어 있는가
  const digits = (s) => (String(s).match(/\d/g) || []).length;
  check('무근거 문장에 숫자가 붙어 있다',
    ungrounded.every(l => digits(l.text) >= 1),
    ungrounded.filter(l => !digits(l.text)).map(l => l.id).join(', '));

  // 낱말 대조로 이길 수 없어야 한다:
  //  ① 규정과 낱말이 겹치는데 근거는 없는 문장
  //  ② 규정과 낱말이 거의 안 겹치는데 근거는 있는 문장
  const body = spans.map(s => s.text).join(' ');
  const sharesWord = (text) => ['연차', '신청', '승인', '부서장', '입사']
    .some(w => text.includes(w) && body.includes(w));
  check('낱말은 겹치는데 근거가 없는 문장이 있다', ungrounded.some(l => sharesWord(l.text)),
    '이게 없으면 낱말 대조로 이긴다');
  check('애매한 문장은 규정과 숫자가 안 겹친다',
    lines.filter(l => l.tone === 'vague').every(l => !/3일/.test(l.text)));
}

// ---------------------------------------------------------------- 판정
console.log('\n== 전부 맞혔을 때 ==');
{
  const best = play(perfect());
  check('전부 맞히면 통과', best.grade === 'pass', `${best.grade} ${best.score}점`);
  check('점수 100', best.score === 100, String(best.score));
  check('실패 사유 없음', best.faults.length === 0, names(best).join(' / '));
  check('근거 확인 + 환각 판별을 딴다', best.gains.length === 2,
    best.gains.map(g => g.name).join(' / '));
  check('환각 판별이 잘한 점으로 기록된다', best.gains.some(g => g.name === '환각 판별'));
  check('mistakes 없음', best.mistakes.length === 0);
  check('결과 문구가 전부 걸렸다고 말한다', /전부 제 근거에 걸렸다/.test(best.steps.at(-1).text),
    best.steps.at(-1).text);
  check('로그가 문장 수만큼 있다', best.steps.length === lines.length + 2,
    String(best.steps.length));
}

console.log('\n== 무근거 문장을 사실로 인정했을 때 ==');
{
  // 지어낸 문장 셋을 전부 그럴듯한 조항에 걸어 준다
  const m = perfect();
  for (const l of ungrounded) m[l.id] = spans[0].id;
  const r = play(m);
  check('등급 fail', r.grade === 'fail', `${r.grade} ${r.score}점`);
  check('환각이 용어 그대로 기록된다', names(r).filter(n => n === '환각').length === ungrounded.length,
    names(r).join(' / '));
  check('놓친 만큼 mistakes 에 담긴다', r.mistakes.length === ungrounded.length,
    String(r.mistakes.length));
  check('mistakes 힌트가 원본 사유다',
    r.mistakes.every(x => lines.find(l => l.id === x.itemId).why === x.hint));
  check('결과 문구가 보고서에 남는다고 말한다', /보고서에 그대로 남는다/.test(r.steps.at(-1).text),
    r.steps.at(-1).text);
  check('만점 보너스는 안 준다', !r.gains.some(g => g.name === '환각 판별'));
}

console.log('\n== 근거 있는 문장을 지웠을 때 ==');
{
  const m = perfect();
  m[grounded[0].id] = NONE;
  const r = play(m);
  check('통과는 아니다', r.grade !== 'pass', `${r.grade} ${r.score}점`);
  check('근거를 놓쳤다고 잡힌다', names(r).includes('근거를 놓침'), names(r).join(' / '));
  check('환각으로는 안 센다', !names(r).includes('환각'));
  check('나머지는 인정해 준다', r.gains.some(g => g.name === '근거 확인'));
}

console.log('\n== 엉뚱한 조항에 걸었을 때 ==');
{
  const m = perfect();
  m[grounded[0].id] = otherSpan(grounded[0]);
  const r = play(m);
  check('통과는 아니다', r.grade !== 'pass', `${r.grade} ${r.score}점`);
  check('엉뚱한 근거로 잡힌다', names(r).includes('엉뚱한 근거'), names(r).join(' / '));
  check('결과 문구가 자리가 어긋났다고 말한다', /근거 자리가 어긋났다/.test(r.steps.at(-1).text),
    r.steps.at(-1).text);
}

console.log('\n== 다 무근거로 밀어 버리는 전략은 통하지 않는다 ==');
{
  const m = {};
  for (const l of lines) m[l.id] = NONE;
  const r = play(m);
  check('지어낸 문장은 다 잡히지만 통과는 아니다', r.grade !== 'pass', `${r.grade} ${r.score}점`);
  check('지운 만큼 사유가 쌓인다',
    names(r).filter(n => n === '근거를 놓침').length === grounded.length,
    names(r).join(' / '));
}

console.log('\n== 한 군데만 어긋났을 때 ==');
{
  const m = perfect();
  m[grounded[0].id] = otherSpan(grounded[0]);
  const r = play(m);
  check('등급 partial', r.grade === 'partial', `${r.grade} ${r.score}점`);
}

console.log('\n== 판이 끝까지 돌아간다 ==');
{
  // 게임오버가 없다. 아무것도 표시 안 한 채로 넘어와도 판정이 나온다.
  const r = play({});
  check('빈 표로도 판정이 나온다', typeof r.score === 'number' && !!r.grade, r.grade);
  check('등급 fail 이지만 결과 문구는 나온다', r.grade === 'fail' && !!r.steps.at(-1).text);
  check('점수가 0 아래로 안 내려간다', r.score >= 0, String(r.score));
}

console.log('\n== 로그가 읽히는 길이인가 ==');
{
  const best = play(perfect());
  const worst = play(Object.fromEntries(lines.map(l => [l.id, spans[0].id])));
  const long = [...best.steps, ...worst.steps].filter(s => s.text.length > 40);
  check('로그 한 줄이 40자를 넘지 않는다', long.length === 0,
    long.map(s => `${s.text.length}자 ${s.text}`).join(' | '));
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
