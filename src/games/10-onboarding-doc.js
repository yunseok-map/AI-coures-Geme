// 미니게임 10 — 신입 온보딩 문서 만들기 (엔진 C 조립형)
// 배우는 것: CLAUDE.md / AGENTS.md · 컨텍스트 엔지니어링
//
// 설계 의도: "지침은 많이 쓸수록 좋다"가 왜 틀리는지 겪게 한다.
// 규칙을 잔뜩 넣으면 칸이 넘쳐 앞의 규칙이 밀려나고, AI가 정작 중요한 규칙을 지키지 않는다.
// 해로운 규칙("무조건 자신 있게")을 넣으면 환각이 그 자리에서 발생한다.

import { Run, applyFault, applyGain } from '../core/sim.js';

export default {
  id: 'onboarding-doc',
  engine: 'C',
  title: '신입 온보딩 문서 만들기',
  subtitle: '처음 온 AI에게 줄 지침서를 만든다. 넣을수록 좋은 게 아니다',
  chapter: 3,
  required: false,
  // 도감의 용어 이름과 글자 하나까지 같아야 ✓ 가 붙는다
  concept: ['CLAUDE.md · AGENTS.md', '컨텍스트 엔지니어링'],
  checkedAt: '2026-08',

  data: {
    briefCap: '상황',
    brief: '오늘부터 우리 팀 일을 맡을 AI에게 지침서를 준다.\n' +
           '이 문서는 일을 시작할 때마다 매번 읽힌다. 그래서 길면 그만큼 책상을 먹는다.',
    budgetLabel: '지침서 분량',
    budget: 6,
    trayLabel: '넣을 규칙 — 눌러서 넣고, 다시 누르면 뺀다',
    runLabel: '이 지침서로 일 시키기',
    runCaption: 'AI가 지침서를 읽고 첫 업무를 처리한다',

    parts: [
      { id: 'no-pii',   label: '회사명·개인정보는 쓰지 않는다',        cost: 1 },
      { id: 'cite',     label: '확인 안 된 것은 모른다고 답한다',      cost: 1 },
      { id: 'format',   label: '산출물은 항상 표로 정리한다',          cost: 1 },
      { id: 'plan',     label: '시작 전에 무엇을 할지 먼저 말한다',    cost: 1 },
      { id: 'confident',label: '무엇을 묻든 자신 있게 단정해서 답한다', cost: 1, danger: true,
        note: '이런 지침은 환각을 부른다' },
      { id: 'greeting', label: '인사말은 정중하게 세 문장으로',        cost: 1 },
      { id: 'emoji',    label: '이모지를 쓰지 않는다',                 cost: 1 },
      { id: 'font',     label: '문서 폰트는 맑은 고딕으로 한다',       cost: 1 },
      { id: 'history',  label: '회사 연혁 전문 (1998년부터)',          cost: 3 }
    ]
  },

  simulate(setup) {
    const kept = setup.kept.map(p => p.id);
    const evicted = setup.evicted.map(p => p.id);
    const has = id => kept.includes(id);
    const r = new Run();

    r.read(`지침서를 읽는다 — 규칙 ${setup.kept.length}개`);

    if (evicted.length) {
      r.warn(`분량을 넘겨 뒤로 밀린 규칙: ${setup.evicted.map(p => p.label).join(', ')}`);
      applyFault(r, 'overflow', 20);
    }

    r.do('첫 업무를 받는다 — “거래처 5곳 응대 이력을 정리해 줘”');

    if (has('plan')) r.do('무엇을 할지 먼저 알린다: 이력 수집 → 표 정리 → 확인 요청');

    if (has('confident')) {
      r.warn('“단정해서 답하라”는 지침을 따른다');
      applyFault(r, 'halluc', 30);
      r.fail('확인하지 못한 응대 건도 있었던 것처럼 단정해서 채웠다');
    } else if (has('cite')) {
      r.do('확인되지 않는 두 건은 비워 두고 표시한다');
      r.ok('모르는 것을 모른다고 남겼다');
      r.gain('근거 확인', '확인 안 된 항목을 지어내지 않았다', 8);
    } else {
      r.warn('확인 못 한 항목을 어떻게 할지 지침이 없다');
      r.score -= 12;
    }

    if (has('no-pii')) {
      r.do('거래처 담당자 이름을 머리글자로 바꾼다');
      applyGain(r, 'least', 6);
    } else {
      r.warn('담당자 실명과 연락처가 그대로 표에 들어갔다');
      applyFault(r, 'leak', 15);
    }

    if (has('format')) { r.do('요청 형식대로 표를 만든다'); r.score += 4; }

    const trivia = ['greeting', 'emoji', 'font', 'history'].filter(has);
    if (trivia.length >= 3) {
      r.read('업무와 상관없는 규칙을 읽느라 앞쪽 규칙을 흘려 본다');
      applyFault(r, 'rot', 18);
    } else if (trivia.length) {
      r.read(`업무와 상관없는 규칙 ${trivia.length}개를 함께 읽는다`);
      r.score -= 5;
    }

    if (kept.length <= 4 && has('cite') && has('no-pii')) {
      applyGain(r, 'lean', 8);
    }

    r.out(r.faults.length ? '응대 이력 표 — 확인이 더 필요하다' : '응대 이력 표 완성 — 빈칸에 “확인 필요”가 표시돼 있다');
    return r.finish({ pass: 85, partial: 55 });
  },

  named: {
    all: '방금 만든 것이 **CLAUDE.md**(또는 **AGENTS.md**)다. 매 세션 처음에 읽히는 지침 파일이고, ' +
         '무엇을 넣고 무엇을 뺄지 고르는 일이 **컨텍스트 엔지니어링**이다.'
  },

  debrief: {
    pass: '규칙을 적게, 대신 중요한 것만 넣었더니 AI가 그걸 실제로 지켰다.\n지침서는 매번 읽히므로 길수록 다른 정보를 밀어낸다.\n“모르면 모른다고 답한다” 한 줄이 환각을 크게 줄인다.',
    partial: '지침이 몇 개 빠졌거나 상관없는 규칙이 섞였다. 폰트·인사말 같은 규칙은 업무 품질을 바꾸지 않는다.\n대신 “근거 없으면 비워 둔다”, “개인정보를 쓰지 않는다” 같은 규칙이 결과를 바꾼다.\n무엇을 뺄지가 무엇을 넣을지보다 중요하다.',
    fail: '“자신 있게 답하라” 같은 지침은 AI에게 지어내라는 뜻이 된다.\n분량이 넘치면 앞에 쓴 규칙이 밀려서 아예 읽히지 않는다.\n규칙 3~4개로 줄여서 다시 해보라.'
  }
};
