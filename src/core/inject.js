// 숨은 지시 규칙 — 순수 함수. DOM 도, 특정 미니게임도 모른다.
//
// 왜 core 에 있나: 엔진 I 가 이 함수로 전반의 "심은 문장"과 후반의 "막는 범위"를
// 화면에 미리 그리고, 15번 판의 simulate() 가 **같은 함수**로 점수를 낸다.
// 둘이 각자 판단하면 화면에는 막혔다고 그려 놓고 점수는 뚫렸다고 매기는 일이 생긴다.
// core/graph.js · core/evidence.js 와 같은 이유로 여기 둔다.
//
// 이 판이 가르치려는 것은 하나다 — **데이터와 명령의 경계가 무너지는 것.**
// 그래서 규칙도 문장이 무서워 보이는지를 안 본다. 딱 세 가지만 본다.
//
//   ① 그 자리를 에이전트가 오늘 읽는가        (안 읽으면 애초에 시작이 안 된다)
//   ② 시킨 일을 할 도구가 에이전트에게 있는가  (공격의 상한은 가진 권한이다)
//   ③ 걸어 둔 대응책이 그 자리나 그 도구를 덮는가
//
// 자리(where)와 시킬 일(what)의 **글**은 전부 게임 파일에 있다. 여기서는
// where.origin(어느 쪽에서 들어온 글인가)과 what.tool(무슨 도구가 필요한가)만 본다.

/** 목록에서 id 로 하나 꺼낸다. 없으면 null */
export function byId(list, id) {
  return (list || []).find(x => x && x.id === id) || null;
}

/**
 * 심은 지시가 에이전트에게 닿는가.
 *
 * @param {{id:string, origin:string}} where  숨긴 자리
 * @param {{id:string, tool:string|null}} what  시킨 일. tool 이 null 이면 도구가 필요 없다
 * @param {{reads:string[], tools:string[]}} agent
 * @returns {{read:boolean, able:boolean, ok:boolean}}
 */
export function lands(where, what, agent) {
  const a = agent || {};
  const read = !!where && (a.reads || []).includes(where.id);
  const able = !!what && (!what.tool || (a.tools || []).includes(what.tool));
  return { read, able, ok: read && able };
}

/**
 * 심어 둔 한 벌 — 어디에 · 어떻게 숨겨서 · 무슨 문장을.
 *
 * 엔진은 이걸로 종이 위 미리보기를 그리고, 판정 로그도 같은 문장을 인용한다.
 * 화면에 보인 문장과 로그에 뜬 문장이 다르면 그 판은 아무것도 못 가르친다.
 */
export function craft(where, what) {
  return {
    place: where ? where.label : '',
    how: where ? where.hidden : '',
    line: what ? what.line : ''
  };
}

/** 문항 하나(고정 공격이든 내가 만든 것이든)를 실제 물건으로 만든다. */
export function build(spec, wheres, whats, agent) {
  const where = byId(wheres, spec && spec.where);
  const what = byId(whats, spec && spec.what);
  const hit = lands(where, what, agent);
  return { id: spec ? spec.id : '', label: spec ? spec.label : '', where, what, ...hit };
}

/**
 * 오늘 들어오는 공격 세 건.
 *
 * 내가 만든 공격이 안 통했으면 그 자리는 비어 있는 게 아니라 **공격자가 자리를 옮긴다.**
 * 한 번 실패했다고 그만두는 공격자는 없다 — 그래서 후반은 늘 세 건이다.
 */
export function lineup(fixed, mine, fallback) {
  return [...(fixed || []), (mine && mine.ok) ? mine : fallback];
}

/**
 * 대응책 하나가 이 공격을 구조로 막는가.
 *
 * 사람 승인(`stops.any`)은 여기서 false 다 — 사람은 용량이 있어서 defend() 가 따로 센다.
 */
export function stops(guard, atk) {
  const s = (guard && guard.stops) || {};
  if (s.any) return false;
  const where = (atk && atk.where) || {};
  const what = (atk && atk.what) || {};
  if (Array.isArray(s.origin) && s.origin.includes(where.origin)) return true;
  if (Array.isArray(s.tools) && what.tool && s.tools.includes(what.tool)) return true;
  return false;
}

/**
 * 걸어 둔 대응책으로 하루를 돌린다.
 *
 * 사람 승인은 **용량이 있다.** 구조로 막히지 않아 사람에게 넘어온 것이 용량보다
 * 많으면, 넘친 만큼은 그냥 통과한다. 이것이 자동화 편향이다 —
 * 확인할 것이 늘어날수록 사람은 내용을 안 보고 누른다.
 *
 * @returns {{rows:Array, gateId:string|null, cap:number, need:number, fatigue:boolean}}
 *   rows[i] = { id, by:string[], gate:boolean, stopped:boolean, through:boolean }
 */
export function defend(atks, guards) {
  const list = (guards || []).filter(Boolean);
  const gate = list.find(g => g.stops && g.stops.any) || null;
  const cap = gate ? (gate.capacity == null ? 1 : gate.capacity) : 0;

  const rows = (atks || []).map(a => {
    const by = list.filter(g => stops(g, a)).map(g => g.id);
    return { id: a.id, by, gate: false, stopped: by.length > 0, through: by.length === 0 };
  });

  // 구조로 안 막힌 것이 사람에게 넘어온다. 순서대로 용량만큼만 걸린다.
  let left = cap;
  let need = 0;
  for (const row of rows) {
    if (row.stopped || !gate) continue;
    need++;
    if (left > 0) {
      left--;
      row.gate = true;
      row.stopped = true;
      row.through = false;
      row.by = [gate.id];
    }
  }

  return { rows, gateId: gate ? gate.id : null, cap, need, fatigue: !!gate && need > cap };
}

/**
 * 지금 고른 대응책이 덮는 범위. 화면에 그대로 칩으로 나간다.
 *
 * **어떤 공격이 막히는지는 말하지 않는다** — 그건 돌려 보기 전에 알려 주면
 * 이 판이 그 자리에서 끝난다. 여기서 나오는 것은 "무엇을 덮는 장치인가" 뿐이다.
 */
export function coverage(guards) {
  const origins = [];
  const tools = [];
  let gate = null;
  for (const g of (guards || []).filter(Boolean)) {
    const s = g.stops || {};
    if (s.any) { gate = g; continue; }
    for (const o of s.origin || []) if (!origins.includes(o)) origins.push(o);
    for (const t of s.tools || []) if (!tools.includes(t)) tools.push(t);
  }
  return {
    origins, tools,
    gate: gate ? gate.id : null,
    cap: gate ? (gate.capacity == null ? 1 : gate.capacity) : 0
  };
}

/**
 * 안전해지는 대신 오늘 업무에서 잃는 것.
 *
 * 통로를 아예 끊으면 그 통로로 하던 일도 같이 멈춘다. 안전과 속도를 동시에
 * 최대로 만드는 설정은 없다 — 그걸 화면에서 미리 보여 주려고 따로 뺐다.
 *
 * @param {{needs:string[]}} agent  오늘 업무에 꼭 필요한 도구
 * @returns {Array<{id:string, tools:string[]}>}
 */
export function cost(guards, agent) {
  const needs = (agent && agent.needs) || [];
  const out = [];
  for (const g of (guards || []).filter(Boolean)) {
    const hit = ((g.stops && g.stops.tools) || []).filter(t => needs.includes(t));
    if (hit.length) out.push({ id: g.id, tools: hit });
  }
  return out;
}

/**
 * 전반 — 순진한 에이전트가 내 공격을 읽는 과정.
 *
 * 엔진이 이 목록을 그대로 실행 로그로 흘리고, 판정도 같은 craft() 문장을 인용한다.
 * `say` 는 게임 파일이 준 문구 묶음이다 — 이 함수는 무슨 내용인지 모른다.
 */
export function attackLog(atk, say) {
  const s = say || {};
  const out = [];
  const push = (kind, text) => { if (text) out.push({ kind, text }); };

  push('read', s.open);
  if (!atk.read) {
    push('ok', s.notRead);
    push('out', s.attackFail);
    return out;
  }

  push('read', atk.where.label);
  push('warn', craft(atk.where, atk.what).line);
  if (!atk.able) {
    push('ok', s.noTool);
    push('out', s.attackFail);
    return out;
  }

  push('do', s.obey);
  push('fail', atk.what.done);
  push('out', s.attackWin);
  return out;
}
