// 엔진 S(서고) 검사 — 낱말 매칭과 4번 판의 판정.
//
// 이 판은 "내가 친 낱말이 결과를 만든다"가 전부다. 그래서 검사할 것도 그것이다:
//   ① 뻔한 첫 낱말로는 필요한 두 문서가 다 안 걸린다 (그러면 판이 성립 안 한다)
//   ② 담은 문서에서 나온 낱말로 치면 걸린다 (사슬이 이어져야 한다)
//   ③ 상위 몇 건만 나오므로 함정이 자리를 먹는다
//   ④ 조각이 모자라거나 엉뚱하면 AI 가 **자신 있게** 틀린다

const ROOT = '../src';
const g4 = (await import(`${ROOT}/games/04-fetch-source.js`)).default;
const { terms, score, search } = await import(`${ROOT}/core/search.js`);

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };

const D = g4.data;
const DOCS = D.docs;
const doc = id => DOCS.find(x => x.id === id);
const ids = (list) => list.map(x => x.doc.id);
const find = (q) => search(DOCS, q, D.top);
const ask = (picked, queries = []) => g4.simulate({ picked, queries }, D);
const names = r => r.faults.map(f => f.name);
const gains = r => r.gains.map(f => f.name);
const said = r => r.steps.filter(s => s.kind === 'out').map(s => s.text).join(' ');

// ---------------------------------------------------------------- 낱말
console.log('\n== 낱말 쪼개기 ==');
{
  check('공백으로 나눈다', terms('성과급 재직일수').length === 2, terms('성과급 재직일수').join(','));
  check('조사를 떼어 준다', terms('성과급은').includes('성과급'), terms('성과급은').join(','));
  check('원래 형태도 남긴다', terms('성과급은').includes('성과급은'));
  check('한 글자는 버린다', terms('이 성과급').every(t => t.length >= 2), terms('이 성과급').join(','));
  check('빈 질의는 빈 목록', terms('').length === 0 && terms(null).length === 0);
  check('너무 흔한 말은 안 센다', !terms('어떻게 얼마나').length, terms('어떻게 얼마나').join(','));

  const s = score(doc('pay-rule'), ['성과급']);
  check('색인어에 그대로 있으면 크게 준다', s.n === 3, String(s.n));
  check('무엇이 걸렸는지 알려 준다', s.hits.includes('성과급'));
  check('본문에만 있으면 작게 준다', score(doc('annual-leave'), ['출근']).n === 1,
    String(score(doc('annual-leave'), ['출근']).n));
  // 색인어가 낱말을 품고 있어도 걸린다 — '육아휴직' 은 '휴직' 을 품는다.
  // 실제 낱말 검색기가 그렇게 굴고, 그래서 옆 규정이 자꾸 딸려 온다.
  check('색인어에 품고 있어도 걸린다', score(doc('annual-leave'), ['육아휴직']).n === 2,
    String(score(doc('annual-leave'), ['육아휴직']).n));
  check('안 걸리면 0', score(doc('remote'), ['성과급']).n === 0);
}

// ---------------------------------------------------------------- 검색
console.log('\n== 검색은 상위 몇 건만 준다 ==');
{
  check('빈 질의로는 아무것도 안 걸린다', find('').length === 0);
  check('상위 몇 건까지만 나온다', find('신청').length <= D.top, String(find('신청').length));
  check('같은 낱말이면 늘 같은 결과',
    JSON.stringify(ids(find('성과급'))) === JSON.stringify(ids(find('성과급'))));
  check('서고에 없는 말은 한 건도 안 걸린다', find('주차장 정기권').length === 0,
    ids(find('주차장 정기권')).join(','));
}

console.log('\n== 뻔한 첫 낱말로는 다 안 걸린다 (이 판이 성립하는 조건) ==');
{
  const first = find('육아휴직 성과급');
  check('첫 검색에 뭔가는 걸린다', first.length > 0);
  check('첫 검색만으로는 두 문서가 다 안 걸린다',
    !(ids(first).includes('pay-rule') && ids(first).includes('leave-count')), ids(first).join(','));
  check('첫 검색에 함정이 끼어든다',
    ids(first).some(id => ['leave-apply', 'pay-date', 'annual-leave'].includes(id)),
    ids(first).join(','));
  check('첫 검색으로 한쪽은 걸린다 — 사슬의 시작',
    ids(first).includes('pay-rule') || ids(first).includes('leave-count'), ids(first).join(','));
}

console.log('\n== 담은 문서에서 나온 낱말로 치면 걸린다 (사슬) ==');
{
  check('성과급 지급 기준이 새 낱말을 준다',
    (doc('pay-rule').gives || []).length > 0, JSON.stringify(doc('pay-rule').gives));
  const word = doc('pay-rule').gives[0];
  const second = find(word);
  check(`그 낱말(${word})로 두 번째 문서가 걸린다`,
    ids(second).includes('leave-count'), ids(second).join(','));
  check('그 낱말로 두 문서가 같이 걸린다',
    ids(second).includes('pay-rule') && ids(second).includes('leave-count'), ids(second).join(','));
  check('그 낱말에도 노이즈가 섞인다', ids(second).length === D.top, ids(second).join(','));

  // 함정 문서는 산입이라는 말을 공유한다 — 그래서 위험하다
  const third = find('산입');
  check('산입으로 치면 연차 함정도 같이 걸린다',
    ids(third).includes('annual-leave'), ids(third).join(','));
}

// ---------------------------------------------------------------- 답
console.log('\n== AI 는 넘긴 것만 보고 답한다 ==');
{
  const good = ask(['pay-rule', 'leave-count'], ['성과급', '재직일수']);
  check('두 문서를 다 넘기면 통과', good.grade === 'pass', `${good.grade} ${good.score}`);
  check('답이 두 규정을 다 반영한다', /석 달을 뺀|산입/.test(said(good)), said(good));
  check('두 문서에 걸친 답을 잘한 점으로', gains(good).includes('두 문서에 걸친 답'));
  check('읽고 다시 찾은 것을 잘한 점으로', gains(good).includes('읽고 다시 찾았다'));
  check('사고 없음', good.faults.length === 0, names(good).join(', '));

  const half = ask(['pay-rule'], ['성과급']);
  check('한쪽만 넘기면 통과가 아니다', half.grade !== 'pass', `${half.grade} ${half.score}`);
  check('반쪽 근거로 이름 붙인다', names(half).includes('반쪽 근거'), names(half).join(', '));
  check('그런데 답은 단정적이다', /전액 받으십니다/.test(said(half)), said(half));

  const other = ask(['leave-count'], ['산입']);
  check('반대쪽만 넘겨도 통과가 아니다', other.grade !== 'pass', `${other.grade} ${other.score}`);
  check('질문에 답을 안 한 것이 드러난다', /산입하지 않습니다/.test(said(other)), said(other));

  // 이 판에서 제일 위험한 오답
  const trap = ask(['pay-rule', 'annual-leave'], ['휴직 기간']);
  check('연차 함정을 넘기면 반려', trap.grade === 'fail', `${trap.grade} ${trap.score}`);
  check('정반대 답이 나온다', /전액 그대로 지급됩니다/.test(said(trap)), said(trap));
  check('옆 규정을 끌어다 쓴 것으로 이름 붙인다',
    names(trap).includes('옆 규정을 끌어다 썼다'), names(trap).join(', '));
  check('환각으로도 잡는다', names(trap).includes('환각'), names(trap).join(', '));

  const date = ask(['pay-date'], ['성과급']);
  check('지급일 문서만 넘기면 엉뚱한 답', /3월/.test(said(date)), said(date));
  check('엉뚱한 조각으로 이름 붙인다', names(date).includes('엉뚱한 조각'));

  const none = ask([], []);
  check('아무것도 안 넘겨도 답은 나온다', said(none).length > 0, said(none));
  check('그 답이 단정적이다', /지급됩니다/.test(said(none)), said(none));
  check('아무것도 안 넘기면 반려', none.grade === 'fail', `${none.grade} ${none.score}`);
  check('환각으로 이름 붙인다', names(none).includes('환각'), names(none).join(', '));

  // 칸이 좁다는 것도 규칙이다
  const messy = ask(['pay-rule', 'leave-count', 'leave-apply'], ['재직일수']);
  check('쓸데없는 조각을 같이 넘기면 감점', messy.score < 100, String(messy.score));
  check('그래도 답 자체는 맞다', messy.grade === 'pass', `${messy.grade} ${messy.score}`);
  check('쓸데없이 넘긴 조각으로 이름 붙인다', names(messy).includes('쓸데없이 넘긴 조각'));

  check('필요했던 문서를 마지막에 알려 준다',
    good.reveal && good.reveal.need.length === 2, JSON.stringify(good.reveal));
  check('빈 setup 으로도 판정이 돈다', typeof g4.simulate({}, D).score === 'number');
}

// ---------------------------------------------------------------- 데이터
console.log('\n== 4번 데이터 모양 ==');
{
  check('서고가 열 권 이상이다', DOCS.length >= 10, String(DOCS.length));
  check('문서 id 에 중복이 없다', new Set(DOCS.map(x => x.id)).size === DOCS.length);
  check('모든 문서에 색인어가 있다', DOCS.every(x => (x.keys || []).length > 0));
  check('모든 문서에 본문이 있다', DOCS.every(x => (x.text || '').length >= 10));
  check('찾을 횟수가 넉넉하지 않다', D.tries <= 5, String(D.tries));
  check('넘길 칸이 좁다', D.hold <= 3, String(D.hold));
  check('시작 낱말이 질문에서 나온 것들이다',
    D.words.every(w => D.ask.includes(w) || ['기간', '신청'].includes(w)), D.words.join(','));
  check('사슬을 잇는 문서에 gives 가 있다', DOCS.some(x => (x.gives || []).length));

  // 찾을 수 있는 횟수 안에 정답 경로가 실제로 들어가는가
  const path = ['육아휴직 성과급', '재직일수'];
  check('정답 경로가 검색 횟수 안에 들어간다', path.length <= D.tries, `${path.length} / ${D.tries}`);
  const box = [];
  for (const q of path) for (const h of find(q)) if (!box.includes(h.doc.id) && box.length < 99) box.push(h.doc.id);
  check('그 경로로 두 문서가 다 나온다',
    box.includes('pay-rule') && box.includes('leave-count'), box.join(','));
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
