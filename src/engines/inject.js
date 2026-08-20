// 엔진 I — 숨은 지시. **공격자를 먼저 해 보고, 편을 바꿔 같은 것을 막는다.**
//
// 엔진 G(슈팅)와 무엇이 다른가:
//   슈팅은 "쏜다 / 안 쏜다" 두 값이라, 왜 그게 위험한지가 조작에 안 들어온다.
//   여기서는 전반에 플레이어가 **직접 지시를 심는다** — 어디에 숨길지, 무엇을
//   시킬지를 고른다. 안 읽히는 자리에 심으면 아무 일도 안 일어나고, 에이전트에게
//   없는 도구를 시켜도 안 일어난다. 그 실패가 곧 후반의 대응책 이름이 된다.
//
// 조작은 누르고 → 누르기다. **끌기는 쓰지 않는다** — 좁은 화면에서 목록이 세로로
// 쌓이면 끌 거리가 화면 밖까지 나간다. 누르는 것은 전부 44px 이상이다.
//
// 판정이 끝나기 전에는 어느 공격이 막히는지 화면이 말하지 않는다. 대신 고른
// 대응책이 **무엇을 덮는 장치인지**는 계속 보여 준다 — 그건 지키는 쪽이 원래
// 아는 정보고, 이걸 감추면 감으로 찍는 판이 된다.
//
// 규칙은 core/inject.js 가 한다. 여기서 미리 그리는 것과 game.simulate() 가
// 점수를 내는 것이 **같은 함수**라, 화면과 판정이 어긋날 수 없다.
// 엔진은 무슨 내용인지 모른다 — 문구는 전부 game.data 에서 온다.

import { el, esc, strong, say, Bin, header, actions, runner, todo } from './base.js';
import { enter, cardIn, pulse, shake, wait } from '../core/motion.js';
import { eulReul } from '../core/ko.js';
import { build, lineup, craft, attackLog, coverage, cost, defend, byId } from '../core/inject.js';

let bin = new Bin();

export function unmount() { bin.clear(); }

export function mount(root, game, ctx) {
  unmount();
  bin = new Bin();

  const d = game.data;
  const L = d.labels || {};
  const budget = d.budget || 2;
  const startedAt = Date.now();

  /** 전반에서 고른 것 */
  let whereId = null;
  let whatId = null;
  /** 후반에서 켠 대응책 id */
  let picks = [];
  /** 전반 결과 · 후반에 들어오는 세 건 */
  let mine = null;
  let atks = [];
  let locked = false;

  root.innerHTML = '';
  root.append(header(game));
  root.append(briefCard());

  // 지금 눌러야 할 것 하나. 작업 지시서 바로 다음이다 —
  // "이런 상황이다 → 그래서 이걸 눌러라" 순서로 읽혀야 한다.
  // 이 판은 실시간이 아니라서 단계마다 계속 갱신한다.
  const step = todo();
  root.append(step.node);

  const stage = el('div', 'ij__stage');
  root.append(stage);

  const feedback = el('div');
  root.append(feedback);

  phaseAttack();

  // ------------------------------------------------------------ 작업 지시서

  /** 오늘 이 에이전트가 여는 자리와 가진 도구. 공격자는 이것만 보고 정한다. */
  function briefCard() {
    const t = el('article', 'ticket ij__brief');
    const chips = (cap, list, names) =>
      `<div class="ij__row"><span class="ij__row__cap">${esc(cap)}</span>` +
      list.map(k => `<span class="ij__chip">${esc(names[k] || k)}</span>`).join('') +
      `</div>`;
    t.innerHTML =
      `<div class="ticket__no">${esc(d.briefNo || '')}</div>` +
      `<div class="ticket__body">${strong(d.brief || '')}</div>` +
      chips(L.reads, d.agent.reads, d.readNames) +
      chips(L.tools, d.agent.tools, d.toolNames);
    return t;
  }

  // ------------------------------------------------------------ 전반 — 심는다

  function phaseAttack() {
    stage.innerHTML = '';

    const whereNodes = optList(L.step1, d.wheres, id => {
      whereId = whereId === id ? null : id;
      say(L.sayPlant);
      paintPlant();
    });
    const whatNodes = optList(L.step2, d.whats, id => {
      whatId = whatId === id ? null : id;
      say(L.sayWhat);
      paintPlant();
    });

    const paper = el('section', 'ij__paper');
    stage.append(paper);

    const hint = el('p', 'ij__hint', esc(L.hintPlant));
    stage.append(hint);

    const bar = actions([{ id: 'plant', label: L.plant, primary: true, disabled: true }]);
    stage.append(bar.node);
    bin.on(bar.btn.plant, 'click', plant);

    enter([...whereNodes.values(), ...whatNodes.values()], { each: 20 });
    paintPlant();

    function paintPlant() {
      for (const [id, n] of whereNodes) n.classList.toggle('ij__opt--on', id === whereId);
      for (const [id, n] of whatNodes) n.classList.toggle('ij__opt--on', id === whatId);

      const w = byId(d.wheres, whereId);
      const p = byId(d.whats, whatId);
      if (w && p) {
        const c = craft(w, p);
        paper.className = 'ij__paper ij__paper--set';
        paper.innerHTML =
          `<div class="ij__cap">${esc(L.paperCap)}</div>` +
          `<div class="ij__paper__where">${esc(c.place)}</div>` +
          `<p class="ij__paper__how">${esc(c.how)}</p>` +
          `<p class="ij__paper__line">${esc(c.line)}</p>`;
      } else {
        paper.className = 'ij__paper';
        paper.innerHTML = `<p class="ij__paper__wait">${esc(L.paperWait)}</p>`;
      }

      // 어디에 심어야 통하는지는 말하지 않는다 — 그걸 찾는 것이 전반의 전부다.
      // 아직 안 고른 칸의 이름만 그대로 불러 준다.
      if (!w) step.set(`[${L.step1}]에서 하나를 누른다`);
      else if (!p) step.set(`[${L.step2}]에서 하나를 누른다`);
      else step.set(`${eulReul(`[${L.plant}]`)} 누른다`, { done: true });

      const was = bar.btn.plant.disabled;
      bar.btn.plant.disabled = locked || !(w && p);
      if (was && !bar.btn.plant.disabled) pulse(bar.btn.plant, 1);
    }

    async function plant() {
      if (locked) return;
      locked = true;
      bar.btn.plant.disabled = true;
      step.set('');   // 결과가 흐르는 동안에는 시킬 것이 없다
      for (const n of [...whereNodes.values(), ...whatNodes.values()]) n.disabled = true;

      mine = build({ id: 'mine', label: L.mineDoc, where: whereId, what: whatId },
        d.wheres, d.whats, d.agent);

      const r = runner(L.attackCap);
      feedback.append(r.node);
      r.node.scrollIntoView({ block: 'nearest' });
      await r.play(attackLog(mine, d.say));
      await wait(160);

      const sw = actions([{ id: 'go', label: L.swap, primary: true }]);
      sw.node.classList.add('ij__swap');
      feedback.append(sw.node);
      cardIn(sw.node);
      sw.node.scrollIntoView({ block: 'nearest' });
      step.set(`${eulReul(`[${L.swap}]`)} 누른다`, { done: true });
      bin.on(sw.btn.go, 'click', () => {
        feedback.innerHTML = '';
        locked = false;
        phaseDefend();
      });
    }
  }

  /** 세로로 쌓는 고르기 목록. 같은 자리를 다시 누르면 꺼진다. */
  function optList(cap, list, onPick) {
    const box = el('section', 'ij__pick');
    box.append(el('div', 'ij__cap', esc(cap || '')));
    const nodes = new Map();
    for (const item of list) {
      const b = el('button', 'ij__opt');
      b.type = 'button';
      b.dataset.id = item.id;
      b.innerHTML =
        `<span class="ij__opt__t">${esc(item.label)}</span>` +
        (item.hidden ? `<span class="ij__opt__s">${esc(item.hidden)}</span>` : '');
      bin.on(b, 'click', () => onPick(item.id));
      box.append(b);
      nodes.set(item.id, b);
    }
    stage.append(box);
    return nodes;
  }

  // ------------------------------------------------------------ 후반 — 막는다

  function phaseDefend() {
    stage.innerHTML = '';

    const note = el('p', 'ij__swapnote', esc(L.swapNote));
    stage.append(note);
    cardIn(note);

    atks = lineup(
      d.fixed.map(f => build(f, d.wheres, d.whats, d.agent)),
      mine,
      build(d.fallback, d.wheres, d.whats, d.agent));

    // ---- 오늘 들어온 것 세 건. 어디서 온 글인지는 **직접 읽어서** 판단해야 한다 ----
    const docs = el('section', 'ij__docs');
    docs.append(el('div', 'ij__cap', esc(L.step3)));
    const docNodes = new Map();
    for (const a of atks) {
      const c = el('article', 'ij__doc' + (a.id === 'mine' ? ' ij__doc--mine' : ''));
      c.innerHTML =
        `<div class="ij__doc__name">${esc(a.label)}</div>` +
        `<div class="ij__doc__where">${esc(a.where.label)}</div>` +
        `<p class="ij__doc__line">` +
          `<span class="ij__doc__tag">${esc(L.hiddenCap)}</span>${esc(a.what.line)}</p>` +
        `<div class="ij__doc__mark"></div>`;
      docs.append(c);
      docNodes.set(a.id, c);
    }
    stage.append(docs);

    // ---- 대응책 ----
    const gbox = el('section', 'ij__guards');
    const gcap = el('div', 'ij__cap');
    const gnum = el('b', 'ij__cap__n');
    gcap.append(document.createTextNode(L.step4 || ''), gnum);
    gbox.append(gcap);

    const gNodes = new Map();
    for (const g of d.guards) {
      const b = el('button', 'ij__guard');
      b.type = 'button';
      b.dataset.id = g.id;
      b.innerHTML =
        `<i class="ij__guard__sw" aria-hidden="true"></i>` +
        `<span class="ij__guard__body">` +
          `<span class="ij__guard__t">${esc(g.label)}</span>` +
          `<span class="ij__guard__d">${esc(g.desc)}</span>` +
        `</span>`;
      bin.on(b, 'click', () => toggle(g));
      gbox.append(b);
      gNodes.set(g.id, b);
    }
    stage.append(gbox);

    const cover = el('div', 'ij__cover');
    stage.append(cover);

    const bar = actions([
      { id: 'reset', label: L.reset },
      { id: 'run', label: L.run, primary: true, disabled: true }
    ]);
    stage.append(bar.node);
    bin.on(bar.btn.reset, 'click', () => { if (!locked) { picks = []; paintGuard(); } });
    bin.on(bar.btn.run, 'click', run);

    enter([...docNodes.values(), ...gNodes.values()], { each: 22 });
    paintGuard();

    function toggle(g) {
      if (locked) return;
      if (picks.includes(g.id)) picks = picks.filter(x => x !== g.id);
      else if (picks.length >= budget) { shake(gNodes.get(g.id)); say(L.sayFull); return; }
      else picks.push(g.id);
      paintGuard();
    }

    function paintGuard() {
      const gs = picks.map(id => byId(d.guards, id)).filter(Boolean);
      for (const [id, n] of gNodes) {
        const on = picks.includes(id);
        n.classList.toggle('ij__guard--on', on);
        n.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      gnum.textContent = ` ${picks.length} / ${budget}`;

      // 무엇을 덮는 장치인지만 말한다. 어느 공격이 막히는지는 돌려 봐야 안다.
      const cv = coverage(gs);
      const chips = [
        ...cv.origins.map(o => d.originNames[o] || o),
        ...cv.tools.map(t => d.toolNames[t] || t)
      ];
      const gate = byId(d.guards, cv.gate);
      const bills = cost(gs, d.agent);
      const billNames = bills.flatMap(b => b.tools.map(t => d.toolNames[t] || t));

      cover.innerHTML =
        `<div class="ij__cap">${esc(L.coverCap)}</div>` +
        (chips.length
          ? `<div class="ij__row">${chips.map(c => `<span class="ij__chip ij__chip--on">${esc(c)}</span>`).join('')}</div>`
          : `<p class="ij__cover__none">${esc(L.coverNone)}</p>`) +
        (gate
          ? `<div class="ij__row"><span class="ij__row__cap">${esc(L.gateCap)}</span>` +
            `<span class="ij__chip ij__chip--gate">${esc(gate.label)} ${cv.cap}</span></div>`
          : '') +
        (billNames.length
          ? `<p class="ij__cost"><span class="ij__row__cap">${esc(L.costCap)}</span>` +
            `${esc(eulReul(billNames.join(' · ')))} ${esc(L.costTail || '')}</p>`
          : '');

      // 어느 대응책이 무엇을 막는지는 위 칸이 이미 보여 준다. 여기서는
      // **몇 개까지 켤 수 있고 다음에 무엇을 누르는지**만 말한다.
      // 예산이 남아 있으면 초록을 켜지 않는다. "더 켜거나"라고 말하면서 라벨이
      // "다 됐다"이면 줄이 스스로 앞뒤가 안 맞고, 무엇보다 **더 켜면 결과가 바뀐다.**
      // 예산을 다 쓴 뒤에는 더 할 수 있는 것이 없으므로 그때만 켠다.
      if (!picks.length) step.set(`[${L.step4}]에서 눌러 켠다`);
      else if (picks.length < budget) {
        step.set(`더 켜거나 ${eulReul(`[${L.run}]`)} 누른다`);
      } else step.set(`${eulReul(`[${L.run}]`)} 누른다`, { done: true });

      const was = bar.btn.run.disabled;
      bar.btn.run.disabled = locked;
      if (was && !bar.btn.run.disabled) pulse(bar.btn.run, 1);
    }

    /** 판정이 끝난 뒤에만 카드에 색이 붙는다 */
    function markDocs(v) {
      for (const a of atks) {
        const row = v.rows.find(x => x.id === a.id);
        const node = docNodes.get(a.id);
        if (!row || !node) continue;
        const by = byId(d.guards, row.by[0]);
        node.classList.add(row.stopped ? 'ij__doc--ok' : 'ij__doc--no');
        node.querySelector('.ij__doc__mark').textContent = row.stopped
          ? `${L.blocked} · ${by ? by.label : ''}`
          : `${L.through} · ${a.what.hurt}`;
      }
    }

    async function run() {
      if (locked) return;
      locked = true;
      bar.btn.run.disabled = true;
      bar.btn.reset.disabled = true;
      step.set('');   // 판정이 흐르는 동안에는 시킬 것이 없다
      for (const n of gNodes.values()) n.disabled = true;

      const gs = picks.map(id => byId(d.guards, id)).filter(Boolean);
      // 화면에 도장을 찍는 함수와 점수를 내는 함수가 같다 — 어긋날 수 없다
      markDocs(defend(atks, gs));

      const r = runner(L.runCap);
      feedback.append(r.node);
      r.node.scrollIntoView({ block: 'nearest' });

      const sim = game.simulate({ whereId, whatId, guardIds: picks.slice() }, d);
      await r.play(sim.steps);
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
}
