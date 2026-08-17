// 엔진 A — 분류형. 들어온 업무를 어디로 보낼지 배정한다.
// 이 파일은 특정 미니게임을 모른다. 문항·정답·문구는 전부 games/ 에서 온다.
//
// 모드 (GAME_SPEC.md §2) — 같은 조작이 네 번 반복되면 지루하므로 리듬을 다르게 한다:
//   study   시간제한 없음 · 한 장씩 · 배정 결과를 설명해 준다     (게임 5·17)
//   rapid   연속 정답 콤보 · 빠른 리듬                          (게임 6)
//   drill   틀린 카드를 뒤에 한 번 더 내보낸다                    (게임 8)

import { el, esc, strong, say, Bin, header, brief, actions } from './base.js';
import { hasBatchim } from '../core/ko.js';
import { press, shake, cardOut, enter } from '../core/motion.js';

let bin = new Bin();

export function unmount() { bin.clear(); }

export function mount(root, game, ctx) {
  bin.clear();
  bin = new Bin();

  const { bins, pass } = game.data;
  const mode = game.mode || 'study';
  const queue = game.data.cards.slice();
  const total = queue.length;

  let correct = 0, combo = 0, bestCombo = 0, answered = 0;
  const mistakes = [];
  const retried = new Set();   // drill 에서 이미 한 번 다시 나온 카드
  const startedAt = Date.now();

  root.innerHTML = '';
  root.append(header(game));

  const counter = el('div', 'counter');
  root.append(counter);

  let ticket = brief('', '업무 요청 01');
  root.append(ticket);

  const binWrap = el('div', 'bins');
  root.append(binWrap);

  const feedback = el('div');
  root.append(feedback);

  const btns = new Map();
  for (const b of bins) {
    const node = el('button', 'bin');
    node.type = 'button';
    node.innerHTML =
      `<span class="bin__label">${esc(b.label)}</span>` +
      `<span class="bin__hint">${esc(b.hint || '')}</span>`;
    node.setAttribute('aria-label', `${b.label}. ${b.hint || ''}`);
    bin.on(node, 'click', () => choose(b));
    binWrap.append(node);
    btns.set(b.id, node);
  }
  enter([...btns.values()], { each: 40 });

  render();

  // ------------------------------------------------------------

  function render() {
    const card = queue[0];
    // drill 은 카드가 다시 나오므로 "몇 장 남았나"로 센다
    counter.innerHTML = mode === 'rapid'
      ? `<span>${answered} / ${total}</span><span class="combo">연속 ${combo}</span>`
      : mode === 'drill'
      ? `<span>남은 카드 ${queue.length}</span><span>맞은 개수 <b>${correct}</b></span>`
      : `<span>${answered} / ${total}</span><span>맞은 개수 <b>${correct}</b></span>`;

    if (!card) return;

    const fresh = brief(card.text, `업무 요청 ${String(answered + 1).padStart(2, '0')}`);
    fresh.classList.add('ticket--held');
    ticket.replaceWith(fresh);
    ticket = fresh;

    binWrap.classList.add('bins--armed');
    setEnabled(true);
    say(`업무 요청 ${answered + 1}번. ${card.text}`);
  }

  async function choose(b) {
    const card = queue[0];
    if (!card) return;

    const right = card.bin === b.id;
    answered++;
    setEnabled(false);
    binWrap.classList.remove('bins--armed');

    const node = btns.get(b.id);
    node.classList.add(right ? 'bin--right' : 'bin--wrong');

    if (right) {
      correct++; combo++; bestCombo = Math.max(bestCombo, combo);
      press(node);
      queue.shift();
    } else {
      combo = 0;
      shake(node);
      mistakes.push({ itemId: card.id, chose: b.id, correct: card.bin, hint: card.why });
      queue.shift();
      // 틀린 카드는 뒤에 한 번 더 나온다. 두 번째도 틀리면 넘어간다 —
      // 계속 다시 내보내면 못 맞히는 사람이 영영 못 끝낸다.
      if (mode === 'drill' && !retried.has(card.id)) { retried.add(card.id); queue.push(card); }
    }

    cardOut(ticket, right);
    showResult(right, card, b);
  }

  function showResult(right, card, chosen) {
    const target = bins.find(x => x.id === card.bin);
    const box = el('div', right ? 'hint hint--ok' : 'hint');

    // 조사는 계산해서 붙인다 — "채팅다"가 아니라 "채팅이다"
    box.innerHTML = right
      ? `<b>${esc(target.label)}</b>로 보냈다. ${strong(card.why)}`
      : `<b>${esc(chosen.label)}</b>${hasBatchim(chosen.label) ? '이' : '가'} 아니라 ` +
        `<b>${esc(target.label)}</b>${hasBatchim(target.label) ? '이다' : '다'}.<br>${strong(card.why)}`;

    const last = queue.length === 0;
    const bar = actions([
      { id: 'next', label: last ? '결과 보기' : '다음 요청', primary: true }
    ]);
    bin.on(bar.btn.next, 'click', () => {
      clearMarks();
      feedback.innerHTML = '';
      if (queue.length) render(); else finish();
    });

    feedback.innerHTML = '';
    feedback.append(box, bar.node);
    bar.btn.next.focus();
    say(right ? '정답입니다.' : `오답입니다. 정답은 ${target.label}입니다.`);
  }

  function finish() {
    const need = (pass && pass.minCorrect) || Math.ceil(total * 0.8);
    const grade = correct >= need ? 'pass'
                : correct >= Math.ceil(need * 0.6) ? 'partial' : 'fail';

    ctx.finish({
      grade,
      score: Math.round((correct / total) * 100),
      elapsed: Math.round((Date.now() - startedAt) / 1000),
      mistakes,
      stats: mode === 'rapid' ? [{ label: '최고 연속', value: bestCombo }] : [],
      unlocked: grade === 'fail' ? [] : (game.concept || [])
    });
  }

  function clearMarks() {
    for (const n of btns.values()) n.classList.remove('bin--right', 'bin--wrong');
  }
  function setEnabled(on) {
    for (const n of btns.values()) n.disabled = !on;
  }
}
