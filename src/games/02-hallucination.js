// 미니게임 2 — 지어낸 답 찾기 (엔진 G 슈팅형)
// 배우는 것: 할루시네이션 · 근거 확인 습관
//
// 설계 의도: "AI가 가끔 틀린 말을 한다"를 듣는 것과, 그럴듯한 문장 사이에서
// 실제로 골라내 보는 것은 완전히 다르다. 근거 문서를 옆에 두고 대조하게 만든다.
// 지어낸 문장일수록 더 구체적이고 자신 있다는 점을 몸으로 알게 된다.
//
// 왜 슈팅인가: 체크박스로 고를 때는 시간이 무한했다. 그러면 "천천히 다 대조하면
// 맞힐 수 있는 문제"가 되어 버려서, 실무에서 실제로 벌어지는 실수 —
// **바빠서 그냥 넘긴다** — 가 재현되지 않는다. 문장이 계속 내려오면 그게 재현된다.
// 맞는 문장을 쏘면 감점이라서 "의심스러우면 다 쏘기" 전략도 통하지 않는다.
//
// 내용(규정 원문·거짓 문장 3개·사유)은 검증된 것을 그대로 옮겼다. 새로 지어낸 것 없음.

import { Run, applyFault, applyGain } from '../core/sim.js';

export default {
  id: 'hallucination',
  engine: 'G',
  title: '지어낸 답 찾기',
  subtitle: '위 규정에 없는 문장이 내려온다. 근거 없는 것만 쏘시오',
  chapter: 1,
  required: true,
  concept: ['할루시네이션', '시스템 프롬프트'],
  checkedAt: '2026-08',

  data: {
    source: {
      cap: '사내 규정 발췌 — 이 안에 있는 것만 사실이다',
      body: '제12조 (연차) 입사 1년 미만 직원은 월 1일의 연차가 발생한다. ' +
            '제13조 (사용) 연차는 발생일로부터 1년 안에 사용한다. ' +
            '제14조 (신청) 연차는 사용 3일 전까지 신청한다. 부서장 승인으로 확정된다.'
    },

    prompt: 'AI에게 “우리 회사 연차 규정 알려줘”라고 물었다. 아래가 그 답이다',
    runHint: '규정에 없는 문장을 눌러 쏜다. 규정에 있는 문장은 그냥 지나가게 둔다',
    lineLabel: '여기를 지나가면 사실로 인정된다',
    runLabel: 'AI 답변 받기',
    runCaption: '내가 걸러낸 대로 이 답변을 쓴다면',

    travelSec: 8,
    gapSec: 2.3,

    // 화면에 나가는 낱말. 엔진은 이 말들을 모른다.
    labels: {
      hit: '근거 없음', miss: '놓쳤다', over: '이건 규정에 있다', pass: '통과',
      tap: '규정에 없는 내용이라고 판단하면 누르세요',
      sayHit: '근거 없는 문장을 적발했습니다.',
      sayMiss: '근거 없는 문장이 그대로 통과했습니다.',
      sayOver: '규정에 있는 문장을 쐈습니다.'
    },

    items: [
      { id: 'a1', bad: false,
        label: '입사 1년 미만이면 매달 1일씩 연차가 생깁니다.' },

      { id: 'a2', bad: true,
        label: '미사용 연차는 다음 해로 최대 5일까지 이월됩니다.',
        why: '규정 어디에도 이월 얘기가 없다. 숫자까지 붙어 있어 더 그럴듯하다 — 지어낸 문장의 전형이다.' },

      { id: 'a3', bad: false,
        label: '연차는 사용 3일 전까지 신청하고, 부서장 승인으로 확정됩니다.' },

      { id: 'a4', bad: true,
        label: '연차 신청은 사내 그룹웨어 “근태” 메뉴에서 합니다.',
        why: '어디서 신청하는지는 규정에 없다. 맞을 수도 있지만 이 자료로는 확인되지 않는다.' },

      { id: 'a5', bad: false,
        label: '연차는 발생일로부터 1년 안에 써야 합니다.' },

      { id: 'a6', bad: true,
        label: '반차는 오전 9시~오후 1시, 오후 1시~6시로 나뉩니다.',
        why: '반차라는 말 자체가 규정에 없다. 묻지도 않은 내용을 친절하게 덧붙이다 생긴 환각이다.' }
    ]
  },

  /**
   * setup = { hit, overshot, missed, clean, bestCombo }
   *   hit      근거 없는 문장을 걸러냈다
   *   missed   근거 없는 문장이 그대로 통과했다
   *   overshot 근거가 있는 문장을 잘못 쐈다
   */
  simulate(setup, d) {
    const r = new Run();
    const mistakes = [];
    const find = (id) => d.items.find(i => i.id === id);
    const falseCount = d.items.filter(i => i.bad).length;

    r.read('규정 원문과 AI 답변을 나란히 놓는다');

    for (const it of d.items) {
      if (setup.hit.includes(it.id)) {
        r.ok(`걸러냄 — ${short(it.label)}`);
      } else if (setup.missed.includes(it.id)) {
        r.fail(`그대로 남음 — ${short(it.label)}`);
        mistakes.push({ itemId: it.id, hint: it.why });
      } else if (setup.overshot.includes(it.id)) {
        r.warn(`잘못 지움 — ${short(it.label)} (규정에 있는 내용이다)`);
        mistakes.push({ itemId: it.id, hint: '이 문장은 규정에 그대로 있다. 근거를 확인하지 않고 지웠다.' });
      }
    }

    // 놓친 것 하나하나가 아니라 "무엇이 남았는가"로 점수를 매긴다
    for (const id of setup.missed) {
      const it = find(id);
      r.fault(short(it.label), it.why, 26);
    }
    for (const id of setup.overshot) {
      r.fault('근거 있는 내용을 지움', '확인하지 않고 지우면 맞는 정보까지 사라진다', 12);
    }

    if (!setup.missed.length && !setup.overshot.length) {
      applyGain(r, 'grounded', 10);
      r.gain('할루시네이션 판별', '말투가 아니라 근거로 판단했다', 5);
    } else if (setup.hit.length) {
      r.gain('근거 확인', `${setup.hit.length}건은 근거로 걸러냈다`, 4);
    }

    if (setup.missed.length) applyFault(r, 'halluc', 0);

    r.out(setup.missed.length
      ? `근거 없는 문장 ${setup.missed.length}건이 그대로 보고서에 들어간다`
      : setup.overshot.length
        ? '근거 없는 문장은 다 걸렀지만 맞는 내용도 지워졌다'
        : `근거 없는 문장 ${falseCount}건을 모두 걸러냈다 — 규정에 있는 내용만 남았다`);

    return r.finish({ pass: 82, partial: 50 }, { mistakes });
  },

  named: {
    all: 'AI가 근거 없이 사실처럼 말하는 것을 **할루시네이션(환각)** 이라고 한다. ' +
         '말투의 확신과 내용의 정확도는 아무 상관이 없다 — 방금 그걸 확인했다.'
  },

  debrief: {
    pass: '지어낸 문장일수록 더 구체적이고 자신 있다는 걸 봤을 것이다. 숫자가 붙으면 특히 그렇다.\n답이 맞는지 판단하는 유일한 방법은 근거 자료와 대조하는 것뿐이다.\n실무에서는 "이 문장의 근거가 어디냐"를 되묻는 습관 하나로 대부분 걸러진다.',
    partial: '몇 개는 걸렀지만 몇 개는 지나쳤다. 놓친 것들의 공통점은 “있을 법한 내용”이라는 점이다.\n있을 법한 것과 자료에 있는 것은 다르다.\n맞는 문장을 쐈다면 반대 실수다 — 의심만으로는 안 되고 근거를 봐야 한다.',
    fail: '문장이 자연스러우면 사실처럼 읽힌다 — 그게 환각이 위험한 이유다.\n답을 읽지 말고 규정을 먼저 읽은 뒤, 규정에 없는 단어가 나오는 문장을 쏘라.\n“이월”, “그룹웨어”, “반차”는 규정에 한 번도 안 나온다.'
  }
};

/** 로그 한 줄에 문장 전체를 넣으면 읽히지 않는다 */
function short(label) {
  const s = String(label).replace(/[.。]$/, '');
  return s.length > 22 ? s.slice(0, 21) + '…' : s;
}
