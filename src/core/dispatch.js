// 일감을 어느 창구로 보내면 얼마나 걸리는가.
//
// 왜 core 에 있나: 엔진 R(실시간 관제)이 이 함수로 진행 막대 길이를 정하고,
// 5번 판의 simulate() 가 같은 함수로 판정한다. 두 곳이 각자 계산하면
// 화면에서 본 시간과 결과가 어긋난다. core/fire.js·core/graph.js 와 같은 이유다.
//
// 이 판이 가르치려는 것은 **표면 선택은 정답이 아니라 비용**이라는 것이다.
// 그래서 대부분의 조합은 "틀림"이 아니라 "더 걸림"으로 끝난다.
// 진짜 벽은 둘뿐이다 — 내 컴퓨터의 파일을 건드리는 일과, 여러 단계를 통째로
// 맡기는 일. 이 둘은 다른 창구에서 시간만 먹고 되돌아온다.

/** 그 창구가 아니면 아예 못 하는 일 */
export const WALL = { file: 'cli', multi: 'cowork' };

export function can(surfaceId, needs) {
  const only = WALL[needs];
  return !only || only === surfaceId;
}

export function newState() {
  return {
    loaded: new Set(),   // 프로젝트에 이미 올려 둔 배경 자료
    made: new Set()      // 아티팩트로 이미 만들어 둔 결과물
  };
}

/**
 * 이 일감을 이 창구로 보내면 몇 초가 걸리는가.
 *
 * @returns {{ok:boolean, sec:number, why:string}}
 *   ok=false 는 **되돌아온다**는 뜻이다. sec 만큼 시간은 이미 먹었다.
 *   why 는 화면과 판정이 같이 읽는 사유 키다 (문구는 콘텐츠 쪽에 있다).
 */
export function cost(item, surfaceId, state) {
  const base = item.sec;
  if (!can(surfaceId, item.needs)) return { ok: false, sec: base, why: 'wall' };

  switch (surfaceId) {
    // 채팅은 준비가 필요 없다. 대신 배경이 있는 일은 **매번 다시 설명해야 한다.**
    case 'chat':
      return item.bg
        ? { ok: true, sec: base + 3, why: 'explain' }
        : { ok: true, sec: base, why: '' };

    // 프로젝트는 자료를 올리는 첫 한 번이 비싸고, 그 다음부터 같은 배경은 공짜다.
    // 같은 배경 일감이 세 개 있으면 여기서 역전이 일어난다 — 그게 이 창구의 교훈이다.
    case 'project':
      if (!item.bg) return { ok: true, sec: base, why: '' };
      // 처음 한 번은 채팅보다 비싸야 한다. 안 그러면 "무조건 프로젝트"가 정답이 되어
      // 고민할 것이 사라진다. 세 번째에 역전되도록 3(설명)과 4(준비)를 잡았다.
      return state.loaded.has(item.bg)
        ? { ok: true, sec: base, why: 'ready' }
        : { ok: true, sec: base + 4, why: 'setup' };

    // 아티팩트는 결과물 단위다. 같은 결과물을 이어 고치면 빨라지고,
    // 결과물이 아닌 일을 여기서 하면 겉돈다.
    case 'artifact':
      if (item.needs !== 'artifact') return { ok: true, sec: base + 2, why: 'offtrack' };
      return state.made.has(item.bg)
        ? { ok: true, sec: Math.max(1, base - 1), why: 'again' }
        : { ok: true, sec: base, why: '' };

    // CLI 에이전트는 파일을 직접 건드릴 수 있는 유일한 창구다.
    // 그 외의 일도 되기는 되지만 먼 길로 돌아간다.
    case 'cli':
      return item.needs === 'file'
        ? { ok: true, sec: base, why: '' }
        : { ok: true, sec: base + 2, why: 'heavy' };

    // 통째로 맡기는 창구. 여러 단계짜리 일은 여기서만 끝나지만, 짧은 일을 맡기면
    // 그냥 오래 기다리는 것이 된다.
    case 'cowork':
      return { ok: true, sec: base * 2, why: item.needs === 'multi' ? 'whole' : 'oversize' };

    default:
      return { ok: true, sec: base, why: '' };
  }
}

/** 보내는 순간 창구에 남는 것. 처리가 끝날 때가 아니라 **보낼 때** 남는다. */
export function commit(item, surfaceId, state) {
  if (!item.bg) return state;
  if (surfaceId === 'project') state.loaded.add(item.bg);
  if (surfaceId === 'artifact' && item.needs === 'artifact') state.made.add(item.bg);
  return state;
}

/**
 * 보낸 순서대로 다시 돌려 본다 — 판정이 쓰는 재생기.
 *
 * 순서가 결과를 바꾼다(프로젝트에 자료를 언제 올렸느냐). 그래서 목록이 아니라
 * **순서 있는 재생**이어야 한다.
 *
 * @param {Array} items
 * @param {Array<{itemId:string, surfaceId:string}>} plan  보낸 순서
 * @returns {{runs:Array, byItem:Map, spent:number, bounced:number}}
 */
export function replay(items, plan) {
  const state = newState();
  const find = (id) => items.find(i => i.id === id);
  const runs = [];
  const byItem = new Map();
  let spent = 0, bounced = 0;

  for (const step of plan || []) {
    const item = find(step.itemId);
    if (!item) continue;
    const c = cost(item, step.surfaceId, state);
    commit(item, step.surfaceId, state);
    const run = { itemId: item.id, surfaceId: step.surfaceId, ...c, over: c.ok ? c.sec - item.sec : c.sec };
    runs.push(run);
    spent += c.sec;
    if (!c.ok) bounced++;
    else byItem.set(item.id, run);
  }
  return { runs, byItem, spent, bounced };
}
