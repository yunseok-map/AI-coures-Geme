// 공통 셸 — 상단바. 뒤로가기 · 진행도 · 도감 버튼.
// 엔진은 이 파일을 건드리지 않는다. 셸만 그린다. (GAME_SPEC.md §4)

import { state } from '../core/state.js';
import { manifest } from '../games/index.js';
import { back, go } from '../core/router.js';
import { fillBar, pulse, cardIn, burst, wait } from '../core/motion.js';
import { who } from '../core/who.js';

let lastPct = null;    // 진행도가 실제로 오를 때만 막대를 움직인다
let lastRank = null;   // 등급이 바뀌는 순간은 한 번만 축하한다

export function renderTopbar(host, route) {
  const { done, total } = state.progress(manifest);
  const rank = state.rank(manifest);
  const pct = total ? Math.round((done / total) * 100) : 0;

  host.innerHTML = '';
  host.className = 'topbar';
  const inner = document.createElement('div');
  inner.className = 'topbar__inner';
  host.append(inner);

  // 코스맵에서는 뒤로가기 대신 자리만 비워 둔다 (레이아웃이 흔들리지 않게)
  const left = document.createElement('button');
  left.type = 'button';
  left.className = 'topbar__back';
  if (route.name === 'course') {
    left.textContent = '';
    left.setAttribute('aria-hidden', 'true');
    left.tabIndex = -1;
    left.disabled = true;
    left.style.visibility = 'hidden';
  } else {
    left.textContent = '←';
    left.setAttribute('aria-label', '코스맵으로 돌아가기');
    left.addEventListener('click', back);
  }

  const prog = document.createElement('div');
  prog.className = 'topbar__progress';
  // 이름은 **늘 붙인다.** 시작 화면에서 누구나 이름을 대고 들어오므로
  // (`shell/enter.js`) 여기가 비어 있으면 "내가 누구로 들어왔더라"를 확인할
  // 자리가 없다. 게임 안에서도 보이는 유일한 자리다 — 남의 기록 위에 20분을
  // 쌓고 나서야 아는 건 늦다. 전에는 사람을 나눈 뒤에만 붙였는데,
  // 나누는 일 자체가 드물어서 사실상 아무에게도 안 보였다.
  prog.innerHTML =
    `<div class="progress__label">` +
      `<span class="progress__who">${esc(who.active.name)}</span>` +
      `<span class="progress__rank">${esc(rank.name)}</span>` +
      // 용어 카운터에 id 를 준다 — 딴 용어가 여기로 날아와 꽂힌다(sendTo 의 착지점).
      // 보여 주는 숫자는 읽음이 아니라 **획득**이다. 도감을 열어 본 것까지 세면
      // 숫자가 저절로 올라가서 모으는 느낌이 사라진다.
      `<span class="progress__stat">필수 <b>${done}</b>/${total} · ` +
      `용어 <b id="term-count">${state.earnedCount}</b></span>` +
    `</div>` +
    `<div class="progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"` +
    ` aria-valuenow="${pct}" aria-label="필수 코스 진행도">` +
      `<div class="progress__fill" style="width:${lastPct == null ? pct : lastPct}%"></div>` +
    `</div>`;

  // 도감·결과 카드에서는 같은 버튼이 "닫기"가 된다
  const inBook = route.name === 'codex' || route.name === 'tools' || route.name === 'report';
  const codex = document.createElement('button');
  codex.type = 'button';
  codex.className = 'topbar__codex';
  codex.textContent = inBook ? '닫기' : '도감';
  codex.setAttribute('aria-label', inBook ? '닫고 돌아가기' : '용어 도감 열기');
  codex.addEventListener('click', () => {
    if (inBook) back();
    else go('/codex');
  });

  inner.append(left, prog, codex);

  if (lastPct != null && pct > lastPct) {
    fillBar(prog.querySelector('.progress__fill'), pct);
    pulse(prog.querySelector('.progress__rank'), 1);
  } else {
    prog.querySelector('.progress__fill').style.width = pct + '%';
  }
  lastPct = pct;

  if (lastRank && lastRank !== rank.name) rankUp(rank.name);
  lastRank = rank.name;
}

/** 등급이 올라간 순간 — 이 게임에서 몇 번 없는 보상이다 */
async function rankUp(name) {
  const old = document.getElementById('rankup');
  if (old) old.remove();

  const box = document.createElement('div');
  box.id = 'rankup';
  box.className = 'rankup';
  box.setAttribute('role', 'status');
  box.innerHTML = `<span class="rankup__cap">등급이 올라갔다</span>` +
                  `<span class="rankup__name">${esc(name)}</span>`;
  document.body.append(box);
  cardIn(box);
  burst(box, 18);

  await wait(2600);
  box.remove();
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
