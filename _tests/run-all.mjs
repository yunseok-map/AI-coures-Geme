// 전체 검사 한 번에 — 배포하기 전에 이걸 돌린다.
//
//   node _tests/run-all.mjs
//
// 여기서 확인하는 것은 **DOM 없이 확인할 수 있는 것**이다:
//   판정 규칙 · 점수 · 실패 사유 이름 · 콘텐츠 짜임새 · 미니게임 17판의 구조.
// 화면·조작·실시간 흐름은 브라우저에서 눈으로 확인해야 한다(PROGRESS.md 참고).

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const SUITES = [
  ['17판 전수 구조', 'test-all.mjs'],
  ['13 사고 막기 (디펜스)', 'test-defense.mjs'],
  ['2 지어낸 답 찾기 (증거판)', 'test-evidence.mjs'],
  ['엔진 G 가 살아 있는지', 'test-shoot.mjs'],
  ['15 이상 징후 찾기 (슈팅)', 'test-shoot15.mjs'],
  ['14 결재 반려 (검토 라인)', 'test-qc.mjs'],
  ['11·12 배선 (워크플로우)', 'test-wire.mjs'],
  ['7 이름 함정 (예측 베팅)', 'test-bet.mjs'],
  ['6 모델/제품 (조립 라인)', 'test-assembly.mjs'],
  ['8 언제 발동하나 (타임라인)', 'test-timeline.mjs'],
  ['5 어디서 할까 (실시간 관제)', 'test-dispatch.mjs'],
  ['4 자료 찾아오기 (서고)', 'test-library.mjs'],
  ['9 배선 연결 (권한 게이트)', 'test-gate.mjs'],
  ['1·10 가방·지침서 (회차·수리)', 'test-bag.mjs'],
  ['17 이 일엔 어떤 AI (지형 답사)', 'test-map.mjs'],
  ['3 지시문 (실시간 대조)', 'test-preview.mjs'],
  ['용어 수집 (획득/읽음)', 'test-collect.mjs'],
  ['학습자 칸 (공용 PC)', 'test-who.mjs'],
  ['콘텐츠 검수 (글·용어·조사)', 'test-content.mjs'],
  ['글꼴 조각', 'test-font.mjs']
];

let bad = 0;
for (const [name, file] of SUITES) {
  const r = spawnSync(process.execPath, [join(here, file)], { encoding: 'utf8' });
  const line = (r.stdout || '').split('\n')
    .filter(l => /^결과|^검사 /.test(l.trim())).pop() || '(출력 없음)';
  const ok = r.status === 0;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name.padEnd(26)} ${line.trim()}`);
  if (!ok) {
    // 실패한 줄만 보여 준다 — 전체를 다시 읽을 필요가 없게
    for (const l of (r.stdout || '').split('\n')) {
      if (/FAIL|✗/.test(l)) console.log('        ' + l.trim());
    }
    if (r.stderr && r.stderr.trim()) console.log('        ' + r.stderr.trim().split('\n')[0]);
  }
}

console.log(bad ? `\n${bad}개 묶음 실패\n` : '\n전부 통과\n');
process.exit(bad ? 1 : 0);
