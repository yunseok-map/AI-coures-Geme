// 슈팅 판정 로직 검증 (게임 2). DOM 없이 순수 부분만.
import game from '../src/games/02-hallucination.js';

const d = game.data;
const falses = d.items.filter(i => i.bad).map(i => i.id);
const trues = d.items.filter(i => !i.bad).map(i => i.id);

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('  OK   ' + n); }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };
const run = (s) => game.simulate({ hit: [], overshot: [], missed: [], clean: [], bestCombo: 0, ...s }, d);

console.log('\n== 데이터 짜임새 ==');
check('문장 6개 · 거짓 3개', d.items.length === 6 && falses.length === 3,
  `${d.items.length}개 중 거짓 ${falses.length}`);
check('거짓 문장에 전부 사유가 있다', d.items.filter(i => i.bad).every(i => i.why));
check('맞는 문장에는 사유가 없다 (정답 유출 방지)',
  d.items.filter(i => !i.bad).every(i => !i.why));
check('근거 자료가 있다', !!(d.source && d.source.body));
// 거짓 문장의 핵심 단어가 규정 원문에 실제로 없어야 게임이 성립한다
const body = d.source.body;
check('거짓의 근거어가 규정에 정말 없다 (이월·그룹웨어·반차)',
  !body.includes('이월') && !body.includes('그룹웨어') && !body.includes('반차'));
// 맞는 문장의 근거는 규정에 있어야 한다
check('맞는 문장의 근거는 규정에 있다 (1일·3일·1년)',
  body.includes('월 1일') && body.includes('3일 전') && body.includes('1년'));
check('아이디가 중복되지 않는다', new Set(d.items.map(i => i.id)).size === 6);

console.log('\n== 전부 걸러냈을 때 ==');
const best = run({ hit: falses, clean: trues });
check('등급 pass', best.grade === 'pass', best.grade);
check('점수 100', best.score === 100, String(best.score));
check('실패 사유 없음', best.faults.length === 0);
check('근거 확인 + 판별 획득', best.gains.length === 2, best.gains.map(g => g.name).join(','));
check('결과 문구가 "모두 걸러냈다"', /모두 걸러냈다/.test(best.steps.at(-1).text));
check('mistakes 없음', best.mistakes.length === 0);

console.log('\n== 하나도 못 걸렀을 때 ==');
const worst = run({ missed: falses, clean: trues });
check('등급 fail', worst.grade === 'fail', `${worst.grade} ${worst.score}점`);
check('실패 사유 4건 (놓친 3 + 환각 용어 1)', worst.faults.length === 4,
  worst.faults.map(f => f.name).join(' / '));
check('환각이 용어로 기록된다', worst.faults.some(f => f.name === '환각'));
check('놓친 3건이 mistakes 에 담긴다', worst.mistakes.length === 3);
check('mistakes 힌트가 원본 사유다',
  worst.mistakes.every(m => d.items.find(i => i.id === m.itemId).why === m.hint));
check('결과 문구가 보고서에 들어간다고 말한다', /보고서에 들어간다/.test(worst.steps.at(-1).text));

console.log('\n== 의심스러운 것 다 쏘기 전략은 통하지 않는다 ==');
const spray = run({ hit: falses, overshot: trues });
check('거짓은 다 잡았지만 pass 가 아니다', spray.grade !== 'pass', `${spray.grade} ${spray.score}점`);
check('오사격 3건이 사유로 잡힌다',
  spray.faults.filter(f => f.name === '근거 있는 내용을 지움').length === 3);
check('만점 보너스는 안 준다', !spray.gains.some(g => g.name === '할루시네이션 판별'));
check('결과 문구가 맞는 내용도 지워졌다고 말한다', /맞는 내용도 지워졌/.test(spray.steps.at(-1).text));

console.log('\n== 절반만 걸렀을 때 ==');
const mid = run({ hit: falses.slice(0, 2), missed: falses.slice(2), clean: trues });
check('등급 partial', mid.grade === 'partial', `${mid.grade} ${mid.score}점`);
check('근거 확인 부분 획득', mid.gains.some(g => g.name === '근거 확인'));

console.log('\n== 로그가 읽히는 길이인가 ==');
const long = best.steps.filter(s => s.text.length > 40);
check('로그 한 줄이 40자를 넘지 않는다', long.length === 0,
  long.map(s => s.text).join(' | '));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
