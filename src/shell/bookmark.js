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

/** 화면 가장자리에서 이만큼은 떨어뜨린다 — 붙여 두면 잡기가 어렵다 */
const EDGE = 8;
/** 이만큼 움직이기 전에는 누른 것으로 본다. 손가락은 가만히 못 있는다 */
const SLOP = 6;
/** 화살표 키로 옮기는 거리. 드래그를 못 하는 사람의 몫이다 */
const NUDGE = 16;

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

  host.addEventListener('click', onClick);
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('keydown', onHostKey);
  root.append(host);

  panel = document.createElement('section');
  panel.className = 'bk__panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '모은 용어');
  root.append(panel);

  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);

  applySaved();
  refresh();
  idle();
  hintOnce();
  return host;
}

/**
 * "끌어서 옮길 수 있다"를 처음 한 번만 알려 준다.
 * 커서가 손 모양으로 바뀌는 것은 마우스에만 있는 신호라 휴대폰에서는 아무 표시가
 * 없다. 그렇다고 화면에 계속 띄워 두면 그게 곧 잔소리가 된다 — 한 번 보고 끝낸다.
 */
function hintOnce() {
  if (state.setting('bookTipSeen', false)) return;
  const tip = document.createElement('div');
  tip.className = 'bk__tip';
  tip.textContent = '끌어서 옮길 수 있다';
  document.body.append(tip);
  const put = () => {
    const r = host.getBoundingClientRect();
    tip.style.left = `${Math.max(EDGE, r.left + r.width / 2 - tip.offsetWidth / 2)}px`;
    tip.style.top = `${Math.max(EDGE, r.top - tip.offsetHeight - 6)}px`;
  };
  put();
  const off = () => { tip.remove(); state.setSetting('bookTipSeen', true); };
  if (isReduced()) { setTimeout(off, 3200); return; }
  gsap.fromTo(tip, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3, delay: 0.8 });
  gsap.to(tip, { opacity: 0, duration: 0.3, delay: 4, onComplete: off });
  setTimeout(off, 6000);   // 안전망 — 창이 가려져 연출이 멈춰도 결국 사라진다
}

export function unmountBookmark() {
  document.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', onResize);
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onUp);
  drag = null;
  if (flap) { flap.kill(); flap = null; }
  host?.remove(); panel?.remove();
  host = panel = null; open = false;
}

// ---------------------------------------------------------------- 자리 옮기기
//
// 왜 옮길 수 있어야 하나: 책은 화면 오른쪽 아래에 떠 있는데, 판마다 그 자리에
// 무엇이 오는지가 다르다. 어떤 판은 거기가 [실행] 버튼이고 어떤 판은 거기로
// 일감이 내려온다. 한 자리에 못 박아 두면 언젠가는 반드시 방해가 된다.
//
// 자리는 **화면 비율로 저장한다.** 픽셀로 저장하면 노트북에서 놓은 자리가
// 회의실 큰 화면에서는 한가운데가 되고, 창을 줄이면 화면 밖으로 나간다.
// 비율은 모서리에 놓은 것을 어느 화면에서든 모서리로 되돌려 준다.

/** 지금 화면에서 책이 갈 수 있는 왼쪽·위쪽 최대값 */
function bounds() {
  const w = host.offsetWidth, h = host.offsetHeight;
  return {
    maxX: Math.max(0, window.innerWidth - w - EDGE * 2),
    maxY: Math.max(0, window.innerHeight - h - EDGE * 2)
  };
}

/** 비율(0~1)을 지금 화면의 좌표로 바꿔 실제로 놓는다 */
function place(fx, fy) {
  const { maxX, maxY } = bounds();
  host.style.left = `${EDGE + maxX * clamp01(fx)}px`;
  host.style.top = `${EDGE + maxY * clamp01(fy)}px`;
  host.style.right = 'auto';
  host.style.bottom = 'auto';
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

/** 저장된 자리가 있으면 그대로 놓는다. 없으면 CSS 기본값(오른쪽 아래)에 둔다 */
function applySaved() {
  const at = state.setting('bookAt', null);
  if (at && typeof at.fx === 'number' && typeof at.fy === 'number') place(at.fx, at.fy);
}

/** 창 크기가 바뀌면 비율대로 다시 놓는다 — 안 그러면 화면 밖으로 나간다 */
function onResize() {
  if (!host) return;
  applySaved();
  if (open) placePanel();
}

let drag = null;
/** 방금 끌었다 — 그 동작에서 이어 나오는 click 하나를 삼키는 표시 */
let justDragged = false;

function onDown(e) {
  if (e.button != null && e.button !== 0) return;   // 오른쪽 버튼으로는 안 끈다
  // 새 동작이 시작됐다. 지난 드래그의 흔적은 여기서 지운다 —
  // 브라우저가 드래그 뒤에 click 을 안 보내는 경우가 있어서, 이 표시를 그대로
  // 두면 **한참 뒤의 진짜 탭 하나가 대신 먹힌다.**
  justDragged = false;
  const r = host.getBoundingClientRect();
  drag = { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top,
           x0: e.clientX, y0: e.clientY, moved: false };

  // 포인터 잡기는 **되면 좋고 안 돼도 그만**이다. 실패하면 예외를 던지는데,
  // 여기서 막히면 드래그가 아예 시작되지 않는다. 실제로 그렇게 한 번 죽였다.
  try { host.setPointerCapture?.(e.pointerId); } catch { /* 못 잡아도 아래로 진행 */ }

  // 듣는 곳은 책이 아니라 **창**이다. 손이 책보다 빨리 움직이면 포인터가 책 밖으로
  // 나가는데, 책에만 걸어 두면 그 순간 따라오다 만다.
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < SLOP) return;
    drag.moved = true;
    host.classList.add('bk--drag');
    if (open) toggle();          // 끌기 시작하면 펼친 면은 접는다
  }
  e.preventDefault();
  const { maxX, maxY } = bounds();
  const x = Math.min(EDGE + maxX, Math.max(EDGE, e.clientX - drag.ox));
  const y = Math.min(EDGE + maxY, Math.max(EDGE, e.clientY - drag.oy));
  host.style.left = `${x}px`;
  host.style.top = `${y}px`;
  host.style.right = 'auto';
  host.style.bottom = 'auto';
}

function onUp(e) {
  if (!drag) return;
  try { host.releasePointerCapture?.(drag.id); } catch { /* 안 잡혀 있었다 */ }
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onUp);
  const moved = drag.moved;
  drag = null;
  host.classList.remove('bk--drag');
  if (moved) { justDragged = true; save(); e.preventDefault(); }
}

/** 지금 자리를 비율로 바꿔 저장한다 */
function save() {
  const r = host.getBoundingClientRect();
  const { maxX, maxY } = bounds();
  state.setSetting('bookAt', {
    fx: maxX ? clamp01((r.left - EDGE) / maxX) : 0,
    fy: maxY ? clamp01((r.top - EDGE) / maxY) : 0
  });
}

/** 끌고 난 직후의 click 은 삼킨다 — 놓자마자 도감이 펼쳐지면 놀란다 */
function onClick(e) {
  if (justDragged) { justDragged = false; e.preventDefault(); return; }
  toggle();
}

/**
 * 화살표 키로도 옮긴다. 드래그는 손이 되는 사람만 쓸 수 있는 조작이라
 * 그것 하나만 두면 자리를 못 옮기는 사람이 생긴다.
 */
function onHostKey(e) {
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!d) return;
  e.preventDefault();
  const r = host.getBoundingClientRect();
  const { maxX, maxY } = bounds();
  const x = Math.min(EDGE + maxX, Math.max(EDGE, r.left + d[0] * NUDGE));
  const y = Math.min(EDGE + maxY, Math.max(EDGE, r.top + d[1] * NUDGE));
  host.style.left = `${x}px`; host.style.top = `${y}px`;
  host.style.right = 'auto'; host.style.bottom = 'auto';
  save();
  if (open) placePanel();
}

/**
 * 펼친 면을 **책이 있는 자리에 맞춰** 놓는다.
 * 책을 왼쪽으로 옮겼으면 면도 오른쪽으로 열려야 한다 — 자리를 옮길 수 있게
 * 만들어 놓고 면이 늘 왼쪽으로만 열리면 옮긴 보람이 없다.
 */
function placePanel() {
  if (!panel || !host) return;
  const vw = window.innerWidth, vh = window.innerHeight;
  const r = host.getBoundingClientRect();

  // 좁은 화면에서는 좌우로 꽉 채운다. 옆으로 열 자리 자체가 없다.
  if (vw < 420) {
    panel.style.left = `${EDGE}px`;
    panel.style.right = `${EDGE}px`;
    panel.style.width = 'auto';
    const below = vh - r.bottom;
    panel.style.top = below > r.top ? `${r.bottom + EDGE}px` : '';
    panel.style.bottom = below > r.top ? '' : `${vh - r.top + EDGE}px`;
    return;
  }

  const w = Math.min(340, vw - EDGE * 2);
  panel.style.width = `${w}px`;
  panel.style.right = 'auto';

  // 넓은 쪽으로 연다. 양쪽 다 좁으면 화면 안으로 밀어 넣는다.
  const roomRight = vw - r.right - EDGE * 2;
  const left = roomRight >= w ? r.right + EDGE : r.left - w - EDGE;
  panel.style.left = `${Math.min(vw - w - EDGE, Math.max(EDGE, left))}px`;

  // 세로는 책의 아랫변에 맞춘다. 그래야 책에서 면이 뻗어 나온 것처럼 보인다.
  const h = panel.offsetHeight || 320;
  panel.style.bottom = 'auto';
  panel.style.top = `${Math.min(vh - h - EDGE, Math.max(EDGE, r.bottom - h))}px`;

  // 펼치는 연출이 책 쪽에서 시작되게 한다
  panel.style.transformOrigin = roomRight >= w ? 'left center' : 'right center';
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
  // 자리를 먼저 잡는다 — 높이를 재야 세로 위치가 정해지고, 재려면 화면에 있어야 한다
  placePanel();
  if (isReduced()) { gsap.set(panel, { clearProps: 'transform' }); return; }

  // 책이 펼쳐진다 — 등에서 옆으로 펴지고, 줄이 차례로 얹힌다.
  // 어느 쪽에서 펴지는지는 placePanel 이 정해 둔다(책이 왼쪽에 있으면 오른쪽으로).
  const rows = panel.querySelectorAll('.bk__row');
  gsap.set(panel, { scaleX: 0, opacity: 1 });
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
