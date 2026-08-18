// 엔진 G(슈팅) 가 15번 판만 남기고 멀쩡한가.
//
// 여기 있던 2번 판(지어낸 답 찾기) 검사는 **전부 걷어냈다.** 그 판은 슈팅을 버리고
// 증거판(엔진 V)으로 다시 만들었고, 검사는 `_tests/test-evidence.mjs` 로 옮겼다.
// 15번 판(이상 징후 찾기)의 판정 검사는 `_tests/test-shoot15.mjs` 가 그대로 본다.
//
// 그래서 이 파일에 남은 일은 하나다 — **엔진을 지우지 않았는지, 그리고 이 엔진을
// 쓰는 판이 정확히 어디인지**를 못 박아 둔다. 판 하나가 엔진을 떠날 때 엔진까지
// 같이 지워 버리면 남은 판이 조용히 안 열린다.
//
// 엔진 파일은 import 하지 않고 원문으로 읽는다. 화면을 만지는 모듈을 물고 있어서
// Node 에서 바로 불러올 수 없다 (test-all.mjs 가 main.js 를 읽는 것과 같은 이유).

import { readFile } from 'node:fs/promises';

const ROOT = '../src';
const g15 = (await import(`${ROOT}/games/15-spot-risk.js`)).default;
const g02 = (await import(`${ROOT}/games/02-hallucination.js`)).default;

let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('  OK   ' + n); }
  else { fail++; console.log(`  FAIL ${n}${x ? ' — ' + x : ''}`); } };

console.log('\n== 엔진이 그대로 있는가 ==');
const src = await readFile(new URL('../src/engines/shoot.js', import.meta.url), 'utf8')
  .catch(() => '');
check('engines/shoot.js 가 있다', src.length > 0, '파일 없음');
check('mount 를 내보낸다', /export\s+function\s+mount\s*\(/.test(src));
check('unmount 를 내보낸다', /export\s+function\s+unmount\s*\(/.test(src));

console.log('\n== 누가 이 엔진을 쓰는가 ==');
check('15번 판이 아직 슈팅을 쓴다', g15.engine === 'G', `engine ${g15.engine}`);
check('15번 판에 문항이 있다', Array.isArray(g15.data?.items) && g15.data.items.length > 0);
check('2번 판은 슈팅을 떠났다', g02.engine !== 'G', `engine ${g02.engine}`);
check('2번 판에는 쏠 문항이 없다', !g02.data?.items);

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
