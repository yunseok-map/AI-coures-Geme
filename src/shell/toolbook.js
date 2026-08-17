// 공통 셸 — AI 도구 도감 (번외).
//
// 게임이 아니다. 교육이 끝난 뒤에도 사전처럼 계속 쓰이는 카탈로그다.
// 카테고리가 뼈대이고 도구는 예시다 — 도구 이름은 갈려도 칸은 남게 만들었다.
//
// 상단 경고 배너는 스크롤해도 사라지지 않는다 (프롬프트 §6-B 필수).
// 챕터 4에서 섀도우 AI 를 가르쳐놓고 도감이 미승인 도구 사용을 부추기면 앞뒤가 안 맞는다.

import { categories, BANNER, AGGREGATOR_NOTE, toolCount, CHECKED_AT } from '../data/tools.js';
import { enter } from '../core/motion.js';
import { go } from '../core/router.js';
import { esc, strong } from '../core/text.js';

export function renderToolbook(root, query = '') {
  root.innerHTML = '';

  // ---- 고정 배너 ----
  const banner = document.createElement('aside');
  banner.className = 'banner';
  banner.setAttribute('role', 'note');
  banner.innerHTML =
    `<b>확인하고 쓰세요.</b> ${esc(BANNER)} ` +
    `<a href="#/game/spot-risk">왜 위험한지 보기 →</a>`;
  root.append(banner);

  const head = document.createElement('div');
  head.innerHTML =
    `<h1 class="stage__title">AI 도구 도감</h1>` +
    `<p class="stage__sub">카테고리 ${categories.length}개 · 도구 ${toolCount}개 · ` +
    `내용 확인 시점 ${CHECKED_AT}. 순위는 매기지 않는다 — “이 일에는 이 계열”로만 적었다.</p>`;
  root.append(head);

  // ---- 애그리게이터 설명 ----
  const note = document.createElement('div');
  note.className = 'note-box';
  note.innerHTML =
    `<div class="note-box__cap">${esc(AGGREGATOR_NOTE.cap)}</div>` +
    `<div>${esc(AGGREGATOR_NOTE.body)}</div>`;
  root.append(note);

  const search = document.createElement('input');
  search.className = 'codex__search';
  search.type = 'search';
  search.placeholder = '도구·카테고리 검색 (예: 영상, 로컬, 자동화)';
  search.setAttribute('aria-label', '도구 검색');
  search.value = query;
  root.append(search);

  const list = document.createElement('div');
  list.className = 'catgrid';
  root.append(list);

  draw(query);
  search.addEventListener('input', () => draw(search.value.trim()));

  function draw(q) {
    const key = q.toLowerCase();
    list.innerHTML = '';

    const hits = categories
      .map(c => ({
        cat: c,
        tools: c.tools.filter(t =>
          !key ||
          c.name.toLowerCase().includes(key) ||
          c.use.toLowerCase().includes(key) ||
          t.name.toLowerCase().includes(key) ||
          t.oneLine.toLowerCase().includes(key))
      }))
      .filter(x => x.tools.length);

    if (!hits.length) {
      const e = document.createElement('p');
      e.className = 'empty';
      e.textContent = '해당하는 도구가 없다. 카테고리 이름으로 찾아보라.';
      list.append(e);
      return;
    }

    const nodes = [];
    for (const { cat, tools } of hits) {
      const open = Boolean(key);
      nodes.push(catCard(cat, tools, open));
    }
    list.append(...nodes);
    enter(nodes, { each: 30 });
  }
}

function catCard(cat, tools, open) {
  const wrap = document.createElement('section');
  wrap.className = 'cat';

  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'cat__head';
  head.setAttribute('aria-expanded', String(open));
  head.innerHTML =
    `<span><span class="cat__name">${esc(cat.name)}</span>` +
    `<span class="cat__use">${esc(cat.use)}</span></span>` +
    `<span class="cat__count">${tools.length}</span>`;

  const body = document.createElement('div');
  body.className = 'cat__body';
  body.hidden = !open;
  for (const t of tools) body.append(toolCard(t));

  head.addEventListener('click', () => {
    body.hidden = !body.hidden;
    head.setAttribute('aria-expanded', String(!body.hidden));
    if (!body.hidden) enter(body.querySelectorAll('.tool'), { each: 30, from: 8 });
  });

  wrap.append(head, body);
  return wrap;
}

function toolCard(t) {
  const d = document.createElement('article');
  d.className = 'tool';

  const good = (t.goodAt || []).map(x => `<li><span>${strong(x)}</span></li>`).join('');
  // watchOut 은 반드시 채운다 — 장점만 나열하면 그 자체가 워크슬롭이다 (프롬프트 §6-B)
  const watch = (t.watchOut || []).map(x => `<li><span>${strong(x)}</span></li>`).join('');

  d.innerHTML =
    `<div class="tool__head">` +
      `<span class="tool__name">${esc(t.name)}</span>` +
      `<span class="tool__price">${esc(t.pricing || '확인 필요')}</span>` +
      (t.note === 'aggregator' ? `<span class="tool__price">애그리게이터</span>` : '') +
    `</div>` +
    `<p class="tool__one">${strong(t.oneLine)}</p>` +
    (good  ? `<ul class="tool__list tool__good">${good}</ul>` : '') +
    (watch ? `<ul class="tool__list tool__watch">${watch}</ul>` : '') +
    `<div class="tool__meta">` +
      (t.useWhen ? `<span>쓸 때: ${esc(t.useWhen)}</span>` : '') +
      `<a href="${esc(t.official)}" target="_blank" rel="noopener noreferrer">공식 링크</a>` +
      `<span>확인 ${esc(CHECKED_AT)}</span>` +
    `</div>`;

  return d;
}

