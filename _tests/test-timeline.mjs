// 엔진 T(발동 타임라인) 검사 — 발동 계산과 8번 판의 판정.
//
// 화면에서는 하루를 한 번밖에 못 돌린다. 오답 경로가 여섯 갈래인데
// (안 걸기 · 스킬을 사람 순간에 · 서브를 늦게 · 커맨드를 안 누르기 ·
//  상자를 안 열기 · 아무 데나 걸기) 전부 손으로 밟을 수 없다. 여기서 만든다.

const ROOT = '../src';
const g8 = (await import(`${ROOT}/games/08-when-fires.js`)).default;
const { coverage, laneSpan, firings, byTick } = await import(`${ROOT}/core/fire.js`);

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };

const D = g8.data;
const M = D.moments;
const T = D.tools;
const tool = id => T.find(t => t.id === id);
const at = mid => M.findIndex(m => m.id === mid);
const run = (placed, presses = []) => g8.simulate({ placed, presses, opened: true }, D);
const names = r => r.faults.map(f => f.name);
const gains = r => r.gains.map(f => f.name);
const text = r => r.steps.map(s => s.text).join(' | ');

// ---------------------------------------------------------------- 발동 규칙
console.log('\n== 언제 발동하는가 (core/fire.js) ==');
{
  const edit = at('m3');       // AI가 파일을 고친다
  const editHuman = at('m7');  // 내가 손으로 파일을 고친다
  const send = at('m8');       // 사람이 파일을 내보낸다
  const draft = at('m1');

  const hookOnEdit = coverage(M, tool('hook1'), edit);
  check('훅은 같은 종류의 순간마다 발동한다', hookOnEdit.length === 2, hookOnEdit.join(','));
  check('훅은 사람이 하는 순간에도 발동한다', hookOnEdit.includes(editHuman), hookOnEdit.join(','));

  const skillOnEdit = coverage(M, tool('skill'), edit);
  check('스킬은 AI가 하는 순간에만 발동한다', skillOnEdit.length === 1, skillOnEdit.join(','));
  check('스킬은 사람이 하는 순간을 건너뛴다', !skillOnEdit.includes(editHuman));

  check('스킬을 사람만 하는 순간에 걸면 한 번도 안 돈다',
    coverage(M, tool('skill'), send).length === 0);
  check('훅을 같은 자리에 걸면 한 번 돈다',
    coverage(M, tool('hook1'), send).length === 1);

  check('스킬은 기획안 두 순간을 다 잡는다',
    coverage(M, tool('skill'), draft).length === 2);

  check('커맨드는 스스로 발동하지 않는다', coverage(M, tool('cmd'), draft).length === 0);
  check('걸지 않은 도구는 발동하지 않는다', coverage(M, tool('hook1'), null).length === 0);
  check('범위 밖에 걸면 발동하지 않는다', coverage(M, tool('hook1'), 99).length === 0);

  const lane = coverage(M, tool('agent'), 1);
  check('서브에이전트는 맡긴 자리에서 세 칸 뒤에 돌아온다', lane[0] === 4, String(lane[0]));
  const span = laneSpan(M, tool('agent'), 1);
  check('차선 구간이 계산된다', span.from === 1 && span.to === 4, JSON.stringify(span));
  check('늦게 맡기면 타임라인 밖을 가리킨다',
    coverage(M, tool('agent'), M.length - 1)[0] >= M.length);
  check('훅에는 차선이 없다', laneSpan(M, tool('hook1'), 2) === null);

  const grid = byTick(M, T, { hook1: edit }, [{ toolId: 'cmd', tick: 0 }]);
  check('순간별 표에 훅이 두 번 들어간다',
    grid.filter(g => g.some(x => x.toolId === 'hook1')).length === 2);
  check('손으로 누른 것도 표에 들어간다', grid[0].some(x => x.mode === 'manual'));
  check('범위 밖 누름은 무시된다',
    byTick(M, T, {}, [{ toolId: 'cmd', tick: 99 }]).every(g => g.length === 0));

  const f = firings(M, T, { hook1: edit, skill: at('m1'), agent: 1 });
  check('발동 목록이 시간 순이다', f.every((x, i) => i === 0 || f[i - 1].tick <= x.tick));
  check('걸어 둔 자리를 같이 알려 준다', f.every(x => typeof x.from === 'number'));
}

// ---------------------------------------------------------------- 데이터 모양
console.log('\n== 8번 데이터 모양 ==');
{
  check('순간이 여덟 이상이다', M.length >= 8, String(M.length));
  check('순간 id 에 중복이 없다', new Set(M.map(m => m.id)).size === M.length);
  check('모든 순간에 시각이 있다', M.every(m => /^\d\d:\d\d$/.test(m.clock)));
  check('사람이 하는 순간이 있다', M.some(m => !m.byAi));
  check('AI가 하는 순간이 있다', M.some(m => m.byAi));
  // 같은 종류인데 하나는 사람이 하는 순간 — 훅과 스킬을 가르는 자리다
  const tags = [...new Set(M.map(m => m.tag))];
  check('훅과 스킬이 갈리는 종류가 있다',
    tags.some(t => M.some(m => m.tag === t && m.byAi) && M.some(m => m.tag === t && !m.byAi)));

  check('발동 방식 네 가지가 다 있다',
    new Set(T.map(t => t.mode)).size === 4, [...new Set(T.map(t => t.mode))].join(','));
  check('상자 안에 든 도구가 있다', T.some(t => t.inBox));
  check('상자가 있다', !!D.box && !!D.box.label);
  check('지켜야 할 것이 다섯이다', D.goals.length === 5, String(D.goals.length));
  check('지켜야 할 것이 가리키는 순간이 실제로 있다',
    D.goals.every(g => !g.moment || at(g.moment) >= 0));
  check('지켜야 할 것이 가리키는 종류가 실제로 있다',
    D.goals.every(g => !g.tag || M.some(m => m.tag === g.tag)));
}

// ---------------------------------------------------------------- 정답 경로
console.log('\n== 하루를 돌린다 ==');
const BEST = { hook1: at('m3'), hook2: at('m8'), skill: at('m1'), agent: at('m2') };
const PRESS = [{ toolId: 'cmd', tick: at('m5') }];
{
  const r = run(BEST, PRESS);
  check('정답 경로는 다섯을 다 지킨다',
    Object.values(r.met).every(Boolean), JSON.stringify(r.met));
  check('정답 경로는 통과', r.grade === 'pass', `${r.grade} ${r.score}`);
  check('사고 없음', r.faults.length === 0, names(r).join(', '));
  check('잘한 점 넷이 다 붙는다', r.gains.length === 4, gains(r).join(', '));
  check('마지막 줄이 몇 가지를 지켰는지 말한다', /5가지를 지켰다/.test(text(r)), text(r));
}

// ---------------------------------------------------------------- 오답 경로
console.log('\n== 틀리는 길들 ==');
{
  // ① 아무것도 안 걸었다
  const none = run({}, []);
  check('아무것도 안 걸면 전부 실패', Object.values(none.met).every(v => !v));
  check('아무것도 안 걸면 반려', none.grade === 'fail', `${none.grade} ${none.score}`);
  check('발동하지 않은 일을 짚는다', names(none).includes('발동하지 않은 일'));

  // ② 안전장치를 스킬에 맡겼다 — 이 판의 핵심 함정
  const soft = run({ ...BEST, hook1: null, skill: at('m3') }, PRESS);
  check('스킬로 검사를 대신하면 빠짐없이가 아니다', soft.met.g1 === false);
  check('AI 판단에 맡긴 자리를 이름으로 짚는다',
    names(soft).includes('AI 판단에 맡긴 자리'), names(soft).join(', '));
  check('사람이 한 순간을 시각과 함께 짚는다', /15:00/.test(text(soft)), text(soft));
  check('그래도 반려까지 가지는 않는다', soft.grade !== 'fail', `${soft.grade} ${soft.score}`);

  // 스킬을 반출 순간에 걸면 한 번도 안 돈다
  const dead = run({ ...BEST, hook2: null, skill: at('m8') }, PRESS);
  check('사람만 하는 순간에 건 스킬은 아무 일도 못 한다', dead.met.g2 === false);

  // ③ 서브에이전트를 필요해지는 순간에 걸었다
  const late = run({ ...BEST, agent: at('m6') }, PRESS);
  check('회의 때 맡기면 회의 전에 못 받는다', late.met.g4 === false);
  check('늦은 발동으로 이름 붙인다', names(late).includes('늦은 발동'), names(late).join(', '));
  check('발동하지 않은 일로 세지 않는다',
    !names(late).includes('발동하지 않은 일'), names(late).join(', '));

  // 아예 안 맡긴 것은 늦은 것과 다르다
  const noAgent = run({ ...BEST, agent: null }, PRESS);
  check('안 맡긴 것은 늦은 발동이 아니다', !names(noAgent).includes('늦은 발동'));
  check('안 맡긴 것은 발동하지 않은 일이다', names(noAgent).includes('발동하지 않은 일'));

  // ④ 커맨드를 안 눌렀다
  const quiet = run(BEST, []);
  check('커맨드를 안 누르면 주간보고가 안 나온다', quiet.met.g3 === false);
  // **넷을 지키면 통과한다.** 예전에는 다섯을 전부 지켜야만 통과였는데(하나 놓치면
  // 78점 조건부), 이 판은 다섯 도구의 발동 시점을 **처음 만나는 자리**다.
  // 처음 배우는 것을 다섯 개 한꺼번에 다 맞혀야 통과시키면 배우기 전에 막힌다.
  // 사용자가 "개념이 어렵다"고 한 판이라 2026-08-19 에 하나당 22점 → 14점으로 낮췄다.
  check('네 가지를 지키면 통과한다', quiet.grade === 'pass', `${quiet.grade} ${quiet.score}`);
  check('그래도 만점은 아니다 — 못 지킨 것이 점수에 남는다',
    quiet.score < 100, `${quiet.score}점`);
  // 낮췄어도 판단은 여전히 결과를 바꾼다 — 아무것도 안 하면 통과하지 못한다
  const idle = run({ hook1: null, hook2: null, skill: null, agent: null }, []);
  check('아무것도 안 하면 통과하지 못한다', idle.grade !== 'pass',
    `${idle.grade} ${idle.score}`);
  check('둘의 점수가 다르다', idle.score !== quiet.score,
    `${quiet.score}점 vs ${idle.score}점`);

  // 한 칸 늦게 눌러도 인정한다 (순간이 1초도 안 된다)
  const slow = run(BEST, [{ toolId: 'cmd', tick: at('m5') + 1 }]);
  check('한 칸 늦은 누름은 인정한다', slow.met.g3 === true);
  const early = run(BEST, [{ toolId: 'cmd', tick: at('m5') - 2 }]);
  check('한참 이른 누름은 인정하지 않는다', early.met.g3 === false);

  // ⑤ 상자를 안 열었다 — 도구가 둘뿐이다
  const closed = run({ hook1: at('m3') }, PRESS);
  const kept = Object.values(closed.met).filter(Boolean).length;
  check('상자를 안 열면 둘까지만 지킨다', kept === 2, `${kept}가지`);
  // 반려에서 조건부로 올라왔다 — 못 지킨 것 하나당 22점을 14점으로 낮춘 여파다.
  // **통과하지 못한다는 것이 중요한 것**이지 반려냐 조건부냐는 아니다.
  // 상자를 여는 것이 이 판의 첫 단추라는 사실은 그대로다(다섯 중 둘밖에 못 지킨다).
  // 이제 [지금 할 일] 줄이 아직 안 열었으면 상자부터 짚어 준다.
  check('상자를 안 열면 통과하지 못한다', closed.grade !== 'pass',
    `${closed.grade} ${closed.score}`);

  // ⑥ 아무 데나 걸어 헛발동을 냈다
  const noisy = run({ ...BEST, hook1: at('m9') }, [
    ...PRESS, { toolId: 'cmd', tick: 0 }, { toolId: 'cmd', tick: 1 }
  ]);
  check('필요 없는 자리의 발동을 헛발동으로 센다',
    names(noisy).includes('헛발동'), names(noisy).join(', '));
  check('헛발동은 세 건까지만 깎는다',
    names(noisy).filter(n => n === '헛발동').length <= 3);
  check('정답 경로에는 헛발동이 없다', !names(run(BEST, PRESS)).includes('헛발동'));
}

// ---------------------------------------------------------------- 판정 짜임새
console.log('\n== 판정 짜임새 ==');
{
  const r = run(BEST, PRESS);
  check('지켜야 할 것마다 로그가 한 줄씩 있다',
    D.goals.every(g => text(r).includes(g.text)));
  check('met 이 지켜야 할 것 전부를 담는다',
    D.goals.every(g => typeof r.met[g.id] === 'boolean'));
  check('점수가 0~100 안이다', r.score >= 0 && r.score <= 100, String(r.score));
  check('빈 setup 으로도 판정이 돈다', typeof g8.simulate({}, D).score === 'number');
  check('해금 용어가 다섯이다', g8.concept.length === 5, g8.concept.join(', '));
  check('해금 용어가 화면 문구에 다 나온다',
    g8.concept.every(c => JSON.stringify(g8).includes(c)),
    g8.concept.filter(c => !JSON.stringify(g8).includes(c)).join(', '));
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
