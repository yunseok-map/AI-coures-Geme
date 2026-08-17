// 진행도 저장. localStorage 키 하나만 쓴다.
// 수집·전송·로그인 없음. 이 키 외에 아무것도 저장하지 않는다.

const KEY = 'ai-course-v1';
const VERSION = 1;

const RANKS = [
  { id: 'viewer',   name: '관람객' },
  { id: 'prompter', name: '프롬프터' },
  { id: 'context',  name: '컨텍스트 설계자' },
  { id: 'harness',  name: '하네스 엔지니어' }
];

function blank() {
  return {
    version: VERSION,
    cleared: {},        // { gameId: { grade, score, at } }
    unlockedTerms: [],
    lastNode: null,
    settings: {}
  };
}

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const parsed = JSON.parse(raw);
    // 버전이 다르면 조용히 초기화한다. 마이그레이션 코드를 만들지 않는다.
    if (!parsed || parsed.version !== VERSION) return blank();
    return Object.assign(blank(), parsed);
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서도 게임은 돌아야 한다.
    return blank();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 저장 실패는 조용히 넘긴다 — 플레이 자체를 막지 않는다.
  }
}

export const state = {
  get all() { return data; },

  /** 통과했는가. 반려는 "해봤다"일 뿐 완료가 아니다 — 진행도·랭크에 넣지 않는다. */
  isCleared(gameId) {
    const r = data.cleared[gameId];
    return Boolean(r) && r.grade !== 'fail';
  },

  /** 등급과 무관하게 한 번이라도 해봤는가 */
  isTried(gameId) {
    return Boolean(data.cleared[gameId]);
  },

  resultOf(gameId) {
    return data.cleared[gameId] || null;
  },

  /** 미니게임 결과를 기록한다. 이전보다 나쁜 점수로는 덮어쓰지 않는다. */
  record(gameId, result) {
    const prev = data.cleared[gameId];
    const better = !prev || result.score > prev.score;
    if (better) {
      data.cleared[gameId] = {
        grade: result.grade,
        score: result.score,
        at: today()
      };
    }
    for (const term of result.unlocked || []) {
      if (!data.unlockedTerms.includes(term)) data.unlockedTerms.push(term);
    }
    data.lastNode = gameId;
    save();
  },

  hasTerm(term) {
    return data.unlockedTerms.includes(term);
  },

  /**
   * 도감에서 펼쳐 읽은 용어도 수집으로 친다.
   * 게임으로만 모으면 절반쯤은 영영 못 모으는 칸으로 남는다 —
   * 도감을 실제로 읽게 만드는 것도 이 교육의 목적이다.
   */
  unlockTerm(term) {
    if (!term || data.unlockedTerms.includes(term)) return false;
    data.unlockedTerms.push(term);
    save();
    return true;
  },

  get unlockedCount() { return data.unlockedTerms.length; },

  /**
   * 환경 설정(효과음 켜기 등). 저장 키를 새로 만들지 않고 같은 칸 안에 넣는다 —
   * "localStorage 키 하나만 쓴다"는 약속이 깨지면 '처음부터'가 전부 지우지 못한다.
   */
  setting(key, fallback = null) {
    const v = data.settings ? data.settings[key] : undefined;
    return v === undefined ? fallback : v;
  },

  setSetting(key, value) {
    if (!data.settings) data.settings = {};
    data.settings[key] = value;
    save();
  },

  /** 필수 코스 진행도. 코스맵과 상단바가 같은 값을 쓴다. */
  progress(games) {
    const required = games.filter(g => g.required);
    const done = required.filter(g => this.isCleared(g.id)).length;
    return { done, total: required.length };
  },

  /** 랭크는 클리어한 챕터로 결정된다. GAME_SPEC.md §4 */
  rank(games) {
    const clearedIn = (ch) => games
      .filter(g => g.chapter === ch && g.required)
      .every(g => this.isCleared(g.id));

    const requiredDone = games.filter(g => g.required && this.isCleared(g.id)).length;
    const requiredAll = games.filter(g => g.required).length;
    const optionalDone = games.filter(g => !g.required && this.isCleared(g.id)).length;

    if (requiredDone === requiredAll && optionalDone >= 3) return RANKS[3];
    if (clearedIn(2)) return RANKS[2];
    if (clearedIn(1)) return RANKS[1];
    return RANKS[0];
  },

  reset() {
    data = blank();
    try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
  }
};

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
