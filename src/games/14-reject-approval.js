// 미니게임 14 — 결재 반려 (엔진 H 검토 라인형)
// 배우는 것: 워크슬롭 · AI 슬롭 · 검증 부채 · AI 번아웃
//
// 설계 의도: 워크슬롭의 정의는 "그럴듯한데 알맹이가 없는 것"이다.
// 정의를 읽는 것과, 시간에 쫓기며 실제로 걸러내 보는 것은 다르다.
// 시간 압박을 일부러 넣었다 — 워크슬롭이 통과되는 이유가 바로 그것이기 때문이다.
//
// 왜 검토 라인인가: 체크박스 + 전체 제한시간일 때는 6건을 한눈에 훑어보고
// 천천히 고를 수 있었다. 그러면 "바빠서 통과시킨다"가 재현되지 않는다.
// 서류가 창구를 하나씩 지나가고 **안 찍으면 그대로 통과되는** 형태여야
// 워크슬롭이 통과되는 실제 경로가 그대로 재현된다.
// 승인 버튼과 반려 버튼이 나란히 있는 것도 의도다 — 승인도 행동이고 책임이다.
//
// 내용(반려 기준·6건·사유)은 검증된 것을 그대로 옮겼다. 새로 지어낸 것 없음.

import { Run, applyGain } from '../core/sim.js';

export default {
  id: 'reject-approval',
  engine: 'H',
  title: '결재 반려',
  subtitle: 'AI가 만든 산출물이 창구를 지나간다. 안 찍으면 그대로 통과된다',
  chapter: 4,
  required: false,
  concept: ['워크슬롭', 'AI 슬롭', '검증 부채', 'AI 번아웃 · AI 피로'],
  checkedAt: '2026-08',

  data: {
    source: {
      cap: '반려 기준',
      body: '형식이 아니라 알맹이로 판단한다. ' +
            '① 주장에 **근거**(숫자·출처·조항)가 있는가 ② 읽는 사람이 **다음 행동**을 정할 수 있는가. ' +
            '둘 중 하나라도 없으면 반려다.'
    },

    prompt: 'AI가 만든 산출물 6건이 결재로 올라온다',
    runHint: '창구에 들어온 것만 판단할 수 있다. 지나가면 그대로 결재된 것이 된다',
    bandLabel: '검토 창구',
    lineLabel: '여기를 지나가면 그대로 다음 단계로 간다',
    runLabel: '결재 시작',
    runCaption: '결재한 대로 산출물이 다음 단계로 넘어간다',
    cardIcon: 'doc',

    travelSec: 7,
    gapSec: 2.7,
    bandFrom: 0.4,
    bandTo: 0.76,

    labels: {
      approve: '승인', reject: '반려',
      okApprove: '옳게 승인', okReject: '옳게 반려',
      badApprove: '워크슬롭을 통과시켰다', badReject: '멀쩡한 것을 반려',
      auto: '못 보고 통과'
    },

    items: [
      { id: 'r1', bad: false,
        label: '거래처 이탈 분석 — “3분기 이탈 12곳 중 9곳이 납기 지연 경험. 납기 SLA 재협상 필요.” (원본 데이터 링크 첨부)' },

      { id: 'r2', bad: true,
        label: '시장 동향 보고 — “시장은 빠르게 변화하고 있으며, 다각적 접근이 요구됩니다. 지속적인 모니터링이 중요합니다.”',
        why: '문장은 매끄러운데 숫자도 출처도 없고, 읽고 나서 할 일이 정해지지 않는다. 전형적인 워크슬롭이다.' },

      { id: 'r3', bad: false,
        label: '재고 회전율 점검 — “A품목 회전율 2.1회(작년 3.4회). 발주 주기 6주→4주 단축 제안.” (산출식 포함)' },

      { id: 'r4', bad: true,
        label: '경쟁사 분석 — “업계 관계자에 따르면 경쟁사는 내년 대규모 투자를 검토 중인 것으로 알려졌습니다.”',
        why: '“관계자에 따르면”, “알려졌습니다”는 출처가 아니다. 확인할 수 없는 문장을 근거처럼 배치한 것이다.' },

      { id: 'r5', bad: true,
        label: '고객 만족도 요약 — 표는 완벽하게 정리됐으나 응답 수·조사 시점·질문 문항이 어디에도 없다.',
        why: '형식이 완벽할수록 검토가 느슨해진다. 표본과 시점이 없으면 숫자를 해석할 수 없다.' },

      { id: 'r6', bad: false,
        label: '월간 비용 리포트 — “클라우드 비용 전월 대비 18% 증가. 원인은 로그 보관 정책 변경(4/12).” (변경 이력 첨부)' }
    ]
  },

  /**
   * setup = { okReject, okApprove, passed, wrongReject, auto, bestCombo }
   *   passed  워크슬롭을 승인 버튼으로 통과시켰다
   *   auto    창구를 지나쳐 판단 자체를 못 했다 (좋은 것도 나쁜 것도 섞인다)
   */
  simulate(setup, d) {
    const r = new Run();
    const mistakes = [];
    const find = (id) => d.items.find(i => i.id === id);
    const slop = d.items.filter(i => i.bad);

    // 못 보고 지나간 것 중 실제로 워크슬롭이었던 것
    const autoSlop = setup.auto.filter(id => find(id).bad);
    const autoFine = setup.auto.filter(id => !find(id).bad);
    const leaked = setup.passed.concat(autoSlop);

    r.read('결재 기록을 순서대로 되돌려 본다');

    for (const it of d.items) {
      if (setup.okReject.includes(it.id)) r.ok(`반려 — ${short(it.label)}`);
      else if (setup.okApprove.includes(it.id)) r.do(`승인 — ${short(it.label)}`);
      else if (setup.passed.includes(it.id)) {
        r.fail(`승인해서 넘어갔다 — ${short(it.label)}`);
        mistakes.push({ itemId: it.id, hint: it.why });
      } else if (setup.wrongReject.includes(it.id)) {
        r.warn(`멀쩡한 것을 반려했다 — ${short(it.label)}`);
        mistakes.push({ itemId: it.id, hint: '근거와 다음 행동이 다 있는 산출물이다. 반려할 이유가 없었다.' });
      } else if (setup.auto.includes(it.id)) {
        if (it.bad) {
          r.fail(`못 보고 통과 — ${short(it.label)}`);
          mistakes.push({ itemId: it.id, hint: it.why });
        } else {
          r.warn(`못 보고 통과 — ${short(it.label)} (다행히 문제 없는 건이었다)`);
        }
      }
    }

    for (const id of leaked) {
      const it = find(id);
      r.fault('워크슬롭 통과', it.why, 22);
    }
    for (const id of setup.wrongReject) {
      r.fault('과잉 반려', '근거가 있는 산출물을 반려하면 일이 되돌아온다', 10);
    }
    // 판단조차 못 한 것은 따로 짚는다 — 이게 이 판의 주제다
    if (autoSlop.length) {
      r.fault('검증 부채',
        '바빠서 못 본 것은 확인 부담이 받는 사람에게 그대로 넘어간 것이다', 0);
    }
    if (autoFine.length) {
      r.warn(`${autoFine.length}건은 보지도 않고 통과됐다 — 이번엔 문제 없는 건이었을 뿐이다`);
    }

    if (!leaked.length && !setup.wrongReject.length && !setup.auto.length) {
      applyGain(r, 'grounded', 10);
      r.gain('워크슬롭 판별', '형식이 아니라 근거와 다음 행동으로 판단했다', 6);
    } else if (setup.okReject.length) {
      r.gain('워크슬롭 판별', `${setup.okReject.length}건은 걸러냈다`, 4);
    }

    r.out(leaked.length
      ? `알맹이 없는 산출물 ${leaked.length}건이 그대로 다음 단계로 넘어갔다`
      : setup.wrongReject.length
        ? '워크슬롭은 다 걸렀지만 멀쩡한 것도 되돌아왔다'
        : `워크슬롭 ${slop.length}건을 모두 반려했다 — 근거 있는 것만 통과됐다`);

    return r.finish({ pass: 82, partial: 50 }, { mistakes });
  },

  named: {
    all: '방금 반려한 것들이 **워크슬롭**이다 — “좋은 작업물인 척하지만 일을 진전시킬 알맹이가 없는 AI 생성 결과물”. ' +
         '만든 사람은 시간을 아꼈지만 그만큼의 확인 노동이 받는 사람에게 넘어간다. 그 쌓인 부담이 **검증 부채**다.'
  },

  debrief: {
    pass: '통과시킨 것들의 공통점은 숫자·출처·다음 행동이 있다는 것이다. 반려한 것들엔 그게 없었다.\n일이 사라진 게 아니라 확인 부담이 받는 사람에게 넘어간 것 — 그래서 조사에서 정규직 40%가 최근 한 달 내 워크슬롭을 받았다고 답했다.\n내가 보낼 때도 같은 기준으로 한 번 보면 된다.',
    partial: '몇 건은 걸렀다. 놓친 것들은 대개 형식이 아주 깔끔한 쪽이었을 것이다.\n표가 잘 정리돼 있을수록 내용 확인을 건너뛰게 된다 — 이게 워크슬롭이 통과되는 경로다.\n창구를 그냥 지나가게 둔 것이 있다면 그것도 승인한 것과 같다.',
    fail: '시간에 쫓기면 형식으로 판단하게 된다. 워크슬롭이 통과되는 이유가 정확히 그것이다.\n기준은 두 개뿐이다 — 근거가 있는가, 읽고 나서 할 일이 정해지는가.\n다시 하면서 그 두 개만 보라.'
  }
};

function short(label) {
  const s = String(label).split('—')[0].trim();
  return s.length > 16 ? s.slice(0, 15) + '…' : s;
}
