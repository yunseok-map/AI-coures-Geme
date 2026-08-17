// 미니게임 9 — 배선 연결 (엔진 C 조립형 / 슬롯형)
// 배우는 것: MCP · 커넥터 · 최소 권한
//
// 설계 의도: "권한은 넉넉히 열어두면 편하다"가 왜 사고로 이어지는지 겪게 한다.
// 필요한 만큼만 연결하면 일이 끝나고, 더 열면 그 열어둔 통로로 사고가 난다.

import { Run, applyFault, applyGain } from '../core/sim.js';

export default {
  id: 'wiring',
  engine: 'C',
  title: '배선 연결',
  subtitle: 'AI를 사내 시스템에 연결한다. 얼마나 열어 줄지도 함께 정한다',
  chapter: 2,
  required: false,
  concept: ['MCP', '커넥터', '최소 권한'],
  checkedAt: '2026-08',

  data: {
    briefCap: '맡길 일',
    brief: '“다음 주 팀 회의 자료를 문서함에서 찾아 요약하고, 회의를 일정에 잡아 줘.”\n' +
           '이 일에 필요한 만큼만 연결한다. 안 쓰는 통로를 열어 두면 나중에 그리로 사고가 난다.',
    trayLabel: '연결할 것 — 눌러서 집고, 칸의 [여기 놓기]를 누른다',
    runLabel: '연결하고 일 시키기',
    runCaption: '연결한 통로로만 AI가 움직인다',

    slots: [
      { id: 'doc',  label: '사내 문서함', accepts: ['doc'],  capacity: 1 },
      { id: 'cal',  label: '일정',        accepts: ['cal'],  capacity: 1 },
      { id: 'mail', label: '메일',        accepts: ['mail'], capacity: 1 }
    ],

    parts: [
      { id: 'doc-read',  label: '문서함 — 읽기만',            tags: ['doc'] },
      { id: 'doc-all',   label: '문서함 — 읽기+수정+삭제',    tags: ['doc'], danger: true,
        note: '이 일에 수정·삭제 권한이 필요한가?' },
      { id: 'cal-read',  label: '일정 — 읽기만',              tags: ['cal'] },
      { id: 'cal-write', label: '일정 — 읽기+등록',           tags: ['cal'] },
      { id: 'mail-read', label: '메일 — 읽기만',              tags: ['mail'] },
      { id: 'mail-send', label: '메일 — 읽기+외부 발송',      tags: ['mail'], danger: true,
        note: '외부로 나가는 통로다' }
    ]
  },

  simulate(setup) {
    const doc = (setup.slots.doc || [])[0]?.id || null;
    const cal = (setup.slots.cal || [])[0]?.id || null;
    const mail = (setup.slots.mail || [])[0]?.id || null;
    const r = new Run();

    r.read(`연결된 통로: ${[doc, cal, mail].filter(Boolean).length}개`);

    // 문서함
    if (!doc) {
      r.warn('문서함에 접근할 수 없다');
      r.fail('회의 자료를 찾지 못했다');
      r.fault('연결 없음', '일에 꼭 필요한 통로를 열지 않았다', 35);
    } else {
      r.do('문서함에서 지난 회의록과 안건 초안을 찾는다');
      r.ok('자료 3건을 찾아 요약했다');
    }

    // 일정
    if (!cal) {
      r.warn('일정에 접근할 수 없다');
      r.fail('회의를 잡지 못했다');
      r.fault('연결 없음', '일에 꼭 필요한 통로를 열지 않았다', 25);
    } else if (cal === 'cal-read') {
      r.do('빈 시간을 확인한다');
      r.warn('읽기 권한만 있어 등록은 못 한다');
      r.fault('권한 부족', '읽기만 열어 두면 등록하는 일은 끝나지 않는다', 18);
    } else {
      r.do('빈 시간을 확인하고 회의를 등록한다');
      r.ok('다음 주 화요일 10시로 잡았다');
    }

    // 과잉 권한 — 열어둔 통로로 사고가 난다
    if (doc === 'doc-all') {
      r.warn('요약을 만들면서 원본 파일도 손댈 수 있는 상태다');
      r.fail('정리한다며 지난 회의록 원본을 덮어썼다');
      r.fault('과잉 권한', '이 일에 수정·삭제는 필요 없었다', 28);
    }
    if (mail === 'mail-send') {
      r.warn('메일 발송 통로가 열려 있다');
      r.fail('요약본을 참석자 아닌 외부 주소로도 보냈다');
      applyFault(r, 'leak', 30);
    } else if (mail === 'mail-read') {
      r.read('메일도 읽어 본다 — 이 일에는 필요 없었다');
      r.score -= 6;
    }

    // 최소 권한을 정확히 맞춘 경우
    if (doc === 'doc-read' && cal === 'cal-write' && !mail) {
      applyGain(r, 'least', 12);
      r.gain('MCP', '표준 규격으로 필요한 시스템만 붙였다', 0);
    }

    r.out(r.faults.length ? '회의 준비 — 사고가 함께 났다' : '회의 준비 완료 — 요약 3건 + 일정 등록');
    return r.finish({ pass: 85, partial: 50 });
  },

  named: {
    all: 'AI를 외부 시스템에 붙이는 표준 규격이 **MCP**, 계정에 등록해 두는 방식이 **커넥터**다. ' +
         '방금 “필요한 만큼만” 연 것이 **최소 권한**이다.'
  },

  debrief: {
    pass: '필요한 통로만 열었고, 그래서 사고가 날 곳이 없었다.\n권한은 편의를 위해 넉넉히 여는 순간 사고 경로가 된다.\n실무에서도 “일단 전부 허용”이 가장 흔한 사고 원인이다.',
    partial: '통로가 모자라거나 남았다. 읽기만 열면 등록하는 일이 안 끝나고, 다 열면 안 시킨 일까지 한다.\n“이 일에 꼭 필요한 동작이 무엇인가”만 보고 고르면 된다.\n안 쓰는 연결은 아예 꽂지 않는 게 제일 안전하다.',
    fail: '열어 둔 통로로 사고가 났다. AI가 나빠서가 아니라 그럴 수 있게 열려 있었기 때문이다.\n메일 발송·파일 삭제처럼 되돌릴 수 없는 권한은 특히 신중해야 한다.\n필요한 두 개만 꽂고 다시 해보라.'
  }
};
