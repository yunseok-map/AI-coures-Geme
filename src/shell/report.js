// 공통 셸 — 결과 카드.
// 마지막에 획득 용어 수와 성향을 보여 준다. 캡처해서 공유하기 좋은 한 장짜리.
// (프롬프트 §3 — 결과 카드)

import { state } from '../core/state.js';
import { manifest } from '../games/index.js';
import { terms } from '../data/terms.js';
import { countUp, enter } from '../core/motion.js';
import { go } from '../core/router.js';

/** 성향 — 어느 챕터를 잘했는지로 정한다. 순위가 아니라 경향이다 */
const TRAITS = [
  { id: 2, name: '도구를 가려 쓰는 사람',
    body: '일마다 맞는 도구가 따로 있다는 걸 안다. “일단 채팅에 물어보기”에서 벗어난 상태다.' },
  { id: 1, name: '자료부터 챙기는 사람',
    body: 'AI에게 무엇을 들려 보낼지가 결과를 만든다는 걸 안다. 근거를 먼저 확인하는 쪽이다.' },
  { id: 3, name: '흐름을 설계하는 사람',
    body: '혼자 다 하는 대신 나누고 합치는 구조를 짤 줄 안다. 위임의 비용도 함께 본다.' },
  { id: 4, name: '사고를 먼저 막는 사람',
    body: '되돌릴 수 없는 지점이 어디인지 먼저 본다. 지시로 부탁하는 대신 구조로 막는 쪽이다.' }
];

export function renderReport(root) {
  root.innerHTML = '';

  const cleared = manifest.filter(m => state.isCleared(m.id));
  const req = manifest.filter(m => m.required);
  const reqDone = req.filter(m => state.isCleared(m.id)).length;
  const rank = state.rank(manifest);
  const trait = pickTrait();

  root.innerHTML =
    `<h1 class="stage__title">결과 카드</h1>` +
    `<p class="stage__sub">화면을 캡처해서 공유해도 된다. 개인정보는 아무것도 들어 있지 않다.</p>`;

  const card = document.createElement('section');
  card.className = 'report';
  card.innerHTML =
    `<div class="report__head">` +
      `<span class="report__rank">${esc(rank.name)}</span>` +
      `<span class="report__date">AI 연수원 · ${today()}</span>` +
    `</div>` +
    `<div class="report__grid">` +
      cell('t-node', `${cleared.length}`, `깬 코스 (전 ${manifest.length})`) +
      cell('t-req', `${reqDone}`, `필수 (전 ${req.length})`) +
      cell('t-term', `${state.unlockedCount}`, `모은 용어 (전 ${terms.length})`) +
    `</div>` +
    `<div class="report__trait"><b>${esc(trait.name)}</b><br>${esc(trait.body)}</div>`;
  root.append(card);

  // 숫자가 올라간다
  countUp(card.querySelector('#t-node'), cleared.length);
  countUp(card.querySelector('#t-req'), reqDone);
  countUp(card.querySelector('#t-term'), state.unlockedCount);

  const foot = document.createElement('div');
  foot.className = 'course__foot';
  foot.append(
    btn('용어 도감 열기', () => go('/codex')),
    btn('AI 도구 도감 열기', () => go('/tools')),
    btn('코스맵으로', () => go('/'), true)
  );
  root.append(foot);
  enter([card, foot], { each: 60 });

  // 남은 것 안내
  const left = manifest.filter(m => !state.isCleared(m.id));
  if (left.length) {
    const p = document.createElement('p');
    p.className = 'stage__sub';
    p.style.marginTop = 'var(--sp-4)';
    p.textContent = `아직 안 해본 것 ${left.length}개: ` +
      left.slice(0, 5).map(m => `${m.no}. ${m.title}`).join(' · ') +
      (left.length > 5 ? ' …' : '');
    root.append(p);
  }
}

function pickTrait() {
  let best = TRAITS[0], bestScore = -1;
  for (const t of TRAITS) {
    const games = manifest.filter(m => m.chapter === t.id);
    if (!games.length) continue;
    const score = games.reduce((n, m) => {
      const r = state.resultOf(m.id);
      return n + (r ? (r.grade === 'pass' ? 2 : 1) : 0);
    }, 0) / games.length;
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return bestScore <= 0
    ? { name: '이제 시작하는 사람', body: '아직 코스를 시작하지 않았다. 챕터 1부터 한 판 해보라.' }
    : best;
}

function cell(id, num, cap) {
  return `<div class="report__cell">` +
    `<span class="report__num" id="${id}">0</span>` +
    `<span class="report__cap">${esc(cap)}</span></div>`;
}

function btn(label, fn, primary) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = primary ? 'btn-primary' : 'btn-quiet';
  b.textContent = label;
  b.addEventListener('click', fn);
  return b;
}

function today() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
