// 공통 셸 — 종이 양옆의 진도판.
//
// 종이를 한 장으로 좁히고 나면 양옆이 빈다. 그 자리에 무엇을 둘지 네 번 갈아엎었다.
//   1) 등고선을 느리게 흘렸다 → 움직이긴 하는데 **무슨 일이 일어나는지가 없었다.**
//   2) 배선에 신호를 흘렸다 → 움직이는데 **이 코스가 하는 일과 상관이 없었고**,
//      네모와 납땜 자국이 쌓이니 배운 것이 아니라 전자 부품처럼 보였다.
//   3) 책이 쌓였다 → 소재는 맞는데 **아무 책이나** 쌓였다. 그림일 뿐 내 것이 아니었다.
//   4) 지금 것 — **내 진도를 그린다.** 앞의 셋이 실패한 이유는 전부 같다:
//      화면에 뜬 것이 이 사람의 것이 아니었다.
//
// 양옆이 각각 다른 것을 센다. 둘이 같은 것을 세면 한쪽은 없어도 되는 그림이 된다.
//   왼쪽 — **아는 것.** 딴 용어가 책이 되어 쌓이고 책등에 그 이름이 적힌다.
//           위쪽 `???` 는 아직 안 딴 자리다. 채울 자리가 보여야 채울 맛이 난다.
//   오른쪽 — **한 것.** 판마다 **간판**이 한 장씩 걸려 있고, 깨면 **쪼개진다.**
//           도장깨기다 — 도장을 찍는 것보다 간판을 깨는 것이 한 판을 끝냈다는
//           말에 가깝고, 깨진 자국은 멀리서도 성한 것과 갈린다.
//           쪼개진 틈의 색이 등급이라 다시 할 판이 눈에 띈다.
//
// 지켜야 할 것 다섯:
//   1) **글자 뒤에서 돌지 않는다.** 종이 바깥 여백에만 그린다.
//      좁은 화면에서는 종이가 화면을 꽉 채우므로 **아무것도 그리지 않고 멈춘다.**
//   2) **바닥에 글자를 놓지 않는다.** 용어·번호·숫자는 전부 책과 간판과 명패 위에 얹는다.
//      제도대 바닥은 대비를 잰 자리가 아니다(CLAUDE.md 1-4).
//   3) **싸야 한다.** 실시간 판(13·14번)이 도는 동안에도 같이 돈다.
//   4) 움직임을 줄여 달라는 설정이면 **다 그려진 모습만 한 장 그리고 멈춘다.**
//      탭이 뒤로 가도 멈춘다.
//   5) 색은 tokens.css 에서 읽는다. 이 파일에 색값을 적지 않는다.

import { isReduced } from '../core/motion.js';
import { state } from '../core/state.js';
import { terms } from '../data/terms.js';
import { manifest } from '../games/index.js';

// 60장으로 그린다. 30장으로 묶었더니 내려오는 책이 뚝뚝 끊겨 보였다 —
// 천천히 움직이는 물체일수록 장 수가 모자란 게 눈에 띈다.
const FPS = 60;
const GUTTER_MIN = 150;  // 이보다 좁은 여백에는 안 그린다 — 잘려 보인다
const BOOK_H = 30;       // 책 두께. 작으면 딴 느낌이 안 난다
const GAP = 4;
const TOP = 92;          // 흐름 선과 간판이 시작하는 높이
const FALL = 0.72;       // 책 한 권이 내려와 앉는 데 걸리는 시간(초)
const STAGGER = 0.09;    // 화면을 열 때 이미 딴 책들이 차례로 나타나는 간격
const GHOSTS = 3;        // 위에 비워 두는 `???` 자리 수
const TICKET_H = 26;     // 간판 한 장
const TICKET_GAP = 7;    // 간판을 매단 줄이 지나가는 자리
const BOOK_BOTTOM = 132; // 도감책이 붙어 있는 오른쪽 아래를 비워 둔다

let canvas = null, ctx = null, raf = 0, last = 0, t = 0;
let w = 0, h = 0, dpr = 1;
let pile = null, board = null;
let bornAt = new Map();    // 용어 → 그 책이 내려오기 시작한 시각
let stampAt = new Map();   // 판 id → 그 간판을 깬 시각
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
  color.pass = get('--pass', '#0F7150');
  color.partial = get('--partial', '#9A5B00');
  color.fail = get('--fail', '#C0392B');
  fontBody = get('--font-body', 'sans-serif');
  fontMono = get('--font-mono', 'monospace');
}

/* 크기를 조금씩 다르게 한다. 다 같으면 무늬가 되고, 무늬는 시선을 가져간다.
   새로고침마다 배치가 달라지면 그것도 시선을 끄니 자리에서 뽑는 난수를 쓴다. */
function rnd(seed) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** 글자가 상자를 넘으면 뒤를 자르고 말줄임을 붙인다. */
function fit(label, room) {
  if (ctx.measureText(label).width <= room) return label;
  let s = label;
  while (s.length > 1 && ctx.measureText(s + '…').width > room) s = s.slice(0, -1);
  return s + '…';
}

// ---------------------------------------------------------------- 왼쪽: 책더미

function buildPile(gutter) {
  const wide = Math.min(gutter * 0.78, 214);
  const cx = gutter / 2;
  const plateH = 24;
  const floor = h - 52 - plateH;           // 명패 위가 더미가 놓인 바닥
  const slots = Math.max(3, Math.floor((floor - TOP - 60) / (BOOK_H + GAP)));

  const earned = state.earnedList;
  const total = terms.length;
  // 빈 자리는 셋까지만. 남은 예순 몇 자리를 다 그리면 화면 옆이 물음표로 뒤덮여서
  // 쌓인 것보다 **안 쌓인 것이 주인공**이 된다.
  const ghosts = Math.max(0, Math.min(GHOSTS, total - earned.length));
  // 딴 것이 자리보다 많으면 최근 것을 보여 준다. 방금 딴 것이 안 보이면
  // 이 그림이 진도 표시가 아니라 그냥 배경이 된다.
  const shown = earned.slice(Math.max(0, earned.length - (slots - ghosts)));

  const books = [];
  let top = floor;
  const push = (label, real, i) => {
    const s = 3.7 + i * 5.1;
    const bw = wide * (0.82 + rnd(s) * 0.18);
    top -= BOOK_H + GAP;
    books.push({
      label, real,
      x: cx - bw / 2 + (rnd(s + 1) - 0.5) * wide * 0.07,
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

  return {
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
  ctx.lineWidth = strong ? 2 : 1;
  // 아직 안 딴 자리는 **점선 빈 칸**이다. 채워질 자리라는 뜻이 선 하나로 전해진다.
  if (!b.real) ctx.setLineDash([3, 4]);
  ctx.strokeRect(b.x + .5, y + .5, b.w - 1, BOOK_H - 1);
  ctx.setLineDash([]);

  // 책등의 띠. 이것 하나로 네모가 "책"이 된다.
  if (b.real) {
    ctx.fillStyle = color.band;
    const sx = b.spineLeft ? b.x + 5 : b.x + b.w - 9;
    ctx.fillRect(sx, y + 5, 4, BOOK_H - 10);
  }

  // 책등에 적힌 용어. 이게 이 그림의 요점이다 — 내가 딴 것이 이름으로 남는다.
  ctx.font = `${b.real ? 600 : 500} 13px ${fontBody}`;
  ctx.fillStyle = b.real ? color.title : color.muted;
  ctx.globalAlpha = alpha * (b.real ? 0.92 : 0.55);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fit(b.label, b.w - 26), b.x + b.w / 2 + (b.spineLeft ? 4 : -4), y + BOOK_H / 2);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- 오른쪽: 간판

function buildBoard(x0, gutter) {
  const wide = Math.min(gutter * 0.78, 214);
  const cx = x0 + gutter / 2;
  const plateH = 24;
  // 간판은 위에서 아래로 걸린다. 아래쪽은 도감책 자리라 비워 둔다.
  const room = h - BOOK_BOTTOM - plateH - TOP;
  const games = manifest.filter(m => m.ready);
  const fits = Math.floor(room / (TICKET_H + TICKET_GAP));
  if (fits < 6) return null;

  // 다 못 걸면 필수만 건다 — 필수는 이 코스의 뼈대라 먼저 보여야 한다.
  const list = fits >= games.length ? games : games.filter(m => m.required).slice(0, fits);
  const signs = list.map((m, i) => {
    const r = state.resultOf(m.id);
    return {
      id: m.id, no: m.no, title: m.title, required: m.required,
      grade: r ? r.grade : null,
      x: cx - wide / 2, y: TOP + i * (TICKET_H + TICKET_GAP), w: wide
    };
  });

  // 이미 깬 간판은 깨진 채로 시작한다. 이번에 깬 것만 벌어지는 연출이 붙는다.
  for (const tk of signs) {
    if (tk.grade && !stampAt.has(tk.id)) stampAt.set(tk.id, -99);
  }

  const done = signs.filter(tk => tk.grade && tk.grade !== 'fail').length;
  return {
    signs, cx, wide, plateH, done, total: signs.length,
    onlyRequired: list.length < games.length,
    floor: TOP + signs.length * (TICKET_H + TICKET_GAP) - TICKET_GAP
  };
}

function gradeColor(g) {
  return g === 'pass' ? color.pass : g === 'partial' ? color.partial : color.fail;
}

/** 간판 한 장의 속을 그린다(널판 · 번호 · 이름). 성한 것도 깨진 것도 이걸 쓴다. */
function signFace(tk, x, y, bw, bh, done) {
  ctx.fillStyle = color.face;
  ctx.fillRect(x, y, bw, bh);
  ctx.strokeStyle = done ? gradeColor(tk.grade) : color.edge;
  ctx.lineWidth = done ? 1.4 : 1;
  ctx.globalAlpha = done ? 0.85 : 0.55;
  ctx.strokeRect(x + .5, y + .5, bw - 1, bh - 1);
  ctx.globalAlpha = 1;

  // 판 번호 — 간판에는 몇 번째 관인지가 적혀 있다
  ctx.font = `700 12px ${fontMono}`;
  ctx.fillStyle = done ? color.title : color.muted;
  ctx.globalAlpha = done ? 0.9 : 0.5;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(tk.no).padStart(2, '0'), x + 9, y + bh / 2);

  // 판 이름은 **가운데**에 쓴다. 그래야 갈라진 자리가 글자 한가운데를 지나고,
  // 깨진 간판이 "쪼개진 널판"이 아니라 **깨진 이름**으로 읽힌다.
  ctx.font = `${done ? 700 : 400} 12px ${fontBody}`;
  ctx.globalAlpha = done ? 0.86 : 0.42;
  ctx.textAlign = 'center';
  ctx.fillText(fit(tk.title, bw - 52), x + bw / 2 + 10, y + bh / 2);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

/**
 * 간판 한 장.
 *
 * 성한 것은 그냥 걸려 있고, 깬 것은 **쪼개져 있다** — 가운데를 톱니로 가르고
 * 두 쪽을 바깥으로 조금 기울인다. 갈라진 자리를 등급 색으로 그으면
 * 승인·조건부·반려가 멀리서도 갈린다. 깬 순간에는 두 쪽이 크게 벌어졌다 잦아든다.
 */
function drawSign(tk, time) {
  const done = Boolean(tk.grade);
  const x = tk.x, y = tk.y, bw = tk.w, bh = TICKET_H;

  // 고리 — 위에서 내려온 줄에 걸려 있다
  ctx.strokeStyle = color.edge;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.moveTo(x + 12, y - TICKET_GAP); ctx.lineTo(x + 12, y);
  ctx.moveTo(x + bw - 12, y - TICKET_GAP); ctx.lineTo(x + bw - 12, y);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (!done) {
    ctx.globalAlpha = 0.62;
    signFace(tk, x, y, bw, bh, false);
    ctx.globalAlpha = 1;
    return;
  }

  // 깬 지 얼마 안 됐으면 더 크게 벌어져 있다가 잦아든다
  const since = time - (stampAt.has(tk.id) ? stampAt.get(tk.id) : -99);
  const burst = since >= 0 && since < 0.55 ? Math.pow(1 - since / 0.55, 2) : 0;
  const spread = 1.6 + burst * 7;          // 두 쪽이 벌어진 거리
  const tilt = (0.03 + burst * 0.10);      // 기울기(라디안)

  // 톱니 균열 — 간판마다 다른 자리에서 갈라진다
  const mid = x + bw * (0.44 + rnd(tk.no * 3.3) * 0.16);
  const steps = 5;
  const crack = [];
  for (let k = 0; k <= steps; k++) {
    crack.push({
      x: mid + (rnd(tk.no * 7.7 + k) - 0.5) * 7,
      y: y + (bh * k) / steps
    });
  }

  const half = (side) => {
    ctx.save();
    // 바깥쪽 끝을 축으로 기울인다 — 가운데가 벌어져야 깨진 것으로 보인다
    const px = side < 0 ? x : x + bw;
    ctx.translate(px + side * spread, y + bh / 2);
    ctx.rotate(side * tilt);
    ctx.translate(-px, -(y + bh / 2));

    ctx.beginPath();
    if (side < 0) {
      ctx.moveTo(x - 2, y - 2);
      for (const p of crack) ctx.lineTo(p.x, p.y);
      ctx.lineTo(x - 2, y + bh + 2);
    } else {
      ctx.moveTo(x + bw + 2, y - 2);
      for (const p of crack) ctx.lineTo(p.x, p.y);
      ctx.lineTo(x + bw + 2, y + bh + 2);
    }
    ctx.closePath();
    ctx.clip();
    signFace(tk, x, y, bw, bh, true);

    // 갈라진 면 — 등급 색으로 긋는다
    ctx.strokeStyle = gradeColor(tk.grade);
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(crack[0].x, crack[0].y);
    for (const p of crack) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  };
  half(-1);
  half(1);
}

// ---------------------------------------------------------------- 공통

function drawPlate(cx, wide, top, plateH, text, cap) {
  // 명패. 숫자를 바닥에 바로 얹으면 대비를 다시 재야 하므로 판을 깔고 그 위에 쓴다.
  const pw = wide + 28;
  const x = cx - pw / 2;
  ctx.fillStyle = color.face;
  ctx.fillRect(x, top, pw, plateH);
  ctx.strokeStyle = color.edge;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, top + .5, pw - 1, plateH - 1);

  ctx.textBaseline = 'middle';
  ctx.font = `700 13px ${fontMono}`;
  ctx.fillStyle = color.title;
  ctx.globalAlpha = 0.88;
  ctx.textAlign = 'left';
  ctx.fillText(text, x + 10, top + plateH / 2 + 0.5);

  ctx.font = `500 11px ${fontBody}`;
  ctx.fillStyle = color.muted;
  ctx.globalAlpha = 0.75;
  ctx.textAlign = 'right';
  ctx.fillText(cap, x + pw - 10, top + plateH / 2 + 0.5);
  ctx.globalAlpha = 1;
}

function build() {
  pile = null; board = null;
  const app = document.getElementById('app');
  if (!app) return;
  const r = app.getBoundingClientRect();

  if (r.left >= GUTTER_MIN) pile = buildPile(r.left);
  const right = w - r.right;
  if (right >= GUTTER_MIN) board = buildBoard(r.right, right);
}

function draw(time) {
  ctx.clearRect(0, 0, w, h);
  const moving = !isReduced();

  if (pile) {
    drawPlate(pile.cx, pile.wide, pile.floor + 6, pile.plateH,
      `${pile.earned} / ${pile.total}`, '딴 용어');

    // 흐름 선 — 위에서 내려와 다음 책이 앉을 자리까지 이어진다.
    const nextSlot = pile.books.find(b => !b.real) || pile.books[pile.books.length - 1];
    if (nextSlot) {
      ctx.strokeStyle = color.flow;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(pile.cx, TOP);
      ctx.lineTo(pile.cx, nextSlot.y - 8);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    let newest = null;
    for (const b of pile.books) if (b.real) newest = b;

    for (const b of pile.books) {
      if (!b.real) {
        // 빈 자리는 아주 느리게 숨을 쉰다. "여기가 채워질 자리"라고 가리키는 것이지
        // 눈길을 끌자는 게 아니라서 폭을 좁게 잡았다.
        drawBook(b, moving ? 0.66 + 0.16 * Math.sin(time * 1.15 + b.y * 0.02) : 0.72, 0, false);
        continue;
      }
      const t0 = bornAt.has(b.label) ? bornAt.get(b.label) : 0;
      const since = moving ? time - t0 : FALL;
      if (since < 0) continue;                        // 아직 안 내려온 책
      // 흐름 선을 타고 내려와 앉는다. 끝으로 갈수록 느려지게 —
      // 등속으로 떨어지면 물건이 아니라 기계 부품처럼 보인다.
      const p = Math.min(1, since / FALL);
      const dy = Math.pow(1 - p, 3) * -(b.y - TOP);
      drawBook(b, Math.min(1, p * 1.8), dy, b === newest && p >= 1);
    }
  }

  if (board) {
    for (const tk of board.signs) drawSign(tk, moving ? time : 1e6);
    drawPlate(board.cx, board.wide, board.floor + 8, board.plateH,
      `${board.done} / ${board.total}`, board.onlyRequired ? '깬 필수 간판' : '깬 간판');
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
  // 그릴 자리가 없으면(좁은 화면) 아예 안 돈다. 휴대폰에서 배터리를 쓰지 않는다.
  if (raf || isReduced() || (!pile && !board)) return;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

/**
 * 판을 깼거나 용어를 새로 땄을 때 부른다. 새로 딴 책만 흐름 선을 타고 내려오고,
 * 이번에 깬 판에만 도장이 찍히는 연출이 붙는다.
 * @param {string} [clearedId] 방금 깬 판의 id
 */
export function refreshBackdrop(clearedId) {
  if (!canvas) return;
  if (clearedId && !stampAt.has(clearedId)) stampAt.set(clearedId, t);
  build();
  if (clearedId) stampAt.set(clearedId, t);   // 이미 있던 값(-99)을 지금으로 바꾼다
  draw(t);
  start();
}

/**
 * 종이 양옆에 진도판을 깔고 돌린다. 부팅 때 한 번만 부른다.
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

  // 글꼴이 늦게 오면 글자가 시스템 글꼴로 그려진 채 남는다. 오면 다시 그린다.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw(t));

  let tid = 0;
  window.addEventListener('resize', () => {
    clearTimeout(tid);
    tid = setTimeout(() => {
      resize();
      draw(t);
      if (pile || board) start(); else stop();
    }, 150);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });
}
