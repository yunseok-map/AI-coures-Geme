// 시작 화면 — 이름을 대고 들어간다. 코스맵보다 먼저 뜬다.
//
// 왜 있나: 교육장 단말 한 대를 여러 명이 돌아가며 쓴다. 앞사람이 하던
// 브라우저를 그대로 열면 다음 사람이 **이미 다 깬 화면**을 본다 — 이어서 하기
// 카드가 완주를 가리키고 도장이 전부 찍혀 있으면 그 사람은 아무것도 배우지 못한다.
// 저장 칸을 나누는 장치는 이미 있었지만(`core/who.js`), 그걸 **먼저 물어보지
// 않아서** 아무도 나누지 않았다. 나누는 자리를 맨 앞으로 옮긴 것이 이 화면이다.
//
// 로그인이 아니다. 서버로 나가는 것이 없고 비밀번호도 없다 — 이름은 이 브라우저
// 안에서 진도 칸을 가리키는 이름표일 뿐이다. 그래서 화면에 그렇게 적어 둔다.
// 안 그러면 사내 교육에서 "내 계정을 왜 만드나"로 이탈한다.
//
// 이 화면은 **탭마다 한 번**만 뜬다(`who.entered`). 같은 탭에서 새로고침하는
// 경우(사람 바꾸기·처음부터)에는 다시 묻지 않는다.

import { who } from '../core/who.js';
import { euro } from '../core/ko.js';

/**
 * 이 문서가 **어느 사람으로 열렸는가.** 모듈이 불러와지는 지금 읽어 둔다.
 *
 * `core/state.js` 도 같은 시점에 저장 키를 한 번 읽고 그대로 들고 간다.
 * 그래서 "새로고침이 필요한가"는 **지금 사람과 고른 사람을 비교해서는 알 수 없다** —
 * `who.add()` 는 만들면서 곧바로 그 사람으로 넘어가므로, 고른 뒤에 비교하면
 * 언제나 "같다"가 나온다. 실제로 그렇게 짰다가 **새로 들어온 사람 화면에
 * 앞사람 진도가 그대로 뜨는** 것을 잡았다. 기준은 문서가 열린 시점이어야 한다.
 */
const bootN = who.active.n;

/**
 * 필요하면 시작 화면을 띄우고, 사람이 정해질 때까지 기다린다.
 *
 * 사람이 **바뀌면 새로고침한다.** `core/state.js` 는 저장 키를 모듈 로드 때
 * 한 번만 읽으므로, 바꾼 뒤 그대로 이어 가면 앞사람 칸에 기록이 쌓인다.
 * 그때 이 함수는 영영 resolve 하지 않는다 — 새 문서가 처음부터 다시 시작한다.
 *
 * @param {HTMLElement} host 앱 뿌리. 이 화면이 통째로 차지한다.
 * @returns {Promise<void>} 지금 사람 그대로 이어 갈 때만 resolve 한다.
 */
export function needEnter() {
  return !who.entered;
}

export function showEnter(host) {
  return new Promise((resolve) => {
    const box = document.createElement('section');
    box.className = 'enter';
    host.append(box);
    draw(box, resolve);
  });
}

function draw(box, resolve) {
  box.textContent = '';

  const card = document.createElement('div');
  card.className = 'enter__card';

  card.append(
    cap('출입 명부'),
    title('AI 연수원'),
    // 화면만 봐서는 모르는 것 하나 — 이름이 진도 칸을 가른다는 것.
    // 조작 방법은 아래 라벨과 버튼이 이미 말하고 있으므로 여기서 되풀이하지 않는다.
    lead('이름마다 진도가 따로 저장된다. 이 컴퓨터 안에만 남는다.')
  );

  // 이미 하던 사람이 있으면 **자기를 골라 들어가는 길**을 먼저 놓는다.
  // 새로 이름을 적는 것보다 이쪽이 흔하고, 잘못 적으면 진도가 갈라지기 때문이다.
  const others = who.list;
  const known = !who.fresh;
  if (known) card.append(cap2('이미 하던 사람'), pills(others, resolve));

  card.append(form(known, resolve));

  box.append(card);

  // 처음 온 사람은 바로 칠 수 있게 커서를 넣어 준다. 이미 하던 사람이 있는
  // 화면에서는 넣지 않는다 — 휴대폰에서 자판이 올라와 알약 목록을 덮는다.
  if (!known) card.querySelector('.enter__input')?.focus();
}

/** 이미 있는 사람 — 이름과 **깬 판 수**를 같이 적는다. 이름만으로는 자기 칸을 못 고른다. */
function pills(list, resolve) {
  const row = document.createElement('div');
  row.className = 'enter__pills';

  for (const s of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'enter__pill';

    const name = document.createElement('b');
    name.className = 'enter__pill-name typed';
    name.textContent = s.name;

    const n = who.done(s.n);
    const sub = document.createElement('span');
    sub.className = 'enter__pill-sub';
    sub.textContent = n ? `${n}판 끝냈다` : '아직 없다';

    b.append(name, sub);
    // 이름은 사람이 적은 것이라 받침을 알 수 없다 (CLAUDE.md 8번)
    b.setAttribute('aria-label', `${euro(s.name)} 들어간다`);
    b.addEventListener('click', () => enterAs(s.n, resolve));
    row.append(b);
  }
  return row;
}

/** 처음 온 사람 — 이름 한 칸과 [들어간다] */
function form(known, resolve) {
  const f = document.createElement('form');
  f.className = 'enter__form';

  const id = 'enter-name';
  const label = document.createElement('label');
  label.className = 'enter__cap2';
  label.htmlFor = id;
  label.textContent = known ? '처음 온 사람' : '이름';

  const line = document.createElement('div');
  line.className = 'enter__line';

  const input = document.createElement('input');
  input.id = id;
  input.className = 'enter__input';
  input.type = 'text';
  input.autocomplete = 'off';
  input.maxLength = who.nameMax;
  input.placeholder = `${who.nameMax}자까지`;

  const go = document.createElement('button');
  go.type = 'submit';
  go.className = 'btn-primary enter__go';
  go.textContent = '들어간다';

  const err = document.createElement('p');
  err.className = 'enter__err';
  err.setAttribute('role', 'alert');
  err.hidden = true;

  const stop = (msg) => { err.textContent = msg; err.hidden = false; input.focus(); };

  f.addEventListener('submit', (e) => {
    e.preventDefault();
    err.hidden = true;
    const name = input.value.trim();

    if (!name) return stop('이름을 적어야 들어갈 수 있다.');
    // 같은 이름을 두 칸으로 두면 목록에서 자기 칸을 구별할 수 없다.
    // 진도가 갈라진 뒤에는 되돌릴 방법이 없으므로 여기서 막는다.
    if (who.taken(name)) return stop('같은 이름이 이미 있다. 위에서 자기 이름을 누르거나 다르게 적는다.');
    if (who.full) return stop(`사람은 ${who.max}명까지다. 코스맵에서 안 쓰는 사람을 지우면 자리가 생긴다.`);

    // 아무도 시작한 적 없는 브라우저면 1번 칸의 이름만 바꾼다 —
    // 새 칸을 만들면 옛 키를 쥔 진도 0 짜리 '1번' 이 유령으로 남는다.
    if (who.fresh) { who.rename(1, name); enterAs(1, resolve); return; }

    const n = who.add(name);
    if (n == null) return stop('자리를 만들지 못했다. 코스맵에서 안 쓰는 사람을 지운다.');
    enterAs(n, resolve);
  });

  line.append(input, go);
  f.append(label, line, err);
  return f;
}

/**
 * 그 사람으로 들어간다.
 *
 * **문서가 열린 시점의 사람**과 같을 때만 그대로 이어 간다. 그 외에는 새로고침한다 —
 * `core/state.js` 가 저장 키를 모듈 로드 때 한 번만 읽으므로, 새로고침 없이 이어 가면
 * 새 사람 화면에 앞사람 진도가 그대로 뜬다.
 *
 * 같을 때 새로고침하지 않는 이유도 있다. 볼 것이 없는 새로고침은 느리기만 하고,
 * 저장소를 못 쓰는 환경(사생활 보호 모드)에서는 들어왔다는 표시가 안 남아
 * 이 화면이 다시 떠서 **들어갈 수 없는 고리**가 된다.
 */
function enterAs(n, resolve) {
  who.switchTo(n);
  who.enter();
  if (n === bootN) resolve();
  else location.reload();
}

function cap(t)  { return line('p', 'enter__cap', t); }
function cap2(t) { return line('p', 'enter__cap2', t); }
function lead(t) { return line('p', 'enter__lead', t); }
function title(t) { return line('h1', 'enter__title', t); }

function line(tag, cls, text) {
  const e = document.createElement(tag);
  e.className = cls;
  e.textContent = text;
  return e;
}
