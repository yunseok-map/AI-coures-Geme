// 화면에 글을 넣을 때 쓰는 두 가지.
//
// 콘텐츠 파일(games/, data/)에서는 강조를 `**이렇게**` 로 적는다.
// 그대로 innerHTML 에 넣으면 별표가 그대로 보이므로 여기서 <b> 로 바꾼다.
// HTML 을 먼저 이스케이프한 뒤에 바꾸므로 콘텐츠가 태그를 주입할 수 없다.

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** `**강조**` → <b>강조</b>. 이스케이프가 먼저다. */
export function strong(s) {
  return esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}

/**
 * 강조 표시만 떼고 글자만 남긴다. 낭독 영역(`#live`)에 쓴다.
 *
 * 낭독 영역은 textContent 라서 별표가 그대로 남는다. 눈으로는 안 보이지만
 * 스크린리더는 "별표별표 CLI 에이전트 별표별표" 로 읽는다 — 실제로 그렇게 되어 있었다.
 * 낭독에 강조 표시는 의미가 없으므로 떼고 넘긴다.
 */
export function plain(s) {
  return String(s == null ? '' : s).replace(/\*\*([^*]+)\*\*/g, '$1');
}
