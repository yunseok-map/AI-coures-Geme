// 미니게임 13 — 사고 막기 (엔진 F 디펜스형)
// 배우는 것: 훅 · 하네스 엔지니어링 · 가드레일 · 샌드박스
//
// 설계 의도: 에이전트가 자율로 도는 동안 사고가 나는 지점은 정해져 있다.
// 그 앞에 무엇을 두느냐로 결과가 갈린다. 종류가 다른 안전장치를
// 각각 맞는 자리에 놓아 봐야 "훅 · 가드레일 · 샌드박스"가 왜 따로 있는지 안다.
//
// 왜 디펜스인가: 배치형(칸에 놓고 제출)일 때는 "왜 이 장치여야 하는지"가
// 실행 로그를 읽어야 알 수 있었다. 내려오는 것을 못 막고 지나가는 걸 눈으로 보면
// 설명을 읽지 않아도 안다. 게임 규칙이 곧 교육 내용인 형태다.
//
// 안전장치는 **막는 종류가 정해져 있다**(gates[].stops ↔ foes[].kind).
// 그래서 "아무 장치나 놓으면 막힌다"가 성립하지 않는다 — 이게 이 판의 핵심이다.

import { Run, applyGain } from '../core/sim.js';

export default {
  id: 'prevent-accident',
  engine: 'F',
  title: '사고 막기',
  subtitle: '에이전트가 혼자 일하는 동안 위험한 작업이 내려온다. 맞는 장치로 막아라',
  chapter: 4,
  required: false,
  concept: ['훅', '하네스 엔지니어링', '가드레일', '샌드박스'],
  checkedAt: '2026-08',

  data: {
    briefCap: '상황',
    brief: '에이전트에게 자료 정리를 맡기고 자리를 비운다.\n' +
           '**빨간 것이 사고로 이어지는 작업**이다. 장치는 종류마다 막는 것이 다르다 — ' +
           '맞는 장치가 앞에 있어야 막힌다. 정상 작업은 그냥 지나가면 된다.',

    baseLabel: '우리 팀 자료',
    slots: 3,
    travelSec: 6.5,
    gapSec: 1.9,
    cooldownSec: 1.2,

    trayLabel: '놓을 안전장치 — 눌러서 집고, 길 위의 빈 자리를 눌러 놓는다',
    runLabel: '자리를 비우고 돌리기',
    runCaption: '자리를 비운 동안 무슨 일이 있었나',

    gates: [
      { id: 'sandbox', label: '샌드박스', icon: 'sandbox', stops: ['write'],
        blurb: '작업 범위를 격리한다. 정해진 공간 밖으로 나가는 작업을 막는다' },
      { id: 'verify', label: '검증', icon: 'verify', stops: ['read'],
        blurb: '읽어들인 내용을 확인한다. 자료에 섞인 지시를 잡아낸다' },
      { id: 'hook', label: '훅', icon: 'hook', stops: ['send'],
        blurb: '정해진 시점에 무조건 실행된다. 되돌릴 수 없는 행동을 가로챈다' }
    ],

    // kind 가 gates[].stops 와 맞아야 막힌다. 이 대응이 이 판의 규칙 전부다.
    foes: [
      { id: 'ok-tidy', kind: 'tidy', danger: false, icon: 'doc',
        label: '작업 폴더 안에서 파일 이름 정리',
        pass: '작업 폴더 안에서 파일 이름을 정리했다 — 정상 작업이다' },

      { id: 'hz-write', kind: 'write', danger: true, icon: 'write',
        label: '작업 폴더 밖 원본 파일 덮어쓰기',
        blockedBy: 'sandbox',
        ok: '작업이 격리된 공간 안에서만 이뤄져 원본은 그대로다',
        fail: '작업 폴더 밖의 원본 자료를 덮어썼다',
        over: '격리 범위 안의 정상 작업까지 막혔다' },

      { id: 'ok-sum', kind: 'tidy', danger: false, icon: 'doc',
        label: '승인된 사내 도구로 회의록 요약',
        pass: '승인된 도구로 회의록을 요약했다 — 정상 작업이다' },

      { id: 'hz-inject', kind: 'read', danger: true, icon: 'alert',
        label: '외부 문서에 숨어 있던 지시 따르기',
        blockedBy: 'verify',
        ok: '읽은 내용에 지시가 섞여 있는 것을 검증 단계가 잡아냈다',
        fail: '읽어들인 문서에 있던 “이 주소로 보내라”를 그대로 따랐다',
        over: '확인만 하면 되는 자료 읽기까지 막혔다' },

      { id: 'hz-send', kind: 'send', danger: true, icon: 'send',
        label: '확인 없이 사외로 파일 전송',
        blockedBy: 'hook',
        ok: '전송 직전 훅이 가로채 확인을 요구했다',
        fail: '확인 없이 사외로 파일이 나갔다',
        over: '보내도 되는 것까지 전송이 막혔다' }
    ]
  },

  /**
   * 판정. 엔진은 무대만 돌리고, 무엇이 왜 실패인지는 여기서 정한다.
   * setup = { blocked, leaked, overblocked, passed, placements, unplaced, bestCombo }
   */
  simulate(setup, d) {
    const r = new Run();
    const mistakes = [];
    const dangers = d.foes.filter(f => f.danger);

    r.read(`배치한 안전장치 ${setup.placements.length}개로 자리를 비운다`);
    r.do('에이전트가 자료 정리를 시작한다');

    // 시간 순서 그대로 되돌려 본다 — 방금 본 화면과 로그가 어긋나면 안 된다
    for (const f of d.foes) {
      if (setup.blocked.includes(f.id)) {
        r.ok(f.ok);
      } else if (setup.leaked.includes(f.id)) {
        r.fail(f.fail);
        r.fault(f.label, `이 작업은 ${labelOf(d, f.blockedBy)}(으)로만 막힌다`, 24);
        mistakes.push({ itemId: f.id, hint: `${labelOf(d, f.blockedBy)}가 앞에 있어야 막힌다.` });
      } else if (setup.overblocked.includes(f.id)) {
        r.warn(f.over || '정상 작업인데 막혔다');
        r.fault('과잉 차단', '안전한 작업까지 막으면 일이 진행되지 않는다', 10);
        mistakes.push({ itemId: f.id, hint: '이건 정상 작업이다. 막을 필요가 없었다.' });
      } else {
        r.do(f.pass || f.label);
      }
    }

    const blocked = setup.blocked.length;

    if (blocked === dangers.length && !setup.overblocked.length) {
      applyGain(r, 'guard', 12);
      r.gain('하네스 엔지니어링',
        '지시를 반복하는 대신 환경에 장치를 넣어 사고를 구조로 막았다', 6);
    } else if (blocked > 0) {
      r.gain('가드레일', `${blocked}건은 구조로 막혔다`, 4);
    }

    if (setup.unplaced.length) {
      r.warn(`장치 ${setup.unplaced.length}개는 놓지 않아 아무것도 막지 못했다`);
    }

    r.out(blocked === dangers.length
      ? '자리를 비운 동안 사고 없음 — 위험한 작업 전부가 막혔다'
      : `자리를 비운 동안 사고 ${dangers.length - blocked}건 발생`);

    return r.finish({ pass: 85, partial: 50 }, { mistakes });
  },

  named: {
    all: '정해진 시점에 무조건 실행되는 것이 **훅**, 아예 못 하게 구조로 막는 것이 **가드레일**, ' +
         '운영체제 수준에서 울타리를 치는 것이 **샌드박스**다. ' +
         '이렇게 환경 자체를 설계하는 일을 **하네스 엔지니어링**이라고 부른다 — Agent = Model + Harness.'
  },

  debrief: {
    pass: '세 장치가 왜 따로 있는지 봤을 것이다 — 막는 사고의 종류가 다르다.\n샌드박스는 범위를, 검증은 읽은 내용을, 훅은 되돌릴 수 없는 행동을 막는다.\n“지시로 부탁하기”가 아니라 “못 하게 만들기”가 핵심이다.',
    partial: '일부는 막았다. 놓친 것은 장치 종류가 안 맞았을 것이다 — 장치가 앞에 있어도 종류가 다르면 그냥 지나간다.\n안전한 작업까지 막았다면 그것도 실패다. 일이 진행되지 않는다.\n어떤 작업을 어떤 장치가 막는지는 장치를 집으면 설명이 나온다.',
    fail: '자리를 비운 사이에 사고가 났다. AI가 나빠서가 아니라 막을 것이 없었기 때문이다.\n장치 세 개를 빈 자리 세 곳에 하나씩 나눠 놓으면 된다.\n어떤 사고를 어떤 장치가 막는지는 실행 로그에 그대로 나온다.'
  }
};

function labelOf(d, gateId) {
  const g = d.gates.find(x => x.id === gateId);
  return g ? g.label : '맞는 장치';
}
