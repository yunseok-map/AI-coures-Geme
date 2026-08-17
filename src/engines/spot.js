// 엔진 B — 판별형. 여러 개 중에서 골라낸다 / 숨은 위험을 찾는다.
//
// 모드:
//   pick  (기본) 목록에서 해당하는 것을 골라 [확인]. 게임 2·4·14·15
//   myth        한 장씩 나오는 주장에 사실/오해로 답한다. 게임 7
//
// game.simulate(picked) 가 있으면 판정 뒤에 실행 로그가 흐른다 —
// 내가 고른 것 때문에 결과가 어떻게 달라지는지 눈으로 보여주는 부분.

import { el, esc, strong, say, Bin, header, actions, runner } from './base.js';
import { press, shake, enter, cardIn } from '../core/motion.js';

let bin = new Bin();
let timer = null;

export function unmount() {
  bin.clear();
  if (timer) { clearInterval(timer); timer = null; }
}

export function mount(root, game, ctx) {
  unmount();
  bin = new Bin();
  if (game.mode === 'myth') return mountMyth(root, game, ctx);
  return mountPick(root, game, ctx);
}

// ---------------------------------------------------------------- pick

function mountPick(root, game, ctx) {
  const d = game.data;
  const need = d.need ?? d.targets.filter(t => t.danger).length;
  const startedAt = Date.now();
  const picked = new Set();
  let left = game.timeLimit || 0;

  root.innerHTML = '';
  root.append(header(game));

  const counter = el('div', 'counter');
  root.append(counter);

  if (d.scene && d.scene.body) {
    const s = el('section', 'source');
    s.innerHTML =
      `<div class="source__cap">${esc(d.scene.cap || '대조할 근거 자료')}</div>` +
      `<div>${esc(d.scene.body)}</div>`;
    root.append(s);
    cardIn(s);
  }

  if (d.prompt) root.append(el('p', 'stage__lead', esc(d.prompt)));

  const list = el('div', d.layout === 'board' ? 'board' : 'targets');
  root.append(list);

  const nodes = [];
  for (const t of d.targets) {
    const b = el('button', d.layout === 'board' ? 'board__row' : 'target');
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = d.layout === 'board'
      ? `<span>${esc(t.label)}</span><span class="board__tag">${esc(t.tag || '')}</span>`
      : `<span class="target__box" aria-hidden="true"></span><span>${esc(t.label)}</span>`;
    bin.on(b, 'click', () => toggle(t, b));
    list.append(b);
    nodes.push(b);
  }
  enter(nodes, { each: 35 });

  const feedback = el('div');
  root.append(feedback);

  const bar = actions([{ id: 'check', label: '확인', primary: true, disabled: true }]);
  root.append(bar.node);
  bin.on(bar.btn.check, 'click', judge);

  tick();
  if (left) timer = setInterval(() => { left--; tick(); if (left <= 0) judge(); }, 1000);

  function tick() {
    counter.innerHTML =
      `<span>고른 것 <b>${picked.size}</b> / ${need}</span>` +
      (left ? `<span>남은 시간 <b>${left}초</b></span>` : '');
  }

  function toggle(t, node) {
    if (picked.has(t.id)) { picked.delete(t.id); node.classList.remove('target--picked'); }
    else { picked.add(t.id); node.classList.add('target--picked'); press(node); }
    node.setAttribute('aria-pressed', String(picked.has(t.id)));
    bar.btn.check.disabled = picked.size === 0;
    tick();
  }

  async function judge() {
    if (timer) { clearInterval(timer); timer = null; }
    for (const n of nodes) n.disabled = true;
    bar.btn.check.disabled = true;

    let hit = 0, miss = 0;
    const mistakes = [];

    d.targets.forEach((t, i) => {
      const chose = picked.has(t.id);
      const node = nodes[i];
      if (t.danger && chose) { hit++; node.classList.add('target--hit'); }
      else if (!t.danger && chose) {
        miss++; node.classList.add('target--miss');
        mistakes.push({ itemId: t.id, chose: 'picked', correct: 'safe', hint: t.why });
      } else if (t.danger && !chose) {
        node.classList.add('target--miss');
        mistakes.push({ itemId: t.id, chose: 'skipped', correct: 'danger', hint: t.why });
      }
      if (t.why && (t.danger || chose)) {
        node.querySelector('span:last-child')
          .insertAdjacentHTML('beforeend', `<span class="target__why">${strong(t.why)}</span>`);
      }
    });

    const score = Math.max(0, Math.round((hit / need) * 100 - miss * 15));
    const grade = score >= 80 ? 'pass' : score >= 50 ? 'partial' : 'fail';
    say(`${need}개 중 ${hit}개를 찾았습니다.`);

    if (game.simulate) {
      const r = runner(game.runCaption || '고른 대로 AI를 돌려 본다');
      feedback.append(r.node);
      r.node.scrollIntoView({ block: 'nearest' });
      const sim = game.simulate([...picked], d);
      await r.play(sim.steps);
      finish(sim.grade ?? grade, sim.score ?? score, mistakes, sim);
      return;
    }
    finish(grade, score, mistakes, null);
  }

  function finish(grade, score, mistakes, sim) {
    ctx.finish({
      grade, score,
      elapsed: Math.round((Date.now() - startedAt) / 1000),
      mistakes,
      faults: sim?.faults || [],
      gains: sim?.gains || [],
      unlocked: grade === 'fail' ? [] : (game.concept || [])
    });
  }
}

// ---------------------------------------------------------------- myth

function mountMyth(root, game, ctx) {
  const items = game.data.items.slice();
  const total = items.length;
  const startedAt = Date.now();
  let i = 0, correct = 0;
  const mistakes = [];

  root.innerHTML = '';
  root.append(header(game));

  const counter = el('div', 'counter');
  root.append(counter);

  const holder = el('div');
  root.append(holder);

  const feedback = el('div');
  root.append(feedback);

  step();

  function step() {
    const it = items[i];
    counter.innerHTML = `<span>${i} / ${total}</span><span>맞은 개수 <b>${correct}</b></span>`;

    const card = el('article', 'ticket');
    card.innerHTML =
      `<div class="ticket__no">흔히 듣는 말 ${String(i + 1).padStart(2, '0')}</div>` +
      `<div class="ticket__body">“${esc(it.claim)}”</div>`;
    holder.innerHTML = '';
    holder.append(card);
    cardIn(card);

    const bar = actions([
      { id: 'true', label: '맞는 말이다' },
      { id: 'false', label: '오해다' }
    ]);
    holder.append(bar.node);
    bin.on(bar.btn.true, 'click', () => answer(true, bar));
    bin.on(bar.btn.false, 'click', () => answer(false, bar));
    say(it.claim);
  }

  function answer(saidTrue, bar) {
    const it = items[i];
    const right = saidTrue === Boolean(it.isTrue);
    bar.btn.true.disabled = bar.btn.false.disabled = true;

    if (right) { correct++; press(saidTrue ? bar.btn.true : bar.btn.false); }
    else { shake(saidTrue ? bar.btn.true : bar.btn.false); mistakes.push({ itemId: it.id, hint: it.truth }); }

    const box = el('div', right ? 'hint hint--ok' : 'hint');
    box.innerHTML = `<b>${it.isTrue ? '맞는 말이다.' : '오해다.'}</b><br>${strong(it.truth)}`;

    i++;
    const nav = actions([{ id: 'n', label: i < total ? '다음' : '결과 보기', primary: true }]);
    bin.on(nav.btn.n, 'click', () => {
      feedback.innerHTML = '';
      if (i < total) step(); else finish();
    });

    feedback.innerHTML = '';
    feedback.append(box, nav.node);
    nav.btn.n.focus();
  }

  function finish() {
    const score = Math.round((correct / total) * 100);
    const grade = score >= 80 ? 'pass' : score >= 50 ? 'partial' : 'fail';
    ctx.finish({
      grade, score,
      elapsed: Math.round((Date.now() - startedAt) / 1000),
      mistakes,
      unlocked: grade === 'fail' ? [] : (game.concept || [])
    });
  }
}
