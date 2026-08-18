// 엔진 S — 서고. 낱말을 쳐서 문서를 찾고, 찾은 것만 AI에게 넘긴다.
//
// 왜 이 엔진이 필요한가:
//   RAG 를 "서가에서 문서 두 개 고르기"로 가르치고 있었다. 서가가 통째로 보이니
//   제목만 읽고 고르면 끝이라, 정작 이 개념의 핵심인 **검색이 답의 상한선**이라는
//   것이 안 나온다. 실제로는 서고가 안 보인다. 낱말을 쳐야 몇 건이 걸리고,
//   걸린 것만 AI 에게 간다.
//
//   여기서는 서고가 처음부터 안 보인다. 검색은 횟수가 정해져 있고, 결과는 상위
//   몇 건만 나온다. 넘길 수 있는 칸도 좁다. 그래서 **내가 친 낱말이 나쁘면
//   나쁜 조각이 걸리고, AI 는 그것만 보고 자신 있게 틀린다.**
//
//   담은 문서의 본문에서 다음 검색어가 나온다 — 그게 이 판의 방탈출 구조다.
//
// 검색 규칙은 core/search.js 가 한다. 판정은 game.simulate({ picked, queries }).

import { el, esc, say, Bin, header, actions, runner, todo } from './base.js';
import { enter, cardIn, shake, pulse, wait } from '../core/motion.js';
import { eulReul } from '../core/ko.js';
import { search } from '../core/search.js';

let bin = new Bin();
export function unmount() { bin.clear(); }

export function mount(root, game, ctx) {
  unmount();
  bin = new Bin();

  const d = game.data;
  const docs = d.docs || [];
  const TRIES = d.tries || 4;
  const HOLD = d.hold || 3;
  const TOP = d.top || 3;
  const askLabel = d.askLabel || 'AI에게 넘기고 답 받기';
  const findLabel = d.findLabel || '찾기';
  const startedAt = Date.now();

  /** 담은 문서 id */
  const picked = [];
  /** 친 낱말 — 판정이 "읽고 다시 검색했나"를 본다 */
  const queries = [];
  /** 지금 쓸 수 있는 낱말. 문서를 담으면 늘어난다. */
  const words = [...(d.words || [])];

  let left = TRIES;
  let asked = false;
  /** 마지막 검색 결과 {q, list}. 처음 그릴 때부터 읽으므로 여기서 만든다 */
  let last = null;

  root.innerHTML = '';
  root.append(header(game));

  // 지금 눌러야 할 것 하나. 자리는 **질문 카드 바로 다음**이다 —
  // "이런 질문이 들어왔다 → 그래서 이걸 눌러라" 순서로 읽혀야 한다.
  const step = todo();

  // ---- 들어온 질문 ----
  const ask = el('article', 'lib__ask');
  ask.innerHTML =
    `<div class="lib__ask__cap">${esc(d.askCap || '들어온 질문')}</div>` +
    `<div class="lib__ask__body">${esc(d.ask)}</div>`;
  root.append(ask, step.node);

  // ---- 검색 줄 ----
  const barBox = el('section', 'lib__find');
  const row = el('div', 'lib__row');
  const input = el('input', 'lib__input');
  input.type = 'text';
  input.placeholder = d.inputHint || '낱말을 넣고 찾는다';
  input.setAttribute('aria-label', d.inputHint || '검색어');
  input.autocomplete = 'off';
  const go = el('button', 'lib__go', esc(findLabel));
  go.type = 'button';
  row.append(input, go);

  const tries = el('div', 'lib__tries');
  barBox.append(row, tries);
  root.append(barBox);

  bin.on(go, 'click', find);
  bin.on(input, 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); find(); } });

  // ---- 쓸 수 있는 낱말 ----
  const wordBox = el('section', 'lib__words');
  root.append(wordBox);

  // ---- 검색 결과 ----
  const hitBox = el('section', 'lib__hits');
  root.append(hitBox);

  // ---- 넘길 것 ----
  const holdBox = el('section', 'lib__hold');
  root.append(holdBox);

  const feedback = el('div');
  root.append(feedback);

  const bar = actions([
    { id: 'ask', label: askLabel, primary: true }
  ]);
  root.append(bar.node);
  bin.on(bar.btn.ask, 'click', () => { if (!asked) run(); });

  drawTries();
  drawWords();
  drawHits(null);
  drawHold();
  say(d.ask);

  // ------------------------------------------------------------ 그리기

  function drawTries() {
    tries.innerHTML = '';
    tries.append(el('span', 'lib__tries__cap', esc(d.triesLabel || '찾을 수 있는 횟수')));
    for (let i = 0; i < TRIES; i++) {
      tries.append(el('i', 'lib__try' + (i < TRIES - left ? ' lib__try--used' : '')));
    }
    go.disabled = left <= 0 || asked;
    input.disabled = left <= 0 || asked;
    tellStep();
  }

  /**
   * 지금 눌러야 할 것 하나. **어떤 낱말을 쳐야 하는지는 말하지 않는다** —
   * 낱말을 고르는 것이 이 판이 가르치려는 것이라, 여기서 말하면 판이 없어진다.
   * 버튼 이름은 데이터에서 온 라벨을 그대로 부른다.
   */
  function tellStep() {
    if (asked) { step.set(''); return; }
    const hand = `${eulReul(`[${askLabel}]`)} 누른다`;
    // 칸이 다 찼거나 더 찾을 수 없으면 남은 동작은 넘기는 것뿐이다
    if (picked.length >= HOLD || left <= 0) { step.set(hand, { done: true }); return; }
    if (!last) { step.set(`낱말을 넣고 ${eulReul(`[${findLabel}]`)} 누른다`); return; }
    if (!last.list.length) { step.set('다른 낱말로 다시 찾는다'); return; }
    if (last.list.some(h => !picked.includes(h.doc.id))) { step.set('걸린 것을 눌러 담는다'); return; }
    step.set(`더 찾거나 ${hand}`);
  }

  function drawWords() {
    wordBox.innerHTML = '';
    if (!words.length) return;
    wordBox.append(el('div', 'lib__cap', esc(d.wordsLabel || '지금 아는 낱말 — 눌러서 넣는다')));
    const rail = el('div', 'lib__rail');
    for (const w of words) {
      const b = el('button', 'lib__word', esc(w));
      b.type = 'button';
      bin.on(b, 'click', () => {
        if (asked) return;
        const now = input.value.trim();
        if (now.split(/\s+/).includes(w)) return;
        input.value = (now ? now + ' ' : '') + w;
        input.focus();
      });
      rail.append(b);
    }
    wordBox.append(rail);
  }

  /** @param {null|{q:string, list:Array}} out */
  function drawHits(out) {
    hitBox.innerHTML = '';
    if (!out) {
      hitBox.append(el('p', 'lib__empty', esc(d.emptyHint ||
        '서고는 안 보인다. 낱말을 쳐야 걸린 것만 나온다.')));
      return;
    }
    hitBox.append(el('div', 'lib__cap',
      `${esc(out.q)} — ${out.list.length ? `${out.list.length}건 걸렸다` : '한 건도 안 걸렸다'}`));

    if (!out.list.length) {
      hitBox.append(el('p', 'lib__empty', esc(d.missHint ||
        '이 낱말이 들어 있는 문서가 서고에 없다. 다른 말로 불러 봐야 한다.')));
      return;
    }

    const list = el('div', 'lib__list');
    for (const hit of out.list) {
      const taken = picked.includes(hit.doc.id);
      const b = el('button', 'lib__hit' + (taken ? ' lib__hit--taken' : ''));
      b.type = 'button';
      b.innerHTML =
        `<span class="lib__hit__title">${esc(hit.doc.title)}</span>` +
        `<span class="lib__hit__why">${esc(d.hitLabel || '걸린 낱말')} · ` +
          `${hit.hits.map(h => esc(h)).join(' · ')}</span>` +
        (taken ? `<span class="lib__hit__mark">${esc(d.takenLabel || '담았다')}</span>` : '');
      bin.on(b, 'click', () => take(hit.doc, b));
      list.append(b);
    }
    hitBox.append(list);
    enter([...list.children], { each: 50 });
  }

  function drawHold() {
    tellStep();
    holdBox.innerHTML = '';
    holdBox.append(el('div', 'lib__cap',
      `${esc(d.holdLabel || 'AI에게 넘길 것')} · ${picked.length}/${HOLD}`));

    if (!picked.length) {
      holdBox.append(el('p', 'lib__empty', esc(d.holdHint ||
        '아무것도 안 넘기면 AI는 아는 대로 지어낸다.')));
      return;
    }
    for (const id of picked) {
      const doc = docs.find(x => x.id === id);
      if (!doc) continue;
      const card = el('article', 'lib__slip');
      card.innerHTML =
        `<div class="lib__slip__title">${esc(doc.title)}</div>` +
        `<div class="lib__slip__text">${esc(doc.text)}</div>`;
      const drop = el('button', 'lib__drop', esc(d.dropLabel || '빼기'));
      drop.type = 'button';
      bin.on(drop, 'click', () => {
        if (asked) return;
        const i = picked.indexOf(id);
        if (i >= 0) picked.splice(i, 1);
        drawHold();
        drawHits(last);
      });
      card.append(drop);
      holdBox.append(card);
    }
  }

  // ------------------------------------------------------------ 조작

  function find() {
    if (asked || left <= 0) return;
    const q = input.value.trim();
    if (!q) { shake(input); return; }

    left--;
    queries.push(q);
    const list = search(docs, q, TOP);
    last = { q, list };
    input.value = '';

    drawTries();
    drawHits(last);
    say(list.length
      ? `${q} — ${list.length}건 걸렸습니다.`
      : `${q} — 한 건도 안 걸렸습니다.`);
    if (!list.length) shake(hitBox);
  }

  function take(doc, node) {
    if (asked) return;
    if (picked.includes(doc.id)) return;
    if (picked.length >= HOLD) {
      shake(node);
      say(d.fullNote || `넘길 수 있는 칸이 ${HOLD}개뿐입니다.`);
      return;
    }
    picked.push(doc.id);

    // 담은 문서에서 새 낱말이 나온다 — 이게 이 판의 사슬이다.
    let fresh = 0;
    for (const w of doc.gives || []) {
      if (words.includes(w)) continue;
      words.push(w);
      fresh++;
    }

    drawHold();
    drawHits(last);
    if (fresh) {
      drawWords();
      pulse(wordBox.querySelector('.lib__rail'), 1);
      say(`${doc.title}에서 새 낱말이 나왔습니다.`);
    }
  }

  // ------------------------------------------------------------ 답

  async function run() {
    asked = true;
    bar.btn.ask.disabled = true;
    drawTries();

    const r = runner(d.runCaption || '넘긴 것만 보고 답한다');
    feedback.append(r.node);
    r.node.scrollIntoView({ block: 'nearest' });

    const sim = game.simulate({ picked: [...picked], queries: [...queries], left }, d);
    await r.play(sim.steps);
    await wait(160);

    // 답이 나온 뒤에야 서고를 연다. 먼저 열면 이 판은 읽기 게임이 된다.
    if (sim.reveal) {
      const box = el('section', 'lib__shelf');
      box.append(el('div', 'lib__cap', esc(d.shelfLabel || '서고에 있던 것')));
      for (const doc of docs) {
        const need = (sim.reveal.need || []).includes(doc.id);
        const had = picked.includes(doc.id);
        const line = el('div', 'lib__book' +
          (need ? ' lib__book--need' : '') + (had ? ' lib__book--had' : ''));
        line.innerHTML =
          `<span class="lib__book__t">${esc(doc.title)}</span>` +
          (need ? `<span class="lib__book__tag">${esc(d.neededLabel || '필요했다')}</span>` : '') +
          (had && !need ? `<span class="lib__book__tag lib__book__tag--no">${esc(d.uselessLabel || '넘겼지만 소용없었다')}</span>` : '');
        box.append(line);
      }
      feedback.append(box);
      cardIn(box);
      box.scrollIntoView({ block: 'nearest' });
      await wait(400);
    }

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
