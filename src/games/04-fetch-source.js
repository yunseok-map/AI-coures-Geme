// 미니게임 4 — 자료 찾아오기 (엔진 B 판별형 + 실행 시뮬레이션)
// 배우는 것: RAG · 검색 기반 답변
//
// 설계 의도: RAG 를 "검색해서 답한다"고 설명하면 아무도 감이 안 온다.
// 서가에서 직접 문서를 골라 AI에게 건네고, 잘못 고르면 그 자리에서
// 엉뚱한 답이 나오는 걸 보게 한다. 고르는 사람이 곧 답의 품질이다.

import { Run, applyFault, applyGain } from '../core/sim.js';

const RIGHT = ['doc-policy', 'doc-form'];
const TRAP = ['doc-old', 'doc-other'];

export default {
  id: 'fetch-source',
  engine: 'B',
  mode: 'pick',
  title: '자료 찾아오기',
  subtitle: '질문이 들어왔다. 서가에서 AI에게 건넬 문서를 고른다',
  chapter: 1,
  required: false,
  concept: ['RAG', '임베딩·벡터DB'],
  checkedAt: '2026-08',

  data: {
    scene: {
      cap: '들어온 질문',
      body: '“육아휴직 신청하려면 어떤 서류를 언제까지 내야 하나요?”'
    },
    prompt: '서가에서 이 질문에 필요한 문서만 고르시오. 엉뚱한 걸 건네면 엉뚱한 답이 나온다.',
    need: 2,
    runCaption: '건넨 문서만 읽고 답을 만든다',

    targets: [
      { id: 'doc-policy', danger: true,
        label: '취업규칙 제7장 — 육아휴직 (2026년 3월 개정)',
        why: '질문의 핵심 근거다. 개정일이 최신인지도 함께 봐야 한다.' },
      { id: 'doc-form',   danger: true,
        label: '육아휴직 신청서 양식 및 제출 안내',
        why: '“어떤 서류를 언제까지”에 직접 답하는 문서다.' },
      { id: 'doc-old',    danger: false,
        label: '취업규칙 제7장 — 육아휴직 (2019년판)',
        why: '같은 조항이지만 낡았다. 낡은 자료를 건네면 낡은 답이 그대로 나온다.' },
      { id: 'doc-other',  danger: false,
        label: '연차·병가 사용 안내',
        why: '휴가라는 점만 같고 질문과 다른 제도다.' },
      { id: 'doc-news',   danger: false,
        label: '사내 소식지 — 복지제도 개편 예고 기사',
        why: '확정된 규정이 아니라 예고 기사다. 근거로 쓸 수 없다.' },
      { id: 'doc-mail',   danger: false,
        label: '인사팀 담당자 개인 메모',
        why: '공식 문서가 아니고 개인정보가 섞여 있을 수 있다.' }
    ]
  },

  simulate(picked) {
    const r = new Run();
    const has = id => picked.includes(id);
    const right = picked.filter(id => RIGHT.includes(id)).length;
    const traps = picked.filter(id => TRAP.includes(id));

    if (!picked.length) {
      r.warn('건네받은 문서가 없다');
      applyFault(r, 'halluc', 40);
      r.fail('기억나는 대로 답을 만들었다 — 근거 없음');
      r.out('답변 — 근거 문서 0건');
      return r.finish({ pass: 85, partial: 55 });
    }

    r.read(`건네받은 문서 ${picked.length}건을 읽는다`);

    if (has('doc-policy')) { r.read('취업규칙 제7장에서 신청 기한 조항을 찾는다'); r.ok('개정 조항 확인'); }
    if (has('doc-form'))   { r.read('신청서 양식에서 제출 서류 목록을 찾는다'); r.ok('필요 서류 3종 확인'); }

    if (has('doc-old')) {
      r.warn('2019년판과 2026년 개정판의 기한이 다르다');
      if (has('doc-policy')) {
        r.warn('어느 쪽이 최신인지 판단하지 못하고 옛 기한을 인용했다');
        r.fault('낡은 근거', '같은 제목의 옛 문서가 섞이면 AI는 최신 여부를 알지 못한다', 22);
      } else {
        r.fail('폐지된 기한을 그대로 안내했다');
        r.fault('낡은 근거', '옛 문서만 건네면 옛 답이 나온다. 자료의 날짜를 봐야 한다', 30);
      }
    }

    if (has('doc-other') || has('doc-news')) {
      r.read('관련 없는 문서까지 훑는다');
      applyFault(r, 'rot', 14);
    }

    if (has('doc-mail')) {
      r.warn('개인 메모에 담당자 연락처와 다른 직원 이름이 들어 있다');
      applyFault(r, 'leak', 18);
    }

    if (right === 2 && traps.length === 0 && picked.length === 2) {
      applyGain(r, 'grounded', 10);
      r.gain('RAG', '질문에 맞는 문서만 찾아와 그것만 근거로 답했다', 0);
    } else if (right < 2) {
      r.warn('필요한 근거가 부족하다');
      applyFault(r, 'halluc', 25);
      r.fail('빠진 부분은 그럴듯하게 채워 넣었다');
    }

    r.out(r.faults.length
      ? '답변 — 인용한 조항이 맞는지 확인이 필요하다'
      : '답변 완성 — 문장마다 조항 번호와 개정일이 붙어 있다');

    return r.finish({ pass: 85, partial: 55 });
  },

  named: {
    all: '질문이 오면 먼저 관련 문서를 찾아와 그것만 보고 답하는 방식을 **RAG**(검색 기반 답변)라고 한다. ' +
         '뜻이 가까운 문서를 찾아내는 데 쓰이는 저장 방식이 **임베딩·벡터DB**다.'
  },

  debrief: {
    pass: '찾아온 자료가 곧 답의 품질이다. 모델을 바꾸는 것보다 자료를 바꾸는 게 효과가 크다.\n특히 같은 제목의 옛 문서가 섞이면 AI는 어느 쪽이 최신인지 모른다.\n사내 챗봇이 헛소리를 한다면 대부분 모델이 아니라 자료 쪽 문제다.',
    partial: '핵심 문서는 찾았지만 불필요한 것도 함께 건넸다. 관련 없는 문서는 정확도를 떨어뜨린다.\n"관련 있어 보이는 것 전부"가 아니라 "이 질문에 직접 답하는 것"만 고르면 된다.\n자료의 날짜도 함께 봐야 한다.',
    fail: 'RAG를 붙였다고 환각이 사라지지 않는다 — 찾아온 문서가 틀리면 답도 그대로 틀린다.\n질문의 단어와 문서 제목을 맞춰 보면 어떤 게 필요한지 금방 보인다.\n두 개만 고르고 다시 해보라.'
  }
};
