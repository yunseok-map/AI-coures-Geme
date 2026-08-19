// 미니게임 17 — 이 일엔 어떤 AI?  (엔진 N 지형 답사)
// 배우는 것: 용도별 도구 지형도 · 애그리게이터
//
// 예전에는 통 열 개짜리 분류 게임이었다. 상황 카드를 읽고 통에 넣으면 맞다/틀리다가
// 나오는 판이라, 정작 배워야 할 것이 안 나왔다: **도구 고르기는 정답 맞히기가
// 아니라 지형 읽기다.** 어떤 일은 여러 갈래가 다 할 수 있고, 그때 갈리는 것은
// 되냐 안 되냐가 아니라 대가다 — 손이 얼마나 가는지, 결과가 남는지, 남에게 넘어가는지.
//
// 여기서는 오답 표시가 없다. 대신 **발품이 줄어든다.** 발품은 오늘치가 정해져 있어서
// 다 해 볼 수 없다. 지는 방식이 둘이다:
//   ① 무거운 길만 고르면 → 발품이 떨어져 뒤의 의뢰를 손도 못 댄다
//   ② 제일 싼 길만 고르면 → 다 끝나기는 하는데 아무것도 안 남는다
//
// ②가 이 판의 핵심이다. 애그리게이터는 **벽이 없고 제일 싸다.** 그래서
// "그냥 다 되는 거 아니야?"가 자연스럽게 나오고, 전부 그리로 보내면
// 통과선 아래로 떨어진다. 그 사실을 글로 설명하지 않고 점수로 겪게 한다.
// 대신 한 번 쓰고 버릴 일에는 그 갈래가 **정답**이다 — 그것도 같이 겪어야
// "애그리게이터는 나쁘다"로 잘못 배우지 않는다.
//
// 갈래 이름을 특정 제품이 아니라 계열로 둔다. 제품 이름은 도구 도감에 있고,
// 그쪽은 공식 링크와 주의점까지 붙여 검증한 것만 실린다.

import { Run } from '../core/sim.js';
import { route, walk } from '../core/terrain.js';
import { euroJosa } from '../core/ko.js';

// 지형 — 여섯 갈래. 발품·남김·넘김 세 가지가 갈래마다 다르다.
// `does` 는 그 갈래가 전담하는 일이고, `all` 은 전부 하지만 얕다는 뜻이다.
const TERRAINS = [
  { id: 'chat', label: '챗봇', line: '묻고 답을 받는다. 창을 닫으면 흩어진다',
    legwork: 2, does: ['write', 'find'], keeps: false, hands: false },
  { id: 'search', label: '검색형', line: '찾아와 출처를 붙인다. 링크가 남는다',
    legwork: 3, does: ['find'], keeps: true, hands: true },
  { id: 'visual', label: '이미지·영상', line: '그림과 영상을 만든다. 손이 많이 간다',
    legwork: 4, does: ['make'], keeps: false, hands: true },
  { id: 'code', label: '코딩', line: '파일과 반복을 직접 다룬다. 절차가 파일로 남는다',
    legwork: 5, does: ['bulk'], keeps: true, hands: true },
  { id: 'meeting', label: '회의록', line: '말소리를 글로 바꿔 쌓는다',
    legwork: 3, does: ['listen'], keeps: true, hands: true },
  { id: 'hub', label: '애그리게이터', line: '여러 갈래를 한 창에서 골라 쓴다. 벽이 없다',
    legwork: 1, all: true, keeps: false, hands: false }
];

// 의뢰 — 요구가 다르다. 요구가 아예 없는 것도 하나 있어야 한다.
// 안 그러면 "무조건 든든한 갈래"가 정답이 되어 고민할 것이 사라진다.
const JOBS = [
  { id: 'q1', kind: 'find', asks: ['deep', 'hand'], short: '근거 자료',
    text: '사내 공지에 붙일 근거 자료를 모은다. 읽는 사람이 직접 열어 확인할 수 있어야 한다.' },
  { id: 'q2', kind: 'listen', asks: ['deep', 'keep'], short: '회의 기록',
    text: '주간 회의에서 오간 말을 정리해 둔다. 다음 주에도 이어서 쌓는다.' },
  { id: 'q3', kind: 'make', asks: [], short: '안내 그림',
    text: '행사 안내에 넣을 그림 한 장. 이번 한 번 쓰고 끝이다.' },
  { id: 'q4', kind: 'bulk', asks: ['deep', 'keep'], short: '문서 이름 통일',
    text: '흩어진 문서 200개의 이름 규칙을 통일한다. 분기마다 또 한다.' },
  { id: 'q5', kind: 'write', asks: ['deep'], short: '회의 메모',
    text: '내일 회의에 들고 갈 한 장짜리 메모. 숫자가 틀리면 안 된다.' },
  { id: 'q6', kind: 'find', asks: ['keep'], short: '매달 쓰는 자료',
    text: '매달 같은 자료를 다시 찾아 붙인다. 다음 달에 처음부터 하고 싶지 않다.' }
];

// 오늘치 발품. 제일 좋은 길로만 가면 17이 든다 —
// 딱 하나 남는다. 한 번이라도 헛디디면 마지막 의뢰에서 요구를 포기하게 된다.
// 이 숫자가 이 판의 긴장 전부다. `_tests/test-map.mjs` 가 계산으로 지킨다.
const BUDGET = 18;

// 못 채운 요구는 이름을 나눠 둔다. 결과 화면에서 "남는 게 없다 3건" 처럼
// 묶일 때 뜻이 통해야 하기 때문이다 (CLAUDE.md §2).
const MISS = {
  deep: ['얕게 끝났다', '한 창에서 골라 쓰면 빠르지만, 그 일만 파는 갈래만큼 파고들지는 못한다'],
  keep: ['남는 게 없다', '다음에 또 할 일인데 창을 닫으니 아무것도 안 남았다'],
  hand: ['넘길 수 없다', '남이 이어받아야 하는데 결과가 내 창 안에만 있다']
};
const MISS_COST = { deep: 7, keep: 9, hand: 9 };

const jobOf = (id) => JOBS.find(j => j.id === id) || null;
const terrainOf = (id) => TERRAINS.find(t => t.id === id) || null;

/** 그 의뢰를 할 수 있는 길 중 제일 싼 발품 */
function cheapest(job) {
  let best = Infinity;
  for (const t of TERRAINS) {
    const r = route(job, t);
    if (r.ok && r.legwork < best) best = r.legwork;
  }
  return best;
}

export default {
  id: 'which-ai',
  engine: 'N',
  title: '이 일엔 어떤 AI?',
  subtitle: '같은 일도 가는 길이 여럿이다. 발품은 오늘치가 정해져 있고, 길마다 남는 것이 다르다',
  chapter: 9,
  required: true,
  concept: ['애그리게이터', '카테고리로 기억하기'],
  checkedAt: '2026-08',

  data: {
    budget: BUDGET,
    jobs: JOBS,
    terrains: TERRAINS,

    askLabels: {
      deep: '제대로 파야 한다',
      keep: '다음에 또 한다',
      hand: '남이 이어받는다'
    },

    look: {
      cap: '이 길로 가면',
      hint: '지형도에서 구역을 눌러 살펴본다',
      budgetCap: '남은 발품',
      legworkCap: '발품',
      jobCap: '의뢰',
      askCap: '원하는 것',
      askNone: '원하는 것이 따로 없다',
      own: '이 일을 전담하는 갈래다',
      wide: '한 창에서 얕게 끝난다',
      far: '되기는 된다 — 전담 갈래가 아니라 먼 길이다',
      none: '이 갈래에는 이 일을 하는 길이 없다',
      keepYes: '남는다', keepNo: '안 남는다',
      handYes: '넘긴다', handNo: '못 넘긴다',
      noRoad: '길이 없다',
      // 버튼 두 개가 360px 화면을 반씩 나눠 쓴다. 여섯 글자를 넘기면 줄이 접힌다.
      go: '이 길로 간다',
      anyway: '그래도 가 본다',
      poor: '발품 부족',
      close: '다른 구역',
      trailCap: '지나온 길',
      trailNone: '아직 없다',
      backTag: '되돌아옴'
    },

    // 무슨 일이 일어났는지 한 줄. 판정이 아니라 **일어난 일**을 적는다.
    notes: {
      full: '원하던 것이 그대로 남았다.',
      deep: '겉만 훑고 끝났다.',
      keep: '창을 닫으니 아무것도 안 남았다.',
      hand: '결과가 내 창 안에만 있다. 넘기려면 다시 설명해야 한다.',
      detour: '되기는 됐다. 전담 갈래가 아니라 발품이 더 들었다.',
      wall: '그 갈래에는 이 일을 하는 길이 없다. 발품만 나갔다.'
    },

    runCaption: '오늘 답사를 되짚는다'
  },

  /**
   * 판정. 무엇이 "정답 갈래"였는지는 안 본다 — **오늘 발품을 어디에 썼고
   * 무엇이 남았는지**만 본다.
   *
   * 계산은 core/terrain.js 의 walk() 가 한다. 화면의 미리보기와 같은 함수라
   * "발품 3이라며 왜 감점이냐" 같은 일이 안 생긴다.
   */
  simulate(setup, d) {
    const picks = setup.picks || [];
    const jobs = d.jobs || JOBS;
    const terrains = d.terrains || TERRAINS;
    const budget = d.budget || BUDGET;

    const r = new Run();
    const { steps, undone, spent, left } = walk(jobs, terrains, picks, budget);

    r.read(`오늘 맡은 의뢰 ${jobs.length}건. 쓸 수 있는 발품 ${budget}.`);

    let full = 0, light = 0;

    for (const s of steps) {
      if (!s.afford) continue;
      const job = jobOf(s.jobId);
      const terrain = terrainOf(s.terrainId);
      if (!job || !terrain) continue;
      const name = `${job.short} — ${terrain.label}`;
      const to = terrain.label + euroJosa(terrain.label);

      // ---- 되돌아온 것 ----
      if (!s.ok) {
        r.fail(`${name}. ${to} 갔다가 발품 ${s.legwork}만 쓰고 되돌아왔다.`);
        r.fault('되돌아온 의뢰', '그 갈래에는 이 일을 하는 길이 아예 없다. 발품만 나갔다', 10);
        continue;
      }

      // ---- 먼 길 ----
      if (s.why === 'detour') {
        r.warn(`${name}. 전담 갈래가 아니라 발품이 ${s.legwork}까지 올라갔다.`);
        r.fault('먼 길로 돌아갔다',
          '되기는 되지만 그 일을 전담하는 갈래가 아니라 발품이 더 들었다', 6);
      }

      // ---- 못 채운 요구 ----
      for (const m of s.missed) {
        const [name2, why] = MISS[m];
        r.fault(name2, why, MISS_COST[m]);
      }

      if (s.missed.length) {
        r.warn(`${name}. 원하던 것 ${job.asks.length}가지 중 ${s.met.length}가지만 채웠다.`);
      } else if (job.asks.length) {
        r.ok(`${name}. 원하던 것을 다 채웠다.`);
        full++;
      } else if (s.legwork === cheapest(job)) {
        // 요구가 없는 일에 제일 싼 길로 갔다 — 애그리게이터를 제대로 쓴 자리다
        r.ok(`${name}. 한 번 쓰고 버릴 일이라 발품 ${s.legwork}만 쓰고 끝냈다.`);
        light++;
      } else {
        r.warn(`${name}. 원하는 것이 따로 없는 일인데 발품 ${s.legwork}까지 썼다.`);
      }
    }

    // ---- 손도 못 댄 의뢰 ----
    for (const id of undone) {
      const job = jobOf(id);
      r.fail(`${job ? job.short : '남은 의뢰'} — 발품이 떨어져 손도 못 댔다.`);
      r.fault('손도 못 댄 의뢰', '앞에서 무거운 길만 골라 오늘치 발품이 떨어졌다', 24);
    }

    // ---- 잘한 것 ----
    for (let i = 0; i < full; i++) {
      r.gain('요구를 다 채운 길', '그 의뢰가 원하는 것을 전부 채우는 갈래로 갔다', 0);
    }
    for (let i = 0; i < light; i++) {
      r.gain('가벼운 일은 가볍게', '한 번 쓰고 버릴 일에는 제일 싼 길이 맞다. 발품을 아꼈다', 0);
    }

    r.out(`끝낸 의뢰 ${jobs.length - undone.length}건 · 쓴 발품 ${spent} · 남은 발품 ${left}.`);

    return r.finish({ pass: 80, partial: 50 });
  },

  named: {
    all: '방금 한 건 지도를 읽는 일이다. 같은 일도 가는 길이 여럿이고, ' +
         '갈리는 건 되냐 안 되냐가 아니라 발품과 남는 것이다. ' +
         '여러 갈래를 한 창에서 골라 쓰게 해 주는 층, 이걸 **애그리게이터**라고 부른다. ' +
         '벽이 없어 편한 대신 그 창 안에 갇힌다. ' +
         '도구 이름 대신 갈래로 외워 두면 그게 **카테고리로 기억하기**다.'
  },

  debrief: {
    pass: '지도를 읽었다. 어떤 일은 여러 갈래가 다 하고, 갈리는 것은 발품과 남는 것이다.\n' +
          '다음에 또 할 일에는 남는 길을, 한 번 쓰고 버릴 일에는 제일 싼 길을 골랐다.\n' +
          '애그리게이터가 맞는 자리와 얕아서 곤란한 자리를 둘 다 겪었다.',
    partial: '발품이 새는 자리는 대개 둘이다.\n' +
             '전담 갈래가 아닌 곳으로 돌아간 길, 그리고 원하는 것이 없는 일에 무거운 길을 쓴 것.\n' +
             '앞에서 흘린 발품 때문에 뒤의 의뢰에서 원하는 것을 포기하게 된다.',
    fail: '전부 한 창에서 골라 쓰면 빠르게 다 끝난다. 대신 아무것도 안 남는다.\n' +
          '다음 달에 같은 일을 또 할 때 처음부터 다시 해야 하고, 남에게 넘기지도 못한다.\n' +
          '구역을 눌러 보면 그 갈래에 무엇이 남는지 미리 볼 수 있다.'
  }
};
