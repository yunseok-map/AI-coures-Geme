// 미니게임 목록. 코스맵은 이 목록만 보고 그린다.
// 새 미니게임 추가 = games/ 에 파일 하나 + 여기에 한 줄. (GAME_SPEC.md §10)
//
// 파일명 규칙: `번호-아이디.js`
// 데이터를 미리 불러오지 않는다. 실제 진입할 때만 동적 import 한다.

export const manifest = [
  // ---- 챕터 1 — AI 기본기 ----
  { id: 'context-bag',      no: 1,  chapter: 1, engine: 'C', required: true,  ready: true,
    title: '가방 싸기',        learn: '토큰 · 컨텍스트 윈도우 · 컨텍스트 로트' },
  { id: 'hallucination',    no: 2,  chapter: 1, engine: 'B', required: true,  ready: true,
    title: '지어낸 답 찾기',    learn: '할루시네이션 · 근거 확인' },
  { id: 'rewrite-prompt',   no: 3,  chapter: 1, engine: 'E', required: true,  ready: true,
    title: '지시문 고쳐쓰기',   learn: '프롬프트 4요소' },
  { id: 'fetch-source',     no: 4,  chapter: 1, engine: 'B', required: false, ready: true,
    title: '자료 찾아오기',     learn: 'RAG · 임베딩·벡터DB' },

  // ---- 챕터 2 — 도구 구분 ★ ----
  { id: 'where-to-work',    no: 5,  chapter: 2, engine: 'A', required: true,  ready: true,
    title: '어디서 할까?',      learn: '프로젝트 · 아티팩트 · Claude Code · Cowork' },
  { id: 'model-or-product', no: 6,  chapter: 2, engine: 'A', required: true,  ready: true,
    title: '모델이냐 제품이냐',  learn: '모델 · 제품 · 표면' },
  { id: 'name-trap',        no: 7,  chapter: 2, engine: 'B', required: true,  ready: true,
    title: '이름에 속지 마라',   learn: 'Claude Code · Codex의 정체' },
  { id: 'toolbox-sort',     no: 8,  chapter: 2, engine: 'A', required: true,  ready: true,
    title: '도구함 정렬',       learn: '커맨드 · 스킬 · 서브에이전트 · 훅 · 플러그인 · MCP' },
  { id: 'wiring',           no: 9,  chapter: 2, engine: 'C', required: false, ready: true,
    title: '배선 연결',         learn: 'MCP · 커넥터 · 최소 권한' },

  // ---- 챕터 3 — 일 시키기 (전체 심화) ----
  { id: 'onboarding-doc',   no: 10, chapter: 3, engine: 'C', required: false, ready: true,
    title: '신입 온보딩 문서',   learn: 'CLAUDE.md · AGENTS.md · 컨텍스트 엔지니어링' },
  { id: 'team-layout',      no: 11, chapter: 3, engine: 'D', required: false, ready: true,
    title: '팀 배치',           learn: '서브에이전트 · 오케스트레이션' },
  { id: 'auto-line',        no: 12, chapter: 3, engine: 'D', required: false, ready: true,
    title: '자동화 라인',       learn: '에이전트 루프 · 휴먼 인 더 루프' },

  // ---- 챕터 4 — 안전장치 ----
  { id: 'prevent-accident', no: 13, chapter: 4, engine: 'D', required: false, ready: true,
    title: '사고 막기',         learn: '훅 · 하네스 엔지니어링 · 가드레일 · 샌드박스' },
  { id: 'reject-approval',  no: 14, chapter: 4, engine: 'B', required: false, ready: true,
    title: '결재 반려',         learn: '워크슬롭 · 검증 부채' },
  { id: 'spot-risk',        no: 15, chapter: 4, engine: 'B', required: true,  ready: true,
    title: '이상 징후 찾기',    learn: '프롬프트 인젝션 · 섀도우 AI · 자동화 편향' },

  // ---- 챕터 5 — 실전 종합 ----
  { id: 'work-ticket',      no: 16, chapter: 5, engine: 'C', required: true,  ready: true,
    title: '업무 티켓 처리',    learn: '전체 종합' },

  // ---- 번외 ----
  { id: 'which-ai',         no: 17, chapter: 9, engine: 'A', required: true,  ready: true,
    title: '이 일엔 어떤 AI?',  learn: '용도별 도구 지형도 · 애그리게이터' }
];

/** 진입할 때만 실제 게임 데이터를 불러온다. */
export async function loadGame(id) {
  const meta = manifest.find(m => m.id === id);
  if (!meta || !meta.ready) return null;
  const file = `${String(meta.no).padStart(2, '0')}-${meta.id}.js`;
  const mod = await import(`./${file}`);
  return mod.default;
}

export function metaOf(id) {
  return manifest.find(m => m.id === id) || null;
}

/** 코스맵에서 "다음 할 것"을 정한다 — 필수 먼저, 번호 순 */
export function nextOf(id, isCleared) {
  const i = manifest.findIndex(m => m.id === id);
  const after = manifest.slice(i + 1);
  return (after.find(m => m.required && !isCleared(m.id))
       || manifest.find(m => m.required && !isCleared(m.id))
       || after.find(m => !isCleared(m.id))
       || null);
}
