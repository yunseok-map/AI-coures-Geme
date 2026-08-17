// 공통 셸 — 용어 도감.
// 게임을 안 해도 사전처럼 열람할 수 있다 (프롬프트 §3).
// 해금은 "수집했다"는 표시일 뿐 열람을 막지 않는다 — 교육 후 레퍼런스로 계속 쓰이게 하려는 것.

import { terms, chapterNames, CHECKED_AT } from '../data/terms.js';
import { state } from '../core/state.js';
import { enter, cardIn, press } from '../core/motion.js';
import { go } from '../core/router.js';

export function renderCodex(root, query = '') {
  root.innerHTML = '';

  const head = document.createElement('div');
  head.innerHTML =
    `<h1 class="stage__title">용어 도감</h1>` +
    `<p class="stage__sub">${terms.length}개 · 게임을 안 해도 전부 볼 수 있다. ` +
    `펼쳐 읽으면 ✓ 수집으로 바뀐다. 내용 확인 시점 ${CHECKED_AT}.</p>`;
  root.append(head);

  // 두 도감 사이 이동
  const tabs = document.createElement('nav');
  tabs.className = 'tabs';
  const t1 = tab('용어 도감', true, () => {});
  const t2 = tab('AI 도구 도감', false, () => go('/tools'));
  tabs.append(t1, t2);
  root.append(tabs);

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
  search.addEventListener('input', () => draw(search.value.trim()));

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

    const byChapter = new Map();
    for (const t of hit) {
      if (!byChapter.has(t.chapter)) byChapter.set(t.chapter, []);
      byChapter.get(t.chapter).push(t);
    }

    const cards = [];
    for (const [ch, group] of [...byChapter].sort((a, b) => a[0] - b[0])) {
      const sec = document.createElement('section');
      sec.className = 'codex__group';
      const h = document.createElement('div');
      h.className = 'codex__groupname';
      h.textContent = `${ch === 9 ? '번외' : '챕터 ' + ch} — ${chapterNames[ch] || ''} (${group.length})`;
      sec.append(h);
      for (const t of group) {
        const card = termCard(t, key && group.length <= 3);
        sec.append(card);
        cards.push(card);
      }
      list.append(sec);
    }
    enter(cards.slice(0, 12), { each: 20 });
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

function termCard(t, open) {
  const got = state.hasTerm(t.term);

  const wrap = document.createElement('div');
  wrap.className = 'term';

  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'term__head';
  head.setAttribute('aria-expanded', String(Boolean(open)));
  head.innerHTML =
    `<span class="term__name">${esc(t.term)}</span>` +
    (t.en ? `<span class="term__en">${esc(t.en)}</span>` : '') +
    (got ? `<span class="term__got">✓ 수집</span>` : `<span class="term__lock">미수집</span>`);

  const body = document.createElement('div');
  body.className = 'term__body';
  body.hidden = !open;
  body.innerHTML =
    row('한 줄 비유', t.analogy) +
    row('설명', t.explain) +
    row('실무 예시', t.example) +
    `<div class="term__row term__myth">` +
      `<span class="term__key">자주 하는 오해</span>${esc(t.myth)}</div>` +
    // 출처가 없는 용어가 있다. 공식 정의가 존재하지 않는 말에 억지로 링크를 붙이는 대신
    // "이건 이 교육자료의 정리"라고 밝힌다. 그게 챕터 4에서 가르치는 태도다.
    (t.source
      ? `<div class="term__row term__src"><span class="term__key">출처 (확인 ${esc(CHECKED_AT)})</span>` +
        `<a href="${esc(t.source)}" target="_blank" rel="noopener noreferrer">${esc(shortUrl(t.source))}</a></div>`
      : `<div class="term__row term__src"><span class="term__key">출처</span>` +
        `공식 정의가 있는 용어가 아니다. 이 교육자료가 정리한 표현이다.</div>`);

  head.addEventListener('click', () => {
    const willOpen = body.hidden;
    body.hidden = !willOpen;
    head.setAttribute('aria-expanded', String(willOpen));
    if (!willOpen) return;
    cardIn(body);
    // 펼쳐 읽으면 수집된다
    if (state.unlockTerm(t.term)) {
      const badge = head.querySelector('.term__lock');
      if (badge) {
        badge.className = 'term__got';
        badge.textContent = '✓ 수집';
        press(badge);
      }
    }
  });

  wrap.append(head, body);
  return wrap;
}

function row(key, val) {
  return `<div class="term__row"><span class="term__key">${esc(key)}</span>${esc(val)}</div>`;
}

function shortUrl(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); }
  catch { return u; }
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
