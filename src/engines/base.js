// 엔진 5종이 공유하는 부품. 특정 미니게임을 몰라야 한다.
//
// 여기 있는 runner() 가 이 게임의 핵심 장치다 — 플레이어가 세팅을 마치고
// [실행]을 누르면 AI가 그 세팅대로 일하는 과정이 한 줄씩 흐른다.
// 결과만 알려주는 대신 **과정을 보여줘야** "왜 이게 필요한지"를 스스로 알게 된다.

import { runLog, spin, cardIn, enter } from '../core/motion.js';
import { esc, strong, plain } from '../core/text.js';

export { esc, strong, plain };

export function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

/** 낭독 영역에 한 줄 넣는다. 강조 표시(`**`)는 plain() 이 떼 준다. */
export function say(text) {
  const live = document.getElementById('live');
  if (live) live.textContent = plain(text);
}

/** 이벤트를 모아 두었다가 unmount 에서 한 번에 뗀다 */
export class Bin {
  constructor() { this.fns = []; }
  on(node, type, fn, opts) {
    node.addEventListener(type, fn, opts);
    this.fns.push(() => node.removeEventListener(type, fn, opts));
    return node;
  }
  add(fn) { this.fns.push(fn); }
  clear() { for (const f of this.fns) { try { f(); } catch { /* 무시 */ } } this.fns = []; }
}

/** 화면 제목 — 모든 미니게임이 같은 자리에 같은 모양으로 */
export function header(game) {
  const h = el('div');
  h.append(
    el('h1', 'stage__title', esc(game.title)),
    el('p', 'stage__sub', esc(game.subtitle || ''))
  );
  return h;
}

/**
 * **지금 할 일** — 한 줄짜리 다음 동작 안내.
 *
 * 왜 필요한가: 1번 판을 처음 연 사람이 "어떻게 진행하는지 모르겠다"고 했다.
 * 화면에는 설명이 이미 여러 줄 있었는데도 그랬다. 설명이 모자란 게 아니라
 * **지금 눌러야 할 것이 어느 것인지**가 없었던 것이다. 규칙을 다 읽어도
 * 첫 수를 모르면 못 움직인다.
 *
 * 그래서 글을 늘리지 않고 줄을 하나 더 놓는다. 이 줄은 **언제나 한 줄**이고,
 * 상태가 바뀔 때마다 통째로 갈린다. 쌓이지 않는다 — 쌓이면 그게 또 글이 된다.
 *
 * 지키는 것 둘:
 *   ① **동사로 끝난다.** "눌러 고른다"는 되고 "선택 가능합니다"는 안 된다.
 *   ② **규칙만 알려 주고 판단은 안 알려 준다.** "무엇을 남길지"는 이 판이
 *      가르치려는 것이라 여기서 말하면 판이 없어진다.
 *
 * @returns {{node: HTMLElement, set(text: string, opts?: {done?: boolean}): void}}
 */
export function todo() {
  const node = el('p', 'todo');
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  const mark = el('b', 'todo__mark');
  const text = el('span', 'todo__text');
  node.append(mark, text);
  let last = '';
  return {
    node,
    set(t, opts = {}) {
      if (t === last && !opts.done) return;   // 같은 말을 다시 읽어 주지 않는다
      last = t;
      text.textContent = t;
      node.classList.toggle('todo--done', !!opts.done);
      node.hidden = !t;
    }
  };
}


/**
 * 실행 로그 패널.
 *   const r = runner('AI가 일하는 중');
 *   root.append(r.node);
 *   await r.play(steps);
 */
export function runner(caption = 'AI 작업 로그') {
  const node = el('section', 'runner');
  const head = el('div', 'runner__head',
    `<span class="runner__dot"></span><span>${esc(caption)}</span>`);
  const log = el('div', 'log');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');
  node.append(head, log);

  return {
    node, log,
    async play(steps, opts = {}) {
      head.classList.add('is-working');
      spin(head.querySelector('.runner__dot'), true);
      await runLog(log, steps, opts);
      head.classList.remove('is-working');
      spin(head.querySelector('.runner__dot'), false);
    },
    clear() { log.innerHTML = ''; }
  };
}

/**
 * 진행 HUD — 문항 수만큼 칸을 깔아두고 푼 만큼 색을 채운다.
 *
 * "3 / 10" 같은 숫자보다 칸이 채워지는 편이 훨씬 잘 읽힌다.
 * 남은 칸이 눈에 보여야 "이만큼만 하면 끝난다"가 전달된다.
 *
 *   const h = hud(total);  root.append(h.node);
 *   h.mark(true);          // 맞음 → 칸 하나 초록
 *   h.set({ label: '연속 3' });
 */
export function hud(total, opts = {}) {
  const node = el('div', 'hud');
  const pips = el('div', 'hud__pips');
  pips.setAttribute('aria-hidden', 'true');   // 같은 정보를 .hud__num 이 글자로 말한다

  const cells = [];
  for (let i = 0; i < total; i++) {
    const p = el('i', 'pip');
    pips.append(p);
    cells.push(p);
  }

  const num = el('span', 'hud__num', `<b>0</b><span>/${total}</span>`);
  const tag = el('span', 'hud__tag', esc(opts.label || ''));
  if (!opts.label) tag.hidden = true;

  node.append(pips, num, tag);

  let at = 0;
  return {
    node,
    /** 다음 칸을 칠한다. right=true 면 초록, false 면 빨강 */
    mark(right) {
      const p = cells[at];
      at = Math.min(at + 1, total);
      num.innerHTML = `<b>${at}</b><span>/${total}</span>`;
      if (!p) return;
      p.className = 'pip ' + (right ? 'pip--ok' : 'pip--no');
      // 칸이 채워질 때 살짝 튄다 — 이게 없으면 그냥 표가 된다
      p.style.animation = 'none';
      void p.offsetWidth;
      p.style.animation = '';
    },
    /** 콤보 같은 부가 표시 */
    set(label) {
      tag.hidden = !label;
      tag.textContent = label || '';
      if (label) { tag.style.animation = 'none'; void tag.offsetWidth; tag.style.animation = ''; }
    },
    /** drill 처럼 문항이 늘어나는 모드용 */
    reset() { at = 0; for (const p of cells) p.className = 'pip'; num.innerHTML = `<b>0</b><span>/${total}</span>`; }
  };
}

/**
 * 판정 패널 — 맞았는지 틀렸는지가 화면 아래에서 통째로 올라온다.
 *
 * 작은 회색 글상자로 알려주면 아무도 안 읽는다. 색이 깔린 판이 올라와야 읽는다.
 * 틀렸을 때 화면 전체를 빨갛게 칠하지는 않는다 — 벌 받는 기분이 들면 다음 판을 안 한다.
 * 색은 아이콘과 제목에만 싣고, 판 자체는 옅게 둔다.
 *
 *   verdict(feedback, { ok, title, body, actions: [{id,label,primary}] })
 *     → { node, btn }
 */
export function verdict(host, { ok, title, body, actions: list }) {
  const sheet = el('section', 'sheet ' + (ok ? 'sheet--ok' : 'sheet--no'));
  sheet.setAttribute('role', 'status');

  const head = el('div', 'sheet__head');
  head.innerHTML =
    `<span class="sheet__icon" aria-hidden="true">${ok ? '✓' : '!'}</span>` +
    `<span class="sheet__title">${esc(title)}</span>`;

  const text = el('div', 'sheet__body');
  text.innerHTML = body;

  const bar = actions(list);
  bar.node.classList.add('sheet__bar');

  sheet.append(head, text, bar.node);
  host.innerHTML = '';
  host.append(sheet);

  // 판이 화면 밖에 있으면 아무 소용이 없다
  requestAnimationFrame(() => {
    try { sheet.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    catch { /* 구형 브라우저 */ }
  });

  return { node: sheet, btn: bar.btn };
}

/** 아래쪽 버튼 줄 */
export function actions(list) {
  const bar = el('div', 'actionbar');
  const map = {};
  for (const item of list) {
    const b = el('button', item.primary ? 'btn-primary' : '');
    b.type = 'button';
    b.textContent = item.label;
    if (item.disabled) b.disabled = true;
    map[item.id] = b;
    bar.append(b);
  }
  return { node: bar, btn: map };
}

/** 목록이 차례로 올라오게 */
export function reveal(nodes) { return enter(nodes); }

/**
 * 아래쪽 선(우리 팀 · 판독선)에 맞은 흔적을 **쌓아서** 남긴다. 액션 엔진 공용.
 *
 * 예전에는 맞을 때 0.6초 깜빡이고 끝이었다. 그래서 사고가 세 번 나도 화면은
 * 매번 원래대로 돌아왔고, 쌓이는 것은 계기판 숫자뿐이었다. 숫자는 안 읽힌다 —
 * 특히 다음 일감이 이미 내려오고 있을 때는.
 *
 * 게임오버는 없다(사용자 확정 — 부드러운 압박). 대신 **흔적이 남는다.**
 * 사고 하나가 자국 하나다. 판이 끝날 때 그 선을 보면 오늘 무슨 일이 있었는지가
 * 한눈에 보인다. 그게 "사고는 쌓인다"를 가르치는 방법이다.
 *
 * 자국은 `n` 개를 다시 그린다(증분이 아니다) — 되돌리기·재도전에서 어긋나지 않는다.
 *
 * @param {HTMLElement} foot  선 요소 (`.ax__foot`)
 * @param {number} n          지금까지 맞은 횟수
 * @param {string} [label]    낭독용 이름 (예: '사고')
 */
export function scarLine(foot, n, label = '사고') {
  if (!foot) return;
  let rail = foot.querySelector('.ax__scars');
  if (!rail) {
    rail = el('div', 'ax__scars');
    rail.setAttribute('aria-hidden', 'true');   // 숫자는 계기판이 이미 읽어 준다
    foot.append(rail);
  }
  foot.classList.toggle('ax__foot--hurt', n > 0);
  rail.innerHTML = '';
  // 자국이 열 개를 넘으면 선을 다 먹는다. 그 뒤로는 숫자로 적는다.
  const shown = Math.min(n, 10);
  for (let i = 0; i < shown; i++) rail.append(el('i', 'ax__scar'));
  if (n > shown) rail.append(el('span', 'ax__scars__n', `+${n - shown}`));
  foot.setAttribute('data-hurt', n > 0 ? `${label} ${n}` : '');
}

/**
 * 등급 계산 — 모든 엔진이 같은 척도를 쓴다.
 * 결과 화면과 결과 카드가 하나로 통일되어야 하기 때문이다.
 */
export function gradeOf(score, cut = { pass: 80, partial: 50 }) {
  return score >= cut.pass ? 'pass' : score >= cut.partial ? 'partial' : 'fail';
}
