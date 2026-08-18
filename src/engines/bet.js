// 엔진 P — 예측형. **진실을 보기 전에 먼저 건다.**
//
// 왜 이 엔진이 필요한가:
//   "이름 때문에 오해한다"를 가르치는 판이 O/X 퀴즈였다. 그러면 플레이어는
//   문제를 풀 뿐 자기 편견을 마주치지 않는다. 정답을 맞히면 "역시" 로 끝나고
//   틀리면 "몰랐네" 로 끝난다. 둘 다 남는 게 없다.
//
//   먼저 걸게 하면 다르다. 건 것이 화면에 도장으로 남고, 그 다음 실행이 흐르고,
//   마지막에 **내가 몇 번을 "못 한다" 쪽에 걸었는지**가 숫자로 나온다.
//   깨달음이 설명글이 아니라 자기 기록에서 온다.
//
// 조작은 두 개뿐이다 — 두 개의 큰 버튼 중 하나를 누른다. 되돌릴 수 없다.
// 되돌릴 수 있으면 그건 건 것이 아니다.
//
// 판정은 game.simulate({ bets }) 가 한다. 엔진은 무엇을 걸었는지만 모아 넘긴다.

import { el, esc, say, Bin, header, actions, runner, hud, todo } from './base.js';
import { enter, stamp, shake, wait, cardIn } from '../core/motion.js';
import { eulReul } from '../core/ko.js';

let bin = new Bin();
export function unmount() { bin.clear(); }

export function mount(root, game, ctx) {
  unmount();
  bin = new Bin();

  const d = game.data;
  const items = d.items || [];
  const startedAt = Date.now();

  /** [{ id, bet:boolean }] — 되돌릴 수 없다 */
  const bets = [];
  let at = 0;

  root.innerHTML = '';
  root.append(header(game));

  // 지금 눌러야 할 것 하나. 이 판은 상황 카드가 문항마다 새로 그려지므로
  // 제목 바로 다음에 둔다 — 자리가 고정돼야 눈이 매번 다시 찾지 않는다.
  const step = todo();
  root.append(step.node);

  const gauge = hud(items.length);
  root.append(gauge.node);

  const stage = el('div', 'bt');
  root.append(stage);

  const bar = actions([{ id: 'next', label: '다음', primary: true }]);
  bar.node.hidden = true;
  root.append(bar.node);
  bin.on(bar.btn.next, 'click', () => { at++; draw(); });

  draw();

  // ------------------------------------------------------------

  function draw() {
    stage.innerHTML = '';
    bar.node.hidden = true;

    if (at >= items.length) { step.set(''); done(); return; }
    const it = items[at];

    const card = el('article', 'bt__card');
    card.innerHTML =
      `<div class="bt__cap">${esc(it.cap || '업무 요청')}</div>` +
      `<div class="bt__text">${esc(it.text)}</div>`;
    stage.append(card);
    cardIn(card);

    const ask = el('p', 'bt__ask', esc(it.ask || d.ask || '할 수 있을까?'));
    stage.append(ask);

    // 거는 자리. 두 개뿐이고, 누르면 끝이다.
    const picks = el('div', 'bt__picks');
    const yesLabel = it.yes || d.yes || '된다';
    const noLabel = it.no || d.no || '안 된다';
    const yes = pickBtn(yesLabel, true);
    const no = pickBtn(noLabel, false);
    picks.append(yes, no);
    stage.append(picks);
    enter([yes, no], { each: 60 });

    // 버튼 이름을 그대로 부른다 — 어느 쪽에 걸어야 하는지는 이 판이 가르치려는
    // 것이라 여기서 말하지 않는다. 문항마다 두 이름이 달라지므로 그때그때 읽어 온다.
    step.set(`[${yesLabel}] 또는 [${noLabel}]에 건다`);

    say(`${esc(it.text)} — ${ask.textContent}`);

    function pickBtn(label, value) {
      const b = el('button', 'bt__pick');
      b.type = 'button';
      b.innerHTML = `<span class="bt__pick__label">${esc(label)}</span>`;
      bin.on(b, 'click', () => place(it, value, b, [yes, no], card));
      return b;
    }
  }

  async function place(it, value, btn, both, card) {
    step.set('');   // 걸었으면 시킬 것이 없다. 실행이 흐르는 동안은 방해만 된다
    for (const b of both) { b.disabled = true; }
    btn.classList.add('bt__pick--taken');
    for (const b of both) if (b !== btn) b.classList.add('bt__pick--dropped');

    // 건 것이 카드에 도장으로 박힌다 — 되돌릴 수 없다는 걸 손에 남긴다
    const chip = el('span', 'bt__chip', esc(btn.textContent.trim()));
    card.append(chip);
    stamp(chip);
    say('걸었습니다. 실제로 어떻게 되는지 봅니다.');

    bets.push({ id: it.id, bet: value });
    await wait(420);

    // 실행이 흐른다. 여기서 결과를 미리 말하지 않는다 — 로그가 스스로 보여 준다.
    const r = runner(d.runCaption || '실제로 시켜 본다');
    stage.append(r.node);
    r.node.scrollIntoView({ block: 'nearest' });
    await r.play(it.run || []);

    const right = value === it.answer;
    gauge.mark(right);
    if (!right) shake(card);

    // base.js 의 verdict() 를 쓰지 않는다. 저쪽은 "맞았습니다/틀렸습니다" 판을 띄우는데,
    // 이 판에서 중요한 건 정답 여부가 아니라 **내가 건 것과 달랐다**는 사실이다.
    const strip = el('section', 'bt__verdict ' + (right ? 'is-right' : 'is-wrong'));
    strip.setAttribute('role', 'status');
    strip.innerHTML =
      `<div class="bt__verdict__head">${right ? '건 대로였다' : '건 것과 달랐다'}</div>` +
      `<p class="bt__verdict__body">${esc(it.truth)}</p>`;
    stage.append(strip);
    cardIn(strip);

    bar.node.hidden = false;
    bar.btn.next.textContent = at === items.length - 1 ? '결과 보기' : '다음';
    step.set(`${eulReul(`[${bar.btn.next.textContent}]`)} 누른다`, { done: true });
    bar.btn.next.focus();
  }

  function done() {
    const sim = game.simulate({ bets }, d);
    ctx.finish({
      grade: sim.grade,
      score: sim.score,
      elapsed: Math.round((Date.now() - startedAt) / 1000),
      mistakes: [],
      faults: sim.faults || [],
      gains: sim.gains || [],
      unlocked: sim.grade === 'fail' ? [] : (game.concept || [])
    });
  }
}
