// 미니게임 12 — 자동화 라인 (엔진 D 배치형)
// 배우는 것: 에이전트 루프 · 휴먼 인 더 루프 · 휴먼 온 더 루프
//
// 설계 의도: "사람 확인을 넣어야 한다"는 말은 쉽다. 어려운 건 **어디에** 넣느냐다.
// 확인을 다 넣으면 자동화한 의미가 없어지고, 안 넣으면 되돌릴 수 없는 사고가 난다.
// 되돌릴 수 있는 단계와 없는 단계가 다르다는 걸 배치로 겪게 한다.

import { Run, applyFault, applyGain } from '../core/sim.js';

export default {
  id: 'auto-line',
  engine: 'D',
  title: '자동화 라인',
  subtitle: '반복 업무를 자동으로 흐르게 만든다. 사람 확인을 어디에 둘지 정한다',
  chapter: 3,
  required: false,
  concept: ['에이전트 루프', '휴먼 인 더 루프', '휴먼 온 더 루프', '검증 루프'],
  checkedAt: '2026-08',

  data: {
    briefCap: '자동화할 업무',
    brief: '매주 반복되는 일이다 — 문의 메일 수집 → 유형 분류 → 답변 초안 작성 → 고객에게 발송.\n' +
           '발송은 되돌릴 수 없다. 앞 단계들은 다시 하면 된다.',
    lanes: 1,
    ticks: 8,
    laneNames: ['처리 순서'],
    trayLabel: '단계와 확인 지점 — 눌러서 집고, 칸을 눌러 놓는다',
    runLabel: '이 라인으로 돌리기',
    runCaption: '한 주 분량이 라인을 따라 흐른다',

    jobs: [
      { id: 'collect', label: '메일 수집', dur: 1 },
      { id: 'classify', label: '유형 분류', dur: 1 },
      { id: 'draft', label: '답변 초안', dur: 2 },
      { id: 'send', label: '고객 발송', dur: 1 }
    ],
    gates: [
      { id: 'check1', label: '사람 확인', dur: 1 },
      { id: 'check2', label: '사람 확인', dur: 1 }
    ]
  },

  simulate(setup) {
    const r = new Run();
    const at = id => setup.plan.find(p => p.item.id === id);
    const order = setup.plan.slice().sort((a, b) => a.tick - b.tick);

    const collect = at('collect'), classify = at('classify');
    const draft = at('draft'), send = at('send');
    const gates = setup.plan.filter(p => p.kind === 'gate');

    r.read(`라인에 놓인 단계 ${setup.plan.length}개를 확인한다`);

    // 순서가 맞는가
    const seq = [collect, classify, draft, send].filter(Boolean);
    const missing = 4 - seq.length;
    if (missing) {
      r.warn(`빠진 단계 ${missing}개 — 놓지 않은 단계는 실행되지 않는다`);
      r.fault('빠진 단계', '라인에 없는 일은 아무도 하지 않는다', 15 * missing);
    }

    const wrongOrder = seq.some((p, i) => i > 0 && p.tick < seq[i - 1].tick);
    if (wrongOrder) {
      r.warn('앞 단계가 끝나기 전에 뒷 단계가 시작된다');
      r.fault('순서 뒤바뀜', '분류 전에 초안을 쓰면 엉뚱한 답변이 나간다', 20);
    }

    for (const p of order) {
      if (p.kind === 'gate') r.do(`${p.tick + 1}칸 — 사람이 확인한다`);
      else r.do(`${p.tick + 1}칸 — ${p.item.label}`);
    }

    // 되돌릴 수 없는 단계 앞에 확인이 있는가
    if (send) {
      const gateBefore = gates.some(g => g.tick < send.tick);
      if (gateBefore) {
        r.ok('발송 직전에 사람이 한 번 걸러냈다');
        applyGain(r, 'gate', 14);
        const wrong = 2;
        r.do(`오분류 ${wrong}건을 사람이 잡아 되돌렸다`);
      } else {
        r.warn('아무도 확인하지 않고 발송 단계로 넘어간다');
        applyFault(r, 'nogate', 30);
        r.fail('잘못 분류된 답변이 고객에게 그대로 나갔다 — 되돌릴 수 없다');
      }
    }

    // 확인이 너무 많으면 자동화의 의미가 없다
    if (gates.length >= 2) {
      const early = gates.filter(g => send && g.tick < send.tick - 2).length;
      if (early >= 1) {
        r.warn('되돌릴 수 있는 단계 앞에도 확인이 걸려 있다');
        r.fault('확인 과다', '매 단계 확인하면 자동화한 의미가 없고, 사람이 무심코 통과시키게 된다', 15);
      }
    }

    if (gates.length === 1 && send && gates[0].tick === send.tick - 1) {
      r.gain('휴먼 온 더 루프', '되돌릴 수 없는 지점 하나에만 사람을 두고 나머지는 맡겼다', 10);
    }

    r.out(r.faults.length
      ? '주간 문의 처리 — 사고가 함께 기록됐다'
      : '주간 문의 처리 완료 — 사람이 확인한 건은 발송 직전 1회');

    return r.finish({ pass: 85, partial: 55 });
  },

  named: {
    all: '자동으로 도는 과정 중 사람 승인을 두는 지점이 **휴먼 인 더 루프**다. ' +
         '매 건이 아니라 “울타리 안에서는 알아서, 사람은 감독자”로 물러난 형태를 **휴먼 온 더 루프**라 한다. ' +
         '되돌릴 수 없는 행동 앞에만 두는 것이 요령이다.'
  },

  debrief: {
    pass: '되돌릴 수 있는 단계는 맡기고, 되돌릴 수 없는 발송 앞에만 사람을 뒀다. 그게 정답에 가깝다.\n확인 지점은 많을수록 안전한 게 아니라, 많을수록 무뎌진다.\n실무에서 자동화 설계의 핵심 질문은 하나다 — “이 단계는 되돌릴 수 있나?”',
    partial: '라인은 돌았지만 확인 위치가 애매했다. 앞쪽 단계는 틀려도 다시 하면 되지만 발송은 아니다.\n확인을 여러 곳에 걸면 사람이 내용을 안 보고 누르게 된다 — 그게 자동화 편향이다.\n확인 하나를 발송 바로 앞에 두고 다시 해보라.',
    fail: '확인 없이 나간 것은 되돌릴 수 없다. 자동화의 위험은 속도가 아니라 되돌릴 수 없다는 데 있다.\n순서대로 놓고, 발송 바로 앞 칸에 사람 확인을 하나 넣어 보라.\n그 한 칸이 사고를 막는다.'
  }
};
