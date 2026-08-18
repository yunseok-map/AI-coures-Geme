// 근거 잇기 규칙 — 순수 함수. DOM 도, 특정 미니게임도 모른다.
//
// 왜 core 에 있나: 엔진 V(증거판)가 이 함수로 선을 판정해 마지막 화면을 그리고,
// 2번 판의 simulate() 가 **같은 함수**로 점수를 낸다. 두 곳이 각자 판단하면
// 화면에 제자리라고 그려 놓고 점수는 틀렸다고 매기는 일이 생긴다.
// core/graph.js · core/search.js 와 같은 이유로 여기 둔다.
//
// 이 판이 가르치려는 것은 하나다 — **말투는 근거가 아니다.**
// 그래서 규칙도 말투를 안 본다. 문장이 걸려야 할 자리에 걸렸는가만 본다.

/** "걸 곳이 없다" 를 고른 것. 구간 id 와 섞이지 않게 따로 둔다. */
export const NONE = 'none';

/**
 * 판정 한 줄의 종류.
 *
 *   blank     아직 아무것도 표시하지 않았다
 *   linkOk    근거 있는 문장을 그 근거 구간에 이었다
 *   linkWrong 근거는 있는데 다른 구간에 이었다 — 그 구간은 이 문장을 뒷받침하지 않는다
 *   linkNone  근거가 없는 문장을 어딘가에 이었다 — 지어낸 문장을 사실로 인정한 것
 *   noneOk    걸 곳이 없는 문장을 걸 곳이 없다고 표시했다
 *   noneMiss  근거가 있는 문장을 걸 곳이 없다고 표시했다
 */
export const KIND = {
  BLANK: 'blank',
  LINK_OK: 'linkOk',
  LINK_WRONG: 'linkWrong',
  LINK_NONE: 'linkNone',
  NONE_OK: 'noneOk',
  NONE_MISS: 'noneMiss'
};

/** 표에서 이 문장에 무엇을 표시했나. 표시가 없으면 null. */
export function pickOf(marks, id) {
  if (!marks) return null;
  const v = marks instanceof Map ? marks.get(id) : marks[id];
  return v == null ? null : v;
}

/**
 * 문장 하나를 본다.
 *
 * @param {{id:string, src?:string|null}} line  src 가 없으면 근거가 없는 문장이다
 * @param {string|null} pick  구간 id · NONE · null(아직 표시 안 함)
 * @returns {{id:string, pick:string|null, want:string, ok:boolean, kind:string}}
 */
export function judgeLine(line, pick) {
  const want = line && line.src ? line.src : NONE;
  const row = { id: line ? line.id : '', pick: pick == null ? null : pick, want, ok: false, kind: KIND.BLANK };

  if (pick == null) return row;

  if (pick === NONE) {
    row.ok = want === NONE;
    row.kind = row.ok ? KIND.NONE_OK : KIND.NONE_MISS;
    return row;
  }

  if (want === NONE) { row.kind = KIND.LINK_NONE; return row; }

  row.ok = pick === want;
  row.kind = row.ok ? KIND.LINK_OK : KIND.LINK_WRONG;
  return row;
}

/**
 * 문장 전부를 본다. 순서는 준 순서 그대로 — 화면과 로그가 같은 차례로 읽혀야 한다.
 *
 * @param {Array} lines
 * @param {Map|Object} marks
 * @returns {Array} judgeLine 의 결과 목록
 */
export function judge(lines, marks) {
  return (lines || []).map(line => judgeLine(line, pickOf(marks, line.id)));
}

/**
 * 얼마나 했나. **맞았는지는 다 표시하기 전에는 세지 않는다** —
 * 한 문장 이을 때마다 맞았다/틀렸다가 뜨면 이 판은 그 자리에서 끝난다.
 *
 * @returns {{total:number, marked:number, left:number, done:boolean, right:number, wrong:number}}
 */
export function tally(lines, marks) {
  const rows = judge(lines, marks);
  const marked = rows.filter(r => r.pick != null).length;
  const total = rows.length;
  return {
    total,
    marked,
    left: total - marked,
    done: total > 0 && marked === total,
    right: rows.filter(r => r.ok).length,
    wrong: rows.filter(r => r.pick != null && !r.ok).length
  };
}

/** 한 구간에 걸린 문장들 (마지막 화면에서 구간별로 묶어 보여 줄 때 쓴다) */
export function linkedTo(lines, spanId) {
  return (lines || []).filter(l => (l.src || NONE) === spanId).map(l => l.id);
}

/**
 * 말투와 근거가 어긋나 있는가 — **이 판의 함정이 데이터에 실제로 들어 있는지** 본다.
 *
 * 문항을 고치다가 "자신 있게 쓴 문장"이 슬그머니 근거 있는 문장이 되면
 * 이 판은 그냥 대조 연습이 된다. 사람 눈으로는 못 지키는 조건이라 함수로 센다.
 * 말투는 판정에 안 쓴다 — 세는 데만 쓴다.
 *
 * @returns {{sure:number, vague:number, sureUngrounded:number, vagueGrounded:number}}
 */
export function toneTrap(lines) {
  const list = lines || [];
  const sure = list.filter(l => l.tone === 'sure');
  const vague = list.filter(l => l.tone === 'vague');
  return {
    sure: sure.length,
    vague: vague.length,
    sureUngrounded: sure.filter(l => !l.src).length,
    vagueGrounded: vague.filter(l => !!l.src).length
  };
}
