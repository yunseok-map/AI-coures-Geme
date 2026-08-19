// 배포 도장 — **손으로 고치지 않는다.** `node _tests/stamp.mjs` 가 찍는다.
//
// src/ 와 assets/ 전체 내용의 해시다. 내용이 한 글자라도 바뀌면 이 값이 바뀌고,
// 그러면 `import()` 로 부르는 파일들의 주소도 같이 바뀐다 — 브라우저가 옛 파일을
// 같은 파일로 볼 수가 없다. 왜 필요한지는 `_tests/stamp.mjs` 맨 위에 적어 뒀다.
export const BUILD = '68299eee';
