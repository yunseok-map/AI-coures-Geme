// 엔진 E — 미리보기형. 목표를 앞에 두고, 조작하면 결과가 그 자리에서 다시 쓰인다.
//
// "지시를 이렇게 쓰면 결과가 이렇게 달라진다"를 설명하는 대신 **손으로 만지게** 한다.
// 화면은 세 덩어리다:
//   ① 목표 결과물 — 무엇을 만들려는지 **먼저** 본다
//   ② 보낼 지시문 | AI가 내놓는 결과 — 블록을 켜고 끌 때마다 다시 쓰인다
//   ③ 블록 목록 — 서로 부딪히는 쌍이 둘 다 켜지면 그 표시가 난다
//
// 결과를 통째로 다시 그리면 무엇이 바뀌었는지 안 보인다. 그래서 줄마다 `slot` 을 받아
// 앞 화면과 맞춰 본다 — **새로 생긴 줄 · 달라진 줄 · 사라진 줄**이 구분되어 보인다.
//
// LLM 호출은 없다. game.render(켠블록) 이 미리 써 둔 줄을 규칙대로 고른다.

import { el, esc, say, Bin, header, actions, runner, todo } from './base.js';
import { press, animate, isReduced, enter } from '../core/motion.js';
import { eulReul } from '../core/ko.js';

const TAG = { add: '새로 생김', changed: '달라짐', gone: '사라짐' };

let bin = new Bin();
export function unmount() { bin.clear(); }

export function mount(root, game, ctx) {
  bin.clear();
  bin = new Bin();

  const d = game.data;
  const startedAt = Date.now();
  const active = new Set();
  const runLabel = d.runLabel || '이대로 보내기';

  // 지금 화면에 그려져 있는 줄. 다음 그리기에서 무엇이 바뀌었는지 재는 기준이다.
  let shownPrompt = [];
  let shownOut = [];

  root.innerHTML = '';
  root.append(header(game));

  // 지금 눌러야 할 것 하나. 목표 결과물을 본 **다음**에 온다 —
  // "이렇게 만들어야 한다 → 그래서 이걸 눌러라" 순서로 읽혀야 한다.
  const step = todo();

  // ---- ① 목표 결과물이 먼저 보인다 ----
  const goalPane = el('section', 'preview__pane pv__goal');
  goalPane.append(cap(d.goalCap || '목표 결과물', d.goalNote || ''));
  const goalBox = el('div', 'preview__out');
  for (const id of (d.goal || [])) goalBox.append(lineNode(d.lines[id], '', ''));
  goalPane.append(goalBox);
  root.append(goalPane, step.node);

  // ---- ② 지시문과 결과 ----
  const wrap = el('div', 'preview');

  const leftPane = el('section', 'preview__pane');
  leftPane.append(cap('보낼 지시문', ''));
  const promptBox = el('div', 'preview__out');
  leftPane.append(promptBox);

  const rightPane = el('section', 'preview__pane');
  const outCap = cap(d.outCap || 'AI가 내놓는 결과', '');
  const hitBox = el('span', 'pv__hit');
  outCap.append(hitBox);
  rightPane.append(outCap);
  const outBox = el('div', 'preview__out');
  rightPane.append(outBox);

  wrap.append(leftPane, rightPane);
  root.append(wrap);

  // ---- ③ 블록 ----
  root.append(el('div', 'slot__cap',
    esc(d.trayLabel || '지시문에 넣을 블록 — 켜면 오른쪽이 바로 바뀐다')));

  const list = el('div', 'toggles');
  const nodes = new Map();
  for (const t of d.toggles) {
    const b = el('button', 'toggle');
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML =
      `<span class="toggle__box" aria-hidden="true"></span>` +
      `<span>${esc(t.label)}<span class="toggle__why">${esc(t.desc || '')}</span></span>` +
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
    { id: 'send', label: runLabel, primary: true }
  ]);
  root.append(bar.node);
  bin.on(bar.btn.reset, 'click', () => { active.clear(); paint(true); });
  bin.on(bar.btn.send, 'click', send);

  paint();

  // ------------------------------------------------------------

  function cap(left, right) {
    const n = el('div', 'preview__cap', `<span>${esc(left)}</span>`);
    if (right) n.append(el('span', '', esc(right)));
    return n;
  }

  /** 결과 한 줄. state 가 있으면 무엇이 바뀐 줄인지 이름표가 붙는다. */
  function lineNode(text, state, tag, hit) {
    const n = el('div', 'pv__line' + (state ? ' pv__line--' + state : '') +
                       (hit ? ' pv__line--hit' : ''));
    n.textContent = text;
    if (tag) n.setAttribute('data-tag', tag);
    return n;
  }

  /**
   * 앞 화면과 맞춰 다시 그린다.
   *
   * 같은 자리(slot)에 다른 글이 오면 달라진 줄, 자리가 새로 생기면 새로 생긴 줄,
   * 자리가 없어지면 사라진 줄이다. 사라진 줄은 **있던 자리에 잠깐 남았다가** 지워진다 —
   * 바로 지워 버리면 무엇이 없어졌는지 볼 틈이 없다.
   */
  function paintLines(host, next, prev, moving) {
    const was = new Map(prev.map(l => [l.slot, l]));
    const now = new Set(next.map(l => l.slot));
    host.innerHTML = '';

    const changed = [];
    for (const l of next) {
      const p = was.get(l.slot);
      const state = !p ? 'add' : (p.id !== l.id ? 'changed' : 'same');
      const n = lineNode(l.text, state, state === 'same' ? '' : TAG[state], l.hit);
      host.append(n);
      if (state !== 'same') changed.push(n);
    }

    prev.forEach((p, i) => {
      if (now.has(p.slot)) return;
      const ghost = lineNode(p.text, 'gone', TAG.gone, false);
      host.insertBefore(ghost, host.children[i] || null);
      const drop = () => ghost.remove();
      bin.add(drop);
      setTimeout(drop, 1500);
    });

    if (moving && changed.length && !isReduced()) enter(changed, { each: 50, from: 6 });
  }

  function toggle(t, node) {
    if (active.has(t.id)) active.delete(t.id);
    else { active.add(t.id); press(node); }
    paint(true);
  }

  function paint(moving) {
    const view = game.render([...active], d);

    paintLines(promptBox, view.prompt, shownPrompt, moving);
    paintLines(outBox, view.output, shownOut, moving);
    shownPrompt = view.prompt;
    shownOut = view.output;

    // 점수가 목표와의 거리라는 것을 숫자로 계속 보여 준다
    hitBox.innerHTML = `목표와 일치 <b>${view.hit}</b> / ${view.total}`;
    if (moving && !isReduced()) animate(hitBox, { opacity: [.3, 1], duration: 220, ease: 'outQuad' });

    const clash = Array.isArray(d.clash) && d.clash.every(id => active.has(id));
    for (const [id, node] of nodes) {
      node.classList.toggle('toggle--on', active.has(id));
      node.classList.toggle('toggle--clash', clash && d.clash.includes(id));
      node.setAttribute('aria-pressed', String(active.has(id)));
    }

    // 지금 눌러야 할 것 하나. **어느 블록을 켜야 하는지는 말하지 않는다** —
    // 그게 이 판이 가르치려는 것이다. 켤 수 있다는 것과 보낼 수 있다는 것만 말한다.
    const send = `${eulReul(`[${runLabel}]`)} 누른다`;
    const full = view.hit >= view.total;
    step.set(!active.size ? '아래에서 켤 블록을 누른다' : full ? send : `${send}. 더 켜도 된다`,
      { done: full });

    say(view.say || '결과가 바뀌었습니다.');
  }

  async function send() {
    bar.btn.send.disabled = true;
    bar.btn.reset.disabled = true;
    for (const n of nodes.values()) n.disabled = true;
    step.set('');   // 이제 시킬 것이 없다. 결과가 흐르는 동안 남아 있으면 방해만 된다

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
