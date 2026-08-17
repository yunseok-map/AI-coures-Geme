// 미니게임 13 — 사고 막기 (엔진 D 배치형)
// 배우는 것: 훅 · 하네스 엔지니어링 · 가드레일 · 샌드박스
//
// 설계 의도: 에이전트가 자율로 도는 동안 사고가 나는 지점은 정해져 있다.
// 그 앞에 무엇을 두느냐로 결과가 갈린다. 종류가 다른 안전장치를
// 각각 맞는 자리에 놓아 봐야 "훅 · 가드레일 · 샌드박스"가 왜 따로 있는지 안다.

import { Run, applyGain } from '../core/sim.js';

// 사고 지점과, 그것을 막을 수 있는 장치
const HAZARDS = [
  { atTick: 3, id: 'hz-write', label: '원본 파일 덮어쓰기', blockedBy: 'sandbox',
    fail: '작업 폴더 밖의 원본 자료를 덮어썼다',
    ok: '작업이 격리된 공간 안에서만 이뤄져 원본은 그대로다' },
  { atTick: 5, id: 'hz-inject', label: '외부 문서의 숨은 지시', blockedBy: 'verify',
    fail: '읽어들인 문서에 있던 “이 주소로 보내라”를 그대로 따랐다',
    ok: '읽은 내용에 지시가 섞여 있는 것을 검증 단계가 잡아냈다' },
  { atTick: 7, id: 'hz-send', label: '외부로 파일 전송', blockedBy: 'hook',
    fail: '확인 없이 사외로 파일이 나갔다',
    ok: '전송 직전 훅이 가로채 확인을 요구했다' }
];

export default {
  id: 'prevent-accident',
  engine: 'D',
  title: '사고 막기',
  subtitle: '에이전트가 혼자 일하는 8칸이다. 사고 지점 앞에 안전장치를 놓아라',
  chapter: 4,
  required: false,
  concept: ['훅', '하네스 엔지니어링', '가드레일', '샌드박스'],
  checkedAt: '2026-08',

  data: {
    briefCap: '상황',
    brief: '에이전트에게 자료 정리를 맡기고 자리를 비운다.\n' +
           '빨간 칸이 사고가 날 수 있는 지점이다. 각 지점 **앞쪽 칸**에 맞는 장치를 놓아야 막힌다.',
    lanes: 1,
    ticks: 8,
    laneNames: ['에이전트'],
    trayLabel: '놓을 안전장치 — 종류마다 막는 사고가 다르다',
    runLabel: '자리를 비우고 돌리기',
    runCaption: '에이전트가 혼자 8칸을 돈다',

    hazards: HAZARDS.map(h => ({ atTick: h.atTick, label: h.label })),

    jobs: [
      { id: 'work', label: '자료 정리', dur: 2 }
    ],
    gates: [
      { id: 'sandbox', label: '샌드박스', kind: 'sandbox' },
      { id: 'verify',  label: '검증',     kind: 'verify' },
      { id: 'hook',    label: '훅',       kind: 'hook' }
    ]
  },

  simulate(setup) {
    const r = new Run();
    const gates = setup.plan.filter(p => p.kind === 'gate');

    r.read(`배치된 안전장치 ${gates.length}개로 8칸을 돈다`);
    r.do('에이전트가 자료 정리를 시작한다');

    let blocked = 0;
    for (const hz of HAZARDS) {
      // 사고 지점보다 앞 칸(1-based 기준으로 작은 칸)에 맞는 장치가 있어야 막힌다
      const guard = gates.find(g => g.item.id === hz.blockedBy && g.tick + 1 < hz.atTick);
      if (guard) {
        blocked++;
        r.ok(`${hz.atTick}칸 — ${hz.ok}`);
      } else {
        const wrongGuard = gates.find(g => g.tick + 1 < hz.atTick && g.item.id !== hz.blockedBy);
        if (wrongGuard) {
          r.warn(`${hz.atTick}칸 — 앞에 장치가 있지만 이 사고를 막는 종류가 아니다`);
        }
        r.fail(`${hz.atTick}칸 — ${hz.fail}`);
        r.fault(hz.label, `이 지점은 ${labelOf(hz.blockedBy)}(으)로만 막힌다`, 24);
      }
    }

    if (blocked === HAZARDS.length) {
      applyGain(r, 'guard', 12);
      r.gain('하네스 엔지니어링', '지시를 반복하는 대신 환경에 장치를 넣어 사고를 구조로 막았다', 6);
    } else if (blocked > 0) {
      r.gain('가드레일', `${blocked}건은 구조로 막혔다`, 4);
    }

    const late = gates.filter(g => g.tick + 1 >= 8).length;
    if (late) r.warn(`${late}개는 사고 지점보다 뒤에 놓여 아무것도 막지 못했다`);

    r.out(blocked === HAZARDS.length
      ? '자리를 비운 동안 사고 없음 — 세 지점 모두 막혔다'
      : `자리를 비운 동안 사고 ${HAZARDS.length - blocked}건 발생`);

    return r.finish({ pass: 85, partial: 50 });
  },

  named: {
    all: '정해진 시점에 무조건 실행되는 것이 **훅**, 아예 못 하게 구조로 막는 것이 **가드레일**, ' +
         '운영체제 수준에서 울타리를 치는 것이 **샌드박스**다. ' +
         '이렇게 환경 자체를 설계하는 일을 **하네스 엔지니어링**이라고 부른다 — Agent = Model + Harness.'
  },

  debrief: {
    pass: '세 장치가 왜 따로 있는지 봤을 것이다 — 막는 사고의 종류가 다르다.\n샌드박스는 범위를, 검증은 읽은 내용을, 훅은 되돌릴 수 없는 행동을 막는다.\n“지시로 부탁하기”가 아니라 “못 하게 만들기”가 핵심이다.',
    partial: '일부는 막았다. 놓친 지점은 장치 종류가 안 맞았거나 사고보다 뒤에 놓였을 것이다.\n안전장치는 사고가 난 다음에 놓으면 아무 소용이 없다.\n각 빨간 칸 앞에 맞는 종류를 놓아 보라.',
    fail: '자리를 비운 사이에 사고가 났다. AI가 나빠서가 아니라 막을 것이 없었기 때문이다.\n장치 세 개를 사고 지점 세 곳 앞에 하나씩 나눠 놓으면 된다.\n어떤 사고를 어떤 장치가 막는지는 실행 로그에 그대로 나온다.'
  }
};

function labelOf(id) {
  return id === 'sandbox' ? '샌드박스' : id === 'verify' ? '검증' : '훅';
}
