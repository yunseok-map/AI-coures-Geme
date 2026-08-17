// 그림. 이미지 파일도 아이콘 폰트도 쓰지 않는다 — 인라인 SVG 로 그린다.
// (CLAUDE.md §1-5 외부 요청 0건. 아이콘 라이브러리도 금지다.)
//
// 색을 SVG 안에 박지 않는다. 전부 currentColor 로 두고 색은 CSS 가 정한다.
// 그래야 "색값은 tokens.css 에만 존재한다"(§1-4)가 유지된다.

const BOX = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
            'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';

const PATHS = {
  // --- 안전장치 ---
  /** 샌드박스 — 울타리 친 상자 */
  sandbox: '<path d="M4 8h16v11H4z"/><path d="M4 8l8-4 8 4"/><path d="M9 19v-5h6v5"/>',
  /** 검증 — 읽은 내용을 들여다본다 */
  verify:  '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>',
  /** 훅 — 지나가는 것을 걸어 챈다 */
  hook:    '<path d="M16 4v8a4 4 0 0 1-8 0"/><path d="M5 15l3 3 3-3"/>',
  /** 가드레일 — 못 하게 막는 벽 */
  guard:   '<path d="M12 3l8 3v6c0 4.4-3.3 7.7-8 9-4.7-1.3-8-4.6-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  /** 최소 권한 — 필요한 만큼만 열린 자물쇠 */
  lock:    '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0"/>',
  /** 사람 확인 */
  human:   '<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',

  // --- 일감·위험 ---
  /** 문서 */
  doc:     '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>',
  /** 밖으로 나가는 전송 */
  send:    '<path d="M3 11l18-8-8 18-2.5-7.5z"/>',
  /** 원본에 쓰기 */
  write:   '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14 6l4 4"/>',
  /** 위험 */
  alert:   '<path d="M12 3l9 17H3z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
  /** 에이전트 */
  bot:     '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4v4"/>' +
           '<circle cx="9" cy="13" r="1.1"/><circle cx="15" cy="13" r="1.1"/>',
  /** 우리 팀 — 지켜야 하는 곳 */
  base:    '<path d="M3 20h18"/><path d="M5 20V9l7-5 7 5v11"/><path d="M10 20v-6h4v6"/>',
  /** 통과 */
  check:   '<path d="M4 12.5l5 5L20 6.5"/>',
  /** 막힘 */
  cross:   '<path d="M6 6l12 12M18 6L6 18"/>'
};

/** 아이콘 하나. 크기는 CSS(width/height)로 정한다. */
export function icon(name, cls = '') {
  const d = PATHS[name] || PATHS.doc;
  return `<svg class="ico ${cls}" ${BOX} aria-hidden="true">${d}</svg>`;
}

export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(PATHS, name);
}

/**
 * 디펜스 판의 배경 — 위에서 아래로 내려오는 길.
 * 이미지 없이 SVG 하나로 깔고, 색은 CSS 변수를 쓴다.
 * preserveAspectRatio="none" 으로 두어 판 높이가 바뀌어도 늘어나며 채운다.
 */
export function roadArt() {
  return `<svg class="ax__art" viewBox="0 0 100 200" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="roadFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="currentColor" stop-opacity=".16"/>
        <stop offset="1" stop-color="currentColor" stop-opacity=".05"/>
      </linearGradient>
    </defs>
    <path d="M30 0h40v200H30z" fill="url(#roadFade)"/>
    <path d="M30 0v200M70 0v200" stroke="currentColor" stroke-opacity=".28" stroke-width="1"/>
    <path d="M50 4v192" stroke="currentColor" stroke-opacity=".22"
          stroke-width="1.5" stroke-dasharray="7 9"/>
  </svg>`;
}
