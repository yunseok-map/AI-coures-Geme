// 글꼴 조각 검사 — 저장소에 넣은 Pretendard 가 지금 문구를 다 덮는지 본다.
//
// 여기서 잡으려는 사고가 셋이다.
//   1) **한글 문구를 새로 썼는데 폰트를 다시 안 만든 것.** 그 음절만 맑은 고딕으로
//      나와서 한 단어 안에서 글꼴이 갈린다. 브라우저에서 눈으로 찾기 어렵다 —
//      한 글자짜리 차이고, 어느 화면에 있는지도 모른다.
//   2) 원본 2MB 를 실수로 그대로 커밋하는 것. 사내망 첫 로딩이 눈에 띄게 느려진다.
//   3) 폰트를 CDN 으로 되돌리는 것 (외부 요청 0건 규칙).
//
// 고치는 방법은 assets/vendor/pretendard/README.md 에 명령까지 적어 뒀다.

import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { usedChars, ROOT, isHangul } from './font-chars.mjs';

const DIR = join(ROOT, 'assets', 'vendor', 'pretendard');
const WOFF = join(DIR, 'PretendardVariable.subset.woff2');
const MAX_BYTES = 250 * 1024;   // 지금 158KB. 두 배 가까이 벌어지면 뭔가 잘못된 것이다.

// Pretendard 원본에 아예 없어서 조각에도 넣을 수 없는 글자.
// 셋 다 자기 칸(::before)에만 있는 기호라 글꼴이 달라도 단어가 쪼개지지 않는다.
// 새 기호를 여기 추가하기 전에, 그 기호가 한국어 문장 **안에** 들어가는지 본다.
// 문장 안에 들어가면 기호를 쓰지 말고 우리말로 풀어 쓴다.
const NOT_IN_PRETENDARD = new Set([
  '▌',   // ▌ 로그의 지금 줄 커서
  '▸',   // ▸ 로그의 읽는 줄 앞머리
  '✕'    // ✕ 밀려난 부품 표시
]);

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('  OK   ' + n); }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };

console.log('\n== 파일이 저장소 안에 있다 ==');
const size = await stat(WOFF).then(s => s.size, () => -1);
check('조각 woff2 가 있다', size > 0, size < 0 ? '파일 없음' : '');
check(`크기가 ${Math.round(MAX_BYTES / 1024)}KB 이하 (지금 ${Math.round(size / 1024)}KB)`,
  size > 0 && size <= MAX_BYTES);
const ofl = await readFile(join(DIR, 'OFL.txt'), 'utf8').catch(() => '');
check('OFL 라이선스 원문이 같이 들어 있다', /SIL Open Font License/.test(ofl));

console.log('\n== 바깥으로 나가지 않는다 ==');
const faceCss = await readFile(join(DIR, 'pretendard.css'), 'utf8');
check('@font-face 가 상대경로만 쓴다',
  /url\(['"]\.\/PretendardVariable\.subset\.woff2['"]\)/.test(faceCss));
check('css 안에 http 주소가 없다 (주석 제외)',
  !/url\(\s*['"]?https?:/i.test(faceCss));
check("format 은 'woff2' 다 (woff2-variations 는 일부 브라우저가 줄째 버린다)",
  /format\(['"]woff2['"]\)/.test(faceCss));

const html = await readFile(join(ROOT, 'index.html'), 'utf8');
check('index.html 이 조각 css 를 상대경로로 건다',
  html.includes('./assets/vendor/pretendard/pretendard.css'));
check('preload 경로가 @font-face 의 파일과 같다 (다르면 두 번 받는다)',
  html.includes('./assets/vendor/pretendard/PretendardVariable.subset.woff2'));
check('폰트 preload 에 crossorigin 이 붙어 있다',
  /rel="preload"[^>]*as="font"[^>]*crossorigin/.test(html));

const tokens = await readFile(join(ROOT, 'assets', 'tokens.css'), 'utf8');
check('--font-body 가 Pretendard 를 맨 앞에 둔다',
  /--font-body:\s*"Pretendard Variable"/.test(tokens));
check('--font-body 에 시스템 글꼴 대체가 남아 있다 (폰트가 실패해도 읽힌다)',
  /--font-body:[^;]*Malgun Gothic/s.test(tokens));
check('--font-typed 는 Pretendard 를 쓰지 않는다 (사람이 입력한 이름)',
  /--font-typed:[^;]*;/s.test(tokens) &&
  !/--font-typed:[^;]*Pretendard/s.test(tokens));

console.log('\n== 지금 문구를 다 덮는다 (이 판의 핵심) ==');
const covered = new Set(await readFile(join(DIR, 'covered.txt'), 'utf8'));
const used = await usedChars();
const missing = [...used].filter(c => !covered.has(c) && !NOT_IN_PRETENDARD.has(c));

check(`화면 글자 ${used.size}자 · 조각이 덮는 글자 ${covered.size}자`, covered.size > 0);
check('빠진 글자 없음', missing.length === 0,
  missing.length
    ? `${missing.length}자 빠졌다 → ${missing.join('')} ` +
      `(${missing.map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ')})\n` +
      '        assets/vendor/pretendard/README.md 의 "다시 만드는 순서" 를 따른다.'
    : '');

// 조각을 필요 이상으로 크게 만들지 않았는지 — 안 쓰는 한글이 잔뜩 들어가면
// 파일만 커지고 얻는 게 없다. 주석의 한글이 새어 들어간 경우가 대표적이다.
const extra = [...covered].filter(c => !used.has(c) && isHangul(c));
check('조각에 안 쓰는 한글이 없다', extra.length === 0,
  extra.length ? `${extra.length}자 남았다 → ${extra.slice(0, 30).join('')}` : '');

// ---------------------------------------------------------------------------
// 표제 글꼴(Hahmlet) — 본문 글꼴과 같은 사고를 똑같이 낸다.
//
// 여기서만 다른 것: 이 조각은 **제목에만** 걸리므로 기호까지 다 덮을 필요가 없다.
// 원본에 없는 기호(별표·동그라미 숫자 따위)는 뒤의 Pretendard 로 떨어지고,
// 그 기호들은 제목에 안 쓰인다. 반드시 덮어야 하는 것은 **한글과 영숫자**다 —
// 제목 한가운데서 갈리면 바로 보인다.
console.log('\n== 표제 글꼴 조각 ==');
const HDIR = join(ROOT, 'assets', 'vendor', 'hahmlet');
const HWOFF = join(HDIR, 'Hahmlet-Bold.subset.woff2');
const H_MAX = 130 * 1024;   // 지금 87KB. 굵기축을 살리면 169KB 가 된다 — 그건 막는다.

const hsize = await stat(HWOFF).then(s => s.size, () => -1);
check('표제 조각 woff2 가 있다', hsize > 0, hsize < 0 ? '파일 없음' : '');
check(`크기가 ${Math.round(H_MAX / 1024)}KB 이하 (지금 ${Math.round(hsize / 1024)}KB)`,
  hsize > 0 && hsize <= H_MAX);
const hofl = await readFile(join(HDIR, 'OFL.txt'), 'utf8').catch(() => '');
check('OFL 라이선스 원문이 같이 들어 있다', /SIL Open Font License/.test(hofl));

const hcss = await readFile(join(HDIR, 'hahmlet.css'), 'utf8');
check('@font-face 가 상대경로만 쓴다',
  /url\(['"]\.\/Hahmlet-Bold\.subset\.woff2['"]\)/.test(hcss));
check('css 안에 http 주소가 없다 (주석 제외)', !/url\(\s*['"]?https?:/i.test(hcss));
// 굵기를 하나만 적으면 900 을 부르는 제목에서 브라우저가 가짜 굵게를 만들어
// 세리프가 뭉갠다. 범위로 적어 두면 어느 굵기를 불러도 이 파일이 그대로 걸린다.
check('font-weight 를 범위로 적었다 (가짜 굵게 방지)', /font-weight:\s*100\s+900/.test(hcss));
check('index.html 이 표제 css 를 상대경로로 건다',
  html.includes('./assets/vendor/hahmlet/hahmlet.css'));
check('preload 경로가 @font-face 의 파일과 같다',
  html.includes('./assets/vendor/hahmlet/Hahmlet-Bold.subset.woff2'));

check('--font-display 가 Hahmlet 를 맨 앞에 둔다',
  /--font-display:\s*"Hahmlet"/.test(tokens));
check('--font-display 뒤에 본문 글꼴이 대체로 남아 있다 (조각에 없는 기호가 떨어질 자리)',
  /--font-display:[^;]*Pretendard Variable/s.test(tokens));
// 숫자에 표제 글꼴이 걸리면 자릿수가 흔들린다. 계기판 숫자 자리는 고정폭이다.
const stylesCss = await readFile(join(ROOT, 'assets', 'styles.css'), 'utf8');
const displayRule = (stylesCss.match(/([^}]*)\{\s*font-family:\s*var\(--font-display\)/) || [])[1] || '';
check('표제 글꼴이 숫자 자리에 안 걸린다',
  !/ring__num|report__num|mp__meter__num|__cost/.test(displayRule),
  displayRule.trim().slice(0, 80));

const hcovered = new Set(await readFile(join(HDIR, 'covered.txt'), 'utf8'));
const mustCover = [...used].filter(c => isHangul(c) || /[0-9A-Za-z]/.test(c));
const hmissing = mustCover.filter(c => !hcovered.has(c));
check(`제목에 쓸 수 있는 글자 ${mustCover.length}자 · 표제 조각이 덮는 글자 ${hcovered.size}자`,
  hcovered.size > 0);
check('한글·영숫자 중 빠진 글자 없음', hmissing.length === 0,
  hmissing.length
    ? `${hmissing.length}자 빠졌다 → ${hmissing.join('')}\n` +
      '        assets/vendor/hahmlet/README.md 의 "다시 만드는 순서" 를 따른다.'
    : '');
const hextra = [...hcovered].filter(c => !used.has(c) && isHangul(c));
check('표제 조각에 안 쓰는 한글이 없다', hextra.length === 0,
  hextra.length ? `${hextra.length}자 남았다 → ${hextra.slice(0, 30).join('')}` : '');

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
