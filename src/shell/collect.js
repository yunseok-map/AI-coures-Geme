// 공통 셸 — 수집 현황 계산과 표시.
//
// 왜 codex.js 에서 떼어 냈나: 도감 렌더가 이미 길고, 이 계산은 도감 말고
// 코스맵·결과 카드도 쓴다. 세 화면이 각자 세면 숫자가 서로 어긋난다.
// **획득 수는 이 파일에서만 센다.**
//
// 용어에는 두 가지 상태가 있다 (core/state.js 참고):
//   획득 — 게임에서 실제로 겪고 딴 것. 이게 채울 판이다.
//   읽음 — 도감에서 펼쳐 본 것. 열람은 막지 않으므로 저절로 는다.

// motion.js 를 부러 안 쓴다. 이 파일은 **세고 markup 을 만드는 일**만 한다 —
// 막대를 채우는 것은 부른 쪽이 한다. 그래야 브라우저 없이 Node 로 집계를 검사할 수 있다
// (motion.js 는 불러오는 순간 window.matchMedia 를 만진다).
import { terms, chapterNames } from '../data/terms.js';
import { state } from '../core/state.js';
import { manifest } from '../games/index.js';
import { esc } from '../core/text.js';

/** 챕터 번호 → 그 챕터 용어들. 목록 순서를 그대로 지킨다. */
export function byChapter(list = terms) {
  const map = new Map();
  for (const t of list) {
    if (!map.has(t.chapter)) map.set(t.chapter, []);
    map.get(t.chapter).push(t);
  }
  return map;
}

/** 번외(9)는 "챕터 9"가 아니다 — 이름만 쓴다. */
export function chapterLabel(ch) {
  return ch === 9 ? '번외' : `챕터 ${ch} — ${chapterNames[ch] || ''}`;
}

/**
 * 전체 현황. 세 화면이 같은 값을 쓰게 하려고 여기서만 센다.
 * @returns {{earned:number, read:number, total:number, pct:number, chapters:Array}}
 */
export function status() {
  const all = byChapter();
  const chapters = [...all].sort((a, b) => a[0] - b[0]).map(([ch, group]) => {
    const earned = group.filter(t => state.hasEarned(t.term)).length;
    const read = group.filter(t => state.hasTerm(t.term)).length;
    return {
      ch, label: chapterLabel(ch), total: group.length, earned, read,
      done: earned === group.length,
      pct: group.length ? Math.round((earned / group.length) * 100) : 0
    };
  });

  const earned = state.earnedCount;
  const total = terms.length;
  return {
    earned, read: state.unlockedCount, total,
    pct: total ? Math.round((earned / total) * 100) : 0,
    chapters
  };
}

/**
 * 어떤 판을 깨면 그 용어가 들어오는지.
 *
 * 판 파일의 `concept` 에 들어 있고 그 파일들은 지연 로드된다 —
 * 도감을 열자고 17판을 전부 불러오면 첫 화면이 느려지므로 **부를 때만** 읽는다.
 * 실패해도 도감은 그대로 동작해야 하니 조용히 빈 지도를 돌려준다.
 *
 * @returns {Promise<Map<string, {id:string, no:number, title:string}>>}
 */
export async function sourceMap() {
  const out = new Map();
  await Promise.all(manifest.map(async (m) => {
    if (!m.ready) return;
    try {
      const mod = await import(`../games/${String(m.no).padStart(2, '0')}-${m.id}.js`);
      for (const term of mod.default?.concept || []) {
        // 여러 판이 같은 용어를 줄 수 있다. 먼저 나오는(번호가 앞선) 판을 안내한다 —
        // 코스 순서대로 하는 사람에게 가장 가까운 판이다.
        if (!out.has(term)) out.set(term, { id: m.id, no: m.no, title: m.title });
      }
    } catch { /* 그 판을 못 읽어도 도감은 열려야 한다 */ }
  }));
  return out;
}

/** 도감 맨 위 "획득 6 / 68" 요약. 막대는 그린 뒤에 채운다. */
export function summaryBox(s) {
  const box = document.createElement('div');
  box.className = 'collect';
  box.innerHTML =
    `<div class="collect__top">` +
      `<span class="collect__n"><b>${s.earned}</b> / ${s.total}</span>` +
      `<span class="collect__cap">게임에서 직접 딴 용어</span>` +
    `</div>` +
    `<div class="collect__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"` +
    ` aria-valuenow="${s.pct}" aria-label="용어 획득 진행도">` +
      `<div class="collect__fill" style="width:0%"></div>` +
    `</div>` +
    // 읽음은 따로 적는다. 획득과 섞으면 숫자가 저절로 올라가서 모으는 느낌이 사라진다.
    `<p class="collect__sub">펼쳐 읽은 것까지 하면 ${s.read}개. ` +
    `도감은 게임을 안 해도 전부 볼 수 있다.</p>`;
  return box;
}

/** 챕터 머리글 — 이름 · 획득 수 · 막대. "몇 개 남았다"가 손에 잡히게. */
export function chapterHead(info, shownCount) {
  const h = document.createElement('div');
  h.className = 'codex__groupname' + (info.done ? ' codex__groupname--done' : '');
  const left = info.total - info.earned;
  h.innerHTML =
    `<div class="grp__line">` +
      `<span class="grp__name">${esc(info.label)}</span>` +
      `<span class="grp__n">${info.earned}/${info.total}` +
      // 검색 중이면 화면에 보이는 수와 챕터 총수가 다르다 — 헷갈리지 않게 밝힌다
      `${shownCount != null && shownCount !== info.total ? ` · ${shownCount}개 보임` : ''}` +
      `</span>` +
    `</div>` +
    // 챕터 막대는 바로 그린다(애니메이션 없음) — 목록에 6개가 동시에 나와서
    // 다 같이 움직이면 산만하다. bar--some 은 fillBar 를 안 거치니 여기서 붙인다.
    `<div class="grp__bar">` +
      `<div class="grp__fill${info.earned > 0 ? ' bar--some' : ''}" style="width:${info.pct}%"></div>` +
    `</div>` +
    `<div class="grp__note">${info.done
      ? '이 챕터는 다 모았다'
      : left === info.total ? '아직 하나도 없다' : `${left}개 남았다`}</div>`;
  return h;
}
