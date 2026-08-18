// 엔진 C — 조립형. 부품을 골라 넣고 [실행]을 눌러 결과를 본다.
//
// 설명을 읽는 대신 **직접 세팅하고, 돌려보고, 자기 세팅 때문에 결과가 달라지는
// 걸 눈으로 본다.** 배치 방식 셋 — 판정은 언제나 game.simulate(setup) 가 한다:
//   예산형 (data.budget)  칸이 정해진 하나의 통. 넘치면 먼저 넣은 것이 밀려난다
//   슬롯형 (data.slots)   역할이 정해진 여러 칸. 부품을 집어 슬롯에 놓는다
//   회차형 (data.rounds)  자료가 회차마다 스스로 들어온다. 넘치면 오래된 것이
//                        **아무 말 없이** 흐려진다. 계산은 전부 core/bag.js 가 한다
// 여기에 수리형(data.repair)이 겹칠 수 있다 — 한 번 돌려 보고 고쳐서 다시 돌린다.

import { el, esc, say, Bin, header, actions, runner } from './base.js';
import { press, shake, enter, flyTo, pulse, wipeIn, dropOut }
  from '../core/motion.js';
import { hasBatchim, eulReul } from '../core/ko.js';
import { newDesk, arrive, takeOff, fold, live, dimmed, used as deskUsed, FOLD_N }
  from '../core/bag.js';

let bin = new Bin();
export function unmount() { bin.clear(); }

export function mount(root, game, ctx) {
  bin.clear();
  bin = new Bin();

  const d = game.data;
  const useSlots = Array.isArray(d.slots) && d.slots.length > 0;
  const useRounds = Array.isArray(d.rounds) && d.rounds.length > 0;
  const startedAt = Date.now();

  /** 넣은 부품 (예산형) — 넣은 순서를 지킨다. 밀려나는 순서가 이 순서다 */
  const pool = [];
  /** 슬롯형 배치 */
  const placed = new Map((d.slots || []).map(s => [s.id, []]));
  const evicted = [];
  let armed = null;   // 집어 든 부품

  /** 회차형 — 책상 상태(계산은 core/bag.js) · 수리형 — 몇 번째 실행인가 */
  let desk = newDesk(d.budget ?? 6), roundAt = -1, runNo = 1, locked = false, fell = [];
  const picked = new Set();

  root.innerHTML = '';
  root.append(header(game));

  // 회차형은 마지막 회차에 **그때 처음** 요청이 뜬다. 무엇을 물어볼지 미리 알면
  // "필요한 것만 남긴다"가 계획 문제가 되고, 모르게 잃는 성질이 사라진다.
  let ticket = null;
  if (d.brief) {
    ticket = el('article', 'ticket');
    setTicket(d.briefCap || '상황', d.brief);
    root.append(ticket);
  }

  // ---- 예산 표시 (예산형 · 회차형) ----
  //
  // 막대 하나 + "3 / 6칸" 숫자로는 남은 여유가 안 보여서 겁 없이 큰 것을 올린다.
  // 칸을 실제 그릇으로 그려야 올리기 전에 세어 본다. 이 판이 가르치는 세 용어가
  // 여기 다 들어 있다: 토큰(비용) · 컨텍스트 윈도우(칸 수) · 컨텍스트 로트(밀려남)
  let budgetNum = null, budgetBox = null, deskGrid = null;
  let roundCap = null, dimStrip = null;
  if (!useSlots) {
    if (useRounds) { roundCap = el('div', 'rd'); root.append(roundCap); }
    budgetBox = el('div', 'budget');
    budgetNum = el('span', 'budget__num');
    budgetBox.append(
      el('span', 'budget__cap', esc(d.budgetLabel || '가방')),
      budgetNum
    );
    // 칸 하나가 무엇인지 적어 둘 수 있다. 엔진은 그 뜻을 모르고 자리만 내준다 —
    // 판마다 칸의 의미가 다르다(1번은 토큰, 10번은 지침 분량).
    if (d.budgetUnit) budgetBox.append(el('span', 'budget__unit', esc(d.budgetUnit)));
    deskGrid = el('div', 'desk');
    deskGrid.style.setProperty('--cells', String(d.budget ?? 6));
    root.append(budgetBox, deskGrid);
    // 흐려진 자리. **아무 설명도 붙이지 않는다** — 적는 순간 이 판의 전부가 없어진다.
    if (useRounds) { dimStrip = el('div', 'dim'); root.append(dimStrip); }
  }

  // ---- 슬롯 (슬롯형) ----
  // 부품에 reach(열어 준 폭)가 있으면 슬롯마다 **통로**를 굵기로 그린다. 엔진은
  // 그 숫자의 뜻을 모른다 — 굵은 통로가 화면을 먹는 걸 보게 하는 장치다.
  const wired = useSlots && (d.parts || []).some(p => p.reach);
  const slotNodes = new Map();
  if (useSlots) {
    const wrap = el('div', 'slots');
    if (wired) {
      wrap.append(el('div', 'slot__cap',
        esc(d.wireHint || '통로가 굵을수록 많이 열어 준 것이다')));
    }
    for (const s of d.slots) {
      const node = el('div', 'slot');
      node.innerHTML =
        (wired ? `<div class="slot__wire" aria-hidden="true"></div>` : '') +
        `<div class="slot__cap">${esc(s.label)}<span class="slot__tag"></span></div>` +
        `<div class="slot__items"></div>`;
      const hit = el('button', 'btn-quiet', '여기 놓기');
      hit.type = 'button';
      hit.style.marginTop = 'var(--sp-2)';
      hit.hidden = true;
      node.append(hit);
      bin.on(hit, 'click', () => placeInto(s));
      wrap.append(node);
      slotNodes.set(s.id, { node, hit,
        items: node.querySelector('.slot__items'),
        wire: node.querySelector('.slot__wire'),
        tag: node.querySelector('.slot__tag') });
    }
    root.append(wrap);
  }

  // ---- 부품함 (회차형에는 없다 — 자료가 스스로 들어온다) ----
  const partNodes = new Map();
  if (!useRounds) {
    root.append(el('div', 'slot__cap', esc(d.trayLabel || '넣을 수 있는 것 — 눌러서 넣는다')));
    const tray = el('div', 'parts');
    root.append(tray);
    for (const p of d.parts) {
      const b = el('button', 'part' + (p.danger ? ' part--danger' : ''));
      b.type = 'button';
      b.dataset.cost = p.cost ? `${p.cost}칸` : '';
      b.innerHTML = `<span>${esc(p.label)}</span>` +
                    (p.cost ? `<span class="part__cost">${p.cost}칸</span>` : '');
      if (p.note) b.title = p.note;
      bin.on(b, 'click', () => tapPart(p, b));
      tray.append(b);
      partNodes.set(p.id, b);
    }
    enter([...partNodes.values()], { each: 25 });
  }

  const notice = el('div');
  const feedback = el('div');
  root.append(notice, feedback);

  const bar = actions(useRounds
    ? [{ id: 'off',  label: d.dropLabel || '내리기' },
       { id: 'fold', label: (d.fold && d.fold.label) || '요약하기' },
       { id: 'next', label: d.nextLabel || '다음', primary: true }]
    : [{ id: 'reset', label: '비우기' },
       { id: 'run', label: d.runLabel || '실행', primary: true }]);
  root.append(bar.node);

  if (useRounds) {
    bin.on(bar.btn.off, 'click', dropPicked);
    bin.on(bar.btn.fold, 'click', foldPicked);
    bin.on(bar.btn.next, 'click', () => {
      if (roundAt >= d.rounds.length - 1) run(); else nextRound();
    });
    nextRound();
  } else {
    bin.on(bar.btn.reset, 'click', resetAll);
    bin.on(bar.btn.run, 'click', run);
    paint();
  }

  // ------------------------------------------------------------

  function tapPart(p, node) {
    if (useSlots) {
      if (armed && armed.id === p.id) { disarm(); return; }
      armed = p;
      for (const n of partNodes.values()) n.classList.remove('part--in');
      node.classList.add('part--in');
      // 이 부품을 받을 수 있는 슬롯만 "여기 놓기"를 보여 준다
      let any = false;
      for (const s of d.slots) {
        const ok = accepts(s, p) && (placed.get(s.id).length < (s.capacity ?? 99));
        slotNodes.get(s.id).hit.hidden = !ok;
        slotNodes.get(s.id).node.classList.toggle('slot--filled', placed.get(s.id).length > 0);
        any = any || ok;
      }
      say(any ? `${eulReul(p.label)} 집었다. 놓을 곳을 고르세요.`
              : `${eulReul(p.label)} 받을 수 있는 칸이 없다.`);
      if (!any) shake(node);
      return;
    }

    // 예산형 — 넣기 / 빼기
    const at = pool.findIndex(x => x.id === p.id);
    if (at >= 0) { pool.splice(at, 1); node.classList.remove('part--in'); }
    else { pool.push(p); node.classList.add('part--in'); press(node); }
    paint();
  }

  function placeInto(s) {
    if (!armed) return;
    placed.get(s.id).push(armed);
    const me = armed;
    const clickable = el('button', 'part part--in');
    clickable.type = 'button';
    clickable.innerHTML = `<span>${esc(me.label)}</span><span class="part__cost">빼기</span>`;
    bin.on(clickable, 'click', () => {
      const arr = placed.get(s.id);
      const idx = arr.indexOf(me);
      if (idx >= 0) arr.splice(idx, 1);
      clickable.remove();
      partNodes.get(me.id).classList.remove('part--in');
      paint();
    });
    slotNodes.get(s.id).items.append(clickable);
    // 부품함에서 슬롯으로 날아가는 것처럼 보이게 한다 — 어디서 어디로 갔는지가 남는다
    flyTo(partNodes.get(me.id), clickable);
    disarm();
    paint();
  }

  function disarm() {
    armed = null;
    for (const n of partNodes.values()) n.classList.remove('part--in');
    for (const [id] of slotNodes) slotNodes.get(id).hit.hidden = true;
    // 이미 놓인 것은 다시 표시
    for (const s of d.slots || []) {
      for (const p of placed.get(s.id)) partNodes.get(p.id)?.classList.add('part--in');
      slotNodes.get(s.id).node.classList.toggle('slot--filled', placed.get(s.id).length > 0);
    }
  }

  function accepts(slot, part) {
    if (!slot.accepts || !slot.accepts.length) return true;
    return (part.tags || []).some(t => slot.accepts.includes(t));
  }

  function setTicket(cap, text) {
    if (!ticket) return;
    ticket.innerHTML = `<div class="ticket__no">${esc(cap || '')}</div>` +
                       `<div class="ticket__body">${esc(text || '')}</div>`;
  }

  // ------------------------------------------------------------ 회차형
  // 자료는 회차가 바뀔 때 스스로 들어온다. 사람이 할 수 있는 것은 셋뿐이고
  // 셋 다 대가가 있다 — 내린다(알고 잃음) · 접는다(모르고 잃음) · 둔다(흐려짐).

  function nextRound() {
    roundAt++;
    const rd = d.rounds[roundAt] || {};
    const list = (rd.arrive || [])
      .map(id => d.parts.find(p => p.id === id)).filter(Boolean);
    desk = arrive(desk, list, roundAt + 1);
    picked.clear();
    if (rd.ask) setTicket(rd.askCap || rd.cap, rd.ask);
    paintRounds();
    if (list.length) say(`자료 ${list.length}건이 들어왔다.`);
  }

  function toggle(id) {
    if (picked.has(id)) picked.delete(id); else picked.add(id);
    paintRounds();
  }

  function dropPicked() {
    fell = [...picked];   // 내가 내린 것만 떨어지는 것이 보인다
    for (const id of fell) desk = takeOff(desk, id, roundAt + 1);
    picked.clear();
    paintRounds();
  }

  function foldPicked() {
    const name = `${(d.fold && d.fold.made) || '요약본'} ${desk.folds + 1}`;
    desk = fold(desk, [...picked], roundAt + 1, name);
    picked.clear();
    paintRounds();
  }

  function paintRounds() {
    const rd = d.rounds[roundAt] || {};
    const last = roundAt >= d.rounds.length - 1;
    roundCap.innerHTML = `<b class="rd__no">${esc(rd.cap || '')}</b>` +
      (rd.note ? `<span class="rd__note">${esc(rd.note)}</span>` : '');

    const keep = live(desk);
    const u = deskUsed(desk);
    drawDesk(keep, desk.cap, u, {
      pick: toggle, on: picked, lock: locked, loud: new Set(fell),
      tag: (d.fold && d.fold.pickTag) || '고름'
    });
    budgetNum.textContent = `${u} / ${desk.cap}칸`;

    dimStrip.innerHTML = '';
    for (const it of dimmed(desk)) {
      dimStrip.append(el('div', 'part part--evicted', `<span>${esc(it.label)}</span>`));
    }

    // 실행 뒤에는 다시 안 열린다 — 안 그러면 결과가 흐르는 중에 또 돌릴 수 있다
    bar.btn.off.disabled = locked || picked.size === 0;
    bar.btn.fold.disabled = locked || picked.size !== FOLD_N;
    bar.btn.next.textContent = last ? (d.runLabel || '실행') : (d.nextLabel || '다음');
  }

  /**
   * 책상을 그린다 — 올린 것이 자기 비용만큼 칸을 차지한다. 빈 칸까지 다 그려야
   * "남은 칸이 얼마"가 보이고, 그래야 큰 것을 올리기 전에 망설인다.
   * opts.pick 이 있으면 책상 위의 것을 **누를 수 있다**(회차형). opts.loud 를 주면
   * 거기 든 것만 떨어지는 연출이 붙는다 — 흐려지는 것은 사건이 아니라 침묵이라서,
   * 사람이 직접 내린 것 말고는 소리 없이 빠져야 한다.
   */
  function drawDesk(keep, cap, used, opts = {}) {
    if (!deskGrid) return;
    const before = new Map(
      [...deskGrid.querySelectorAll('.desk__item')].map(n => [n.dataset.id, n]));
    const staying = new Set(keep.map(p => p.id));

    // 지우기 전에 먼저 떨어뜨린다. 좌표는 아직 책상에 있을 때만 잴 수 있다.
    for (const [id, node] of before) {
      if (staying.has(id)) continue;
      if (opts.loud && !opts.loud.has(id)) continue;
      dropOut(node, node.querySelector('.desk__name')?.textContent);
    }

    deskGrid.innerHTML = '';
    for (const p of keep) {
      const on = opts.on ? opts.on.has(p.id) : false;
      const item = el(opts.pick ? 'button' : 'div',
        'desk__item' + (on ? ' desk__item--on' : ''));
      if (opts.pick) {
        item.type = 'button';
        item.disabled = !!opts.lock;
        item.style.minHeight = 'var(--tap-min)';   // 조작 대상은 44px 이상
        item.setAttribute('aria-pressed', on ? 'true' : 'false');
        bin.on(item, 'click', () => opts.pick(p.id));
      }
      item.dataset.id = p.id;
      item.style.setProperty('--span', String(Math.min(p.cost ?? 1, cap)));
      item.innerHTML = `<span class="desk__name">${esc(p.label)}</span>` +
        `<span class="desk__cost">${on ? esc(opts.tag || '고름') : (p.cost ?? 1) + '칸'}</span>`;
      deskGrid.append(item);
      // 방금 올라온 것만 등장 연출을 준다 — 매번 전부 다시 튀면 산만하다
      if (!before.has(p.id)) wipeIn(item);
    }
    for (let i = used; i < cap; i++) {
      const gap = el('div', 'desk__free');
      gap.setAttribute('aria-hidden', 'true');
      deskGrid.append(gap);
    }
    deskGrid.setAttribute('aria-label',
      `${d.budgetLabel || '가방'} ${used} / ${cap}칸 사용. ` +
      (keep.length ? `올린 것: ${keep.map(p => p.label).join(', ')}` : '아직 없다'));
  }

  /** 실행 버튼이 방금 살아났으면 한 번 알려 준다 */
  function armRun(enabled) {
    const was = bar.btn.run.disabled;
    bar.btn.run.disabled = !enabled;
    if (was && enabled) pulse(bar.btn.run, 1);
  }

  /**
   * 통로를 굵기로 그린다 — 슬롯 하나에 여러 개가 놓이면 **가장 넓게 연 것**을 따른다.
   * 좁은 것을 같이 꽂았다고 넓게 연 사실이 상쇄되지 않는다.
   */
  function drawWires() {
    for (const s of d.slots) {
      const info = slotNodes.get(s.id);
      if (!info || !info.wire) continue;
      const widest = placed.get(s.id)
        .reduce((a, b) => ((b.reach ?? 1) > (a ? a.reach ?? 1 : 0) ? b : a), null);
      const reach = widest ? (widest.reach ?? 1) : 0;

      info.wire.style.setProperty('--reach', String(reach || 1));
      info.wire.className = 'slot__wire' +
        (reach ? ' slot__wire--on' : '') +
        (widest && widest.oneway ? ' slot__wire--oneway' : '');
      // 굵기만으로는 "되돌릴 수 없다"가 안 읽힌다. 그건 굵기가 아니라 종류의 문제다.
      info.tag.textContent = widest && widest.oneway ? '되돌릴 수 없다' : '';
    }
  }

  function paint() {
    if (useRounds) { paintRounds(); return; }
    if (useSlots) {
      if (wired) drawWires();
      armRun([...placed.values()].some(v => v.length));
      return;
    }

    const cap = d.budget ?? 6;
    evicted.length = 0;
    let used = 0; const keep = [];
    // 뒤에서부터 채운다: 나중에 넣은 것이 남고 먼저 넣은 것이 밀려난다
    for (let i = pool.length - 1; i >= 0; i--) {
      const c = pool[i].cost ?? 1;
      if (used + c <= cap) { used += c; keep.unshift(pool[i]); }
      else evicted.unshift(pool[i]);
    }

    drawDesk(keep, cap, used);
    budgetNum.textContent = `${used} / ${cap}칸`;
    budgetBox.classList.toggle('budget--over', evicted.length > 0);

    for (const [id, node] of partNodes) {
      node.classList.toggle('part--evicted', evicted.some(p => p.id === id));
    }

    // 조사는 마지막 이름에 맞춰 붙인다("30건가 밀려났다" 방지). 남은 칸도 같이
    // 알려 준다 — 1칸 남았는데 2칸짜리가 밀려나면 "자리 있는데 왜?"로 읽힌다.
    const names = evicted.map(p => p.label);
    const free = cap - used;
    notice.innerHTML = evicted.length
      ? `<p class="evicted-note">먼저 넣은 ` +
        `<b>${names.map(esc).join(', ')}</b>${hasBatchim(names[names.length - 1]) ? '이' : '가'} ` +
        `책상에서 밀려났다. ` +
        (free ? `남은 칸은 ${free}칸 — ` : '') +
        `AI는 밀려난 것을 못 본다.</p>`
      : '';

    // 흐리게 만드는 것은 CSS(.part--evicted) 가 한다. 여기서 animate(opacity) 를
    // 걸면 인라인 opacity 가 남아 CSS 를 덮어써서 **밀려난 것이 멀쩡해 보인다.**
    // 상태를 나타내는 값은 애니메이션하지 않는다(통로 굵기와 같은 이유).
    armRun(pool.length > 0);
  }

  function resetAll() {
    pool.length = 0; evicted.length = 0;
    for (const [id] of placed) placed.set(id, []);
    for (const n of partNodes.values()) n.classList.remove('part--in', 'part--evicted');
    for (const [, s] of slotNodes) { s.items.innerHTML = ''; s.node.classList.remove('slot--filled'); }
    disarm();
    feedback.innerHTML = '';
    paint();
  }

  /** 실행 결과를 부품에 한 마디로 붙인다. 엔진은 그 말의 뜻을 모른다 */
  function markParts(marks) {
    for (const [id, tag] of Object.entries(marks || {})) {
      const n = partNodes.get(id);
      if (!n) continue;
      let s = n.querySelector('.part__cost');
      if (!s) { s = el('span', 'part__cost'); n.append(s); }
      s.textContent = tag;
    }
  }

  async function run() {
    locked = true; for (const b of Object.values(bar.btn)) b.disabled = true;
    for (const n of partNodes.values()) n.disabled = true;

    let setup;
    if (useRounds) {
      setup = { desk, kept: live(desk), evicted: dimmed(desk), slots: {}, runNo,
        all: desk.items.slice(), used: deskUsed(desk), cap: desk.cap };
    } else {
      const cap = d.budget ?? 0;
      let used = 0; const kept = [];
      for (let i = pool.length - 1; i >= 0; i--) {
        const c = pool[i].cost ?? 1;
        if (used + c <= cap) { used += c; kept.unshift(pool[i]); }
      }
      setup = {
        kept: useSlots ? [] : kept,
        evicted: useSlots ? [] : evicted.slice(),
        slots: useSlots ? Object.fromEntries([...placed].map(([k, v]) => [k, v.slice()])) : {},
        all: useSlots ? [...placed.values()].flat() : pool.slice(),
        used, cap, runNo
      };
    }

    const r = runner(d.runCaption || 'AI가 일하는 중');
    feedback.append(r.node);
    r.node.scrollIntoView({ block: 'nearest' });

    const sim = game.simulate(setup, d);
    await r.play(sim.steps);
    markParts(sim.marks);
    say('실행이 끝났습니다.');

    // 수리형 — 한 번 돌려 보고 고쳐서 다시 돌린다. 첫 판에 못 맞히는 게 정상이다.
    if (d.repair && runNo < (d.repair.runs ?? 2)) { offerRepair(sim); return; }
    done(sim);
  }

  function offerRepair(sim) {
    const again = actions([
      { id: 'fix', label: d.repair.label || '고쳐서 다시 돌린다', primary: true },
      { id: 'send', label: d.repair.keep || '이대로 제출한다' }
    ]);
    feedback.append(again.node);
    bin.on(again.btn.send, 'click', () => done(sim));
    bin.on(again.btn.fix, 'click', () => {
      runNo++;
      feedback.innerHTML = '';
      for (const n of partNodes.values()) {
        n.disabled = false;
        const s = n.querySelector('.part__cost');
        if (s) s.textContent = n.dataset.cost || '';
      }
      if (bar.btn.reset) bar.btn.reset.disabled = false;
      paint();
      say('규칙을 고칠 수 있다.');
    });
    again.node.scrollIntoView({ block: 'nearest' });
  }

  function done(sim) {
    ctx.finish({
      grade: sim.grade, score: sim.score, mistakes: [],
      elapsed: Math.round((Date.now() - startedAt) / 1000),
      faults: sim.faults || [], gains: sim.gains || [],
      unlocked: sim.grade === 'fail' ? [] : (game.concept || [])
    });
  }
}
