// 콘텐츠 검수 — 화면에 나가는 **글** 자체를 본다.
//
// 판정 규칙은 test-all.mjs 가 보고, 여기서는 글이 제대로 채워졌는지·한국어가 맞는지를 본다.
// 이 검사가 잡으려는 사고 넷:
//
//  1) **겪지 않은 용어가 도감에 쌓이는 것.** concept 에 적었는데 그 판 화면에
//     그 말이 한 번도 안 나오면, 도감은 "내가 해본 것의 기록"이 아니라 장식이 된다.
//  2) **용어처럼 굵게 써 놓고 도감에 없는 말.** "~에 이름이 있다 — **X**" 를 읽고
//     도감에서 X 를 찾는데 없으면, 그 순간 자료 전체가 미덥지 않아진다.
//  3) **조사 붙여쓰기.** 한글 맞춤법 41항 — 조사는 앞말에 붙여 쓴다. 영문 뒤에서도
//     마찬가지다("RAG 를" X, "RAG를" O). 눈으로는 지나치기 쉽고 개수가 많다.
//  4) **빈 칸·너무 짧은 칸.** 도감 네 칸(비유·설명·예시·오해)이 다 채워져야 한 항목이다.

import { readFile, readdir } from 'node:fs/promises';

const ROOT = '../src';
const { terms } = await import(`${ROOT}/data/terms.js`);
const { manifest } = await import(`${ROOT}/games/index.js`);

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };

const names = new Set(terms.map(t => t.term));

// ---------------------------------------------------------------- 도감 네 칸
console.log('\n== 도감: 네 칸이 다 채워졌는가 ==');
const MIN = { analogy: 8, explain: 40, example: 8, myth: 12 };
for (const t of terms) {
  for (const [f, min] of Object.entries(MIN)) {
    const v = typeof t[f] === 'string' ? t[f].trim() : '';
    check(`${t.term}.${f}`, v.length >= min, v ? `${v.length}자 (최소 ${min})` : '비어 있다');
  }
  check(`${t.term}.en`, typeof t.en === 'string' && t.en.length > 0);
}

// ---------------------------------------------------------------- 용어와 판의 연결
console.log('\n== 판에서 겪은 용어만 도감에 넣는가 ==');
const games = [];
for (const m of manifest) {
  const g = (await import(`${ROOT}/games/${String(m.no).padStart(2, '0')}-${m.id}.js`)).default;
  games.push([m, g]);
}

for (const [m, g] of games) {
  // 화면에 실제로 나가는 것만 본다 — 파일 맨 위 주석은 화면에 안 나온다
  const shown = JSON.stringify({
    title: g.title, subtitle: g.subtitle, data: g.data, named: g.named, debrief: g.debrief
  });
  for (const c of g.concept) {
    check(`${m.no}번이 주는 용어 "${c}" 가 그 판 화면에 나온다`, shown.includes(c),
      '화면 문구 어디에도 없다 → named 에 넣거나 concept 에서 뺀다');
  }
}

// ---------------------------------------------------------------- 이름 붙이는 문장
console.log('\n== "이름이 있다" 문장의 굵은 말이 도감에 있는가 ==');
//
// named 는 "방금 겪은 것에 이름을 붙여 주는" 자리다. 그래서 여기서 굵게 쓴 말은
// 도감에서 찾을 수 있어야 한다. 반면 debrief 나 문항 설명의 굵은 글씨는 그냥 강조라
// 이 규칙을 적용하지 않는다.
//
// 예외: 용어가 아니라 형태로 기억시키는 한 문장. 도감에서 찾을 말이 아니다.
// 여기에 한 줄 더 넣기 전에: 그 말이 "이름"으로 읽히는가를 먼저 본다.
// 이름으로 읽히면 도감에 넣어야 하고, 기준·구호로 읽히면 여기 들어온다.
const PLAIN_BOLD = new Set([
  'Agent = Model + Harness',   // 관계를 외우게 하는 한 줄. 찾아볼 항목이 아니다
  '누가 언제 부르는가'          // 여섯 도구를 가르는 기준. 용어가 아니다
]);

for (const [m, g] of games) {
  for (const [k, v] of Object.entries(g.named || {})) {
    // 굵은 표시가 두 개 이상 붙은 문장에서 사이 공백까지 잡히지 않도록 짝으로 센다
    const marks = String(v).split('**').filter((_, i) => i % 2 === 1);
    for (const x of marks) {
      if (PLAIN_BOLD.has(x)) continue;
      check(`${m.no}번 named.${k} 의 "${x}"`, names.has(x), '도감에 없는 말을 용어처럼 굵게 썼다');
    }
  }
}

// ---------------------------------------------------------------- 한국어 표기
console.log('\n== 한국어 표기 ==');

// 조사는 앞말에 붙여 쓴다 (한글 맞춤법 41항). 영문·약어 뒤에서도 같다.
const JOSA = '은|는|이|가|을|를|의|와|과|로|으로|에|에서|도|만|라고|이라고|처럼';
// 마침표로 끝나면 문장이 끝난 것이다 — "GEMINI.md. 이 중" 의 '이'는 조사가 아니다
const SPACED = new RegExp(`[A-Za-z][A-Za-z0-9.·]*[A-Za-z0-9] (${JOSA})(?=[ ,.·—’"”\\]]|$)`, 'g');

// 굵은 표시를 닫자마자 조사가 와야 한다 ("**표면** 이라고" X)
const BOLD_GAP = new RegExp(`\\*\\* +(${JOSA})(?=[ ,.·—]|$)`, 'g');

// 손으로 적은 양쪽 조사. core/ko.js 를 써야 한다 (CLAUDE.md 8번)
const MANUAL = /\(으\)로|\(이\)가|을\(를\)|은\(는\)|이\(가\)|와\(과\)/;

function korean(where, s) {
  if (typeof s !== 'string') return;
  const spaced = [...s.matchAll(SPACED)].map(x => x[0]);
  check(`${where} 조사 붙여쓰기`, spaced.length === 0, spaced.join(' / '));
  const gap = [...s.matchAll(BOLD_GAP)].map(x => x[0].trim());
  check(`${where} 굵은 표시 뒤 조사`, gap.length === 0, gap.join(' / '));
  check(`${where} 양쪽 조사 직접 표기`, !MANUAL.test(s), 'core/ko.js 를 쓴다');
}

for (const t of terms) {
  for (const f of ['analogy', 'explain', 'example', 'myth']) korean(`용어 ${t.term}.${f}`, t[f]);
}
for (const [m, g] of games) {
  walk(g.data, `${m.no}번 data`);
  for (const [k, v] of Object.entries(g.named || {})) korean(`${m.no}번 named.${k}`, v);
  for (const [k, v] of Object.entries(g.debrief || {})) korean(`${m.no}번 debrief.${k}`, v);
  korean(`${m.no}번 subtitle`, g.subtitle);
}

function walk(node, path) {
  if (typeof node === 'string') return korean(path, node);
  if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
  }
}

// ---------------------------------------------------------------- 조사 계산
console.log('\n== 조사를 계산해 붙이는 자리 ==');
//
// 통 이름·부품 이름은 판마다 다르고, 뒤에 붙는 조사도 그때그때 달라진다.
// "모델 (엔진)로 보냈다" 처럼 괄호로 끝나는 이름에서 틀린 적이 있다 —
// 읽을 때는 '진' 으로 끝나므로 '으로' 가 맞다.
{
  const { euroJosa, ida, iGa, eulReul, hasBatchim } = await import(`${ROOT}/core/ko.js`);
  const cases = [
    ['모델 (엔진)', '으로', '이다'], ['제품 (도구)', '로', '다'],
    ['채팅', '으로', '이다'],       ['프로젝트', '로', '다'],
    ['스킬', '로', '이다'],          ['훅', '으로', '이다'],
    ['검증', '으로', '이다'],        ['샌드박스', '로', '다'],
    ['MCP', '로', '다'],             ['CLI 에이전트', '로', '다']
  ];
  for (const [w, ro, da] of cases) {
    check(`"${w}" + 으로/로`, euroJosa(w) === ro, euroJosa(w));
    check(`"${w}" + 이다/다`, ida(w) === w + da, ida(w));
  }
  // 실제로 화면에 쓰는 통 이름 전부를 돌려 본다 — 새 판을 넣어도 여기서 걸린다
  for (const [m, g] of games) {
    for (const b of (g.data?.bins || [])) {
      check(`${m.no}번 통 "${b.label}" 조사가 계산된다`,
        typeof euroJosa(b.label) === 'string' && ida(b.label).startsWith(b.label));
    }
  }
  check('받침 판단이 끝의 괄호에 속지 않는다', hasBatchim('모델 (엔진)') === true);
  check('영문은 받침 없음으로 본다', eulReul('Cowork') === 'Cowork를', eulReul('Cowork'));
}

// ---------------------------------------------------------------- 버튼 이름 + 조사
console.log('\n== [지금 할 일] 줄의 버튼 이름 뒤 조사 ==');
//
// 그 줄은 버튼 이름을 대괄호로 그대로 부른다 — `[출고]를 누른다`. 이름은 판마다
// 다른데 조사를 소스에 박아 두면 **그 판에서만 맞고 다음 판에서 틀린다.**
// 실제로 `[이 구성으로 처리한다]을`, `[이 지침서로 일 시키기]을` 이 화면에 나갔다.
// 그래서 두 가지를 본다: ① 엔진 소스에 박힌 조사가 없는가 ② 실제 라벨로 계산하면 뭐가 나오는가
{
  const { eulReulJosa, euroJosa } = await import(`${ROOT}/core/ko.js`);
  const dir = new URL('../src/engines/', import.meta.url);
  const files = (await readdir(dir)).filter(f => f.endsWith('.js'));

  // `]을 ` `]를 ` `]로 ` `]으로 ` — 대괄호를 닫자마자 박아 넣은 조사
  const HARD = /\]\s*(을|를|으로|로)(?=[\s.,)]|$)/;
  for (const f of files) {
    const src = await readFile(new URL(f, dir), 'utf8');
    const bad = src.split('\n')
      .map((l, i) => [i + 1, l])
      .filter(([, l]) => HARD.test(l) && /\$\{/.test(l));
    check(`engines/${f} — 버튼 이름 뒤에 조사를 박지 않았다`, bad.length === 0,
      bad.map(([n, l]) => `${n}행: ${l.trim()}`).join(' / '));
  }

  // 실제 라벨로 계산한 값. 여기 있는 이름이 화면에 그대로 나간다.
  for (const [m, g] of games) {
    for (const key of ['runLabel', 'nextLabel', 'dropLabel']) {
      const label = g.data?.[key];
      if (typeof label !== 'string' || !label) continue;
      const josa = eulReulJosa(label);
      check(`${m.no}번 [${label}] + 을/를 = ${josa}`, josa === '을' || josa === '를');
      check(`${m.no}번 [${label}] + 으로/로 = ${euroJosa(label)}`,
        euroJosa(label) === '으로' || euroJosa(label) === '로');
    }
  }
}

// ---------------------------------------------------------------- 초록 "다 됐다"
console.log('\n== [지금 할 일] 초록이 앞뒤가 맞는가 ==');
//
// `{ done: true }` 는 줄을 초록으로 바꾸고 라벨을 "다 됐다"로 만든다. 그건 안내가
// 아니라 **판단**이라, 아직 고를 것이 남았는데 켜면 사람은 거기서 실행한다.
// 그게 그 판이 벌하는 쪽이면 줄이 판을 망친다 — 1번 판에서 실제로 그랬다.
//
// 전부를 기계로 가릴 수는 없다(무엇이 "다 된 것"인지는 판마다 다르다). 다만
// **줄이 스스로 모순인 경우**는 확실히 가릴 수 있다: 본문이 "더 …해도 된다"라고
// 말하면서 라벨이 "다 됐다"인 것. 8·11·12·15번이 실제로 그랬다.
{
  const dir = new URL('../src/engines/', import.meta.url);
  const files = (await readdir(dir)).filter(f => f.endsWith('.js'));
  // step.set(...) 한 번의 인자 전체를 잡는다 — 여러 줄에 걸쳐 쓰기도 한다
  const CALL = /step\.set\(([\s\S]*?)\);/g;
  const MORE = /더\s*[^`'"]{0,12}(해도|어도|아도|도)\s*된다|더\s+[가-힣]+거나/;

  for (const f of files) {
    const src = await readFile(new URL(f, dir), 'utf8');
    const bad = [];
    for (const m of src.matchAll(CALL)) {
      const arg = m[1];
      if (!/done:\s*true/.test(arg)) continue;      // 조건부(done: x)는 사람이 판단한다
      if (!MORE.test(arg)) continue;
      bad.push(arg.replace(/\s+/g, ' ').slice(0, 70));
    }
    check(`engines/${f} — "더 해도 된다"면서 "다 됐다"라고 하지 않는다`,
      bad.length === 0, bad.join(' / '));
  }
}

// ---------------------------------------------------------------- 결과 문구
console.log('\n== 결과 화면 문구 ==');
for (const [m, g] of games) {
  for (const k of ['pass', 'partial', 'fail']) {
    const v = g.debrief?.[k];
    check(`${m.no}번 debrief.${k} 가 세 줄이다`,
      typeof v === 'string' && v.split('\n').length === 3,
      typeof v === 'string' ? `${v.split('\n').length}줄` : '없다');
  }
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
