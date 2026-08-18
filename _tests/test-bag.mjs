// 1번 가방 싸기(회차형) · 10번 신입 온보딩 문서(수리형) 검사.
//
// 이 두 판은 "좋은 것을 골라 넣으면 끝"이던 판을 **선택에 대가가 있는 판**으로
// 다시 만든 것이다. 그래서 여기서 확인하는 것도 대가가 실제로 붙는지다:
//
//   1번  칸이 넘치면 오래된 것이 조용히 사라지는가 · 그것을 쓰면 틀린 값이 나오는가
//        · 접으면 세부 하나가 영구히 없어지는가 · 마지막에 하필 그게 필요해지는가
//   10번 모순 쌍을 둘 다 넣으면 오류 없이 점수가 떨어지는가 · 막연한 줄이 결과를
//        못 바꾸는가 · 고쳐서 다시 돌리면 나아지는가
//
// 화면 없이 도는 검사다. 회차 진행·접기·발동 계산이 전부 core 의 순수 함수라서
// 엔진을 띄우지 않고도 사람이 하는 것과 똑같은 순서로 돌려 볼 수 있다.

import { newDesk, arrive, takeOff, fold, look, live, dimmed, used }
  from '../src/core/bag.js';
import { resolve, fired, tally } from '../src/core/ruleset.js';

const bag = (await import('../src/games/01-context-bag.js')).default;
const doc = (await import('../src/games/10-onboarding-doc.js')).default;
const ticket = (await import('../src/games/16-work-ticket.js')).default;

let pass = 0, fail = 0;
const check = (n, c, x) => {
  if (c) { pass++; }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); }
};

// ---------------------------------------------------------------- 도우미
//
// 엔진이 회차마다 하는 일을 그대로 흉내 낸다(engines/build.js 의 nextRound).
// 자료는 스스로 들어오고, 사람이 하는 것은 접기와 내리기뿐이다.
function play(script = []) {
  const d = bag.data;
  let desk = newDesk(d.budget);
  const shots = [];
  for (let i = 0; i < d.rounds.length; i++) {
    const list = (d.rounds[i].arrive || []).map(id => d.parts.find(p => p.id === id));
    desk = arrive(desk, list, i + 1);
    const act = script[i] || {};
    if (act.fold) desk = fold(desk, act.fold, i + 1, `요약본 ${desk.folds + 1}`);
    for (const id of act.drop || []) desk = takeOff(desk, id, i + 1);
    shots.push(desk);
  }
  const setup = {
    desk, kept: live(desk), evicted: dimmed(desk),
    used: used(desk), cap: desk.cap, slots: {}, all: desk.items.slice(), runNo: 1
  };
  return { desk, shots, sim: bag.simulate(setup) };
}

/** 예산형 담기 — engines/build.js 의 paint() 와 같은 규칙 */
function pack(ids, runNo = 1) {
  const cap = doc.data.budget;
  const pool = ids.map(id => doc.data.parts.find(p => p.id === id));
  let n = 0; const kept = [], out = [];
  for (let i = pool.length - 1; i >= 0; i--) {
    const c = pool[i].cost ?? 1;
    if (n + c <= cap) { n += c; kept.unshift(pool[i]); }
    else out.unshift(pool[i]);
  }
  return { kept, evicted: out, used: n, cap, slots: {}, all: pool, runNo };
}

const text = sim => sim.steps.map(s => s.text).join('\n');
const names = sim => sim.faults.map(f => f.name);

// ---------------------------------------------------------------- core/bag.js
console.log('\n== core/bag.js — 책상 규칙 ==');
{
  const item = (id, cost, ds) => ({ id, label: id, cost, details: ds });
  let k = newDesk(3);
  k = arrive(k, [item('a', 2, [{ id: 'da', label: 'da', value: 'A', wrong: 'A아님' }])], 1);
  check('들어온 것은 칸을 먹는다', used(k) === 2, String(used(k)));

  k = arrive(k, [item('b', 2, [{ id: 'db', label: 'db', value: 'B', wrong: 'B아님' }])], 2);
  check('칸이 넘치면 오래된 것이 흐려진다', dimmed(k).map(x => x.id).join() === 'a',
    dimmed(k).map(x => x.id).join());
  check('흐려진 것은 칸을 안 먹는다', used(k) === 2, String(used(k)));
  check('흐려진 회차가 남는다', look(k, 'da').at === 2, String(look(k, 'da').at));

  // 자리가 다시 나도 돌아오지 않는다 — 이미 상한 자료다
  k = takeOff(k, 'b', 3);
  check('흐려진 것은 자리가 나도 안 돌아온다', look(k, 'da').state === 'wrong',
    look(k, 'da').state);
  check('사람이 내린 것은 내린 것으로 남는다', look(k, 'db').state === 'off',
    look(k, 'db').state);

  // 접기 — 가운데 세부 하나가 사라진다
  let f = newDesk(9);
  f = arrive(f, [
    item('x', 1, [{ id: 'd1', label: 'd1', value: '1', wrong: 'x' }]),
    item('y', 1, [{ id: 'd2', label: 'd2', value: '2', wrong: 'x' }]),
    item('z', 1, [{ id: 'd3', label: 'd3', value: '3', wrong: 'x' }])
  ], 1);
  const before = used(f);
  f = fold(f, ['x', 'y', 'z'], 1, '요약본 1');
  check('셋을 접으면 한 칸이 된다', used(f) === 1, `${before} → ${used(f)}`);
  check('가운데 세부가 사라진다', look(f, 'd2').state === 'folded', look(f, 'd2').state);
  check('처음과 끝은 남는다',
    look(f, 'd1').state === 'ok' && look(f, 'd3').state === 'ok');
  check('사라진 것은 되돌아오지 않는다',
    look(arrive(f, [], 2), 'd2').state === 'folded');
  check('셋이 아니면 접히지 않는다', fold(f, ['x'], 1, 'n') === f);
}

// ---------------------------------------------------------------- 1번
console.log('\n== 1번 가방 싸기 — 회차형 ==');

// ① 아무것도 안 하면 칸이 넘치고, 넘친 순간 오래된 것이 조용히 사라진다
{
  const { shots, sim } = play([]);
  const afterR2 = shots[1];
  check('칸이 넘치면 오래된 것이 사라진다',
    dimmed(afterR2).some(x => x.id === 'q3'), dimmed(afterR2).map(x => x.id).join());
  check('사라진 것은 책상에서 안 보인다',
    !live(afterR2).some(x => x.id === 'q3'));
  check('사라졌다고 알려 주는 문구가 회차 중에 없다',
    !(bag.data.rounds || []).some(r => /밀려|흐려|사라/.test(r.note || '')),
    '회차 안내가 미리 일러 준다');

  // ② 사라진 것을 쓰면 틀린 값이 나온다 — 그것도 태연하게
  const t = text(sim);
  const q3 = bag.data.parts.find(p => p.id === 'q3').details[0];
  check('사라진 것을 쓰면 틀린 값이 나온다', t.includes(q3.wrong), '틀린 값이 안 나왔다');
  check('맞는 값은 결과에 안 쓰인다(되짚기 전까지)',
    t.indexOf(q3.wrong) < t.indexOf('되짚기'), '순서가 뒤집혔다');
  check('틀린 값을 쓴 것이 환각으로 잡힌다', names(sim).includes('환각'), names(sim).join());
  check('칸을 넘긴 것이 컨텍스트 초과로 잡힌다',
    names(sim).includes('컨텍스트 초과'), names(sim).join());
  check('되짚기에서 언제 흐려졌는지 밝힌다', /2회차에 흐려졌다/.test(t));
  check('그래도 끝까지 돈다 (게임오버 없음)',
    sim.grade === 'fail' && sim.steps.some(s => s.kind === 'out'), sim.grade);
}

// ③ 접으면 세부 하나가 영구히 없어진다 — 무엇이 없어졌는지는 그때 안 알려 준다
{
  const { desk, shots } = play([{ fold: ['q3', 'notice', 'q2'] }]);
  const r1 = shots[0];
  check('접으면 칸이 빈다', used(r1) === 1, String(used(r1)));
  check('접힌 자리에 요약본이 남는다', live(r1).some(x => x.folded));
  check('접을 때 세부 하나가 영구히 없어진다',
    look(desk, 'party').state === 'folded', look(desk, 'party').state);
  check('나머지 세부는 요약본 안에 남는다',
    look(r1, 'sep').state === 'ok' && look(r1, 'base').state === 'ok',
    `${look(r1, 'sep').state} / ${look(r1, 'base').state}`);
  const foldLog = desk.log.find(x => x.kind === 'fold');
  check('무엇을 언제 잃었는지는 기록에만 남는다',
    !!foldLog && foldLog.round === 1 && foldLog.lost === 'party',
    JSON.stringify(foldLog));
}

// ④ 마지막 회차에 하필 그 사라진 세부가 필요해진다
{
  // 칸이 급하다고 계속 접으면, 2회차 요약이 “거래처가 떠난 이유”를 가져간다
  const { desk, sim } = play([
    { fold: ['q3', 'notice', 'q2'] },
    { fold: ['fold-1', 'memo', 'board'] }
  ]);
  const log2 = desk.log.filter(x => x.kind === 'fold')[1];
  check('두 번째 접기가 가져간 것은 거래처 이탈 사유다',
    log2 && log2.lost === 'churn', JSON.stringify(log2));
  const asked = /거래처가 떠난 이유/.test(text(sim));
  check('마지막 회차에 그 세부가 필요해진다', asked, '마감 요청에 안 들어 있다');
  check('요약본에 그 줄이 없다는 것이 결과에 나온다',
    /요약본에 그 줄이 없다/.test(text(sim)));
  check('되짚기에서 언제 잃었는지 밝힌다',
    /2회차에 요약하면서 사라졌다/.test(text(sim)));
  check('컨텍스트 로트로 잡힌다', names(sim).includes('컨텍스트 로트'), names(sim).join());
  check('그래도 산출물은 멀쩡해 보인다',
    /빈 곳 없이 채워져 있다/.test(text(sim)));
}

// ⑤ 대가를 다 치르고도 이길 길은 있다 — 1회차에 접고 2회차에 잡음을 내린다
{
  const { sim } = play([
    { fold: ['q3', 'notice', 'q2'] },
    { drop: ['board'] }
  ]);
  check('제대로 관리하면 흐려지는 것이 없다', sim.faults.length === 0, names(sim).join());
  check('제대로 관리하면 통과한다', sim.grade === 'pass', `${sim.grade} ${sim.score}`);
  check('아낀 것이 컨텍스트 엔지니어링으로 잡힌다',
    sim.gains.some(g => g.name === '컨텍스트 엔지니어링'),
    sim.gains.map(g => g.name).join());
}

// ⑥ 알고 잃는 것과 모르고 잃는 것 — 잃은 개수는 같고 대가만 다르다
{
  // 둘 다 1회차는 같게 두고, 2회차에서 영업팀 주간 메모 하나를 잃는다.
  //   알고  : 내가 내린다 → AI는 없다고 말한다
  //   모르고: 접어서 사라진다 → AI는 그 자리를 지어내 채운다
  const known = play([
    { fold: ['q3', 'notice', 'q2'] }, { drop: ['memo', 'board'] }
  ]).sim;
  const silent = play([
    { fold: ['q3', 'notice', 'q2'] }, { fold: ['fold-1', 'memo', 'board'] }
  ]).sim;
  check('내려서 잃으면 지어내지 않고 비워 둔다', /비워 둔다/.test(text(known)));
  check('내려서 잃은 것은 환각이 아니다', !names(known).includes('환각'), names(known).join());
  check('접어서 잃으면 그 자리를 채워 버린다', /앞뒤에 맞춰 채운다/.test(text(silent)));
  check('둘 다 흐려진 자료는 없다',
    known.faults.every(f => f.name !== '컨텍스트 초과') &&
    silent.faults.every(f => f.name !== '컨텍스트 초과'));
  check('모르고 잃으면 더 크게 깎인다', silent.score < known.score,
    `알고 ${known.score} / 모르고 ${silent.score}`);
}

// ---------------------------------------------------------------- 10번
console.log('\n== 10번 신입 온보딩 문서 — 수리형 ==');

const GOOD = ['blank-mark', 'no-pii', 'ask', 'format'];
const FIRST = ['blank-mark', 'no-blank', 'no-pii', 'ask', 'format'];

// ① 모순 쌍 — 둘 다 넣으면 오류가 안 나고 점수만 떨어진다
{
  const a = doc.simulate(pack(GOOD));
  const b = doc.simulate(pack(FIRST));
  check('모순 쌍을 둘 다 넣으면 점수가 떨어진다', b.score < a.score, `${a.score} → ${b.score}`);
  check('그래도 산출물은 나온다 (오류가 아니다)',
    b.steps.some(s => s.kind === 'out'), '산출물 줄이 없다');
  check('겉보기에는 멀쩡한 표가 나온다', /빠짐없이 채워져 있다/.test(text(b)));
  check('진 규칙에 무시됨 표시가 붙는다', b.marks['blank-mark'] === '무시됨',
    b.marks['blank-mark']);
  check('이긴 규칙에 발동 표시가 붙는다', b.marks['no-blank'] === '발동', b.marks['no-blank']);
  check('무엇이 이겼는지 발동 기록에 나온다', /이긴 쪽은/.test(text(b)));
  check('조용히 지어낸 것이 환각으로 잡힌다', names(b).includes('환각'), names(b).join());
  check('한 판에 못 맞히게 되어 있다', b.grade !== 'pass', `${b.grade} ${b.score}`);
  check('해로운 규칙에 미리 표시를 달지 않는다',
    !doc.data.parts.some(p => p.danger || p.note), 'danger/note 가 답을 흘린다');
}

// ② 막연한 규칙 — 넣어도 결과가 안 바뀌고, 돌릴 때마다 말만 달라진다
{
  const without = doc.simulate(pack(['no-blank', 'no-pii']));
  const withIt = doc.simulate(pack(['no-blank', 'no-pii', 'pro']));
  check('막연한 규칙은 결과를 못 바꾼다', without.score === withIt.score,
    `${without.score} vs ${withIt.score}`);
  check('막연한 규칙에는 그때그때 표시가 붙는다', withIt.marks['pro'] === '그때그때',
    withIt.marks['pro']);
  const again = doc.simulate(pack(['no-blank', 'no-pii', 'pro'], 2));
  check('돌릴 때마다 모양만 달라진다',
    again.score === withIt.score && text(again) !== text(withIt),
    `${again.score} vs ${withIt.score}`);
  check('막연한 규칙도 칸은 먹는다',
    doc.data.parts.find(p => p.id === 'pro').cost === 1);
}

// ③ 고쳐서 다시 돌리면 나아진다 (수리형)
{
  const first = doc.simulate(pack(FIRST, 1));
  const fixed = doc.simulate(pack(GOOD, 2));
  check('고쳐서 다시 돌리면 나아진다', fixed.score > first.score,
    `${first.score} → ${fixed.score}`);
  check('고친 뒤에는 통과한다', fixed.grade === 'pass', `${fixed.grade} ${fixed.score}`);
  check('고친 뒤에는 무시된 규칙이 없다',
    !Object.values(fixed.marks).includes('무시됨'), JSON.stringify(fixed.marks));
  check('다시 돌릴 기회가 판에 설정돼 있다',
    doc.data.repair && doc.data.repair.runs === 2, JSON.stringify(doc.data.repair));
}

// ④ 분량 초과 — 밀린 줄은 아예 안 읽힌다
{
  const over = doc.simulate(pack(['blank-mark', 'no-pii', 'ask', 'format', 'history']));
  check('분량을 넘기면 뒤로 밀린다', over.steps.some(s => /읽히지 않은 줄/.test(s.text)));
  check('밀린 줄에 밀려남 표시가 붙는다',
    Object.values(over.marks).includes('밀려남'), JSON.stringify(over.marks));
  check('밀린 것이 컨텍스트 초과로 잡힌다',
    names(over).includes('컨텍스트 초과'), names(over).join());
}

// ⑤ 넣을 수 있는 양보다 좋아 보이는 규칙이 많다
{
  const total = doc.data.parts.reduce((n, p) => n + (p.cost ?? 1), 0);
  check('규칙 총량이 분량보다 훨씬 많다', total > doc.data.budget * 2,
    `${total}칸 / ${doc.data.budget}칸`);
  const res = resolve(doc.data.parts, doc.data.parts.map(p => p.id), []);
  const t = tally(res);
  check('부딪히는 쌍이 정확히 하나다', t.beaten === 1, JSON.stringify(t));
  check('막연한 줄이 정확히 하나다', t.vague === 1, JSON.stringify(t));
  check('나머지는 다 발동한다', fired(res, 'no-pii') && fired(res, 'format'));
}

// ---------------------------------------------------------------- 16번 회귀
//
// 엔진 C 를 고쳤다. 같은 엔진을 쓰는 다른 판(슬롯형)이 계속 도는지 여기서 본다.
// 9번은 이번에 다른 엔진으로 옮겨 갔으므로 여기서 보지 않는다.
console.log('\n== 16번 회귀 (같은 엔진 · 슬롯형) ==');
{
  const slot = (m) => ({ kept: [], evicted: [], slots: m, all: Object.values(m).flat(),
    used: 0, cap: 0, runNo: 1 });
  check('16번이 아직 엔진 C 다', ticket.engine === 'C', ticket.engine);
  const good = ticket.simulate(slot({
    source: [{ id: 's-rules' }], method: [{ id: 'm-project' }],
    guard: [{ id: 'g-cite' }, { id: 'g-human' }]
  }), ticket.data);
  check('16번이 좋은 구성에서 통과한다', good.grade === 'pass', `${good.grade} ${good.score}`);
  check('16번 판정에 산출물 줄이 있다', good.steps.some(s => s.kind === 'out'));
  const bad = ticket.simulate(slot({
    source: [{ id: 's-web' }], method: [{ id: 'm-chat' }], guard: [{ id: 'g-none' }]
  }), ticket.data);
  check('16번이 나쁜 구성에서 사고를 낸다', bad.faults.length >= 2, String(bad.faults.length));
  check('16번은 회차형이 아니다 (설정이 안 섞였다)', !ticket.data.rounds && !ticket.data.repair);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
