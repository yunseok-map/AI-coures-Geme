// 엔진 E — 미리보기형. 조작하면 결과가 그 자리에서 바뀐다.
//
// "지시를 이렇게 쓰면 결과가 이렇게 달라진다"를 설명하는 대신 **손으로 만지게** 한다.
// 왼쪽에서 지시문에 항목을 켜면, 오른쪽 결과물이 즉시 다시 쓰인다.
//
// LLM 호출은 없다. game.render(켜진항목) 이 미리 써 둔 조각을 규칙대로 이어 붙인다.

import { el, esc, say, Bin, header, actions, runner } from './base.js';
import { press, animate, isReduced, typeIn, enter } from '../core/motion.js';

let bin = new Bin();
export function unmount() { bin.clear(); }

export function mount(root, game, ctx) {
  bin.clear();
  bin = new Bin();

  const d = game.data;
  const startedAt = Date.now();
  const active = new Set();

  root.innerHTML = '';
  root.append(header(game));

  const wrap = el('div', 'preview');

  const leftPane = el('section', 'preview__pane');
  leftPane.innerHTML = `<div class="preview__cap">보낼 지시문</div>` +
                       `<div class="preview__out" id="pv-prompt"></div>`;

  const rightPane = el('section', 'preview__pane');
  rightPane.innerHTML = `<div class="preview__cap">${esc(d.outCap || 'AI가 내놓는 결과')}</div>` +
                        `<div class="preview__out" id="pv-out"></div>`;

  wrap.append(leftPane, rightPane);
  root.append(wrap);

  const promptBox = leftPane.querySelector('#pv-prompt');
  const outBox = rightPane.querySelector('#pv-out');

  root.append(el('div', 'slot__cap',
    esc(d.trayLabel || '지시문에 넣을 것 — 켜면 오른쪽 결과가 바로 바뀐다')));

  const list = el('div', 'toggles');
  const nodes = new Map();
  for (const t of d.toggles) {
    const b = el('button', 'toggle');
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML =
      `<span class="toggle__box" aria-hidden="true"></span>` +
      `<span>${esc(t.label)}<span class="target__why">${esc(t.desc || '')}</span></span>` +
      `<span class="toggle__tag">${esc(t.tag || '')}</span>`;
    bin.on(b, 'click', () => toggle(t, b));
    list.append(b);
    nodes.set(t.id, b);
  }
  root.append(list);
  enter([...nodes.values()], { each: 40 });

  const feedback = el('div');
  root.append(feedback);

  const bar = actions([
    { id: 'reset', label: '전부 끄기' },
    { id: 'send', label: d.runLabel || '이대로 보내기', primary: true }
  ]);
  root.append(bar.node);
  bin.on(bar.btn.reset, 'click', () => {
    active.clear();
    for (const n of nodes.values()) { n.classList.remove('toggle--on'); n.setAttribute('aria-pressed', 'false'); }
    paint();
  });
  bin.on(bar.btn.send, 'click', send);

  paint();

  // ------------------------------------------------------------

  function toggle(t, node) {
    if (active.has(t.id)) active.delete(t.id);
    else { active.add(t.id); press(node); }
    node.classList.toggle('toggle--on', active.has(t.id));
    node.setAttribute('aria-pressed', String(active.has(t.id)));
    paint(true);
  }

  function paint(animateChange) {
    const view = game.render([...active], d);
    promptBox.textContent = view.prompt;

    // 켤 때마다 결과물이 그 자리에서 다시 쓰인다 — 이 게임이 보여주려는 것 자체다
    if (animateChange && !isReduced()) {
      typeIn(outBox, view.output, { duration: 420 });   // <em> 강조만 들어간다 (게임 데이터에서 옴)
      animate(promptBox, { opacity: [.4, 1], translateY: [3, 0], duration: 200, ease: 'outQuad' });
    } else {
      outBox.innerHTML = view.output;
    }
    say(view.say || '결과가 바뀌었습니다.');
  }

  async function send() {
    bar.btn.send.disabled = true;
    bar.btn.reset.disabled = true;
    for (const n of nodes.values()) n.disabled = true;

    const r = runner(d.runCaption || '지시대로 일을 시킨다');
    feedback.append(r.node);
    r.node.scrollIntoView({ block: 'nearest' });

    const sim = game.simulate([...active], d);
    await r.play(sim.steps);

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
