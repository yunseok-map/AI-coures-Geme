// 슈팅 판정 검증 (게임 15 이상 징후 찾기). DOM 없이 순수 부분만.
import game from '../src/games/15-spot-risk.js';

const d = game.data;
const bad = d.items.filter(i => i.bad).map(i => i.id);
const ok = d.items.filter(i => !i.bad).map(i => i.id);

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('  OK   ' + n); }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };
const run = (s) => game.simulate({ hit: [], overshot: [], missed: [], clean: [], bestCombo: 0, ...s }, d);

console.log('\n== 데이터 짜임새 ==');
check('8건 · 위험 4건', d.items.length === 8 && bad.length === 4, `${d.items.length}/${bad.length}`);
check('위험에만 사유가 있다',
  d.items.filter(i => i.bad).every(i => i.why) && d.items.filter(i => !i.bad).every(i => !i.why));
check('모든 항목에 시각 꼬리표', d.items.every(i => /^\d\d:\d\d$/.test(i.tag)));
check('시각이 오름차순이다',
  d.items.map(i => i.tag).every((t, i, a) => i === 0 || a[i - 1] < t), d.items.map(i => i.tag).join(' '));
check('화면 문구를 게임이 지정한다', !!(d.labels && d.labels.hit && d.labels.tap));
check('용어 4개가 concept 에 있다', game.concept.length === 4);

console.log('\n== 위험 4건을 다 짚었을 때 ==');
const best = run({ hit: bad, clean: ok });
check('등급 pass', best.grade === 'pass', `${best.grade} ${best.score}`);
check('점수 100', best.score === 100, String(best.score));
check('실패 사유 없음', best.faults.length === 0);
check('결과가 "모두 짚어냈다"', /모두 짚어냈다/.test(best.steps.at(-1).text));
check('안전한 4건은 로그에 실패로 안 나온다',
  !best.steps.some(s => s.kind === 'fail' || s.kind === 'warn'));

console.log('\n== 하나도 못 짚었을 때 ==');
const worst = run({ missed: bad, clean: ok });
check('등급 fail', worst.grade === 'fail', `${worst.grade} ${worst.score}`);
check('실패 사유 4건', worst.faults.length === 4, String(worst.faults.length));
// 사유 이름이 배운 용어로 남아야 결과 화면이 교육이 된다
check('사유 이름이 용어로 남는다 (섀도우 AI · 프롬프트 인젝션 · 자동화 편향 · 과잉 권한)',
  ['섀도우 AI', '프롬프트 인젝션', '자동화 편향', '과잉 권한']
    .every(t => worst.faults.some(f => f.name === t)),
  worst.faults.map(f => f.name).join(' / '));
check('사유 이름에 문장이 섞이지 않는다', worst.faults.every(f => f.name.length <= 12),
  worst.faults.map(f => f.name).join(' / '));
check('놓친 4건이 mistakes 에 담긴다', worst.mistakes.length === 4);

console.log('\n== 전부 의심하는 전략은 통하지 않는다 ==');
const spray = run({ hit: bad, overshot: ok });
check('위험은 다 짚었지만 pass 아니다', spray.grade !== 'pass', `${spray.grade} ${spray.score}`);
check('과잉 차단 4건이 사유로 잡힌다',
  spray.faults.filter(f => f.name === '과잉 차단').length === 4);
check('결과가 안전한 일까지 막았다고 말한다', /안전한 일까지 막았/.test(spray.steps.at(-1).text));

console.log('\n== 절반 ==');
const mid = run({ hit: bad.slice(0, 2), missed: bad.slice(2), clean: ok });
check('등급 partial', mid.grade === 'partial', `${mid.grade} ${mid.score}`);
check('부분 획득이 있다', mid.gains.some(g => g.name === '위험 식별'));

console.log('\n== 로그가 읽히는 길이인가 ==');
const long = worst.steps.filter(s => s.text.length > 42);
check('로그 한 줄이 42자를 넘지 않는다', long.length === 0, long.map(s => s.text).join(' | '));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
