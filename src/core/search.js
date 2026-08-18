// 낱말로 문서를 찾는다 — 규칙 기반 매처.
//
// 왜 core 에 있나: 엔진 S(서고)가 이 함수로 검색 결과를 그리고, 4번 판의
// simulate() 가 같은 함수로 판정한다. 두 곳이 각자 계산하면 "검색에는 떴는데
// 왜 못 찾았다고 하냐"가 된다. core/fire.js·core/dispatch.js 와 같은 이유다.
//
// **일부러 임베딩이 아니라 낱말 매칭이다.** 4번 판이 겪게 하려는 것이 정확히
// 그 한계이기 때문이다 — 내가 친 낱말이 문서에 없으면 그 문서는 안 걸린다.
// 판이 끝난 뒤에 "임베딩은 단어가 안 겹쳐도 뜻이 가까우면 걸리게 해 준다"를
// 이름 붙여 준다. 아픔을 먼저 겪고 이름을 나중에 받는 이 게임의 문법 그대로다.

/** 한국어 조사·어미. 낱말 끝에서 떼어 본다 — 안 떼면 "성과급은"이 안 걸린다. */
const TAILS = [
  '에서는', '으로는', '에게는', '까지', '부터', '에서', '으로', '에게',
  '이나', '라도', '이라', '은', '는', '이', '가', '을', '를', '의',
  '에', '로', '와', '과', '도', '만', '나'
];

/** 너무 흔해서 아무 문서나 걸리는 낱말. 점수를 안 준다. */
// 조사를 뗀 형태도 여기 걸려야 한다 — '얼마나'를 떼면 '얼마'가 남는다.
const STOP = new Set(['그리고', '하지만', '어떻게', '얼마나', '얼마', '무엇', '언제', '어디',
  '경우', '때문', '대한', '관련']);

/**
 * 질의를 낱말로 쪼갠다. 조사를 뗀 형태도 같이 넣는다.
 * @returns {string[]} 중복 없는 낱말. 한 글자짜리는 버린다.
 */
export function terms(query) {
  const out = [];
  const seen = new Set();
  const add = (w) => {
    if (w.length < 2 || STOP.has(w) || seen.has(w)) return;
    seen.add(w);
    out.push(w);
  };
  for (const raw of String(query || '').split(/[\s,./·]+/)) {
    const w = raw.trim();
    if (!w) continue;
    add(w);
    for (const tail of TAILS) {
      if (w.length > tail.length + 1 && w.endsWith(tail)) { add(w.slice(0, -tail.length)); break; }
    }
  }
  return out;
}

/**
 * 문서 하나의 점수.
 *
 * 제목·색인어에 그대로 있으면 크게, 본문에만 있으면 작게 준다.
 * 뜻이 가까운 것은 못 본다 — 그게 이 매처의 한계이고 이 판의 주제다.
 *
 * @returns {{n:number, hits:string[]}}
 */
export function score(doc, ts) {
  let n = 0;
  const hits = [];
  const keys = doc.keys || [];
  const body = (doc.title || '') + ' ' + (doc.text || '');

  for (const t of ts) {
    let best = 0;
    for (const k of keys) {
      if (k === t) { best = Math.max(best, 3); continue; }
      if (k.includes(t) || t.includes(k)) best = Math.max(best, 2);
    }
    if (!best && body.includes(t)) best = 1;
    if (best) { n += best; hits.push(t); }
  }
  return { n, hits };
}

/**
 * 검색. 점수 순으로 잘라 돌려준다.
 *
 * 자르는 것이 중요하다 — 서고 전체를 다 보여 주면 낱말을 고를 이유가 없어진다.
 * 실제 RAG 도 상위 몇 조각만 넘긴다.
 *
 * @param {Array} docs
 * @param {string} query
 * @param {number} top  몇 건까지 보여 줄 것인가
 * @returns {Array<{doc:object, n:number, hits:string[]}>}
 */
export function search(docs, query, top = 3) {
  const ts = terms(query);
  if (!ts.length) return [];
  return (docs || [])
    .map(doc => ({ doc, ...score(doc, ts) }))
    .filter(x => x.n > 0)
    // 점수가 같으면 서고에 꽂힌 순서대로. 같은 낱말이면 늘 같은 결과가 나와야 한다.
    .sort((a, b) => b.n - a.n || docs.indexOf(a.doc) - docs.indexOf(b.doc))
    .slice(0, top);
}
