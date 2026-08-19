// 공통 셸 — 종이 옆에 쌓이는 도감 책더미.
//
// 종이를 한 장으로 좁히고 나면 양옆이 빈다. 그 자리에 무엇을 둘지 네 번 갈아엎었다.
//   1) 등고선을 느리게 흘렸다 → 움직이긴 하는데 **무슨 일이 일어나는지가 없었다.**
//   2) 배선에 신호를 흘렸다 → 움직이는데 **이 코스가 하는 일과 상관이 없었고**,
//      네모와 납땜 자국이 쌓이니 배운 것이 아니라 전자 부품처럼 보였다.
//   3) 책이 쌓였다 → 소재는 맞는데 **아무 책이나** 쌓였다. 그림일 뿐 내 것이 아니었다.
//   4) 지금 것 — **내가 딴 용어가 책이 되어 쌓인다.** 안 딴 자리는 `???` 로 비어 있다.
//
// 그래서 이 그림은 장식이 아니라 **진도 표시**다. 판을 깨서 용어를 따면 그 자리에서
// 책 한 권이 흐름 선을 타고 내려와 더미에 얹히고, 책등에 그 용어가 적힌다.
// 위쪽 `???` 는 아직 안 딴 자리다 — 채울 자리가 눈에 보여야 채울 맛이 난다.
//
// **한쪽에만 쌓는다.** 처음엔 양옆에 하나씩 뒀는데 사용자가 "양쪽으로 빠져 있어서
// 애매모호하다"고 했다. 맞는 말이었다 — 같은 것이 둘로 갈리면 어느 쪽도 주인공이
// 아니게 되고, 그러면 화면 장식으로만 읽힌다. 왼쪽 하나로 몰고 대신 크게 그린다.
// 오른쪽을 비운 것은 균형을 버린 게 아니다 — 거기에는 이미 도감책이 붙어 있다.
//
// 지켜야 할 것 다섯:
//   1) **글자 뒤에서 돌지 않는다.** 종이 바깥 왼쪽 여백에만 쌓는다.
//      좁은 화면에서는 종이가 화면을 꽉 채우므로 **아무것도 그리지 않고 멈춘다.**
//   2) **바닥에 글자를 놓지 않는다.** 용어와 숫자는 전부 책과 명패 위에 얹는다.
//      제도대 바닥은 대비를 잰 자리가 아니다(CLAUDE.md 1-4).
//   3) **싸야 한다.** 실시간 판(13·14번)이 도는 동안에도 같이 돈다.
//   4) 움직임을 줄여 달라는 설정이면 **다 쌓인 더미만 한 장 그리고 멈춘다.**
//      탭이 뒤로 가도 멈춘다.
//   5) 색은 tokens.css 에서 읽는다. 이 파일에 색값을 적지 않는다.

import { isReduced } from '../core/motion.js';
import { state } from '../core/state.js';
import { terms } from '../data/terms.js';

// 60장으로 그린다. 30장으로 묶었더니 내려오는 책이 뚝뚝 끊겨 보였다 —
// 천천히 움직이는 물체일수록 장 수가 모자란 게 눈에 띈다.
const FPS = 60;
const GUTTER_MIN = 132;  // 이보다 좁은 여백에는 안 쌓는다 — 책이 잘려 보인다
const BOOK_H = 23;       // 책 두께. 책등 글자가 들어갈 만큼은 돼야 한다
const GAP = 3;
const TOP = 96;          // 흐름 선이 시작하는 높이
const FALL = 0.72;       // 책 한 권이 내려와 앉는 데 걸리는 시간(초)
const STAGGER = 0.09;    // 화면을 열 때 이미 딴 책들이 차례로 나타나는 간격
const GHOSTS = 4;        // 위에 비워 두는 `???` 자리 수

let canvas = null, ctx = null, raf = 0, last = 0, t = 0;
let w = 0, h = 0, dpr = 1;
let pile = null;
let bornAt = new Map();   // 용어 → 이 책이 내려오기 시작한 시각. 새로 딴 것만 다시 떨어진다
let color = {};
let fontBody = 'sans-serif', fontMono = 'monospace';

function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  const get = (n, d) => cs.getPropertyValue(n).trim() || d;
  color.flow = get('--trace', 'rgba(11,93,138,.26)');
  color.lit = get('--trace-lit', 'rgba(11,93,138,.72)');
  color.face = get('--book-face', 'rgba(250,248,245,.82)');
  color.edge = get('--book-edge', 'rgba(19,26,38,.30)');
  color.band = get('--book-band', 'rgba(11,93,138,.42)');
  color.title = get('--ink', '#131A26');
  color.muted = get('--muted', '#59646F');
  fontBody = get('--font-body', 'sans-serif');
  fontMono = get('--font-mono', 'monospace');
}

/* 책 너비를 조금씩 다르게 한다. 다 같으면 무늬가 되고, 무늬는 시선을 가져간다.
   새로고침마다 배치가 달라지면 그것도 시선을 끄니 자리에서 뽑는 난수를 쓴다. */
function rnd(seed) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function build() {
  pile = null;
  const app = document.getElementById('app');
  if (!app) return;

  // 왼쪽 여백 하나만 쓴다. 오른쪽에는 도감책이 붙어 있어서 겹친다.
  const width = app.getBoundingClientRect().left;
  if (width < GUTTER_MIN) return;          // 좁으면 안 쌓는다 (휴대폰에서 여기서 끝)

  const wide = Math.min(width * 0.72, 176);
  const cx = width / 2;
  const plateH = 22;
  const floor = h - 56 - plateH;           // 명패 위가 더미가 놓인 바닥
  const slots = Math.max(3, Math.floor((floor - TOP - 70) / (BOOK_H + GAP)));

  const earned = state.earnedList;
  const total = terms.length;
  // 빈 자리는 **넷까지만** 보여 준다. 남은 자리를 다 그리면(예순 몇 개) 화면 옆이
  // 물음표로 뒤덮여서, 쌓인 것보다 안 쌓인 것이 주인공이 된다. 넷이면
  // "다음에 채울 자리"로 읽히고 그 위는 비어 있어 더미가 자랄 여지로 보인다.
  const ghosts = Math.max(0, Math.min(GHOSTS, total - earned.length));
  // 딴 것이 자리보다 많으면 **최근 것**을 보여 준다. 방금 딴 것이 안 보이면
  // 이 그림이 진도 표시가 아니라 그냥 배경이 된다.
  const shown = earned.slice(Math.max(0, earned.length - (slots - ghosts)));

  const books = [];
  let top = floor;
  const push = (label, real, i) => {
    const s = 3.7 + i * 5.1;
    const bw = wide * (0.78 + rnd(s) * 0.22);
    top -= BOOK_H + GAP;
    books.push({
      label, real,
      x: cx - bw / 2 + (rnd(s + 1) - 0.5) * wide * 0.09,
      y: top, w: bw,
      spineLeft: rnd(s + 2) < 0.5           // 책등이 어느 쪽을 보는가
    });
  };
  shown.forEach((term, i) => push(term, true, i));
  for (let k = 0; k < ghosts; k++) push('???', false, shown.length + k);

  // 새로 들어온 책에만 떨어지는 시각을 준다. 이미 있던 책은 제자리에 그대로 있는다.
  let fresh = 0;
  for (const b of books) {
    if (!b.real) continue;
    if (!bornAt.has(b.label)) bornAt.set(b.label, t + fresh++ * STAGGER);
  }

  pile = {
    books, cx, floor, wide, plateH,
    earned: earned.length, total,
    hidden: Math.max(0, earned.length - shown.length)
  };
}

function drawBook(b, alpha, dy, strong) {
  ctx.globalAlpha = alpha;
  const y = b.y + dy;

  if (b.real) {
    ctx.fillStyle = color.face;
    ctx.fillRect(b.x, y, b.w, BOOK_H);
  }
  ctx.strokeStyle = strong ? color.lit : color.edge;
  ctx.lineWidth = strong ? 1.8 : 1;
  // 아직 안 딴 자리는 **점선 빈 칸**이다. 채워질 자리라는 뜻이 선 하나로 전해진다.
  if (!b.real) ctx.setLineDash([3, 4]);
  ctx.strokeRect(b.x + .5, y + .5, b.w - 1, BOOK_H - 1);
  ctx.setLineDash([]);

  // 책등의 띠. 이것 하나로 네모가 "책"이 된다.
  if (b.real) {
    ctx.fillStyle = color.band;
    const sx = b.spineLeft ? b.x + 4 : b.x + b.w - 7;
    ctx.fillRect(sx, y + 4, 3, BOOK_H - 8);
  }

  // 책등에 적힌 용어. 이게 이 그림의 요점이다 — 내가 딴 것이 이름으로 남는다.
  ctx.font = `${b.real ? 600 : 500} 11px ${fontBody}`;
  ctx.fillStyle = b.real ? color.title : color.muted;
  ctx.globalAlpha = alpha * (b.real ? 0.9 : 0.55);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const room = b.w - 22;
  let label = b.label;
  if (ctx.measureText(label).width > room) {
    while (label.length > 1 && ctx.measureText(label + '…').width > room) label = label.slice(0, -1);
    label += '…';
  }
  ctx.fillText(label, b.x + b.w / 2 + (b.spineLeft ? 3 : -3), y + BOOK_H / 2);
  ctx.globalAlpha = 1;
}

function drawPlate(p) {
  // 명패. 숫자를 바닥에 바로 얹으면 대비를 다시 재야 하므로 판을 깔고 그 위에 쓴다.
  const pw = p.wide + 28;
  const x = p.cx - pw / 2;
  const y = p.floor + 6;
  ctx.fillStyle = color.face;
  ctx.fillRect(x, y, pw, p.plateH);
  ctx.strokeStyle = color.edge;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, pw - 1, p.plateH - 1);

  ctx.font = `700 12px ${fontMono}`;
  ctx.fillStyle = color.title;
  ctx.globalAlpha = 0.85;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${p.earned} / ${p.total}`, p.cx, y + p.plateH / 2 + 0.5);
  ctx.globalAlpha = 1;

  // 자리보다 많이 땄으면 아래에 더 있다는 표시. 숫자와 그림이 어긋나 보이지 않게.
  if (p.hidden > 0) {
    ctx.strokeStyle = color.edge;
    ctx.globalAlpha = 0.45;
    for (let k = 1; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(x + 12 + k * 4, y - 1 - k * 3);
      ctx.lineTo(x + pw - 12 - k * 4, y - 1 - k * 3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function draw(time) {
  ctx.clearRect(0, 0, w, h);
  if (!pile) return;
  const moving = !isReduced();

  drawPlate(pile);

  // 흐름 선 — 위에서 내려와 다음 책이 앉을 자리까지 이어진다.
  const nextSlot = pile.books.find(b => !b.real) || pile.books[pile.books.length - 1];
  if (nextSlot) {
    ctx.strokeStyle = color.flow;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(pile.cx, TOP);
    ctx.lineTo(pile.cx, nextSlot.y - 7);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  let newest = null;
  for (const b of pile.books) if (b.real) newest = b;

  for (const b of pile.books) {
    if (!b.real) {
      // 빈 자리는 아주 느리게 숨을 쉰다. "여기가 채워질 자리"라고 가리키는 것이지
      // 눈길을 끌자는 게 아니라서 폭을 좁게 잡았다.
      const breathe = moving ? 0.66 + 0.16 * Math.sin(time * 1.15 + b.y * 0.02) : 0.72;
      drawBook(b, breathe, 0, false);
      continue;
    }
    const t0 = bornAt.has(b.label) ? bornAt.get(b.label) : 0;
    const since = moving ? time - t0 : FALL;
    if (since < 0) continue;                        // 아직 안 내려온 책
    // 흐름 선을 타고 내려와 앉는다. 끝으로 갈수록 느려지게 —
    // 등속으로 떨어지면 물건이 아니라 기계 부품처럼 보인다.
    const p = Math.min(1, since / FALL);
    const eased = 1 - Math.pow(1 - p, 3);
    const dy = (1 - eased) * -(b.y - TOP);
    drawBook(b, Math.min(1, p * 1.8), dy, b === newest && p >= 1);
  }
}

function resize() {
  // 이 그림은 흐릿해도 되는 것이라 배율을 1.5 로 묶는다.
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  // **크기는 캔버스 자신의 상자에서 읽는다.** window.innerWidth 는 세로 스크롤
  // 막대까지 세기 때문에 캔버스가 그만큼 넓어져 가로 스크롤이 생긴다(360px 검사에서 잡혔다).
  const r = canvas.getBoundingClientRect();
  w = Math.round(r.width);
  h = Math.round(r.height);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  build();
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  // 120Hz 화면에서 두 배로 그리지 않도록 묶되, 딱 1000/60 으로 자르면 한 장 걸러
  // 한 장씩 버려져 오히려 30장처럼 보인다. 여유를 2ms 둔다.
  if (now - last < 1000 / FPS - 2) return;
  t += (now - last) / 1000;
  last = now;
  draw(t);
}

function start() {
  // 쌓을 자리가 없으면(좁은 화면) 아예 안 돈다. 휴대폰에서 배터리를 쓰지 않는다.
  if (raf || isReduced() || !pile) return;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

/**
 * 용어를 새로 땄을 때 부른다. 새로 딴 책만 흐름 선을 타고 내려오고,
 * 이미 있던 책은 제자리에 그대로 있는다.
 */
export function refreshBackdrop() {
  if (!canvas) return;
  build();
  draw(t);
  start();
}

/**
 * 종이 옆에 도감 책더미를 깔고 돌린다. 부팅 때 한 번만 부른다.
 * 캔버스는 #app 의 형제로 들어가고 z-index 로 뒤에 깔린다 — 화면을 갈아 끼워도
 * 다시 만들 필요가 없고, 판이 바뀔 때 깜빡이지 않는다.
 */
export function mountBackdrop() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.className = 'backdrop';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  ctx = canvas.getContext('2d');

  readTokens();
  resize();
  draw(0);
  start();

  // 글꼴이 늦게 오면 책등 글자가 시스템 글꼴로 그려진 채 남는다. 오면 다시 그린다.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw(t));

  let tid = 0;
  window.addEventListener('resize', () => {
    clearTimeout(tid);
    tid = setTimeout(() => {
      resize();
      draw(t);
      if (pile) start(); else stop();
    }, 150);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });
}
