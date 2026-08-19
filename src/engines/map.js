// 엔진 N — 지형 답사. 의뢰 하나를 어느 갈래로 가져갈지 고르고, 발품을 치른다.
//
// 왜 이 엔진이 필요한가:
//   "이 일엔 어떤 AI?"를 통 열 개짜리 분류 게임으로 가르치고 있었다. 카드를 읽고
//   통을 고르면 맞다/틀리다가 나오는 판이다. 그런데 실무에서 도구 고르기가
//   어려운 이유는 "정답 통을 모른다"가 아니다. **같은 일을 여러 갈래가 다 할 수
//   있는데 대가가 다르기 때문**이다. 그 사실은 O/X 로는 절대 안 나온다.
//
//   여기서는 오답 표시가 없다. 대신 **발품이 줄어든다.** 무거운 길만 고르면
//   뒤의 의뢰를 손도 못 대고, 싼 길만 고르면 아무것도 안 남는다.
//   그래서 "어떤 AI"가 취향이 아니라 오늘의 지형 읽기가 된다.
//
// 조작은 두 번 누르기다. 지형도의 구역을 누르고, [이 길로 간다]를 누른다.
// 끌기는 없다. 시계도 없다 — 쫓기는 판은 5번이 이미 하고 있다.
//
// 계산은 core/terrain.js 가 한다 — 미리보기와 판정이 같은 답을 봐야 한다.
// 판정은 game.simulate({ picks, left }, d) 가 한다. 엔진은 내용을 모른다.

import { el, esc, say, Bin, header, actions, runner, todo } from './base.js';
import { enter, cardIn, pulse, shake, wait } from '../core/motion.js';
import { eulReul } from '../core/ko.js';
import { route } from '../core/terrain.js';

let bin = new Bin();

export function unmount() { bin.clear(); }

export function mount(root, game, ctx) {
  unmount();
  bin = new Bin();

  const d = game.data;
  const jobs = d.jobs || [];
  const terrains = d.terrains || [];
  const BUDGET = d.budget || 0;
  const L = d.look || {};
  const NOTE = d.notes || {};
  const ASK = d.askLabels || {};
  const startedAt = Date.now();

  /** 고른 순서 — 순서가 결과를 바꾼다(앞에서 흘리면 뒤가 싸구려가 된다) */
  const picks = [];
  const done = new Set();
  let left = BUDGET;
  let at = 0;            // 지금 맡은 의뢰
  let open = null;       // 살펴보는 중인 구역
  let phase = 'play';

  root.innerHTML = '';
  root.append(header(game));

  // ---- 발품 계기 ----
  const hud = el('section', 'mp__hud');
  const gauge = el('div', 'mp__gauge');
  const gaugeFill = el('i');
  gauge.append(gaugeFill);
  const meter = el('div', 'mp__meter');
  hud.append(meter, gauge);
  root.append(hud);

  // ---- 지금 의뢰 ----
  const jobCard = el('article', 'mp__job');
  root.append(jobCard);

  // 지금 눌러야 할 것 하나. **의뢰 카드 바로 다음** — 이 의뢰를 읽고 나서
  // 무엇을 누르는지가 이어져야 한다. 어느 구역이 맞는지는 말하지 않는다.
  const step = todo();
  root.append(step.node);

  // ---- 지형도 ----
  const map = el('section', 'mp__map');
  const tiles = new Map();
  for (const t of terrains) {
    const node = el('button', 'mp__tile');
    node.type = 'button';
    node.dataset.id = t.id;
    node.innerHTML =
      `<span class="mp__tile__name">${esc(t.label)}</span>` +
      `<span class="mp__tile__line">${esc(t.line || '')}</span>` +
      `<span class="mp__tile__traits"></span>`;
    node.setAttribute('aria-label', `${t.label}. ${t.line || ''}`);
    map.append(node);
    tiles.set(t.id, { def: t, node, traits: node.querySelector('.mp__tile__traits') });
    bin.on(node, 'click', () => tapTile(t.id));
  }
  root.append(map);

  // ---- 이 길로 가면 ----
  const look = el('section', 'mp__look');
  root.append(look);

  // ---- 지나온 길 ----
  const trail = el('section', 'mp__trail');
  trail.append(el('div', 'mp__trail__cap', esc(L.trailCap || '지나온 길')));
  const chips = el('div', 'mp__chips');
  trail.append(chips);
  root.append(trail);

  const feedback = el('div');
  root.append(feedback);

  drawHud();
  drawJob();
  drawTiles();
  drawLook();
  drawTrail();
  enter([...map.children], { each: 40 });

  // ------------------------------------------------------------ 화면

  function current() { return jobs[at] || null; }

  function drawHud() {
    meter.innerHTML =
      `<span class="mp__meter__cap">${esc(L.budgetCap || '남은 발품')}</span>` +
      `<b class="mp__meter__num">${left}</b>` +
      `<span class="mp__meter__of">${esc(L.jobCap || '의뢰')} ${Math.min(done.size + 1, jobs.length)}/${jobs.length}</span>`;
    gaugeFill.style.width = (BUDGET ? Math.max(0, (left / BUDGET) * 100) : 0) + '%';
    gauge.classList.toggle('is-low', BUDGET > 0 && left / BUDGET <= 0.25);
  }

  function drawJob() {
    const job = current();
    if (!job) { jobCard.innerHTML = ''; return; }
    const asks = (job.asks || []).map(a =>
      `<span class="mp__ask">${esc(ASK[a] || a)}</span>`).join('');
    jobCard.innerHTML =
      `<div class="mp__job__no">${esc(L.jobCap || '의뢰')} ${String(at + 1).padStart(2, '0')}</div>` +
      `<p class="mp__job__text">${esc(job.text)}</p>` +
      (asks
        ? `<div class="mp__asks"><span class="mp__asks__cap">${esc(L.askCap || '원하는 것')}</span>${asks}</div>`
        : `<div class="mp__asks"><span class="mp__ask mp__ask--none">${esc(L.askNone || '원하는 것이 없다')}</span></div>`);
    cardIn(jobCard);
  }

  function drawTiles() {
    const job = current();
    for (const [id, k] of tiles) {
      const r = job ? route(job, k.def) : null;
      const far = !!r && r.legwork > left;
      k.node.classList.toggle('mp__tile--open', open === id);
      k.node.classList.toggle('mp__tile--far', far);
      k.node.classList.toggle('mp__tile--gone', !!r && !r.ok);
      if (!r) { k.traits.textContent = ''; continue; }
      k.traits.innerHTML = r.ok
        ? `<i class="mp__trait mp__trait--cost">${esc(L.legworkCap || '발품')} ${r.legwork}</i>` +
          `<i class="mp__trait${k.def.keeps ? '' : ' mp__trait--no'}">` +
          `${esc(k.def.keeps ? (L.keepYes || '남는다') : (L.keepNo || '안 남는다'))}</i>` +
          `<i class="mp__trait${k.def.hands ? '' : ' mp__trait--no'}">` +
          `${esc(k.def.hands ? (L.handYes || '넘긴다') : (L.handNo || '못 넘긴다'))}</i>`
        : `<i class="mp__trait mp__trait--cost">${esc(L.legworkCap || '발품')} ${r.legwork}</i>` +
          `<i class="mp__trait mp__trait--no">${esc(L.noRoad || '길이 없다')}</i>`;
    }
  }

  function drawLook() {
    const job = current();
    const k = open ? tiles.get(open) : null;
    if (!job || !k) {
      look.innerHTML = `<p class="mp__look__hint">${esc(L.hint || '구역을 눌러 살펴본다')}</p>`;
      step.set(phase === 'play' ? '구역을 눌러 답사한다. 발품은 줄어든다' : '');
      return;
    }

    const r = route(job, k.def);
    const far = r.legwork > left;
    const shape = !r.ok ? (L.none || '이 갈래에는 이 일을 하는 길이 없다')
      : r.why === 'detour' ? (L.far || '되기는 된다 — 먼 길이다')
      : r.why === 'shallow' ? (L.wide || '한 창에서 얕게 끝난다')
      : (L.own || '이 일을 전담하는 갈래다');

    look.innerHTML =
      `<div class="mp__look__cap">${esc(L.cap || '이 길로 가면')} · ${esc(k.def.label)}</div>` +
      `<div class="mp__look__cost"><b>${r.legwork}</b>` +
      `<span>${esc(L.legworkCap || '발품')}</span></div>` +
      `<p class="mp__look__line">${esc(shape)}</p>`;

    const goLabel = far ? (L.poor || '발품이 모자란다')
      : !r.ok ? (L.anyway || '그래도 가 본다')
      : (L.go || '이 길로 간다');
    const backLabel = L.close || '다른 구역 보기';

    // 갈 수 있으면 가는 버튼을, 발품이 모자라면 물러나는 버튼을 이름 그대로 부른다.
    // 초록 "다 됐다"는 켜지 않는다. 갈 수 있다는 것과 여기가 맞는 구역이라는 것은
    // 다른 말인데 줄이 구별을 못 한다 — 안 맞는 구역에서도 [그래도 가 본다]가
    // 뜨는 자리라, 켜면 **어느 구역을 고르는가**를 줄이 대신 답해 버린다.
    step.set(far
      ? `발품이 모자란다. ${eulReul(`[${backLabel}]`)} 누른다`
      : `${eulReul(`[${goLabel}]`)} 누른다`);

    const bar = actions([
      { id: 'go', label: goLabel, primary: true, disabled: far },
      { id: 'back', label: backLabel }
    ]);
    bar.node.classList.add('mp__look__bar');
    look.append(bar.node);
    bin.on(bar.btn.go, 'click', () => commit(k.def));
    bin.on(bar.btn.back, 'click', () => { open = null; drawTiles(); drawLook(); });
  }

  function drawTrail() {
    chips.innerHTML = '';
    if (!picks.length) {
      chips.append(el('span', 'mp__chips__none', esc(L.trailNone || '아직 없다')));
      return;
    }
    for (const p of picks) {
      const job = jobs.find(j => j.id === p.jobId);
      const k = tiles.get(p.terrainId);
      if (!job || !k) continue;
      const cls = p.ok ? (p.missed.length ? 'mp__chip mp__chip--thin' : 'mp__chip mp__chip--full')
                       : 'mp__chip mp__chip--back';
      const tail = esc(p.ok ? `${L.legworkCap || '발품'} ${p.legwork}` : (L.backTag || '되돌아옴'));
      chips.append(el('span', cls,
        `<b>${jobs.indexOf(job) + 1}</b>${esc(k.def.label)} <i>${tail}</i>`));
    }
  }

  function note(text) {
    if (!text) return;
    say(text);
    const p = el('p', 'mp__note', esc(text));
    feedback.innerHTML = '';
    feedback.append(p);
    cardIn(p);
  }

  // ------------------------------------------------------------ 조작

  function tapTile(id) {
    if (phase !== 'play') return;
    open = open === id ? null : id;
    drawTiles();
    drawLook();
    const k = tiles.get(id);
    if (!open || !k) return;
    say(`${k.def.label}. ${k.def.line || ''}`);
    // 좁은 화면에서는 미리보기가 화면 밖에 있다. 안 보이는 판은 없는 판이다.
    try { look.scrollIntoView({ block: 'nearest' }); } catch { /* 구형 브라우저 */ }
  }

  function commit(terrain) {
    if (phase !== 'play') return;
    const job = current();
    if (!job) return;

    const r = route(job, terrain);
    if (r.legwork > left) { shake(tiles.get(terrain.id).node); return; }

    left -= r.legwork;
    picks.push({ jobId: job.id, terrainId: terrain.id, ok: r.ok, why: r.why,
                 legwork: r.legwork, missed: r.missed });

    if (r.ok) {
      done.add(job.id);
      pulse(tiles.get(terrain.id).node);
      // 다음으로 남은 의뢰
      let n = at + 1;
      while (n < jobs.length && done.has(jobs[n].id)) n++;
      at = n;
    } else {
      // 오답 표시가 뜨지 않는다. 발품만 나가고 의뢰는 그대로 남는다 — 이 판의 요점이다.
      shake(tiles.get(terrain.id).node);
    }

    open = null;
    note(noteFor(r));
    drawHud();
    drawTiles();
    drawTrail();

    if (at >= jobs.length || left <= 0) { end(); return; }
    drawJob();
    drawLook();
  }

  /** 무슨 일이 일어났는지 한 줄. 판정이 아니라 **일어난 일**을 적는다. */
  function noteFor(r) {
    if (!r.ok) return NOTE.wall;
    if (r.missed.length) return NOTE[r.missed[0]] || NOTE.thin;
    if (r.why === 'detour') return NOTE.detour;
    return NOTE.full;
  }

  // ------------------------------------------------------------ 마무리

  async function end() {
    if (phase === 'end') return;
    phase = 'end';
    open = null;
    step.set('');   // 답사가 끝났다. 이제 누를 것이 없다

    // 답사가 끝나면 지형도와 의뢰는 접는다. 남는 것은 **지나온 길**이다 —
    // 그 자취 위에서 되짚는 로그가 흘러야 오늘 한 선택이 이어져 읽힌다.
    look.innerHTML = '';
    jobCard.innerHTML = '';
    map.hidden = true;

    const sim = game.simulate({ picks: picks.map(p => ({ jobId: p.jobId, terrainId: p.terrainId })),
                                left }, d);

    const r = runner(d.runCaption || '오늘 답사를 되짚는다');
    feedback.innerHTML = '';
    feedback.append(r.node);
    r.node.scrollIntoView({ block: 'nearest' });
    await r.play(sim.steps);
    await wait(120);

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
