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
