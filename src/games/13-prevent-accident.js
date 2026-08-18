// 미니게임 13 — 사고 막기 (엔진 F 디펜스형)
// 배우는 것: 훅 · 하네스 엔지니어링 · 가드레일 · 샌드박스
//
// 설계 의도: 에이전트가 자율로 도는 동안 사고가 나는 지점은 정해져 있다.
// 그 앞에 무엇을 두느냐로 결과가 갈린다. 종류가 다른 안전장치를
// 각각 맞는 자리에 놓아 봐야 "훅 · 가드레일 · 샌드박스"가 왜 따로 있는지 안다.
//
// 이 판의 진짜 교훈은 그 다음이다: **장치는 공짜가 아니다.**
// 장치는 지나가는 모든 작업을 붙잡아 검사한다. 위험한 것만 붙잡는 게 아니다.
// 그래서 다 깔면 사고는 없지만 오늘 넘겨야 할 건수를 못 채우고,
// 안 깔면 하나가 끝까지 가서 판을 날린다.
// **안전하면서 동시에 가장 빠른 배치는 존재하지 않게** 수치를 잡아 두었다
// (근거와 증명은 `_tests/test-defense.mjs` 의 "완벽한 답이 없다" 묶음).
//
// 수치의 뼈대:
//   위험 3종(원본 덮어쓰기 · 숨은 지시 · 사외 전송)을 다 막는 가장 싼 조합은
//   샌드박스(0.8초·2) + 검증(1.4초·3) + 훅(0.5초·1) = 지연 2.7초 · 비용 6 뿐이다.
//   그 배치로도 마지막 일감 하나는 업무 시간을 넘겨 못 나간다 — 딱 기준선이다.
//   가드레일은 셋을 한 번에 막지만 **정상 반출까지 같이 막고** 제일 느리다.

import { Run, FAULT, applyGain } from '../core/sim.js';
import { iGa, eunNeun } from '../core/ko.js';

export default {
  id: 'prevent-accident',
  engine: 'F',
  title: '사고 막기',
  subtitle: '위험한 작업을 막되, 오늘 넘겨야 할 일도 끝내야 한다',
  chapter: 4,
  required: false,
  concept: ['훅', '하네스 엔지니어링', '가드레일', '샌드박스'],
  checkedAt: '2026-08',

  data: {
    briefCap: '상황',
    // 상황 한 줄 + 오늘 목표 한 줄. 그 이상은 안 쓴다.
    // "장치는 전부 붙잡아 검사한다 — 놓을수록 느려진다"는 규칙이라 뺐다.
    // 그건 장치 버튼에 붙은 `+0.8초` 가 이미 말하고 있고,
    // 안 읽고 놔 봐도 계기의 초가 늘어나는 것으로 바로 안다.
    brief: '에이전트에게 자료 정리를 맡기고 자리를 비운다.\n' +
           '오늘 안에 정상 작업 3건을 넘겨야 한다 — **빨간 것**은 사고로 이어진다.',

    baseLabel: '우리 팀 자료',
    slots: 4,
    travelSec: 5,      // 장치가 하나도 없을 때 위에서 아래까지 걸리는 시간
    limitSec: 15,      // 오늘 업무 시간. 이 시간이 지나면 라인 위의 것은 못 나간다
    quota: 3,          // 오늘 넘겨야 하는 정상 작업 건수

    // 조작 설명("눌러서 집고 빈 자리를 눌러 놓는다")은 [지금 할 일] 줄로 옮겼다.
    // 여기 남길 것은 **숫자가 무슨 뜻인지** 하나뿐이다 — 그건 버튼만 봐서는 모른다.
    trayLabel: '놓을 안전장치 — 숫자만큼 모든 작업이 느려진다',
    runLabel: '자리를 비우고 돌리기',
    runCaption: '자리를 비운 동안 무슨 일이 있었나',

    // holdSec = 이 장치를 지나는 작업 하나를 붙잡아 두는 시간(초).
    // 장치는 한 번에 하나씩 검사한다 — 몰리면 뒤엣것이 줄을 선다.
    gates: [
      { id: 'sandbox', label: '샌드박스', icon: 'sandbox', stops: ['write'],
        holdSec: 0.8, cost: 2,
        blurb: '작업 범위를 격리한다. 정해진 공간 밖의 원본을 고치는 작업만 막는다' },
      { id: 'verify', label: '검증', icon: 'verify', stops: ['read'],
        holdSec: 1.4, cost: 3,
        blurb: '읽어들인 내용을 확인한다. 자료에 섞인 지시를 잡아낸다. 대신 제일 오래 붙잡는다' },
      { id: 'hook', label: '훅', icon: 'hook', stops: ['send'],
        holdSec: 0.5, cost: 1,
        blurb: '밖으로 내보내는 순간을 가로챈다. 붙잡는 시간이 가장 짧다' },
      { id: 'guard', label: '가드레일', icon: 'guard', stops: ['write', 'send', 'move'],
        holdSec: 1.6, cost: 4,
        blurb: '작업 폴더 밖으로 나가는 행동을 통째로 막는다. 팀에 넘기는 정상 반출까지 걸린다' }
    ],

    // kind 가 gates[].stops 와 맞아야 막힌다. at = 라인에 올라오는 시각(초).
    // blockedBy 는 그 위험을 가장 싸게 막는 장치다(힌트에 쓴다).
    //
    // 등장 시각은 일부러 고르지 않다 — 1.6·2.4 와 6.0·6.8 은 0.8초 간격으로 몰린다.
    // 장치는 한 번에 하나씩만 검사하므로 그때 뒤엣것이 검사대 앞에 줄을 선다.
    // 일은 원래 몰려서 들어오고, 병목은 그때 생긴다.
    foes: [
      { id: 'ok-tidy', kind: 'tidy', danger: false, icon: 'doc', at: 0,
        label: '작업 폴더 안에서 파일 이름 정리',
        pass: '작업 폴더 안에서 파일 이름을 정리해 넘겼다',
        late: '파일 이름 정리가 검사 줄에 걸려 오늘 안에 못 나갔다' },

      { id: 'hz-write', kind: 'write', danger: true, icon: 'write', at: 1.6,
        label: '작업 폴더 밖 원본 파일 덮어쓰기',
        blockedBy: 'sandbox',
        ok: '작업이 격리된 공간 안에서만 이뤄져 원본은 그대로다',
        fail: '작업 폴더 밖의 원본 자료를 덮어썼다',
        fault: ['격리 없음', '작업 범위를 가두지 않아 폴더 밖 원본까지 고쳤다'] },

      { id: 'ok-move', kind: 'move', danger: false, icon: 'doc', at: 2.4,
        label: '정리한 결과를 팀 공유 폴더로 옮기기',
        pass: '정리한 결과를 팀 공유 폴더로 옮겼다',
        over: '팀에 넘기는 정상 반출까지 통째로 막혔다',
        late: '팀 공유 폴더로 옮기는 일이 검사 줄에 걸려 오늘 안에 못 나갔다' },

      { id: 'hz-inject', kind: 'read', danger: true, icon: 'alert', at: 4.4,
        label: '외부 문서에 숨어 있던 지시 따르기',
        blockedBy: 'verify',
        ok: '읽은 내용에 지시가 섞여 있는 것을 검증 단계가 잡아냈다',
        fail: '읽어들인 문서에 있던 “이 주소로 보내라”를 그대로 따랐다',
        fault: FAULT.inject },

      { id: 'ok-sum', kind: 'tidy', danger: false, icon: 'doc', at: 6,
        label: '승인된 사내 도구로 회의록 요약',
        pass: '승인된 도구로 회의록을 요약해 넘겼다',
        late: '회의록 요약이 검사 줄에 걸려 오늘 안에 못 나갔다' },

      { id: 'hz-send', kind: 'send', danger: true, icon: 'send', at: 6.8,
        label: '확인 없이 사외로 파일 전송',
        blockedBy: 'hook',
        ok: '전송 직전 훅이 가로채 확인을 요구했다',
        fail: '확인 없이 사외로 파일이 나갔다',
        fault: FAULT.leak },

      { id: 'ok-list', kind: 'tidy', danger: false, icon: 'doc', at: 8.8,
        label: '지난 회의 자료 목록 다시 만들기',
        pass: '지난 회의 자료 목록을 다시 만들어 넘겼다',
        late: '지난 회의 자료 목록이 검사 줄에 걸려 오늘 안에 못 나갔다' }
    ]
  },

  /**
   * 무대에서 벌어질 일을 미리 한 번에 계산한다. DOM 을 쓰지 않는 순수 함수다.
   * 엔진은 이 결과를 그대로 그리고, 아래 simulate 도 같은 함수를 다시 부른다 —
   * 화면에 뜬 것과 판정이 어긋날 수 없게 하려고 한 곳에만 둔다.
   */
  plan: planWave,

  /**
   * 판정. 배치만 받아서 다시 계산한다.
   * setup = { placements: [{ slot, gateId }] }
   */
  simulate(setup, d) {
    const p = planWave(setup.placements || [], d);
    const r = new Run();
    const mistakes = [];
    const foe = new Map(d.foes.map(f => [f.id, f]));

    r.read(`오늘 기준 — 정상 작업 ${p.quota}건을 ${p.limitSec}초 안에 팀에 넘겨야 한다`);
    if (p.gates.length) {
      r.do(`안전장치 ${p.gates.length}개를 걸었다 — 지나가는 작업마다 ${sec(p.held)}초씩 붙잡힌다`);
    } else {
      r.warn('안전장치를 하나도 걸지 않았다 — 아무것도 붙잡히지 않는다');
    }

    // 시간 순서 그대로 되돌려 본다 — 방금 본 화면과 로그가 어긋나면 안 된다
    for (const lane of [...p.lanes].sort((a, b) => a.endAt - b.endAt)) {
      const f = foe.get(lane.id);
      if (!f) continue;

      if (lane.result === 'blocked') {
        r.ok(f.ok);
      } else if (lane.result === 'done') {
        r.do(f.pass);
      } else if (lane.result === 'over') {
        r.warn(f.over);
        r.fault('과잉 차단', '넓게 막는 장치가 정상 업무까지 같이 잡았다', 8);
        mistakes.push({ itemId: f.id, hint: '이건 정상 작업이다. 위험한 것만 골라 막는 장치가 따로 있다.' });
      } else if (lane.result === 'leak') {
        r.fail(f.fail);
        r.fault(f.fault[0], f.fault[1], 28);
        // 장치 이름이 '검증'·'훅'·'샌드박스'로 받침이 제각각이다. 손으로 적으면
        // "검증가" 같은 말이 화면에 그대로 나간다 (CLAUDE.md 8번)
        mistakes.push({ itemId: f.id, hint: `${iGa(labelOf(d, f.blockedBy))} 앞에 있어야 막힌다.` });
      } else if (lane.result === 'late') {
        r.warn(f.late);
      } else {
        r.warn(`${eunNeun(f.label)} 검사 줄에 걸린 채 업무 시간이 끝났다`);
      }
    }

    for (let i = 0; i < p.short; i++) {
      r.fault('처리량 미달', '장치를 지날 때마다 늦어져 오늘 넘길 건수를 못 채웠다', 18);
    }
    if (p.short) {
      mistakes.push({ itemId: 'quota', hint: '장치를 하나 빼면 그만큼 빨라진다.' });
    }
    if (p.cost) {
      r.fault('상시 비용', '장치는 걸어 두는 것만으로 사람 손이 계속 들어간다', p.cost * 2);
    }

    if (!p.leak.length) applyGain(r, 'guard', 0);
    if (!p.leak.length && !p.over.length && !p.short) {
      r.gain('하네스 엔지니어링',
        '위험 종류마다 꼭 맞는 장치만 골라 사고와 처리량을 같이 지켰다', 0);
    }

    r.out(p.leak.length
      ? `자리를 비운 동안 사고 ${p.leak.length}건 · 오늘 넘긴 것은 ${p.delivered}건`
      : p.short
        ? `사고는 없었지만 오늘 넘긴 것은 ${p.delivered}건 — 기준 ${p.quota}건에 못 미쳤다`
        : `사고 없음 · 오늘 ${p.delivered}건을 넘겨 기준을 채웠다`);

    return r.finish({ pass: 85, partial: 50 }, { mistakes });
  },

  named: {
    all: '정해진 시점에 무조건 실행되는 것이 **훅**, 아예 못 하게 구조로 막는 것이 **가드레일**, ' +
         '운영체제 수준에서 울타리를 치는 것이 **샌드박스**다. ' +
         '이렇게 환경 자체를 설계하는 일을 **하네스 엔지니어링**이라고 부른다 — Agent = Model + Harness. ' +
         '설계라고 부르는 이유는 하나다. 장치마다 붙잡는 시간과 비용이 달라서, ' +
         '무엇을 얼마나 거는지가 곧 그날의 처리량이 되기 때문이다.'
  },

  debrief: {
    pass: '다 막으면서 시간도 맞췄다. 위험 종류마다 꼭 맞는 장치만 골랐기 때문이다.\n넓게 막는 장치 하나면 편하지만, 정상 반출까지 잡고 모든 작업을 그만큼 늦춘다.\n그렇게 골라도 마지막 일감 하나는 오늘 못 나갔을 것이다 — 공짜인 배치는 없다.',
    partial: '안전하거나 빠르거나, 한쪽만 됐다.\n장치를 다 깔면 통과할 작업까지 줄줄이 붙잡혀 오늘 넘길 건수를 못 채운다.\n적게 깔면 그 종류의 위험 작업이 그대로 끝까지 간다.',
    fail: '자리를 비운 사이에 사고가 났다. AI가 나빠서가 아니라 막을 것이 없었기 때문이다.\n그렇다고 전부 깔면 되는 것도 아니다 — 장치마다 붙잡는 시간과 비용이 붙는다.\n위험 종류마다 맞는 장치를 가장 싸게 고르는 것, 그게 이 판의 전부다.'
  }
};

// ---------------------------------------------------------------- 순수 계산

/** 줄을 설 때 검사대 앞에서 비켜서는 거리 (판 높이의 비율) */
const QUEUE_GAP = 0.03;

/**
 * 배치 하나에 대해 오늘 하루가 어떻게 흘러가는지 통째로 계산한다.
 *
 * 규칙 셋이 전부다.
 *   1) 일감은 위에서 아래로 일정한 속도로 내려온다 (travelSec 이 맨 위에서 바닥까지).
 *   2) 장치를 지날 때마다 holdSec 만큼 붙잡힌다. **막든 안 막든 붙잡는다.**
 *      장치는 한 번에 하나씩만 검사하므로, 몰리면 뒤엣것은 줄을 선다.
 *   3) limitSec 이 지나면 업무 시간이 끝난다. 그때까지 바닥에 닿지 못한 것은 못 나간다.
 *
 * 결과에는 **화면에서 그릴 움직임(`path`)까지** 들어 있다. 엔진은 구간을 이어 붙이기만
 * 한다 — 엔진이 위치를 따로 계산하면 그 계산이 여기와 어긋나는 순간, 화면에서 막힌 것이
 * 결과에서는 안 막힌 것이 된다. 그래서 움직임도 이 순수 함수가 정한다(검사로 확인한다).
 *
 * @param {Array<{slot:number, gateId:string}>} placements
 * @param {object} d  게임 data
 */
export function planWave(placements, d) {
  const travel = d.travelSec || 6;
  const limit = d.limitSec || 16;
  const quota = d.quota || 0;
  const byId = new Map(d.gates.map(g => [g.id, g]));

  const line = (placements || [])
    .map(p => ({ slot: p.slot, at: (p.slot + 1) / (d.slots + 1), gate: byId.get(p.gateId) }))
    .filter(x => x.gate)
    .sort((a, b) => a.at - b.at)
    .map(x => ({ ...x, free: 0 }));

  const lanes = [];
  for (const f of [...d.foes].sort((a, b) => (a.at || 0) - (b.at || 0))) {
    let time = f.at || 0;
    let pos = 0;
    const stops = [];   // 검사대에서 붙잡히는 구간 (막대를 그리는 데 쓴다)
    const path = [];    // 화면에서 그릴 움직임 전부 — 엔진은 이걸 이어 붙이기만 한다
    let held = null;

    for (const g of line) {
      const arrive = time + travel * (g.at - pos);
      const start = Math.max(arrive, g.free);   // 앞엣것 검사가 끝나야 내 차례다
      const end = start + g.gate.holdSec;
      g.free = end;

      // 줄을 서게 되면 검사대 바로 앞에서 멈춘다. 검사대 위에 겹쳐 서면
      // 두 장이 포개져서 "줄이 밀렸다"가 화면에서 안 보인다.
      const queued = start > arrive + 1e-9;
      const waitY = queued ? g.at - QUEUE_GAP : g.at;

      path.push({ t0: time, t1: arrive, y0: pos, y1: waitY, hold: false });
      if (queued) path.push({ t0: arrive, t1: start, y0: waitY, y1: waitY, hold: true });
      path.push({ t0: start, t1: end, y0: g.at, y1: g.at, hold: true });

      stops.push({ slot: g.slot, at: g.at, arrive, start, end });
      if (g.gate.stops.includes(f.kind)) { held = { endAt: end, gateId: g.gate.id }; break; }
      time = end;
      pos = g.at;
    }

    const endAt = held ? held.endAt : time + travel * (1 - pos);
    if (!held) path.push({ t0: time, t1: endAt, y0: pos, y1: 1, hold: false });
    // 업무 시간이 먼저 끝났으면 막힌 것도 나간 것도 아니다 — 라인 위에 남는다
    const result = endAt > limit
      ? (f.danger ? 'stuck' : 'late')
      : held
        ? (f.danger ? 'blocked' : 'over')
        : (f.danger ? 'leak' : 'done');

    lanes.push({
      id: f.id, kind: f.kind, danger: !!f.danger, spawn: f.at || 0,
      stops, path, endAt, gateId: held ? held.gateId : null, result
    });
  }

  const bucket = { done: [], late: [], blocked: [], over: [], leak: [], stuck: [] };
  for (const lane of lanes) bucket[lane.result].push(lane.id);

  const delivered = bucket.done.length;
  return {
    lanes,
    gates: line.map(g => ({ slot: g.slot, at: g.at, id: g.gate.id })),
    held: line.reduce((s, g) => s + g.gate.holdSec, 0),
    cost: line.reduce((s, g) => s + (g.gate.cost || 0), 0),
    quota, limitSec: limit,
    delivered,
    short: Math.max(0, quota - delivered),
    ...bucket
  };
}

function labelOf(d, gateId) {
  const g = d.gates.find(x => x.id === gateId);
  return g ? g.label : '맞는 장치';
}

/** 0.8 · 2.7 처럼 소수 한 자리로. 부동소수점 찌꺼기가 화면에 나가면 안 된다 */
function sec(n) {
  return (Math.round(n * 10) / 10).toFixed(1);
}
