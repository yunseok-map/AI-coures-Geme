// 공통 셸 — 화면 옆에 떠 있는 **날개 달린 도감책.**
//
// 왜 필요한가: 용어는 판을 깨면서 모이는데, 그걸 보려면 상단바의 [도감]을 눌러
// 화면을 통째로 떠나야 했다. 판 중간에 "아까 그 말이 뭐였지" 가 생겨도 나갈 수는
// 없다 — 나가면 판이 리셋된다. 그래서 모으는 재미와 읽는 재미가 끊겨 있었다.
//
// 이제 책이 화면 옆에 떠 있다. 누르면 **그 자리에서** 펼쳐지고, 다시 누르면 접힌다.
// 판은 그대로 뒤에 살아 있다.
//
// 책은 **가만히 있지 않는다.** 날개가 천천히 저어지고, 새 용어를 딸 때마다
// 한 번 크게 퍼덕인다. 모으는 것이 화면에 남는 유일한 자리라서
// 여기서만큼은 움직임이 장식이 아니라 신호다.
//
// 셸 규칙: 여기서 엔진을 import 하지 않는다. 도감 데이터는 shell/collect.js 와
// core/state.js 만 본다.

import { terms } from '../data/terms.js';
import { state } from '../core/state.js';
import { byChapter, chapterLabel } from './collect.js';
import { gsap, isReduced } from '../core/motion.js';
import { esc, strong } from '../core/text.js';

/** 깃털 세 장짜리 날개 한 장. 오른쪽 기준으로 그리고 왼쪽은 SVG 안에서 뒤집는다 —
    CSS transform 으로 뒤집으면 GSAP 이 transform 을 통째로 덮어써서
    날갯짓하는 순간 뒤집힘이 풀린다. */
const WING = 'M4 36 C6 20 18 6 44 3 C40 12 34 18 26 22 ' +
             'C33 22 38 21 42 19 C37 27 30 31 22 32 ' +
             'C27 33 31 33 35 32 C27 38 15 39 4 36 Z';

let host = null;      // 떠 있는 책 버튼
let panel = null;     // 펼친 면
let open = false;
let flap = null;      // 날개 짓 타임라인
let lastEarned = -1;

/** 상단바가 접근성 이름을 다시 붙일 수 있게 */
function label() {
  const n = state.earnedCount;
  return open ? '도감 접기' : `도감 펼치기 — 모은 용어 ${n}개`;
}

export function mountBookmark(root) {
  if (host) return host;

  host = document.createElement('button');
  host.type = 'button';
  host.className = 'bk';
  host.setAttribute('aria-expanded', 'false');
  host.innerHTML =
    `<svg class="bk__wing bk__wing--l" viewBox="0 0 48 42" aria-hidden="true">` +
      `<g transform="translate(48,0) scale(-1,1)">` +
        `<path d="${WING}"/>` +
      `</g>` +
    `</svg>` +
    `<span class="bk__book" aria-hidden="true">` +
      `<span class="bk__spine"></span>` +
      `<span class="bk__face"><b class="bk__n">0</b><i>모은 용어</i></span>` +
    `</span>` +
    `<svg class="bk__wing bk__wing--r" viewBox="0 0 48 42" aria-hidden="true">` +
      `<path d="${WING}"/>` +
    `</svg>`;

  host.addEventListener('click', toggle);
  root.append(host);

  panel = document.createElement('section');
  panel.className = 'bk__panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '모은 용어');
  root.append(panel);

  document.addEventListener('keydown', onKey);

  refresh();
  idle();
  return host;
}

export function unmountBookmark() {
  document.removeEventListener('keydown', onKey);
  if (flap) { flap.kill(); flap = null; }
  host?.remove(); panel?.remove();
  host = panel = null; open = false;
}

function onKey(e) {
  if (e.key === 'Escape' && open) { e.preventDefault(); toggle(); }
}

/**
 * 숫자를 다시 읽는다. 새로 딴 것이 있으면 그때만 크게 퍼덕인다 —
 * 매번 퍼덕이면 그게 배경 소음이 되고, 진짜 획득이 묻힌다.
 */
export function refresh() {
  if (!host) return;
  const n = state.earnedCount;
  const num = host.querySelector('.bk__n');
  if (num) num.textContent = String(n);
  host.setAttribute('aria-label', label());
  host.classList.toggle('bk--empty', n === 0);

  if (lastEarned >= 0 && n > lastEarned) cheer();
  lastEarned = n;
  if (open) fill();
}

/**
 * 날갯짓. 새가 뜨는 것처럼 **내려칠 때 빠르고, 올릴 때 느리다** —
 * 위아래를 같은 속도로 움직이면 날개가 아니라 시계추로 보인다.
 * 책도 날개에 맞춰 같이 뜬다(내려칠 때 올라가고, 올릴 때 가라앉는다).
 */
function idle() {
  if (isReduced() || !host) return;
  if (flap) flap.kill();
  const wings = host.querySelectorAll('.bk__wing');
  const book = host.querySelector('.bk__book');

  flap = gsap.timeline({ repeat: -1 })
    // 내려친다 — 짧고 세게
    .to(wings, {
      rotate: (i) => (i ? 26 : -26), scaleY: 0.62,
      duration: 0.22, ease: 'power3.in'
    })
    // 올린다 — 길게 되돌아온다
    .to(wings, {
      rotate: (i) => (i ? -10 : 10), scaleY: 1.04,
      duration: 0.5, ease: 'power2.out'
    })
    .to(wings, { rotate: 0, scaleY: 1, duration: 0.34, ease: 'sine.inOut' })
    .to({}, { duration: 0.5 });   // 한 박자 쉰다 — 계속 퍼덕이면 눈이 아프다

  // 책은 날갯짓 한 주기에 한 번 뜬다
  gsap.to(book, {
    y: -6, duration: 0.78, ease: 'sine.inOut', yoyo: true, repeat: -1
  });
}

/** 새 용어가 들어왔다 — 한 번 크게 퍼덕이고 책이 튄다 */
function cheer() {
  if (isReduced()) { host.classList.remove('bk--cheer'); return; }
  const wings = host.querySelectorAll('.bk__wing');
  gsap.timeline()
    .to(wings, { scaleY: 0.42, rotate: (i) => (i ? 42 : -42), duration: 0.1, ease: 'power3.in' })
    .to(wings, { scaleY: 1.1, rotate: (i) => (i ? -18 : 18), duration: 0.22, ease: 'power2.out' })
    .to(wings, { scaleY: 1, rotate: 0, duration: 0.3, ease: 'settle' })
    .fromTo(host.querySelector('.bk__book'),
      { scale: 1 }, { scale: 1.18, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' }, 0);
  host.classList.add('bk--cheer');
  setTimeout(() => host && host.classList.remove('bk--cheer'), 1200);
}

async function toggle() {
  if (!host || !panel) return;
  open = !open;
  host.setAttribute('aria-expanded', open ? 'true' : 'false');
  host.setAttribute('aria-label', label());
  host.classList.toggle('bk--open', open);

  if (!open) {
    // 접힌다 — 펼침의 역순이고, 끝나면 화면에서 뺀다
    if (isReduced()) { panel.hidden = true; return; }
    await gsap.timeline()
      .to(panel.querySelectorAll('.bk__row'), { opacity: 0, x: 12, duration: 0.12, stagger: -0.012 })
      .to(panel, { scaleX: 0, opacity: 0, duration: 0.22, ease: 'power2.in' }, 0.05);
    panel.hidden = true;
    return;
  }

  fill();
  panel.hidden = false;
  if (isReduced()) { gsap.set(panel, { clearProps: 'all' }); return; }

  // 책이 펼쳐진다 — 등에서 옆으로 펴지고, 줄이 차례로 얹힌다
  const rows = panel.querySelectorAll('.bk__row');
  gsap.set(panel, { transformOrigin: 'right center', scaleX: 0, opacity: 1 });
  gsap.set(rows, { opacity: 0, x: 14 });
  const tl = gsap.timeline()
    .to(panel, { scaleX: 1, duration: 0.34, ease: 'settle' })
    .to(rows, { opacity: 1, x: 0, duration: 0.26, stagger: 0.018 }, 0.14);

  // 안전망 — 창이 가려져 rAF 가 멈춰도 결국 보이게 한다
  setTimeout(() => {
    if (!open || !panel) return;
    gsap.set(panel, { scaleX: 1, opacity: 1 });
    gsap.set(rows, { opacity: 1, x: 0 });
  }, 900);
  await tl;
}

/** 펼친 면을 채운다. 딴 것은 뜻까지, 아직 못 딴 것은 자물쇠만. */
function fill() {
  const all = byChapter();
  const n = state.earnedCount;
  const total = terms.length;

  const chapters = [...all].sort((a, b) => a[0] - b[0]);
  let body = '';
  for (const [ch, group] of chapters) {
    const got = group.filter(t => state.hasEarned(t.term));
    if (!got.length) continue;
    body +=
      `<div class="bk__ch">${esc(chapterLabel(ch))} <b>${got.length}</b>/${group.length}</div>`;
    for (const t of got) {
      body +=
        `<button type="button" class="bk__row" data-term="${esc(t.term)}">` +
          `<span class="bk__t">${esc(t.term)}</span>` +
          `<span class="bk__a">${strong(t.analogy)}</span>` +
        `</button>`;
    }
  }
  if (!body) {
    body = `<p class="bk__none">아직 딴 용어가 없다.<br>판을 하나 깨면 여기에 쌓인다.</p>`;
  }

  panel.innerHTML =
    `<header class="bk__head">` +
      `<b>${n}</b><span>/ ${total} 모음</span>` +
      `<a class="bk__more" href="#/codex">전체 도감</a>` +
    `</header>` +
    `<div class="bk__list">${body}</div>`;

  for (const b of panel.querySelectorAll('.bk__row')) {
    b.addEventListener('click', () => expand(b));
  }
}

/** 한 줄을 눌러 뜻을 펼친다. 두 번째 누르면 접힌다. */
function expand(row) {
  const term = row.dataset.term;
  const t = terms.find(x => x.term === term);
  if (!t) return;
  const on = row.classList.toggle('bk__row--open');
  let more = row.querySelector('.bk__x');
  if (!on) { more?.remove(); return; }
  more = document.createElement('span');
  more.className = 'bk__x';
  more.innerHTML = strong(t.explain);
  row.append(more);
  if (isReduced()) return;
  gsap.from(more, { height: 0, opacity: 0, duration: 0.26, ease: 'swift' });
}

export { open as isBookOpen };
