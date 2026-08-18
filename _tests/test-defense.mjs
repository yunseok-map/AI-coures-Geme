// 디펜스 판정 로직 검증. DOM 이 필요 없는 순수 부분만 돌린다.
// 실행: node _tests/test-defense.mjs
//
// 이 판의 설계 주장은 하나다:
//   **안전하면서 동시에 가장 빠른 배치는 존재하지 않는다.**
// 눈으로 몇 판 해 보는 것으로는 이걸 증명할 수 없다 — 배치가 209가지다.
// 그래서 아래 "완벽한 답이 없다" 묶음에서 209가지를 전부 돌려 확인한다.

import game, { planWave } from '../src/games/13-prevent-accident.js';

const d = game.data;
const dangers = d.foes.filter(f => f.danger).map(f => f.id);
const safes = d.foes.filter(f => !f.danger).map(f => f.id);

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  OK   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

/** 장치 id 목록을 위에서부터 순서대로 자리에 꽂는다 */
const put = (...ids) => ids.map((gateId, slot) => ({ slot, gateId }));
const run = (placements) => game.simulate({ placements }, d);
const num = (n) => (Math.round(n * 10) / 10).toFixed(1);

console.log('\n== 데이터 짜임새 ==');
check('위험 3건 · 정상 4건', dangers.length === 3 && safes.length === 4,
  `위험 ${dangers.length} 정상 ${safes.length}`);
check('모든 위험에 blockedBy 가 있다',
  d.foes.filter(f => f.danger).every(f => f.blockedBy));
check('blockedBy 가 전부 실제 장치를 가리킨다',
  d.foes.filter(f => f.danger).every(f => d.gates.some(g => g.id === f.blockedBy)));
// 이게 깨지면 "맞는 장치를 놓아도 안 막히는" 판이 된다 — 게임이 성립하지 않는다
check('위험의 kind 를 그 blockedBy 장치가 실제로 막는다',
  d.foes.filter(f => f.danger).every(f => {
    const g = d.gates.find(x => x.id === f.blockedBy);
    return g && g.stops.includes(f.kind);
  }));
check('장치마다 붙잡는 시간과 비용이 있다',
  d.gates.every(g => g.holdSec > 0 && g.cost > 0));
check('자리 수 = 장치 수 (전부 깔아 볼 수 있다)', d.gates.length === d.slots);
check('일감마다 등장 시각이 있다', d.foes.every(f => Number.isFinite(f.at)));
check('오늘 기준과 업무 시간이 있다', d.quota > 0 && d.limitSec > 0,
  `기준 ${d.quota}건 / ${d.limitSec}초`);
check('위험마다 ok/fail 문구와 사유 이름이 있다',
  d.foes.filter(f => f.danger).every(f => f.ok && f.fail && f.fault && f.fault.length === 2));
check('정상 작업마다 통과/지연 문구가 있다',
  d.foes.filter(f => !f.danger).every(f => f.pass && f.late));
check('넓게 막는 장치가 정상 작업 하나를 같이 잡는다 (과잉 차단이 실제로 일어난다)',
  d.gates.some(g => d.foes.some(f => !f.danger && g.stops.includes(f.kind))));
check('아이콘 이름이 전부 채워져 있다',
  d.foes.every(f => f.icon) && d.gates.every(g => g.icon));

console.log('\n== 장치는 지나가는 것을 붙잡는다 (지연) ==');
{
  const bare = planWave([], d);
  const one = planWave(put('verify'), d);
  const first = d.foes[0].id;
  const a = bare.lanes.find(l => l.id === first).endAt;
  const b = one.lanes.find(l => l.id === first).endAt;
  check('장치가 없으면 아무도 안 붙잡힌다', bare.lanes.every(l => l.stops.length === 0));
  check('장치를 놓으면 막지 않는 정상 작업도 그만큼 늦어진다',
    Math.abs((b - a) - 1.4) < 1e-6, `${num(a)}초 → ${num(b)}초`);
  check('붙잡힌 구간이 화면에 그릴 수 있게 남는다',
    one.lanes[0].stops.length === 1 && one.lanes[0].stops[0].end > one.lanes[0].stops[0].start);
  check('놓은 장치의 지연 합계를 알려 준다', Math.abs(one.held - 1.4) < 1e-6, num(one.held));
  check('놓은 장치의 비용 합계를 알려 준다', one.cost === 3, String(one.cost));

  // 한 번에 하나씩 검사한다 — 몰리면 뒤엣것이 줄을 선다
  const all = planWave(put('sandbox', 'verify', 'hook', 'guard'), d);
  const queued = all.lanes.some(l => l.stops.some(s => s.start > s.arrive + 1e-9));
  check('검사대에 몰리면 줄을 선다', queued);
}

console.log('\n== 완벽한 답이 없다 (설계 증명) ==');

// ---- ① 전부 막는 배치 = 자리를 다 채운 배치 ----
const full = run(put('sandbox', 'verify', 'hook', 'guard'));
const fullPlan = planWave(put('sandbox', 'verify', 'hook', 'guard'), d);
console.log(`  [전부 깔기]  넘긴 것 ${fullPlan.delivered}/${d.quota}건 · 사고 ${fullPlan.leak.length}건 ` +
  `· 과잉 차단 ${fullPlan.over.length}건 · 지연 ${num(fullPlan.held)}초 · 비용 ${fullPlan.cost} ` +
  `→ ${full.score}점 ${full.grade}`);
check('전부 깔면 사고는 0이다', fullPlan.leak.length === 0);
check('전부 깔면 처리량 기준에 미달한다', fullPlan.delivered < d.quota,
  `${fullPlan.delivered}건 / 기준 ${d.quota}건`);
check('전부 깔면 통과 등급이 아니다', full.grade !== 'pass', `${full.grade} ${full.score}점`);
check('미달이 실패 사유로 잡힌다', full.faults.some(f => f.name === '처리량 미달'));

// ---- ② 아무것도 안 막는 배치 ----
const none = run([]);
const nonePlan = planWave([], d);
console.log(`  [안 깔기]    넘긴 것 ${nonePlan.delivered}/${d.quota}건 · 사고 ${nonePlan.leak.length}건 ` +
  `· 지연 0.0초 · 비용 0 → ${none.score}점 ${none.grade}`);
check('안 깔면 처리량은 넉넉히 채운다', nonePlan.delivered >= d.quota,
  `${nonePlan.delivered}건 / 기준 ${d.quota}건`);
check('안 깔면 위험이 전부 끝까지 간다', nonePlan.leak.length === dangers.length,
  `${nonePlan.leak.length}건`);
check('사고가 나면 등급이 fail 이다', none.grade === 'fail', `${none.grade} ${none.score}점`);
check('사고 하나가 판을 크게 깎는다 (28점)', none.score === 100 - 28 * 3, String(none.score));

// ---- ③ 최적 배치 ----
const bestIds = ['sandbox', 'verify', 'hook'];
const best = run(put(...bestIds));
const bestPlan = planWave(put(...bestIds), d);
console.log(`  [최적 배치]  넘긴 것 ${bestPlan.delivered}/${d.quota}건 · 사고 ${bestPlan.leak.length}건 ` +
  `· 못 나간 일감 ${bestPlan.late.length}건 · 지연 ${num(bestPlan.held)}초 · 비용 ${bestPlan.cost} ` +
  `→ ${best.score}점 ${best.grade}`);
check('최적 배치는 사고 0 · 과잉 차단 0', !bestPlan.leak.length && !bestPlan.over.length);
check('최적 배치는 통과한다', best.grade === 'pass', `${best.grade} ${best.score}점`);
check('그래도 만점은 아니다', best.score < 100, String(best.score));
check('여유가 크지 않다 (통과선 +5점 이내)', best.score - 85 <= 5, `${best.score - 85}점 여유`);
check('기준을 딱 채운다 (남는 건수가 없다)', bestPlan.delivered === d.quota,
  `${bestPlan.delivered}건`);
check('최적 배치에서도 일감 하나는 오늘 못 나간다', bestPlan.late.length >= 1,
  `${bestPlan.late.length}건`);

// ---- ④ 209가지 배치를 전부 돌려 본다 ----
function* everyPlacement() {
  const ids = d.gates.map(g => g.id);
  const cells = [...Array(d.slots).keys()];
  const walk = (rest, used, acc) => {
    const out = [acc];
    for (let i = 0; i < rest.length; i++) {
      for (const c of cells) {
        if (used.has(c)) continue;
        out.push(...walk(rest.slice(i + 1), new Set([...used, c]),
          [...acc, { slot: c, gateId: rest[i] }]));
      }
    }
    return out;
  };
  yield* walk(ids, new Set(), []);
}

const all = [];
for (const p of everyPlacement()) {
  const plan = planWave(p, d);
  const sim = game.simulate({ placements: p }, d);
  all.push({ p, plan, sim });
}
const top = Math.max(...all.map(x => x.sim.score));
const safeAndFast = all.filter(x => x.plan.leak.length === 0 && x.plan.short === 0);

console.log(`  배치 ${all.length}가지 · 최고 ${top}점 · 사고 0 이면서 기준을 채우는 배치 ${safeAndFast.length}가지`);
check('만점이 나오는 배치가 하나도 없다', top < 100, `최고 ${top}점`);
check('최고점이 최적 배치의 점수다', top === best.score, `${top} vs ${best.score}`);
check('사고 0 이면서 기준을 채우는 배치가 존재한다', safeAndFast.length > 0);
check('그런 배치는 전부 같은 장치 조합이다 (샌드박스 · 검증 · 훅)',
  safeAndFast.every(x => {
    const ids = x.p.map(q => q.gateId).sort().join(',');
    return ids === [...bestIds].sort().join(',');
  }));
check('그 배치들조차 못 나간 일감이 남는다',
  safeAndFast.every(x => x.plan.late.length >= 1));
check('가장 넓게 막는 장치를 쓰면 어떻게 놓아도 통과가 안 된다',
  all.filter(x => x.p.some(q => q.gateId === 'guard')).every(x => x.sim.grade !== 'pass'));
check('장치를 하나도 안 놓으면 어떻게 해도 fail 이다', none.grade === 'fail');

console.log('\n== 결과 화면 문구 ==');
check('실패 사유 이름이 배운 용어다',
  none.faults.map(f => f.name).join(',') === '격리 없음,프롬프트 인젝션,정보 유출',
  none.faults.map(f => f.name).join(','));
check('같은 사고에 사유가 하나씩만 붙는다 (중복 없음)',
  new Set(none.faults.map(f => f.name)).size === none.faults.length);
check('장치를 걸면 상시 비용이 사유로 남는다', best.faults.some(f => f.name === '상시 비용'));
check('과잉 차단이 사유로 잡힌다', full.faults.some(f => f.name === '과잉 차단'));
check('최적 배치에는 하네스 엔지니어링이 붙는다',
  best.gains.some(g => g.name === '하네스 엔지니어링'));
check('사고가 나면 하네스 엔지니어링을 안 준다',
  !none.gains.some(g => g.name === '하네스 엔지니어링'));
check('로그에 붙잡히는 시간이 초로 적힌다',
  best.steps.some(s => /2\.7초씩 붙잡힌다/.test(s.text)),
  best.steps.map(s => s.text).find(x => /붙잡힌다/.test(x)) || '없다');
check('마지막 줄이 오늘 결과를 말한다', /^사고 없음/.test(best.steps.at(-1).text),
  best.steps.at(-1).text);
check('전부 깔았을 때 마지막 줄이 미달을 말한다', /못 미쳤다$/.test(full.steps.at(-1).text),
  full.steps.at(-1).text);
// 로그는 "방금 화면에서 본 것"을 되짚는 자리다. 결말마다 맞는 문구가 한 번씩 나와야 한다.
{
  const byId = new Map(d.foes.map(f => [f.id, f]));
  const lineFor = (lane) => {
    const f = byId.get(lane.id);
    return lane.result === 'blocked' ? f.ok
      : lane.result === 'done' ? f.pass
        : lane.result === 'over' ? f.over
          : lane.result === 'late' ? f.late
            : lane.result === 'leak' ? f.fail : null;
  };
  const missed = (plan, sim) => plan.lanes
    .map(lineFor)
    .filter(text => text && sim.steps.filter(s => s.text === text).length !== 1);
  check('최적 배치의 일감이 결말대로 한 번씩 로그에 나온다',
    missed(bestPlan, best).length === 0, missed(bestPlan, best).join(' / '));
  check('전부 깔았을 때도 결말대로 한 번씩 나온다',
    missed(fullPlan, full).length === 0, missed(fullPlan, full).join(' / '));
  check('안 깔았을 때도 결말대로 한 번씩 나온다',
    missed(nonePlan, none).length === 0, missed(nonePlan, none).join(' / '));
}
check('mistakes 에 힌트가 담긴다',
  none.mistakes.length === 3 && none.mistakes.every(m => m.hint));
check('힌트가 막을 장치를 지목한다', /검증/.test(
  none.mistakes.find(m => m.itemId === 'hz-inject').hint));
check('미달일 때는 장치를 덜라고 알려 준다',
  full.mistakes.some(m => m.itemId === 'quota'));

console.log('\n== 화면에서 실제로 멈춰 선다 (움직임 구간) ==');
//
// 엔진은 lanes[].path 를 이어 붙여 카드를 움직인다. 그래서 "장치를 지날 때마다
// 느려진다"가 화면에 보이는지는 이 구간만 보면 알 수 있다 — 브라우저를 안 열어도 된다.
{
  const p = planWave(put(...bestIds), d);
  const at = (lane, now) => {
    const g = lane.path.find(x => now < x.t1) || lane.path.at(-1);
    if (now >= g.t1 || g.t1 <= g.t0) return g.y1;
    return g.y0 + (g.y1 - g.y0) * ((now - g.t0) / (g.t1 - g.t0));
  };

  check('일감마다 움직임 구간이 있다', p.lanes.every(l => l.path.length > 0));
  check('구간이 등장 시각에서 시작한다',
    p.lanes.every(l => Math.abs(l.path[0].t0 - l.spawn) < 1e-9));
  check('구간이 결말 시각에서 끝난다',
    p.lanes.every(l => Math.abs(l.path.at(-1).t1 - l.endAt) < 1e-9));
  check('구간이 시간 순으로 이어진다',
    p.lanes.every(l => l.path.every((g, i) => i === 0 || Math.abs(g.t0 - l.path[i - 1].t1) < 1e-9)));
  check('위치가 뒤로 가지 않는다 (줄 설 때 비켜서는 3%만 빼고)',
    p.lanes.every(l => l.path.every((g, i) =>
      g.y1 >= g.y0 - 1e-9 && (i === 0 || g.y0 >= l.path[i - 1].y1 - 0.031))));
  check('멈춰 서는 구간이 실제로 생긴다 (장치를 세 개 지난다)',
    p.lanes.filter(l => !l.danger)[0].path.filter(g => g.hold).length === 3);
  check('멈춘 시간의 합이 놓은 장치의 검사 시간과 같다',
    Math.abs(p.lanes.filter(l => !l.danger)[0].path
      .filter(g => g.hold).reduce((s, g) => s + (g.t1 - g.t0), 0) - p.held) < 1e-9);
  check('막힌 일감은 그 검사대 자리에서 멈춘다',
    p.lanes.filter(l => l.result === 'blocked')
      .every(l => Math.abs(at(l, l.endAt) - l.stops.at(-1).at) < 1e-9));
  check('넘어간 일감은 바닥(우리 팀)에 닿는다',
    p.lanes.filter(l => l.result === 'done').every(l => Math.abs(at(l, l.endAt) - 1) < 1e-9));
  check('못 나간 일감은 업무 시간이 끝나도 바닥 앞에 있다',
    p.lanes.filter(l => l.result === 'late').every(l => at(l, p.limitSec) < 1));
  check('장치가 없으면 멈추는 구간도 없다',
    planWave([], d).lanes.every(l => l.path.every(g => !g.hold)));
}

console.log('\n== 화면과 판정이 같은 계산을 쓴다 ==');
check('판 파일이 plan 을 내보낸다', typeof game.plan === 'function');
check('plan 이 순수 함수다 (두 번 불러도 같다)',
  JSON.stringify(planWave(put(...bestIds), d)) === JSON.stringify(planWave(put(...bestIds), d)));
check('판정도 같은 계산을 다시 부른다 (배치만으로 결과가 정해진다)',
  run(put(...bestIds)).score === run(put(...bestIds)).score);
check('자리 순서를 바꿔도 장치 조합이 같으면 결과가 같다',
  run(put('hook', 'verify', 'sandbox')).score === best.score,
  String(run(put('hook', 'verify', 'sandbox')).score));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
