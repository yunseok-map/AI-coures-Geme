// 어느 갈래로 가면 무엇을 치르고 무엇이 남는가 — 도구 지형의 계산.
//
// 왜 core 에 있나: 엔진 N(지형 답사)이 이 함수로 "이 길로 가면" 미리보기를 그리고,
// 17번 판의 simulate() 가 **같은 함수**로 판정한다. 두 곳이 각자 계산하면
// 화면에서 본 발품과 결과가 어긋나고, 그러면 그 판은 아무것도 못 가르친다.
// core/dispatch.js · core/fire.js · core/graph.js 와 같은 이유다.
//
// 이 판이 가르치려는 것은 **도구 고르기는 정답 맞히기가 아니라 지형 읽기**라는 것이다.
// 같은 일을 여러 갈래가 다 할 수 있고, 갈리는 것은 되냐 안 되냐가 아니라 대가다:
//   ① 손이 얼마나 가는가 (발품)
//   ② 결과가 남는가       (다음에 또 할 때 처음부터 안 해도 되는가)
//   ③ 남에게 넘어가는가   (내가 없어도 다른 사람이 이어받는가)
//
// 그리고 **애그리게이터**는 여기서 특별하다 — 벽이 없고 제일 싸다. 대신
// 남지도 넘어가지도 않고 얕다. "그냥 다 되는 거 아니야?"가 왜 답이 아닌지는
// 설명이 아니라 이 숫자들로 드러나야 한다.

/**
 * 장비가 없으면 **아예 못 하는** 일. 딱 두 가지뿐이다.
 * 나머지는 어느 갈래에서도 되기는 된다 — 다만 먼 길이다.
 * (벽을 늘리면 "정답 통 고르기"로 되돌아간다. 늘리지 말 것.)
 */
export const HARD = ['make', 'listen'];

/** 벽에 부딪혀 되돌아올 때도 발품은 이미 나갔다 */
export const WALL_LEGWORK = 2;

/** 전담 갈래가 아닌 곳으로 돌아갈 때 더 드는 발품 */
export const DETOUR_LEGWORK = 2;

/**
 * 그 갈래가 이 종류의 일을 하기는 하는가.
 * `all` 이 붙은 갈래(애그리게이터)에는 벽이 없다 — 그게 그 갈래의 정체다.
 */
export function can(terrain, kind) {
  if (!terrain) return false;
  if (terrain.all) return true;
  if (!HARD.includes(kind)) return true;
  return (terrain.does || []).includes(kind);
}

/**
 * 이 의뢰를 이 갈래로 가져가면 어떻게 되는가.
 *
 * @param {{kind:string, asks:string[]}} job
 * @param {{id:string, legwork:number, does?:string[], all?:boolean, keeps?:boolean, hands?:boolean}} terrain
 * @returns {{ok:boolean, legwork:number, why:string, own:boolean, met:string[], missed:string[]}}
 *   ok=false 는 **되돌아온다**는 뜻이다. 발품은 이미 나갔고 의뢰는 그대로 남는다.
 *   why 는 화면과 판정이 같이 읽는 사유 키다 (문구는 콘텐츠 쪽에 있다):
 *     ''        전담 갈래로 곧장 갔다
 *     'detour'  되기는 되는데 먼 길이다
 *     'shallow' 한 창에서 얕게 끝난다 (애그리게이터)
 *     'wall'    그 갈래에는 이 일을 하는 길이 없다
 */
export function route(job, terrain) {
  const asks = (job && job.asks) || [];

  if (!can(terrain, job && job.kind)) {
    return { ok: false, legwork: WALL_LEGWORK, why: 'wall', own: false, met: [], missed: asks.slice() };
  }

  // 전담 갈래인가. 애그리게이터는 전부 하지만 전담은 아니다 —
  // 그래서 '제대로 파야 한다'는 요구를 영영 못 채운다.
  const own = !terrain.all && (terrain.does || []).includes(job.kind);
  const legwork = terrain.legwork + (own || terrain.all ? 0 : DETOUR_LEGWORK);
  const why = terrain.all ? 'shallow' : own ? '' : 'detour';

  // 이 갈래가 실제로 갖고 있는 것. 요구와 맞대 보는 것이 이 판의 전부다.
  const has = { deep: own, keep: !!terrain.keeps, hand: !!terrain.hands };
  const met = asks.filter(a => has[a]);
  const missed = asks.filter(a => !has[a]);

  return { ok: true, legwork, why, own, met, missed };
}

/**
 * 고른 순서대로 다시 걸어 본다 — 판정이 쓰는 재생기.
 *
 * 순서가 결과를 바꾼다: 앞에서 발품을 흘리면 뒤의 의뢰는 싼 길밖에 못 고른다.
 * 그래서 목록이 아니라 **순서 있는 재생**이어야 한다.
 *
 * @param {Array} jobs
 * @param {Array} terrains
 * @param {Array<{jobId:string, terrainId:string}>} picks  고른 순서
 * @param {number} budget  오늘 쓸 수 있는 발품
 * @returns {{steps:Array, done:Set, undone:string[], spent:number, left:number}}
 */
export function walk(jobs, terrains, picks, budget) {
  const list = jobs || [];
  const jobOf = (id) => list.find(j => j.id === id);
  const terrainOf = (id) => (terrains || []).find(t => t.id === id);

  const total = Number.isFinite(budget) ? budget : 0;
  let left = total;
  const steps = [];
  const done = new Set();

  for (const p of picks || []) {
    const job = jobOf(p && p.jobId);
    const terrain = terrainOf(p && p.terrainId);
    if (!job || !terrain) continue;
    if (done.has(job.id)) continue;   // 이미 끝낸 의뢰는 두 번 세지 않는다

    const r = route(job, terrain);

    // 발품이 모자라면 그 길로는 못 간다. 아무 일도 안 일어나고 발품도 안 나간다.
    if (r.legwork > left) {
      steps.push({ jobId: job.id, terrainId: terrain.id, ...r, afford: false, legwork: 0 });
      continue;
    }

    left -= r.legwork;
    steps.push({ jobId: job.id, terrainId: terrain.id, ...r, afford: true });
    if (r.ok) done.add(job.id);
  }

  const undone = list.filter(j => !done.has(j.id)).map(j => j.id);
  return { steps, done, undone, spent: total - left, left };
}
