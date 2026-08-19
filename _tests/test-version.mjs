// 배포 도장 검사 — 고쳐 놓고 도장을 안 찍는 것을 막는다.
//
// 이 검사가 막으려는 사고: **교육생 화면에 옛 파일이 그대로 남는 것.**
// 1번 판 책상을 6칸에서 8칸으로 고쳐 배포했는데 어떤 사람은 계속 6칸을 봤다.
// 6칸은 사실상 이길 수 없는 판이라(전수 조사 10,738가지 중 통과 58가지)
// 그 사람들은 아무리 잘해도 못 깬다. **화면은 멀쩡해 보여서 아무도 모른다.**
//
// 미니게임과 엔진은 `import()` 로 부르는데, 동적 import 는 하드 리로드의 no-cache 를
// 물려받지 않는다. 그래서 주소 뒤에 내용 해시를 붙인다(`core/version.js` 의 BUILD).
// 그 해시를 다시 찍는 걸 잊으면 붙여 봐야 소용이 없으므로, 여기서 잊었는지 본다.
//
// 실패하면 고치는 법은 한 줄이다:  node _tests/stamp.mjs

import { readFile } from 'node:fs/promises';
import { computeStamp, restampHtml, versionSource, needsStamp, VERSION_FILE, INDEX_FILE }
  from './stamp.mjs';

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('  OK   ' + n); }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };

const stamp = await computeStamp();

console.log('\n== 배포 도장이 지금 내용과 맞는가 ==');
{
  let src = '';
  try { src = await readFile(VERSION_FILE, 'utf8'); } catch { /* 없으면 아래에서 걸린다 */ }
  const found = (src.match(/BUILD\s*=\s*'([0-9a-f]+)'/) || [])[1] || '';

  check('core/version.js 에 도장이 있다', !!found, '없다 — node _tests/stamp.mjs');
  check(`도장이 지금 내용과 같다 (${stamp})`, found === stamp,
    `version.js 는 ${found || '없음'} — node _tests/stamp.mjs 를 돌린다`);
  check('version.js 를 손으로 고치지 않았다', src === versionSource(stamp),
    '모양이 다르다 — node _tests/stamp.mjs 가 다시 쓴다');
}

console.log('\n== index.html 의 ?v= 가 같은 도장인가 ==');
{
  const html = await readFile(INDEX_FILE, 'utf8');
  const marks = [...html.matchAll(/(?:href|src)="\.\/[^"?]+\?v=([0-9a-f]+)"/g)].map(m => m[1]);
  const plain = [...html.matchAll(/(?:href|src)="(\.\/[^"?]+)"/g)].map(m => m[1]);

  check('붙는 자리가 있다', marks.length > 0, '?v= 가 하나도 없다');
  check('전부 같은 도장이다', marks.every(m => m === stamp),
    [...new Set(marks)].join(', '));
  // 도장을 빠뜨린 파일이 하나라도 있으면 그 파일만 옛것으로 남는다
  check('도장이 빠진 자산이 없다', plain.every(p => !needsStamp(p)),
    plain.filter(needsStamp).join(', '));
  check('다시 찍어도 그대로다 (도장 찍기가 멱등이다)',
    restampHtml(html, stamp) === html);

  // 글꼴은 일부러 뺀다 — preload 와 pretendard.css 의 url() 이 **같은 주소**여야
  // 한 번만 받는다. 도장을 붙이면 160KB 를 두 번 받는다.
  const fontPre = (html.match(/rel="preload"[^>]*href="([^"]+)"/) || [])[1] || '';
  const fontCss = await readFile(
    new URL('../assets/vendor/pretendard/pretendard.css', import.meta.url), 'utf8');
  const cssUrl = (fontCss.match(/url\('([^']+)'\)/) || [])[1] || '';
  check('글꼴 미리받기 주소가 CSS 안의 주소와 같다',
    !!fontPre && !!cssUrl && fontPre.endsWith(cssUrl.replace(/^\.\//, '')),
    `preload=${fontPre} / css=${cssUrl}`);
}

console.log('\n== 동적 import 에 도장이 붙어 있는가 ==');
//
// 여기가 진짜 사고 지점이다. 정적 import(core/·shell/)는 새로고침으로 갱신되지만
// 동적 import 는 안 된다 — 그래서 **동적으로 부르는 자리에는 반드시 붙어야 한다.**
{
  for (const [file, what] of [['../src/main.js', '엔진'], ['../src/games/index.js', '미니게임']]) {
    const src = await readFile(new URL(file, import.meta.url), 'utf8');
    const calls = [...src.matchAll(/import\(([^)]+)\)/g)].map(m => m[1]);
    const bare = calls.filter(c => !c.includes('?v=${BUILD}'));
    check(`${what}을 부르는 곳에 도장이 붙어 있다`, calls.length > 0 && bare.length === 0,
      bare.length ? bare.join(' / ') : '동적 import 가 없다');
  }
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
