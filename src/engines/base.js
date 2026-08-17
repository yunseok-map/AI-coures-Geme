// 엔진 5종이 공유하는 부품. 특정 미니게임을 몰라야 한다.
//
// 여기 있는 runner() 가 이 게임의 핵심 장치다 — 플레이어가 세팅을 마치고
// [실행]을 누르면 AI가 그 세팅대로 일하는 과정이 한 줄씩 흐른다.
// 결과만 알려주는 대신 **과정을 보여줘야** "왜 이게 필요한지"를 스스로 알게 된다.

import { runLog, spin, cardIn, enter } from '../core/motion.js';
import { esc, strong } from '../core/text.js';

export { esc, strong };

export function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

export function say(text) {
  const live = document.getElementById('live');
  if (live) live.textContent = text;
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

/** 상황 설명 티켓 — "지금 무슨 일이 들어왔는가" */
export function brief(text, no) {
  const t = el('article', 'ticket');
  t.innerHTML =
    `<div class="ticket__no">${esc(no || '업무 요청')}</div>` +
    `<div class="ticket__body">${esc(text)}</div>`;
  cardIn(t);
  return t;
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
 * 등급 계산 — 모든 엔진이 같은 척도를 쓴다.
 * 결과 화면과 결과 카드가 하나로 통일되어야 하기 때문이다.
 */
export function gradeOf(score, cut = { pass: 80, partial: 50 }) {
  return score >= cut.pass ? 'pass' : score >= cut.partial ? 'partial' : 'fail';
}
