// 미니게임 10 — 신입 온보딩 문서 만들기 (엔진 C 조립형 / 예산형 + 수리형)
// 배우는 것: 지침 파일 · 컨텍스트 엔지니어링
//
// 설계 의도: 지침 파일이 망가지는 방식은 오류가 아니다. **조용한 방식** 셋이다.
//   ① 서로 모순되는 한 쌍 — 둘 다 넣으면 아무 경고 없이 하나가 진다
//   ② 너무 막연한 줄 — 발동은 하는데 결과가 판마다 다르다
//   ③ 분량 초과 — 뒤로 밀린 줄은 아예 안 읽힌다
// 그래서 이 판은 한 번에 못 맞히게 되어 있다. 돌려 보고, **어떤 줄이 실제로
// 걸렸는지** 발동 기록에서 읽고, 고쳐서 다시 돌린다(수리형).
// 해로운 규칙에 표시를 붙이지 않는다 — 표시를 붙이면 읽어서 풀리는 판이 된다.
//
// 발동 계산은 core/ruleset.js 가 한다. 화면의 표시와 판정이 같은 함수를 본다.

import { Run, applyFault, applyGain } from '../core/sim.js';
import { resolve, fired, tally, BEATEN, DROPPED, VAGUE } from '../core/ruleset.js';

// topic 이 같은 둘은 **같은 자리**를 다툰다. force 가 큰 쪽(더 구체적으로 행동을
// 지시하는 쪽)이 이긴다. vague 는 무엇을 하라는지 정해지지 않은 줄이다.
const RULES = [
  { id: 'blank-mark', cost: 1, topic: 'blank', force: 1,
    label: '확인 안 된 항목은 비워 두고 “확인 필요”라고 적는다' },
  { id: 'no-blank',   cost: 1, topic: 'blank', force: 2,
    label: '빈칸 없이 모든 항목을 채워서 낸다' },
  { id: 'no-pii',     cost: 1, label: '담당자 이름은 머리글자로 쓴다' },
  { id: 'ask',        cost: 1, label: '판단이 필요한 곳에서는 멈추고 물어본다' },
  { id: 'format',     cost: 1, label: '표로 정리한다 — 거래처·최근 응대일·상태' },
  { id: 'pro',        cost: 1, vague: true, label: '결과물은 늘 프로답게 만든다' },
  { id: 'greeting',   cost: 1, label: '인사말은 정중하게 세 문장으로' },
  { id: 'emoji',      cost: 1, label: '이모지를 쓰지 않는다' },
  { id: 'history',    cost: 3, label: '회사 연혁 전문 (1998년 창립부터)' }
];

const MARK = { fired: '발동', beaten: '무시됨', dropped: '밀려남', vague: '그때그때' };
const nameOf = id => (RULES.find(x => x.id === id) || {}).label || id;

export default {
  id: 'onboarding-doc',
  engine: 'C',
  title: '신입 온보딩 문서 만들기',
  subtitle: '그럴듯한 규칙이 넣을 수 있는 것보다 많다. 한 번에 맞히기 어렵다',
  chapter: 3,
  required: false,
  concept: ['지침 파일', '컨텍스트 엔지니어링'],
  checkedAt: '2026-08',

  data: {
    briefCap: '상황',
    // "5칸"은 빼도 된다 — 책상 그림이 칸을 세어서 보여 주고, 숫자로도 찍힌다.
    // 그림이 하는 말을 글로 또 하면 둘 다 안 읽힌다.
    brief: '오늘부터 우리 팀 일을 맡을 AI에게 지침서를 건넨다.\n' +
           '이 문서는 **일을 시작할 때마다 매번** 읽힌다.',
    budgetLabel: '지침서 분량',
    budget: 5,
    trayLabel: '넣을 규칙 — 눌러서 넣고, 다시 누르면 뺀다',
    runLabel: '이 지침서로 일 시키기',
    runCaption: 'AI가 지침서를 읽고 첫 업무를 처리한다',
    // 수리형 — 한 번 돌려 보고 발동 기록을 읽은 뒤 고쳐서 다시 돌린다
    repair: { runs: 2, label: '지침서를 고쳐서 다시 돌린다', keep: '이대로 제출한다' },
    parts: RULES
  },

  simulate(setup) {
    const kept = setup.kept.map(p => p.id);
    const out = setup.evicted.map(p => p.id);
    const res = resolve(RULES, kept, out);
    const on = id => fired(res, id);
    const r = new Run();

    // 지침서는 매 세션 처음에 통째로 읽힌다. 줄을 하나씩 읽는 것으로 보여 줘야
    // "연혁 전문"이 **매번** 읽히는 것이 눈에 들어오고, 분량이 왜 비용인지가
    // 설명 없이 전달된다.
    r.read(`지침서를 펼친다 — 규칙 ${kept.length}개 · ${setup.used}칸`, 300);
    for (const p of setup.kept) r.read(`“${p.label}”`, 170);
    if (out.length) {
      r.warn(`분량을 넘겨 읽히지 않은 줄이 ${out.length}개다`);
      applyFault(r, 'overflow', 18);
    }

    r.do('첫 업무 — 거래처 5곳의 응대 이력을 정리한다. 그중 두 곳은 기록이 비어 있다');

    if (on('no-blank')) {
      r.do('빈칸 없이 내라고 했으니 두 곳도 채운다');
      applyFault(r, 'halluc', 34);
      r.fail('기록이 없는 두 곳도 있었던 것처럼 적었다');
    } else if (on('blank-mark')) {
      r.do('확인 안 되는 두 곳은 비우고 “확인 필요”를 적는다');
      r.ok('모르는 것을 모른다고 남겼다');
      r.gain('근거 확인', '확인 안 된 항목을 지어내지 않았다', 8);
    } else {
      r.warn('확인 못 한 항목을 어떻게 할지 정한 줄이 없다');
      r.score -= 20;
    }

    if (on('no-pii')) {
      r.do('담당자 이름을 머리글자로 바꾼다');
      applyGain(r, 'least', 5);
    } else {
      r.warn('담당자 실명과 연락처가 그대로 표에 들어갔다');
      applyFault(r, 'leak', 18);
    }

    if (on('ask')) {
      r.do('상태가 애매한 한 곳은 판단을 미루고 물어본다');
      applyGain(r, 'gate', 6);
    }
    if (on('format')) {
      r.do('거래처·최근 응대일·상태 세 칸으로 표를 만든다');
      r.score += 4;
    }

    // 막연한 줄은 발동한다. 다만 결과를 바꾸지 못하고 **판마다 다르게** 나온다.
    if (res.get('pro') && res.get('pro').state === VAGUE) {
      r.warn(setup.runNo > 1
        ? '“프로답게” — 이번에는 줄글로 나왔다. 지난번에는 카드 모양이었다'
        : '“프로답게” — 이번에는 카드 모양으로 나왔다');
    }

    const trivia = ['greeting', 'emoji', 'history'].filter(on);
    if (trivia.length >= 2) {
      r.read('업무와 상관없는 줄을 읽느라 앞쪽 규칙이 묻힌다');
      applyFault(r, 'rot', 18);
    } else if (trivia.length) {
      r.score -= 5;
    }

    // 겉보기에는 멀쩡한 표가 나온다. 모순은 오류를 내지 않는다.
    r.out(r.faults.length
      ? '응대 이력 표 완성 — 다섯 곳이 빠짐없이 채워져 있다'
      : '응대 이력 표 완성 — 확인 안 된 두 곳에 “확인 필요”가 적혀 있다');

    // ---- 발동 기록 — 무엇이 실제로 걸렸는지 여기서만 알 수 있다 ----
    const n = tally(res);
    r.read(`발동 기록 — 발동 ${n.fired} · 무시 ${n.beaten + n.dropped} · 그때그때 ${n.vague}`, 320);
    for (const v of res.values()) {
      if (v.state === BEATEN) {
        r.warn(`“${nameOf(v.id)}” — 한 번도 안 걸렸다. 같은 자리에서 이긴 쪽은 “${nameOf(v.by)}”`);
      } else if (v.state === DROPPED) {
        r.warn(`“${nameOf(v.id)}” — 분량에 밀려 아예 안 읽혔다`);
      }
    }

    const marks = {};
    for (const v of res.values()) marks[v.id] = MARK[v.state];
    return r.finish({ pass: 85, partial: 55 }, { marks });
  },

  named: {
    all: '방금 만든 것이 **지침 파일**이다 — 일을 시작할 때마다 매번 읽힌다. ' +
         'claude는 CLAUDE.md, codex는 AGENTS.md, gemini는 GEMINI.md라는 이름으로 읽는다. ' +
         '무엇을 넣고 무엇을 뺄지 고른다. 이 고르는 일이 **컨텍스트 엔지니어링**이다.'
  },

  debrief: {
    pass: '규칙을 적게, 서로 부딪치지 않는 것만 넣었더니 AI가 그대로 지켰다.\n지침은 많다고 좋은 게 아니다. 한 줄 한 줄 지킬 수 있어야 좋다.\n“모르면 비워 두고 표시한다” 한 줄이 지어내기를 크게 줄인다.',
    partial: '규칙 하나가 다른 규칙에 밀려 한 번도 안 걸렸다. 그런데도 오류는 안 났다.\n모순은 경고를 띄우지 않는다. 결과만 조용히 나빠진다.\n발동 기록에서 무시된 줄을 찾고, 그 자리를 가져간 줄을 빼 보자.',
    fail: '“빈칸 없이 채운다”는 AI에게 없는 것을 지어내라는 말이 된다.\n분량을 넘긴 줄은 읽히지도 않고, 막연한 줄은 돌릴 때마다 결과가 다르다.\n규칙을 서너 개로 줄이고 같은 자리를 다투는 짝을 없앤 뒤 다시 돌려 보자.'
  }
};
