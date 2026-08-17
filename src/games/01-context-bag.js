// 미니게임 1 — 가방 싸기 (엔진 C 조립형)
// 배우는 것: 토큰 · 컨텍스트 윈도우 · 컨텍스트 로트
//
// 설계 의도: "많이 넣으면 좋다"는 직관이 틀렸다는 걸 말로 설명하지 않는다.
// 칸이 넘치는 순간 먼저 넣은 자료가 회색으로 밀려나는 걸 눈으로 보게 하고,
// 실행했을 때 AI가 바로 그 자료를 못 봐서 틀린 답을 내놓는 걸 겪게 한다.

import { Run, applyFault, applyGain } from '../core/sim.js';

const KEY = ['sales-now', 'sales-prev'];
const NOISE = ['weekly-memo', 'anniversary', 'mail-archive'];

export default {
  id: 'context-bag',
  engine: 'C',
  title: '가방 싸기',
  subtitle: 'AI에게 일을 시키기 전에, 무엇을 들려 보낼지 고른다',
  chapter: 1,
  required: true,
  concept: ['토큰', '컨텍스트 윈도우', '컨텍스트 로트'],
  checkedAt: '2026-08',

  data: {
    briefCap: '오늘의 요청',
    brief: '“이번 분기 매출이 왜 떨어졌는지 3줄로 정리해줘.”\n' +
           'AI의 책상은 6칸뿐이다. 넘치면 먼저 올려둔 것이 밀려난다.',
    budgetLabel: 'AI의 책상',
    budget: 6,
    trayLabel: '들려 보낼 자료 — 눌러서 올리고, 다시 누르면 내린다',
    runLabel: '이대로 시켜 본다',
    runCaption: 'AI가 책상 위의 것만 보고 일한다',

    parts: [
      { id: 'sales-now',   label: '이번 분기 매출표',      cost: 2 },
      { id: 'sales-prev',  label: '지난 분기 매출표',      cost: 2 },
      { id: 'format',      label: '원하는 답 형식 예시',   cost: 1 },
      { id: 'competitor',  label: '경쟁사 가격 변동 요약', cost: 2 },
      { id: 'weekly-memo', label: '영업팀 주간 메모 30건', cost: 4 },
      { id: 'anniversary', label: '창립기념일 안내 메일',  cost: 1 },
      { id: 'mail-archive',label: '전사 메일 보관함',      cost: 5 }
    ]
  },

  simulate(setup) {
    const kept = setup.kept.map(p => p.id);
    const evicted = setup.evicted.map(p => p.id);
    const has = id => kept.includes(id);
    const r = new Run();

    r.read(`책상에 올라온 것: ${setup.kept.map(p => p.label).join(', ') || '없음'}`);

    if (evicted.length) {
      r.warn(`칸이 모자라 밀려난 것: ${setup.evicted.map(p => p.label).join(', ')}`);
    }

    // 밀려난 자료가 핵심이면 그 자리에서 결과가 무너진다
    const lostKey = evicted.filter(id => KEY.includes(id));
    if (lostKey.length) {
      r.fail('밀려난 매출표를 찾지 못한다');
      applyFault(r, 'overflow', 30);
    }

    if (has('sales-now') && has('sales-prev')) {
      r.do('두 분기 매출표를 나란히 놓고 차이를 계산한다');
      r.ok('감소 구간을 찾았다');
    } else if (has('sales-now') || has('sales-prev')) {
      r.do('한쪽 분기 자료만으로 추세를 추정한다');
      r.warn('비교할 대상이 없다');
      applyFault(r, 'halluc', 25);
      r.fail('“전년 대비 하락”이라고 썼지만 확인한 자료가 없다');
    } else {
      r.warn('매출 자료가 없다');
      applyFault(r, 'halluc', 35);
      r.fail('그럴듯한 숫자를 지어내 채웠다');
    }

    const noise = kept.filter(id => NOISE.includes(id));
    if (noise.length >= 2) {
      r.read('관련 없는 문서를 훑느라 중간에 있는 내용을 지나친다');
      applyFault(r, 'rot', 20);
    } else if (noise.length === 1) {
      r.read('관련 없는 문서가 하나 섞여 있다');
      r.score -= 6;
    }

    if (has('competitor') && has('sales-now')) {
      r.do('경쟁사 가격 변동과 시점을 맞춰 본다');
      r.gain('근거 있는 원인', '숫자 변화에 짚을 이유를 찾았다', 6);
    }

    // 형식 예시를 넣은 것과 잡음 없이 담은 것은 **다른** 잘한 점이다.
    // 둘 다 'lean'(컨텍스트 엔지니어링)으로 적었더니 결과 화면에 똑같은 줄이
    // 두 개 떴다 — 같은 문장이 반복되는 화면은 그 자체로 워크슬롭이다.
    if (has('format')) {
      r.do('요청한 형식에 맞춰 정리한다');
      r.gain('형식 지정', '원하는 모양을 예시로 보여 줘서 다시 시킬 일이 없었다', 4);
    }

    if (kept.length && noise.length === 0 && setup.used <= setup.cap) {
      applyGain(r, 'lean', 6);
    }

    r.out(r.faults.length ? '3줄 요약 — 근거가 비어 있다' : '3줄 요약 완성 — 각 줄에 근거 자료가 붙어 있다');
    return r.finish({ pass: 85, partial: 55 });
  },

  named: {
    pass: 'AI의 책상 크기가 **컨텍스트 윈도우**다. 필요한 것만 골라 올린 것이 **컨텍스트 엔지니어링**이다.',
    partial: 'AI의 책상 크기를 **컨텍스트 윈도우**라고 한다. 방금 그 위에서 자료가 밀리고 섞이는 걸 봤다.',
    fail: '넣을수록 나빠지는 이 현상에 이름이 있다 — **컨텍스트 로트**. 자료가 밀려난 것은 **컨텍스트 초과**다.'
  },

  debrief: {
    pass: '핵심 자료만 올려서 AI가 근거를 갖고 답했다. 자료를 고르는 일이 곧 정확도다.\n칸이 남았다고 더 채울 필요는 없다. 넣을수록 가운데 있는 정보를 놓친다.\n실제 업무에서도 “관련 자료 다 넣기”보다 “관련된 3개만”이 낫다.',
    partial: '자료가 부족하거나 잡음이 섞였다. AI는 없는 것을 지어내서라도 답을 채운다.\n비교하는 질문에는 비교 대상이 반드시 함께 있어야 한다.\n다시 해보면서 무엇이 꼭 필요한지 골라 보라.',
    fail: '책상이 넘쳐서 먼저 올린 자료가 밀려났고, AI는 그걸 못 본 채로 답을 지어냈다.\n이게 실무에서 “분명히 파일 줬는데 왜 딴소리를 하지?”의 정체다.\n칸 수를 보면서 다시 담아 보라.'
  }
};
