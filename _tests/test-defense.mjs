// 디펜스 판정 로직 검증. DOM 이 필요 없는 순수 부분만 돌린다.
// 실행: node _tests/test-defense.mjs

import game from '../src/games/13-prevent-accident.js';

const d = game.data;
const dangers = d.foes.filter(f => f.danger).map(f => f.id);
const safes = d.foes.filter(f => !f.danger).map(f => f.id);

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  OK   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

function run(setup) {
  return game.simulate({
    blocked: [], leaked: [], overblocked: [], passed: [],
    placements: [], unplaced: [], bestCombo: 0, ...setup
  }, d);
}

console.log('\n== 데이터 짜임새 ==');
check('위험 3건 · 정상 2건', dangers.length === 3 && safes.length === 2,
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
check('정상 작업은 어떤 장치에도 막히지 않는다 (과잉 차단 함정 없음)',
  d.foes.filter(f => !f.danger).every(f => !d.gates.some(g => g.stops.includes(f.kind))));
check('장치 수 = 슬롯 수', d.gates.length === d.slots);
check('위험마다 ok/fail 문구가 있다',
  d.foes.filter(f => f.danger).every(f => f.ok && f.fail));
check('아이콘 이름이 전부 채워져 있다',
  d.foes.every(f => f.icon) && d.gates.every(g => g.icon));

console.log('\n== 전부 막았을 때 ==');
const best = run({
  blocked: dangers, passed: safes,
  placements: d.gates.map((g, i) => ({ slot: i, gateId: g.id }))
});
check('등급 pass', best.grade === 'pass', best.grade);
check('점수 100', best.score === 100, String(best.score));
check('실패 사유 없음', best.faults.length === 0);
check('가드레일 + 하네스 엔지니어링 획득', best.gains.length === 2,
  best.gains.map(g => g.name).join(','));
check('마지막 줄이 사고 없음', /사고 없음/.test(best.steps.at(-1).text));
check('모든 일감이 로그에 한 번씩 나온다',
  d.foes.every(f => best.steps.some(s => s.text === (f.ok || f.pass))));

console.log('\n== 하나도 못 막았을 때 ==');
const worst = run({ leaked: dangers, passed: safes });
check('등급 fail', worst.grade === 'fail', worst.grade);
check('점수 100 - 24*3 = 28', worst.score === 28, String(worst.score));
check('실패 사유 3건', worst.faults.length === 3, String(worst.faults.length));
check('사고 3건으로 끝난다', /사고 3건/.test(worst.steps.at(-1).text));
check('한 사고에 사유가 하나씩만 붙는다 (중복 없음)',
  new Set(worst.faults.map(f => f.name)).size === worst.faults.length);

console.log('\n== 두 개만 막았을 때 ==');
const mid = run({
  blocked: dangers.slice(0, 2), leaked: dangers.slice(2), passed: safes,
  placements: [{ slot: 0, gateId: 'sandbox' }, { slot: 1, gateId: 'verify' }],
  unplaced: ['hook']
});
check('등급 partial', mid.grade === 'partial', `${mid.grade} / ${mid.score}점`);
check('가드레일만 획득', mid.gains.length === 1 && mid.gains[0].name === '가드레일');
check('안 놓은 장치를 경고한다', mid.steps.some(s => /놓지 않아/.test(s.text)));
check('mistakes 에 힌트가 담긴다', mid.mistakes.length === 1 && !!mid.mistakes[0].hint);

console.log('\n== 정상 작업까지 막았을 때 (과잉 차단) ==');
const over = run({
  blocked: dangers, overblocked: safes,
  placements: d.gates.map((g, i) => ({ slot: i, gateId: g.id }))
});
check('위험은 다 막았지만 만점이 아니다', over.score < 100, String(over.score));
check('과잉 차단이 실패 사유로 잡힌다',
  over.faults.filter(f => f.name === '과잉 차단').length === 2);
check('하네스 보너스는 안 준다', !over.gains.some(g => g.name === '하네스 엔지니어링'));

console.log('\n== 사고 사유가 무엇을 알려주는가 ==');
const inj = run({ blocked: ['hz-write', 'hz-send'], leaked: ['hz-inject'], passed: safes });
check('사유 이름은 실제로 일어난 작업이다', inj.faults.length === 1 &&
  inj.faults[0].name === '외부 문서에 숨어 있던 지시 따르기', inj.faults.map(f => f.name).join(','));
check('사유 설명이 막을 장치를 지목한다', /검증/.test(inj.faults[0].why), inj.faults[0].why);
check('mistakes 힌트도 그 장치를 지목한다', /검증/.test(inj.mistakes[0].hint), inj.mistakes[0].hint);
check('막은 둘은 실패 사유에 안 들어간다', inj.faults.length === 1);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
