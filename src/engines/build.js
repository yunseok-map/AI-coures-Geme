// 엔진 C — 조립형. 부품을 골라 넣고 [실행]을 눌러 결과를 본다.
//
// 이 엔진이 이 게임의 심장이다. 설명을 읽는 대신 **직접 세팅하고, 돌려보고,
// 자기 세팅 때문에 결과가 달라지는 걸 눈으로 본다.**
//
// 두 가지 배치 방식:
//   예산형 (data.budget)  칸이 정해진 하나의 통. 넘치면 먼저 넣은 것이 밀려난다 → 컨텍스트 로트
//   슬롯형 (data.slots)   역할이 정해진 여러 칸. 부품을 집어 슬롯에 놓는다
//
// 판정은 game.simulate(setup) 가 한다. 엔진은 세팅만 모아서 넘긴다.

import { el, esc, say, Bin, header, actions, runner } from './base.js';
import { press, shake, enter, animate, isReduced, flyTo, pulse, wipeIn, dropOut }
  from '../core/motion.js';
import { hasBatchim, eulReul } from '../core/ko.js';

let bin = new Bin();
export function unmount() { bin.clear(); }

export function mount(root, game, ctx) {
  bin.clear();
  bin = new Bin();

  const d = game.data;
  const useSlots = Array.isArray(d.slots) && d.slots.length > 0;
  const startedAt = Date.now();

  /** 넣은 부품 (예산형) — 넣은 순서를 지킨다. 밀려나는 순서가 이 순서다 */
  const pool = [];
  /** 슬롯형 배치 */
  const placed = new Map((d.slots || []).map(s => [s.id, []]));
  const evicted = [];
  let armed = null;   // 집어 든 부품

  root.innerHTML = '';
  root.append(header(game));

  if (d.brief) {
    const t = el('article', 'ticket');
    t.innerHTML = `<div class="ticket__no">${esc(d.briefCap || '상황')}</div>` +
                  `<div class="ticket__body">${esc(d.brief)}</div>`;
    root.append(t);
  }

  // ---- 예산 표시 (예산형) ----
  //
  // 예전에는 막대 하나 + "3 / 6칸" 숫자였다. 그러면 밀려나는 것이 **부품함에서**
  // 흐려지기만 해서, 정작 "책상이 꽉 차서 뭔가 떨어졌다"가 안 보였다.
  // 지금은 칸을 실제 그릇으로 그린다 — 올린 것이 자기 비용만큼 칸을 차지하고,
  // 넘치면 그 자리에서 떨어져 나간다. 이 판이 가르치는 세 용어가 여기 다 들어 있다:
  //   토큰(비용) · 컨텍스트 윈도우(칸 수) · 컨텍스트 로트(밀려남)
  let budgetNum = null, budgetBox = null, deskGrid = null;
  if (!useSlots) {
    budgetBox = el('div', 'budget');
    budgetNum = el('span', 'budget__num');
    budgetBox.append(
      el('span', 'budget__cap', esc(d.budgetLabel || '가방')),
      budgetNum
    );
    deskGrid = el('div', 'desk');
    deskGrid.style.setProperty('--cells', String(d.budget ?? 6));
    root.append(budgetBox, deskGrid);
  }

  // ---- 슬롯 (슬롯형) ----
  //
  // 부품에 reach(열어 준 폭)가 있으면 슬롯마다 **통로**를 굵기로 그린다.
  // 엔진은 그 숫자의 뜻을 모른다 — 굵게 그리기만 한다. 뜻은 games/ 가 정한다.
  // 말로 "최소 권한"이라고 적는 대신 굵은 통로가 화면을 먹는 걸 보게 하는 장치다.
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
      const hit = el('button');
      hit.type = 'button';
      hit.className = 'btn-quiet';
      hit.textContent = '여기 놓기';
      hit.style.marginTop = 'var(--sp-2)';
      hit.hidden = true;
      node.append(hit);
      bin.on(hit, 'click', () => placeInto(s));
      wrap.append(node);
      slotNodes.set(s.id, {
        node,
        items: node.querySelector('.slot__items'),
        wire: node.querySelector('.slot__wire'),
        tag: node.querySelector('.slot__tag'),
        hit
      });
    }
    root.append(wrap);
  }

  // ---- 부품함 ----
  root.append(el('div', 'slot__cap', esc(d.trayLabel || '넣을 수 있는 것 — 눌러서 넣는다')));
  const tray = el('div', 'parts');
  root.append(tray);

  const partNodes = new Map();
  for (const p of d.parts) {
    const b = el('button', 'part' + (p.danger ? ' part--danger' : ''));
    b.type = 'button';
    b.innerHTML = `<span>${esc(p.label)}</span>` +
                  (p.cost ? `<span class="part__cost">${p.cost}칸</span>` : '');
    if (p.note) b.title = p.note;
    bin.on(b, 'click', () => tapPart(p, b));
    tray.append(b);
    partNodes.set(p.id, b);
  }
  enter([...partNodes.values()], { each: 25 });

  const notice = el('div');
  root.append(notice);

  const feedback = el('div');
  root.append(feedback);

  const bar = actions([
    { id: 'reset', label: '비우기' },
    { id: 'run', label: d.runLabel || '실행', primary: true }
  ]);
  root.append(bar.node);
  bin.on(bar.btn.reset, 'click', resetAll);
  bin.on(bar.btn.run, 'click', run);

  paint();

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

  /**
   * 책상을 그린다 — 올린 것이 자기 비용만큼 칸을 차지한다.
   *
   * 빈 칸까지 다 그리는 게 요점이다. "남은 칸이 얼마"가 눈에 보여야
   * 4칸짜리를 올리기 전에 망설이게 된다. 숫자만 있으면 그 망설임이 없다.
   *
   * 남아 있는 것(keep)만 그린다 — 밀려난 것은 이미 책상 밖이다.
   */
  function drawDesk(keep, cap, used) {
    if (!deskGrid) return;
    const before = new Map(
      [...deskGrid.querySelectorAll('.desk__item')].map(n => [n.dataset.id, n]));
    const staying = new Set(keep.map(p => p.id));

    // 지우기 전에 먼저 떨어뜨린다. 좌표는 아직 책상에 있을 때만 잴 수 있다.
    for (const [id, node] of before) {
      if (!staying.has(id)) dropOut(node, node.querySelector('.desk__name')?.textContent);
    }

    deskGrid.innerHTML = '';
    for (const p of keep) {
      const item = el('div', 'desk__item');
      item.dataset.id = p.id;
      item.style.setProperty('--span', String(Math.min(p.cost ?? 1, cap)));
      item.innerHTML = `<span class="desk__name">${esc(p.label)}</span>` +
                       `<span class="desk__cost">${p.cost ?? 1}칸</span>`;
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
    if (useSlots) {
      if (wired) drawWires();
      armRun([...placed.values()].some(v => v.length));
      return;
    }

    const cap = d.budget ?? 6;
    evicted.length = 0;
    let used = 0;
    const keep = [];
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
      const isEvicted = evicted.some(p => p.id === id);
      node.classList.toggle('part--evicted', isEvicted);
    }

    // 조사는 마지막 이름에 맞춰 붙인다 — "30건가 밀려났다"가 되면 안 된다
    //
    // 남은 칸 수를 같이 알려 준다. 빈 칸이 1칸 남았는데 2칸짜리가 밀려나는 경우가
    // 있어서, 그냥 "칸이 모자라"라고만 하면 "자리 있는데 왜?"로 읽힌다.
    const names = evicted.map(p => p.label);
    const free = cap - used;
    notice.innerHTML = evicted.length
      ? `<p class="evicted-note">먼저 넣은 ` +
        `<b>${names.map(esc).join(', ')}</b>${hasBatchim(names[names.length - 1]) ? '이' : '가'} ` +
        `책상에서 밀려났다. ` +
        (free ? `남은 칸은 ${free}칸 — ` : '') +
        `AI는 밀려난 것을 못 본다.</p>`
      : '';

    if (evicted.length && !isReduced()) {
      for (const p of evicted) {
        const n = partNodes.get(p.id);
        if (n) animate(n, { opacity: [1, .35], duration: 220, ease: 'outQuad' });
      }
    }
    armRun(pool.length > 0);
  }

  function resetAll() {
    pool.length = 0;
    evicted.length = 0;
    for (const [id] of placed) placed.set(id, []);
    for (const n of partNodes.values()) n.classList.remove('part--in', 'part--evicted');
    for (const [, s] of slotNodes) { s.items.innerHTML = ''; s.node.classList.remove('slot--filled'); }
    disarm();
    feedback.innerHTML = '';
    paint();
  }

  async function run() {
    bar.btn.run.disabled = true;
    bar.btn.reset.disabled = true;
    for (const n of partNodes.values()) n.disabled = true;

    const cap = d.budget ?? 0;
    let used = 0; const kept = [];
    for (let i = pool.length - 1; i >= 0; i--) {
      const c = pool[i].cost ?? 1;
      if (used + c <= cap) { used += c; kept.unshift(pool[i]); }
    }

    const setup = {
      kept: useSlots ? [] : kept,
      evicted: useSlots ? [] : evicted.slice(),
      slots: useSlots ? Object.fromEntries([...placed].map(([k, v]) => [k, v.slice()])) : {},
      all: useSlots ? [...placed.values()].flat() : pool.slice(),
      used, cap
    };

    const r = runner(d.runCaption || 'AI가 일하는 중');
    feedback.append(r.node);
    r.node.scrollIntoView({ block: 'nearest' });

    const sim = game.simulate(setup, d);
    await r.play(sim.steps);
    say('실행이 끝났습니다.');

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
