// 엔진 W — 배선형. 일 상자를 **선으로 직접 이어서** 워크플로우를 만든다.
//
// 배치형(엔진 D)과 무엇이 다른가:
//   배치형은 칸이 이미 있고 거기에 이름표를 떨어뜨린다. 순서는 칸 번호가 정해 준다.
//   배선형은 **칸이 없다.** 어느 일 다음에 어느 일이 오는지를 사용자가 선으로 정한다.
//   그래서 "나눠 맡기면 빨라진다"가 글이 아니라 **선 모양**으로 남는다 —
//   셋을 한 줄로 이으면 길어지고, 각각 따로 이어 두면 짧아진다.
//
// 조작은 두 번 누르기다. 보내는 상자를 누르고, 받는 상자를 누른다. 이미 이어져 있으면
// 같은 두 번으로 끊긴다. 선 자체를 눌러도 끊긴다. 끄는 동안에는 선이 손끝을 따라온다.
//
// 시간 계산은 core/graph.js 가 한다 — 화면에 뜨는 소요 시간과 판정이 같은 답을 봐야 한다.
// 판정은 game.simulate({ links, nodes, sched }) 가 한다. 엔진은 무슨 일인지 모른다.

import { el, esc, say, Bin, header, actions, runner, todo } from './base.js';
import { shake, enter, pulse, wait, isReduced, drawLine } from '../core/motion.js';
import { eulReul } from '../core/ko.js';
import { schedule, wouldCycle, normalize } from '../core/graph.js';

let bin = new Bin();
let play = null;

export function unmount() {
  bin.clear();
  if (play) { clearInterval(play); play = null; }
}

export function mount(root, game, ctx) {
  unmount();
  bin = new Bin();

  const d = game.data;
  const nodes = d.nodes || [];
  const startedAt = Date.now();

  /** 사용자가 그은 선 */
  const links = [];
  /** 지금 집어 든 보내는 쪽 */
  let armed = null;
  let running = false;

  root.innerHTML = '';
  root.append(header(game));

  if (d.brief) {
    const t = el('article', 'ticket');
    t.innerHTML = `<div class="ticket__no">${esc(d.briefCap || '상황')}</div>` +
                  `<div class="ticket__body">${esc(d.brief)}</div>`;
    root.append(t);
  }

  // 지금 눌러야 할 것 하나. 일감 카드 바로 다음에 둔다 — 어떻게 이어야 빠른지는
  // 이 판이 가르치려는 것이라 여기서 말하지 않는다. 조작 방법만 말한다.
  const step = todo();
  root.append(step.node);

  const hint = el('p', 'wf__hint');
  root.append(hint);

  // ---- 작업대 ----
  const cols = Math.max(...nodes.map(n => n.col || 1), 1);
  const rows = Math.max(...nodes.map(n => n.row || 1), 1);
  const board = el('div', 'wf__board');
  board.style.setProperty('--cols', String(cols));
  board.style.setProperty('--rows', String(rows));

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'wf__wires');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    `<defs>` +
    `<marker id="wfTip" viewBox="0 0 10 10" refX="9" refY="5" ` +
    `markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z"/></marker>` +
    `<marker id="wfTipOn" viewBox="0 0 10 10" refX="9" refY="5" ` +
    `markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z"/></marker>` +
    `</defs><g class="wf__wires__g"></g><path class="wf__drag" d=""/>`;
  const wireLayer = svg.querySelector('.wf__wires__g');
  const dragLine = svg.querySelector('.wf__drag');
  board.append(svg);

  const nodeNodes = new Map();
  for (const n of nodes) {
    const b = el('button', 'wf__node');
    b.type = 'button';
    b.dataset.id = n.id;
    b.style.setProperty('--col', String(n.col || 1));
    b.style.setProperty('--row', String(n.row || 1));
    if (n.kind === 'gate') b.classList.add('wf__node--gate');
    if (n.irreversible) b.classList.add('wf__node--final');
    b.innerHTML =
      `<i class="wf__dot wf__dot--in" aria-hidden="true"></i>` +
      `<span class="wf__node__label">${esc(n.label)}</span>` +
      `<span class="wf__node__meta">${esc(n.note || ((n.dur ?? 1) + '칸'))}</span>` +
      `<span class="wf__node__tag"></span>` +
      `<i class="wf__dot wf__dot--out" aria-hidden="true"></i>`;
    bin.on(b, 'click', () => tapNode(n));
    board.append(b);
    nodeNodes.set(n.id, b);
  }
  root.append(board);
  enter([...nodeNodes.values()], { each: 30 });

  // ---- 계기 (마감이 있는 판만) ----
  //
  // 선을 하나 그을 때마다 여기 숫자가 바뀐다. 이 즉각적인 반응이 이 판의 전부다 —
  // 한 줄로 이으면 늘어나고, 갈라 이으면 줄어드는 걸 **긋는 순간** 본다.
  let meterNum = null, meterBox = null, gantt = null;
  if (d.deadline) {
    meterBox = el('div', 'wf__meter');
    meterNum = el('b', 'wf__meter__num');
    meterBox.append(
      el('span', 'wf__meter__cap', '걸리는 시간'),
      meterNum,
      el('span', 'wf__meter__cut', `마감 ${d.deadline}칸`)
    );
    gantt = el('div', 'wf__gantt');
    root.append(meterBox, gantt);
  }

  const status = el('p', 'wf__status');
  status.setAttribute('role', 'status');
  root.append(status);

  const feedback = el('div');
  root.append(feedback);

  const bar = actions([
    { id: 'reset', label: '선 지우기' },
    { id: 'run', label: d.runLabel || '이대로 돌리기', primary: true, disabled: true }
  ]);
  root.append(bar.node);
  bin.on(bar.btn.reset, 'click', resetAll);
  bin.on(bar.btn.run, 'click', run);

  // 상자가 움직이면(창 크기·글꼴) 선도 다시 그린다. 안 그러면 선만 옛 자리에 남는다.
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => drawWires());
    ro.observe(board);
    bin.add(() => ro.disconnect());
  }
  bin.on(window, 'resize', drawWires);

  // 집어 든 동안 선이 손끝을 따라온다 — 지금 무엇을 하는 중인지가 손에 남는다
  bin.on(board, 'pointermove', (e) => {
    if (!armed || isReduced()) return;
    const from = anchor(armed, 'out');
    const r = board.getBoundingClientRect();
    dragLine.setAttribute('d', curve(from, { x: e.clientX - r.left, y: e.clientY - r.top }));
  });

  paint();
  requestAnimationFrame(drawWires);

  // ------------------------------------------------------------

  function tapNode(n) {
    if (running) return;
    const node = nodeNodes.get(n.id);

    if (!armed) {
      armed = n.id;
      say(`${eulReul(n.label)} 집었다. 다음에 올 상자를 누른다.`);
      paint();
      return;
    }
    if (armed === n.id) { armed = null; say('놓았다.'); paint(); return; }

    const at = links.findIndex(l => l.from === armed && l.to === n.id);
    if (at >= 0) {
      links.splice(at, 1);
      say('선을 끊었다.');
    } else if (wouldCycle(links, armed, n.id)) {
      // 되돌아오는 선을 허용하면 앞 일이 끝나야 시작하는데 그 앞 일이 자기 뒤에 있게 된다.
      // 화면에서는 그냥 "아무것도 안 도는" 상태로만 보여서 왜인지 알 수 없다 — 긋기 전에 막는다.
      shake(node);
      say('되돌아오는 선은 이을 수 없다. 그러면 일이 영영 시작되지 않는다.');
      armed = null; paint(); return;
    } else {
      links.push({ from: armed, to: n.id });
      const fromLabel = nodes.find(x => x.id === armed).label;
      say(`${fromLabel} 다음에 ${eulReul(n.label)} 이었다.`);
    }
    armed = null;
    paint();
  }

  function resetAll() {
    if (running) return;
    links.length = 0;
    armed = null;
    feedback.innerHTML = '';
    paint();
  }

  /** 상자에서 선이 나가고 들어오는 자리 (작업대 기준 좌표) */
  function anchor(id, side) {
    const node = nodeNodes.get(id);
    const dot = node.querySelector(side === 'out' ? '.wf__dot--out' : '.wf__dot--in');
    const b = dot.getBoundingClientRect();
    const r = board.getBoundingClientRect();
    return { x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2 };
  }

  /**
   * 두 자리를 잇는 곡선. 선은 늘 오른쪽 동그라미에서 나와 왼쪽 동그라미로 들어간다.
   *
   * 세 갈래로 나누는 이유는 전부 "작업대 밖으로 부풀지 않게" 다:
   *  - 앞으로 가는 선: 손잡이를 가로로. 가장 흔하고 가장 읽기 쉽다.
   *  - 위아래로만 가는 선: 좁은 화면에서 상자가 세로로 쌓일 때(assets/wire.css).
   *    손잡이를 가로로 두면 선이 옆으로 크게 휘어 작업대를 넘어간다.
   *  - 되돌아 들어가는 선: 받는 쪽이 보내는 쪽보다 왼쪽에 있을 때. 손잡이를 가로로만
   *    두면 S 자가 양쪽으로 크게 벌어져 화면 밖까지 나간다(실제로 그렇게 그려졌다).
   *    두 마디로 끊어 **두 상자 사이 높이**를 지나가게 한다.
   */
  function curve(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx > 24) {
      const h = Math.max(36, dx * 0.55);
      return `M ${a.x} ${a.y} C ${a.x + h} ${a.y}, ${b.x - h} ${b.y}, ${b.x} ${b.y}`;
    }
    if (Math.abs(dx) <= 24) {
      const v = Math.max(28, Math.abs(dy) * 0.45);
      return `M ${a.x} ${a.y} C ${a.x} ${a.y + v}, ${b.x} ${b.y - v}, ${b.x} ${b.y}`;
    }
    const R = 34, midY = (a.y + b.y) / 2, midX = (a.x + b.x) / 2;
    return `M ${a.x} ${a.y} C ${a.x + R} ${a.y}, ${a.x + R} ${midY}, ${midX} ${midY} ` +
           `C ${b.x - R} ${midY}, ${b.x - R} ${b.y}, ${b.x} ${b.y}`;
  }

  /** 이미 그어 본 선의 모양(d). 창 크기가 바뀌어 다시 그릴 때는
      같은 모양이면 다시 긋지 않는다 — 안 그러면 스크롤할 때마다 전부 다시 그어진다. */
  const drawn = new Set();

  function drawWires() {
    const r = board.getBoundingClientRect();
    if (!r.width) return;
    svg.setAttribute('width', String(r.width));
    svg.setAttribute('height', String(r.height));

    wireLayer.innerHTML = '';
    for (const l of links) {
      if (!nodeNodes.has(l.from) || !nodeNodes.has(l.to)) continue;
      const a = anchor(l.from, 'out');
      const z = anchor(l.to, 'in');
      // 화살촉이 받는 쪽 동그라미에 가려지지 않게 조금 앞에서 끝낸다.
      // 물러나는 방향은 curve() 가 어느 쪽에서 들어오게 그리는지와 같아야 한다 —
      // 세로로 쌓인 화면에서만 위에서 내려오고, 나머지는 전부 왼쪽에서 들어온다.
      const end = Math.abs(z.x - a.x) <= 24
        ? { x: z.x, y: z.y - 9 }
        : { x: z.x - 9, y: z.y };
      const dPath = curve(a, end);

      const hit = document.createElementNS(svg.namespaceURI, 'path');
      hit.setAttribute('class', 'wf__wire__hit');
      hit.setAttribute('d', dPath);
      hit.addEventListener('click', () => {
        if (running) return;
        const at = links.findIndex(x => x.from === l.from && x.to === l.to);
        if (at >= 0) { links.splice(at, 1); say('선을 끊었다.'); paint(); }
      });

      const line = document.createElementNS(svg.namespaceURI, 'path');
      line.setAttribute('class', 'wf__wire');
      line.setAttribute('d', dPath);
      line.setAttribute('marker-end', 'url(#wfTip)');
      line.dataset.from = l.from;
      line.dataset.to = l.to;

      wireLayer.append(hit, line);
      // 새로 생긴 선만 그어진다. 이미 있던 선까지 다시 그으면
      // 하나 이을 때마다 화면 전체가 다시 그려져서 어느 것이 새 것인지 모른다.
      if (!drawn.has(dPath)) { drawn.add(dPath); drawLine(line, { ms: 380 }); }
    }
  }

  function drawGantt(sched) {
    if (!gantt) return;
    const cap = Math.max(d.deadline + 2, sched.finish, 4);
    gantt.innerHTML = '';
    gantt.style.setProperty('--cap', String(cap));
    gantt.style.setProperty('--dl', String(d.deadline));
    for (const n of nodes) {
      if (!(n.id in sched.end)) continue;
      const row = el('div', 'wf__gr');
      row.dataset.id = n.id;
      row.style.setProperty('--from', String(sched.start[n.id]));
      row.style.setProperty('--to', String(sched.end[n.id]));
      row.innerHTML = `<span class="wf__gr__cap">${esc(n.label)}</span>` +
                      `<span class="wf__gr__track"><i class="wf__gr__bar"></i></span>`;
      gantt.append(row);
    }
    gantt.setAttribute('aria-label',
      `일정 미리보기. 전체 ${sched.finish}칸, 마감 ${d.deadline}칸.`);
  }

  function paint() {
    const sched = schedule(nodes, links);

    for (const n of nodes) {
      const node = nodeNodes.get(n.id);
      node.classList.toggle('wf__node--armed', armed === n.id);
      // 집어 든 것이 있으면 나머지는 전부 "받을 수 있는 곳" 으로 보인다
      node.classList.toggle('wf__node--target', !!armed && armed !== n.id);
      const head = !links.some(l => l.to === n.id);
      node.classList.toggle('wf__node--head', head);
      node.querySelector('.wf__node__tag').textContent = head ? '바로 시작' : '';
      node.setAttribute('aria-label',
        `${n.label}. ` +
        (head ? '들어오는 선 없음 — 바로 시작한다. ' : `앞: ${incoming(n.id)}. `) +
        (armed === n.id ? '집은 상태. 다시 누르면 놓는다.'
                        : armed ? '누르면 이 상자로 선이 이어진다.' : '누르면 집는다.'));
    }

    dragLine.setAttribute('d', '');
    dragLine.classList.toggle('is-on', !!armed);
    board.classList.toggle('wf__board--armed', !!armed);

    hint.textContent = armed
      ? '다음에 올 상자를 누른다. 같은 상자를 다시 누르면 놓는다.'
      : (d.wireHint || '상자를 누르고, 그 다음에 올 상자를 누르면 선이 이어진다. 선을 누르면 끊어진다.');

    const parts = [`이은 선 ${links.length}개`];
    if (sched.cycle.length) parts.push('돌고 도는 선이 있다');
    status.textContent = parts.join(' · ');

    if (meterNum) {
      meterNum.textContent = `${sched.finish}칸`;
      meterBox.classList.toggle('wf__meter--over', sched.finish > d.deadline);
      drawGantt(sched);
    }

    const was = bar.btn.run.disabled;
    bar.btn.run.disabled = links.length === 0;
    if (was && !bar.btn.run.disabled) pulse(bar.btn.run, 1);

    tellStep();
    requestAnimationFrame(drawWires);
  }

  /** 지금 눌러야 할 것 하나. 재생이 흐르는 동안에는 지운다. */
  function tellStep() {
    if (running) { step.set(''); return; }
    if (armed) { step.set('다음에 올 상자를 누른다'); return; }
    if (!links.length) { step.set('상자를 누르고 다음 상자를 누른다'); return; }
    const runLabel = d.runLabel || '이대로 돌리기';
    // 초록 "다 됐다"를 켜지 않는다. 본문이 "더 이어도 된다"라고 말하는데 라벨이
    // "다 됐다"이면 줄이 앞뒤가 안 맞는다. 선을 하나 이은 것과 흐름을 다 만든 것은
    // 다른 상태이고, **더 이으면 결과가 바뀐다.**
    step.set(`${eulReul(`[${runLabel}]`)} 누른다. 더 이어도 된다`);
  }

  function incoming(id) {
    const from = links.filter(l => l.to === id)
      .map(l => nodes.find(n => n.id === l.from)?.label).filter(Boolean);
    return from.length ? from.join(', ') : '없음';
  }

  /**
   * 재생 — 내가 이은 대로 일이 흐른다.
   *
   * 여기서는 loop.js 를 쓰지 않는다. 그쪽은 "탭을 벗어나면 멈추고 사용자가 이어서 누른다"가
   * 규칙인데, 재생은 사용자가 조작하는 구간이 아니라서 멈추면 이어 줄 사람이 없다.
   * 대신 어떤 이유로든 안 끝날 때를 대비해 안전망을 건다.
   */
  function playback(sched) {
    const STEP = Math.round((d.playSec ?? 0.5) * 1000);
    const total = Math.max(sched.finish, 1);
    return new Promise(done => {
      let t = -1, over = false, guard = 0;
      const finish = () => {
        if (over) return;
        over = true;
        if (play) { clearInterval(play); play = null; }
        if (guard) { clearTimeout(guard); guard = 0; }
        done();
      };

      play = setInterval(() => {
        if (over) return;
        t++;
        if (t >= total) { finish(); return; }
        for (const n of nodes) {
          const node = nodeNodes.get(n.id);
          const s = sched.start[n.id], e = sched.end[n.id];
          const live = e != null && s <= t && t < e;
          node.classList.toggle('is-now', live);
          node.classList.toggle('is-done', e != null && e <= t);
        }
        for (const line of wireLayer.querySelectorAll('.wf__wire')) {
          const e = sched.end[line.dataset.from];
          const on = e != null && e <= t;
          line.classList.toggle('is-on', on);
          line.setAttribute('marker-end', on ? 'url(#wfTipOn)' : 'url(#wfTip)');
        }
        if (gantt) gantt.style.setProperty('--now', String(t + 1));
      }, STEP);

      guard = setTimeout(finish, total * STEP * 3 + 3000);
    });
  }

  async function run() {
    running = true;
    armed = null;
    bar.btn.run.disabled = true;
    bar.btn.reset.disabled = true;
    for (const n of nodeNodes.values()) n.disabled = true;
    paint();

    const sched = schedule(nodes, links);
    say('이은 대로 일이 흐른다.');
    await playback(sched);
    await wait(200);

    const r = runner(d.runCaption || '이은 대로 돌려 본다');
    feedback.append(r.node);
    r.node.scrollIntoView({ block: 'nearest' });

    const sim = game.simulate({ links: normalize(links), nodes, sched }, d);
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
