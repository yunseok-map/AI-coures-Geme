// 미니게임 12 — 자동화 라인 (엔진 W 배선형)
// 배우는 것: 에이전트 루프 · 휴먼 인 더 루프 · 휴먼 온 더 루프
//
// 설계 의도: "사람 확인을 넣어야 한다"는 말은 쉽다. 어려운 건 **어디에** 넣느냐다.
// 다 넣으면 자동화한 의미가 없어지고, 안 넣으면 되돌릴 수 없는 사고가 난다.
//
// 배선형으로 바꾼 이유: 확인은 칸에 놓는 것이 아니라 **두 단계 사이에 끼워 넣는 것**이다.
// 선을 끊고 그 사이에 확인을 넣는 동작이 실무의 그 동작과 같다. 칸에 이름표를
// 떨어뜨리는 방식으로는 "초안과 발송 사이"라는 자리가 화면에 존재하지 않았다.

import { Run, applyFault, applyGain } from '../core/sim.js';
import { reaches } from '../core/graph.js';
import { iGa } from '../core/ko.js';

const STEPS = ['collect', 'classify', 'draft', 'send'];
const GATES = ['check1', 'check2'];

export default {
  id: 'auto-line',
  engine: 'W',
  title: '자동화 라인',
  subtitle: '반복 업무를 선으로 이어 흐르게 만든다. 사람 확인을 어디에 끼울지 정한다',
  chapter: 3,
  required: false,
  // '검증 루프'는 뺐다. 그건 AI가 **스스로** 돌려 보는 검사를 쥐어 주는 것인데
  // 이 판에는 사람 확인만 있다. 겪지 않은 용어를 도감에 넣지 않는다.
  // (도감에는 그대로 있다 — 챕터 6 에서 읽는 용어다)
  concept: ['에이전트 루프', '휴먼 인 더 루프', '휴먼 온 더 루프'],
  checkedAt: '2026-08',

  data: {
    briefCap: '자동화할 업무',
    // 단계 이름을 여기서 다시 읊지 않는다 — 상자 넷에 그대로 적혀 있다.
    // 남길 것은 **상자만 봐서는 모르는 것** 하나뿐이다: 발송은 못 되돌린다.
    brief: '매주 반복되는 일이다. **발송은 되돌릴 수 없다** — 앞 단계는 다시 하면 된다.',
    wireHint: '확인 상자는 두 단계 사이에 끼운다 — 앞에서 받고, 뒤로 보낸다.',
    runLabel: '이 라인으로 돌리기',
    runCaption: '한 주 분량이 라인을 따라 흐른다',

    nodes: [
      { id: 'check1', label: '사람 확인', kind: 'gate', dur: 1, note: '한 번 멈춘다', col: 2, row: 1 },
      { id: 'check2', label: '사람 확인', kind: 'gate', dur: 1, note: '한 번 멈춘다', col: 3, row: 1 },
      { id: 'collect',  label: '메일 수집', dur: 1, col: 1, row: 2 },
      { id: 'classify', label: '유형 분류', dur: 1, col: 2, row: 2 },
      { id: 'draft',    label: '답변 초안', dur: 2, col: 3, row: 2 },
      { id: 'send',     label: '고객 발송', dur: 1, irreversible: true,
        note: '되돌릴 수 없다', col: 4, row: 2 }
    ]
  },

  simulate(setup) {
    const r = new Run();
    const { links, sched, nodes } = setup;
    const label = id => nodes.find(n => n.id === id).label;

    r.read(`이은 선 ${links.length}개를 따라간다`);

    // 라인에 아예 끼지 않은 단계 — 놓여만 있고 아무 데도 이어지지 않은 것
    const loose = STEPS.filter(id => !links.some(l => l.from === id || l.to === id));
    if (loose.length) {
      r.warn(`라인에 이어지지 않은 단계 ${loose.length}개 — ${loose.map(label).join(', ')}`);
      r.fault('빠진 단계', '선에 걸리지 않은 일은 아무도 하지 않는다', 15 * loose.length);
    }

    // 순서 — 앞 단계에서 뒷 단계로 선을 따라갈 수 있어야 한다.
    // 사이에 확인이 끼어 있어도 "따라갈 수 있다"는 그대로다.
    const broken = [];
    for (let i = 0; i < STEPS.length - 1; i++) {
      if (!reaches(links, STEPS[i], STEPS[i + 1])) broken.push([STEPS[i], STEPS[i + 1]]);
    }
    if (sched.cycle.length) {
      r.warn('돌고 도는 선이 있어 시작하지 못한 단계가 있다');
      r.fault('멈춘 라인', '앞 일이 자기 뒤에 있으면 그 일은 영영 시작 못 한다', 20);
    } else if (broken.length) {
      const [x, y] = broken[0];
      // 조사를 계산해 붙인다 — "유형 분류이 오지 않는다"가 나오면 안 된다 (CLAUDE.md 8번)
      const what = broken.length > 1 ? `${label(y)} 등이` : iGa(label(y));
      r.warn(`${label(x)} 다음에 ${what} 오지 않는다`);
      r.fault('순서 뒤바뀜', '분류 전에 초안을 쓰면 엉뚱한 답변이 나간다', 20);
    }

    // 흐르는 순서대로 읽어 준다
    for (const id of Object.keys(sched.end).sort((a, b) => sched.start[a] - sched.start[b])) {
      if (!links.some(l => l.from === id || l.to === id)) continue;
      const n = nodes.find(x => x.id === id);
      r.do(n.kind === 'gate' ? `${sched.start[id] + 1}칸 — 사람이 확인한다`
                             : `${sched.start[id] + 1}칸 — ${n.label}`);
    }

    // 되돌릴 수 없는 단계 바로 앞에 확인이 있는가.
    // "어딘가 앞에 있다"로는 부족하다 — 수집 앞에 두면 초안이 틀려도 그대로 나간다.
    const direct = links.some(l => l.to === 'send' && GATES.includes(l.from));
    const upstream = GATES.filter(g => reaches(links, g, 'send'));

    if (direct) {
      r.ok('발송 직전에 사람이 한 번 걸러냈다');
      applyGain(r, 'gate', 14);
      r.do('오분류 2건을 사람이 잡아 되돌렸다');
    } else if (upstream.length) {
      r.warn('확인은 있지만 발송 직전이 아니다 — 확인 뒤에 고친 내용은 아무도 안 봤다');
      r.fault('확인 위치', '되돌릴 수 없는 행동 **바로 앞**이 아니면 그 사이에서 생긴 문제는 그대로 나간다', 18);
    } else if (reaches(links, 'draft', 'send') || links.some(l => l.to === 'send')) {
      r.warn('아무도 확인하지 않고 발송 단계로 넘어간다');
      // 이 판에서 가장 무거운 실수다 — 되돌릴 수 없는 것이 그대로 나갔다.
      // 반려(fail) 로 떨어져야 결과 화면의 세 줄(debrief.fail)이 이 상황을 말해 준다.
      applyFault(r, 'nogate', 50);
      r.fail('잘못 분류된 답변이 고객에게 그대로 나갔다 — 되돌릴 수 없다');
    }

    // 확인을 여러 곳에 걸면 사람이 내용을 안 보고 누르게 된다
    if (upstream.length >= 2) {
      r.warn('되돌릴 수 있는 단계 앞에도 확인이 걸려 있다');
      r.fault('확인 과다', '매 단계 확인하면 자동화한 의미가 없고, 사람이 무심코 통과시키게 된다', 15);
    }

    if (direct && upstream.length === 1) {
      r.gain('휴먼 온 더 루프',
        '되돌릴 수 없는 지점 하나에만 사람을 두고 나머지는 맡겼다', 10);
    }

    r.out(r.faults.length
      ? '주간 문의 처리 — 사고가 함께 기록됐다'
      : '주간 문의 처리 완료 — 사람이 확인한 건은 발송 직전 1회');

    return r.finish({ pass: 85, partial: 55 });
  },

  named: {
    all: '한 단계의 결과가 다음 단계의 재료가 된다. 확인에 걸리면 되돌아가 다시 돈다. ' +
         '이 구조가 **에이전트 루프**다. ' +
         '그 안에서 사람이 한 건씩 승인하는 자리가 **휴먼 인 더 루프**다. ' +
         '매 건이 아니라 울타리만 정해 주고 사람은 감독자로 물러나면 **휴먼 온 더 루프**다. ' +
         '되돌릴 수 없는 행동 바로 앞에만 두면 된다.'
  },

  debrief: {
    pass: '되돌릴 수 있는 단계는 맡기고, 되돌릴 수 없는 발송 바로 앞에만 사람을 뒀다. 그게 정답에 가깝다.\n확인은 많을수록 안전해지지 않는다. 많을수록 무뎌진다.\n자동화를 짤 때 물어볼 건 하나다. “이 단계는 되돌릴 수 있나?”',
    partial: '라인은 돌았는데 확인 자리가 애매하다. 앞쪽 단계는 틀려도 다시 하면 되지만 발송은 아니다.\n확인을 여러 곳에 걸면 사람이 내용을 안 보고 누른다. 이게 자동화 편향이다.\n확인 하나를 답변 초안과 고객 발송 사이에 끼워 넣고 다시 해 보자.',
    fail: '확인 없이 나간 건 되돌리지 못한다. 자동화가 무서운 건 속도가 아니라 되돌릴 수 없다는 점이다.\n수집 → 분류 → 초안 → 발송 순으로 잇고, 초안과 발송 사이의 선을 끊어 그 자리에 확인을 넣어 보자.\n그 한 칸이 사고를 막는다.'
  }
};
