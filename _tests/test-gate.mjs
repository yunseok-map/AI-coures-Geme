// 9번 배선 연결 (엔진 M 권한 게이트) 검사
//
// 여기서 못 박는 것 세 가지:
//   1) 양쪽으로 다 진다 — 전부 닫으면 일이 안 끝나고, 전부 열면 사고가 난다
//   2) 정확히 셋만 연 것이 유일한 만점이고, 문 하나만 더 열어도 통과선 아래다
//   3) 화면이 막았다고 한 것과 판정이 막았다고 한 것이 같다 (같은 함수를 본다)

import game, { NEEDED } from '../src/games/09-wiring.js';
import { runSteps, extras, missing, width, key, total } from '../src/core/perm.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  OK   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' → ' + extra : '')); }
};
const head = (s) => console.log('\n== ' + s + ' ==');

const d = game.data;
const ALL = d.systems.flatMap(s => s.gates.map(g => key(s.id, g.id)));
const run = (open, trials = 0) => game.simulate({ open, trials, work: d.work, attack: d.attack }, d);
const text = (r) => r.steps.map(s => s.text).join(' | ');
const faultNames = (r) => r.faults.map(f => f.name);

// ---------------------------------------------------------------- 규칙 모듈

head('통과 규칙 (core/perm.js)');
ok('연 문은 지나간다', runSteps([{ sys: 'doc', gate: 'read' }], ['doc:read'])[0].passed);
ok('안 연 문은 막는다', !runSteps([{ sys: 'doc', gate: 'read' }], [])[0].passed);
ok('다른 시스템의 같은 이름 문은 안 통한다',
  !runSteps([{ sys: 'cal', gate: 'read' }], ['doc:read'])[0].passed);
ok('배열이든 Set 이든 같게 다룬다',
  runSteps([{ sys: 'doc', gate: 'read' }], new Set(['doc:read']))[0].passed);
ok('굵기는 그 시스템에서 연 문 개수다',
  width(d.systems[0], ['doc:read', 'doc:del', 'cal:read']) === 2);
ok('열린 문 개수를 센다', total(['a:b', 'c:d']) === 2);
ok('업무에 없는 문은 남는 것으로 잡힌다',
  extras(['doc:read', 'pay:run'], d.work).join() === 'pay:run');
ok('업무에 필요한데 안 연 문은 모자란 것으로 잡힌다',
  missing(['doc:read'], d.work).sort().join() === 'cal:read,cal:write');

// ---------------------------------------------------------------- 데이터 짜임새

head('판의 짜임새');
ok('문이 10개가 넘는다 (고르는 폭이 있어야 한다)', ALL.length >= 10, `${ALL.length}개`);
ok('업무가 요구하는 문은 셋이다', NEEDED.length === 3, NEEDED.join());
ok('정답 문이 전부 실제로 있는 문이다', NEEDED.every(k => ALL.includes(k)));
ok('공격이 노리는 문은 업무가 쓰는 문과 하나도 겹치지 않는다',
  d.attack.every(a => !NEEDED.includes(key(a.sys, a.gate))));
ok('업무에 필요 없는 문은 전부 공격이 노린다 — 남는 권한이 곧 공격 경로다',
  ALL.filter(k => !NEEDED.includes(k))
     .every(k => d.attack.some(a => key(a.sys, a.gate) === k)));
ok('읽기만 여는 것도 공격 경로가 하나 있다 (읽기는 안전하다는 오해를 깬다)',
  d.attack.some(a => a.gate === 'read' || a.gate === 'see'));
ok('되돌릴 수 없는 공격이 셋 이상이다',
  d.attack.filter(a => a.hard).length >= 3);
ok('공격 하나의 대가가 전부 16점 이상이다 — 문 하나만 더 열어도 통과선이 깨져야 한다',
  d.attack.every(a => a.weight >= 16),
  d.attack.map(a => a.weight).join());
ok('모든 공격에 왜 그게 필요 없었는지가 붙어 있다', d.attack.every(a => a.why && a.why.length > 8));
ok('모든 동작에 통과·차단 두 문구가 다 있다',
  [...d.work, ...d.attack].every(s => s.ok && s.no && s.ok !== s.no));

// ---------------------------------------------------------------- 정답 경로

head('정확히 셋만 연다');
{
  const r = run(NEEDED);
  ok('통과다', r.grade === 'pass', `${r.grade} ${r.score}점`);
  ok('만점이다', r.score === 100, `${r.score}점`);
  ok('사유가 하나도 없다', r.faults.length === 0, faultNames(r).join());
  ok('최소 권한을 잘한 점으로 준다', r.gains.some(g => g.name === '최소 권한'));
  ok('MCP 를 잘한 점으로 준다', r.gains.some(g => g.name === 'MCP'));
  ok('지시가 지시로 끝났다는 것이 로그에 나온다', /지시로 끝났다/.test(text(r)));
  ok('회의 준비 완료로 끝난다', /회의 준비 완료/.test(text(r)));
}
{
  const r = run(NEEDED, 3);
  ok('시험 가동을 돌린 것도 잘한 점으로 센다', r.gains.some(g => g.name === '시험 가동'));
  ok('그래도 만점을 넘지는 않는다', r.score === 100, `${r.score}점`);
}

// ---------------------------------------------------------------- 오답 ① 너무 적게

head('전부 닫는다 — 일이 안 끝난다');
{
  const r = run([]);
  ok('통과선 아래다', r.grade !== 'pass', `${r.grade} ${r.score}점`);
  ok('권한 부족이 세 번 잡힌다',
    faultNames(r).filter(n => n === '권한 부족').length === 3, faultNames(r).join());
  ok('사고는 하나도 안 난다', !faultNames(r).some(n => /과잉|유출|되돌릴/.test(n)));
  ok('일이 끝나지 않았다고 말한다', /끝나지 않았다/.test(text(r)));
}
{
  const r = run(['doc:read', 'cal:read']);   // 등록 권한만 빠뜨렸다
  ok('한 문만 모자라도 통과선 아래다', r.grade !== 'pass', `${r.grade} ${r.score}점`);
  ok('막힌 것이 하나다',
    faultNames(r).filter(n => n === '권한 부족').length === 1);
}

// ---------------------------------------------------------------- 오답 ② 너무 많이

head('전부 연다 — 시험 가동은 다 통과하는데 사고가 난다');
{
  const trial = runSteps(d.work, ALL);
  ok('시험 가동에서는 업무가 전부 통과한다 (그래서 안심하게 된다)',
    trial.every(s => s.passed));

  const r = run(ALL);
  ok('반려다', r.grade === 'fail', `${r.grade} ${r.score}점`);
  ok('업무는 막힌 것이 없다', !faultNames(r).includes('권한 부족'));
  ok('공격이 여덟 건 전부 지나간다',
    runSteps(d.attack, ALL).filter(s => s.passed).length === d.attack.length);
  ok('정보 유출이 잡힌다', faultNames(r).includes('정보 유출'));
  ok('되돌릴 수 없는 권한이 잡힌다', faultNames(r).includes('되돌릴 수 없는 권한'));
  ok('사고가 함께 났다고 끝맺는다', /사고도 함께 났다/.test(text(r)));
}

// ---------------------------------------------------------------- 오답 ③ 한 문만 더

head('필요한 셋 + 문 하나 — 하나만 더 열어도 통과선 아래다');
for (const k of ALL.filter(x => !NEEDED.includes(x))) {
  const r = run(NEEDED.concat([k]));
  ok(`${k} 를 더 열면 통과선 아래로 떨어진다`, r.grade !== 'pass', `${r.grade} ${r.score}점`);
}
{
  // "읽기는 안전하다"가 이 판에서 깨지는 자리
  const r = run(NEEDED.concat(['mail:read']));
  ok('메일 읽기만 더 열어도 공격이 그리로 지나간다', /메일함을 훑어/.test(text(r)));
}

// ---------------------------------------------------------------- 점수 곡선

head('점수 곡선 — 정확히 셋이 유일한 꼭대기다');
{
  const best = run(NEEDED).score;
  let better = [];
  // 문 11개의 부분집합 2048가지를 전부 돌려 본다
  for (let mask = 0; mask < (1 << ALL.length); mask++) {
    const open = ALL.filter((_, i) => mask & (1 << i));
    const s = run(open).score;
    if (s >= best && open.join() !== NEEDED.slice().sort().join()) {
      const same = open.length === NEEDED.length && NEEDED.every(k => open.includes(k));
      if (!same) better.push(open.join('+') + '=' + s);
    }
  }
  ok(`${1 << ALL.length}가지를 전부 돌려도 만점은 그 하나뿐이다`,
    better.length === 0, better.slice(0, 3).join(' / '));

  const passing = [];
  for (let mask = 0; mask < (1 << ALL.length); mask++) {
    const open = ALL.filter((_, i) => mask & (1 << i));
    if (run(open).grade === 'pass') passing.push(open.join('+'));
  }
  ok('통과하는 배치는 하나뿐이다', passing.length === 1, `${passing.length}가지`);
}

// ---------------------------------------------------------------- 글

head('글');
ok('제목·부제가 있다', game.title && game.subtitle);
ok('엔진 글자가 M 이다', game.engine === 'M');
ok('배울 용어 셋이 붙어 있다', game.concept.length === 3);
ok('해설이 세 등급 다 있다', game.debrief.pass && game.debrief.partial && game.debrief.fail);
ok('해설이 등급마다 세 줄 이하다',
  ['pass', 'partial', 'fail'].every(k => game.debrief[k].split('\n').length <= 3));
ok('통과 해설과 반려 해설이 다른 말을 한다', game.debrief.pass !== game.debrief.fail);
ok('checkedAt 이 있다', !!game.checkedAt && !!d.checkedAt);
ok('화면 문구에 (으)로 표기가 없다',
  !JSON.stringify(d).includes('(으)로'));
ok('공격 문구가 문서에서 온다는 것이 드러난다', /회의록/.test(d.attackLine) || /무시하고/.test(d.attackLine));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
