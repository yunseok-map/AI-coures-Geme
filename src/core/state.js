// 진행도 저장. 수집·전송·로그인 없음. localStorage 밖으로 아무것도 나가지 않는다.
//
// 키는 **지금 학습자 한 명당 하나**다 (core/who.js). 혼자 쓰면 예전과 똑같이
// 'ai-course-v1' 하나뿐이고, 공용 PC 에서 사람을 나눌 때만 칸이 늘어난다.
// 키를 모듈 로드 시점에 한 번만 읽는 이유: 사람을 바꾸면 화면을 새로고침한다.
// 그래야 이미 그려진 화면에 앞사람 숫자가 섞여 남지 않는다.

import { who } from './who.js';

const KEY = who.key();
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

    // 용어에는 두 가지 상태가 있다.
    //
    //   unlockedTerms  읽음 — 도감에서 펼쳐 본 것. 게임에서 딴 것도 여기 포함된다.
    //   earnedTerms    획득 — 게임에서 실제로 겪고 딴 것.
    //
    // 왜 나누나: 도감은 교육이 끝난 뒤에도 사전으로 열려야 해서 열람을 막을 수 없다.
    // 그런데 펼치면 곧 수집이라, 68개를 몇 분간 탭질로 다 채울 수 있었다 —
    // 그러면 모을 이유가 없어진다. 채울 판(획득)을 따로 두면
    // 열람 자유를 깨지 않고도 수집에 값이 생긴다.
    unlockedTerms: [],
    earnedTerms: [],

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
    // blank() 위에 덮으므로 **필드를 새로 추가해도 옛 저장이 그대로 열린다.**
    // 그래서 earnedTerms 를 넣으면서 VERSION 을 올리지 않았다 —
    // 올리면 이미 진행한 사람들의 기록이 조용히 날아간다.
    const d = Object.assign(blank(), parsed);
    // 옛 저장에는 earnedTerms 가 없다. 그때 읽음을 획득으로 옮기지 않는다 —
    // 실제로 게임에서 딴 게 아니라 도감을 열어 본 것일 수도 있고,
    // 없던 기록을 만들어 주는 쪽이 더 나쁘다. 빈 칸에서 시작한다.
    if (!Array.isArray(d.earnedTerms)) d.earnedTerms = [];
    if (!Array.isArray(d.unlockedTerms)) d.unlockedTerms = [];
    return d;
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

  /**
   * 미니게임 결과를 기록한다. 이전보다 나쁜 점수로는 덮어쓰지 않는다.
   *
   * **이번에 처음 딴 용어 목록을 돌려준다.** 해설 패널이 "새로 모았다"와
   * "이미 있던 것"을 구분해서 보여주려면 이 정보가 필요한데,
   * 패널은 record 다음에 그려지므로 그때는 이미 전부 획득 상태다.
   * 호출부가 순서를 신경 쓰지 않게 여기서 알려 준다.
   */
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
    // 게임에서 딴 것은 획득이다. 읽음에도 함께 넣는다 — 획득했으면 당연히 읽은 것이다.
    const fresh = [];
    for (const term of result.unlocked || []) {
      if (!data.unlockedTerms.includes(term)) data.unlockedTerms.push(term);
      if (!data.earnedTerms.includes(term)) { data.earnedTerms.push(term); fresh.push(term); }
    }
    data.lastNode = gameId;
    save();
    return fresh;
  },

  hasTerm(term) {
    return data.unlockedTerms.includes(term);
  },

  /** 게임에서 직접 딴 것인가. 도감을 펼쳐 읽은 것은 여기 해당하지 않는다. */
  hasEarned(term) {
    return data.earnedTerms.includes(term);
  },

  get earnedCount() { return data.earnedTerms.length; },

  /**
   * 어떤 판을 깨면 어떤 용어가 들어오는지. 도감이 "이건 어디서 따나"를 보여줄 때 쓴다.
   * 목록은 games/index.js 가 아니라 각 판 파일의 concept 에 있으므로 호출부가 넘겨 준다.
   * @param {Array<{id:string, concept:string[]}>} games
   * @returns {Map<string, string[]>} 용어 → 그 용어를 주는 게임 id 목록
   */
  earnSources(games) {
    const map = new Map();
    for (const g of games) {
      for (const term of g.concept || []) {
        if (!map.has(term)) map.set(term, []);
        map.get(term).push(g.id);
      }
    }
    return map;
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
   * 환경 설정(효과음 켜기 등). 저장 키를 새로 만들지 않고 이 사람 칸 안에 넣는다 —
   * 바깥에 따로 두면 '처음부터'가 전부 지우지 못하고, 공용 PC 에서
   * 앞사람이 켜 둔 효과음이 다음 사람에게 그대로 넘어간다.
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

  /** 지금 사람만 처음부터. 같은 브라우저의 다른 사람 기록은 건드리지 않는다. */
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
