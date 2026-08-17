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

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
