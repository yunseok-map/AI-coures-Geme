// 엔진 I(숨은 지시) 검사 — 인젝션 규칙과 15번 판 판정.
//
// 이 판은 두 판이다. 전반은 "심은 것이 통했나", 후반은 "세 건을 다 막았나".
// 화면에서 손으로 해 보는 것으로는 다음을 다 밟을 수 없다:
//   안 읽히는 자리에 심은 경우 · 없는 도구를 시킨 경우 · 대응책을 하나도 안 건 경우 ·
//   사람 승인에만 다 맡긴 경우 · 사람이 건넨 글을 출처 구분으로 막으려 한 경우.
// 여기서 조합을 직접 만들어 전부 돌린다.
//
// 엔진이 화면에 그릴 때 쓰는 함수와 simulate 가 쓰는 함수가 같다
// (core/inject.js 의 defend · coverage · cost · craft). 여기서 그걸 잡으면 화면도 같이 잡힌다.

const ROOT = '../src';
const { byId, lands, craft, build, lineup, stops, defend, coverage, cost, attackLog } =
  await import(`${ROOT}/core/inject.js`);
const game = (await import(`${ROOT}/games/15-spot-risk.js`)).default;

const d = game.data;
const W = (id) => byId(d.wheres, id);
const P = (id) => byId(d.whats, id);
const G = (id) => byId(d.guards, id);

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('  OK   ' + n); }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };

/** 한 판 돌린다 */
const play = (whereId, whatId, guardIds = []) =>
  game.simulate({ whereId, whatId, guardIds }, d);
const names = (r) => r.faults.map(f => f.name);
const gains = (r) => r.gains.map(g => g.name);

/** 후반에 실제로 들어오는 세 건 */
function lineOf(whereId, whatId) {
  const mine = build({ id: 'mine', label: d.labels.mineDoc, where: whereId, what: whatId },
    d.wheres, d.whats, d.agent);
  return lineup(d.fixed.map(f => build(f, d.wheres, d.whats, d.agent)), mine,
    build(d.fallback, d.wheres, d.whats, d.agent));
}

// ---------------------------------------------------------------- 규칙: 닿는가
console.log('\n== core/inject.js — 심은 것이 에이전트에 닿는가 ==');
{
  check('오늘 읽는 자리에 심으면 읽힌다', lands(W('web'), P('fetch'), d.agent).read);
  check('오늘 안 읽는 자리에 심으면 안 읽힌다', !lands(W('cal'), P('fetch'), d.agent).read);
  check('가진 도구로 시키면 할 수 있다', lands(W('web'), P('send'), d.agent).able);
  check('없는 도구를 시키면 못 한다', !lands(W('web'), P('del'), d.agent).able);
  check('도구가 필요 없는 일은 늘 할 수 있다', lands(W('web'), P('hide'), d.agent).able);

  check('읽히고 할 수 있어야 통한다', lands(W('doc'), P('send'), d.agent).ok);
  check('안 읽히면 도구가 있어도 안 통한다', !lands(W('cal'), P('send'), d.agent).ok);
  check('읽혀도 도구가 없으면 안 통한다', !lands(W('doc'), P('del'), d.agent).ok);
}

console.log('\n== core/inject.js — 심어 둔 문장 ==');
{
  const c = craft(W('web'), P('send'));
  check('자리 이름을 그대로 쓴다', c.place === W('web').label);
  check('숨기는 방법을 그대로 쓴다', c.how === W('web').hidden);
  check('심는 문장을 그대로 쓴다', c.line === P('send').line);

  // 화면(엔진)에 뜬 문장과 판정 로그의 문장이 같아야 한다
  const r = play('web', 'send', []);
  check('판정 로그가 화면과 같은 문장을 인용한다',
    r.steps.some(s => s.text === c.line), r.steps.map(s => s.text).join(' | ').slice(0, 60));
}

console.log('\n== core/inject.js — 대응책이 덮는 범위 ==');
{
  const web = { where: W('web'), what: P('fetch') };
  const att = { where: W('att'), what: P('send') };
  const paste = { where: W('paste'), what: P('hide') };

  check('출처 구분은 에이전트가 가져온 글을 막는다', stops(G('origin'), web));
  check('출처 구분은 사람이 건넨 글을 못 막는다', !stops(G('origin'), att));
  check('권한 축소는 메일 전송을 막는다', stops(G('least'), att));
  check('권한 축소는 웹 열기를 못 막는다', !stops(G('least'), web));
  check('도구 차단은 밖으로 나가는 도구를 다 막는다',
    stops(G('cut'), web) && stops(G('cut'), att));
  check('도구 차단도 도구 없는 지시는 못 막는다', !stops(G('cut'), paste));
  check('사람 승인은 구조로는 아무것도 안 막는다 (용량으로 센다)',
    !stops(G('human'), web) && !stops(G('human'), paste));

  const cv = coverage([G('origin'), G('least')]);
  check('덮는 범위가 화면에 낼 이름으로 나온다',
    cv.origins.includes('tool') && cv.tools.includes('mail'), JSON.stringify(cv));
  check('사람 승인을 켜면 볼 수 있는 건수가 나온다',
    coverage([G('human')]).cap === 1, String(coverage([G('human')]).cap));
  check('아무것도 안 켜면 덮는 것이 없다',
    coverage([]).origins.length === 0 && coverage([]).tools.length === 0);
}

console.log('\n== core/inject.js — 안전 대신 잃는 것 ==');
{
  check('도구 차단은 오늘 업무를 멈춘다', cost([G('cut')], d.agent).length === 1);
  check('권한 축소는 오늘 업무를 안 멈춘다', cost([G('least')], d.agent).length === 0);
  check('출처 구분은 오늘 업무를 안 멈춘다', cost([G('origin')], d.agent).length === 0);
  check('멈추는 도구 이름이 나온다', cost([G('cut')], d.agent)[0].tools.includes('web'));
}

console.log('\n== core/inject.js — 사람 승인의 용량 ==');
{
  const atks = lineOf('paste', 'hide');   // 셋 다 구조로는 안 막힌다
  const v0 = defend(atks, []);
  check('아무것도 안 걸면 셋 다 지나간다', v0.rows.every(r => r.through), JSON.stringify(v0.rows));

  const v1 = defend(atks, [G('human')]);
  check('사람 승인은 한 건만 잡는다', v1.rows.filter(r => r.stopped).length === 1);
  check('나머지는 그냥 통과한다', v1.rows.filter(r => r.through).length === 2);
  check('확인할 것이 넘치면 자동화 편향이 잡힌다', v1.fatigue && v1.need === 3,
    `need ${v1.need}`);

  const v2 = defend(atks, [G('cut'), G('human')]);
  check('구조로 둘을 막으면 사람은 한 건만 보면 된다', v2.need === 1 && !v2.fatigue,
    `need ${v2.need}`);
  check('그때는 셋 다 막힌다', v2.rows.every(r => r.stopped));
  check('사람이 잡은 건은 표시가 남는다', v2.rows.filter(r => r.gate).length === 1);
}

// ---------------------------------------------------------------- 데이터 짜임새
console.log('\n== 데이터 짜임새 ==');
{
  check('숨길 자리가 4개 이상이다', d.wheres.length >= 4, String(d.wheres.length));
  check('시킬 일이 4개 이상이다', d.whats.length >= 4, String(d.whats.length));
  check('대응책이 넷이다', d.guards.length === 4, String(d.guards.length));
  check('한 판에 두 개까지만 건다', d.budget === 2, String(d.budget));

  check('자리 아이디가 중복되지 않는다', new Set(d.wheres.map(w => w.id)).size === d.wheres.length);
  check('시킬 일 아이디가 중복되지 않는다', new Set(d.whats.map(p => p.id)).size === d.whats.length);
  check('대응책 아이디가 중복되지 않는다', new Set(d.guards.map(g => g.id)).size === d.guards.length);

  check('자리마다 어느 쪽에서 들어온 글인지 있다',
    d.wheres.every(w => w.origin === 'tool' || w.origin === 'user'));
  check('자리 이름에 붙는 뜻풀이가 다 있다', d.wheres.every(w => w.label && w.hidden));
  check('시킬 일마다 심는 문장이 있다', d.whats.every(p => p.line && p.done && p.hurt));

  // 공격이 성립하려면 두 조건이 다 필요하다 — 데이터에 실제로 함정이 들어 있는가
  const dead = d.wheres.filter(w => !d.agent.reads.includes(w.id));
  check('오늘 안 읽는 자리가 하나 있다 (읽히는 자리에 심어야 한다)', dead.length === 1,
    String(dead.length));
  const nogo = d.whats.filter(p => p.tool && !d.agent.tools.includes(p.tool));
  check('에이전트에게 없는 도구를 시키는 항목이 하나 있다', nogo.length === 1, String(nogo.length));
  const free = d.whats.filter(p => !p.tool);
  check('도구가 필요 없는 항목이 하나 있다 (권한만으로는 못 막는다)', free.length === 1,
    String(free.length));

  // 사람이 건넨 글이 있어야 출처 구분에 구멍이 생긴다
  const fromUser = d.wheres.filter(w => w.origin === 'user');
  check('사람이 건넨 자리가 둘 이상이다', fromUser.length >= 2, String(fromUser.length));

  // 고정 공격 둘은 서로 다른 대응책을 요구해야 한다 — 아니면 하나만 걸어도 이긴다
  const fx = d.fixed.map(f => build(f, d.wheres, d.whats, d.agent));
  check('고정 공격 둘이 실제로 통하는 공격이다', fx.every(a => a.ok));
  // 고정 공격 둘을 한 방에 덮는 대응책이 있어도 된다 — 단 **대가가 있어야** 한다.
  // 대가 없이 다 덮는 것이 있으면 그것만 켜면 되고, 고를 이유가 사라진다.
  const sweeps = d.guards.filter(g => !g.stops.any && fx.every(a => stops(g, a)));
  check('공짜로 고정 공격 둘을 다 막는 대응책은 없다',
    sweeps.every(g => cost([g], d.agent).length > 0),
    sweeps.filter(g => !cost([g], d.agent).length).map(g => g.id).join(', '));

  const fb = build(d.fallback, d.wheres, d.whats, d.agent);
  check('자리를 옮긴 공격도 실제로 통하는 공격이다', fb.ok);

  // 모든 (자리 × 시킬 일) 조합에 대해 막을 방법이 하나라도 있어야 한다
  const bad = [];
  for (const w of d.wheres) for (const p of d.whats) {
    const a = build({ id: 'x', label: 'x', where: w.id, what: p.id }, d.wheres, d.whats, d.agent);
    if (!a.ok) continue;                       // 안 통하는 공격은 막을 것도 없다
    const can = d.guards.some(g => g.stops.any || stops(g, a));
    if (!can) bad.push(`${w.id}+${p.id}`);
  }
  check('통하는 공격은 전부 막을 수 있다 (이길 수 없는 판이 없다)', bad.length === 0,
    bad.join(', '));
}

console.log('\n== 전반 로그 ==');
{
  const good = build({ id: 'mine', label: 'x', where: 'web', what: 'send' },
    d.wheres, d.whats, d.agent);
  const steps = attackLog(good, d.say);
  check('통한 공격은 사고로 끝난다', steps.at(-1).text === d.say.attackWin, steps.at(-1).text);
  check('통한 공격 로그에 심은 문장이 들어간다', steps.some(s => s.text === P('send').line));

  const blind = build({ id: 'mine', label: 'x', where: 'cal', what: 'send' },
    d.wheres, d.whats, d.agent);
  check('안 읽히면 심은 문장이 로그에 안 나온다',
    !attackLog(blind, d.say).some(s => s.text === P('send').line));
  check('안 읽히면 실패로 끝난다', attackLog(blind, d.say).at(-1).text === d.say.attackFail);

  const weak = build({ id: 'mine', label: 'x', where: 'web', what: 'del' },
    d.wheres, d.whats, d.agent);
  check('도구가 없으면 문장은 읽히지만 실행은 안 된다',
    attackLog(weak, d.say).some(s => s.text === P('del').line) &&
    attackLog(weak, d.say).at(-1).text === d.say.attackFail);
}

// ---------------------------------------------------------------- 정답 경로
console.log('\n== 정답 경로 — 통하는 공격을 만들고 세 건을 다 막았다 ==');
{
  const r = play('doc', 'send', ['origin', 'least']);
  check('통과', r.grade === 'pass', `${r.grade} ${r.score}점`);
  check('점수 100', r.score === 100, String(r.score));
  check('실패 사유 없음', r.faults.length === 0, names(r).join(' / '));
  check('가드레일을 딴다', gains(r).includes('가드레일'), gains(r).join(' / '));
  check('최소 권한을 딴다', gains(r).includes('최소 권한'), gains(r).join(' / '));
  check('공격을 직접 만들어 본 것도 인정된다', gains(r).includes('경계 확인'));
  check('mistakes 없음', r.mistakes.length === 0);
  check('결과 문구가 다 막았다고 말한다', /세 건을 다 막았/.test(r.steps.at(-1).text),
    r.steps.at(-1).text);
}

console.log('\n== 정답 경로 — 도구 없는 공격을 만들면 대가를 치르고 막는다 ==');
{
  // paste + hide 는 구조로 못 막는다. 사람이 한 건 보고, 나머지 둘은 통로를 끊어야 한다.
  const r = play('paste', 'hide', ['human', 'cut']);
  check('통과', r.grade === 'pass', `${r.grade} ${r.score}점`);
  check('업무 중단이 대가로 남는다', names(r).includes('업무 중단'), names(r).join(' / '));
  check('자동화 편향은 안 뜬다 (사람이 한 건만 봤다)', !names(r).includes('자동화 편향'));
  check('휴먼 인 더 루프를 딴다', gains(r).includes('휴먼 인 더 루프'), gains(r).join(' / '));
  check('결과 문구가 업무가 멈췄다고 말한다', /업무 하나가 멈췄다/.test(r.steps.at(-1).text),
    r.steps.at(-1).text);

  // 같은 공격을 무난한 조합으로 막으려 하면 자기 것이 뚫린다
  const bad = play('paste', 'hide', ['origin', 'least']);
  check('출처 구분과 권한 축소로는 자기 공격을 못 막는다', bad.grade !== 'pass',
    `${bad.grade} ${bad.score}점`);
  check('그때 뚫린 것이 자기 것이다', bad.mistakes.some(m => m.itemId === 'mine'),
    bad.mistakes.map(m => m.itemId).join(', '));
}

// ---------------------------------------------------------------- 오답 경로
console.log('\n== 오답 경로 하나 — 아무것도 안 걸었다 ==');
{
  const r = play('doc', 'send', []);
  check('등급 fail', r.grade === 'fail', `${r.grade} ${r.score}점`);
  check('세 건이 다 프롬프트 인젝션으로 기록된다',
    names(r).filter(n => n === '프롬프트 인젝션').length === 3, names(r).join(' / '));
  check('세 건이 다 mistakes 에 담긴다', r.mistakes.length === 3, String(r.mistakes.length));
  check('가드레일은 못 딴다', !gains(r).includes('가드레일'));
  check('결과 문구가 몇 건 실행됐는지 말한다', /3건이 그대로 실행됐다/.test(r.steps.at(-1).text),
    r.steps.at(-1).text);
}

console.log('\n== 오답 경로 둘 — 사람 승인에만 다 맡겼다 ==');
{
  const r = play('doc', 'send', ['human']);
  check('등급 fail', r.grade === 'fail', `${r.grade} ${r.score}점`);
  check('자동화 편향이 용어 그대로 기록된다', names(r).includes('자동화 편향'), names(r).join(' / '));
  check('두 건이 지나간다', names(r).filter(n => n === '프롬프트 인젝션').length === 2,
    names(r).join(' / '));
  check('사람 확인은 잘한 점으로 안 쳐준다 (무뎌졌으니까)',
    !gains(r).includes('휴먼 인 더 루프'), gains(r).join(' / '));
}

console.log('\n== 오답 경로 셋 — 대응책을 잘못 골랐다 (사람이 건넨 글) ==');
{
  // 출처 구분은 에이전트가 가져온 글만 본다. 사람이 올린 첨부는 그대로 지나간다.
  const r = play('doc', 'send', ['origin']);
  check('통과는 아니다', r.grade !== 'pass', `${r.grade} ${r.score}점`);
  check('한 건이 지나간다', names(r).filter(n => n === '프롬프트 인젝션').length === 1,
    names(r).join(' / '));
  check('지나간 것이 사람이 건넨 글이다', r.mistakes.some(m => m.itemId === 'a2'),
    r.mistakes.map(m => m.itemId).join(', '));
  check('힌트가 왜 안 막혔는지를 말한다',
    /사람이 건넨 글/.test(r.mistakes.find(m => m.itemId === 'a2').hint),
    r.mistakes.find(m => m.itemId === 'a2').hint);
}

console.log('\n== 오답 경로 넷 — 권한만 열어 둔 채 도구 쪽만 막았다 ==');
{
  // 권한 축소는 메일·삭제만 본다. 웹으로 실어 내보내는 것은 그대로 나간다.
  const r = play('doc', 'send', ['least']);
  check('통과는 아니다', r.grade !== 'pass', `${r.grade} ${r.score}점`);
  check('웹으로 나간 건이 지나간다', r.mistakes.some(m => m.itemId === 'a1'),
    r.mistakes.map(m => m.itemId).join(', '));
  check('힌트가 어떤 도구를 썼는지 말한다',
    /웹 열기/.test(r.mistakes.find(m => m.itemId === 'a1').hint),
    r.mistakes.find(m => m.itemId === 'a1').hint);
}

console.log('\n== 오답 경로 다섯 — 전반에서 공격이 안 통했다 ==');
{
  const blind = play('cal', 'send', ['origin', 'least']);
  check('안 읽히는 자리는 통과가 아니다', blind.grade !== 'pass', `${blind.grade} ${blind.score}점`);
  check('읽지 않는 자리로 잡힌다', names(blind).includes('읽지 않는 자리'), names(blind).join(' / '));
  check('공격을 만들어 본 점수는 못 딴다', !gains(blind).includes('경계 확인'));
  check('전반 실패는 전반 몫으로만 잡힌다',
    blind.mistakes.length === 1 && blind.mistakes[0].itemId === 'mine',
    blind.mistakes.map(m => m.itemId).join(', '));
  check('공격자가 자리를 옮겨 후반은 그래도 세 건이다',
    blind.steps.some(s => s.text.includes(d.fallback.label)),
    blind.steps.map(s => s.text).join(' | ').slice(0, 80));

  const weak = play('web', 'del', ['origin', 'least']);
  check('없는 도구를 시킨 것도 통과가 아니다', weak.grade !== 'pass',
    `${weak.grade} ${weak.score}점`);
  check('없는 도구로 잡힌다', names(weak).includes('없는 도구'), names(weak).join(' / '));

  // 일부러 헛다리 공격을 짚어 후반을 쉽게 만드는 것이 이득이면 안 된다
  const good = play('doc', 'send', ['origin', 'least']);
  check('헛다리 공격이 제대로 된 공격보다 유리하지 않다', weak.score < good.score,
    `${weak.score} vs ${good.score}`);
}

console.log('\n== 판이 끝까지 돌아간다 ==');
{
  // 게임오버가 없다. 최악의 조합으로도 판정이 나온다.
  const worst = play('cal', 'del', []);
  check('가장 나쁜 조합으로도 판정이 나온다',
    typeof worst.score === 'number' && !!worst.grade, worst.grade);
  check('점수가 0 아래로 안 내려간다', worst.score >= 0, String(worst.score));
  check('결과 문구는 그래도 나온다', !!worst.steps.at(-1).text);

  // 한 건이라도 지나가면 통과는 없다
  const leaks = [];
  for (const w of d.wheres) for (const p of d.whats) {
    for (const g of [[], ['origin'], ['least'], ['human'], ['cut'],
      ['origin', 'least'], ['origin', 'human'], ['origin', 'cut'],
      ['least', 'human'], ['least', 'cut'], ['human', 'cut']]) {
      const r = play(w.id, p.id, g);
      const through = r.faults.filter(f => f.name === '프롬프트 인젝션').length;
      if (through > 0 && r.grade === 'pass') leaks.push(`${w.id}+${p.id} [${g.join(',')}]`);
    }
  }
  check('한 건이라도 지나가면 통과가 아니다', leaks.length === 0, leaks.slice(0, 4).join(' / '));
}

console.log('\n== 로그가 읽히는 길이인가 ==');
{
  const all = [
    ...play('doc', 'send', ['origin', 'least']).steps,
    ...play('cal', 'del', []).steps,
    ...play('paste', 'hide', ['human', 'cut']).steps
  ];
  const long = all.filter(s => s.text.length > 40);
  check('로그 한 줄이 40자를 넘지 않는다', long.length === 0,
    long.map(s => `${s.text.length}자 ${s.text}`).join(' | '));
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
