// 도구가 **언제** 발동하는지 계산한다.
//
// 왜 core 에 있나: 엔진 T(발동 타임라인)가 이 함수로 미리보기 표시를 찍고,
// 8번 판의 simulate() 가 같은 함수로 판정한다. 두 곳이 각자 계산하면
// 화면에 찍힌 표시와 실제 결과가 어긋나고, 그러면 이 판은 아무것도 못 가르친다.
// 배선판이 core/graph.js 를 공유하는 것과 같은 이유다.
//
// 여기 있는 것은 **규칙**이지 콘텐츠가 아니다. 순간(moment)이 무슨 일인지,
// 도구 이름이 무엇인지는 이 파일이 모른다.
//
// 발동 방식 네 가지 — 이 넷의 차이가 8번 판이 가르치려는 전부다.
//
//   every  훅        : 같은 종류의 순간마다 **예외 없이**. 사람이 하든 AI가 하든.
//   match  스킬      : 같은 종류이면서 **AI가 하는 순간**에만. 사람이 직접 하면 안 돈다.
//   manual 커맨드    : 스스로는 절대 안 돈다. 내가 눌러야 한다.
//   lane   서브에이전트: 자기 차선에서 돌다가 **끝날 때 한 번** 요약을 갖고 돌아온다.

/** 서브에이전트가 기본으로 걸리는 시간(순간 수) */
const LANE_DUR = 3;

/**
 * 이 도구를 `at` 번째 순간에 걸면 어느 순간에 발동하는가.
 *
 * lane 은 타임라인 밖(=하루가 끝난 뒤)을 가리킬 수 있다. 잘라내지 않는다 —
 * **늦었다는 것을 판정이 알아야** 하기 때문이다. 화면에 그릴 때만 범위를 본다.
 *
 * @param {Array<{tag:string, byAi:boolean}>} moments
 * @param {{mode:string, dur?:number}} tool
 * @param {number|null} at
 * @returns {number[]} 발동하는 순간 번호. 오름차순.
 */
export function coverage(moments, tool, at) {
  if (!tool || at == null || at < 0 || at >= moments.length) return [];
  const here = moments[at];
  const out = [];

  switch (tool.mode) {
    case 'every':
      for (let i = 0; i < moments.length; i++) if (moments[i].tag === here.tag) out.push(i);
      return out;

    case 'match':
      for (let i = 0; i < moments.length; i++) {
        if (moments[i].tag === here.tag && moments[i].byAi) out.push(i);
      }
      return out;

    case 'lane':
      return [at + (tool.dur || LANE_DUR)];

    case 'manual':
    default:
      return [];
  }
}

/**
 * 서브에이전트가 차지하는 구간. 다른 도구에는 없다.
 * `to` 가 타임라인 길이 이상이면 하루 안에 못 돌아온 것이다.
 */
export function laneSpan(moments, tool, at) {
  if (!tool || tool.mode !== 'lane' || at == null || at < 0 || at >= moments.length) return null;
  return { from: at, to: at + (tool.dur || LANE_DUR) };
}

/**
 * 걸어 둔 것 전부를 펼쳐 하루치 발동 목록을 만든다.
 *
 * @param {Array} moments
 * @param {Array<{id:string, mode:string, dur?:number}>} tools
 * @param {Object<string, number>} placed  도구 id → 걸어 둔 순간 번호
 * @returns {Array<{toolId:string, mode:string, tick:number, from:number}>}
 *          tick 오름차순. `from` 은 걸어 둔 자리(차선의 출발점)다.
 */
export function firings(moments, tools, placed) {
  const out = [];
  for (const t of tools) {
    const at = placed[t.id];
    if (at == null) continue;
    for (const tick of coverage(moments, t, at)) {
      out.push({ toolId: t.id, mode: t.mode, tick, from: at });
    }
  }
  return out.sort((a, b) => a.tick - b.tick);
}

/**
 * 손으로 누른 것까지 합쳐, 순간별로 무엇이 발동했는지 모은다.
 *
 * @param {Array} moments
 * @param {Array} tools
 * @param {Object} placed
 * @param {Array<{toolId:string, tick:number}>} presses
 * @returns {Array<Array<{toolId:string, mode:string}>>} 순간 번호로 색인된 배열
 */
export function byTick(moments, tools, placed, presses = []) {
  const grid = moments.map(() => []);
  for (const f of firings(moments, tools, placed)) {
    if (f.tick >= 0 && f.tick < grid.length) grid[f.tick].push({ toolId: f.toolId, mode: f.mode });
  }
  for (const p of presses) {
    if (p.tick >= 0 && p.tick < grid.length) grid[p.tick].push({ toolId: p.toolId, mode: 'manual' });
  }
  return grid;
}
