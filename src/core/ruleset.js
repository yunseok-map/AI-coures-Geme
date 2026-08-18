// 지침서에 적은 규칙이 **실제로 발동하는가**를 계산한다.
//
// 왜 core 에 있나: 엔진 C 가 실행 뒤 부품에 붙이는 표시와 10번 판의 simulate()
// 판정이 **같은 함수**를 봐야 한다. 화면에는 "발동" 이라 적혀 있는데 점수는
// 안 쳐 주면 그 판은 수리형이 될 수 없다 — 고칠 단서가 거짓이기 때문이다.
// (core/fire.js · core/bag.js 와 같은 이유)
//
// 지침 파일이 조용히 망가지는 방식 셋. 어느 것도 오류를 내지 않는다.
//
//   dropped 분량을 넘겨 뒤로 밀린 줄. 아예 안 읽힌다.
//   beaten  같은 자리를 다투는 규칙이 둘. 하나가 조용히 진다.
//           **더 구체적으로 행동을 지시하는 쪽**(force 가 큰 쪽)이 이긴다.
//           같으면 나중에 적힌 쪽이 이긴다.
//   vague   무엇을 하라는지 정해지지 않은 줄. 발동은 하는데 결과를 못 바꾼다.
//
// 여기 있는 것은 규칙이지 콘텐츠가 아니다 — 규칙 문구도 한국어 표시도 모른다.

export const FIRED = 'fired';
export const BEATEN = 'beaten';
export const DROPPED = 'dropped';
export const VAGUE = 'vague';

/**
 * @param {Array<{id:string, topic?:string, force?:number, vague?:boolean}>} rules
 * @param {string[]} kept     지침서에 실제로 들어간 규칙 (적은 순서)
 * @param {string[]} dropped  분량을 넘겨 밀린 규칙
 * @returns {Map<string, {id:string, state:string, by?:string}>}
 */
export function resolve(rules, kept, dropped = []) {
  const byId = new Map((rules || []).map(r => [r.id, r]));
  const out = new Map();

  for (const id of dropped) {
    if (byId.has(id)) out.set(id, { id, state: DROPPED });
  }

  const live = (kept || []).filter(id => byId.has(id) && !out.has(id));

  // 같은 자리를 다투는 것끼리 묶는다
  const groups = new Map();
  for (const id of live) {
    const t = byId.get(id).topic;
    if (!t) continue;
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(id);
  }

  const lost = new Map();
  for (const [, ids] of groups) {
    if (ids.length < 2) continue;
    let win = ids[0];
    for (const id of ids.slice(1)) {
      if ((byId.get(id).force ?? 1) >= (byId.get(win).force ?? 1)) win = id;
    }
    for (const id of ids) if (id !== win) lost.set(id, win);
  }

  for (const id of live) {
    if (lost.has(id)) out.set(id, { id, state: BEATEN, by: lost.get(id) });
    else if (byId.get(id).vague) out.set(id, { id, state: VAGUE });
    else out.set(id, { id, state: FIRED });
  }
  return out;
}

/** 이 규칙이 실제로 일에 영향을 줬는가 */
export function fired(res, id) {
  return res.get(id)?.state === FIRED;
}

/** 상태별 개수 — 결과 화면의 "발동 N · 무시 M" */
export function tally(res) {
  const n = { fired: 0, beaten: 0, dropped: 0, vague: 0 };
  for (const r of res.values()) n[r.state]++;
  return n;
}
