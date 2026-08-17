// 공통 셸 — 용어 도감.
// 게임을 안 해도 사전처럼 열람할 수 있다 (프롬프트 §3).
// 해금은 "수집했다"는 표시일 뿐 열람을 막지 않는다 — 교육 후 레퍼런스로 계속 쓰이게 하려는 것.

import { terms, CHECKED_AT } from '../data/terms.js';
import { state } from '../core/state.js';
import { enter, cardIn, press, stamp, pulse, fillBar } from '../core/motion.js';
import { go } from '../core/router.js';
import { esc, strong } from '../core/text.js';
import { status, byChapter, summaryBox, chapterHead, sourceMap } from './collect.js';

// 어떤 판에서 그 용어가 나오는지. 한 번 읽어서 들고 있는다 —
// 판 파일 17개를 도감 열 때마다 다시 불러오면 느리다.
let SOURCES = null;

export function renderCodex(root, query = '') {
  root.innerHTML = '';

  const s = status();

  const head = document.createElement('div');
  head.innerHTML =
    `<h1 class="stage__title">용어 도감</h1>` +
    `<p class="stage__sub">${terms.length}개 · 게임을 안 해도 전부 볼 수 있다. ` +
    `펼쳐 읽으면 읽음으로 바뀐다. 내용 확인 시점 ${CHECKED_AT}.</p>`;
  root.append(head);

  // 두 도감 사이 이동
  const tabs = document.createElement('nav');
  tabs.className = 'tabs';
  const t1 = tab('용어 도감', true, () => {});
  const t2 = tab('AI 도구 도감', false, () => go('/tools'));
  tabs.append(t1, t2);
  root.append(tabs);

  // 획득 현황 — 68은 멀어서 목표가 안 된다. 챕터별 "몇 개 남았다"가 손에 잡힌다.
  const sum = summaryBox(s);
  root.append(sum);

  const search = document.createElement('input');
  search.className = 'codex__search';
  search.type = 'search';
  search.placeholder = '용어 검색 (예: 아티팩트, 환각, 훅)';
  search.setAttribute('aria-label', '용어 검색');
  search.value = query;
  root.append(search);

  const list = document.createElement('div');
  root.append(list);

  draw(query);
  // 막대는 붙인 다음에 채운다 — 폭 계산이 그때 맞다
  fillBar(sum.querySelector('.collect__fill'), s.pct);
  search.addEventListener('input', () => draw(search.value.trim()));

  // 어느 판에서 딸 수 있는지는 판 파일을 읽어야 안다. 첫 그림을 막지 않게
  // 뒤늦게 채운다 — 도착하면 미획득 카드에 "어디서 따나" 버튼이 붙는다.
  if (SOURCES) fillSources(list);
  else sourceMap().then(m => { SOURCES = m; fillSources(list); });

  function draw(q) {
    const key = q.toLowerCase();
    const hit = terms.filter(t =>
      !key ||
      t.term.toLowerCase().includes(key) ||
      (t.en || '').toLowerCase().includes(key) ||
      t.analogy.toLowerCase().includes(key) ||
      t.explain.toLowerCase().includes(key));

    list.innerHTML = '';

    if (!hit.length) {
      const e = document.createElement('p');
      e.className = 'empty';
      e.textContent = '해당하는 용어가 없다.';
      list.append(e);
      return;
    }

    // 챕터별 진행도는 검색 결과가 아니라 **챕터 전체**를 기준으로 센다.
    // "훅"을 검색했다고 챕터 2가 1/1 이 되면 안 된다.
    const info = new Map(status().chapters.map(c => [c.ch, c]));
    const groups = byChapter(hit);

    const cards = [];
    const finished = [];
    for (const [ch, group] of [...groups].sort((a, b) => a[0] - b[0])) {
      const sec = document.createElement('section');
      sec.className = 'codex__group';
      const h = chapterHead(info.get(ch), group.length);
      sec.append(h);
      if (info.get(ch).done) finished.push(h);
      for (const t of group) {
        const card = termCard(t, key && group.length <= 3);
        sec.append(card);
        cards.push(card);
      }
      list.append(sec);
    }
    enter(cards.slice(0, 12), { each: 20 });
    // 다 모은 챕터에 도장을 찍는다. 68 전체는 멀지만 챕터 하나는 실제로 끝낼 수 있다 —
    // 이 게임에서 "완성했다"를 맛볼 수 있는 거의 유일한 단위다.
    for (const h of finished) { stamp(h.querySelector('.grp__n')); pulse(h.querySelector('.grp__note'), 1); }
    if (SOURCES) fillSources(list);
  }
}

/**
 * 미획득 카드에 "어디서 따나" 버튼을 붙인다.
 *
 * 도감을 읽는 것만으로도 용어는 채워지지만, 그건 읽음이고 획득이 아니다.
 * 채우려면 그 판을 해야 하니 **가는 길을 여기서 알려 준다** —
 * 안 그러면 미획득 칸을 보고도 무엇을 해야 할지 모른다.
 */
function fillSources(list) {
  for (const wrap of list.querySelectorAll('.term[data-term]')) {
    if (wrap.dataset.sourced) continue;
    const name = wrap.dataset.term;
    if (state.hasEarned(name)) { wrap.dataset.sourced = '1'; continue; }
    const from = SOURCES.get(name);
    const slot = wrap.querySelector('.term__where');
    if (!slot) continue;
    wrap.dataset.sourced = '1';
    if (!from) {
      // 68개 중 22개는 어느 판에서도 주지 않는다. 그건 결함이 아니라 설계다 —
      // 도감을 읽게 만드는 것도 이 교육의 목적이라 솔직하게 밝힌다.
      slot.innerHTML = `<span class="term__whereno">게임으로는 나오지 않는 용어다 — 읽어서 익히는 칸</span>`;
      return;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'term__go';
    // 조사는 붙여 쓴다 — "가방 싸기 에서"가 아니라 "가방 싸기에서"
    b.textContent = `${from.no}. ${from.title}에서 딸 수 있다`;
    b.addEventListener('click', () => go(`/game/${from.id}`));
    slot.append(b);
  }
}

function tab(label, on, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tab' + (on ? ' tab--on' : '');
  b.textContent = label;
  if (on) b.setAttribute('aria-current', 'page');
  b.addEventListener('click', fn);
  return b;
}

/** 출처 한 줄. 문자열 하나든 배열이든 받는다. */
function srcRow(source) {
  const list = (Array.isArray(source) ? source : [source]).filter(Boolean);
  if (!list.length) {
    return `<div class="term__row term__src"><span class="term__key">출처</span>` +
           `공식 정의가 있는 용어가 아니다. 이 교육자료가 정리한 표현이다.</div>`;
  }
  const links = list
    .map(u => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(shortUrl(u))}</a>`)
    .join('<span class="term__srcsep"> · </span>');
  return `<div class="term__row term__src">` +
         `<span class="term__key">출처 (확인 ${esc(CHECKED_AT)})</span>${links}</div>`;
}

/** 카드 상태는 셋이다. 세 개가 한눈에 구분돼야 컬렉션판이 된다. */
function stateOf(t) {
  if (state.hasEarned(t.term)) return { cls: 'earned', badge: '★ 획득', key: 'term__got' };
  if (state.hasTerm(t.term))   return { cls: 'read',   badge: '읽음',   key: 'term__read' };
  return { cls: 'new', badge: '미열람', key: 'term__lock' };
}

function termCard(t, open) {
  const st = stateOf(t);

  const wrap = document.createElement('div');
  wrap.className = `term term--${st.cls}`;
  wrap.dataset.term = t.term;      // fillSources 가 나중에 찾아온다

  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'term__head';
  head.setAttribute('aria-expanded', String(Boolean(open)));
  head.innerHTML =
    `<span class="term__name">${esc(t.term)}</span>` +
    (t.en ? `<span class="term__en">${esc(t.en)}</span>` : '') +
    `<span class="${st.key}">${st.badge}</span>`;

  const body = document.createElement('div');
  body.className = 'term__body';
  body.hidden = !open;
  body.innerHTML =
    row('한 줄 비유', t.analogy) +
    row('설명', t.explain) +
    row('실무 예시', t.example) +
    `<div class="term__row term__myth">` +
      `<span class="term__key">자주 하는 오해</span>${strong(t.myth)}</div>` +
    // 출처가 없는 용어가 있다. 공식 정의가 존재하지 않는 말에 억지로 링크를 붙이는 대신
    // "이건 이 교육자료의 정리"라고 밝힌다. 그게 챕터 4에서 가르치는 태도다.
    //
    // 한 회사 제품이 아니라 도구의 갈래를 설명하는 용어는 출처가 여러 개다
    // (예: CLI 에이전트 — claude·codex·gemini 공식 문서 3건). 그때 하나만 걸면
    // 나머지 두 회사 설명이 근거 없는 말이 된다. 그래서 배열도 받는다.
    srcRow(t.source) +
    // 아직 못 딴 용어는 여기에 "몇 번 판에서 딸 수 있다"가 붙는다.
    // 판 파일을 읽어야 알 수 있어서 나중에 채운다 (fillSources).
    (st.cls === 'earned' ? '' : `<div class="term__row term__where"></div>`);

  head.addEventListener('click', () => {
    const willOpen = body.hidden;
    body.hidden = !willOpen;
    head.setAttribute('aria-expanded', String(willOpen));
    if (!willOpen) return;
    cardIn(body);
    // 펼쳐 읽으면 **읽음**이 된다. 획득이 아니다 —
    // 획득은 그 판을 실제로 해야 들어온다. 열람은 계속 자유롭게 두고
    // 채울 판만 따로 둔 것이 이 구분의 목적이다.
    if (state.unlockTerm(t.term)) {
      wrap.classList.remove('term--new');
      wrap.classList.add('term--read');
      const badge = head.querySelector('.term__lock');
      if (badge) {
        badge.className = 'term__read';
        badge.textContent = '읽음';
        press(badge);
      }
    }
  });

  wrap.append(head, body);
  return wrap;
}

function row(key, val) {
  // 콘텐츠의 `**강조**` 를 <b> 로 바꿔서 보여 준다 (core/text.js)
  return `<div class="term__row"><span class="term__key">${esc(key)}</span>${strong(val)}</div>`;
}

function shortUrl(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); }
  catch { return u; }
}

