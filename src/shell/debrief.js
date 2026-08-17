// 공통 셸 — 해설 패널.
//
// 이 패널의 목적은 점수 통보가 아니다. **방금 한 행동에 이름을 붙여 주는 것**이다.
// "당신이 방금 한 것 = 컨텍스트 엔지니어링" 처럼, 먼저 겪고 나서 이름을 알게 만든다.
// 그래야 용어가 외울 것이 아니라 겪은 것의 이름이 된다.

import { stamp, countUp, wait, enter, burst, shake } from '../core/motion.js';
import { go } from '../core/router.js';
import { esc, strong } from '../core/text.js';

const LABEL = { pass: '승인', partial: '조건부', fail: '반려' };

export async function showDebrief(game, result, on) {
  hideDebrief();

  const grade = result.grade;
  const panel = document.createElement('div');
  panel.className = 'debrief';
  panel.id = 'debrief';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '결과와 해설');

  const inner = document.createElement('div');
  inner.className = 'debrief__inner';

  // ---- 점수 고리 + 도장 ----
  // 숫자만 적어 두면 성적표가 된다. 고리가 채워져야 "판이 끝났다"로 읽힌다.
  const head = document.createElement('div');
  head.className = 'debrief__head';

  const ring = document.createElement('div');
  ring.className = `ring ring--${grade}`;
  ring.style.setProperty('--v', '0');
  const num = document.createElement('span');
  num.className = 'ring__num';
  num.textContent = '0';
  ring.append(num, Object.assign(document.createElement('span'),
    { className: 'ring__unit', textContent: '점' }));

  const side = document.createElement('div');
  side.className = 'debrief__side';
  const mark = document.createElement('span');
  mark.className = `stamp stamp--${grade}`;
  mark.textContent = LABEL[grade];
  const meta = document.createElement('span');
  meta.className = 'debrief__score';
  meta.textContent = fmt(result.elapsed) +
    (result.stats || []).map(s => ` · ${s.label} ${s.value}`).join('');
  side.append(mark, meta);

  head.append(ring, side);
  inner.append(head);

  // ---- 방금 한 것의 이름 ----
  const named = game.named && (game.named[grade] || game.named.all);
  if (named) {
    const box = document.createElement('div');
    box.className = 'named';
    box.innerHTML =
      `<div class="named__key">방금 한 것의 이름</div>` +
      `<div class="named__body">${strong(named)}</div>`;
    inner.append(box);
  }

  // ---- 왜 이렇게 됐는가: 실패 사유 / 잘한 점 ----
  const why = document.createElement('div');
  why.className = 'why';
  for (const f of result.faults || []) why.append(reason(f, 'bad'));
  for (const g of result.gains || []) why.append(reason(g, 'good'));
  if (why.children.length) inner.append(why);

  // ---- 해설 (최대 3줄) ----
  const lines = String((game.debrief && game.debrief[grade]) || '').split('\n').slice(0, 3);
  for (const line of lines) {
    if (!line.trim()) continue;
    const p = document.createElement('p');
    p.className = 'debrief__text';
    p.innerHTML = strong(line);
    inner.append(p);
  }

  // ---- 해금된 용어 ----
  if (result.unlocked && result.unlocked.length) {
    const chips = document.createElement('div');
    chips.className = 'terms';
    for (const t of result.unlocked) {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'term-chip';
      c.textContent = `+ ${t}`;
      c.title = '도감에서 보기';
      c.addEventListener('click', () => { hideDebrief(); go(`/codex?q=${encodeURIComponent(t)}`); });
      chips.append(c);
    }
    inner.append(chips);
  }

  // ---- 안내 한 줄 (있을 때만) ----
  if (on.hint) {
    const h = document.createElement('p');
    h.className = 'debrief__hint';
    h.textContent = on.hint;
    inner.append(h);
  }

  // ---- 버튼 ----
  // 반려면 "다시 하기"가 주 버튼이다. 틀린 채로 다음으로 떠밀지 않는다.
  const bar = document.createElement('div');
  bar.className = 'debrief__actions';
  const failed = grade === 'fail';
  const retry = button('다시 하기', () => { hideDebrief(); on.retry(); }, failed);
  const next = button(on.nextLabel || '다음', () => { hideDebrief(); on.next(); }, !failed);
  bar.append(retry, next);
  if (on.toCourse) {
    bar.append(button('코스맵', () => { hideDebrief(); on.toCourse(); }));
  }
  inner.append(bar);

  panel.append(inner);
  document.body.append(panel);

  requestAnimationFrame(() => panel.classList.add('is-open'));
  await wait(120);
  stamp(mark);
  countUp(num, result.score);
  // 고리는 숫자와 같은 속도로 찬다 — 둘이 따로 놀면 어색하다
  ring.style.setProperty('--v', String(result.score));

  // 도장이 찍힌 다음 아래 내용이 차례로 올라온다
  enter([...inner.children].slice(1), { each: 55, start: 180, from: 14 });

  if (grade === 'fail') shake(head);
  // 통과는 그 자체로 축하할 일이다. 만점일 때만 터뜨리면 대부분은 아무것도 못 본다.
  if (grade === 'pass') { await wait(300); burst(ring, result.score >= 100 ? 26 : 16); }

  (failed ? retry : next).focus();

  say(`${LABEL[grade]}. ${result.score}점. ${named || lines[0] || ''}`);
}

export function hideDebrief() {
  const old = document.getElementById('debrief');
  if (old) old.remove();
}

function reason(r, kind) {
  const d = document.createElement('div');
  d.className = `why__item why__item--${kind}`;
  d.innerHTML = `<span class="why__name">${esc(r.name)}</span><span>${strong(r.why)}</span>`;
  return d;
}

function button(label, fn, primary) {
  const b = document.createElement('button');
  b.type = 'button';
  if (primary) b.className = 'btn-primary';
  b.textContent = label;
  b.addEventListener('click', fn);
  return b;
}

function fmt(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  return m ? `${m}분 ${s % 60}초` : `${s}초`;
}

function say(text) {
  const live = document.getElementById('live');
  if (live) live.textContent = text;
}
