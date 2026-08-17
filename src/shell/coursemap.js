// 공통 셸 — 코스맵. manifest 만 보고 그린다.
// 미니게임을 추가해도 이 파일은 고치지 않는다. (GAME_SPEC.md §10)

import { state } from '../core/state.js';
import { manifest } from '../games/index.js';
import { chapterNames, terms } from '../data/terms.js';
import { go } from '../core/router.js';
import { enter } from '../core/motion.js';
import { renderLearners } from './learners.js';
import { who } from '../core/who.js';

const CHAPTER_ORDER = [1, 2, 3, 4, 5, 9];

export function renderCourse(root) {
  const { done, total } = state.progress(manifest);

  // "지금 여기" 표시는 이어서 하기 카드가 가리키는 판과 반드시 같아야 한다.
  const nextGame = nextUp();

  root.innerHTML =
    `<h1 class="stage__title">AI 연수원</h1>` +
    `<p class="stage__sub">읽는 곳이 아니라 해보는 곳이다. 한 판 약 2분 · 필수 ${total}판이면 완주.</p>`;

  // 사람 줄이 "이어서 하기" 위에 온다. 공용 PC 에서 앞사람 진도를 보고
  // 그대로 눌러 버리는 것을 막는 유일한 지점이라 카드보다 먼저 읽혀야 한다.
  root.append(renderLearners());
  root.append(resume(done, total));

  const blocks = [];
  for (const ch of CHAPTER_ORDER) {
    const games = manifest.filter(g => g.chapter === ch);
    if (!games.length) continue;
    const block = chapterBlock(ch, games, nextGame);
    blocks.push(block);
    root.append(block);
  }

  root.append(footer(done, total));

  // 노드는 CSS에서 opacity:0 으로 시작한다 — 여기서 살려 준다.
  enter(root.querySelectorAll('.node'), { each: 18 });
  enter(blocks.map(b => b.querySelector('.chapter__head')), { each: 30 });
}

/** 지금 눌러야 할 판 하나. 이어서 하기 카드와 코스맵의 "지금 여기"가 같은 곳을 가리키게 한다. */
function nextUp() {
  return manifest.find(g => g.ready && g.required && !state.isCleared(g.id))
      || manifest.find(g => g.ready && !state.isCleared(g.id))
      || null;
}

/** 맨 위 "이어서 하기" — 다음에 뭘 눌러야 할지 고민하지 않게 한다. */
function resume(done, total) {
  const box = document.createElement('div');
  box.className = 'resume';

  const next = nextUp();

  if (!next) {
    box.innerHTML =
      `<div class="resume__cap">17판 전부 완주</div>` +
      `<div class="resume__name">결과 카드를 확인하라</div>`;
    box.append(bigBtn('결과 카드 보기', () => go('/report')));
    return box;
  }

  const requiredDone = done === total && total > 0;
  box.innerHTML =
    `<div class="resume__cap">${
      requiredDone ? '필수 코스 완주 · 심화가 열려 있다'
      : done === 0 ? '여기서 시작'
      : `필수 ${done} / ${total} 진행 중`}</div>` +
    `<div class="resume__name">${next.no}. ${esc(next.title)}</div>` +
    `<div class="resume__learn">${esc(next.learn)}</div>`;
  box.append(bigBtn(
    requiredDone ? '심화 계속하기' : done === 0 ? '시작하기' : '이어서 하기',
    () => go(`/game/${next.id}`)));
  if (requiredDone) {
    const r = document.createElement('button');
    r.type = 'button';
    r.className = 'btn-quiet';
    r.style.marginTop = 'var(--sp-2)';
    r.textContent = '결과 카드 보기';
    r.addEventListener('click', () => go('/report'));
    box.append(r);
  }
  return box;
}

function bigBtn(label, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-primary btn-big';
  b.textContent = label;
  b.addEventListener('click', fn);
  return b;
}

function chapterBlock(ch, games, nextGame) {
  const wrap = document.createElement('section');
  wrap.className = 'chapter';

  const allOptional = games.every(g => !g.required);
  const label = ch === 9 ? '번외' : `챕터 ${ch}`;

  const cleared = games.filter(g => state.isCleared(g.id)).length;
  const allDone = cleared === games.length;
  const pct = Math.round(cleared / games.length * 100);

  const head = document.createElement('div');
  head.className = 'chapter__head' + (allDone ? ' chapter__head--done' : '');
  head.innerHTML =
    `<span class="chapter__no">${esc(label)}</span>` +
    `<span class="chapter__name">${esc(chapterNames[ch] || '')}</span>` +
    (allDone ? `<span class="chapter__tag chapter__tag--done">완료</span>`
     : allOptional ? `<span class="chapter__tag">심화</span>` : '') +
    // 챕터마다 몇 판 남았는지 — 코스맵을 스크롤하는 동안 진행이 눈에 보이게 한다
    `<span class="chapter__count">${cleared}<span>/${games.length}</span></span>` +
    `<span class="chapter__meter"><i style="width:${pct}%"></i></span>`;
  wrap.append(head);

  const list = document.createElement('div');
  list.className = 'nodes';

  for (const g of games) list.append(node(g, nextGame && g.id === nextGame.id));
  wrap.append(list);
  return wrap;
}

function node(g, isNow) {
  const result = state.resultOf(g.id);
  const passed = state.isCleared(g.id);
  const rejected = Boolean(result) && !passed;

  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'node ' + (g.required ? 'node--required' : 'node--optional') +
                (passed ? ' node--done' : '') + (rejected ? ' node--rejected' : '') +
                (isNow ? ' node--now' : '');

  // 배지 안에는 번호를 보여주고, 깬 것만 체크로 바꾼다
  const mark = passed ? '✓' : rejected ? '↻' : String(g.no);
  const meta = !g.ready ? '준비 중'
             : result ? gradeLabel(result.grade)
             : g.required ? '필수' : '심화';

  b.innerHTML =
    `<span class="node__mark" aria-hidden="true">${mark}</span>` +
    `<span class="node__body">` +
      `<span class="node__name">${g.no}. ${esc(g.title)}</span>` +
      `<span class="node__learn">${esc(g.learn)}</span>` +
    `</span>` +
    (isNow ? `<span class="node__here">지금 여기</span>`
           : `<span class="node__meta">${esc(meta)}</span>`);

  b.setAttribute('aria-label',
    `${g.no}번 ${g.title}. ${g.required ? '필수' : '심화'}. ${g.learn}. ` +
    (passed ? `완료, ${gradeLabel(result.grade)}`
     : rejected ? '반려, 다시 하면 됩니다'
     : g.ready ? '시작하려면 누르세요' : '아직 준비 중'));

  if (!g.ready) {
    b.disabled = true;
  } else {
    b.addEventListener('click', () => go(`/game/${g.id}`));
  }
  return b;
}

function footer(done, total) {
  const f = document.createElement('div');
  f.className = 'course__foot';

  const note = document.createElement('p');
  note.className = 'node__learn';
  note.style.flexBasis = '100%';
  note.style.margin = '0 0 var(--sp-2)';
  // 획득과 읽음을 나눠 적는다. 합쳐 세면 도감을 열어 본 것까지 들어가서
  // 숫자가 저절로 올라가고, 모으는 느낌이 사라진다. (shell/collect.js)
  const tally = `딴 용어 ${state.earnedCount} / ${terms.length}` +
                (state.unlockedCount > state.earnedCount
                  ? ` (읽은 것까지 ${state.unlockedCount})` : '');
  // "어디에 저장되나"는 맨 위 사람 줄이 이미 말한다 — 여기서 또 말하지 않는다
  note.textContent = done === total && total > 0
    ? `필수 코스를 완주했다. 심화도 열려 있다. ${tally}.`
    : `언제든 중단하고 나중에 이어서 할 수 있다. ${tally}.`;
  f.append(note);

  const codex = quiet('용어 도감', () => go('/codex'));
  const tools = quiet('AI 도구 도감', () => go('/tools'));
  const report = quiet('결과 카드', () => go('/report'));

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'btn-quiet';
  // 여러 명이 쓰면 누구 기록이 날아가는지 버튼에 적어 둔다 —
  // 공용 PC 에서 남의 기록을 지우는 사고가 제일 아프다
  reset.textContent = who.many ? `${who.active.name} 처음부터` : '처음부터';
  reset.addEventListener('click', () => {
    // 브라우저 기본 대화상자를 쓰지 않는다 — 확인 버튼을 그 자리에 만든다.
    reset.replaceWith(confirmReset());
  });

  f.append(codex, tools, report, reset);
  return f;
}

function quiet(label, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-quiet';
  b.textContent = label;
  b.addEventListener('click', fn);
  return b;
}

function confirmReset() {
  const box = document.createElement('span');
  box.style.display = 'flex';
  box.style.gap = 'var(--sp-2)';

  const yes = document.createElement('button');
  yes.type = 'button';
  yes.className = 'btn-quiet';
  yes.style.color = 'var(--fail)';
  yes.style.borderColor = 'var(--fail)';
  yes.textContent = '정말 지운다';
  yes.addEventListener('click', () => {
    state.reset();
    location.reload();
  });

  const no = document.createElement('button');
  no.type = 'button';
  no.className = 'btn-quiet';
  no.textContent = '취소';
  no.addEventListener('click', () => location.reload());

  box.append(yes, no);
  return box;
}

function gradeLabel(grade) {
  return grade === 'pass' ? '승인' : grade === 'partial' ? '조건부' : '반려';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
