// 공통 셸 — "지금 배우는 사람" 줄. 코스맵 맨 위에 붙는다.
//
// 설계 원칙 두 개.
//
//  1) 혼자 쓰는 사람에게 짐이 되면 안 된다. 대부분은 자기 PC 로 혼자 한다.
//     그 사람에게 로그인 같은 화면을 먼저 보여주면 시작하기 전에 이탈한다.
//     그래서 혼자일 때는 조용한 한 줄이고, 나눈 뒤에만 알약 목록이 된다.
//
//  2) 사람을 바꾸면 새로고침한다. 상단바·코스맵·도감이 각자 이미 그려 둔
//     숫자를 들고 있어서, 다시 그리는 것만으로는 앞사람 흔적이 남는다.
//     (core/state.js 가 저장 키를 모듈 로드 때 한 번만 읽는 것과 같은 이유)

import { who } from '../core/who.js';
import { euro } from '../core/ko.js';

export function renderLearners() {
  const box = document.createElement('section');
  box.className = 'who';

  if (!who.many) {
    box.classList.add('who--solo');
    box.append(soloLine(box));
    return box;
  }

  box.append(pills(box), tools(box));
  return box;
}

/** 혼자 쓸 때 — 안내 한 줄 + 나누기 버튼. 이름을 묻지 않는다. */
function soloLine(box) {
  const row = document.createElement('div');
  row.className = 'who__line';
  row.append(note('진행도는 이 브라우저에만 저장된다. ' +
                  '여러 명이 쓰는 PC 라면 사람을 나눠야 앞사람 진도가 안 보인다.'));
  row.append(quiet('사람 나누기', () => addForm(box)));
  return row;
}

/** 나눈 뒤 — 사람 알약. 지금 사람을 누르면 이름을 고칠 수 있다. */
function pills(box) {
  const row = document.createElement('div');
  row.className = 'who__line';
  row.append(cap('지금 배우는 사람'));

  for (const s of who.list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'who__pill' + (s.active ? ' who__pill--on' : '');
    b.textContent = s.name;
    b.setAttribute('aria-label', s.active
      ? `${s.name} — 지금 이 사람. 누르면 이름을 고칠 수 있다`
      // 이름은 사람이 입력한 것이라 받침을 알 수 없다. 낭독기는 이 문장을 그대로
      // 읽으므로 "민수으로 바꾸기"가 나가면 안 된다 (CLAUDE.md 8번)
      : `${euro(s.name)} 바꾸기`);
    if (s.active) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => {
      if (s.active) renameForm(box, s);
      else { who.switchTo(s.n); location.reload(); }
    });
    row.append(b);
  }
  return row;
}

function tools(box) {
  const row = document.createElement('div');
  row.className = 'who__line who__line--tools';

  if (who.full) {
    row.append(note(`사람은 ${who.max}명까지. 안 쓰는 사람을 지우면 자리가 생긴다.`));
  } else {
    row.append(quiet('사람 추가', () => addForm(box)));
  }

  const me = who.active;
  row.append(quiet([typed(me.name), ' 지우기'], (btn) => {
    // 브라우저 기본 대화상자를 쓰지 않는다 — 확인 버튼을 그 자리에 만든다
    btn.replaceWith(confirmDrop(box, me));
  }));
  row.append(note('이름은 이 브라우저에만 남는다. 어디로도 보내지 않는다.'));
  return row;
}

/** 새 사람 이름 입력. 비워 두고 확인하면 번호가 이름이 된다. */
function addForm(box) {
  form(box, {
    label: '새로 시작하는 사람의 이름',
    value: '',
    submit: '이 사람으로 시작',
    onOk: (name) => {
      if (who.add(name) == null) { redraw(box); return; }
      location.reload();
    }
  });
}

function renameForm(box, s) {
  form(box, {
    label: '이름 고치기',
    value: s.name,
    submit: '고침',
    // 이름을 고쳐도 새로고침한다. 이 줄만 다시 그리면 상단바에 옛 이름이
    // 그대로 남는다 — 이름이 두 군데서 다르면 누구 판인지 되레 헷갈린다.
    onOk: (name) => { who.rename(s.n, name); location.reload(); }
  });
}

/**
 * 입력 한 칸 + 확인/취소. 화면을 갈아 끼우지 않고 이 줄만 바꾼다 —
 * 코스맵 전체를 다시 그리면 스크롤 위치가 튄다.
 */
function form(box, opt) {
  box.innerHTML = '';
  box.classList.remove('who--solo');

  const row = document.createElement('div');
  row.className = 'who__line';

  const id = 'who-name';
  const lab = document.createElement('label');
  lab.className = 'who__cap';
  lab.htmlFor = id;
  lab.textContent = opt.label;

  const input = document.createElement('input');
  input.type = 'text';
  input.id = id;
  input.className = 'who__input';
  input.maxLength = who.nameMax;
  input.value = opt.value;
  input.placeholder = `${who.nameMax}자까지`;
  input.autocomplete = 'off';

  const ok = quiet(opt.submit, () => opt.onOk(input.value));
  ok.classList.add('who__go');
  // 엔터로도 끝낼 수 있어야 한다. form 태그를 쓰면 페이지가 새로 뜬다.
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); opt.onOk(input.value); }
    if (e.key === 'Escape') redraw(box);
  });

  row.append(lab, input, ok, quiet('취소', () => redraw(box)));
  box.append(row);
  input.focus();
  input.select();
}

function confirmDrop(box, me) {
  const wrap = document.createElement('span');
  wrap.className = 'who__confirm';
  wrap.append(note([typed(me.name), '의 기록이 사라진다.']));

  const yes = quiet('정말 지운다', () => {
    who.remove(me.n);
    location.reload();
  });
  yes.classList.add('who__danger');
  wrap.append(yes, quiet('취소', () => redraw(box)));
  return wrap;
}

/** 이 줄만 다시 그린다 */
function redraw(box) {
  box.replaceWith(renderLearners());
}

function cap(text) {
  const s = document.createElement('span');
  s.className = 'who__cap';
  s.textContent = text;
  return s;
}

function note(parts) {
  const s = document.createElement('span');
  s.className = 'who__note';
  return put(s, parts);
}

function quiet(label, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-quiet who__btn';
  put(b, label);
  b.addEventListener('click', () => fn(b));
  return b;
}

/** 글자와 조각(span)을 섞어 넣는다. 이름을 따로 감싸야 해서 필요하다. */
function put(node, parts) {
  for (const p of [].concat(parts)) node.append(p);
  return node;
}

/**
 * 사람이 직접 입력한 이름. 글꼴을 시스템 것으로 고정한다.
 * 왜: 저장소에 넣은 Pretendard 조각에는 이 게임 문구에 나오는 음절만 있다.
 * 남이 타이핑한 이름은 대개 그 안에 없어서, 감싸지 않으면 "지원" 의 '지' 는
 * Pretendard, '원' 은 맑은 고딕으로 나온다 — 한 이름 안에서 글꼴이 갈린다.
 */
export function typed(name) {
  const s = document.createElement('span');
  s.className = 'typed';
  s.textContent = name;
  return s;
}
