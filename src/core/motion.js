// 모션. anime.js 를 여기서만 import 한다 — 다른 파일은 이 파일의 프리셋만 쓴다.
//
// 원칙 (GAME_SPEC.md §3):
//   - 움직임은 뜻이 있을 때만. 장식용 애니메이션은 넣지 않는다.
//   - "AI가 일하는 중"과 "판정 순간"이 주역이다.
//   - prefers-reduced-motion 을 켠 사람에게는 전부 즉시 최종 상태로 보여 준다.
//
// 라이브러리는 assets/vendor/ 에 들어 있다. CDN 을 쓰지 않는다(사내망 차단 대비).

import { animate, stagger, createTimeline, utils }
  from '../../assets/vendor/anime.esm.min.js';
import { strong } from './text.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
export const isReduced = () => reduced.matches;

/** 움직임을 끈 사람에게는 최종 상태만 즉시 적용한다 */
function still(targets, endState) {
  if (endState) utils.set(targets, endState);
  return { then: (fn) => { fn && fn(); return Promise.resolve(); }, complete: Promise.resolve() };
}

// ---------------------------------------------------------------- 등장

/** 목록이 차례로 올라온다. 코스맵 노드, 통, 카드 목록에 쓴다. */
export function enter(targets, opts = {}) {
  const list = toList(targets);
  if (!list.length) return Promise.resolve();

  // 최종 상태 = 그냥 보이는 상태. 모션이 어떤 이유로든 안 돌면 이걸로 끝난다.
  const show = () => utils.set(list, { opacity: 1, translateY: 0, scale: 1 });
  if (isReduced()) { show(); return Promise.resolve(); }

  const duration = opts.duration ?? 380;
  const each = opts.each ?? 45;

  // 백그라운드 탭에서는 브라우저가 rAF 를 멈춘다 → 애니메이션이 시작 프레임(투명)에
  // 멈춘 채로 남는다. 그러면 화면이 통째로 비어 보인다. 실제로 겪은 증상이라
  // 안전망을 둔다: 예상 시간이 지나도 안 끝났으면 그냥 보여 준다.
  const guard = setTimeout(show, duration + each * list.length + 600);

  return animate(list, {
    opacity: [0, 1],
    translateY: [opts.from ?? 10, 0],
    scale: [opts.scale ?? 0.98, 1],
    duration,
    delay: stagger(each, { start: opts.start ?? 0 }),
    ease: 'outBack(1.4)'
  }).then(() => { clearTimeout(guard); show(); });
}

/** 한 장짜리 등장 — 티켓이 바뀔 때 */
export function cardIn(el) {
  if (!el) return Promise.resolve();
  const show = () => utils.set(el, { opacity: 1, translateY: 0, rotate: 0 });
  if (isReduced()) { show(); return Promise.resolve(); }
  const guard = setTimeout(show, 900);
  return animate(el, {
    opacity: [0, 1], translateY: [14, 0], rotate: [-0.4, 0],
    duration: 320, ease: 'outExpo'
  }).then(() => { clearTimeout(guard); show(); });
}

/** 처리 끝난 티켓이 옆으로 빠진다 */
/**
 * 답을 낸 카드를 "처리 완료" 상태로 가라앉힌다.
 *
 * 카드를 화면 밖으로 날려 버리면 질문이 사라져서, 해설을 읽는 동안
 * 뭘 물어봤는지 다시 위로 올라가 확인해야 한다. 게다가 카드가 있던 자리가
 * 빈 구멍으로 남는다. 그래서 날리지 않고 살짝 밀린 채 흐려지게만 한다.
 */
export function settle(node, ok = true) {
  if (!node) return Promise.resolve();
  node.classList.add(ok ? 'ticket--ok' : 'ticket--no');
  if (isReduced()) return Promise.resolve();
  return animate(node, {
    translateX: [0, ok ? 10 : -10],
    scale: [1, .97],
    opacity: [1, .62],
    duration: 220, ease: 'outQuad'
  });
}

export function cardOut(el, ok = true) {
  if (!el) return Promise.resolve();
  if (isReduced()) return Promise.resolve();
  return animate(el, {
    opacity: [1, 0],
    translateX: ok ? [0, 40] : [0, -40],
    rotate: ok ? [0, 2] : [0, -2],
    duration: 200, ease: 'inQuad'
  });
}

// ---------------------------------------------------------------- 판정

/** 도장이 찍힌다. 이 게임의 시그니처 모션. */
export function stamp(el) {
  if (!el) return Promise.resolve();
  const show = () => utils.set(el, { opacity: 1, scale: 1, rotate: -6 });
  if (isReduced()) { show(); return Promise.resolve(); }

  const guard = setTimeout(show, 1400);   // 모션이 안 돌아도 도장은 보여야 한다
  const tl = createTimeline();
  tl.add(el, {
    opacity: [0, 1],
    scale: [2.1, 0.94],
    rotate: [-16, -6],
    duration: 260,
    ease: 'outExpo'
  })
  .add(el, { scale: [0.94, 1.03, 1], duration: 300, ease: 'outElastic(1, .6)' }, '-=40');
  tl.then(() => clearTimeout(guard));
  return tl;
}

/** 오답 — 좌우로 짧게 흔든다 */
export function shake(el) {
  if (!el || isReduced()) return Promise.resolve();
  return animate(el, {
    translateX: [0, -7, 6, -4, 2, 0],
    duration: 300,
    ease: 'inOutQuad'
  });
}

/** 정답 — 짧게 눌렸다 돌아온다 */
export function press(el) {
  if (!el || isReduced()) return Promise.resolve();
  return animate(el, { scale: [1, 0.965, 1], duration: 200, ease: 'outQuad' });
}

/** 숫자가 올라간다 — 점수 */
export function countUp(el, to, opts = {}) {
  if (!el) return Promise.resolve();
  const show = () => { el.textContent = String(to) + (opts.suffix || ''); };
  if (isReduced()) { show(); return Promise.resolve(); }

  const duration = opts.duration ?? 700;
  const guard = setTimeout(show, duration + 600);   // 숫자가 0에 멈춰 있으면 안 된다
  const box = { v: opts.from ?? 0 };
  return animate(box, {
    v: to, duration, ease: 'outExpo',
    onUpdate: () => { el.textContent = Math.round(box.v) + (opts.suffix || ''); }
  }).then(() => { clearTimeout(guard); show(); });
}

/**
 * 진행도 막대.
 *
 * 안전망이 있어야 한다. 애니메이션이 시작 프레임에 얼어붙으면 막대가 **0% 에 멈춘다** —
 * 그러면 진행도가 있는데도 아무것도 안 한 것처럼 보인다. 실제로 겪었다:
 * 창이 가려진 상태에서는 rAF 가 안 돌아서 4/68 인데 빈 막대가 나왔다.
 * (PROGRESS.md 의 "모션에는 setTimeout 안전망을 같이 넣는다"와 같은 계열)
 */
export function fillBar(el, pct) {
  if (!el) return Promise.resolve();
  // 0 이 아니면 표시를 남긴다. 68개 중 1개는 1.5% 라 화면에서 안 보이는데,
  // 빈 막대는 "아직 아무것도 없다"로 읽혀서 모으기를 포기하게 만든다.
  // CSS 가 이 클래스에 최소 폭을 준다. 인라인 style 문자열을 선택자로 보는 방법은
  // 공백 표기(`width:0%` vs `width: 0%`)에 따라 깨져서 쓰지 않는다.
  el.classList.toggle('bar--some', pct > 0);
  const show = () => { el.style.width = pct + '%'; };
  if (isReduced()) { show(); return Promise.resolve(); }
  const guard = setTimeout(show, 520 + 600);
  return animate(el, { width: pct + '%', duration: 520, ease: 'outExpo' })
    .then(() => { clearTimeout(guard); show(); });
}

// ---------------------------------------------------------------- 실행 로그

/**
 * "AI가 일하는 중" — 로그가 한 줄씩 흐른다.
 * 이 게임에서 가장 중요한 연출이다. 내가 세팅한 대로 AI가 움직이는 걸 눈으로 본다.
 *
 * @param {HTMLElement} host  줄이 쌓일 곳
 * @param {Array}  steps      [{ text, kind, ms }]
 * @param {object} opts       { onStep(step, i), signal }
 */
export async function runLog(host, steps, opts = {}) {
  const speed = isReduced() ? 0 : 1;

  for (let i = 0; i < steps.length; i++) {
    if (opts.signal?.aborted) return;
    const step = steps[i];

    const line = document.createElement('div');
    line.className = 'log__line log__line--' + (step.kind || 'do');
    line.innerHTML =
      `<span class="log__tick" aria-hidden="true"></span>` +
      `<span class="log__text"></span>`;
    host.append(line);

    const body = line.querySelector('.log__text');
    const html = strong(step.text);
    const ms = step.ms ?? 420;

    if (speed) {
      const settle = () => utils.set(line, { opacity: 1, translateY: 0 });
      const g = setTimeout(settle, 700);      // 로그 줄이 투명한 채로 남지 않게
      animate(line, { opacity: [0, 1], translateY: [6, 0], duration: 180, ease: 'outQuad' })
        .then(() => { clearTimeout(g); settle(); });
      // 글자가 찍히는 동안 커서가 깜빡인다 — "지금 AI가 쓰고 있다"는 느낌의 전부다
      line.classList.add('is-typing');
      typeIn(body, html, { duration: Math.min(ms * 0.7, step.text.length * 22) })
        .then(() => line.classList.remove('is-typing'));
    } else {
      body.innerHTML = html;
    }

    host.scrollTop = host.scrollHeight;
    opts.onStep && opts.onStep(step, i);

    await wait(ms * speed);
  }
}

/** 돌아가는 표시기 — 로그가 흐르는 동안 */
export function spin(el, on) {
  if (!el) return;
  el.classList.toggle('is-working', Boolean(on));
  if (isReduced() || !on) return;
  animate(el, { rotate: '1turn', duration: 900, loop: true, ease: 'linear' });
}

// ---------------------------------------------------------------- 화면 전환

/** 화면이 바뀔 때. 왼쪽에서 들어오면 전진, 오른쪽이면 뒤로 가는 느낌이다. */
export function stageIn(el, back = false) {
  if (!el) return Promise.resolve();
  const show = () => utils.set(el, { opacity: 1, translateX: 0 });
  if (isReduced()) { show(); return Promise.resolve(); }
  const guard = setTimeout(show, 900);
  return animate(el, {
    opacity: [0, 1], translateX: [back ? -18 : 18, 0],
    duration: 300, ease: 'outQuad'
  }).then(() => { clearTimeout(guard); show(); });
}

// ---------------------------------------------------------------- 손맛

/** 눌린 자리에서 파문이 퍼진다 */
export function ripple(host, x, y) {
  if (!host || isReduced()) return;
  const r = document.createElement('span');
  r.className = 'ripple';
  const box = host.getBoundingClientRect();
  const size = Math.max(box.width, box.height) * 1.6;
  r.style.width = r.style.height = size + 'px';
  r.style.left = ((x ?? box.width / 2) - size / 2) + 'px';
  r.style.top = ((y ?? box.height / 2) - size / 2) + 'px';
  host.append(r);
  setTimeout(() => r.remove(), 700);
  animate(r, { scale: [0.25, 1], opacity: [0.34, 0], duration: 560, ease: 'outQuad' });
}

/** 부품이 집어든 자리에서 놓인 자리로 날아간다 (FLIP) */
export function flyTo(fromEl, toEl) {
  if (!fromEl || !toEl || isReduced()) return Promise.resolve();
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  const dx = a.left - b.left, dy = a.top - b.top;
  if (!dx && !dy) return Promise.resolve();
  const settle = () => utils.set(toEl, { translateX: 0, translateY: 0, scale: 1, opacity: 1 });
  const guard = setTimeout(settle, 900);
  return animate(toEl, {
    translateX: [dx, 0], translateY: [dy, 0],
    scale: [Math.max(0.6, a.width / Math.max(b.width, 1)), 1],
    opacity: [0.65, 1],
    duration: 420, ease: 'outCubic'
  }).then(() => { clearTimeout(guard); settle(); });
}

/**
 * 딴 것이 모이는 곳으로 날아간다 — 용어 칩 → 상단바 카운터.
 *
 * flyTo 와 다르다. 저쪽은 **목표 요소 자체**를 출발 위치에서 끌어오는 FLIP 이고,
 * 이쪽은 출발 요소는 그 자리에 두고 **복제본 하나만** 날려 보낸다.
 * 모은 것이 어디로 쌓이는지 눈으로 잇는 게 목적이라 원본이 남아 있어야 한다.
 *
 * 복제본은 body 에 붙이고 끝나면 반드시 지운다. 애니메이션이 시작 프레임에
 * 얼어붙는 경우가 있어서 setTimeout 안전망을 같이 둔다 — 안 그러면
 * 화면 위에 조각이 영구히 남는다.
 */
export function sendTo(fromEl, toEl, label) {
  if (!fromEl || !toEl || isReduced()) return Promise.resolve();
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  if (!a.width || !b.width) return Promise.resolve();

  const ghost = document.createElement('div');
  ghost.className = 'flyer';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.textContent = label == null ? fromEl.textContent : label;
  ghost.style.left = a.left + 'px';
  ghost.style.top = a.top + 'px';
  document.body.append(ghost);

  const drop = () => ghost.remove();
  const guard = setTimeout(drop, 1200);
  return animate(ghost, {
    translateX: (b.left + b.width / 2) - (a.left + a.width / 2),
    translateY: (b.top + b.height / 2) - (a.top + a.height / 2),
    scale: [1, 0.45],
    opacity: [1, 1, 0],
    duration: 620, ease: 'inOutQuad'
  }).then(() => { clearTimeout(guard); drop(); });
}

/** 눈길을 한 번 끌어야 할 때 — 실행 버튼이 살아났다든지 */
export function pulse(el, times = 2) {
  if (!el || isReduced()) return Promise.resolve();
  return animate(el, {
    scale: [1, 1.045, 1], duration: 480, loop: times, ease: 'inOutQuad'
  });
}

/** 가로로 쓸어내리며 나타난다 — 배치한 칸이 채워질 때 */
export function wipeIn(el) {
  if (!el) return Promise.resolve();
  const show = () => utils.set(el, { opacity: 1, scaleX: 1 });
  if (isReduced()) { show(); return Promise.resolve(); }
  const guard = setTimeout(show, 800);
  return animate(el, {
    opacity: [0.2, 1], scaleX: [0.2, 1], duration: 340, ease: 'outExpo'
  }).then(() => { clearTimeout(guard); show(); });
}

/** 글자가 타자기처럼 찍힌다 — 결과물이 다시 쓰이는 순간 */
export function typeIn(el, html, opts = {}) {
  if (!el) return Promise.resolve();
  if (isReduced()) { el.innerHTML = html; return Promise.resolve(); }

  // 태그는 건드리지 않고 글자 수만 늘려 간다
  const plain = String(html);
  el.innerHTML = '';
  const box = { n: 0 };
  const total = plain.length;
  const guard = setTimeout(() => { el.innerHTML = plain; }, (opts.duration ?? 520) + 700);
  return animate(box, {
    n: total, duration: opts.duration ?? 520, ease: 'linear',
    onUpdate: () => { el.innerHTML = clip(plain, Math.round(box.n)); }
  }).then(() => { clearTimeout(guard); el.innerHTML = plain; });
}

/** 태그 한가운데서 자르지 않도록 잘라 준다 */
function clip(html, n) {
  let out = '', shown = 0, i = 0;
  while (i < html.length && shown < n) {
    if (html[i] === '<') { const end = html.indexOf('>', i); out += html.slice(i, end + 1); i = end + 1; continue; }
    out += html[i]; i++; shown++;
  }
  return out;
}

/** 승인 도장이 찍힐 때 종이 조각이 튄다. 100점에서만 쓴다 — 흔해지면 의미가 없다. */
export function burst(anchor, count = 14) {
  if (!anchor || isReduced()) return;
  const box = anchor.getBoundingClientRect();
  const host = document.createElement('div');
  host.className = 'burst';
  host.style.left = (box.left + box.width / 2) + 'px';
  host.style.top = (box.top + box.height / 2) + 'px';
  document.body.append(host);

  const bits = [];
  for (let i = 0; i < count; i++) {
    const b = document.createElement('i');
    b.className = 'burst__bit burst__bit--' + (i % 3);
    host.append(b);
    bits.push(b);
  }
  const seed = (i) => Math.sin(i * 12.9898) * 43758.5453;   // 난수 대신 고정 패턴
  animate(bits, {
    translateX: (el, i) => [0, ((seed(i) % 1) - 0.5) * 240],
    translateY: (el, i) => [0, -60 - Math.abs((seed(i + 7) % 1)) * 150],
    rotate: (el, i) => [0, ((seed(i + 3) % 1) - 0.5) * 720],
    opacity: [1, 0],
    duration: 900,
    delay: stagger(14),
    ease: 'outQuad'
  }).then(() => host.remove());
  setTimeout(() => host.remove(), 1800);
}

// ---------------------------------------------------------------- 도우미

export function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function toList(t) {
  if (!t) return [];
  if (typeof t === 'string') return [...document.querySelectorAll(t)];
  // NodeList·HTMLCollection 도 그대로 받는다 (querySelectorAll 결과를 자주 넘긴다)
  if (Array.isArray(t)) return t.filter(Boolean);
  if (typeof t.length === 'number' && typeof t !== 'function') return [...t].filter(Boolean);
  return [t];
}

export { animate, stagger, createTimeline, utils };
