// 학습자 칸 — 한 브라우저를 여러 사람이 쓸 때 진도를 갈라 준다.
//
// 먼저 분명히 해 둘 것: **기기가 다르면 이미 진도가 각자 다르다.**
// 진행도는 localStorage 에 남고 그건 브라우저마다 따로다. 배포가 GitHub Pages
// 라서 서버가 없다는 게 문제가 되지 않는다 — 서버가 있어야 하는 것은
// "다른 기기에서 이어서 하기"이고, 그건 이 교육에 필요하지 않다.
//
// 실제로 깨지는 경우는 하나다: **공용 PC**. 교육장 단말 하나로 여러 명이
// 차례로 하면 두 번째 사람이 앞사람의 "이미 다 깬 화면"을 본다.
// 이어서 하기 카드가 완주를 가리키고, 용어 카운터가 이미 차 있고,
// 도장이 전부 찍혀 있다. 그러면 그 사람은 아무것도 배우지 못한다.
//
// 그래서 서버 대신 저장 칸을 사람 수만큼 나눈다 (규칙 5: 외부 요청 0건).
//
//   ai-course-who        누가 있고 지금 누구인지 — 이 파일이 관리한다
//   ai-course-v1         1번 사람 진행도. **옛 키를 그대로 쓴다**
//   ai-course-v1:2, :3   그 뒤에 추가된 사람
//
// 1번만 키 이름을 안 바꾸는 것이 핵심이다. 이미 진행한 사람의 기록이
// 마이그레이션 코드 없이 그대로 열린다. 그리고 혼자 쓰는 사람은
// 등록부를 만들지도 않는다 — 사람을 나눌 때 처음 생긴다.

const REG = 'ai-course-who';
const BASE = 'ai-course-v1';

/**
 * 이 탭에서 이미 이름을 대고 들어왔는지 — 시작 화면(`shell/enter.js`)이 본다.
 *
 * **sessionStorage 인 것이 핵심이다.** localStorage 에 두면 한 번 들어온 뒤로
 * 영영 안 묻게 되어 공용 PC 에서 다음 사람이 앞사람 진도를 그대로 물려받는다.
 * 탭을 닫으면 사라지므로, 다음 사람이 새로 열면 다시 이름부터 묻는다.
 * 반대로 같은 탭에서 새로고침(사람 바꾸기·처음부터)할 때는 안 묻는다.
 */
const SEEN = 'ai-course-entered';

/** 8명이면 교육장 단말 한 대로 충분하다. 더 늘리면 알약 목록이 화면을 먹는다. */
const MAX = 8;
/** 이름은 알약 하나에 들어가야 한다 */
const NAME_MAX = 12;

function blankReg() {
  return { version: 1, active: 1, list: [{ n: 1, name: '1번' }] };
}

function clean(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}

let reg = loadReg();

function loadReg() {
  try {
    const raw = localStorage.getItem(REG);
    if (!raw) return blankReg();
    const p = JSON.parse(raw);
    if (!p || p.version !== 1 || !Array.isArray(p.list)) return blankReg();
    // 쓰레기가 섞여 있어도 게임은 돌아야 한다. 쓸 수 있는 칸만 남긴다.
    const seen = new Set();
    const list = [];
    for (const s of p.list) {
      if (!s || !Number.isInteger(s.n) || s.n < 1 || seen.has(s.n)) continue;
      seen.add(s.n);
      list.push({ n: s.n, name: clean(s.name) || `${s.n}번` });
    }
    if (!list.length) return blankReg();
    const active = list.some(s => s.n === p.active) ? p.active : list[0].n;
    return { version: 1, active, list };
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서도 게임은 돌아야 한다
    return blankReg();
  }
}

function saveReg() {
  try {
    localStorage.setItem(REG, JSON.stringify(reg));
  } catch {
    // 저장 실패는 조용히 넘긴다 — 플레이 자체를 막지 않는다
  }
}

export const who = {
  /** 알약으로 그릴 목록. 지금 사람에게 active 가 붙는다. */
  get list() {
    return reg.list.map(s => ({ n: s.n, name: s.name, active: s.n === reg.active }));
  },

  get active() {
    return reg.list.find(s => s.n === reg.active) || reg.list[0];
  },

  /** 사람을 나눠 쓰고 있는가. 혼자면 화면에 알약을 띄우지 않는다. */
  get many() { return reg.list.length > 1; },

  /**
   * 이 브라우저에서 **아직 아무도 한 판도 안 깼는가.**
   *
   * 시작 화면에서 첫 사람의 이름을 어디에 넣을지가 여기서 갈린다.
   *   비어 있으면 → 1번 칸의 **이름만 바꾼다.** 1번은 접미사 없는 옛 키를 쓰므로
   *     새 사람을 만들면 진도 0 짜리 '1번' 이 유령으로 남는다.
   *   이미 누가 깼으면 → 그 사람이 1번이다. 새로 온 사람은 **다음 칸**을 받는다.
   */
  get fresh() {
    try {
      if (localStorage.getItem(REG)) return false;
      return who.done(1) === 0;
    } catch { return true; }
  },

  /** 이 탭에서 이미 이름을 대고 들어왔는가 */
  get entered() {
    try { return sessionStorage.getItem(SEEN) === '1'; } catch { return false; }
  },

  /** 들어왔다고 표시한다. 새로고침해도 시작 화면이 다시 뜨지 않게 한다. */
  enter() {
    try { sessionStorage.setItem(SEEN, '1'); } catch { /* 무시 */ }
  },

  /**
   * 그 사람이 몇 판을 깼는지 — 시작 화면에서 **이름 옆에 붙여 자기를 찾게** 한다.
   * 이름이 비슷한 사람이 여럿이면 이름만으로는 자기 칸을 못 고른다.
   *
   * 왜 여기 있나: 남의 칸을 읽는 일이라 `core/state.js` 가 할 수 없다 —
   * 그쪽은 **지금 사람 것 하나만** 들고 있는 것이 설계다. 키를 아는 것은 이 파일이다.
   * 읽기만 하고 쓰지 않는다.
   */
  done(n) {
    try {
      const raw = localStorage.getItem(who.key(n));
      if (!raw) return 0;
      const p = JSON.parse(raw);
      return p && p.cleared ? Object.keys(p.cleared).length : 0;
    } catch { return 0; }
  },

  /** 이 이름을 이미 쓰고 있는 사람이 있는가 (앞뒤 공백·대소문자 무시) */
  taken(name, except = 0) {
    const k = clean(name).toLowerCase();
    return reg.list.some(s => s.n !== except && s.name.toLowerCase() === k);
  },
  get full() { return reg.list.length >= MAX; },
  get max() { return MAX; },
  get nameMax() { return NAME_MAX; },

  /**
   * 그 사람 진행도의 저장 키.
   *
   * 1번은 접미사 없이 옛 키를 쓴다. 이 한 줄이 "이미 하던 사람의 기록이
   * 그대로 열린다"를 보장한다 — 바꾸지 말 것.
   */
  key(n = reg.active) {
    return n === 1 ? BASE : `${BASE}:${n}`;
  },

  /** 새 사람을 만들고 그 사람으로 넘어간다. 진행도 키는 비어 있으니 처음부터 시작된다. */
  add(name) {
    if (reg.list.length >= MAX) return null;
    const n = Math.max(...reg.list.map(s => s.n)) + 1;
    reg.list.push({ n, name: clean(name) || `${n}번` });
    reg.active = n;
    saveReg();
    return n;
  },

  switchTo(n) {
    if (!reg.list.some(s => s.n === n)) return false;
    reg.active = n;
    saveReg();
    return true;
  },

  rename(n, name) {
    const s = reg.list.find(x => x.n === n);
    if (!s) return false;
    s.name = clean(name) || `${n}번`;
    saveReg();
    return true;
  },

  /**
   * 사람을 지운다 — 그 사람 진행도 키까지 같이 지운다.
   * 이름만 지우고 진행도를 남기면 다음에 같은 번호가 붙는 사람이
   * 남의 기록을 물려받는다.
   * 마지막 한 명은 지울 수 없다 — 0명이 되면 저장할 곳이 사라진다.
   */
  remove(n) {
    if (reg.list.length <= 1) return false;
    const i = reg.list.findIndex(s => s.n === n);
    if (i < 0) return false;
    try { localStorage.removeItem(who.key(n)); } catch { /* 무시 */ }
    reg.list.splice(i, 1);
    if (reg.active === n) reg.active = reg.list[0].n;
    saveReg();
    return true;
  },

  /** 이 브라우저의 기록을 전부 지운다 — 등록부와 모든 사람의 진행도까지. */
  wipe() {
    try {
      for (const s of reg.list) localStorage.removeItem(who.key(s.n));
      localStorage.removeItem(REG);
    } catch { /* 무시 */ }
    try { sessionStorage.removeItem(SEEN); } catch { /* 무시 */ }
    reg = blankReg();
  }
};
