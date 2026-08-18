// 엔진 V — 증거판. 답변 문장을 근거 문서의 **해당 구간에 선으로 직접 잇는다.**
//
// 슈팅형(엔진 G)과 무엇이 다른가:
//   슈팅은 "쏜다 / 안 쏜다" 두 값이다. 그래서 이겨도 왜 이겼는지가 안 남는다.
//   여기서는 문장마다 **어디에 걸리는지를 대야 한다.** 걸 곳이 없으면 없다고
//   직접 표시해야 하고, 엉뚱한 자리에 걸면 그것도 틀린 것으로 잡힌다.
//   그래서 "그럴듯해 보여서 넘어갔다" 가 조작으로 남는다.
//
// 조작은 두 번 누르기다. 문장을 누르고, 걸 자리를 누른다. 같은 자리를 다시 누르면
// 끊긴다. 선을 눌러도 끊긴다. 끄는 동안에는 선이 손끝을 따라온다.
// **끌기는 쓰지 않는다** — 좁은 화면에서 두 열이 세로로 쌓이면 끌 거리가 너무 길어진다.
//
// 이 판의 규칙 하나: **전부 표시하기 전에는 아무것도 안 알려 준다.**
// 한 문장 걸 때마다 맞았다/틀렸다가 뜨면 뒤 문장은 그 반응을 보고 풀게 된다.
//
// 잇기 규칙은 core/evidence.js 가 한다 — 마지막 화면과 판정이 같은 답을 봐야 한다.
// 판정은 game.simulate({ marks, lines, spans }) 가 한다. 엔진은 무슨 내용인지 모른다.

import { el, esc, say, Bin, header, actions, runner, todo } from './base.js';
import { shake, enter, cardIn, pulse, wait, isReduced, drawLine } from '../core/motion.js';
import { euroJosa, eulReul } from '../core/ko.js';
import { NONE, judge, tally } from '../core/evidence.js';

let bin = new Bin();

export function unmount() { bin.clear(); }

export function mount(root, game, ctx) {
  unmount();
  bin = new Bin();

  const d = game.data;
  const lines = d.lines || [];
  const spans = d.spans || [];
  const L = d.labels || {};
  const noneLabel = L.none || '무근거';
  const runLabel = L.run || '이대로 보고하기';
  const startedAt = Date.now();

  /** 문장 id → 구간 id 또는 NONE */
  const marks = new Map();
  /** 지금 집어 든 문장 */
  let armed = null;
  let over = false;
  /** 판정 결과. 판정이 끝난 뒤에만 채워지고, 그 뒤에야 선에 색이 붙는다. */
  let verdictRows = null;

  root.innerHTML = '';
  root.append(header(game));

  // 지금 눌러야 할 것 하나. 자리는 **상황 카드 바로 다음**이다 —
  // "이런 답변이 돌아왔다 → 그래서 이걸 눌러라" 순서로 읽혀야 한다.
  const step = todo();

  // ---- 무엇을 물었고 무엇이 돌아왔는가 ----
  if (d.ask) {
    const t = el('article', 'ticket');
    t.innerHTML = `<div class="ticket__no">${esc(d.askCap || '들어온 답변')}</div>` +
                  `<div class="ticket__body">${esc(d.ask)}</div>`;
    root.append(t);
  }
  root.append(step.node);

  const hint = el('p', 'ev__hint');
  root.append(hint);

  // ---- 작업대 ----
  const board = el('div', 'ev__board');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'ev__wires');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    `<defs>` +
    `<marker id="evTip" viewBox="0 0 10 10" refX="9" refY="5" ` +
    `markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z"/></marker>` +
    `</defs><g class="ev__wires__g"></g><path class="ev__drag" d=""/>`;
  const wireLayer = svg.querySelector('.ev__wires__g');
  const dragLine = svg.querySelector('.ev__drag');
  board.append(svg);

  // 왼쪽 — 답변 문장
  const colL = el('div', 'ev__col');
  colL.append(el('div', 'ev__cap', esc(L.lines || 'AI 답변')));
  const lineNodes = new Map();
  lines.forEach((ln, i) => {
    const b = el('button', 'ev__line');
    b.type = 'button';
    b.dataset.id = ln.id;
    b.innerHTML =
      `<span class="ev__line__no">${i + 1}</span>` +
      `<span class="ev__line__text">${esc(ln.text)}</span>` +
      `<span class="ev__line__mark"></span>` +
      `<i class="ev__dot ev__dot--out" aria-hidden="true"></i>`;
    bin.on(b, 'click', () => tapLine(ln));
    colL.append(b);
    lineNodes.set(ln.id, b);
  });

  // 오른쪽 — 근거 문서의 구간 + 걸 곳 없음
  const colR = el('div', 'ev__col');
  colR.append(el('div', 'ev__cap', esc(L.spans || '근거 문서')));
  const targetNodes = new Map();
  for (const sp of spans) {
    const b = el('button', 'ev__span');
    b.type = 'button';
    b.dataset.id = sp.id;
    b.innerHTML =
      `<i class="ev__dot ev__dot--in" aria-hidden="true"></i>` +
      `<span class="ev__span__mark">${esc(sp.mark || '')}</span>` +
      `<span class="ev__span__text">${esc(sp.text)}</span>`;
    bin.on(b, 'click', () => tapTarget(sp.id, sp.mark || ''));
    colR.append(b);
    targetNodes.set(sp.id, b);
  }
  {
    const b = el('button', 'ev__span ev__span--none');
    b.type = 'button';
    b.dataset.id = NONE;
    b.innerHTML =
      `<i class="ev__dot ev__dot--in" aria-hidden="true"></i>` +
      `<span class="ev__span__mark">${esc(L.noneMark || '×')}</span>` +
      `<span class="ev__span__text">${esc(noneLabel)} — ${esc(L.noneHint || '이 문서 어디에도 걸 곳이 없다')}</span>`;
    bin.on(b, 'click', () => tapTarget(NONE, noneLabel));
    colR.append(b);
    targetNodes.set(NONE, b);
  }

  board.append(colL, colR);
  root.append(board);
  enter([...lineNodes.values(), ...targetNodes.values()], { each: 24 });

  // ---- 계기 — 몇 문장을 처리했나. 맞았는지는 아직 안 나온다 ----
  const meter = el('div', 'ev__meter');
  const meterNum = el('b', 'ev__meter__num');
  meter.append(
    el('span', 'ev__meter__cap', esc(L.meter || '표시한 문장')),
    meterNum,
    el('span', 'ev__meter__cut', esc(L.hold || '전부 표시해야 결과가 나온다'))
  );
  root.append(meter);

  const status = el('p', 'ev__status');
  status.setAttribute('role', 'status');
  root.append(status);

  const feedback = el('div');
  root.append(feedback);

  const bar = actions([
    { id: 'reset', label: L.reset || '표시 지우기' },
    { id: 'run', label: runLabel, primary: true, disabled: true }
  ]);
  root.append(bar.node);
  bin.on(bar.btn.reset, 'click', resetAll);
  bin.on(bar.btn.run, 'click', run);

  // 카드 높이가 바뀌면(창 크기·글꼴) 선도 다시 그린다. 안 그러면 선만 옛 자리에 남는다.
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => drawWires());
    ro.observe(board);
    bin.add(() => ro.disconnect());
  }
  bin.on(window, 'resize', drawWires);

  // 집어 든 동안 선이 손끝을 따라온다 — 지금 무엇을 하는 중인지가 손에 남는다
  bin.on(board, 'pointermove', (e) => {
    if (!armed || over || isReduced()) return;
    const from = anchor(lineNodes.get(armed), 'out');
    if (!from) return;
    const r = board.getBoundingClientRect();
    dragLine.setAttribute('d', curve(from, { x: e.clientX - r.left, y: e.clientY - r.top }));
  });

  paint();
  requestAnimationFrame(drawWires);

  // ------------------------------------------------------------ 조작

  function tapLine(ln) {
    if (over) return;
    if (armed === ln.id) { armed = null; say(L.sayDrop || '놓았다.'); paint(); return; }
    armed = ln.id;
    say(`${indexOf(ln.id)}${L.sayPick || '번 문장을 집었다. 걸 자리를 누르세요.'}`);
    paint();
  }

  function tapTarget(id, mark) {
    if (over) return;
    if (!armed) {
      shake(targetNodes.get(id));
      say(L.sayNeedLine || '문장을 먼저 누르세요.');
      return;
    }
    const no = indexOf(armed);
    if (marks.get(armed) === id) {
      marks.delete(armed);
      say(`${no}${L.sayCut || '번 문장의 선을 끊었다.'}`);
    } else if (id === NONE) {
      marks.set(armed, NONE);
      say(`${no}번 문장을 ${noneLabel}${euroJosa(noneLabel)} 표시했다.`);
    } else {
      marks.set(armed, id);
      say(`${no}번 문장을 ${mark} ${L.sayLink || '구간에 이었다.'}`);
    }
    armed = null;
    paint();
  }

  function resetAll() {
    if (over) return;
    marks.clear();
    armed = null;
    feedback.innerHTML = '';
    paint();
  }

  function indexOf(id) {
    return lines.findIndex(l => l.id === id) + 1;
  }

  // ------------------------------------------------------------ 선

  /** 카드에서 선이 나가고 들어오는 자리 (작업대 기준 좌표) */
  function anchor(node, side) {
    if (!node) return null;
    const dot = node.querySelector(side === 'out' ? '.ev__dot--out' : '.ev__dot--in');
    if (!dot) return null;
    const b = dot.getBoundingClientRect();
    const r = board.getBoundingClientRect();
    return { x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2 };
  }

  /**
   * 두 자리를 잇는 곡선. 손잡이를 방향에 따라 돌리는 이유는 전부
   * "작업대 밖으로 부풀지 않게" 다 — 좁은 화면에서 두 열이 세로로 쌓이면
   * 손잡이를 가로로 둔 선이 옆으로 크게 휘어 화면 밖까지 나간다.
   * (engines/wire.js 와 같은 규칙)
   */
  function curve(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx > 24) {
      const h = Math.max(30, dx * 0.5);
      return `M ${a.x} ${a.y} C ${a.x + h} ${a.y}, ${b.x - h} ${b.y}, ${b.x} ${b.y}`;
    }
    if (Math.abs(dx) <= 24) {
      const v = Math.max(24, Math.abs(dy) * 0.4);
      return `M ${a.x} ${a.y} C ${a.x} ${a.y + v}, ${b.x} ${b.y - v}, ${b.x} ${b.y}`;
    }
    const R = 30, midY = (a.y + b.y) / 2, midX = (a.x + b.x) / 2;
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
    for (const [lineId, targetId] of marks) {
      const from = anchor(lineNodes.get(lineId), 'out');
      const to = anchor(targetNodes.get(targetId), 'in');
      if (!from || !to) continue;
      // 화살촉이 받는 쪽 동그라미에 가려지지 않게 조금 앞에서 끝낸다.
      const end = Math.abs(to.x - from.x) <= 24
        ? { x: to.x, y: to.y - 9 }
        : { x: to.x - 9, y: to.y };
      const dPath = curve(from, end);

      const hit = document.createElementNS(svg.namespaceURI, 'path');
      hit.setAttribute('class', 'ev__wire__hit');
      hit.setAttribute('d', dPath);
      hit.addEventListener('click', () => {
        if (over) return;
        marks.delete(lineId);
        say(`${indexOf(lineId)}${L.sayCut || '번 문장의 선을 끊었다.'}`);
        paint();
      });

      const line = document.createElementNS(svg.namespaceURI, 'path');
      let cls = 'ev__wire';
      if (verdictRows) {
        const row = verdictRows.find(x => x.id === lineId);
        cls += row && row.ok ? ' ev__wire--ok' : ' ev__wire--no';
      }
      line.setAttribute('class', cls);
      line.setAttribute('d', dPath);
      line.setAttribute('marker-end', 'url(#evTip)');

      wireLayer.append(hit, line);
      // 새로 생긴 선만 그어진다. 이미 있던 선까지 다시 그으면
      // 하나 이을 때마다 화면 전체가 다시 그려져서 어느 것이 새 것인지 모른다.
      if (!drawn.has(dPath)) { drawn.add(dPath); drawLine(line, { ms: 380 }); }
    }
  }

  // ------------------------------------------------------------ 그리기

  function paint() {
    const t = tally(lines, marks);

    for (const ln of lines) {
      const node = lineNodes.get(ln.id);
      const at = marks.get(ln.id);
      node.classList.toggle('ev__line--armed', armed === ln.id);
      node.classList.toggle('ev__line--set', at != null);
      const badge = node.querySelector('.ev__line__mark');
      badge.textContent = at == null ? ''
        : at === NONE ? noneLabel
        : (spans.find(s => s.id === at)?.mark || '');
      node.setAttribute('aria-label',
        `${indexOf(ln.id)}번 문장. ${ln.text} ` +
        (at == null ? (L.aria || '아직 걸 자리를 정하지 않았다.')
                    : `지금 ${badge.textContent} 자리에 걸어 두었다.`));
    }

    for (const [id, node] of targetNodes) {
      node.classList.toggle('ev__span--target', !!armed);
      node.classList.toggle('ev__span--used', [...marks.values()].includes(id));
    }

    dragLine.setAttribute('d', '');
    dragLine.classList.toggle('is-on', !!armed);
    board.classList.toggle('ev__board--armed', !!armed);

    hint.textContent = armed
      ? (L.hintArmed || '걸 자리를 누르세요. 같은 문장을 다시 누르면 놓습니다.')
      : (L.hint || '문장을 누르고, 그 문장의 근거가 있는 자리를 누르면 선이 이어집니다.');

    meterNum.textContent = `${t.marked} / ${t.total}`;
    meter.classList.toggle('ev__meter--full', t.done);
    status.textContent = t.done
      ? (L.statusFull || '전부 표시했다. 이대로 보고할 수 있다.')
      : `${L.statusLeft || '남은 문장'} ${t.left}`;

    // 지금 눌러야 할 것 하나. **규칙만 말한다** — 어느 문장이 걸 데가 없는지는
    // 이 판이 가르치려는 것이라, 여기서 말하면 판이 없어진다.
    if (over) step.set('');
    else if (t.done) step.set(`${eulReul(`[${runLabel}]`)} 누른다`, { done: true });
    else if (armed) step.set(`걸 자리나 ${eulReul(`[${noneLabel}]`)} 누른다`);
    else step.set('문장을 누르고 근거 자리를 누른다');

    // 판정이 시작되면 다시 눌리지 않아야 한다 — 로그가 도는 동안 또 누르면 두 번 채점된다
    const was = bar.btn.run.disabled;
    bar.btn.run.disabled = over || !t.done;
    if (was && !bar.btn.run.disabled) pulse(bar.btn.run, 1);

    requestAnimationFrame(drawWires);
  }

  // ------------------------------------------------------------ 판정

  /**
   * 마지막 화면 — 어느 문장이 어디에 걸렸어야 했는지가 한 번에 보인다.
   * 판정과 같은 함수(core/evidence.js 의 judge)를 쓰므로 둘이 어긋날 수 없다.
   */
  function sheet(rows) {
    const box = el('section', 'ev__sheet');
    box.append(el('div', 'ev__cap', esc(L.sheet || '어디에 걸렸어야 했나')));
    const nameOf = (id) => id == null ? (L.blank || '표시 없음')
      : id === NONE ? noneLabel
      : (spans.find(s => s.id === id)?.mark || id);

    lines.forEach((ln, i) => {
      const row = rows.find(x => x.id === ln.id);
      const item = el('div', 'ev__row ' + (row && row.ok ? 'ev__row--ok' : 'ev__row--no'));
      item.innerHTML =
        `<span class="ev__row__no">${i + 1}</span>` +
        `<span class="ev__row__body">` +
          `<span class="ev__row__t">${esc(ln.text)}</span>` +
          `<span class="ev__row__at">` +
            `<b>${esc(nameOf(row ? row.pick : null))}</b>` +
            `<i aria-hidden="true">→</i>` +
            `<b class="ev__row__want">${esc(nameOf(row ? row.want : null))}</b>` +
          `</span>` +
          (row && !row.ok && ln.why ? `<span class="ev__row__why">${esc(ln.why)}</span>` : '') +
        `</span>`;
      box.append(item);
    });
    return box;
  }

  async function run() {
    over = true;
    armed = null;
    bar.btn.run.disabled = true;
    bar.btn.reset.disabled = true;
    for (const n of lineNodes.values()) n.disabled = true;
    for (const n of targetNodes.values()) n.disabled = true;

    const picked = Object.fromEntries(marks);
    verdictRows = judge(lines, picked);
    paint();

    const r = runner(d.runCaption || '표시한 대로 이 답변을 쓴다면');
    feedback.append(r.node);
    r.node.scrollIntoView({ block: 'nearest' });

    const sim = game.simulate({ marks: picked, lines, spans }, d);
    await r.play(sim.steps);
    await wait(160);

    const box = sheet(verdictRows);
    feedback.append(box);
    cardIn(box);
    box.scrollIntoView({ block: 'nearest' });
    await wait(420);

    ctx.finish({
      grade: sim.grade,
      score: sim.score,
      elapsed: Math.round((Date.now() - startedAt) / 1000),
      mistakes: sim.mistakes || [],
      faults: sim.faults || [],
      gains: sim.gains || [],
      unlocked: sim.grade === 'fail' ? [] : (game.concept || [])
    });
  }
}
