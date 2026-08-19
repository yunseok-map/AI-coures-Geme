// 공통 셸 — 종이 뒤의 바닥.
//
// 종이가 화면 전체를 덮고 있어서 화면이 문서처럼 보였다. 종이를 한 장으로
// 좁히고 나면 그 뒤가 비는데, 그 자리를 단색으로 두면 그냥 어두운 여백이다.
// 여기서 도는 것은 **등고선**이다 — 이 게임이 다루는 물건(배선·게이지·지형)이
// 사는 곳이 도면이고, 도면에서 바닥을 읽는 방법이 등고선이다.
//
// 지켜야 할 것 셋:
//   1) **글자 뒤에서 돌지 않는다.** 종이는 불투명하다. 여기는 종이 바깥이다.
//   2) **싸야 한다.** 실시간 판(13·14번)이 도는 동안에도 같이 돈다.
//      선 열여덟 줄 · 한 줄에 점 90개 · 초당 30장이면 프레임당 1ms 안쪽이다.
//   3) **움직임을 줄여 달라는 설정에서는 한 장만 그리고 멈춘다.**
//      탭이 뒤로 가도 멈춘다 — 안 보이는 화면을 그리느라 배터리를 쓰지 않는다.
//
// 색은 tokens.css 에서 읽어 온다(--table · --trace · --trace-lit).
// 이 파일에 색값을 적지 않는다.

import { isReduced } from '../core/motion.js';

const LINES = 18;      // 등고선 줄 수
const STEP = 14;       // 한 줄을 그릴 때 점 사이 간격(px). 촘촘할수록 부드럽고 비싸다
const INDEX_EVERY = 5; // 진한 계곡선 — 실제 지형도도 몇 줄마다 한 줄을 굵게 긋는다
const FPS = 30;

let canvas = null, ctx = null, raf = 0, last = 0, t = 0;
let w = 0, h = 0, dpr = 1;
let color = { line: 'rgba(122,174,214,.13)', lit: 'rgba(150,205,245,.40)' };

/** 지금 토큰 값을 읽어 둔다. 색을 tokens.css 한 곳에서만 정하려고. */
function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  const line = cs.getPropertyValue('--trace').trim();
  const lit = cs.getPropertyValue('--trace-lit').trim();
  if (line) color.line = line;
  if (lit) color.lit = lit;
}

function resize() {
  // 화면이 클수록 픽셀이 많아지는데, 이 그림은 흐릿해도 되는 것이라
  // 배율을 1.5 로 묶는다. 4K 에서 픽셀 네 배를 그릴 이유가 없다.
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  // **크기는 캔버스 자신의 상자에서 읽는다.** `window.innerWidth` 는 세로 스크롤
  // 막대까지 세기 때문에, 막대가 있는 화면에서 캔버스가 그만큼 넓어져
  // 가로 스크롤이 생긴다(360px 검사에서 잡혔다). 자리는 CSS 의 inset:0 이 잡고,
  // 여기서는 그 자리에 맞춰 그림 크기만 맞춘다.
  const r = canvas.getBoundingClientRect();
  w = Math.round(r.width);
  h = Math.round(r.height);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * 한 줄의 높이. 주기가 다른 물결 셋을 겹친다 — 하나만 쓰면 규칙이 보이고,
 * 규칙이 보이는 순간 무늬가 되어 시선을 가져간다.
 * @param {number} x 화면 가로 위치(px)
 * @param {number} i 몇 번째 줄인가
 * @param {number} time 흐른 시간(초)
 */
function heightAt(x, i, time) {
  const a = Math.sin(x * 0.0042 + i * 0.55 + time * 0.11) * 26;
  const b = Math.sin(x * 0.0011 - i * 0.23 + time * 0.07) * 44;
  const c = Math.sin(x * 0.0090 + i * 1.30 - time * 0.16) * 9;
  return a + b + c;
}

function draw(time) {
  ctx.clearRect(0, 0, w, h);

  // 훑고 지나가는 자리. 등고선을 다 밝히면 무늬가 되고, 한 자리만 밝히면
  // 무언가 지나가는 것으로 읽힌다. 40초에 한 번 왼쪽에서 오른쪽으로 지난다.
  const sweep = ((time % 40) / 40) * (w + 600) - 300;

  const gap = (h + 200) / LINES;
  const drift = (time * 5) % gap;   // 줄 전체가 아주 느리게 위로 흐른다

  for (let i = 0; i < LINES; i++) {
    const baseY = h + 100 - i * gap - drift;
    if (baseY < -80 || baseY > h + 120) continue;

    const index = i % INDEX_EVERY === 0;
    ctx.beginPath();
    for (let x = -STEP; x <= w + STEP; x += STEP) {
      const y = baseY + heightAt(x, i, time);
      if (x <= -STEP) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineWidth = index ? 1.6 : 1;
    ctx.strokeStyle = color.line;
    ctx.stroke();

    // 훑는 자리에서만 같은 줄을 한 번 더, 밝게. 폭 220px 안쪽만 다시 그린다.
    const x0 = Math.max(-STEP, sweep - 110);
    const x1 = Math.min(w + STEP, sweep + 110);
    if (x1 > x0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, 0, x1 - x0, h);
      ctx.clip();
      ctx.beginPath();
      for (let x = x0 - STEP; x <= x1 + STEP; x += STEP) {
        const y = baseY + heightAt(x, i, time);
        if (x <= x0 - STEP) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineWidth = index ? 1.8 : 1.2;
      ctx.strokeStyle = color.lit;
      ctx.stroke();
      ctx.restore();
    }
  }
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
  if (raf || isReduced()) return;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

/**
 * 종이 뒤 바닥을 깔고 돌린다. 부팅 때 한 번만 부른다.
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
  draw(0);          // 움직임을 줄여 달라는 설정에서도 이 한 장은 남는다
  start();

  let tid = 0;
  window.addEventListener('resize', () => {
    clearTimeout(tid);
    tid = setTimeout(() => { resize(); draw(t); }, 150);
  });
  // 안 보이는 화면을 그리지 않는다.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });
}
