// 17판 전수 구조 검사. DOM 없이 확인할 수 있는 것만 본다.
// 두 세션의 작업이 섞인 뒤 무엇이든 깨졌는지 배포 전에 잡는 것이 목적이다.

const ROOT = '../src';
const { manifest } = await import(`${ROOT}/games/index.js`);
const { terms } = await import(`${ROOT}/data/terms.js`);

// main.js 가 등록한 엔진 글자 (main.js 는 DOM 을 만지므로 원문에서 읽는다)
const fs = await import('node:fs/promises');
const mainSrc = await fs.readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const registered = new Set([...mainSrc.matchAll(/^\s*([A-Z]):\s*\(\)\s*=>\s*import/gm)].map(m => m[1]));

let pass = 0, fail = 0;
const bad = [];
const check = (n, c, x) => {
  if (c) { pass++; }
  else { fail++; bad.push(`${n}${x ? ' — ' + x : ''}`); }
};

console.log(`\n엔진 등록: ${[...registered].sort().join(' ')}`);
console.log(`용어 도감: ${terms.length}개`);
console.log(`미니게임: ${manifest.length}개\n`);

const termNames = new Set(terms.map(t => t.term));
const engineUse = {};
const rows = [];

for (const m of manifest) {
  const file = `${ROOT}/games/${String(m.no).padStart(2, '0')}-${m.id}.js`;
  let g = null, err = null;
  try { g = (await import(file)).default; } catch (e) { err = e; }

  check(`${m.no} 파일이 열린다`, !!g, err && String(err.message).slice(0, 80));
  if (!g) { rows.push([m.no, m.id, m.engine, 'LOAD FAIL', '', '']); continue; }

  engineUse[m.engine] = (engineUse[m.engine] || 0) + 1;

  check(`${m.no} manifest 엔진이 등록돼 있다`, registered.has(m.engine), `engine ${m.engine}`);
  check(`${m.no} 파일의 engine 과 manifest 가 같다`, g.engine === m.engine,
    `파일 ${g.engine} vs manifest ${m.engine}`);
  check(`${m.no} 제목이 같다`, g.title === m.title, `${g.title} vs ${m.title}`);
  check(`${m.no} data 가 있다`, !!g.data);
  check(`${m.no} checkedAt 이 있다`, !!g.checkedAt, '(CLAUDE.md §2)');
  check(`${m.no} concept 이 배열이다`, Array.isArray(g.concept) && g.concept.length > 0);
  check(`${m.no} debrief 3종이 다 있다`,
    g.debrief && g.debrief.pass && g.debrief.partial && g.debrief.fail);
  // named 는 all 하나이거나 상황별 여러 갈래일 수 있다 — 문구가 하나라도 있으면 된다
  check(`${m.no} named 문구가 있다`,
    !!g.named && Object.values(g.named).some(v => typeof v === 'string' && v.length > 10),
    g.named ? Object.keys(g.named).join(',') : 'named 없음');

  // 해금 용어가 도감에 실제로 있는가 — 없으면 ✓ 가 영원히 안 붙는다
  const missing = g.concept.filter(c => !termNames.has(c));
  check(`${m.no} 해금 용어가 도감에 다 있다`, missing.length === 0, missing.join(', '));

  // 화면 문구에 개발자 표현이 새지 않았는가 (CLAUDE.md §2)
  const blob = JSON.stringify(g);
  const devWords = ['npm ', 'localhost', '레포 ', 'git ', 'console.log'];
  const leaked = devWords.filter(w => blob.includes(w));
  check(`${m.no} 개발자 표현이 없다`, leaked.length === 0, leaked.join(', '));

  // 콘텐츠 규칙: 가격·순위·모델 버전 번호 금지
  const priced = /\$\d|\d+ ?원|무료 체험 \d/.test(blob);
  check(`${m.no} 가격 표기가 없다`, !priced);

  rows.push([m.no, m.id, m.engine, g.simulate ? 'simulate' : '-',
    g.concept.length + '용어', (m.required ? '필수' : '심화')]);
}

// 엔진별 사용 수
console.log('엔진별 미니게임 수');
for (const k of Object.keys(engineUse).sort()) console.log(`  ${k}: ${engineUse[k]}판`);

// 등록됐지만 아무도 안 쓰는 엔진 = 죽은 코드
const unused = [...registered].filter(k => !engineUse[k]);
check('안 쓰는 엔진이 없다', unused.length === 0, unused.join(', '));

console.log('\n판 목록');
for (const r of rows) console.log('  ' + r.map((c, i) => String(c).padEnd([4, 20, 3, 10, 8, 4][i])).join(' '));

console.log(`\n검사 ${pass + fail}건 · 통과 ${pass} · 실패 ${fail}`);
if (bad.length) { console.log('\n실패 목록:'); for (const b of bad) console.log('  ✗ ' + b); }
console.log('');
process.exit(fail ? 1 : 0);
