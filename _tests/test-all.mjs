// 17판 전수 구조 검사. DOM 없이 확인할 수 있는 것만 본다.
// 두 세션의 작업이 섞인 뒤 무엇이든 깨졌는지 배포 전에 잡는 것이 목적이다.

const ROOT = '../src';
const { manifest } = await import(`${ROOT}/games/index.js`);
const { terms } = await import(`${ROOT}/data/terms.js`);
const { plain, strong } = await import(`${ROOT}/core/text.js`);

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

// ---- 강조 표시가 낭독으로 새지 않는가 ----
// 콘텐츠는 `**이렇게**` 로 강조를 적는데, 낭독 영역은 textContent 라서 별표가 그대로 남는다.
// 눈으로는 안 보이니 화면을 봐서는 절대 못 잡는다. plain() 이 떼는지 여기서 확인한다.
check('plain() 이 강조 표시를 떼낸다', plain('**CLI 에이전트**는 도구다') === 'CLI 에이전트는 도구다',
  plain('**CLI 에이전트**는 도구다'));
check('plain() 이 별표 없는 글을 안 건드린다', plain('그냥 문장') === '그냥 문장');
check('plain() 이 null 을 빈 문자열로', plain(null) === '' && plain(undefined) === '');
check('strong() 은 여전히 <b> 로 바꾼다', strong('**강조**') === '<b>강조</b>', strong('**강조**'));
check('strong() 이 태그 주입을 막는다', !strong('<script>x</script>').includes('<script'),
  strong('<script>x</script>'));

// 용어 도감 문구에는 강조 표시를 쓰지 않는다 — codex.js 의 row() 는 esc() 만 한다
const markedTerms = terms.filter(t =>
  ['analogy', 'explain', 'example'].some(k => typeof t[k] === 'string' && t[k].includes('**')));
check('도감 본문에 별표가 없다', markedTerms.length === 0, markedTerms.map(t => t.term).join(', '));

// ---- 용어 도감 자체 검사 ----
// 출처는 문자열 하나이거나 배열이다. 한 회사 제품이 아니라 도구의 갈래를 설명하는 용어는
// 회사마다 출처가 하나씩 붙는다(예: CLI 에이전트). 배열이 들어와도 화면이 깨지지 않아야 한다.
// codex.js 의 srcRow() 와 같은 규칙으로 걸러야 검사가 실제 화면과 어긋나지 않는다.
// source: '' 는 실수가 아니라 "공식 정의가 없는 용어"라는 뜻이고, 그때는 링크 대신 문구가 나간다.
let multi = 0, noSrc = 0;
for (const t of terms) {
  const s = t.source;
  const list = (Array.isArray(s) ? s : [s]).filter(Boolean);
  if (!list.length) { noSrc++; continue; }
  if (Array.isArray(s)) multi++;
  for (const u of list) {
    check(`용어 "${t.term}" 출처가 http 주소다`, typeof u === 'string' && /^https?:\/\//.test(u), String(u));
  }
  // 같은 주소를 두 번 걸면 화면에 같은 링크가 두 개 나온다
  check(`용어 "${t.term}" 출처에 중복이 없다`, new Set(list).size === list.length);
}
check('용어 이름에 중복이 없다', new Set(terms.map(t => t.term)).size === terms.length);
check('모든 용어에 chapter 가 있다', terms.every(t => Number.isFinite(t.chapter)));
console.log(`출처가 여러 개인 용어: ${multi}개 · 공식 출처가 없는 용어: ${noSrc}개\n`);

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
