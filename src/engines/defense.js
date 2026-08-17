// 엔진 F — 디펜스형. 위에서 내려오는 것을 아래에 닿기 전에 막는다.
//
// 이 엔진이 가르치는 구조:
//   장치는 **막는 종류가 정해져 있다.** 아무 장치나 아무 데나 놓으면 안 막힌다.
//   그리고 안전한 일감까지 막으면 일이 진행되지 않는다 — 과잉 차단도 실패다.
//   이 두 가지가 게임 규칙 그 자체라서, 설명을 읽지 않아도 손으로 배운다.
//
// 부드러운 압박(사용자 확정): 사고가 나도 게임오버가 없다. 웨이브는 끝까지 흐르고
// 사고 건수만 쌓인다. 못하는 사람이 막히지 않으면서 잘하는 사람은 만점을 노린다.
//
// 엔진은 특정 미니게임을 모른다. 무대를 돌리고 결과를 모아서
// game.simulate(setup) 에 넘기는 것까지가 이 파일의 일이다. (CLAUDE.md §1-3)
//
// 화면 부품 중 `ax__` 로 시작하는 것은 액션 엔진 공용이다(arcade.css).

import { el, esc, strong, say, Bin, header, actions, runner } from './base.js';
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
  const travel = d.travelSec || 7;        // 적이 위에서 바닥까지 오는 시간
  const gap = d.gapSec ?? 1.9;            // 적 사이 간격
  const cooldown = d.cooldownSec ?? 1.2;  // 장치가 한 번 막은 뒤 다시 준비되는 시간

  // 적 목록 — 등장 시각을 안 적었으면 순서대로 벌려 놓는다
  const foes = d.foes.map((f, i) => ({
    ...f,
    at: f.at ?? i * gap,
    y: -0.14,          // 0 = 판 맨 위, 1 = 우리 팀 앞. 음수 = 아직 판 위쪽 밖
    live: false, done: false, node: null
  }));

  // 슬롯 — 길을 가로지르는 문. 위에서부터 고르게 벌린다.
  const slots = Array.from({ length: d.slots }, (_, i) => ({
    i, at: (i + 1) / (d.slots + 1),   // 0..1 위치
    gate: null, cool: 0, node: null
  }));

  const stock = d.gates.map(g => ({ ...g, left: g.count ?? 1 }));
  let armed = null;

  const out = { blocked: [], leaked: [], overblocked: [], passed: [] };
  let combo = 0, bestCombo = 0, t = 0, phase = 'setup';

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
    { id: 'go', label: d.runLabel || '시작', primary: true, disabled: true }
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
    b.className = 'def__slot' +
      (s.gate ? ' def__slot--set' : '') +
      (!s.gate && armed ? ' def__slot--open' : '') +
      (s.cool > 0 ? ' def__slot--cool' : '');
    b.innerHTML = s.gate
      ? `${icon(s.gate.icon || 'guard')}<span class="def__slot__n">${esc(s.gate.label)}</span>`
      : `<span class="def__slot__n def__slot__n--empty">${armed ? '여기 놓기' : '빈 자리'}</span>`;
    b.setAttribute('aria-label', s.gate
      ? `${s.i + 1}번 자리, ${s.gate.label} 놓임. 누르면 회수`
      : `${s.i + 1}번 자리, 비어 있음${armed ? `. 누르면 ${armed.label} 놓기` : ''}`);
  }

  function drawTray() {
    tray.innerHTML = '';
    for (const g of stock) {
      const b = el('button', 'ax__tool' +
        (armed === g ? ' ax__tool--armed' : '') +
        (g.left <= 0 ? ' ax__tool--out' : ''));
      b.type = 'button';
      b.disabled = g.left <= 0;
      b.innerHTML =
        `${icon(g.icon || 'guard')}` +
        `<span class="ax__tool__n">${esc(g.label)}</span>` +
        `<span class="ax__tool__c">${g.left}</span>`;
      b.setAttribute('aria-label',
        `${g.label}. ${g.blurb || ''} 남은 개수 ${g.left}${armed === g ? '. 지금 집은 상태' : ''}`);
      bin.on(b, 'click', () => {
        armed = armed === g ? null : g;
        sfx.play('pick');
        drawTray(); slots.forEach(paintSlot);
        if (armed && g.blurb) say(`${g.label} — ${g.blurb}`);
      });
      tray.append(b);
    }
  }

  function tapSlot(s) {
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
    const any = slots.some(x => x.gate);
    bar.btn.go.disabled = phase !== 'setup' || !any;
    if (any && phase === 'setup') pulse(bar.btn.go, 1);
  }

  // ---------------------------------------------------------------- 계기판

  function drawHud() {
    const placed = slots.filter(s => s.gate).length;
    hud.innerHTML =
      `<span class="ax__stat"><b>${out.leaked.length}</b> 사고</span>` +
      `<span class="ax__stat ax__stat--ok"><b>${out.blocked.length}</b> 차단</span>` +
      (phase === 'setup'
        ? `<span class="ax__stat">장치 <b>${placed}</b>/${d.slots}</span>`
        : `<span class="ax__stat">남은 일감 <b>${foes.filter(f => !f.done).length}</b></span>`) +
      (combo > 1 ? `<span class="ax__combo">${combo}연속</span>` : '');
    hud.append(soundBtn());
  }

  function soundBtn() {
    const b = el('button', 'ax__mute');
    b.type = 'button';
    b.textContent = sfx.on ? '소리 끄기' : '소리 켜기';
    b.setAttribute('aria-label', sfx.on ? '효과음 끄기' : '효과음 켜기');
    bin.on(b, 'click', () => { sfx.toggle(); drawHud(); });
    return b;
  }

  // ---------------------------------------------------------------- 웨이브

  async function begin() {
    if (phase !== 'setup') return;
    phase = 'count';
    bar.btn.go.disabled = true;
    armed = null;
    drawTray();
    slots.forEach(paintSlot);

    await countdown();
    if (phase !== 'count') return;      // 도중에 화면을 떠났다

    phase = 'run';
    drawHud();
    say('시작했습니다. 남은 장치는 도중에도 놓을 수 있습니다.');

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
    t += dt;

    for (const s of slots) if (s.cool > 0) {
      s.cool = Math.max(0, s.cool - dt);
      if (s.cool === 0) paintSlot(s);
    }

    for (const f of foes) {
      if (f.done) continue;

      if (!f.live) {
        if (t < f.at) continue;
        f.live = true;
        f.node = foeNode(f);
        track.append(f.node);
      }

      const prev = f.y;
      f.y += dt / travel;
      // 음수 그대로 둔다 — 판 위쪽에서 흘러들어오는 것처럼 보인다(판이 넘침을 자른다)
      f.node.style.top = (f.y * 100) + '%';

      // 지나친 문마다 판정한다
      for (const s of slots) {
        if (!s.gate || s.cool > 0) continue;
        if (prev < s.at && f.y >= s.at) { hitGate(f, s); break; }
      }
      if (f.done) continue;

      if (f.y >= 1) reachFoot(f);
    }

    if (foes.every(f => f.done)) end();
  }

  function stops(gate, foe) {
    return Array.isArray(gate.stops) && gate.stops.includes(foe.kind);
  }

  function hitGate(f, s) {
    if (!stops(s.gate, f)) {
      // 앞에 장치가 있는데도 지나갔다 — 종류가 다르다는 걸 그 자리에서 보여 준다
      flash(s.node, 'def__slot--miss');
      return;
    }
    s.cool = cooldown;
    paintSlot(s);
    f.done = true;

    if (f.danger) {
      out.blocked.push(f.id);
      combo++; bestCombo = Math.max(bestCombo, combo);
      sfx.play('block');
      if (combo > 1) sfx.play('combo', combo);
      pop(f.y, `막았다${combo > 1 ? ` ×${combo}` : ''}`, 'ok');
      flash(s.node, 'def__slot--fire');
      if (!isReduced()) burst(s.node, 8);
      say(`${f.label} — 막혔습니다.`);
    } else {
      // 안전한 일감을 막았다. 사고는 아니지만 일이 안 된 것이다.
      out.overblocked.push(f.id);
      combo = 0;
      sfx.play('wrong');
      pop(f.y, '이건 정상 업무였다', 'over');
      flash(s.node, 'def__slot--over');
      say(`${f.label} — 정상 업무인데 막혔습니다.`);
    }
    vanish(f, f.danger);
    drawHud();
  }

  function reachFoot(f) {
    f.done = true;
    if (f.danger) {
      out.leaked.push(f.id);
      combo = 0;
      sfx.play('leak');
      pop(1, '사고', 'bad');
      foot.classList.add('ax__foot--hit');
      setTimeout(() => foot.classList.remove('ax__foot--hit'), 600);
      if (!isReduced()) shake(field);
      say(`${f.label} — 막지 못했습니다.`);
    } else {
      out.passed.push(f.id);
      pop(1, '통과', 'pass');
    }
    vanish(f, false);
    drawHud();
  }

  function foeNode(f) {
    const n = el('div', 'ax__card ax__card--inert' +
      (f.danger ? ' ax__card--bad' : ' ax__card--ok'));
    n.style.top = '0%';
    n.innerHTML =
      `<span class="ax__card__ico">${icon(f.icon || (f.danger ? 'alert' : 'doc'))}</span>` +
      `<span class="ax__card__label">${esc(f.label)}</span>`;
    n.setAttribute('role', 'img');
    n.setAttribute('aria-label', `${f.danger ? '위험' : '정상'} 일감: ${f.label}`);
    return n;
  }

  function vanish(f, ok) {
    const n = f.node;
    if (!n) return;
    f.node = null;
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

  async function end() {
    if (phase !== 'run') return;
    phase = 'done';
    if (loop) { loop.stop(); loop = null; }
    hideVeil();

    const setup = {
      blocked: out.blocked.slice(),
      leaked: out.leaked.slice(),
      overblocked: out.overblocked.slice(),
      passed: out.passed.slice(),
      placements: slots.filter(s => s.gate).map(s => ({ slot: s.i, gateId: s.gate.id })),
      unplaced: stock.filter(g => g.left > 0).map(g => g.id),
      bestCombo
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
