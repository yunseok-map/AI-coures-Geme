// 미니게임 8 — 언제 발동하나 (엔진 T 발동 타임라인)
// 배우는 것: 커맨드 · 스킬 · 서브에이전트 · 훅 · 플러그인
//
// 예전에는 통 여섯 개짜리 분류 게임이었다. 상황 카드를 읽고 이름을 고르는 일이라
// **다섯의 진짜 차이가 화면에 안 나왔다.** 그 차이는 뜻이 아니라 발동 시점이다.
//
// 여기서는 하루가 아홉 순간으로 펼쳐진다. 도구를 걸어 두면 그 도구가 실제로
// 발동할 자리에 표시가 곧바로 찍힌다:
//   훅을 파일 수정 순간에 걸면 표시가 두 개 찍힌다 (하나는 사람이 고치는 순간).
//   스킬을 같은 자리에 걸면 하나만 찍힌다 — 사람이 하는 일에는 안 돈다.
//   커맨드는 아예 걸리지 않는다. 손에 들고 있다가 재생 중에 눌러야 한다.
//   서브에이전트는 맡긴 자리에서 세 칸 뒤에 요약을 갖고 돌아온다.
//   플러그인은 걸 수 있는 도구가 아니라, 열면 도구 셋이 쏟아지는 상자다.
//
// 판정이 보는 것은 "오늘 지켜야 할 것" 다섯 줄뿐이다. 도구 이름을 맞혔는지는 안 본다.
//
// 검증: 공식 문서 확인본 (CLAUDE.md §1)
//   훅은 정해진 시점에 실행되는 장치이고 모델의 판단을 거치지 않는다.
//   스킬은 모델이 상황에 맞다고 판단할 때 스스로 꺼내 쓴다.
//   커맨드는 사용자가 직접 호출한다.
//   서브에이전트는 자기 컨텍스트에서 돌고 요약만 돌려준다.
//   플러그인은 이들을 묶어 한 번에 설치하는 단위다.

import { Run } from '../core/sim.js';
import { byTick, firings } from '../core/fire.js';

const MOMENTS = [
  { id: 'm1', clock: '09:10', label: 'AI가 기획안 초안을 쓴다',    tag: 'draft',  byAi: true },
  { id: 'm2', clock: '09:40', label: '참고 자료 50건이 도착한다',  tag: 'bulk',   byAi: true },
  { id: 'm3', clock: '10:20', label: 'AI가 초안 파일을 고친다',    tag: 'edit',   byAi: true },
  { id: 'm4', clock: '11:00', label: 'AI가 기획안을 다시 쓴다',    tag: 'draft',  byAi: true },
  { id: 'm5', clock: '11:40', label: '주간보고를 낼 시간이다',      tag: 'report', byAi: false },
  { id: 'm6', clock: '13:30', label: '회의에서 자료 요약을 쓴다',   tag: 'meet',   byAi: false },
  { id: 'm7', clock: '15:00', label: '내가 손으로 파일을 고친다',   tag: 'edit',   byAi: false },
  { id: 'm8', clock: '16:20', label: '파일을 협력사로 보낸다',      tag: 'send',   byAi: false },
  { id: 'm9', clock: '17:30', label: '하루를 닫는다',              tag: 'close',  byAi: true }
];

const TOOLS = [
  { id: 'hook1', mode: 'every', label: '훅', short: '훅',
    note: '건 순간과 같은 종류마다 예외 없이',
    putNote: '훅은 사람이 하든 AI가 하든 가리지 않는다.',
    dead: '이 종류의 순간이 오늘 여기 하나뿐이다.' },

  { id: 'cmd', mode: 'manual', label: '커맨드', short: '커맨드',
    note: '내가 눌러야 발동한다' },

  { id: 'skill', mode: 'match', label: '스킬', short: '스킬', inBox: true,
    note: '같은 종류라도 AI가 하는 순간에만',
    putNote: '스킬은 AI가 그 일을 할 때 알아서 꺼내 쓴다.',
    dead: '여기서는 한 번도 발동하지 않는다 — 이 순간은 AI가 하는 일이 아니다.' },

  { id: 'agent', mode: 'lane', dur: 3, label: '서브에이전트', short: '서브', inBox: true,
    note: '맡긴 자리에서 따로 돌다가 요약만 갖고 온다',
    putNote: '여기서 일을 받아 자기 차선으로 갈라진다.' },

  { id: 'hook2', mode: 'every', label: '훅 하나 더', short: '훅', inBox: true,
    note: '상자에 같이 들어 있던 것',
    putNote: '훅은 사람이 하든 AI가 하든 가리지 않는다.',
    dead: '이 종류의 순간이 오늘 여기 하나뿐이다.' }
];

const GOALS = [
  { id: 'g1', text: '파일을 고칠 때마다 빠짐없이 형식 검사가 돈다',
    want: 'everyTag', tag: 'edit', by: ['every'] },
  { id: 'g2', text: '파일이 바깥으로 나가기 전에 한 번 멈춘다',
    want: 'atMoment', moment: 'm8', by: ['every'] },
  { id: 'g3', text: '주간보고 초안을 그 시간에 뽑는다',
    want: 'atMoment', moment: 'm5', by: ['manual', 'every'] },
  { id: 'g4', text: '자료 50건 요약을 회의 전에 받는다',
    want: 'laneBy', moment: 'm6', by: ['lane'] },
  { id: 'g5', text: '기획안을 쓸 때마다 우리 문서 형식이 적용된다',
    want: 'everyTag', tag: 'draft', by: ['match', 'every'] }
];

const idx = (mid) => MOMENTS.findIndex(m => m.id === mid);
const ticksOfTag = (tag) => MOMENTS.map((m, i) => (m.tag === tag ? i : -1)).filter(i => i >= 0);

export default {
  id: 'when-fires',
  engine: 'T',
  title: '언제 발동하나',
  subtitle: '도구를 하루에 걸어 두고 한 번 돌린다. 다섯의 차이는 발동 시점이다',
  chapter: 2,
  required: true,
  concept: ['커맨드', '스킬', '서브에이전트', '훅', '플러그인'],
  checkedAt: '2026-08',

  data: {
    tick: 950,
    moments: MOMENTS,
    tools: TOOLS,
    goals: GOALS,
    box: {
      label: '플러그인 상자',
      note: '걸 수 있는 도구가 아니다. 열어 봐야 안다',
      openNote: '한 번 여는 것으로 셋이 같이 들어왔다.'
    },
    goalsLabel: '오늘 지켜야 할 것 다섯',
    trayLabel: '도구 선반 — 누르고, 하루의 순간을 누른다',
    handLabel: '손에 든 것 — 재생 중에 내가 누른다',
    handLiveLabel: '지금이다. 누를 때를 놓치면 아무 일도 없다',
    handIdleNote: '커맨드는 재생이 도는 동안에만 발동한다.',
    manualNote: '커맨드는 걸어 둘 수 없다. 하루가 도는 동안 내가 직접 눌러야 한다.',
    armNote: '걸어 둘 순간을 누른다.',
    deadNote: '여기서는 한 번도 발동하지 않는다.',
    lateNote: '하루가 끝나도 못 돌아온다.',
    clearedNote: '걸어 둔 것을 전부 내렸다.',
    runNote: '하루가 시작된다.',
    runLabel: '하루를 돌린다',
    runCaption: '오늘 무슨 일이 있었나',
    byAiLabel: 'AI가 한다',
    byHumanLabel: '사람이 한다'
  },

  /**
   * 판정. 도구 이름을 맞혔는지는 안 본다 — **지켜야 할 것 다섯이 지켜졌는지**만 본다.
   *
   * 발동 계산은 core/fire.js 가 한다. 화면에 찍힌 표시와 여기가 같은 함수를 봐야
   * "표시가 두 개 찍혔는데 왜 실패인가" 같은 일이 안 생긴다.
   */
  simulate(setup, d) {
    const placed = setup.placed || {};
    const presses = setup.presses || [];
    const M = d.moments, T = d.tools;
    const r = new Run();

    const grid = byTick(M, T, placed, presses);
    const all = firings(M, T, placed);
    const met = {};

    /** 하루 안에 돌아온 서브에이전트의 도착 시각 (없으면 null) */
    const laneEnd = all.filter(f => f.mode === 'lane').map(f => f.tick).sort((a, b) => a - b)[0] ?? null;

    /** 어느 순간이 "지켜야 할 것" 때문에 필요한가 — 헛발동을 세는 기준 */
    const needed = new Set();
    for (const g of d.goals) {
      if (g.want === 'everyTag') for (const i of ticksOfTag(g.tag)) needed.add(i);
      if (g.want === 'atMoment') needed.add(idx(g.moment));
    }

    const hit = (i, by) => grid[i] && grid[i].some(x => by.includes(x.mode));

    // 커맨드는 한 칸 늦어도 인정한다. 순간이 950밀리초라 손이 조금 늦는 것까지
    // 실패로 보면, 배우는 것이 발동 시점이 아니라 반응 속도가 된다.
    const hitManual = (i) => presses.some(p => p.tick === i || p.tick === i + 1);

    r.read('하루를 되짚는다.');

    for (const g of d.goals) {
      let ok = false;
      if (g.want === 'everyTag') {
        ok = ticksOfTag(g.tag).every(i => hit(i, g.by));
      } else if (g.want === 'atMoment') {
        const i = idx(g.moment);
        ok = hit(i, g.by.filter(b => b !== 'manual')) || (g.by.includes('manual') && hitManual(i));
      } else if (g.want === 'laneBy') {
        ok = laneEnd != null && laneEnd <= idx(g.moment);
      }
      met[g.id] = ok;
      if (ok) r.ok(g.text);
      else r.warn(g.text);
    }

    // ---- 사유 ----

    const missed = d.goals.filter(g => !met[g.id]);
    for (const g of missed) {
      // 늦게 돌아온 것과 아예 안 맡긴 것은 다른 실패다
      if (g.want === 'laneBy' && laneEnd != null) {
        r.fail(`요약은 ${M[laneEnd] ? M[laneEnd].clock : '하루가 끝난 뒤'}에야 왔다. 회의는 이미 끝났다.`);
        r.fault('늦은 발동', '따로 맡기긴 했지만 필요한 때보다 늦게 돌아왔다', 22);
        continue;
      }
      r.fault('발동하지 않은 일', g.text + ' — 오늘 이 자리에서 아무것도 발동하지 않았다', 22);
    }

    // AI 판단에 맡긴 안전장치 — 표시는 찍혔는데 사람이 하는 순간을 건너뛴 경우
    for (const g of missed) {
      if (g.by.includes('match') || g.want === 'laneBy') continue;
      const ticks = g.want === 'everyTag' ? ticksOfTag(g.tag) : [idx(g.moment)];
      const bySkill = ticks.some(i => grid[i] && grid[i].some(x => x.mode === 'match'));
      const humanTick = ticks.find(i => !M[i].byAi);
      if (bySkill && humanTick != null) {
        r.fail(`${M[humanTick].clock} — ${M[humanTick].label}. 이 순간에는 AI가 없었다.`);
        r.fault('AI 판단에 맡긴 자리',
          '스킬은 AI가 그 일을 할 때만 돈다. 사람이 직접 한 순간은 그냥 지나갔다', 8);
      }
    }

    // 헛발동 — 아무도 필요로 하지 않은 자리에서 돈 것
    const waste = all.filter(f => f.mode !== 'lane' && !needed.has(f.tick)).length +
                  presses.filter(p => !needed.has(p.tick) && !needed.has(p.tick - 1)).length;
    if (waste > 0) {
      const n = Math.min(waste, 3);
      for (let k = 0; k < n; k++) {
        r.fault('헛발동', '오늘 아무도 필요로 하지 않은 자리에서 돌았다. 발동은 공짜가 아니다', 4);
      }
    }

    // ---- 잘한 점 ----

    if (met.g2) {
      r.gain('예외 없는 자리', '나가기 직전을 사람 판단이 아니라 고정된 장치로 막았다', 0);
    }
    if (met.g5) {
      r.gain('부르지 않아도 도는 것', '같은 일이 반복되는 자리를 스킬에 맡겨 손을 뗐다', 0);
    }
    if (met.g4) {
      r.gain('따로 돌린 일', '오래 걸리는 일을 미리 갈라 두어 회의 전에 요약을 받았다', 0);
    }
    if (met.g3) {
      r.gain('제때 부른 것', '커맨드는 부르지 않으면 아무 일도 안 일어난다는 걸 알고 눌렀다', 0);
    }

    const count = d.goals.filter(g => met[g.id]).length;
    r.out(`지켜야 할 것 ${d.goals.length}가지 중 ${count}가지를 지켰다.`);

    return { ...r.finish({ pass: 85, partial: 45 }), met };
  },

  named: {
    all: '다섯을 가르는 것은 뜻이 아니라 언제 발동하느냐다. ' +
         '내가 불러야 도는 것이 **커맨드**, AI가 그 일을 할 때 알아서 꺼내는 것이 **스킬**, ' +
         '사람이 하든 AI가 하든 정해진 순간마다 도는 것이 **훅**, ' +
         '따로 돌다가 요약만 갖고 오는 것이 **서브에이전트**, ' +
         '이것들을 한 번에 깔아 주는 상자가 **플러그인**이다.'
  },

  debrief: {
    pass: '표시가 몇 개 찍히는지를 보고 골랐다면 제대로 고른 것이다.\n' +
          '훅과 스킬은 하는 일이 아니라 도는 조건이 다르다 — 사람이 한 순간에도 도는가.\n' +
          '오래 걸리는 일은 필요해지는 시점이 아니라 맡길 수 있는 시점에 갈라 둔다.',
    partial: '가장 자주 걸리는 자리는 둘이다.\n' +
             '안전장치를 스킬에 맡기면 사람이 직접 한 순간을 그냥 지나간다.\n' +
             '서브에이전트를 필요해지는 순간에 걸면 그때부터 돌기 시작해서 늦는다.',
    fail: '상자를 열지 않으면 도구가 둘뿐이라 다섯을 지킬 수 없다.\n' +
          '플러그인은 걸 수 있는 도구가 아니라 도구가 든 상자다 — 그게 이 판의 첫 단추다.\n' +
          '커맨드는 손에 남는다. 하루가 도는 동안 직접 눌러야 발동한다.'
  }
};
