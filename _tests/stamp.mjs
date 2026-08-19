// 배포 도장 — 파일이 바뀌면 주소도 바뀌게 만든다.
//
//   node _tests/stamp.mjs
//
// 왜 있나: 교육생 화면에 **옛 파일이 그대로 남는 사고**가 실제로 났다.
// 1번 판 책상을 6칸에서 8칸으로 고쳐 배포했는데, 어떤 사람은 계속 6칸을 봤다.
// 6칸은 사실상 이길 수 없는 판이라(전수 조사 10,738가지 중 통과 58가지)
// 그 사람들은 아무리 잘해도 못 깬다. 화면은 멀쩡해 보이므로 아무도 눈치채지 못한다.
//
// 왜 그런가: 미니게임과 엔진은 `import()` 로 부른다(그래야 첫 화면에서 17판을
// 전부 받지 않는다). 그런데 **동적 import 는 하드 리로드의 no-cache 를 물려받지
// 않는다.** Ctrl+Shift+R 을 눌러도 그 파일들만 캐시에서 온다.
// GitHub Pages 가 주는 `max-age=600` 이 지나야 겨우 다시 물어본다.
//
// 그래서 파일 내용에서 도장을 하나 찍어 주소 뒤에 붙인다 — 내용이 바뀌면
// 주소가 바뀌므로 브라우저가 "같은 파일"로 볼 수가 없다.
//
//   src/core/version.js   도장 한 줄. 이 파일이 원본이다
//   index.html            <link>·<script> 뒤의 ?v=
//
// 도장은 **src/ 와 assets/ 전체 내용의 해시**다. 손으로 올리는 번호가 아니라서
// 올리는 걸 잊을 수가 없다. 잊더라도 `test-version.mjs` 가 먼저 막는다.

import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, '..');

/** 도장이 찍히는 곳 — 자기 자신은 해시에서 뺀다(넣으면 계산이 자기를 물어 돌지 않는다) */
export const VERSION_FILE = join(ROOT, 'src', 'core', 'version.js');

/** 도장을 다는 곳. index.html 은 해시 대상이 아니다 — 해시가 여기 적히기 때문이다 */
export const INDEX_FILE = join(ROOT, 'index.html');

/** 화면에 나가는 것만 센다. 검사·문서·설정은 배포본 동작과 무관하다 */
const WATCH = ['src', 'assets'];

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else out.push(p);
  }
  return out;
}

/**
 * 지금 내용으로 계산한 도장 8자리.
 *
 * 경로까지 넣어 섞는다 — 파일 이름만 바뀌고 내용이 그대로인 경우에도 도장이 바뀌어야 한다.
 * 경로 구분자는 `/` 로 맞춘다. 윈도우에서 찍은 도장과 다른 데서 찍은 도장이 달라지면
 * 배포할 때마다 애먼 차이가 생긴다.
 */
export async function computeStamp() {
  const files = [];
  for (const d of WATCH) files.push(...await walk(join(ROOT, d)));

  const rows = [];
  for (const f of files) {
    if (f === VERSION_FILE) continue;
    rows.push([relative(ROOT, f).split(sep).join('/'), await readFile(f)]);
  }
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const h = createHash('sha256');
  for (const [name, buf] of rows) {
    h.update(name); h.update('\0');
    h.update(buf);  h.update('\0');
  }
  return h.digest('hex').slice(0, 8);
}

/**
 * 도장을 붙이지 않는 자산.
 *
 * 글꼴 조각은 **미리 받기(preload)와 CSS 가 같은 주소를 불러야** 한 번만 받는다.
 * `pretendard.css` 안의 `url()` 은 도장이 없는 주소인데 preload 에만 도장을 붙이면
 * 브라우저가 **다른 파일로 보고 160KB 를 두 번 받는다.** 벤더 CSS 를 고칠 수는 없고,
 * 글꼴은 내용이 바뀌는 일이 거의 없으므로 여기만 뺀다.
 */
const NO_STAMP = /\.woff2?$/i;

/** index.html 안의 `?v=...` 를 전부 새 도장으로 바꾼다 */
export function restampHtml(html, stamp) {
  return html.replace(
    /((?:href|src)="(\.\/[^"?]+))(\?v=[0-9a-f]+)?"/g,
    (_, head, path) => (NO_STAMP.test(path) ? `${head}"` : `${head}?v=${stamp}"`)
  );
}

/** 도장이 붙어야 하는 자산인가 — 검사가 같은 판단을 쓰도록 내보낸다 */
export function needsStamp(path) { return !NO_STAMP.test(path); }

export function versionSource(stamp) {
  return `// 배포 도장 — **손으로 고치지 않는다.** \`node _tests/stamp.mjs\` 가 찍는다.
//
// src/ 와 assets/ 전체 내용의 해시다. 내용이 한 글자라도 바뀌면 이 값이 바뀌고,
// 그러면 \`import()\` 로 부르는 파일들의 주소도 같이 바뀐다 — 브라우저가 옛 파일을
// 같은 파일로 볼 수가 없다. 왜 필요한지는 \`_tests/stamp.mjs\` 맨 위에 적어 뒀다.
export const BUILD = '${stamp}';
`;
}

// 직접 실행했을 때만 찍는다 (검사가 import 할 때는 찍지 않는다)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const stamp = await computeStamp();
  await writeFile(VERSION_FILE, versionSource(stamp), 'utf8');
  const html = await readFile(INDEX_FILE, 'utf8');
  await writeFile(INDEX_FILE, restampHtml(html, stamp), 'utf8');
  console.log(`배포 도장 ${stamp} — version.js · index.html 갱신`);
}
