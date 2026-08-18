// 검토 라인 판정 검증 (게임 14 결재 반려). DOM 없이 순수 부분만.
//
// 이 판의 주제는 **검증 부채는 복리로 돌아온다** 다. 그래서 여기서 증명해야 하는 것은
// 점수가 아니라 **물량**이다 — 통과시킨 한 건이 다음 라운드에 두 건이 되는가,
// 멀쩡한 것을 반려한 대가가 있는가, 제대로 걸러내면 물량이 그대로인가.
// 화면에서는 세 판을 다 돌려 봐도 이 셋을 한 번에 못 본다. 여기서 본다.

import game, { RULES, runRounds, buildRound, returnsOf, origin, itemOf }
  from '../src/games/14-reject-approval.js';

const d = game.data;
const slop = d.items.filter(i => i.bad).map(i => i.id);
const fine = d.items.filter(i => !i.bad).map(i => i.id);
const baseOf = (no) => d.items.filter(i => i.round === no).length;

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('  OK   ' + n); }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };

/** 전략 하나로 세 라운드를 끝까지 돌린다 */
const play = (decide) => runRounds(decide, d);
/** 그 결과를 그대로 판정에 넣는다 — 화면이 넘기는 것과 같은 모양이다 */
const judge = (r) => game.simulate({ rounds: r.rounds, backlog: r.backlog, bestCombo: 0 }, d);

const PERFECT = (it) => (it.bad ? 'reject' : 'approve');
const STAMP = () => 'approve';
const REJECT = () => 'reject';
const IDLE = () => 'skip';

console.log('\n== 데이터 짜임새 ==');
check(`서류 ${d.items.length}건 · 워크슬롭 ${slop.length}건`, d.items.length >= 9 && slop.length >= 4,
  `${d.items.length}/${slop.length}`);
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

console.log('\n== 라운드 짜임새 ==');
check('라운드가 여러 번 돈다', RULES.rounds >= 3, String(RULES.rounds));
check('라운드 수를 엔진이 데이터에서 읽는다', d.roundCount === RULES.rounds, String(d.roundCount));
check('라운드마다 새 서류가 있다',
  [1, 2, 3].every(no => baseOf(no) >= 3), [1, 2, 3].map(baseOf).join('/'));
check('라운드마다 워크슬롭이 섞여 있다',
  [1, 2, 3].every(no => d.items.some(i => i.round === no && i.bad)));
check('통과 하나가 두 건이 된다(복리)', RULES.reworkPerPass === 2, String(RULES.reworkPerPass));
check('오반려는 한 건이 다시 온다(선형)', RULES.redoPerReject === 1, String(RULES.redoPerReject));
check('반려 대가가 통과 대가보다 가볍다', RULES.redoPerReject < RULES.reworkPerPass);
check('엔진이 부를 자리가 열려 있다',
  typeof game.plan === 'function' && typeof game.carry === 'function');

console.log('\n== 복리 ① 통과시킨 한 건이 다음 라운드에 두 건이 된다 ==');
// 1라운드에서 워크슬롭 하나(r2)만 통과시키고 나머지는 제대로 처리한다
const one = play((it, no) => (no === 1 && it.id === 'r2') ? 'approve' : PERFECT(it));
const one2 = one.rounds[1];
const oneBack = one2.items.filter(i => i.rework);
check('2라운드에 재작업이 2건 붙는다', oneBack.length === 2, String(oneBack.length));
check('그 2건은 통과시킨 바로 그 서류다', oneBack.every(i => origin(i.id) === 'r2'),
  oneBack.map(i => i.id).join(' / '));
check('재작업 표시가 붙어 원래 것과 구별된다',
  oneBack.every(i => i.rework === true) && one2.items.filter(i => !i.rework).length === baseOf(2));
check(`2라운드 물량이 ${baseOf(2)}건에서 ${one2.size}건으로 늘었다`, one2.size === baseOf(2) + 2,
  String(one2.size));
const oneJ = judge(one);
check('한 건만 통과시켜도 pass 는 아니다', oneJ.grade !== 'pass', `${oneJ.grade} ${oneJ.score}`);

console.log('\n== 복리 ② 1라운드에 나쁜 것 2건을 통과시키면 2라운드 물량이 늘어난다 ==');
const two = play((it, no) => (no === 1 ? 'approve' : PERFECT(it)));
const two1 = two.rounds[0], two2 = two.rounds[1];
check('1라운드에 워크슬롭 2건이 통과됐다', two1.passed.length === 2, String(two1.passed.length));
check('2라운드에 재작업 4건이 돌아온다',
  two2.items.filter(i => i.rework).length === 4,
  String(two2.items.filter(i => i.rework).length));
check(`2라운드 물량 ${baseOf(2)}건 → ${two2.size}건`, two2.size > baseOf(2), String(two2.size));
check('창구가 받는 양을 넘긴 것은 그대로 밀린다', two2.size === RULES.lineCap,
  `${two2.size} vs 상한 ${RULES.lineCap}`);
const twoJ = judge(two);
check('되돌아온 것을 다 걸러도 pass 는 아니다', twoJ.grade !== 'pass', `${twoJ.grade} ${twoJ.score}`);
check('워크슬롭 통과가 2건으로 기록된다',
  twoJ.faults.filter(f => f.name === '워크슬롭 통과').length === 2);

console.log('\n== 복리 ③ 제대로 걸러내면 물량이 안 늘어난다 ==');
const good = play(PERFECT);
check('라운드 물량이 처음 그대로다',
  good.rounds.every(r => r.size === baseOf(r.no)), good.rounds.map(r => r.size).join('/'));
check('되돌아온 일감이 없다', good.backlog === 0, String(good.backlog));
check('재작업 서류가 한 건도 없다', good.rounds.every(r => r.items.every(i => !i.rework)));
const goodJ = judge(good);
check('등급 pass', goodJ.grade === 'pass', `${goodJ.grade} ${goodJ.score}`);
check('점수 100', goodJ.score === 100, String(goodJ.score));
check('실패 사유 없음', goodJ.faults.length === 0, goodJ.faults.map(f => f.name).join(' / '));
check('결과가 "창구가 밀리지 않았다"', /밀리지 않았다/.test(goodJ.steps.at(-1).text));

console.log('\n== 복리 ④ 전부 반려해도 통과가 아니다 (멀쩡한 것을 막은 비용) ==');
const no = play(REJECT);
check('워크슬롭은 다 걸렀다', no.rounds.every(r => r.passed.length === 0 && r.auto.length === 0));
check('그런데 물량은 라운드마다 늘어난다',
  no.rounds[1].size > baseOf(2) && no.rounds[2].size > baseOf(3),
  no.rounds.map(r => r.size).join('/'));
check('마지막에 되돌아온 일감이 남는다', no.backlog > 0, String(no.backlog));
const noJ = judge(no);
check('등급이 pass 가 아니다', noJ.grade !== 'pass', `${noJ.grade} ${noJ.score}`);
check('과잉 반려가 사유로 잡힌다', noJ.faults.some(f => f.name === '과잉 반려'),
  noJ.faults.map(f => f.name).join(' / '));
check('반려한 것이 다시 올라온다고 알려 준다',
  noJ.steps.some(s => /다시 올라온다/.test(s.text)));

console.log('\n== 복리 ⑤ 도장만 찍으면 자기가 만든 더미에 깔린다 ==');
const all = play(STAMP);
check('라운드가 갈수록 물량이 커진다',
  all.rounds[1].size > all.rounds[0].size && all.rounds[2].size >= all.rounds[1].size,
  all.rounds.map(r => r.size).join('/'));
check('마지막 더미가 처음 물량보다 크다', all.backlog > d.items.length,
  `더미 ${all.backlog}건 vs 전체 서류 ${d.items.length}건`);
const allJ = judge(all);
check('등급 fail', allJ.grade === 'fail', `${allJ.grade} ${allJ.score}`);
check('검증 부채가 용어로 기록된다', allJ.faults.some(f => f.name === '검증 부채'),
  allJ.faults.map(f => f.name).join(' / '));
check('더미가 결과 문구에 뜬다', /그대로 밀렸다/.test(allJ.steps.at(-1).text), allJ.steps.at(-1).text);
check('놓친 건이 mistakes 에 담긴다', allJ.mistakes.length >= 14, String(allJ.mistakes.length));

console.log('\n== 아무것도 안 찍고 다 지나가게 뒀을 때 ==');
const idle = play(IDLE);
const idleJ = judge(idle);
check('등급 fail', idleJ.grade === 'fail', `${idleJ.grade} ${idleJ.score}`);
check('안 찍은 것도 통과와 같은 대가를 치른다', idle.backlog === all.backlog,
  `${idle.backlog} vs ${all.backlog}`);
check('보지도 않고 통과된 건을 따로 짚는다',
  idleJ.steps.some(s => /보지도 않고 통과/.test(s.text)));

console.log('\n== 순수 규칙 자체 ==');
check('되돌아온 서류의 원본을 찾을 수 있다', origin('r2~2-0') === 'r2' && itemOf('r2~2-0', d).bad === true);
check('통과 1건 → 재작업 2건', returnsOf({ passed: ['r2'] }, d).length === 2);
check('못 본 워크슬롭도 통과와 같다', returnsOf({ auto: ['r2'] }, d).length === 2);
check('못 본 멀쩡한 것은 되돌아오지 않는다', returnsOf({ auto: ['r1'] }, d).length === 0);
check('오반려 1건 → 1건', returnsOf({ wrongReject: ['r1'] }, d).length === 1);
check('창구 상한을 넘으면 밀린다',
  buildRound(1, Array.from({ length: 9 }, () => ({ from: 'r2', kind: 'rework' })), d).backlog.length === 9 + baseOf(1) - RULES.lineCap);

console.log('\n== 화면에 들어가는 시간 ==');
// 최악(전부 승인)의 라운드 물량으로 실제 흐르는 시간을 잰다. 전체 코스가 20분이다.
const secs = all.rounds.reduce((s, r) =>
  s + (r.size - 1) * d.gapSec + (d.bandTo + 0.18) * d.travelSec, 0);
check(`최악의 경우 창구 진행 ${secs.toFixed(1)}초`, secs <= 75, secs.toFixed(1));
const logMs = allJ.steps.reduce((s, x) => s + x.ms, 0);
check(`결과 로그가 ${(logMs / 1000).toFixed(1)}초 안에 끝난다`, logMs <= 12000, String(logMs));

console.log('\n== 로그가 읽히는 길이인가 ==');
for (const [name, r] of [['완벽', goodJ], ['도장만', allJ], ['전부 반려', noJ]]) {
  const long = r.steps.filter(s => s.text.length > 44);
  check(`${name} — 로그 한 줄이 44자를 넘지 않는다`, long.length === 0, long.map(s => s.text).join(' | '));
}
check('결과 로그가 16줄을 넘지 않는다', allJ.steps.length <= 16, String(allJ.steps.length));

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
