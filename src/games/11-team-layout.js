// 미니게임 11 — 팀 배치 (엔진 D 배치형)
// 배우는 것: 서브에이전트 · 멀티 에이전트 · 오케스트레이션
//
// 설계 의도: "병렬로 돌리면 빠르다"와 "합치다 깨진다"를 둘 다 겪게 한다.
// 순서대로만 놓으면 마감을 넘기고, 앞 일이 안 끝났는데 취합을 놓으면 결과가 어긋난다.
// 말로 설명하면 당연한 얘기지만, 직접 놓아보면 어디에 놓아야 하는지가 남는다.

import { Run, applyFault, applyGain } from '../core/sim.js';

const DEADLINE = 6;   // 이 칸 안에 끝나야 한다

export default {
  id: 'team-layout',
  engine: 'D',
  title: '팀 배치',
  subtitle: '일감을 두 줄에 나눠 놓는다. 나란히 놓으면 빠르지만 합칠 때 문제가 생긴다',
  chapter: 3,
  required: false,
  concept: ['서브에이전트 vs 에이전트 팀', '오케스트레이션', '컨텍스트 격리'],
  checkedAt: '2026-08',

  data: {
    briefCap: '오늘의 일감',
    brief: `경쟁사 3곳을 각각 조사하고, 마지막에 하나의 표로 합쳐야 한다.\n` +
           `마감은 ${DEADLINE}칸. 취합은 조사 셋이 모두 끝난 뒤에 시작해야 한다.`,
    lanes: 2,
    ticks: 8,
    laneNames: ['1번 줄', '2번 줄'],
    trayLabel: '배치할 일감 — 눌러서 집고, 칸을 눌러 놓는다',
    runLabel: '이 배치로 돌리기',
    runCaption: '배치한 순서대로 일이 흐른다',

    jobs: [
      { id: 'a', label: 'A사 조사', dur: 2 },
      { id: 'b', label: 'B사 조사', dur: 2 },
      { id: 'c', label: 'C사 조사', dur: 2 },
      { id: 'merge', label: '표로 취합', dur: 2, deps: ['a', 'b', 'c'] }
    ]
  },

  simulate(setup) {
    const r = new Run();
    const at = id => setup.plan.find(p => p.item.id === id);
    const endOf = p => p ? p.tick + p.dur : null;

    const jobs = ['a', 'b', 'c'].map(at);
    const merge = at('merge');
    const placed = jobs.filter(Boolean).length;

    r.read(`배치된 일감 ${setup.plan.length}건을 확인한다`);

    if (placed < 3) {
      r.warn(`조사 ${3 - placed}건이 배치되지 않았다`);
      r.fault('빠진 일감', '배치하지 않은 일은 아예 실행되지 않는다', 20 * (3 - placed));
    }

    for (const j of jobs) {
      if (j) r.do(`${j.item.label} 시작 — ${j.tick + 1}칸부터 ${j.tick + j.dur}칸까지`);
    }

    // 동시에 몇 건이 돌았는지
    const overlap = jobs.filter(Boolean).some((j, i) =>
      jobs.filter(Boolean).some((k, n) =>
        n !== i && j.tick < k.tick + k.dur && k.tick < j.tick + j.dur));
    if (overlap) {
      r.ok('여러 조사가 나란히 진행됐다 — 각자 자기 책상에서 따로 돈다');
      applyGain(r, 'parallel', 8);
      r.gain('컨텍스트 격리', '조사마다 별도 책상을 써서 본 대화가 지저분해지지 않았다', 4);
    }

    // 취합
    if (!merge) {
      r.warn('취합이 배치되지 않았다');
      r.fail('조사 결과가 흩어진 채로 남았다');
      r.fault('취합 없음', '나눠서 시켰으면 합치는 단계도 함께 설계해야 한다', 25);
    } else {
      const lastDone = Math.max(...jobs.filter(Boolean).map(endOf), 0);
      if (placed === 3 && merge.tick < lastDone) {
        r.do('취합 시작');
        r.warn(`아직 끝나지 않은 조사가 있다 (${lastDone}칸에 끝남)`);
        applyFault(r, 'merge', 30);
        r.fail('빠진 회사가 있는 채로 표가 만들어졌다');
      } else {
        r.do('세 조사 결과를 하나의 표로 합친다');
        r.ok('3사 비교표 완성');
      }
    }

    // 마감
    const finish = Math.max(...setup.plan.map(endOf), 0);
    if (finish > DEADLINE) {
      r.warn(`${finish}칸에 끝났다 — 마감은 ${DEADLINE}칸이었다`);
      applyFault(r, 'late', 22);
    } else if (finish) {
      r.ok(`${finish}칸에 마쳤다 — 마감 안에 들어왔다`);
    }

    r.out(r.faults.length ? '비교표 — 확인이 더 필요하다' : '3사 비교표 완성 — 마감 안에 끝났다');
    return r.finish({ pass: 85, partial: 55 });
  },

  named: {
    all: '자기 책상을 따로 가진 일꾼에게 나눠 맡기는 것이 **서브에이전트**, ' +
         '여럿의 순서와 합류를 설계하는 일이 **오케스트레이션**이다. ' +
         '큰 작업을 옆방에서 돌려 본 대화를 깨끗하게 유지하는 것은 **컨텍스트 격리**라고 한다.'
  },

  debrief: {
    pass: '독립된 일은 나란히, 앞의 결과가 필요한 일은 뒤에 — 이 두 규칙이 전부다.\n나눠 맡기면 빨라지지만 합치는 단계를 반드시 함께 설계해야 한다.\n실무에서 멀티 에이전트가 실패하는 지점은 대부분 “합치기”다.',
    partial: '배치는 됐지만 마감을 넘었거나 합류가 어긋났다.\n순서대로만 놓으면 안전한 대신 느리고, 무작정 나란히 놓으면 빠른 대신 깨진다.\n조사 셋을 나란히, 취합은 그 뒤에 놓으면 둘 다 잡힌다.',
    fail: '나눠 맡기는 건 공짜가 아니다. 앞 일이 끝나기 전에 취합이 시작되면 빠진 채로 완성된다.\n“이 일은 앞의 무엇이 끝나야 시작할 수 있나”만 보면 배치가 정해진다.\n다시 놓아 보라.'
  }
};
