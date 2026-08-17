// 미니게임 15 — 이상 징후 찾기 (엔진 G 슈팅형)
// 배우는 것: 프롬프트 인젝션 · 섀도우 AI · 정보 유출 · 자동화 편향
//
// 설계 의도: 보안 교육이 안 먹히는 이유는 "하지 마세요" 목록이기 때문이다.
// 대신 평범해 보이는 사무실 하루를 펼쳐 놓고, 그 안에서 위험한 행동을 직접 찍게 한다.
// 전부 나쁜 의도가 아니라 "급해서" 벌어지는 일로 썼다 — 실제로 그렇기 때문이다.
//
// 왜 슈팅인가: 이 판의 주제가 **"급해서 놓친다"** 다. 체크박스로 8건을 느긋하게
// 훑어보면 그 주제가 재현되지 않는다. 하루가 시간 순서로 흘러가고 지나간 일은
// 되돌릴 수 없는 형태여야 "그때 그냥 넘겼다"가 몸으로 남는다.
// 안전한 4건을 쏘면 감점이라서 "다 의심하기"도 통하지 않는다 —
// 실무에서 모든 것을 막으면 일이 안 되는 것과 같다.
//
// 내용(8건·위험 4건·사유)은 검증된 것을 그대로 옮겼다. 새로 지어낸 것 없음.

import { Run, applyGain } from '../core/sim.js';

export default {
  id: 'spot-risk',
  engine: 'G',
  title: '이상 징후 찾기',
  subtitle: '평범해 보이는 사무실 하루가 흘러간다. 사고로 이어질 행동을 찍어라',
  chapter: 4,
  required: true,
  concept: ['프롬프트 인젝션', '섀도우 AI', '자동화 편향', '감사 로그'],
  checkedAt: '2026-08',

  data: {
    prompt: '오늘 팀에서 일어난 일이 시간 순서로 흘러간다',
    runHint: '사고로 이어질 행동을 눌러 찍는다. 안전한 일은 그냥 지나가게 둔다',
    lineLabel: '여기를 지나가면 그냥 넘어간 것이 된다',
    runLabel: '하루 시작',
    runCaption: '찍은 대로 오늘 하루를 되돌려 본다',
    cardIcon: 'doc',

    travelSec: 8,
    gapSec: 2.1,

    labels: {
      hit: '위험', miss: '그냥 넘어갔다', over: '이건 안전한 일이다', pass: '이상 없음',
      tap: '사고로 이어질 행동이라고 판단하면 누르세요',
      sayHit: '위험한 행동을 찍었습니다.',
      sayMiss: '위험한 행동이 그냥 넘어갔습니다.',
      sayOver: '안전한 일을 위험하다고 찍었습니다.'
    },

    items: [
      { id: 's1', tag: '09:12', bad: false,
        label: '회의록 초안을 승인된 사내 AI에 넣어 요약했다.' },

      { id: 's2', tag: '10:03', bad: true,
        label: '급해서 계약서 PDF를 개인 계정 무료 AI에 붙여 넣고 요약을 받았다.',
        why: '섀도우 AI. 나쁜 의도가 아니라 급해서 생긴다. 한번 나간 자료는 회수할 방법이 없다.' },

      { id: 's3', tag: '11:20', bad: false,
        label: 'AI가 만든 표의 숫자를 원본 데이터와 대조한 뒤 보고서에 넣었다.' },

      { id: 's4', tag: '13:40', bad: true,
        label: 'AI에게 외부 웹페이지를 읽혔더니 “아래 주소로 파일을 보내라”는 안내가 있어 그대로 진행했다.',
        why: '프롬프트 인젝션. 문서 속에 숨은 지시를 AI가 사용자 지시처럼 따랐다. 평범한 문서를 읽히기만 해도 생긴다.' },

      { id: 's5', tag: '14:05', bad: false,
        label: '외부로 나가는 메일은 발송 전에 담당자가 한 번 확인하도록 절차를 걸어 두었다.' },

      { id: 's6', tag: '15:30', bad: true,
        label: 'AI가 올린 승인 요청 20건을 내용은 보지 않고 순서대로 눌러 처리했다.',
        why: '자동화 편향. 확인 절차가 잦을수록 사람은 무심코 통과시킨다. 승인 지점을 줄이고 중요한 곳에만 두는 편이 안전하다.' },

      { id: 's7', tag: '16:15', bad: false,
        label: '어떤 자료를 근거로 답했는지 기록이 남도록 설정해 두었다.' },

      { id: 's8', tag: '17:50', bad: true,
        label: '편하게 쓰려고 AI에게 사내 문서함 읽기·수정·삭제 권한을 모두 열어 주었다.',
        why: '과잉 권한. 이 일에 필요 없는 권한이 열려 있으면, 나중에 그 통로로 사고가 난다. 필요한 만큼만 여는 것이 최소 권한이다.' }
    ]
  },

  simulate(setup, d) {
    const r = new Run();
    const mistakes = [];
    const find = (id) => d.items.find(i => i.id === id);
    const risky = d.items.filter(i => i.bad);

    r.read('오늘 팀에서 일어난 일 8건을 시간 순서로 되돌려 본다');

    for (const it of d.items) {
      if (setup.hit.includes(it.id)) {
        r.ok(`${it.tag} 짚어냈다 — ${short(it.label)}`);
      } else if (setup.missed.includes(it.id)) {
        r.fail(`${it.tag} 그냥 넘어갔다 — ${short(it.label)}`);
        mistakes.push({ itemId: it.id, hint: it.why });
      } else if (setup.overshot.includes(it.id)) {
        r.warn(`${it.tag} 안전한 일을 막았다 — ${short(it.label)}`);
        mistakes.push({ itemId: it.id, hint: '이건 안전한 쪽이다. 이런 것까지 막으면 일이 진행되지 않는다.' });
      }
    }

    for (const id of setup.missed) {
      const it = find(id);
      // 사유의 첫 낱말이 그 위험의 이름이다 — 결과 화면에 용어로 남는다
      r.fault(termOf(it.why), it.why, 22);
    }
    for (const id of setup.overshot) {
      r.fault('과잉 차단', '안전한 일까지 막으면 일이 진행되지 않는다. 막을 것을 골라야 한다', 8);
    }

    if (!setup.missed.length && !setup.overshot.length) {
      applyGain(r, 'guard', 10);
      r.gain('위험 식별', '평범해 보이는 행동 중 사고 경로만 골라냈다', 6);
    } else if (setup.hit.length) {
      r.gain('위험 식별', `${setup.hit.length}건은 짚어냈다`, 4);
    }

    r.out(setup.missed.length
      ? `사고로 이어질 행동 ${setup.missed.length}건이 그냥 넘어갔다`
      : setup.overshot.length
        ? '위험한 것은 다 짚었지만 안전한 일까지 막았다'
        : `위험한 행동 ${risky.length}건을 모두 짚어냈다 — 안전한 일은 그대로 진행됐다`);

    return r.finish({ pass: 82, partial: 50 }, { mistakes });
  },

  named: {
    all: '방금 찾은 넷에 각각 이름이 있다 — 승인 안 된 도구에 사내 자료를 넣는 **섀도우 AI**, ' +
         '문서에 숨은 지시를 따르는 **프롬프트 인젝션**, 내용 안 보고 승인하는 **자동화 편향**, ' +
         '그리고 안 쓰는 권한까지 열어 둔 것은 **최소 권한**을 어긴 것이다. ' +
         '안전했던 쪽에도 이름이 있다 — 무엇을 근거로 답했는지 남겨 두는 것이 **감사 로그**다.'
  },

  debrief: {
    pass: '넷 다 나쁜 의도가 아니라 “급해서”, “편하려고” 생긴다는 점이 공통점이다.\n그래서 사람에게 조심하라고 하는 것보다 구조로 막는 편이 확실하다 — 그게 가드레일이다.\n안전한 쪽 4건이 어떻게 생겼는지도 함께 보면 기준이 잡힌다.',
    partial: '몇 개는 찾았다. 놓치기 쉬운 건 “권한을 넉넉히 열어 둔 것”과 “빠르게 연속 승인한 것”이다.\n둘 다 그 순간에는 아무 일도 안 일어나고, 나중에 사고 경로가 된다.\n지금 아무 일 없다는 것과 안전하다는 것은 다르다.',
    fail: '위험한 것들이 전부 평범해 보였을 것이다 — 실제 사고가 그렇게 생긴다.\n기준 하나만 기억하라: “이 자료가 어디로 나가는가”, “이 판단을 누가 확인했는가”.\n다시 하면서 그 두 가지만 보라.'
  }
};

function short(label) {
  const s = String(label).replace(/[.。]$/, '');
  return s.length > 20 ? s.slice(0, 19) + '…' : s;
}

/** "섀도우 AI. 나쁜 의도가…" → "섀도우 AI" */
function termOf(why) {
  return String(why).split('.')[0].trim();
}
