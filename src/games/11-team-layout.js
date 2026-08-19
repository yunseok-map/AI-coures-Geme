// 미니게임 11 — 팀 배치 (엔진 W 배선형)
// 배우는 것: 서브에이전트 · 오케스트레이션 · 컨텍스트 격리
//
// 설계 의도: "병렬로 돌리면 빠르다"와 "합치다 깨진다"를 둘 다 겪게 한다.
//
// 예전에는 타임라인 칸에 이름표를 떨어뜨리는 판이었다. 그러면 순서를 **칸 번호가**
// 정해 줘서, 사용자는 "몇 번 칸에 놓을까"만 고민하고 정작 "무엇 다음에 무엇인가"는
// 안 만든다. 지금은 상자를 선으로 직접 잇는다 — 셋을 한 줄로 이으면 소요 시간이
// 늘어나고, 각각 따로 이어 두면 줄어드는 것을 **선을 긋는 순간** 숫자로 본다.
//
// 그래서 이 판의 정답은 모양으로 남는다: 갈라졌다가 다시 모이는 선.

import { Run, applyFault, applyGain } from '../core/sim.js';
import { reaches, overlaps, widest } from '../core/graph.js';

const DEADLINE = 6;   // 이 칸 안에 끝나야 한다

export default {
  id: 'team-layout',
  engine: 'W',
  title: '팀 배치',
  subtitle: '조사 셋과 취합 하나를 선으로 잇는다. 어떻게 잇느냐로 걸리는 시간이 달라진다',
  chapter: 3,
  required: false,
  concept: ['서브에이전트 vs 에이전트 팀', '오케스트레이션', '컨텍스트 격리'],
  checkedAt: '2026-08',

  data: {
    briefCap: '오늘의 일감',
    // "취합은 조사가 끝난 뒤에 시작한다"는 뺐다 — 그건 이어 보면 바로 보이는 규칙이고
    // (`wireHint` 가 짚어 준다), 여기 적으면 이 판의 답을 절반 알려 주는 셈이 된다.
    brief: `경쟁사 3곳을 조사하고, 마지막에 하나의 표로 합쳐야 한다.\n` +
           `마감은 **${DEADLINE}칸**이다.`,
    deadline: DEADLINE,   // 이게 있으면 엔진이 소요 시간 계기와 일정 미리보기를 켠다
    wireHint: '들어오는 선이 없는 상자는 바로 시작한다. 선으로 이으면 앞 일이 끝나야 시작한다.',
    runLabel: '이 배선으로 돌리기',
    runCaption: '이은 대로 일이 흐른다',

    nodes: [
      { id: 'a', label: 'A사 조사', dur: 2, col: 1, row: 1 },
      { id: 'b', label: 'B사 조사', dur: 2, col: 1, row: 2 },
      { id: 'c', label: 'C사 조사', dur: 2, col: 1, row: 3 },
      { id: 'merge', label: '표로 취합', dur: 2, col: 3, row: 2 }
    ]
  },

  simulate(setup) {
    const r = new Run();
    const { links, sched } = setup;
    const JOBS = ['a', 'b', 'c'];
    const NAME = { a: 'A사 조사', b: 'B사 조사', c: 'C사 조사' };

    r.read(`이은 선 ${links.length}개를 따라간다`);

    // 취합으로 이어지지 않은 조사는 표에 안 들어간다.
    // 배치형에서는 "안 놓은 일감"이었는데, 배선형에서는 **놓여는 있지만 아무 데도
    // 이어지지 않은 일**이 된다. 이쪽이 실무에 더 가깝다 — 시켜 놓고 안 걷어 오는 것.
    const feeding = JOBS.filter(id => reaches(links, id, 'merge'));
    const dangling = JOBS.filter(id => !feeding.includes(id));

    for (const id of JOBS) {
      const s = sched.start[id], e = sched.end[id];
      if (e != null) r.do(`${NAME[id]} — ${s + 1}칸부터 ${e}칸까지`);
    }

    if (dangling.length) {
      r.warn(`취합으로 이어지지 않은 조사 ${dangling.length}건 — ${dangling.map(id => NAME[id]).join(', ')}`);
      r.fault('걷어 오지 않은 일', '시키기만 하고 결과를 받아 오는 선을 안 그으면 표에 안 들어간다',
        20 * dangling.length);
    }

    // 나란히 돌았는가 — 선 모양이 그대로 시간이 된다
    const together = widest(sched, JOBS);
    const anyParallel = JOBS.some((x, i) => JOBS.some((y, n) => n !== i && overlaps(sched, x, y)));
    if (anyParallel) {
      r.ok(`조사 ${together}건이 나란히 진행됐다 — 각자 자기 책상에서 따로 돈다`);
      applyGain(r, 'parallel', 8);
      r.gain('컨텍스트 격리', '조사마다 별도 책상을 써서 본 대화가 지저분해지지 않았다', 4);
    } else if (feeding.length > 1) {
      r.warn('조사가 한 줄로 이어져 하나씩 차례로 돌았다');
      r.fault('줄 세우기', '서로 상관없는 일을 한 줄로 이으면 나눠 맡긴 의미가 없다', 12);
    }

    // 취합 — 들어오는 선이 있어야 하고, 셋이 다 들어와야 한다
    if (sched.end.merge == null) {
      r.warn('취합이 돌지 않았다 — 돌고 도는 선에 걸렸다');
      r.fault('취합 없음', '나눠서 시켰으면 합치는 단계도 함께 설계해야 한다', 25);
    } else if (!feeding.length) {
      r.warn('취합에 아무 조사도 들어오지 않는다');
      r.fail('빈 표가 나왔다');
      r.fault('취합 없음', '나눠서 시켰으면 합치는 단계도 함께 설계해야 한다', 25);
    } else if (feeding.length < 3) {
      r.do('들어온 조사만으로 표를 만든다');
      applyFault(r, 'merge', 30);
      r.fail(`회사 ${3 - feeding.length}곳이 빠진 채로 표가 나왔다`);
    } else {
      r.do('세 조사 결과를 하나의 표로 합친다');
      r.ok('3사 비교표 완성');
    }

    // 마감 — 선 모양이 만든 시간
    const finish = sched.finish;
    if (sched.cycle.length) {
      r.warn('돌고 도는 선이 있어 시작하지 못한 일이 있다');
      r.fault('멈춘 라인', '앞 일이 자기 뒤에 있으면 그 일은 영영 시작 못 한다', 20);
    } else if (finish > DEADLINE) {
      r.warn(`${finish}칸에 끝났다 — 마감은 ${DEADLINE}칸이었다`);
      applyFault(r, 'late', 22);
    } else if (finish) {
      r.ok(`${finish}칸에 마쳤다 — 마감 안에 들어왔다`);
    }

    r.out(r.faults.length ? '비교표 — 확인이 더 필요하다' : '3사 비교표 완성 — 마감 안에 끝났다');
    return r.finish({ pass: 85, partial: 55 });
  },

  named: {
    all: '일꾼마다 자기 책상을 따로 주고 일을 나눠 맡겼다. 이런 일꾼이 서브에이전트다. ' +
         '한 대화 안의 부하로 둘 것이냐, 각자 독립된 자리를 줄 것이냐. ' +
         '이 갈림이 **서브에이전트 vs 에이전트 팀**이다. ' +
         '여럿의 순서와 합류를 짜는 일, 이게 **오케스트레이션**이다. 방금 그은 선이 그 설계도다. ' +
         '큰 작업은 옆방에서 돌려서 본 대화를 깨끗하게 지킨다. 이게 **컨텍스트 격리**다.'
  },

  debrief: {
    pass: '갈라졌다가 다시 모이는 선 — 그게 나눠 맡기기의 모양이다.\n독립된 일은 각자 시작하게 두고, 앞의 결과가 필요한 일만 선으로 묶으면 된다.\n실무에서 멀티 에이전트가 실패하는 지점은 대부분 “합치기”다.',
    partial: '선은 이었는데 마감을 넘겼거나 취합에 빠진 조사가 있다.\n한 줄로 이으면 안전한 대신 느리고, 걷어 오는 선을 빠뜨리면 빠른 대신 빈다.\n조사 셋을 서로 잇지 말고 각각 취합으로 이어 보자.',
    fail: '나눠 맡기는 건 공짜가 아니다. 시켜 놓고 걷어 오는 선을 안 그으면 결과가 흩어진 채 남는다.\n“이 일은 앞의 무엇이 끝나야 시작할 수 있나”만 보면 선이 정해진다.\n다시 이어 보자.'
  }
};
