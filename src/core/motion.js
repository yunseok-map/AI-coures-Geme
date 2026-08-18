// 모션. GSAP 을 여기서만 import 한다 — 다른 파일은 이 파일의 프리셋만 쓴다.
//
// 원칙 (GAME_SPEC.md §3):
//   - 움직임은 뜻이 있을 때만. 장식용 애니메이션은 넣지 않는다.
//   - "AI가 일하는 중"과 "판정 순간"이 주역이다.
//   - prefers-reduced-motion 을 켠 사람에게는 전부 즉시 최종 상태로 보여 준다.
//
// 라이브러리는 assets/vendor/gsap/ 에 들어 있다. CDN 을 쓰지 않는다(사내망 차단 대비).
//
// --- anime.js 에서 옮겨 온 이유 (2026-08-18)
// 물건이 A자리에서 B자리로 옮겨가는 연출을 손으로 계산하고 있었다
// (getBoundingClientRect 로 좌표를 재서 복제본을 날리는 방식). 1·9·16번이 전부
// "물건을 옮기는" 판이라 여기서 티가 났다. Flip 은 그 계산을 브라우저가 하게 한다 —
// 크기·위치·회전이 다 바뀌어도 어긋나지 않는다.
//
// --- 이 파일을 고칠 때 반드시 지킬 것
// 1) **모든 연출에 setTimeout 안전망을 같이 둔다.** 창이 가려지면 브라우저가
//    rAF 를 멈춘다 → 애니메이션이 첫 프레임(투명·0%)에 얼어붙는다. 실제로 겪었다:
//    진행도가 4/68 인데 빈 막대가 나왔고, 목록이 통째로 안 보였다.
// 2) **body 에 붙인 복제본은 끝나면 반드시 지운다.** 안 지우면 조각이 화면에 영구히 남는다.
// 3) 시간 단위가 다르다. anime 는 ms, **GSAP 은 초**다. 여기 상수는 ms 로 적고
//    넘길 때 나눈다 — 다른 파일(engines/loop)이 전부 ms 로 말하기 때문이다.

import gsap from '../../assets/vendor/gsap/gsap.esm.js';
import Flip from '../../assets/vendor/gsap/Flip.esm.js';
import SplitText from '../../assets/vendor/gsap/SplitText.esm.js';
import DrawSVGPlugin from '../../assets/vendor/gsap/DrawSVGPlugin.esm.js';
import CustomEase from '../../assets/vendor/gsap/CustomEase.esm.js';
import { strong } from './text.js';

gsap.registerPlugin(Flip, SplitText, DrawSVGPlugin, CustomEase);

// 이 게임의 곡선. 기성 이징을 그대로 쓰면 움직임도 남의 것처럼 보인다.
//   swift  — 빠르게 튀어나가 길게 눕는다. 화면에 들어오는 것 전부가 이걸 쓴다.
//   settle — 목표를 아주 살짝 지나쳤다가 앉는다. 물건이 자리를 잡는 느낌.
CustomEase.create('swift',  'M0,0 C0.12,0.62 0.18,1 1,1');
CustomEase.create('settle', 'M0,0 C0.16,0.84 0.24,1.06 1,1');

// GSAP 기본값을 이 게임의 성격에 맞춘다. 교육 자료라 움직임이 빠르고 짧아야 한다 —
// 느린 연출은 두 번째 판부터 기다리는 시간이 된다.
gsap.defaults({ duration: 0.34, ease: 'swift', overwrite: 'auto' });

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
export const isReduced = () => reduced.matches;

/** ms → s. 이 파일 밖은 전부 ms 로 말한다. */
const sec = (ms) => ms / 1000;

/**
 * 트윈이 끝나기를 기다리되, **절대 매달리지 않는다.**
 *
 * GSAP 기본값에 `overwrite: 'auto'` 를 켜 뒀다 — 같은 것에 새 움직임이 걸리면
 * 앞엣것을 죽인다(눌렀다 또 누를 때 어긋나지 않게). 그런데 죽은 트윈은 "끝났다"를
 * 알려 주지 않을 수 있고, 그걸 `await` 하던 쪽은 거기서 멈춘다.
 * 실제로 걸리는 자리가 있다: 결과 화면에서 용어 칩을 하나씩 카운터로 보낼 때
 * 하나가 멈추면 **나머지가 영영 안 날아간다.**
 *
 * 그래서 시간으로도 한 번 더 막는다. 화면은 어차피 그 시간이면 제자리에 있다.
 */
function done(tween, ms) {
  const t = tween && typeof tween.then === 'function' ? tween.then(() => {}) : Promise.resolve();
  return Promise.race([t, new Promise(r => setTimeout(r, ms))]);
}

// ---------------------------------------------------------------- 등장

/** 목록이 차례로 올라온다. 코스맵 노드, 통, 카드 목록에 쓴다. */
export function enter(targets, opts = {}) {
  const list = toList(targets);
  if (!list.length) return Promise.resolve();

  // 최종 상태 = 그냥 보이는 상태. 모션이 어떤 이유로든 안 돌면 이걸로 끝난다.
  const show = () => gsap.set(list, { opacity: 1, y: 0, scale: 1, clearProps: 'transform' });
  if (isReduced()) { show(); return Promise.resolve(); }

  const duration = opts.duration ?? 380;
  const each = opts.each ?? 45;

  // 백그라운드 탭에서는 브라우저가 rAF 를 멈춘다 → 애니메이션이 시작 프레임(투명)에
  // 멈춘 채로 남는다. 그러면 화면이 통째로 비어 보인다. 실제로 겪은 증상이라 안전망을 둔다.
  const guard = setTimeout(show, duration + each * list.length + 600);

  return gsap.fromTo(list,
    { opacity: 0, y: opts.from ?? 10, scale: opts.scale ?? 0.98 },
    {
      opacity: 1, y: 0, scale: 1,
      duration: sec(duration),
      delay: sec(opts.start ?? 0),
      stagger: sec(each),
      ease: 'back.out(1.4)'
    }
  ).then(() => { clearTimeout(guard); show(); });
}

/** 한 장짜리 등장 — 티켓이 바뀔 때 */
export function cardIn(el) {
  if (!el) return Promise.resolve();
  const show = () => gsap.set(el, { opacity: 1, y: 0, rotation: 0, clearProps: 'transform' });
  if (isReduced()) { show(); return Promise.resolve(); }
  const guard = setTimeout(show, 900);
  return gsap.fromTo(el,
    { opacity: 0, y: 14, rotation: -0.4 },
    { opacity: 1, y: 0, rotation: 0, duration: sec(320), ease: 'expo.out' }
  ).then(() => { clearTimeout(guard); show(); });
}

/**
 * 답을 낸 카드를 "처리 완료" 상태로 가라앉힌다.
 *
 * 카드를 화면 밖으로 날려 버리면 질문이 사라져서, 해설을 읽는 동안
 * 뭘 물어봤는지 다시 위로 올라가 확인해야 한다. 게다가 카드가 있던 자리가
 * 빈 구멍으로 남는다. 그래서 날리지 않고 살짝 밀린 채 흐려지게만 한다.
 *
 * 예전에 `cardOut`(카드를 옆으로 날려 지우는 것)이 여기 같이 있었다. 위 이유로
 * 이 함수가 그것을 대체했고, 지운 뒤 아무도 안 쓰는 채로 남아 있었다.
 * **다시 만들지 말 것** — 슈팅 판의 카드도 날리지 않는다. 거기서는 카드에 붙은
 * "왜 그런지"를 읽을 시간(1.6초)을 주면서 서서히 흐려지게 한다(`shoot.js` 의 `fade`).
 */
export function settle(node, ok = true) {
  if (!node) return Promise.resolve();
  node.classList.add(ok ? 'ticket--ok' : 'ticket--no');
  if (isReduced()) return Promise.resolve();
  return gsap.to(node, {
    x: ok ? 10 : -10, scale: 0.97, opacity: 0.62,
    duration: sec(220), ease: 'power2.out'
  });
}

// ---------------------------------------------------------------- 판정

/** 도장이 찍힌다. 이 게임의 시그니처 모션. */
export function stamp(el) {
  if (!el) return Promise.resolve();
  const show = () => gsap.set(el, { opacity: 1, scale: 1, rotation: -6 });
  if (isReduced()) { show(); return Promise.resolve(); }

  const guard = setTimeout(show, 1400);   // 모션이 안 돌아도 도장은 보여야 한다
  const tl = gsap.timeline();
  tl.fromTo(el,
    { opacity: 0, scale: 2.1, rotation: -16 },
    { opacity: 1, scale: 0.94, rotation: -6, duration: sec(260), ease: 'expo.out' })
    .to(el, { scale: 1, duration: sec(300), ease: 'elastic.out(1, 0.6)' }, '-=0.04');
  return tl.then(() => { clearTimeout(guard); });
}

/** 오답 — 좌우로 짧게 흔든다 */
export function shake(el) {
  if (!el || isReduced()) return Promise.resolve();
  return gsap.to(el, {
    keyframes: { x: [0, -7, 6, -4, 2, 0] },
    duration: sec(300), ease: 'power1.inOut'
  });
}

/** 정답 — 짧게 눌렸다 돌아온다 */
export function press(el) {
  if (!el || isReduced()) return Promise.resolve();
  return gsap.to(el, {
    keyframes: { scale: [1, 0.965, 1] }, duration: sec(200), ease: 'power2.out'
  });
}

/** 숫자가 올라간다 — 점수 */
export function countUp(el, to, opts = {}) {
  if (!el) return Promise.resolve();
  const show = () => { el.textContent = String(to) + (opts.suffix || ''); };
  if (isReduced()) { show(); return Promise.resolve(); }

  const duration = opts.duration ?? 700;
  const guard = setTimeout(show, duration + 600);   // 숫자가 0에 멈춰 있으면 안 된다
  const box = { v: opts.from ?? 0 };
  return gsap.to(box, {
    v: to, duration: sec(duration), ease: 'expo.out',
    onUpdate: () => { el.textContent = Math.round(box.v) + (opts.suffix || ''); }
  }).then(() => { clearTimeout(guard); show(); });
}

/**
 * 진행도 막대.
 *
 * 안전망이 있어야 한다. 애니메이션이 시작 프레임에 얼어붙으면 막대가 **0% 에 멈춘다** —
 * 그러면 진행도가 있는데도 아무것도 안 한 것처럼 보인다. 실제로 겪었다:
 * 창이 가려진 상태에서는 rAF 가 안 돌아서 4/68 인데 빈 막대가 나왔다.
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
  return gsap.to(el, { width: pct + '%', duration: sec(520), ease: 'expo.out' })
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
      const settleLine = () => gsap.set(line, { opacity: 1, y: 0 });
      const g = setTimeout(settleLine, 700);      // 로그 줄이 투명한 채로 남지 않게
      gsap.fromTo(line, { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: sec(180), ease: 'power2.out' })
        .then(() => { clearTimeout(g); settleLine(); });
      // 글자가 찍히는 동안 커서가 깜빡인다 — "지금 AI가 쓰고 있다"는 느낌의 전부다.
      // 애니메이션이 얼어붙으면 이 클래스가 안 벗겨져서 **모든 줄에 커서가 남는다.**
      // 글자는 typeIn 의 안전망이 채워 주므로 여기서 커서만 따로 걷어 낸다.
      line.classList.add('is-typing');
      const untype = setTimeout(() => line.classList.remove('is-typing'), ms + 900);
      typeIn(body, html, { duration: Math.min(ms * 0.7, step.text.length * 22) })
        .then(() => { clearTimeout(untype); line.classList.remove('is-typing'); });
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
  // 끌 때는 돌던 것을 확실히 멈추고 각도를 되돌린다. 안 그러면 기울어진 채로 굳는다.
  gsap.killTweensOf(el);
  if (!on) { gsap.set(el, { rotation: 0 }); return; }
  if (isReduced()) return;
  gsap.to(el, { rotation: 360, duration: sec(900), repeat: -1, ease: 'none' });
}

// ---------------------------------------------------------------- 화면 전환

/**
 * 화면이 바뀔 때. 왼쪽에서 들어오면 전진, 오른쪽이면 뒤로 가는 느낌이다.
 *
 * 예전에는 화면 전체가 통째로 한 덩어리로 슥 들어왔다. 그러면 어디를 봐야 하는지가
 * 안 정해진다 — 모든 것이 같은 순간에 같은 속도로 오기 때문이다.
 * 지금은 **제목이 먼저 서고, 그 아래가 뒤따른다.** 제목은 글자 단위로 선다
 * (SplitText). 0.1초 남짓 차이인데 시선이 시작점을 갖는다.
 *
 * SplitText 는 되돌리기(revert)를 반드시 불러야 한다. 안 그러면 쪼갠 span 이
 * 남아서 다음 화면의 글자 선택·줄바꿈이 이상해진다.
 */
export function stageIn(el, back = false) {
  if (!el) return Promise.resolve();
  const show = () => gsap.set(el, { opacity: 1, x: 0, clearProps: 'transform' });
  if (isReduced()) { show(); return Promise.resolve(); }

  const title = el.querySelector('.stage__title');
  // 제목을 품고 있는 덩어리(머리글)는 빼고 나머지가 뒤따른다.
  // 머리글까지 같이 흔들면 제목이 글자 단위로 서는 것이 안 보인다.
  const rest = [...el.children].filter(n => !title || !n.contains(title));

  let split = null;

  // 안전망은 **el 만이 아니라 이 연출이 건드린 것 전부**를 되돌려야 한다.
  // 처음에는 el 만 되돌렸다. 그랬더니 창이 가려진 채로 화면을 넘기면
  // 머리글만 뜨고 나머지가 통째로 투명한 채 남았다 — 판이 안 보였다.
  const showAll = () => {
    show();
    if (rest.length) gsap.set(rest, { opacity: 1, y: 0, clearProps: 'transform' });
    if (split) { try { split.revert(); } catch { /* 이미 지워짐 */ } split = null; }
  };
  const guard = setTimeout(showAll, 1100);

  const tl = gsap.timeline({ defaults: { ease: 'swift' } });

  tl.fromTo(el, { opacity: 0, x: back ? -14 : 14 },
                { opacity: 1, x: 0, duration: sec(260) });

  if (title && title.textContent.trim().length <= 24) {
    try {
      split = new SplitText(title, { type: 'chars' });
      tl.fromTo(split.chars,
        { opacity: 0, yPercent: 55 },
        { opacity: 1, yPercent: 0, duration: sec(340), stagger: sec(22), ease: 'settle' }, 0.04);
    } catch { split = null; }
  }

  if (rest.length) {
    tl.fromTo(rest, { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: sec(300), stagger: sec(38) }, 0.12);
  }

  return tl.then(() => { clearTimeout(guard); showAll(); });
}

/**
 * SVG 선이 **그려진다.** 배선판·증거판처럼 "잇는다"가 조작인 판에서,
 * 선이 툭 나타나는 것과 끝에서 끝으로 그어지는 것은 전혀 다르게 읽힌다 —
 * 후자만 "내가 이었다"가 된다.
 *
 * @param {SVGPathElement|SVGPathElement[]} paths
 * @param {{ ms?: number, each?: number, from?: boolean }} opts from=false 면 지운다
 */
export function drawLine(paths, opts = {}) {
  const list = toList(paths);
  if (!list.length) return Promise.resolve();
  const ms = opts.ms ?? 420;
  const show = () => gsap.set(list, { drawSVG: '100%' });
  if (isReduced()) { show(); return Promise.resolve(); }
  const guard = setTimeout(show, ms + (opts.each ?? 0) * list.length + 500);
  return gsap.fromTo(list, { drawSVG: '0%' },
    { drawSVG: '100%', duration: sec(ms), stagger: sec(opts.each ?? 0), ease: 'swift' }
  ).then(() => { clearTimeout(guard); show(); });
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
  gsap.fromTo(r, { scale: 0.25, opacity: 0.34 },
    { scale: 1, opacity: 0, duration: sec(560), ease: 'power2.out' });
}

/**
 * 부품이 집어든 자리에서 놓인 자리로 옮겨 간다.
 *
 * Flip 이 하는 일: 옮기기 **전** 자리를 재 두고(`Flip.getState`), 옮긴 **뒤**
 * "방금 전 자리에서 지금 자리로" 되감아 준다. 손으로 좌표를 빼서 translate 를
 * 거는 것과 결과가 다르다 — 크기·여백·줄바꿈이 같이 바뀌어도 어긋나지 않는다.
 *
 * 여기서는 이미 DOM 이 바뀐 뒤에 불리므로, 출발 자리를 인자로 받아 되돌려 놓고
 * Flip 에게 "여기서부터 지금 자리로" 오게 시킨다.
 */
export function flyTo(fromEl, toEl) {
  if (!fromEl || !toEl || isReduced()) return Promise.resolve();
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  // 둘 중 하나라도 화면에 없으면(폭 0) 좌표를 못 잰다. 그때는 그냥 제자리에 둔다.
  if (!a.width || !b.width) return Promise.resolve();
  if (a.left === b.left && a.top === b.top) return Promise.resolve();

  // ① 지금(=제 자리)을 찍어 둔다 → ② 출발 자리에 맞춰 놓는다 → ③ 찍어 둔 자리로 되돌린다
  const home = Flip.getState(toEl);
  Flip.fit(toEl, fromEl, { scale: true });
  gsap.set(toEl, { opacity: 0.65 });

  const settleTo = () => gsap.set(toEl, { clearProps: 'transform,opacity,width,height' });
  const guard = setTimeout(settleTo, 900);
  gsap.to(toEl, { opacity: 1, duration: sec(260), ease: 'power2.out' });
  return Flip.to(home, {
    duration: sec(420), ease: 'power3.out', scale: true,
    onComplete: () => { clearTimeout(guard); settleTo(); }
  }).then(() => {});
}

/**
 * 딴 것이 모이는 곳으로 날아간다 — 용어 칩 → 상단바 카운터.
 *
 * flyTo 와 다르다. 저쪽은 **목표 요소 자체**가 옮겨 오는 것이고,
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
  // 직선으로 가면 "이동"으로만 읽힌다. 살짝 위로 떴다가 빨려 들어가야
  // "쌓인다"로 읽힌다 — 그게 이 연출의 목적이다.
  // 이 함수만 바깥에서 await 한다(결과 화면이 칩을 하나씩 보낸다). 그래서 done() 으로
  // 시간 안전망까지 씌운다 — 여기서 매달리면 나머지 칩이 영영 안 날아간다.
  const tw = gsap.to(ghost, {
    keyframes: [
      { x: ((b.left - a.left) + (b.width - a.width) / 2) * 0.35,
        y: (b.top - a.top) * 0.25 - 26,
        scale: 1.06, duration: sec(220), ease: 'power2.out' },
      { x: (b.left + b.width / 2) - (a.left + a.width / 2),
        y: (b.top + b.height / 2) - (a.top + a.height / 2),
        scale: 0.45, opacity: 0, duration: sec(400), ease: 'power2.in' }
    ]
  }).then(() => { clearTimeout(guard); drop(); });
  return done(tw, 1200).then(() => { clearTimeout(guard); drop(); });
}

/**
 * 자리에서 떨어져 나간다 — 칸이 모자라 밀려나는 것.
 *
 * sendTo 와 짝이다. 저쪽은 모은 것이 카운터로 올라가고, 이쪽은 넘친 것이
 * 아래로 떨어진다. 둘 다 **복제본**을 쓴다: 원본은 곧 다시 그려지면서
 * 사라지기 때문에 떨어지는 걸 보여 줄 몸이 따로 필요하다.
 *
 * 그래서 호출은 **지우기 전에** 해야 한다 — 좌표는 아직 화면에 있을 때만 잰다.
 * 복제본은 body 에 붙으므로 setTimeout 안전망 없이는 조각이 영구히 남는다.
 */
export function dropOut(fromEl, label) {
  if (!fromEl || isReduced()) return Promise.resolve();
  const a = fromEl.getBoundingClientRect();
  if (!a.width) return Promise.resolve();

  const ghost = document.createElement('div');
  ghost.className = 'flyer flyer--drop';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.textContent = label == null ? fromEl.textContent : label;
  ghost.style.left = a.left + 'px';
  ghost.style.top = a.top + 'px';
  ghost.style.width = a.width + 'px';
  document.body.append(ghost);

  const drop = () => ghost.remove();
  const guard = setTimeout(drop, 1400);
  // 옆으로 떠밀리면서 떨어진다 — "밀려났다"는 말 그대로 보이게.
  // 아래로 갈수록 빨라져야 떨어지는 것으로 읽힌다(중력).
  return gsap.to(ghost, {
    x: -34, y: 58, rotation: -8, opacity: 0,
    duration: sec(560), ease: 'power2.in'
  }).then(() => { clearTimeout(guard); drop(); });
}

/** 눈길을 한 번 끌어야 할 때 — 실행 버튼이 살아났다든지 */
export function pulse(el, times = 2) {
  if (!el || isReduced()) return Promise.resolve();
  return gsap.to(el, {
    keyframes: { scale: [1, 1.045, 1] },
    duration: sec(480), repeat: times - 1, ease: 'power1.inOut'
  });
}

/** 가로로 쓸어내리며 나타난다 — 배치한 칸이 채워질 때 */
export function wipeIn(el) {
  if (!el) return Promise.resolve();
  const show = () => gsap.set(el, { opacity: 1, scaleX: 1, clearProps: 'transform' });
  if (isReduced()) { show(); return Promise.resolve(); }
  const guard = setTimeout(show, 800);
  return gsap.fromTo(el,
    { opacity: 0.2, scaleX: 0.2 },
    { opacity: 1, scaleX: 1, duration: sec(340), ease: 'expo.out' }
  ).then(() => { clearTimeout(guard); show(); });
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
  return gsap.to(box, {
    n: total, duration: sec(opts.duration ?? 520), ease: 'none',
    onUpdate: () => { el.innerHTML = clip(plain, Math.round(box.n)); }
  }).then(() => { clearTimeout(guard); el.innerHTML = plain; });
}

/**
 * 한 문장이 글자 단위로 선다 — "방금 겪은 것에 이름이 있다" 순간에만 쓴다.
 *
 * 결과 화면에서 용어를 처음 만나는 자리다. 문장이 통째로 나타나면 그냥 설명문이지만,
 * 글자가 차례로 서면 읽는 속도가 문장 속도에 맞춰진다 — 그래서 이름이 남는다.
 * 흔해지면 의미가 없어지므로 **다른 곳에 쓰지 않는다.**
 *
 * SplitText 는 글자마다 span 을 만든다. 낭독기가 한 글자씩 읽으면 안 되므로
 * 끝나면 반드시 원래 마크업으로 되돌린다(revert).
 */
export function nameIn(el, opts = {}) {
  if (!el) return Promise.resolve();
  if (isReduced()) return Promise.resolve();
  if (!el.textContent.trim()) return Promise.resolve();

  let split;
  try {
    split = new SplitText(el, { type: 'chars', charsClass: 'nm__c' });
  } catch {
    return Promise.resolve();   // 쪼개지 못하면 그냥 둔다. 글은 이미 화면에 있다
  }

  const back = () => { try { split.revert(); } catch { /* 이미 되돌아갔다 */ } };
  const guard = setTimeout(back, (opts.duration ?? 900) + 900);

  return gsap.from(split.chars, {
    opacity: 0, y: 8,
    duration: sec(260),
    stagger: sec(opts.each ?? 14),
    ease: 'power2.out'
  }).then(() => { clearTimeout(guard); back(); });
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

  // 위로 튀었다가 떨어진다. 한 번에 흩어지기만 하면 종이가 아니라 빛으로 읽힌다.
  gsap.to(bits, {
    x: (i) => ((seed(i) % 1) - 0.5) * 240,
    y: (i) => -60 - Math.abs((seed(i + 7) % 1)) * 150,
    rotation: (i) => ((seed(i + 3) % 1) - 0.5) * 720,
    opacity: 0,
    duration: sec(900),
    stagger: sec(14),
    ease: 'power2.out'
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

/**
 * 엔진이 직접 쓰는 얇은 창구.
 *
 * anime.js 를 쓸 때는 `animate()` 를 그대로 내보냈다. 그 함수의 규약(ms, translateX,
 * 배열 키프레임)이 엔진 7군데에 박혀 있어서, 라이브러리를 바꾸면 그 7군데가 같이
 * 깨진다. 그래서 **이 파일이 그 규약을 지킨다** — 안쪽이 무엇이든 바깥은 그대로다.
 *
 *   animate(el, { opacity: [0, 1], translateY: [6, 0], duration: 900, ease: 'outQuad' })
 */
export function animate(target, opts = {}) {
  if (!target) return Promise.resolve();
  const { duration = 320, ease = 'power2.out', delay = 0, loop, ...props } = opts;

  const EASE = {
    linear: 'none', outQuad: 'power2.out', inQuad: 'power2.in',
    outCubic: 'power3.out', outExpo: 'expo.out', inOutQuad: 'power1.inOut'
  };
  const NAME = { translateX: 'x', translateY: 'y', rotate: 'rotation' };

  const arrays = {}, plain = {};
  let steps = 0;
  for (const [k, v] of Object.entries(props)) {
    const key = NAME[k] || k;
    if (Array.isArray(v)) { arrays[key] = v; steps = Math.max(steps, v.length); }
    else plain[key] = v;
  }

  const cfg = {
    duration: sec(duration),
    delay: sec(delay),
    ease: EASE[ease] || ease,
    ...(loop ? { repeat: loop === true ? -1 : loop - 1 } : {})
  };

  // 값이 셋 이상인 배열이 하나라도 있으면 전부 키프레임으로 넘긴다.
  // GSAP 은 키프레임과 일반 속성을 한 트윈에 섞지 못한다 — 섞으면 조용히 하나가 무시된다.
  // (지금 부르는 곳은 전부 배열만 넘긴다. 섞어 부르면 여기서 갈라야 한다.)
  if (steps > 2) {
    return gsap.to(target, { ...plain, keyframes: arrays, ...cfg }).then(() => {});
  }

  const from = {}, to = { ...plain };
  let hasFrom = false;
  for (const [k, v] of Object.entries(arrays)) { from[k] = v[0]; to[k] = v[1]; hasFrom = true; }

  const tween = hasFrom
    ? gsap.fromTo(target, from, { ...to, ...cfg })
    : gsap.to(target, { ...to, ...cfg });
  return tween.then(() => {});
}

export { gsap, Flip, SplitText, DrawSVGPlugin, CustomEase };
