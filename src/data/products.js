// 제품·도구 구분 데이터 — 챕터 2용.
// 내용 수정은 TERMS.md 에서 먼저 하고 여기로 옮긴다.
// 전 항목 공식 문서 전수 검증 (2026-08-17). 확인 안 된 것은 넣지 않았다.

export const CHECKED_AT = '2026-08';

/**
 * kind: 'model'   = 엔진 (사람이 직접 쓰지 않는다)
 *       'product' = 그 엔진으로 만든 도구 (사람이 쓴다)
 * 표면(surface)은 제품의 속성이라 별도 종류로 두지 않고 surfaces 에 적는다.
 */
export const products = [
  {
    id: 'claude-opus',
    name: 'Claude Opus',
    kind: 'model',
    oneLine: 'Anthropic의 모델 계열 이름. 제품이 아니라 그 안에 든 엔진이다',
    myth: '"Claude를 쓴다"고 할 때 대부분 제품(Claude.ai)을 말한다',
    official: 'https://platform.claude.com/docs/en/about-claude/models/overview',
    checkedAt: CHECKED_AT
  },
  {
    id: 'gpt',
    name: 'GPT 계열',
    kind: 'model',
    oneLine: 'OpenAI의 모델 계열. ChatGPT라는 제품 안에서 돌아간다',
    myth: '"ChatGPT = GPT"로 섞어 쓰지만 하나는 제품, 하나는 모델이다',
    official: 'https://developers.openai.com/api/docs/models',
    checkedAt: CHECKED_AT
  },
  {
    id: 'gemini-model',
    name: 'Gemini(모델)',
    kind: 'model',
    oneLine: 'Google의 모델 계열. 같은 이름의 앱(제품)도 있어서 특히 헷갈린다',
    myth: '이름이 같아도 모델과 앱은 다른 층이다',
    official: 'https://deepmind.google/models/gemini/',
    checkedAt: CHECKED_AT
  },

  {
    id: 'chat',
    name: '채팅',
    kind: 'product',
    oneLine: '그때그때 묻고 답을 받는 가장 기본 형태',
    useWhen: '단발 질문, 문장 다듬기, 짧은 초안',
    surfaces: ['웹', '모바일 앱', '데스크톱 앱'],
    myth: '"AI = 채팅"이 이 게임이 깨려는 가장 큰 오해다',
    official: 'https://support.claude.com/en/articles/8114491-get-started-with-claude',
    checkedAt: CHECKED_AT
  },
  {
    id: 'projects',
    name: '프로젝트 (Projects)',
    kind: 'product',
    oneLine: '자료와 지침을 넣어두는 전용 작업방. 대화마다 배경을 다시 설명하지 않아도 된다',
    useWhen: '같은 주제로 계속 이어서 일할 자료들을 모아두고 싶을 때',
    surfaces: ['웹', '모바일 앱'],
    myth: '"그냥 폴더 아닌가?" — 아니다. 폴더는 파일만 담지만 프로젝트는 지침까지 담아 AI의 행동을 바꾼다',
    official: 'https://support.claude.com/en/articles/9517075-what-are-projects',
    checkedAt: CHECKED_AT
  },
  {
    id: 'artifacts',
    name: '아티팩트 (Artifacts)',
    kind: 'product',
    oneLine: '대화 옆에 따로 열리는 결과물 창. 대화가 아니라 산출물이다',
    useWhen: '결과물을 문서로 뽑아서 계속 고쳐 나가고 싶을 때',
    surfaces: ['웹', '모바일 앱'],
    myth: '"파일 첨부와 같은 것?" — 반대다. 첨부는 내가 넣는 입력, 아티팩트는 AI가 만드는 출력',
    official: 'https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them',
    checkedAt: CHECKED_AT
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    kind: 'product',
    oneLine: '내 컴퓨터의 파일을 직접 읽고 고치고 명령을 실행하는 에이전틱 코딩 도구',
    useWhen: '내 PC의 파일 수백 개를 실제로 건드려야 할 때',
    surfaces: ['터미널', 'VS Code', 'JetBrains', '데스크톱 앱', '웹'],
    myth: '"이름에 Code가 있으니 개발자 전용?" — 공식 정의는 지금도 코딩 도구가 맞다. 다만 파일·명령을 다루는 도구라 비코딩 업무에도 쓰이기 시작했고, 그래서 비개발자용 Cowork가 따로 나왔다',
    official: 'https://code.claude.com/docs/en/overview',
    checkedAt: CHECKED_AT
  },
  {
    id: 'cowork',
    name: 'Cowork',
    kind: 'product',
    oneLine: '목표를 주면 내 파일과 도구를 넘나들며 일을 끝내는 비개발자용 업무 도구',
    useWhen: '코딩이 아닌 사무 업무를 통째로 맡기고 싶을 때',
    surfaces: ['데스크톱', '웹', '모바일(베타)'],
    myth: '"Claude Code의 쉬운 버전?" — 대상과 용도가 다른 별개 제품이다. 코드베이스가 아니라 업무 파일을 다룬다',
    official: 'https://claude.com/product/cowork',
    checkedAt: CHECKED_AT
  },
  {
    id: 'codex',
    name: 'Codex (OpenAI)',
    kind: 'product',
    oneLine: 'ChatGPT·CLI·IDE·클라우드에서 도는 OpenAI의 에이전트 제품',
    useWhen: 'OpenAI 쪽의 CLI 에이전트 자리',
    surfaces: ['ChatGPT 앱', '웹', 'CLI', 'IDE 확장', '클라우드'],
    myth: '"2021년 코드 자동완성 모델?" — 다른 물건이다. 2021년 Codex는 모델이었고 2023년 3월 폐기됐다. 2025년 5월 같은 이름으로 완전히 다른 에이전트 제품이 나왔다',
    official: 'https://learn.chatgpt.com/docs/codex/cli',
    checkedAt: CHECKED_AT
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI (gemini)',
    kind: 'product',
    oneLine: 'Gemini 를 터미널로 바로 가져오는 오픈소스 AI 에이전트',
    useWhen: 'Google 쪽 생태계를 쓰거나 도구 내부를 직접 확인해야 할 때',
    surfaces: ['터미널'],
    myth: '"오픈소스니까 사내에서 마음대로 써도 된다?" — 코드가 공개된 것과 회사 자료를 넣어도 되는 것은 별개다. 어느 CLI 에이전트든 사내 자료를 넣기 전 승인 절차를 확인해야 한다',
    official: 'https://google-gemini.github.io/gemini-cli/',
    checkedAt: CHECKED_AT
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    kind: 'product',
    oneLine: 'OpenAI의 채팅 제품. 안에서 도는 모델이 GPT 계열이다',
    surfaces: ['웹', '모바일 앱', '데스크톱 앱'],
    myth: '가장 흔한 혼동 — 제품 이름이지 모델 이름이 아니다',
    official: 'https://chatgpt.com',
    checkedAt: CHECKED_AT
  },
  {
    id: 'claude-ai',
    name: 'Claude.ai',
    kind: 'product',
    oneLine: 'Anthropic의 채팅 제품. 프로젝트와 아티팩트가 여기 들어 있다',
    surfaces: ['웹', '모바일 앱', '데스크톱 앱'],
    myth: '모델 이름(Opus·Sonnet)과 제품 이름을 섞어 쓰기 쉽다',
    official: 'https://claude.com/resources/tutorials/getting-started-with-claude-ai',
    checkedAt: CHECKED_AT
  }
];

/** 미니게임 8용 — 제일 헷갈리는 도구 계층 6형제. 전부 공식 용어집 정의. */
export const toolLayer = [
  {
    id: 'command',
    name: '커맨드',
    oneLine: '`/이름`을 쳐서 내가 직접 부르는 재사용 지시',
    key: '내가 부른다',
    note: '공식 문구에서 "슬래시"가 빠졌다. 직접 만드는 커맨드는 스킬로 대체됐다(기존 파일은 계속 동작)'
  },
  {
    id: 'skill',
    name: '스킬',
    oneLine: '"이 일은 이렇게 한다"를 적어둔 방법 문서. 필요할 때 AI가 알아서 꺼내 쓴다',
    key: 'AI가 알아서 꺼낸다',
    note: 'Agent Skills 공개 표준을 따른다'
  },
  {
    id: 'subagent',
    name: '서브에이전트',
    oneLine: '자기만의 책상을 가진 별도 AI. 맡은 일을 하고 요약만 돌려준다',
    key: '별도 일꾼이다',
    note: '스킬은 방법(문서), 서브에이전트는 일꾼(별도 AI)'
  },
  {
    id: 'hook',
    name: '훅',
    oneLine: '정해진 시점에 무조건 실행되는 자동 처리',
    key: 'AI가 건너뛸 수 없다',
    note: 'AI의 판단이 아니라 고정된 시점에 작동한다. 그래서 안전장치로 쓴다'
  },
  {
    id: 'plugin',
    name: '플러그인',
    oneLine: '스킬·훅·서브에이전트·MCP를 한 상자에 담은 설치 꾸러미',
    key: '묶어서 배포한다',
    note: '플러그인 ⊃ 스킬. 스킬의 다른 말이 아니다'
  },
  {
    id: 'mcp',
    name: 'MCP',
    oneLine: 'AI를 외부 시스템에 연결하는 공개 표준 규격',
    key: '바깥과 연결한다',
    note: '특정 회사 기능이 아니라 여러 회사가 함께 쓰는 약속(프로토콜)'
  }
];
