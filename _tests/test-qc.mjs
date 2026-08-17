// 검토 라인 판정 검증 (게임 14 결재 반려). DOM 없이 순수 부분만.
import game from '../src/games/14-reject-approval.js';

const d = game.data;
const slop = d.items.filter(i => i.bad).map(i => i.id);
const fine = d.items.filter(i => !i.bad).map(i => i.id);

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('  OK   ' + n); }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };
const run = (s) => game.simulate({ okReject: [], okApprove: [], passed: [],
  wrongReject: [], auto: [], bestCombo: 0, ...s }, d);

console.log('\n== 데이터 짜임새 ==');
check('6건 · 워크슬롭 3건', d.items.length === 6 && slop.length === 3, `${d.items.length}/${slop.length}`);
check('워크슬롭에만 사유가 있다',
  d.items.filter(i => i.bad).every(i => i.why) && d.items.filter(i => !i.bad).every(i => !i.why));
check('반려 기준이 있다', !!(d.source && /근거/.test(d.source.body) && /다음 행동/.test(d.source.body)));
check('창구 구간이 유효하다', d.bandFrom > 0 && d.bandTo > d.bandFrom && d.bandTo < 1,
  `${d.bandFrom}~${d.bandTo}`);
// 창구 통과 시간이 판단할 만한가 — 여기가 너무 짧으면 게임이 불공정해진다
const bandSec = (d.bandTo - d.bandFrom) * d.travelSec;
check('창구에 머무는 시간이 1.5초 이상', bandSec >= 1.5, bandSec.toFixed(2) + '초');
// 서류가 창구에 하나씩만 들어와야 판단 대상이 헷갈리지 않는다
check('서류 간격이 창구 통과 시간보다 길다', d.gapSec > bandSec,
  `간격 ${d.gapSec}초 vs 창구 ${bandSec.toFixed(2)}초`);
check('승인/반려 문구를 게임이 정한다', !!(d.labels && d.labels.approve && d.labels.reject));

console.log('\n== 완벽하게 결재했을 때 ==');
const best = run({ okReject: slop, okApprove: fine });
check('등급 pass', best.grade === 'pass', `${best.grade} ${best.score}`);
check('점수 100', best.score === 100, String(best.score));
check('실패 사유 없음', best.faults.length === 0);
check('결과가 "모두 반려했다"', /모두 반려했다/.test(best.steps.at(-1).text));

console.log('\n== 전부 승인했을 때 ==');
const yes = run({ okApprove: fine, passed: slop });
check('등급 fail', yes.grade === 'fail', `${yes.grade} ${yes.score}`);
check('워크슬롭 통과 3건이 사유로 잡힌다',
  yes.faults.filter(f => f.name === '워크슬롭 통과').length === 3);
check('놓친 3건이 mistakes 에 담긴다', yes.mistakes.length === 3);

console.log('\n== 아무것도 안 찍고 다 지나가게 뒀을 때 (이 판의 핵심) ==');
const idle = run({ auto: d.items.map(i => i.id) });
check('등급 fail', idle.grade === 'fail', `${idle.grade} ${idle.score}`);
check('워크슬롭 3건이 통과로 잡힌다',
  idle.faults.filter(f => f.name === '워크슬롭 통과').length === 3);
check('검증 부채가 용어로 기록된다', idle.faults.some(f => f.name === '검증 부채'),
  idle.faults.map(f => f.name).join(' / '));
check('보지도 않고 통과된 건을 따로 경고한다',
  idle.steps.some(s => /보지도 않고 통과/.test(s.text)));
check('"못 보고 통과"가 로그에 남는다', idle.steps.some(s => /못 보고 통과/.test(s.text)));

console.log('\n== 전부 반려했을 때 ==');
const no = run({ okReject: slop, wrongReject: fine });
check('워크슬롭은 다 걸렀지만 pass 아니다', no.grade !== 'pass', `${no.grade} ${no.score}`);
check('과잉 반려 3건이 사유로 잡힌다',
  no.faults.filter(f => f.name === '과잉 반려').length === 3);
check('결과가 멀쩡한 것도 되돌아왔다고 말한다', /멀쩡한 것도 되돌아왔/.test(no.steps.at(-1).text));

console.log('\n== 섞였을 때 ==');
const mix = run({ okReject: slop.slice(0, 2), auto: [slop[2]], okApprove: fine.slice(0, 2),
  wrongReject: [fine[2]] });
check('등급이 fail 은 아니다', mix.grade !== 'fail', `${mix.grade} ${mix.score}`);
check('부분 획득이 있다', mix.gains.some(g => g.name === '워크슬롭 판별'));

console.log('\n== 로그가 읽히는 길이인가 ==');
const long = idle.steps.filter(s => s.text.length > 44);
check('로그 한 줄이 44자를 넘지 않는다', long.length === 0, long.map(s => s.text).join(' | '));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
