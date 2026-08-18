// 권한 게이트 규칙 — 엔진 M(화면)과 9번 판의 simulate(판정)가 **같이 본다.**
//
// 여기 있는 것은 딱 하나다: **동작 하나가 지금 열린 문을 지나갈 수 있는가.**
// 업무 동작이든 공격 동작이든 판단 규칙이 똑같다는 것이 이 판의 전부다 —
// 통로는 누가 지나가는지 모른다. 열려 있으면 지나간다.
//
// 그래서 이 모듈은 '업무'와 '공격'을 구분하지 않는다. 구분은 게임 데이터가 한다.

/** 시스템 하나의 문 하나를 가리키는 열쇠 */
export function key(sysId, gateId) { return `${sysId}:${gateId}`; }

/** 지금 그 문이 열려 있는가. open 은 열쇠 문자열의 Set 또는 배열 */
export function isOpen(open, sysId, gateId) {
  const k = key(sysId, gateId);
  return open instanceof Set ? open.has(k) : (open || []).includes(k);
}

/** 열쇠 목록을 Set 으로. 배열·Set 어느 쪽이 와도 같게 다룬다 */
export function asSet(open) {
  return open instanceof Set ? open : new Set(open || []);
}

/**
 * 동작들을 차례로 흘려 본다.
 *
 * step = { id, sys, gate, ok, no }
 *   ok  통과했을 때 로그에 남길 말
 *   no  막혔을 때 로그에 남길 말
 *
 * 반환 = [{ ...step, passed }] — 순서는 그대로다.
 */
export function runSteps(steps, open) {
  const set = asSet(open);
  return (steps || []).map(s => ({ ...s, passed: set.has(key(s.sys, s.gate)) }));
}

/** 업무가 반드시 지나가야 하는 문 — 열쇠 Set */
export function needOf(steps) {
  return new Set((steps || []).map(s => key(s.sys, s.gate)));
}

/**
 * 업무에 필요 없는데 열어 둔 문.
 *
 * 이 목록이 곧 **공격이 쓸 수 있는 통로**다. 그래서 '남은 권한'과
 * '공격 경로'가 이 판에서는 같은 말이 된다.
 */
export function extras(open, workSteps) {
  const need = needOf(workSteps);
  return [...asSet(open)].filter(k => !need.has(k));
}

/** 업무에 필요한데 안 연 문 */
export function missing(open, workSteps) {
  const set = asSet(open);
  return [...needOf(workSteps)].filter(k => !set.has(k));
}

/** 시스템 하나에 열린 문의 개수 = 케이블 굵기 */
export function width(sys, open) {
  const set = asSet(open);
  return (sys.gates || []).filter(g => set.has(key(sys.id, g.id))).length;
}

/** 열린 문 전체 개수 */
export function total(open) { return asSet(open).size; }
