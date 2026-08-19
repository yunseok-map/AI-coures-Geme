// 공통 셸 — 종이 옆에서 쌓이는 책.
//
// 종이를 한 장으로 좁히고 나면 양옆이 빈다. 그 자리에 무엇을 둘지 세 번 갈아엎었다.
//   1) 등고선을 느리게 흘렸다 → 움직이긴 하는데 **무슨 일이 일어나는지가 없었다.**
//   2) 배선에 신호를 흘렸다 → 움직이는데 **이 코스가 하는 일과 상관이 없었고**,
//      네모와 납땜 자국이 쌓이니 배운 것이 아니라 전자 부품처럼 보였다.
//   3) 지금 것 — **흐름을 타고 내려온 책이 한 권씩 쌓인다.**
//
// 뒷그림을 고를 때 물어볼 것은 "예쁜가"가 아니라 **"여기서 무슨 일이 일어나는가"**다.
// 이 코스가 하는 일이 판을 하나씩 깨서 아는 것을 쌓는 것이라, 그림도 그것이다.
//   - 위에서 흐름 선이 내려온다. 책 한 권이 그 선을 타고 내려와 더미에 얹힌다.
//   - 얹히면 흐름 선이 그 책까지 이어져 다음 권을 부른다.
//   - 예닐곱 권이 쌓이면 잠깐 그대로 있다가 흐려지고, 다시 밑에서 쌓는다.
//   - 방금 얹힌 책만 테두리가 진하다 — 지금 어디까지 왔는지가 그림으로 보인다.
//
// 지켜야 할 것 넷:
//   1) **글자 뒤에서 돌지 않는다.** 종이 바깥 여백(양옆)에만 쌓는다.
//      좁은 화면에서는 종이가 화면을 꽉 채우므로 **아무것도 그리지 않고 멈춘다.**
//   2) **싸야 한다.** 실시간 판(13·14번)이 도는 동안에도 같이 돈다.
//      책 열댓 권이면 프레임당 1ms 안쪽이다.
//   3) 움직임을 줄여 달라는 설정이면 **다 쌓인 더미만 한 장 그리고 멈춘다.**
//      탭이 뒤로 가도 멈춘다.
//   4) 색은 tokens.css 에서 읽는다. 이 파일에 색값을 적지 않는다.

import { isReduced } from '../core/motion.js';

const FPS = 30;
const GUTTER_MIN = 108;  // 이보다 좁은 여백에는 아무것도 안 쌓는다 — 책이 잘려 보인다
const FALL = 0.85;       // 책 한 권이 내려와 앉는 데 걸리는 시간(초)
const PER = 1.5;         // 다음 권이 출발하기까지
const HOLD = 2.6;        // 다 쌓고 그대로 있는 시간
const FADE = 1.2;        // 흐려지는 시간

let canvas = null, ctx = null, raf = 0, last = 0, t = 0;
let w = 0, h = 0, dpr = 1;
let piles = [];
let color = { flow: '', lit: '', face: '', edge: '', band: '' };

function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  const get = (n, d) => cs.getPropertyValue(n).trim() || d;
  color.flow = get('--trace', 'rgba(11,93,138,.26)');
  color.lit = get('--trace-lit', 'rgba(11,93,138,.72)');
  color.face = get('--book-face', 'rgba(250,248,245,.82)');
  color.edge = get('--book-edge', 'rgba(19,26,38,.30)');
  color.band = get('--book-band', 'rgba(11,93,138,.42)');
}

/* 책 크기를 조금씩 다르게 한다. 다 같으면 무늬가 되고, 무늬는 시선을 가져간다.
   새로고침마다 배치가 달라지면 그것도 시선을 끄니 자리에서 뽑는 난수를 쓴다. */
function rnd(seed) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function build() {
  piles = [];
  const app = document.getElementById('app');
  if (!app) return;
  const r = app.getBoundingClientRect();
  const gut = [
    { x0: 0, x1: r.left, seed: 3.7 },
    { x0: r.right, x1: w, seed: 11.2 }
  ];

  for (const g of gut) {
    const width = g.x1 - g.x0;
    if (width < GUTTER_MIN) continue;      // 좁으면 안 쌓는다 (휴대폰에서 여기서 끝)

    const wide = Math.min(width * 0.6, 132);
    const cx = (g.x0 + g.x1) / 2;
    const floor = h - 64;                  // 더미가 놓인 바닥
    const books = [];
    let top = floor;
    // 화면 높이가 되는 데까지 쌓되 위쪽에 여유를 남긴다.
    for (let i = 0; i < 9 && top > 150; i++) {
      const s = g.seed + i * 5.1;
      const bh = 13 + Math.round(rnd(s) * 7);          // 두께가 다른 책들
      const bw = wide * (0.7 + rnd(s + 1) * 0.3);
      top -= bh + 2;                                    // 2px 는 책 사이 틈
      books.push({
        x: cx - bw / 2 + (rnd(s + 2) - 0.5) * wide * 0.12,
        y: top, w: bw, h: bh,
        spineLeft: rnd(s + 3) < 0.5                     // 책등이 어느 쪽을 보는가
      });
    }
    if (books.length < 4) continue;
    piles.push({
      books, cx,
      cycle: books.length * PER + HOLD + FADE,
      buildEnd: books.length * PER,
      // 양쪽이 같이 쌓으면 행진이 된다. 한쪽을 늦춘다.
      offset: rnd(g.seed) * 7
    });
  }
}

function drawBook(b, alpha, dy, strong) {
  ctx.globalAlpha = alpha;
  const y = b.y + dy;

  // 책 옆면
  ctx.fillStyle = color.face;
  ctx.fillRect(b.x, y, b.w, b.h);
  ctx.strokeStyle = strong ? color.lit : color.edge;
  ctx.lineWidth = strong ? 1.6 : 1;
  ctx.strokeRect(b.x + .5, y + .5, b.w - 1, b.h - 1);

  // 책등의 띠 두 줄. 이것 하나로 네모가 "책"이 된다.
  ctx.fillStyle = color.band;
  const sx = b.spineLeft ? b.x + 5 : b.x + b.w - 8;
  ctx.fillRect(sx, y + 3, 3, b.h - 6);
  ctx.fillRect(sx + (b.spineLeft ? 5 : -5), y + 4, 1, b.h - 8);

  // 반대쪽은 책배 — 종이 묶음이 보이는 자리라 가는 선 하나로 긋는다.
  ctx.strokeStyle = color.edge;
  ctx.lineWidth = 1;
  const px = b.spineLeft ? b.x + b.w - 3.5 : b.x + 3.5;
  ctx.beginPath();
  ctx.moveTo(px, y + 2.5);
  ctx.lineTo(px, y + b.h - 2.5);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

function draw(time) {
  ctx.clearRect(0, 0, w, h);
  if (!piles.length) return;
  const moving = !isReduced();

  for (const pile of piles) {
    // 움직임을 줄여 달라는 설정에서는 다 쌓인 더미로 세워 둔다.
    const phase = moving ? (time + pile.offset) % pile.cycle : pile.buildEnd;
    const overHold = phase - pile.buildEnd - HOLD;
    const fade = overHold > 0 ? Math.max(0, 1 - overHold / FADE) : 1;
    const landed = Math.min(pile.books.length - 1, Math.floor(phase / PER));

    // 흐름 선 — 위에서 내려와 지금 쌓인 데까지 이어진다. 다음 권이 올 길이다.
    const reach = pile.books[Math.max(0, Math.min(landed, pile.books.length - 1))];
    if (reach) {
      ctx.globalAlpha = fade;
      ctx.strokeStyle = color.flow;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(pile.cx, 90);
      ctx.lineTo(pile.cx, reach.y - 6);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    for (let i = 0; i < pile.books.length; i++) {
      const b = pile.books[i];
      const since = phase - i * PER;
      if (since < 0) continue;                       // 아직 안 내려온 책

      // 흐름 선을 타고 내려와 앉는다. 끝으로 갈수록 느려지게 —
      // 물건이 놓이는 모양이고, 등속으로 떨어지면 기계 부품처럼 보인다.
      const p = Math.min(1, since / FALL);
      const eased = 1 - Math.pow(1 - p, 3);
      const dy = (1 - eased) * -(b.y - 90);          // 위(흐름 선 시작)에서 제자리로

      drawBook(b, Math.min(1, p * 1.6) * fade, dy,
        moving && i === landed && phase < pile.buildEnd + HOLD);
    }
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
  // 초당 30장으로 묶는다. 120Hz 화면에서 네 배로 그릴 그림이 아니다.
  if (now - last < 1000 / FPS) return;
  t += (now - last) / 1000;
  last = now;
  draw(t);
}

function start() {
  // 쌓을 자리가 없으면(좁은 화면) 아예 안 돈다. 휴대폰에서 배터리를 쓰지 않는다.
  if (raf || isReduced() || !piles.length) return;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

/**
 * 종이 옆에 쌓이는 그림을 깔고 돌린다. 부팅 때 한 번만 부른다.
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

  let tid = 0;
  window.addEventListener('resize', () => {
    clearTimeout(tid);
    tid = setTimeout(() => {
      resize();
      draw(t);
      if (piles.length) start(); else stop();
    }, 150);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });
}
