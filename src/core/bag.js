// 책상 — 자료가 **회차마다** 들어오고, 칸이 넘치면 가장 오래된 것이
// **아무 말 없이** 흐려진다. 흐려진 자료는 사라지지 않는다. 그 자리에 그대로
// 있고, 나중에 꺼내 쓰면 **틀린 값**이 되어 있다.
//
// 왜 core 에 있나: 엔진 C 의 회차 모드가 이 함수로 책상을 그리고, 1번 판의
// simulate() 가 **같은 함수로** 판정한다. 두 곳이 각자 세면 화면에 남아 보이는
// 자료를 판정은 없다고 하는 일이 생기고, 그 순간 이 판은 아무것도 못 가르친다.
// (core/fire.js 가 발동 시점을 혼자 계산하는 것과 같은 이유)
//
// 여기 있는 것은 **규칙**이지 콘텐츠가 아니다 — 자료 이름도 회차 이름도 모른다.
// 요약본에 붙일 이름은 부르는 쪽이 넘겨준다.

/** 요약은 셋을 하나로 접는다 */
export const FOLD_N = 3;

/** 요약본이 차지하는 칸 */
export const FOLD_COST = 1;

const copy = d => ({
  cap: d.cap,
  folds: d.folds,
  items: d.items.map(i => ({ ...i })),
  gone: d.gone.map(i => ({ ...i })),
  log: d.log.slice()
});

/**
 * 빈 책상.
 * @param {number} cap 칸 수
 */
export function newDesk(cap = 6) {
  return { cap, folds: 0, items: [], gone: [], log: [] };
}

/**
 * 이번 회차 자료가 도착한다. 도착 순서가 곧 오래된 순서다.
 *
 * @param {object} desk
 * @param {Array<{id,label,cost,details}>} items
 * @param {number} round
 */
export function arrive(desk, items, round) {
  const d = copy(desk);
  for (const it of items || []) {
    d.items.push({
      id: it.id,
      label: it.label,
      cost: it.cost ?? 1,
      details: (it.details || []).map(x => ({ ...x })),
      at: round,
      blurAt: null,
      folded: false,
      from: null
    });
  }
  return settle(d, round);
}

/**
 * 칸을 다시 센다. 넘치는 만큼 **오래된 것부터** 흐려진다.
 *
 * 한 번 흐려진 것은 자리가 다시 나도 돌아오지 않는다 — 이미 상한 자료다.
 * 흐려진 것은 칸을 먹지 않는다(책상 밖으로 밀려난 상태).
 */
export function settle(desk, round) {
  const d = copy(desk);
  let used = 0, full = false;
  for (let i = d.items.length - 1; i >= 0; i--) {
    const it = d.items[i];
    if (it.blurAt != null) continue;
    if (!full && used + it.cost <= d.cap) { used += it.cost; continue; }
    full = true;                       // 하나가 안 들어가면 그보다 오래된 것도 못 들어간다
    it.blurAt = round;
    d.log.push({ kind: 'blur', round, id: it.id, label: it.label });
  }
  return d;
}

/**
 * 사람이 직접 내린다 — 무엇을 잃었는지 **아는** 유일한 경로다.
 */
export function takeOff(desk, id, round) {
  const at = desk.items.findIndex(x => x.id === id);
  if (at < 0) return desk;
  const d = copy(desk);
  const [it] = d.items.splice(at, 1);
  d.gone.push({ ...it, why: 'off', round });
  d.log.push({ kind: 'off', round, id: it.id, label: it.label });
  return settle(d, round);
}

/**
 * 셋을 하나로 접는다. 칸은 비지만 **세부 하나가 영구히 사라진다.**
 *
 * 무엇이 사라지는가: 접히는 자료를 도착 순서로 늘어놓고 그 **가운데** 세부.
 * 요약은 처음과 끝을 남기고 가운데를 흘린다 — 이 판이 겪게 하려는 것이 그것이다.
 * 무엇이 사라졌는지는 log 에만 적는다. 그때 알려 주면 조용히 사라지는 게 아니다.
 *
 * @param {string[]} ids  접을 자료 (흐려진 것은 못 접는다)
 * @param {string} name   요약본에 붙일 이름 — 콘텐츠라서 부르는 쪽이 준다
 */
export function fold(desk, ids, round, name) {
  const src = desk.items.filter(x => ids.includes(x.id) && x.blurAt == null);
  if (src.length !== FOLD_N) return desk;

  const d = copy(desk);
  const flat = [];
  for (const it of src) for (const dt of it.details) flat.push({ it, dt });
  const cut = flat.length ? flat[Math.floor(flat.length / 2)] : null;

  const n = d.folds + 1;
  d.items = d.items.filter(x => !src.some(s => s.id === x.id));
  d.items.push({
    id: `fold-${n}`,
    label: name || `fold-${n}`,
    cost: FOLD_COST,
    details: flat.filter(x => x !== cut).map(x => ({ ...x.dt })),
    at: round,
    blurAt: null,
    folded: true,
    from: src.map(x => x.label)
  });
  d.folds = n;
  for (const it of src) d.gone.push({ ...it, why: 'fold', round });
  d.log.push({
    kind: 'fold', round, id: `fold-${n}`,
    from: src.map(x => x.label),
    lost: cut ? cut.dt.id : null,
    lostLabel: cut ? cut.dt.label : null,
    lostFrom: cut ? cut.it.label : null
  });
  return settle(d, round);
}

/**
 * 세부 하나를 꺼내 본다. 이 판의 판정은 전부 이 함수 하나로 난다.
 *
 *   ok     그대로 있다
 *   wrong  흐려진 자료 안에 있다 — 꺼내 쓰면 틀린 값이다
 *   folded 요약할 때 사라졌다 (모르고 잃음)
 *   off    사람이 내렸다 (알고 잃음)
 *   never  책상에 온 적이 없다
 */
export function look(desk, detailId) {
  for (const it of desk.items) {
    const dt = it.details.find(x => x.id === detailId);
    if (dt) return {
      state: it.blurAt == null ? 'ok' : 'wrong',
      at: it.blurAt, where: it.label, detail: dt
    };
  }
  for (const g of desk.gone) {
    const dt = g.details.find(x => x.id === detailId);
    if (dt) return {
      state: g.why === 'fold' ? 'folded' : 'off',
      at: g.round, where: g.label, detail: dt
    };
  }
  return { state: 'never', at: null, where: null, detail: null };
}

/** 지금 칸을 차지하고 있는 것 */
export function live(desk) {
  return desk.items.filter(x => x.blurAt == null);
}

/** 흐려진 것 — 화면에는 남아 있지만 값을 믿을 수 없다 */
export function dimmed(desk) {
  return desk.items.filter(x => x.blurAt != null);
}

/** 쓰고 있는 칸 */
export function used(desk) {
  return live(desk).reduce((n, x) => n + x.cost, 0);
}

/** 남은 칸 */
export function free(desk) {
  return desk.cap - used(desk);
}
