// 미니게임 5 — 어디서 할까?  (엔진 R 실시간 관제)
// 배우는 것: 프로젝트 · 아티팩트 · CLI 에이전트 · Cowork (그리고 채팅과의 차이)
//
// 예전에는 통 다섯 개짜리 분류 게임이었다. 카드를 읽고 통을 고르면 맞다/틀리다가
// 나오는 판이라, 정작 배워야 할 것이 안 나왔다: **표면 선택은 맞고 틀림이 아니라
// 비용이다.** 채팅으로도 대부분 된다 — 다만 배경을 매번 다시 설명해야 하고,
// 창구가 하나뿐이라 줄이 선다.
//
// 여기서는 시계가 돈다. 잘못 보내도 오답 표시가 안 뜬다. 일감이 시간을 먹고
// 되돌아오고, 대기줄이 넘치면 밀려난다. 그래서 선택이 오늘의 처리량이 된다.
//
// 진짜 벽은 둘뿐이다:
//   내 컴퓨터의 파일을 건드리는 일 → CLI 에이전트에서만 된다
//   여러 단계를 통째로 맡기는 일   → Cowork 에서만 끝난다
// 나머지는 전부 "되기는 되는데 얼마나 걸리나"의 문제다.
//
// 통 이름을 특정 제품이 아니라 갈래로 둔다. 터미널 도구는 회사마다 있고
// (claude · codex · gemini) 조작과 개념이 같다.

import { Run } from '../core/sim.js';
import { replay } from '../core/dispatch.js';

const SURFACES = [
  { id: 'chat', label: '채팅',
    note: '바로 물어본다',
    about: '준비가 필요 없다. 대신 배경 자료가 필요한 일은 물어볼 때마다 다시 설명해야 한다.' },
  { id: 'project', label: '프로젝트',
    note: '자료를 올려 두는 곳',
    about: '배경 자료와 지침을 한 번 올려 두면 그 다음 대화는 전부 그걸 알고 시작한다. 처음 한 번이 비싸다.' },
  { id: 'artifact', label: '아티팩트',
    note: '결과물을 옆에 띄우고 고친다',
    about: '결과물 하나를 붙들고 고쳐 나간다. 같은 것을 이어 고치면 빨라진다.' },
  { id: 'cli', label: 'CLI 에이전트',
    note: '내 컴퓨터의 파일을 직접',
    about: '터미널에서 파일을 읽고 고치고 명령을 실행한다. 파일을 실제로 건드려야 하는 일은 여기서만 된다.' },
  { id: 'cowork', label: 'Cowork',
    note: '통째로 맡긴다',
    about: '여러 단계짜리 사무 업무를 통째로 맡긴다. 오래 걸리지만 맡겨 두고 다른 일을 계속할 수 있다.' }
];

// 들어오는 시각(at)과 걸리는 시간(sec)은 함께 잡아야 한다. 제대로 나눠 보내면
// 하루 안에 끝나고, 한 창구에 몰면 줄이 서서 하루를 거의 다 먹도록 맞췄다.
// 그 두 가지를 `_tests/test-dispatch.mjs` 가 실제로 계산해서 지킨다.
const ITEMS = [
  { id: 'j1', at: 0,  sec: 2, needs: 'quick',    label: '이 문장 어색한데 자연스럽게 고쳐 줘' },
  { id: 'j2', at: 3,  sec: 3, needs: 'context',  bg: '규정집', label: '규정집을 보고 연차 기준을 알려 줘' },
  { id: 'j3', at: 7,  sec: 3, needs: 'artifact', bg: '제안서', label: '제안서 초안을 문단별로 이어 고친다' },
  { id: 'j4', at: 10, sec: 3, needs: 'file',     label: '내 폴더의 파일 이름을 규칙대로 전부 바꿔 줘' },
  { id: 'j5', at: 14, sec: 4, needs: 'multi',    label: '자료 열두 건을 대조해 표로 만들고 보고서 초안까지' },
  { id: 'j6', at: 18, sec: 3, needs: 'context',  bg: '규정집', label: '같은 규정집에서 출장비 기준도 알려 줘' },
  { id: 'j7', at: 23, sec: 2, needs: 'quick',    label: '이 영어 메일이 무슨 뜻인지 한 줄로' },
  { id: 'j8', at: 27, sec: 3, needs: 'artifact', bg: '제안서', label: '제안서 3장을 다시 고친다' },
  { id: 'j9', at: 32, sec: 3, needs: 'context',  bg: '규정집', label: '규정집에서 경조사 기준도 알려 줘' }
];

const labelOf = (id) => (ITEMS.find(i => i.id === id) || {}).label || '';

export default {
  id: 'where-to-work',
  engine: 'R',
  title: '어디서 할까?',
  subtitle: '들어오는 일감을 창구로 보낸다. 잘못 보내면 되돌아오고, 시간은 이미 갔다',
  chapter: 2,
  required: true,
  concept: ['프로젝트', '아티팩트', 'CLI 에이전트', 'Cowork'],
  checkedAt: '2026-08',

  data: {
    day: 46,
    queueCap: 3,
    items: ITEMS,
    surfaces: SURFACES,
    queueLabel: '대기줄 — 세 칸뿐이다. 넘치면 밀려난다',
    keepLabel: '남아 있다',
    backTag: '되돌아옴',
    lostTag: '밀려남',
    doneTag: '끝',
    busyNote: '이 창구는 지금 일하고 있다.',
    goLabel: '오늘 시작',
    runNote: '일감이 들어온다. 대기줄에서 집어 창구로 보낸다.',
    runCaption: '오늘 하루를 되짚는다',
    pauseTitle: '잠깐 멈췄다'
  },

  /**
   * 판정. 무엇이 정답이었는지는 안 본다 — **오늘 몇 건을 끝냈고 시간을 어디에
   * 흘렸는지**만 본다.
   *
   * 시간 계산은 core/dispatch.js 의 replay() 가 한다. 화면의 진행 막대와 같은
   * 함수라, "3초짜리라며 왜 감점이냐" 같은 일이 안 생긴다.
   */
  simulate(setup, d) {
    const plan = setup.plan || [];
    const lost = setup.lost || 0;
    const r = new Run();
    const { runs, spent } = replay(d.items, plan);

    const bounced = runs.filter(x => !x.ok);
    const explained = runs.filter(x => x.why === 'explain');
    const detour = runs.filter(x => ['offtrack', 'heavy', 'oversize'].includes(x.why));
    const reused = runs.filter(x => x.why === 'ready');
    const again = runs.filter(x => x.why === 'again');
    const whole = runs.filter(x => x.why === 'whole');
    const onFile = runs.filter(x => x.surfaceId === 'cli' && x.why === '');
    const done = d.items.length - lost;

    r.read(`오늘 들어온 일감 ${d.items.length}건.`);

    // ---- 되돌아온 것 ----
    for (const b of bounced) {
      const it = d.items.find(i => i.id === b.itemId);
      const wall = it && it.needs === 'file'
        ? 'CLI 에이전트가 아니면 내 컴퓨터의 파일을 못 건드린다'
        : 'Cowork가 아니면 여러 단계를 통째로 못 맡는다';
      r.fail(`${labelOf(b.itemId)} — ${b.sec}초를 쓰고 그대로 되돌아왔다.`);
      r.fault('되돌아온 일감', wall, 14);
    }

    // ---- 밀려난 것 ----
    if (lost > 0) {
      r.fail(`대기줄이 넘쳐 ${lost}건은 손도 못 댔다.`);
      for (let i = 0; i < lost; i++) {
        r.fault('놓친 일감', '한 창구에 몰아 줄이 서는 동안 대기줄이 넘쳤다', 16);
      }
    }

    // ---- 흘린 시간 ----
    if (explained.length) {
      r.warn(`같은 배경 자료를 ${explained.length}번 다시 설명했다.`);
      // 8점인 이유: 같은 배경을 세 번 다시 설명하면 통과선 아래로 떨어져야 한다.
      // 이 판이 가르치려는 실수가 정확히 그것이라 통과시키면 안 된다.
      for (let i = 0; i < explained.length; i++) {
        r.fault('매번 다시 설명', '채팅은 준비가 없는 대신 배경을 물어볼 때마다 다시 넣어야 한다', 8);
      }
    }
    if (detour.length) {
      for (let i = 0; i < Math.min(detour.length, 3); i++) {
        r.fault('먼 길로 돌아갔다', '되기는 되지만 그 일을 위해 만든 창구가 아니라 시간이 더 들었다', 5);
      }
    }

    // ---- 잘한 것 ----
    if (reused.length) {
      r.ok(`자료를 한 번 올려 두고 ${reused.length}번 그대로 썼다.`);
      r.gain('올려 두고 다시 쓴 자료', '프로젝트는 처음 한 번이 비싸고 그 다음부터 공짜다', 0);
    }
    if (again.length) {
      r.ok('같은 결과물을 이어서 고쳤다.');
      r.gain('이어 고친 결과물', '아티팩트는 결과물 단위라 붙들고 있을수록 빨라진다', 0);
    }
    if (whole.length) {
      r.gain('통째로 맡긴 일', '여러 단계짜리 업무를 맡겨 두고 그동안 다른 일을 처리했다', 0);
    }
    if (onFile.length) {
      r.gain('파일은 파일 다루는 곳으로', '내 컴퓨터의 파일을 건드리는 일을 제자리로 보냈다', 0);
    }

    r.out(`${done}건 처리 · 창구가 돌아간 시간 ${spent}초.`);

    return r.finish({ pass: 80, partial: 45 });
  },

  named: {
    all: '방금 일에 맞는 창구를 골라 봤다. 대부분은 어디서도 되지만 ' +
         '드는 시간이 다르다. 자료를 올려 두고 계속 쓰는 곳이 **프로젝트**, ' +
         '결과물 하나를 붙들고 고치는 곳이 **아티팩트**, 내 컴퓨터의 파일을 ' +
         '직접 건드리는 쪽이 **CLI 에이전트**, 여러 단계를 통째로 맡기는 쪽이 **Cowork**다.'
  },

  debrief: {
    pass: '창구를 고르는 기준은 “무엇이 남는가”다. 자료가 남으면 프로젝트, 결과물이 남으면 아티팩트다.\n' +
          '같은 배경으로 세 번 물어볼 일이면 올려 두는 쪽이 이긴다. 두 번째부터는 공짜니까.\n' +
          '파일을 실제로 건드리는 일과 여러 단계를 통째로 맡기는 일에만 진짜 벽이 있다.',
    partial: '시간을 흘리는 자리는 대개 둘이다.\n' +
             '같은 자료를 매번 다시 설명한 것, 그리고 한 창구에 몰아 줄을 세운 것.\n' +
             '창구는 각자 하나씩만 돌아간다. 몰면 대기줄이 넘친다.',
    fail: '전부 채팅으로 보내면 창구가 하나뿐이라 줄이 선다. 일감이 밀려난 게 그래서다.\n' +
          '채팅은 파일을 못 건드리고 여러 단계짜리 일도 못 끝낸다. 시간만 먹고 돌아온다.\n' +
          '창구 다섯을 눌러 보면 각자 무엇을 위해 있는지 알려 준다.'
  }
};
