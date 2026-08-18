// 엔진 E(미리보기형) 검사 — 3번 "지시문 고쳐쓰기".
//
// 이 판이 깨려는 오해는 하나다: **"많이 넣으면 좋다."**
// 화면에서 손으로 켜 보는 것으로는 32가지 조합을 다 밟을 수 없다. 여기서 전수로 돌려서
// "전부 켠 것이 최고점이 아니다"를 숫자로 못 박는다. 이 검사가 통과하는 한
// 누가 나중에 블록을 하나 더 붙여도 그 성질이 조용히 사라지지 않는다.
//
//   node _tests/test-preview.mjs

const ROOT = '../src';
const mod = await import(`${ROOT}/games/03-rewrite-prompt.js`);
const g3 = mod.default;
const { compose, distance, clashing } = mod;

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };

const D = g3.data;
const IDS = D.toggles.map(t => t.id);
const ALL = [...IDS];
const BEST = ['role', 'context', 'format', 'example'];   // 제약만 끈 조합

const sc = a => distance(a).score;
const ids = a => compose(a).map(l => l.id);
const slots = a => compose(a).map(l => l.slot);
const names = r => r.faults.map(f => f.name);
const gains = r => r.gains.map(f => f.name);
const text = r => r.steps.map(s => s.text).join(' | ');

/** 32가지 조합 전부 */
function everyCombo() {
  const out = [];
  for (let m = 0; m < (1 << IDS.length); m++) {
    out.push(IDS.filter((_, i) => m & (1 << i)));
  }
  return out;
}

// ---------------------------------------------------------------- 판 데이터
console.log('\n== 3번 데이터 모양 ==');
check('블록이 다섯 개다', IDS.length === 5, String(IDS.length));
check('블록 id 에 중복이 없다', new Set(IDS).size === IDS.length);
check('블록마다 이름·꼬리표·설명이 있다',
  D.toggles.every(t => t.label && t.tag && t.desc));
check('목표 결과물이 있다', Array.isArray(D.goal) && D.goal.length >= 3, String(D.goal?.length));
check('목표 줄의 글이 다 있다', D.goal.every(id => typeof D.lines[id] === 'string' && D.lines[id].length > 10));
check('충돌 쌍이 정해져 있다', Array.isArray(D.clash) && D.clash.length === 2, String(D.clash));
check('충돌 쌍이 실제 블록이다', D.clash.every(id => IDS.includes(id)), D.clash.join(', '));
check('지시문 조각이 블록마다 있다', IDS.every(id => typeof D.asks[id] === 'string'));

// ---------------------------------------------------------------- 순수 함수인가
console.log('\n== compose · distance 가 순수 함수인가 ==');
{
  const before = JSON.stringify(D);
  const a = ids(ALL), b = ids(ALL);
  check('같은 입력이면 같은 결과', JSON.stringify(a) === JSON.stringify(b));
  distance([...BEST]); compose([...BEST]);
  check('부르고 나서 데이터가 그대로다', JSON.stringify(D) === before);
  const arg = [...BEST];
  compose(arg);
  check('넘긴 배열을 건드리지 않는다', arg.length === BEST.length);
  check('DOM 없이 돌아간다', typeof globalThis.document === 'undefined');
}

// ---------------------------------------------------------------- 이 판의 핵심
console.log('\n== "많이 넣으면 좋다"가 깨지는가 ==');
{
  const all = sc(ALL);
  const best = sc(BEST);

  // ★ 이 판을 만든 이유. 이 줄이 깨지면 판이 예전으로 돌아간 것이다.
  check(`전부 켠 점수(${all}) < 최적 조합 점수(${best})`, all < best, `${all} vs ${best}`);
  console.log(`  · 전부 켬 ${ALL.length}개 → ${all}점 / 최적 ${BEST.length}개 → ${best}점 (차이 ${best - all}점)`);

  // 전수 조사 — 최고점이 "전부 켜기"가 아니라 딱 한 조합에만 있다
  const table = everyCombo().map(c => ({ c, s: sc(c) }));
  const top = Math.max(...table.map(r => r.s));
  const winners = table.filter(r => r.s === top);
  check('32가지 조합을 다 돌렸다', table.length === 32, String(table.length));
  check('최고점 조합이 하나뿐이다', winners.length === 1,
    winners.map(w => w.c.join('+')).join(' / '));
  check('그 조합이 최적 조합이다',
    winners[0].c.slice().sort().join(',') === BEST.slice().sort().join(','),
    winners[0].c.join('+'));
  check('전부 켠 조합은 최고점이 아니다', top > all, `최고 ${top} vs 전부 ${all}`);
  check('블록을 하나 더 켠다고 늘 좋아지지 않는다',
    table.some(r => r.c.length > BEST.length && r.s < best));

  console.log('  · 블록 수별 최고점: ' + [0, 1, 2, 3, 4, 5]
    .map(n => `${n}개 ${Math.max(...table.filter(r => r.c.length === n).map(r => r.s))}점`).join(' · '));
}

// ---------------------------------------------------------------- 충돌 쌍
console.log('\n== 충돌 쌍 ==');
{
  const [A, B] = D.clash;                     // format · brief
  const base = IDS.filter(id => id !== A && id !== B);   // 나머지는 다 켠 상태

  const neither = distance(base);
  const onlyA = distance([...base, A]);
  const onlyB = distance([...base, B]);
  const both = distance([...base, A, B]);

  console.log(`  · 둘 다 끔 ${neither.score}점 / ${A}만 ${onlyA.score}점 / ` +
              `${B}만 ${onlyB.score}점 / 둘 다 ${both.score}점`);

  // ★ 요구된 검사 둘
  check(`충돌 쌍을 둘 다 켜면 목표에서 멀어진다 (${both.score} < ${onlyA.score})`,
    both.score < onlyA.score, `${both.score} vs ${onlyA.score}`);
  check(`맞는 하나만 켜면 목표에 가까워진다 (${onlyA.score} > ${neither.score})`,
    onlyA.score > neither.score, `${onlyA.score} vs ${neither.score}`);

  // 거리로도 확인한다 — 점수는 거리에서 나오므로 둘이 같은 말을 해야 한다
  check('둘 다 켜면 목표에서 빠진 줄이 늘어난다',
    both.missing.length > onlyA.missing.length,
    `${both.missing.join(',')} vs ${onlyA.missing.join(',')}`);
  check('둘 다 켜면 목표에 없는 줄이 낀다', both.extra.length > onlyA.extra.length,
    both.extra.join(', '));
  check('맞는 쪽만 켜면 목표 네 줄을 다 맞춘다', onlyA.missing.length === 0,
    onlyA.missing.join(', '));

  // 반대쪽(제약)만 켜는 것은 아무것도 안 켠 것보다 낫지 않다
  check('반대쪽만 켜면 나아지지 않는다', onlyB.score <= neither.score,
    `${onlyB.score} vs ${neither.score}`);

  check('둘 다 켜야 충돌로 본다',
    clashing([...base, A, B]) && !clashing([...base, A]) && !clashing([...base, B]));
}

// ---------------------------------------------------------------- 점수는 목표와의 거리
console.log('\n== 점수가 목표와의 거리인가 ==');
{
  for (const c of everyCombo()) {
    const r = distance(c);
    const same = r.hit === r.total - r.missing.length;
    if (!same) { check(`조합 ${c.join('+')} 의 일치 수`, false, `${r.hit}/${r.total}`); break; }
  }
  check('맞은 줄 수와 빠진 줄 수가 어긋나지 않는다', true);

  // 맞은 줄이 많을수록 점수가 높아야 한다 (같은 군더더기 수에서)
  const rows = everyCombo().map(c => distance(c));
  let mono = true;
  for (const a of rows) for (const b of rows) {
    if (a.extra.length === b.extra.length && a.hit > b.hit && a.score <= b.score) mono = false;
  }
  check('군더더기가 같으면 많이 맞힌 쪽이 점수가 높다', mono);

  check('목표를 다 맞히면 100점', distance(BEST).score === 100, String(distance(BEST).score));
  check('아무것도 안 켜면 목표에서 가장 멀다',
    distance([]).hit === 0, String(distance([]).hit));
  check('빠진 줄이 없으면 군더더기도 없다', distance(BEST).extra.length === 0);
}

// ---------------------------------------------------------------- 바뀐 부분이 보이는가
console.log('\n== 켜고 끌 때 무엇이 바뀌었는지 ==');
{
  // 엔진은 slot 으로 앞 화면과 맞춰 본다. 같은 자리에 다른 글 = 달라진 줄,
  // 자리가 생김 = 새로 생긴 줄, 자리가 없어짐 = 사라진 줄.
  const diff = (a, b) => {
    const was = new Map(compose(a).map(l => [l.slot, l]));
    const now = compose(b);
    const nowSlots = new Set(now.map(l => l.slot));
    return {
      add: now.filter(l => !was.has(l.slot)).length,
      changed: now.filter(l => was.has(l.slot) && was.get(l.slot).id !== l.id).length,
      gone: [...was.keys()].filter(s => !nowSlots.has(s)).length
    };
  };

  check('줄마다 자리 이름이 붙어 있다',
    everyCombo().every(c => compose(c).every(l => l.slot && l.id && l.text)));
  check('한 화면에 같은 자리가 두 번 나오지 않는다',
    everyCombo().every(c => new Set(slots(c)).size === slots(c).length));

  const on = diff([], ['role']);
  check('역할을 켜면 줄이 새로 생긴다', on.add === 1 && on.gone === 0, JSON.stringify(on));
  const off = diff(['role'], []);
  check('역할을 끄면 줄이 사라진다', off.gone === 1 && off.add === 0, JSON.stringify(off));

  const ctx = diff(['role', 'format'], ['role', 'format', 'context']);
  check('맥락을 켜면 같은 자리의 글이 달라진다', ctx.changed >= 3 && ctx.add === 0,
    JSON.stringify(ctx));

  const fmt = diff(['role', 'context'], ['role', 'context', 'format']);
  check('형식을 켜면 한 덩어리가 세 줄로 갈린다',
    fmt.add === 3 && fmt.gone === 1, JSON.stringify(fmt));

  const cl = diff(BEST, ALL);
  check('제약을 켜면 두 줄이 달라진다', cl.changed === 2, JSON.stringify(cl));
  check('그 두 줄이 목표에서 떨어져 나간다',
    compose(ALL).filter(l => D.goal.includes(l.id)).length === 2,
    String(compose(ALL).filter(l => D.goal.includes(l.id)).length));

  // 켰는데 화면이 그대로면 판이 죽는다. 지시문은 어떤 블록을 켜도 반드시 늘어난다.
  const noPrompt = [];
  for (const c of everyCombo()) {
    for (const id of IDS) {
      if (c.includes(id)) continue;
      const a = g3.render(c, D).prompt.length;
      const b = g3.render([...c, id], D).prompt.length;
      if (b !== a + 1) noPrompt.push(`${c.join('+') || '(없음)'} → +${id}`);
    }
  }
  check('어떤 블록을 켜도 지시문에 줄이 하나 붙는다', noPrompt.length === 0,
    noPrompt.slice(0, 4).join(' / '));

  // 맥락을 켠 뒤에는 어느 블록을 건드려도 결과가 따라 움직인다 — 실제로 밟게 되는 길이다
  const dead = [];
  for (const c of everyCombo()) {
    if (!c.includes('context')) continue;
    for (const id of IDS) {
      if (id === 'context') continue;
      const other = c.includes(id) ? c.filter(x => x !== id) : [...c, id];
      const d2 = diff(c, other);
      if (d2.add + d2.changed + d2.gone === 0) dead.push(`${c.join('+')} ↔ ${id}`);
    }
  }
  check('맥락을 켠 상태에서는 어떤 블록을 켜고 꺼도 결과가 바뀐다', dead.length === 0,
    dead.slice(0, 4).join(' / '));

  // 반대로 맥락이 없으면 예시는 결과를 못 바꾼다. 이것도 이 판이 가르치려는 것이다 —
  // 채울 자료가 없으면 예시를 아무리 보여줘도 붙일 자리가 없다.
  const stuck = [[], ['role'], ['format'], ['role', 'brief']].every(c => {
    const d2 = diff(c, [...c, 'example']);
    return d2.add + d2.changed + d2.gone === 0;
  });
  check('맥락이 없으면 예시는 결과를 못 바꾼다', stuck);
  check('맥락이 있으면 예시가 결과를 바꾼다',
    diff(['context'], ['context', 'example']).changed === 1);
}

// ---------------------------------------------------------------- 판정
console.log('\n== 판정 ==');
{
  const best = g3.simulate(BEST, D);
  check('최적 조합은 승인', best.grade === 'pass', `${best.grade} ${best.score}`);
  check('최적 조합은 사고 없음', best.faults.length === 0, names(best).join(', '));
  check('잘한 점에 배운 용어가 붙는다', gains(best).includes('프롬프트 엔지니어링'),
    gains(best).join(', '));
  check('목표와 몇 줄 맞았는지 말한다', /목표 \d줄 중 \d줄이 맞았다/.test(text(best)));

  const all = g3.simulate(ALL, D);
  check('전부 켜면 승인이 아니다', all.grade !== 'pass', `${all.grade} ${all.score}`);
  check('전부 켜면 충돌이 사유로 뜬다', names(all).includes('지시 충돌'), names(all).join(', '));
  check('전부 켜도 판은 끝까지 돈다', all.steps.length > 0 && typeof all.score === 'number');
  check('전부 켠 점수 < 최적 점수 (판정에서도)', all.score < best.score,
    `${all.score} vs ${best.score}`);

  const none = g3.simulate([], D);
  check('아무것도 안 켜면 반려', none.grade === 'fail', `${none.grade} ${none.score}`);
  check('맥락이 없으면 워크슬롭이 뜬다', names(none).includes('워크슬롭'), names(none).join(', '));
  check('반려여도 로그는 끝까지 나온다', none.steps.some(s => s.kind === 'out'));

  // 사유는 점수를 깎지 않는다 — 깎는 것은 목표와의 거리 하나뿐이다
  for (const c of everyCombo()) {
    const r = g3.simulate(c, D);
    if (r.score !== distance(c).score) {
      check(`조합 ${c.join('+') || '(없음)'} 점수가 거리와 같다`, false,
        `${r.score} vs ${distance(c).score}`);
      break;
    }
  }
  check('모든 조합에서 점수 = 목표와의 거리', true);

  // 게임오버는 없다. 어떤 조합이든 판정이 돌고 등급이 셋 중 하나다
  const grades = new Set(everyCombo().map(c => g3.simulate(c, D).grade));
  check('어떤 조합이든 판정이 돈다', everyCombo().every(c => {
    const r = g3.simulate(c, D);
    return ['pass', 'partial', 'fail'].includes(r.grade) && r.score >= 0 && r.score <= 100;
  }));
  check('승인·조건부·반려가 다 나온다', grades.size === 3, [...grades].join(', '));

  // 같은 사유가 같은 판에서 두 번 뜨면 결과 화면에 같은 줄이 두 개 뜬다
  const dup = everyCombo().filter(c => {
    const n = names(g3.simulate(c, D));
    return new Set(n).size !== n.length;
  });
  check('한 판에서 같은 사유가 두 번 안 뜬다', dup.length === 0,
    dup.slice(0, 3).map(c => c.join('+')).join(' / '));
}

// ---------------------------------------------------------------- 화면 문구
console.log('\n== 화면에 나가는 글 ==');
{
  const view = g3.render(BEST, D);
  check('render 가 지시문과 결과를 다 준다',
    Array.isArray(view.prompt) && Array.isArray(view.output));
  check('지시문에 켠 블록이 다 들어간다',
    BEST.every(id => view.prompt.some(l => l.id === id)),
    view.prompt.map(l => l.id).join(', '));
  check('지시문에 안 켠 블록은 안 들어간다', !view.prompt.some(l => l.id === 'brief'));
  check('낭독 문구가 목표와의 거리를 말한다', /목표 \d줄 중 \d줄/.test(view.say), view.say);
  check('render 도 순수하다 — 두 번 불러도 같다',
    JSON.stringify(g3.render(BEST, D)) === JSON.stringify(g3.render(BEST, D)));

  const shown = JSON.stringify({ title: g3.title, subtitle: g3.subtitle,
    data: D, named: g3.named, debrief: g3.debrief });
  for (const c of g3.concept) {
    check(`용어 "${c}" 가 화면 문구에 나온다`, shown.includes(c));
  }
  check('결과 화면 문구가 세 갈래 다 있다',
    ['pass', 'partial', 'fail'].every(k => (g3.debrief[k] || '').split('\n').length === 3));
  check('설명이 세 줄을 넘지 않는다',
    ['pass', 'partial', 'fail'].every(k => g3.debrief[k].split('\n').length <= 3));

  // 결과 화면에 같은 문장이 두 번 나오면 그 자체가 워크슬롭이다 (CLAUDE.md §2)
  const sentences = ['pass', 'partial', 'fail']
    .flatMap(k => g3.debrief[k].split('\n')).map(s => s.trim());
  check('해설에 똑같은 줄이 없다', new Set(sentences).size === sentences.length);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
