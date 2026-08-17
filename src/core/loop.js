// 실시간 루프 — 액션 엔진(디펜스·슈팅·벨트)이 공유한다.
//
// 왜 따로 있나: 루프를 엔진마다 직접 쓰면 같은 함정을 세 번 각각 밟는다.
//
// 왜 requestAnimationFrame 을 쓰지 않나 (실제로 겪은 문제다):
//   rAF 는 브라우저가 "그릴 필요 없다"고 판단하면 아예 호출되지 않는다.
//   탭을 벗어난 경우뿐 아니라 **창이 다른 창에 가려지기만 해도** 멈춘다.
//   그런데 그때 document.hidden 은 여전히 false 라서 탭 감지로는 못 잡는다.
//   → 사용자가 브라우저 위에 다른 창을 올리면 게임이 조용히 얼어붙는다.
//   타이머는 그 상황에서도 계속 돌기 때문에 시간은 타이머로 잰다.
//   (PROGRESS.md 의 "백그라운드 탭에서 rAF 가 멈춘다"와 같은 계열의 사고다.)
//
// 그리고:
//   - 프레임 시간을 안 재면 느린 기기에서 게임 속도가 달라진다 → dt 로 움직인다.
//   - unmount 에서 루프를 안 끊으면 화면을 나가도 계속 돈다 → stop() 이 다 뗀다.
//
// 움직임을 줄여 달라는 설정(prefers-reduced-motion)에서는 간격을 크게 잡아
// 한 칸씩 점프하게 한다. 게임 규칙은 그대로 성립하고 화면만 덜 움직인다.

import { isReduced } from './motion.js';

const FRAME_MS = 33;    // 30fps. 교육용 판정 게임에 충분하고 느린 기기에서도 안 밀린다.

// 한 번에 이보다 많이 흐른 것으로는 치지 않는다. 잠깐 버벅인 정도는 이 안에서 흡수한다 —
// 사양 낮은 사무용 노트북에서 흔한 일이고, 그때마다 게임을 멈춰 세우면 못 쓴다.
const MAX_DT = 0.25;

// 이보다 오래 건너뛰었으면 버벅임이 아니라 브라우저가 창을 멈춰 세운 것이다.
// 그만큼 진행시키면 안 본 사이에 사고가 나 있다 — 진행하지 않고 멈춰서 알린다.
const STALL_DT = 1.5;

/**
 * @param {(dt:number)=>void} step  dt 는 초 단위
 * @param {object} opts  { onPause, onResume, stepMs }
 */
export function createLoop(step, opts = {}) {
  const onPause = opts.onPause || (() => {});
  const onResume = opts.onResume || (() => {});
  const stepMs = opts.stepMs ?? 220;

  let timer = 0, last = 0;
  let running = false, paused = false;

  function tick() {
    if (!running || paused) return;
    const now = performance.now();
    const raw = last ? (now - last) / 1000 : 0;
    last = now;

    // 오래 건너뛰었다 = 브라우저가 이 창을 멈춰 세웠다.
    // 그만큼 진행시켜 버리면 안 본 사이에 사고가 나 있다 — 억울하다.
    // 진행하지 않고 멈춰서 사용자가 직접 이어서 누르게 한다.
    if (raw > STALL_DT) { pause(); return; }

    step(Math.min(raw, MAX_DT));
  }

  function begin() {
    last = 0;
    timer = setInterval(tick, isReduced() ? stepMs : FRAME_MS);
  }

  function halt() {
    if (timer) { clearInterval(timer); timer = 0; }
  }

  function pause() {
    if (!running || paused) return;
    paused = true;
    halt();
    onPause();
  }

  function resume() {
    if (!running || !paused) return;
    paused = false;
    begin();
    onResume();
  }

  // 탭을 벗어난 경우는 즉시 반응한다(타이머가 1초에 한 번으로 줄기 전에).
  function onVisibility() {
    if (document.hidden) pause();
  }
  document.addEventListener('visibilitychange', onVisibility);

  return {
    start() {
      if (running) return;
      running = true; paused = false;
      begin();
    },
    stop() {
      running = false; paused = false;
      halt();
      document.removeEventListener('visibilitychange', onVisibility);
    },
    pause, resume,
    get running() { return running; },
    get paused() { return paused; },
    /** 한 칸씩 점프하는 모드인가 — 엔진이 연출 강도를 줄일 때 본다 */
    get isStepped() { return isReduced(); }
  };
}
