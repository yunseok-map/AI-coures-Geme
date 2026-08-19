// 미니게임 1 — 가방 싸기 (엔진 C 조립형 / 회차형)
// 배우는 것: 토큰 · 컨텍스트 윈도우 · 컨텍스트 로트
//
// 설계 의도: 이 개념의 성질은 **조용히 사라진다**는 것이다. 그래서 자료를 한 번에
// 주지 않고 회차마다 들여보낸다. 칸이 넘치면 오래된 것이 아무 말 없이 흐려지고,
// 흐려진 자료를 나중에 꺼내 쓰면 **틀린 값**이 되어 있다. 셋을 하나로 접어 칸을
// 벌 수 있지만 그때마다 안에 있던 세부 하나가 영구히 사라진다 — 무엇이 사라졌는지는
// 그때 안 알려 준다. 마감에 하필 그것을 물어본다.
//
// 규칙 계산은 전부 core/bag.js 가 한다. 화면과 판정이 같은 함수를 봐야 한다.

import { Run, applyFault, applyGain } from '../core/sim.js';
import { look } from '../core/bag.js';

/** 마감에 물어보는 것 — 이 넷이 이 판의 판정 전부다 */
const NEED = [
  ['sep',   '9월 하락폭'],
  ['base',  '지난 분기와의 차이'],
  ['churn', '거래처가 떠난 이유'],
  ['ret',   '반품 사유 1위']
];

export default {
  id: 'context-bag',
  engine: 'C',
  title: '가방 싸기',
  subtitle: 'AI의 책상은 8칸. 자료는 회차마다 계속 들어온다',
  chapter: 1,
  required: true,
  concept: ['토큰', '컨텍스트 윈도우', '컨텍스트 로트'],
  checkedAt: '2026-08',

  data: {
    briefCap: '이번 주 할 일',
    // 한 줄이다. 이 자리에 규칙을 다 적으면 아무도 안 읽고, 안 읽으면
    // 아래 [지금 할 일] 한 줄까지 같이 흘려보낸다.
    brief: '“이번 분기 매출이 왜 떨어졌는지 보고서를 써 주세요.”',
    budgetLabel: 'AI의 책상',
    budgetUnit: '한 칸이 대략 1,000토큰',
    // 8칸이다. 마감에 필요한 넷이 딱 8칸이라서, **잘 골라내면 정확히 들어맞는다.**
    // 6칸이던 때는 넷을 다 남기는 것이 산수로 불가능해서, 무엇을 골라도
    // 반드시 하나는 잃었다 — 판단을 가르치는 판인데 판단이 결과를 못 바꿨다.
    // (전수 조사: 10,738가지 중 통과가 58가지, 0.5%)
    // 지금은 잡음 셋을 알아보고 내린 사람만 100점으로 통과한다.
    budget: 8,
    dropLabel: '내리기',
    nextLabel: '다음 회차',
    runLabel: '보고서 쓰기',
    runCaption: 'AI가 책상 위의 것만 보고 쓴다',
    fold: { label: '셋을 하나로', made: '요약본', pickTag: '선택' },

    // 회차가 바뀌면 자료가 스스로 들어온다. 들어오는 **순서**가 곧 오래된 순서이고,
    // 접을 때 무엇이 사라지는지도 이 순서가 정한다.
    rounds: [
      // note 는 **그 회차에만 해당하는 사실 한 조각**이다. 조작 설명은 여기 안 쓴다 —
      // 그건 [지금 할 일] 줄이 하고, 두 곳에 쓰면 서로 다른 말을 하게 된다.
      //
      // 여기에 "넘치면 흐려진다"를 적으면 안 된다. 그게 이 판이 가르치는 것이고,
      // 미리 적는 순간 겪을 것이 없어진다(`_tests/test-bag.mjs` 가 막는다).
      // 알려 줘도 되는 것은 **셈**뿐이다 — 몇 칸이 들어오고 몇 칸이 남았는가.
      // 그건 화면의 빗금 친 칸과 [지금 할 일] 줄이 이미 하고 있다.
      { cap: '1회차 · 월요일',
        note: '무엇을 물어볼지는 마감에 가서 정해진다',
        arrive: ['q3', 'notice', 'q2'] },
      { cap: '2회차 · 수요일',
        note: '다음 회차에도 자료는 들어온다',
        arrive: ['memo', 'board'] },
      { cap: '3회차 · 금요일',
        note: '',
        arrive: ['voc', 'rival'] },
      { cap: '마감 · 다음 주 월요일',
        note: '책상에 남은 것만으로 쓴다',
        askCap: '마감 — 이제 무엇을 물어볼지 정해졌다',
        ask: '“3줄로 정리해 주세요 — 9월 하락폭, 지난 분기와의 차이, ' +
             '거래처가 떠난 이유, 반품 사유 1위.”',
        arrive: [] }
    ],

    // details 는 그 자료 안에 든 세부다. value 는 맞는 값, wrong 은 흐려진 뒤에
    // 읽히는 값이다. AI는 둘을 구별하지 못한 채 wrong 을 자신 있게 적는다.
    parts: [
      { id: 'q3', label: '이번 분기 매출표', cost: 2, details: [
        { id: 'sep', label: '9월 하락폭',
          value: '9월 매출이 18% 떨어졌다', wrong: '9월 매출은 거의 그대로였다' } ] },
      { id: 'notice', label: '창립기념일 안내 메일', cost: 1, details: [
        { id: 'party', label: '행사 날짜',
          value: '행사는 다음 달 둘째 주다', wrong: '행사는 이번 주다' } ] },
      { id: 'q2', label: '지난 분기 매출표', cost: 2, details: [
        { id: 'base', label: '지난 분기와의 차이',
          value: '지난 분기보다 12% 낮다', wrong: '지난 분기보다 2% 높다' } ] },
      { id: 'memo', label: '영업팀 주간 메모 30건', cost: 2, details: [
        { id: 'churn', label: '거래처가 떠난 이유',
          value: '납기가 밀려 세 곳이 떠났다', wrong: '값이 비싸서 세 곳이 떠났다' } ] },
      { id: 'board', label: '전사 공지 모음', cost: 1, details: [
        { id: 'dress', label: '복장 규정 변경',
          value: '다음 달부터 자율 복장이다', wrong: '이번 달부터 자율 복장이다' } ] },
      { id: 'voc', label: '고객 문의 모음', cost: 2, details: [
        { id: 'ret', label: '반품 사유 1위',
          value: '반품 사유 1위는 배송 파손이다', wrong: '반품 사유 1위는 색상 불만이다' } ] },
      { id: 'rival', label: '경쟁사 가격 변동 요약', cost: 1, details: [
        { id: 'cut', label: '경쟁사가 값을 내린 시점',
          value: '지난달 초에 값을 내렸다', wrong: '이번 달에 값을 내렸다' } ] }
    ]
  },

  simulate(setup) {
    const desk = setup.desk;
    const r = new Run();

    const shelf = setup.kept.map(p => p.label);
    r.read(`책상 위의 것만 보고 쓴다 — ${shelf.join(', ') || '아무것도 없다'}`, 320);

    // 넷을 하나씩 찾아본다. AI는 흐려진 값과 맞는 값을 **구별하지 못한다** —
    // 그래서 wrong 을 의심 없이 그대로 적는다. 그 태연함이 이 판의 임팩트다.
    const seen = [];
    let wrong = 0, gone = 0, blank = 0;
    for (const [id, ask] of NEED) {
      const hit = look(desk, id);
      seen.push([ask, hit]);
      if (hit.state === 'ok') r.do(`${ask} — ${hit.detail.value}`);
      else if (hit.state === 'wrong') { r.do(`${ask} — ${hit.detail.wrong}`); wrong++; }
      else if (hit.state === 'folded') {
        r.do(`${ask} — 요약본에 그 줄이 없다. 앞뒤에 맞춰 채운다`); gone++;
      } else { r.warn(`${ask} — 받은 자료에 없다. 비워 둔다`); blank++; }
    }

    // 빈 곳 없이 채워진 보고서가 나온다. 겉만 보면 잘된 결과물이라는 것이 요점이다.
    r.out(wrong + gone + blank === 0
      ? '3줄 요약 완성 — 네 가지가 다 자료에서 나왔다'
      : '3줄 요약 완성 — 빈 곳 없이 채워져 있다');

    // 값을 지어내거나 틀리게 적는 쪽이 비워 두는 쪽보다 비싸다 — 읽는 사람을
    // 속이기 때문이다. 그중에서도 **내가 접어 놓고 사라진 줄 모른 것**이 가장 비싸다.
    if (setup.evicted.length) applyFault(r, 'overflow', 12);
    for (let i = 0; i < wrong; i++) applyFault(r, 'halluc', 24);
    for (let i = 0; i < gone; i++) applyFault(r, 'rot', 28);
    r.score -= blank * 14;

    // ---- 되짚기 — 무엇을 언제 잃었는지 여기서 처음 밝힌다 ----
    r.read('되짚기 — 무엇을 언제 잃었나', 320);
    for (const [ask, hit] of seen) {
      if (hit.state === 'wrong') {
        r.fail(`${ask} — ${hit.at}회차에 흐려졌다. 맞는 값은 “${hit.detail.value}”`);
      } else if (hit.state === 'folded') {
        r.fail(`${ask} — ${hit.at}회차에 요약하면서 사라졌다`);
      } else if (hit.state !== 'ok') {
        r.read(`${ask} — ${hit.at ? hit.at + '회차에 ' : ''}내가 내렸다`);
      }
    }
    const asked = new Set(NEED.map(x => x[0]));
    for (const f of desk.log.filter(x => x.kind === 'fold' && x.lost && !asked.has(x.lost)).slice(0, 2)) {
      r.read(`${f.round}회차 요약에서도 하나가 사라졌다 — ${f.lostLabel}`);
    }

    if (!setup.evicted.length) applyGain(r, 'lean', 10);
    if (wrong + gone + blank === 0) {
      r.ok('네 줄 다 자료를 짚을 수 있다');
      r.gain('근거 확인', '마감에 필요한 것이 하나도 상하지 않았다', 8);
    }

    return r.finish({ pass: 85, partial: 55 });
  },

  named: {
    pass: '책상에 둔 자료가 나도 모르게 상한다. 이걸 **컨텍스트 로트**라고 부른다. ' +
          '책상 크기가 **컨텍스트 윈도우**, 그 칸을 세는 단위가 **토큰**이다. ' +
          '셋을 하나로 접은 것은 **컨텍스트 압축**이다.',
    partial: '방금 자료가 소리 없이 상했다. 이게 **컨텍스트 로트**다. ' +
             '책상 크기가 **컨텍스트 윈도우**, 그 칸을 세는 단위가 **토큰**이다.',
    fail: '아무 말 없이 흐려진다. 이게 **컨텍스트 로트**다. ' +
          '자료가 흐려진 건 **컨텍스트 윈도우**를 넘겼기 때문이다. ' +
          '그 칸을 세는 단위가 **토큰**이다.'
  },

  debrief: {
    pass: '회차마다 미리 접거나 내린 덕에 마감에 필요한 넷이 다 남았다.\n요약은 처음과 끝을 남기고 가운데를 흘린다. 이번에 흘린 건 안 쓰는 자료였다.\n실무에서도 “다 넣기”가 아니라 “무엇을 버릴지”가 정확도를 만든다.',
    partial: '필요한 것 하나가 없거나 상해 있었다. AI는 없다고 말하지 않고 그럴듯하게 채운다.\n요약은 처음과 끝을 남기고 가운데를 흘린다. 무엇이 사라졌는지는 그때 안 알려 준다.\n무엇을 접고 무엇을 내릴지 바꿔서 다시 해 보자.',
    fail: '책상이 넘쳐 오래된 자료가 소리 없이 흐려졌고, AI는 그걸 모른 채 틀린 값을 적었다.\n실무에서 “분명히 파일 줬는데 왜 딴소리를 하지?” 하는 일이 이래서 생긴다.\n회차가 끝날 때마다 칸을 미리 비워 두면 흐려지지 않는다.'
  }
};
