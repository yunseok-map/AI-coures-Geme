// 한국어 조사 처리. 화면에 "채팅다", "프로젝트이다" 같은 문장이 나오면 안 된다.
//
// 규칙: 한글 음절은 유니코드로 받침 유무를 계산한다.
//       영문·숫자는 읽는 소리를 알아야 정확한데 게임에 나오는 것이 한정적이라
//       예외 표만 두고 나머지는 받침 없음으로 본다. (Cowork→코워크, MCP→엠씨피 …)
//
// 새 콘텐츠를 넣을 때 영문 이름이 받침으로 끝나면(예: Gemini→제미나이 X, Gmail→지메일 O)
// 아래 EXCEPTIONS 에 한 줄 추가한다.

const HANGUL_START = 0xAC00;
const HANGUL_END = 0xD7A3;

/** 읽었을 때 받침으로 끝나는 영문 이름들 */
const EXCEPTIONS = {
  'gmail': true,     // 지메일
  'excel': true,     // 엑셀
  'slack': true,     // 슬랙
  'hook': true,      // 훅
  'skill': true      // 스킬
};

/** 마지막 글자에 받침이 있는가 */
export function hasBatchim(word) {
  const s = String(word || '').trim();
  if (!s) return false;

  const key = s.toLowerCase().split(/\s+/).pop();
  if (key in EXCEPTIONS) return EXCEPTIONS[key];

  const code = s.charCodeAt(s.length - 1);
  if (code >= HANGUL_START && code <= HANGUL_END) {
    return (code - HANGUL_START) % 28 !== 0;
  }
  return false;   // 영문·숫자·기호는 받침 없음으로 본다
}

/** 은/는 */
export function eunNeun(word) { return word + (hasBatchim(word) ? '은' : '는'); }

/** 이/가 */
export function iGa(word) { return word + (hasBatchim(word) ? '이' : '가'); }

/** 을/를 */
export function eulReul(word) { return word + (hasBatchim(word) ? '을' : '를'); }

/** 이다 / 다 — "채팅이다", "프로젝트다" */
export function ida(word) { return word + (hasBatchim(word) ? '이다' : '다'); }

/** 으로/로 */
export function euro(word) {
  const s = String(word || '').trim();
  const code = s.charCodeAt(s.length - 1);
  // ㄹ 받침은 '로'를 쓴다 (스킬로, 서울로)
  if (code >= HANGUL_START && code <= HANGUL_END && (code - HANGUL_START) % 28 === 8) {
    return s + '로';
  }
  return s + (hasBatchim(s) ? '으로' : '로');
}
