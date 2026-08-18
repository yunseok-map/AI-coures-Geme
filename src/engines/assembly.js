// 엔진 L — 조립 라인. 엔진을 차체에 끼워 완성품을 출고한다.
//
// 왜 이 엔진이 필요한가:
//   "모델이냐 제품이냐"를 통 두 개짜리 분류 게임으로 가르치고 있었다. 그건
//   이름을 보고 통을 고르는 일이라, 정작 배워야 할 **관계**가 안 나온다 —
//   같은 엔진이 여러 제품에 들어가고, 한 제품의 엔진을 갈아 끼울 수 있다는 것.
//
//   조립대에서는 그 관계가 조작 자체다. 엔진 하나를 집어 여러 차체에 차례로 끼워
//   보면 1:N 이 손에 남는다. 그리고 **엔진만 올려서 출고할 수도 있다** —
//   그때 나오는 "켤 수 있는 물건이 아니다"가 이 판의 임팩트 모먼트다.
//
// 조립대는 자리 두 개뿐이다. 선반의 부품을 누르면 자기 자리로 날아가고,
// 자리를 누르면 내려온다. 출고는 자리가 비어 있어도 눌린다 — 막으면 못 겪는다.
//
// 판정은 game.simulate({ builds }) 가 한다. 엔진은 무엇을 끼웠는지만 모아 넘긴다.

import { el, esc, say, Bin, header, actions, runner, hud, todo } from './base.js';
import { enter, flyTo, shake, pulse, cardIn, wait } from '../core/motion.js';
import { eulReul } from '../core/ko.js';

let bin = new Bin();
export function unmount() { bin.clear(); }

export function mount(root, game, ctx) {
  unmount();
  bin = new Bin();

  const d = game.data;
  const orders = d.orders || [];
  const shipLabel = d.shipLabel || '출고';
  const startedAt = Date.now();

  /** [{ orderId, engine, chassis }] — 출고 기록. 마지막에 관계도가 된다 */
  const builds = [];
  const held = { engine: null, chassis: null };
  let at = 0;

  root.innerHTML = '';
  root.append(header(game));

  const gauge = hud(orders.length);
  root.append(gauge.node);

  const orderBox = el('div');
  // 지금 눌러야 할 것 하나. 자리는 **주문서 바로 다음**이다 —
  // "이런 주문이 들어왔다 → 그래서 이걸 눌러라" 순서로 읽혀야 한다.
  const step = todo();
  root.append(orderBox, step.node);

  // ---- 조립대 ----
  const bench = el('div', 'asm__bench');
  bench.innerHTML =
    `<div class="asm__well" data-kind="engine">` +
      `<div class="asm__well__cap">${esc(d.engineSlotLabel || '엔진 자리')}</div>` +
      `<div class="asm__well__body"></div></div>` +
    `<div class="asm__join" aria-hidden="true">+</div>` +
    `<div class="asm__well" data-kind="chassis">` +
      `<div class="asm__well__cap">${esc(d.chassisSlotLabel || '차체 자리')}</div>` +
      `<div class="asm__well__body"></div></div>`;
  root.append(bench);

  const wells = {};
  for (const w of bench.querySelectorAll('.asm__well')) {
    const kind = w.dataset.kind;
    wells[kind] = { node: w, body: w.querySelector('.asm__well__body') };
    bin.on(w, 'click', () => { if (held[kind]) { held[kind] = null; paint(); } });
  }

  // ---- 선반 두 줄 ----
  const shelves = el('div', 'asm__shelves');
  root.append(shelves);

  const partNodes = new Map();
  shelf('engine', d.engineShelfLabel || '엔진 — 사람이 직접 켜지 않는다', d.engines || []);
  shelf('chassis', d.chassisShelfLabel || '차체 — 사람이 켜서 쓴다', d.chassis || []);

  function shelf(kind, cap, list) {
    const row = el('div', 'asm__shelf');
    row.append(el('div', 'asm__shelf__cap', esc(cap)));
    const rail = el('div', 'asm__rail');
    for (const p of list) {
      const b = el('button', `asm__part asm__part--${kind}`);
      b.type = 'button';
      b.dataset.id = p.id;
      b.innerHTML = `<span class="asm__part__label">${esc(p.label)}</span>` +
                    (p.note ? `<span class="asm__part__note">${esc(p.note)}</span>` : '');
      bin.on(b, 'click', () => take(kind, p, b));
      rail.append(b);
      partNodes.set(p.id, b);
    }
    row.append(rail);
    shelves.append(row);
  }

  const outBox = el('div');
  root.append(outBox);

  const bar = actions([
    { id: 'clear', label: '내리기' },
    { id: 'ship', label: shipLabel, primary: true }
  ]);
  root.append(bar.node);
  bin.on(bar.btn.clear, 'click', () => { held.engine = null; held.chassis = null; paint(); });
  // 같은 버튼이 두 가지 일을 한다(출고 → 다음 주문). 핸들러를 갈아 끼우지 않고
  // 상태로 가른다 — 갈아 끼우면 뗀 줄 알았던 것이 남아 두 번 실행된다.
  let phase = 'build';
  bin.on(bar.btn.ship, 'click', () => { if (phase === 'build') ship(); else next(); });

  draw();

  // ------------------------------------------------------------

  function partOf(kind, id) {
    return (kind === 'engine' ? d.engines : d.chassis).find(p => p.id === id) || null;
  }

  function take(kind, p, node) {
    if (held[kind] === p.id) { held[kind] = null; paint(); return; }
    held[kind] = p.id;
    paint();
    // 선반에서 조립대로 날아간다 — 어디서 어디로 갔는지가 남는다
    const landed = wells[kind].body.firstElementChild;
    if (landed) flyTo(node, landed);
    say(`${eulReul(p.label)} 올렸다.`);
  }

  function draw() {
    outBox.innerHTML = '';
    held.engine = null;
    held.chassis = null;

    if (at >= orders.length) { done(); return; }
    const o = orders[at];

    orderBox.innerHTML = '';
    const card = el('article', 'asm__order');
    card.innerHTML =
      `<div class="asm__order__cap">${esc(o.cap || '출고 주문')}</div>` +
      `<div class="asm__order__body">${esc(o.text)}</div>`;
    orderBox.append(card);
    cardIn(card);

    for (const n of partNodes.values()) n.disabled = false;
    bar.btn.ship.disabled = false;
    bar.btn.clear.disabled = false;
    bar.btn.ship.textContent = shipLabel;
    enter([...partNodes.values()], { each: 20 });
    paint();
    say(o.text);
  }

  function paint() {
    for (const kind of ['engine', 'chassis']) {
      const body = wells[kind].body;
      body.innerHTML = '';
      const p = held[kind] ? partOf(kind, held[kind]) : null;
      wells[kind].node.classList.toggle('asm__well--set', !!p);
      if (p) {
        const chip = el('div', `asm__part asm__part--${kind} asm__part--set`);
        chip.innerHTML = `<span class="asm__part__label">${esc(p.label)}</span>`;
        body.append(chip);
      } else {
        body.append(el('div', 'asm__well__empty', esc(kind === 'engine' ? '비어 있다' : '비어 있다')));
      }
    }
    for (const [id, node] of partNodes) {
      node.classList.toggle('asm__part--held', held.engine === id || held.chassis === id);
    }

    // 지금 눌러야 할 것 하나. **엔진만 올린 채로도 출고할 수 있다고 둔다** —
    // 자리 하나가 비었다고 막거나 나무라면 이 판의 임팩트 모먼트를 못 겪는다.
    if (phase !== 'build') return;   // 출고 뒤의 안내는 ship() 이 세워 둔 것을 그대로 둔다
    const on = !!(held.engine || held.chassis);
    step.set(on ? `${eulReul(`[${shipLabel}]`)} 누른다` : '엔진과 차체를 하나씩 고른다',
      { done: on });
  }

  async function ship() {
    const o = orders[at];
    bar.btn.ship.disabled = true;
    bar.btn.clear.disabled = true;
    for (const n of partNodes.values()) n.disabled = true;
    step.set('');   // 켜 보는 동안에는 시킬 것이 없다. 남아 있으면 방해만 된다

    const build = { orderId: o.id, engine: held.engine, chassis: held.chassis };
    builds.push(build);

    const eng = held.engine ? partOf('engine', held.engine) : null;
    const ch = held.chassis ? partOf('chassis', held.chassis) : null;

    // 완성품이 라인에서 나온다. 무엇이 나왔는지를 **물건으로** 보여 준다 —
    // 로그만 흐르면 "엔진만 출고했다"가 글자로만 남는다.
    const unit = el('article', 'asm__unit' + (ch ? '' : ' asm__unit--husk'));
    unit.innerHTML =
      `<div class="asm__unit__cap">${esc(d.shippedLabel || '출고된 것')}</div>` +
      `<div class="asm__unit__name">${esc(ch ? ch.label : (eng ? eng.label : '빈 상자'))}</div>` +
      // 차체가 없으면 "도는 곳" 칸 자체가 없다. 그게 이 판의 요점이라 빈칸으로 두지 않고
      // 왜 없는지를 적는다. 엔진 이름을 두 줄에 반복하지도 않는다.
      (ch
        ? `<div class="asm__unit__row"><b>도는 곳</b> ${esc((ch.surfaces || []).join(' · '))}</div>` +
          `<div class="asm__unit__row"><b>안에 든 엔진</b> ${esc(eng ? eng.label : '없음')}</div>`
        : `<div class="asm__unit__row"><b>도는 곳</b> 없음 — 감싸는 차체가 없다</div>`);
    outBox.append(unit);
    cardIn(unit);
    if (!ch || !eng) shake(unit);
    await wait(360);

    const r = runner(d.runCaption || '출고한 것을 켜 본다');
    outBox.append(r.node);
    r.node.scrollIntoView({ block: 'nearest' });

    const sim = game.judge(build, o, d);
    await r.play(sim.steps);
    gauge.mark(sim.ok);

    at++;
    phase = 'shipped';
    bar.btn.ship.disabled = false;
    bar.btn.ship.textContent = at >= orders.length ? '오늘 출고 정리' : '다음 주문';
    step.set(`${eulReul(`[${bar.btn.ship.textContent}]`)} 누른다`, { done: true });
    pulse(bar.btn.ship, 1);
    // 완성품과 로그가 아래로 쌓이면 버튼이 화면 밖으로 밀린다.
    // 로그로 스크롤하는 것만으로는 부족했다 — 다음으로 갈 곳이 안 보였다.
    bar.node.scrollIntoView({ block: 'nearest' });
  }

  function next() {
    phase = 'build';
    draw();
  }

  /**
   * 오늘 만든 것을 한 장으로 펼친다 — 이 판의 임팩트 모먼트.
   *
   * 같은 엔진이 서로 다른 완성품 여럿에 들어가 있는 것을 **선으로** 본다.
   * "모델과 제품은 1:N 이다"를 문장으로 적는 대신 자기가 만든 목록에서 보게 한다.
   */
  function ledger() {
    const wrap = el('section', 'asm__ledger');
    wrap.append(el('div', 'asm__ledger__cap', esc(d.ledgerLabel || '오늘 출고한 것')));
    const used = new Map();
    for (const b of builds) {
      if (!b.engine) continue;
      if (!used.has(b.engine)) used.set(b.engine, []);
      const ch = b.chassis ? partOf('chassis', b.chassis) : null;
      used.get(b.engine).push(ch ? ch.label : '차체 없음');
    }
    for (const [engId, list] of used) {
      const row = el('div', 'asm__ledger__row');
      row.innerHTML =
        `<span class="asm__ledger__eng">${esc(partOf('engine', engId).label)}</span>` +
        `<span class="asm__ledger__fan" aria-hidden="true"></span>` +
        `<span class="asm__ledger__outs">${list.map(x => `<i>${esc(x)}</i>`).join('')}</span>`;
      wrap.append(row);
    }
    return wrap;
  }

  function done() {
    orderBox.innerHTML = '';
    step.set('');   // 조립대가 사라진다. 시킬 것이 없다
    bench.hidden = true;
    shelves.hidden = true;
    bar.node.hidden = true;
    outBox.innerHTML = '';
    outBox.append(ledger());

    const sim = game.simulate({ builds }, d);
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
