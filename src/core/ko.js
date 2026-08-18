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

/**
 * 조사를 고를 때 실제로 읽는 부분만 남긴다.
 *
 * 통 이름이 "모델 (엔진)" 처럼 괄호로 끝나는 경우가 있다. 마지막 글자를 ')' 로 보면
 * 받침이 없다고 판단해서 "모델 (엔진)로 보냈다"가 나온다 — 읽을 때는 '진' 으로
 * 끝나므로 "엔진으로" 가 맞다. 그래서 끝의 닫는 기호·마침표를 떼고 본다.
 */
function readable(word) {
  // 이 게임 문구에 실제로 나오는 끝 기호만 본다. 여기에 글자를 늘리면 글꼴 조각에도
  // 그 글자가 따라 들어간다(_tests/test-font.mjs 가 알려 준다) — 쓰지 않는 기호는 넣지 않는다.
  return String(word || '').trim().replace(/[)\]}>”’'".,!?·]+$/, '').trim();
}

/** 마지막 글자에 받침이 있는가 */
export function hasBatchim(word) {
  const s = readable(word);
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

/**
 * 을/를 조사만 돌려준다 — `euroJosa` 와 같은 이유다.
 *
 * [지금 할 일] 줄이 버튼 이름을 대괄호로 불러서(`[출고]를 누른다`) 낱말과 조사를
 * 이어 붙일 수 없다. 그 자리에 조사를 박아 두면 그 판에서만 맞고 다음 판에서 틀린다 —
 * 실제로 `[이 구성으로 처리한다]을`, `[이 지침서로 일 시키기]을` 이 화면에 나갔다.
 */
export function eulReulJosa(word) { return hasBatchim(word) ? '을' : '를'; }

/** 이다 / 다 — "채팅이다", "프로젝트다" */
export function ida(word) { return word + (hasBatchim(word) ? '이다' : '다'); }

/**
 * 으로/로 조사만 돌려준다.
 *
 * 앞말이 `<b>…</b>` 안에 들어가 있으면 낱말과 조사를 이어 붙일 수 없다.
 * 그때는 이 함수로 조사만 받아서 태그 뒤에 적는다.
 */
export function euroJosa(word) {
  const s = readable(word);
  const code = s.charCodeAt(s.length - 1);
  // ㄹ 받침은 '로'를 쓴다 (스킬로, 서울로)
  if (code >= HANGUL_START && code <= HANGUL_END && (code - HANGUL_START) % 28 === 8) return '로';
  return hasBatchim(s) ? '으로' : '로';
}

/** 으로/로 */
export function euro(word) {
  return String(word || '').trim() + euroJosa(word);
}
