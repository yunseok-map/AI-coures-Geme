// 화면에 나가는 글자를 모은다. 폰트 조각을 만들 때와, 그 조각이 아직 충분한지
// 검사할 때 **같은 목록**을 써야 하므로 여기 한 곳에만 둔다.
//
//   node _tests/font-chars.mjs        → 글자를 정렬해서 한 줄로 출력 (조각 만들 때)
//   import { usedChars } from ...     → 검사에서 쓴다 (test-font.mjs)
//
// 왜 문자열 리터럴만 보는가: 이 저장소는 주석이 아주 많고 주석은 화면에 안 나간다.
// 주석까지 넣으면 폰트가 100KB 쯤 더 커진다. 대신 한글이 아닌 글자(기호·숫자·영문)는
// 어디에 있든 다 넣는다 — 개수가 적고, 빠뜨렸을 때 눈에 더 잘 띈다.

import { readdir, readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SKIP = new Set(['.git', 'node_modules', 'vendor', '_tests']);
const EXT = new Set(['.js', '.html', '.css']);

// 따옴표 세 종류. 이스케이프(`\n` · `\'`)는 두 글자로 그냥 지나간다 —
// 역슬래시와 n 은 한글이 아니라서 어차피 파일 전체에서 이미 모았다.
//
// 처음에는 역슬래시가 든 리터럴을 통째로 건너뛰었다. 그랬더니 `\n` 이 하나 든
// 문장이 통째로 빠져서, 거기에만 있던 글자('끔')가 "안 쓰는 글자"로 잡혔다.
// 조각에는 들어 있는데 검사는 안 쓴다고 말하는 상태였다.
const STR = new RegExp(
  "'((?:[^'\\n\\\\]|\\\\.)*)'" + '|' +
  '"((?:[^"\\n\\\\]|\\\\.)*)"' + '|' +
  '`((?:[^`\\\\]|\\\\.)*)`', 'g');

export const isHangul = (c) => /[가-힣ᄀ-ᇿ㄰-㆏]/.test(c);

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (EXT.has(extname(e.name))) out.push(p);
  }
  return out;
}

/** 화면에 나갈 수 있는 글자 전부. Set<string> */
export async function usedChars(root = ROOT) {
  const files = await walk(root);
  const use = new Set();
  for (const f of files) {
    const src = await readFile(f, 'utf8');
    for (const ch of src) if (!isHangul(ch)) use.add(ch);
    for (const m of src.matchAll(STR)) {
      for (const ch of (m[1] ?? m[2] ?? m[3] ?? '')) use.add(ch);
    }
  }
  // 제어문자·스페이스는 글꼴이 필요 없다 (0x20 이하와 DEL)
  for (const ch of [...use]) {
    const cp = ch.codePointAt(0);
    if (cp <= 0x20 || cp === 0x7f) use.delete(ch);
  }
  return use;
}

if (process.argv[1] && process.argv[1].endsWith('font-chars.mjs')) {
  const use = await usedChars();
  process.stdout.write([...use].sort().join(''));
}
