// 엔진 F — 디펜스형. 위에서 내려오는 일감을 아래(우리 팀)에 닿기 전에 걸러 낸다.
//
// 이 엔진이 가르치는 구조:
//   장치는 **막는 종류가 정해져 있다.** 아무 장치나 아무 데나 놓으면 안 막힌다.
//   그리고 장치는 **지나가는 일감을 전부 붙잡아 검사한다** — 위험한 것만 붙잡지 않는다.
//   그래서 많이 깔수록 안전해지지만 그만큼 느려지고, 오늘 넘겨야 할 건수를 못 채운다.
//   안전과 속도를 맞바꾸는 것이 게임 규칙 그 자체라서, 설명을 읽지 않아도 손으로 배운다.
//
// 부드러운 압박(사용자 확정): 사고가 나도 게임오버가 없다. 업무 시간은 끝까지 흐르고
// 사고 건수와 처리 건수만 쌓인다. 못하는 사람이 막히지 않으면서 잘하는 사람은 만점을 노린다.
//
// 왜 배치를 시작 전에 확정하나:
//   화면에서 벌어지는 일과 판정이 어긋나면 그 판은 아무것도 못 가르친다.
//   그래서 시작할 때 판 파일의 `plan(placements, d)` 로 **하루 일정을 한 번에 계산하고**,
//   엔진은 그 일정을 그대로 그리기만 한다. 판정(`simulate`)도 같은 함수를 다시 부른다.
//   두 곳이 같은 계산을 쓰므로 어긋날 수 없다.
//
// 순수 계산이 왜 엔진이 아니라 판 파일에 있나:
//   이 파일은 화면 부품(모션·효과음)을 불러오기 때문에 Node 검사에서 열리지 않는다.
//   계산이 여기 있으면 "완벽한 답이 없다"를 검사로 증명할 수 없다. 그래서 계산만
//   판 파일로 내려놓고, 엔진은 그 결과의 모양만 안다 — 문항·정답·문구는 여전히 모른다.
//
// 엔진이 판 파일에 요구하는 계약:
//   data.slots · data.travelSec · data.limitSec · data.quota
//   data.gates[] { id, label, icon, stops[], holdSec, cost, blurb }
//   data.foes[]  { id, kind, danger, at, label, icon }
//   plan(placements, d) → { lanes[], gates[], held, cost, quota, limitSec, delivered, short, ... }
//     lanes[].path  = [{ t0, t1, y0, y1, hold }]  화면에서 그릴 움직임 구간
//     lanes[].stops = [{ slot, arrive, start, end }]  검사대가 붙잡고 있는 구간
//   simulate({ placements }, d)
//
// 화면 부품 중 `ax__` 로 시작하는 것은 액션 엔진 공용이다(arcade.css).

import { el, esc, strong, say, Bin, header, actions, runner, scarLine } from './base.js';
import { icon, roadArt } from '../core/art.js';
import { createLoop } from '../core/loop.js';
import { sfx } from '../core/sfx.js';
import { animate, isReduced, enter, cardIn, shake, pulse, burst }
  from '../core/motion.js';

let bin = new Bin();
let loop = null;
let counting = 0;
let host = null;

export function unmount() {
  bin.clear();
  if (loop) { loop.stop(); loop = null; }
  if (counting) { clearTimeout(counting); counting = 0; }
  // 무대를 원래대로 돌려놓는다 — 다음 화면이 스크롤 못 하면 안 된다
  if (host) { host.classList.remove('stage--arcade'); host = null; }
}

export function mount(root, game, ctx) {
  unmount();
  bin = new Bin();
  // 이 화면은 스크롤하지 않는다. 판·트레이·실행 버튼이 한 화면에 다 들어와야
  // 게임이 성립한다 (트레이를 눌러 집고 판을 눌러 놓는 조작이다).
  host = root;
  root.classList.add('stage--arcade');

  const d = game.data;
  const startedAt = Date.now();
  const TRAVEL = d.travelSec || 6;    // 장치가 없을 때 맨 위에서 바닥까지 걸리는 시간
  const LIMIT = d.limitSec || 16;     // 오늘 업무 시간
  const QUOTA = d.quota || 0;         // 오늘 넘겨야 하는 정상 작업 건수

  // 슬롯 — 길을 가로지르는 검사대. 위에서부터 고르게 벌린다.
  const slots = Array.from({ length: d.slots }, (_, i) => ({
    i, at: (i + 1) / (d.slots + 1), gate: null, node: null, bar: null
  }));

  const stock = d.gates.map(g => ({ ...g, left: g.count ?? 1 }));
  const foeById = new Map(d.foes.map(f => [f.id, f]));
  let armed = null;

  let plan = null;      // 시작할 때 한 번 계산한 하루 일정
  let lanes = [];       // 그 일정에 화면 상태를 붙인 것
  let t = 0;
  let phase = 'setup';
  const tally = { done: 0, leak: 0 };

  // ---------------------------------------------------------------- 화면
  root.innerHTML = '';
  root.append(header(game));

  if (d.brief) {
    const ticket = el('article', 'ticket');
    ticket.innerHTML =
      `<div class="ticket__no">${esc(d.briefCap || '상황')}</div>` +
      `<div class="ticket__body">${strong(d.brief)}</div>`;
    root.append(ticket);
    cardIn(ticket);
  }

  const hud = el('div', 'ax__hud');
  const statA = el('span', 'ax__stat');
  const statB = el('span', 'ax__stat');
  const statC = el('span', 'ax__stat');
  const statD = el('span', 'ax__stat');
  const mute = soundBtn();
  hud.append(statA, statB, statC, statD, mute);
  root.append(hud);

  const field = el('section', 'ax__field');
  field.innerHTML = roadArt();
  const track = el('div', 'ax__track');
  const foot = el('div', 'ax__foot',
    `${icon('base')}<span>${esc(d.baseLabel || '우리 팀')}</span>`);
  const veil = el('div', 'ax__veil');
  veil.hidden = true;
  field.append(track, foot, veil);
  root.append(field);

  // 트레이와 실행 버튼은 화면 아래에 붙여 둔다.
  // 트레이를 눌러 집고 판을 눌러 놓는 게임이라, 트레이가 스크롤 밖으로 나가면
  // 조작 자체가 성립하지 않는다.
  const dock = el('div', 'ax__dock');
  const trayCap = el('p', 'ax__traycap',
    esc(d.trayLabel || '놓을 장치 — 종류마다 막는 것이 다르다'));
  const tray = el('div', 'ax__tray');
  const bar = actions([
    { id: 'go', label: d.runLabel || '시작', primary: true }
  ]);
  dock.append(trayCap, tray, bar.node);
  root.append(dock);
  bin.on(bar.btn.go, 'click', begin);

  const feedback = el('div');
  root.append(feedback);

  drawSlots();
  drawTray();
  drawHud();

  // ---------------------------------------------------------------- 배치 단계

  function drawSlots() {
    for (const s of slots) {
      const b = el('button', 'def__slot');
      b.type = 'button';
      b.style.top = (s.at * 100) + '%';
      s.node = b;
      bin.on(b, 'click', () => tapSlot(s));
      track.append(b);
      paintSlot(s);
    }
    enter(slots.map(s => s.node), { each: 60 });
  }

  function paintSlot(s) {
    const b = s.node;
    const open = !s.gate && armed && phase === 'setup';
    b.className = 'def__slot' +
      (s.gate ? ' def__slot--set' : '') +
      (open ? ' def__slot--open' : '');
    b.innerHTML = s.gate
      ? `${icon(s.gate.icon || 'guard')}` +
        `<span class="def__slot__n">${esc(s.gate.label)}</span>` +
        `<span class="def__slot__d">검사 ${sec(s.gate.holdSec)}초 · 비용 ${s.gate.cost}</span>` +
        `<i class="def__slot__bar"></i>`
      : `<span class="def__slot__n def__slot__n--empty">${open ? '여기 놓기' : '빈 자리'}</span>`;
    s.bar = b.querySelector('.def__slot__bar');
    b.disabled = phase !== 'setup';
    b.setAttribute('aria-label', s.gate
      ? `${s.i + 1}번 자리, ${s.gate.label} 놓임. 검사 ${sec(s.gate.holdSec)}초` +
        (phase === 'setup' ? '. 누르면 회수' : '')
      : `${s.i + 1}번 자리, 비어 있음${open ? `. 누르면 ${armed.label} 놓기` : ''}`);
  }

  function drawTray() {
    tray.innerHTML = '';
    for (const g of stock) {
      const b = el('button', 'ax__tool' +
        (armed === g ? ' ax__tool--armed' : '') +
        (g.left <= 0 ? ' ax__tool--out' : ''));
      b.type = 'button';
      b.disabled = g.left <= 0 || phase !== 'setup';
      b.innerHTML =
        `${icon(g.icon || 'guard')}` +
        `<span class="ax__tool__n">${esc(g.label)}</span>` +
        `<span class="ax__tool__c">+${sec(g.holdSec)}초</span>`;
      b.setAttribute('aria-label',
        `${g.label}. ${g.blurb || ''} 작업 하나를 ${sec(g.holdSec)}초 붙잡고, 비용은 ${g.cost}` +
        `${armed === g ? '. 지금 집은 상태' : ''}`);
      bin.on(b, 'click', () => {
        if (phase !== 'setup') return;
        armed = armed === g ? null : g;
        sfx.play('pick');
        drawTray(); slots.forEach(paintSlot);
        if (armed && g.blurb) say(`${g.label} — ${g.blurb}`);
      });
      tray.append(b);
    }
  }

  function tapSlot(s) {
    if (phase !== 'setup') return;
    if (s.gate) {                       // 회수
      const back = stock.find(g => g.id === s.gate.id);
      if (back) back.left++;
      s.gate = null;
      sfx.play('pick');
    } else if (armed && armed.left > 0) {
      s.gate = armed;
      armed.left--;
      sfx.play('place');
      if (armed.left <= 0) armed = null;
    } else {
      // 아무것도 안 집고 빈 자리를 누르면 무엇을 해야 하는지 알려 준다
      say('아래에서 장치를 먼저 고르세요.');
      pulse(tray, 1);
      return;
    }
    drawTray();
    slots.forEach(paintSlot);
    drawHud();
  }

  // ---------------------------------------------------------------- 계기판

  function drawHud() {
    if (phase === 'setup') {
      const set = slots.filter(s => s.gate).map(s => s.gate);
      const held = set.reduce((a, g) => a + g.holdSec, 0);
      const cost = set.reduce((a, g) => a + (g.cost || 0), 0);
      statA.innerHTML = `자리 <b>${set.length}</b>/${d.slots}`;
      statB.innerHTML = `작업당 지연 <b>${sec(held)}초</b>`;
      statC.innerHTML = `비용 <b>${cost}</b>`;
      statD.innerHTML = `오늘 기준 <b>${QUOTA}건</b> · ${LIMIT}초`;
      statD.hidden = false;
      statB.className = 'ax__stat';
      statC.className = 'ax__stat';
    } else {
      const left = Math.max(0, Math.ceil(LIMIT - t));
      statA.innerHTML = `남은 시간 <b>${left}초</b>`;
      statB.innerHTML = `넘긴 것 <b>${tally.done}</b>/${QUOTA}`;
      statC.innerHTML = `사고 <b>${tally.leak}</b>`;
      statB.className = 'ax__stat ax__stat--ok';
      statC.className = 'ax__stat ax__stat--bad';
      statD.hidden = true;
    }
  }

  function soundBtn() {
    const b = el('button', 'ax__mute');
    b.type = 'button';
    b.textContent = sfx.on ? '소리 끄기' : '소리 켜기';
    b.setAttribute('aria-label', sfx.on ? '효과음 끄기' : '효과음 켜기');
    bin.on(b, 'click', () => {
      sfx.toggle();
      b.textContent = sfx.on ? '소리 끄기' : '소리 켜기';
      b.setAttribute('aria-label', sfx.on ? '효과음 끄기' : '효과음 켜기');
    });
    return b;
  }

  // ---------------------------------------------------------------- 하루 돌리기

  async function begin() {
    if (phase !== 'setup') return;

    const placements = slots.filter(s => s.gate).map(s => ({ slot: s.i, gateId: s.gate.id }));
    plan = game.plan(placements, d);
    lanes = plan.lanes.map(l => ({ ...l, node: null, live: false, gone: false }));

    phase = 'count';
    bar.btn.go.disabled = true;
    armed = null;
    drawTray();
    slots.forEach(paintSlot);

    await countdown();
    if (phase !== 'count') return;      // 도중에 화면을 떠났다

    phase = 'run';
    drawHud();
    say('돌리는 동안에는 장치를 바꿀 수 없습니다.');

    loop = createLoop(tick, {
      onPause: () => showVeil(
        '잠깐 멈췄습니다',
        '다른 창이나 탭으로 가면 브라우저가 화면을 멈춥니다. 고장이 아닙니다. ' +
        '멈춘 사이에는 아무 일도 진행되지 않았습니다.',
        '이어서 하기', () => { hideVeil(); loop && loop.resume(); }),
      onResume: hideVeil
    });
    loop.start();
  }

  function countdown() {
    if (isReduced()) return Promise.resolve();
    return new Promise(done => {
      let n = 3;
      const beat = () => {
        if (phase !== 'count') { done(); return; }
        if (n === 0) { hideVeil(); done(); return; }
        showVeil(String(n), '', '', null);
        sfx.play('count');
        n--;
        counting = setTimeout(beat, 520);
      };
      beat();
    });
  }

  function tick(dt) {
    t = Math.min(LIMIT, t + dt);

    for (const lane of lanes) {
      if (lane.gone || t < lane.spawn) continue;

      if (!lane.live) {
        lane.live = true;
        lane.node = foeNode(lane);
        track.append(lane.node);
      }

      // 붙잡힌 채로 업무 시간이 끝나는 것(late · stuck)은 결말이 없다 — 라인에 남는다
      if (t >= lane.endAt && lane.result !== 'late' && lane.result !== 'stuck') {
        resolve(lane);
        continue;
      }

      const y = posAt(lane, t);
      lane.node.style.top = (y * 100) + '%';
      lane.node.classList.toggle('def__card--held', heldNow(lane, t));
    }

    paintBars();
    drawHud();

    if (t >= LIMIT || lanes.every(l => l.gone)) endWave();
  }

  /**
   * 지금 이 일감이 어디쯤 있나. 0 = 판 맨 위, 1 = 우리 팀 앞.
   * 구간은 plan 이 다 정해 놓았다 — 여기서는 이어 붙이기만 한다.
   */
  function segAt(lane, now) {
    const path = lane.path || [];
    for (const g of path) if (now < g.t1) return g;
    return path[path.length - 1] || null;
  }

  function posAt(lane, now) {
    const g = segAt(lane, now);
    if (!g) return 0;
    if (now >= g.t1 || g.t1 <= g.t0) return g.y1;
    const k = Math.max(0, (now - g.t0) / (g.t1 - g.t0));
    return g.y0 + (g.y1 - g.y0) * k;
  }

  /** 검사대에 붙잡혀 멈춰 선 상태인가 — 카드에 표시를 붙인다 */
  function heldNow(lane, now) {
    const g = segAt(lane, now);
    return !!g && g.hold && now >= g.t0 && now < g.t1;
  }

  /** 검사대마다 지금 누구를 얼마나 붙잡고 있는지 막대로 그린다 */
  function paintBars() {
    for (const s of slots) {
      if (!s.gate || !s.bar) continue;
      let p = 0;
      for (const lane of lanes) {
        if (lane.gone) continue;
        const stop = lane.stops.find(x => x.slot === s.i);
        if (stop && t >= stop.start && t < stop.end) {
          p = (t - stop.start) / (stop.end - stop.start);
          break;
        }
      }
      s.bar.style.width = (Math.max(0, Math.min(1, p)) * 100) + '%';
      s.node.classList.toggle('def__slot--busy', p > 0);
    }
  }

  function resolve(lane) {
    lane.gone = true;
    const f = foeById.get(lane.id) || {};
    const gateSlot = slots.find(s => s.gate && s.gate.id === lane.gateId);
    const where = gateSlot ? gateSlot.at : 1;
    // 마지막 한 프레임만큼 모자란 자리에서 사라지면 "닿기 직전에 없어졌다"로 보인다
    if (lane.node) lane.node.style.top = (posAt(lane, lane.endAt) * 100) + '%';

    if (lane.result === 'blocked') {
      sfx.play('block');
      pop(where, '막았다', 'ok');
      if (gateSlot) {
        flash(gateSlot.node, 'def__slot--fire');
        if (!isReduced()) burst(gateSlot.node, 8);
      }
      say(`${f.label} — 막혔습니다.`);
    } else if (lane.result === 'over') {
      sfx.play('wrong');
      pop(where, '정상 업무였다', 'over');
      if (gateSlot) flash(gateSlot.node, 'def__slot--over');
      say(`${f.label} — 정상 업무인데 막혔습니다.`);
    } else if (lane.result === 'leak') {
      tally.leak++;
      sfx.play('leak');
      pop(1, '사고', 'bad');
      foot.classList.add('ax__foot--hit');
      setTimeout(() => foot.classList.remove('ax__foot--hit'), 600);
      // 깜빡임은 사라지지만 자국은 남는다 — 사고가 쌓이는 것이 보여야 한다
      scarLine(foot, tally.leak, '사고');
      if (!isReduced()) shake(field);
      say(`${f.label} — 막지 못했습니다.`);
    } else {
      tally.done++;
      sfx.play('place');
      pop(1, `넘김 ${tally.done}`, 'pass');
    }

    vanish(lane, lane.result === 'blocked' || lane.result === 'done');
  }

  function foeNode(lane) {
    const f = foeById.get(lane.id) || {};
    const n = el('div', 'ax__card ax__card--inert' +
      (lane.danger ? ' ax__card--bad' : ' ax__card--ok'));
    n.style.top = '0%';
    n.innerHTML =
      `<span class="ax__card__ico">${icon(f.icon || (lane.danger ? 'alert' : 'doc'))}</span>` +
      `<span class="ax__card__label">${esc(f.label || '')}</span>`;
    n.setAttribute('role', 'img');
    n.setAttribute('aria-label', `${lane.danger ? '위험' : '정상'} 일감: ${f.label || ''}`);
    return n;
  }

  function vanish(lane, ok) {
    const n = lane.node;
    if (!n) return;
    lane.node = null;
    if (isReduced()) { n.remove(); return; }
    const kill = setTimeout(() => n.remove(), 700);
    animate(n, {
      opacity: [1, 0],
      scale: ok ? [1, 1.35] : [1, 0.8],
      duration: 260, ease: 'outQuad'
    }).then(() => { clearTimeout(kill); n.remove(); });
  }

  /** 점수·사유가 그 자리에서 떠오른다 — 나중에 보는 것보다 훨씬 잘 남는다 */
  function pop(y, text, kind) {
    const p = el('span', 'ax__pop ax__pop--' + kind, esc(text));
    p.style.top = (Math.min(1, Math.max(0, y)) * 100) + '%';
    track.append(p);
    if (isReduced()) { setTimeout(() => p.remove(), 900); return; }
    const kill = setTimeout(() => p.remove(), 1200);
    animate(p, { opacity: [0, 1, 1, 0], translateY: [6, -26], duration: 900, ease: 'outQuad' })
      .then(() => { clearTimeout(kill); p.remove(); });
  }

  function flash(node, cls) {
    node.classList.add(cls);
    setTimeout(() => node.classList.remove(cls), 420);
  }

  // ---------------------------------------------------------------- 마무리

  async function endWave() {
    if (phase !== 'run') return;
    phase = 'done';
    if (loop) { loop.stop(); loop = null; }
    hideVeil();

    // 업무 시간이 끝났는데 아직 라인 위에 있는 것 — 이 판의 임팩트 모먼트다.
    // "다 막았는데 마지막 하나가 검사 줄에 서 있다"가 눈에 보여야 한다.
    let stranded = 0;
    for (const lane of lanes) {
      if (lane.gone || !lane.node) continue;
      stranded++;
      lane.node.classList.add('def__card--late');
      pop(posAt(lane, t), '오늘 못 나감', 'over');
    }
    for (const s of slots) if (s.bar) s.bar.style.width = '0%';
    drawHud();
    say(stranded
      ? '업무 시간이 끝났습니다. 라인에 남은 일감은 오늘 못 나갔습니다.'
      : '업무 시간이 끝났습니다.');

    const setup = {
      placements: slots.filter(s => s.gate).map(s => ({ slot: s.i, gateId: s.gate.id }))
    };

    const r = runner(d.runCaption || '자리를 비운 동안 무슨 일이 있었나');
    feedback.append(r.node);
    const sim = game.simulate(setup, d);
    await r.play(sim.steps);

    sfx.play(sim.grade === 'fail' ? 'fail' : 'pass');

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

  // ---------------------------------------------------------------- 덮개

  function showVeil(title, body, btnLabel, onBtn) {
    veil.hidden = false;
    veil.innerHTML =
      `<strong class="ax__veil__t">${esc(title)}</strong>` +
      (body ? `<span class="ax__veil__b">${esc(body)}</span>` : '');
    if (btnLabel && onBtn) {
      const b = el('button', 'btn-primary');
      b.type = 'button';
      b.textContent = btnLabel;
      bin.on(b, 'click', onBtn);
      veil.append(b);
      b.focus();
    }
  }

  function hideVeil() {
    veil.hidden = true;
    veil.innerHTML = '';
  }
}

/** 0.8 · 2.7 처럼 소수 한 자리로. 부동소수점 찌꺼기가 화면에 나가면 안 된다 */
function sec(n) {
  return (Math.round((n || 0) * 10) / 10).toFixed(1);
}
