// 용어 도감 데이터 — 원본은 TERMS.md. 콘텐츠 수정은 그쪽에서 먼저 한다.
// 각 항목은 프롬프트 §7 의 4필드를 갖는다: analogy / explain / example / myth
//
// 이 파일은 챕터 1·2 를 담고, 나머지는 아래 두 파일에서 합친다.
// (파일 하나가 500줄을 넘지 않게 나눴다 — 프롬프트 §2)

import { workTerms } from './terms-work.js';
import { extraTerms } from './terms-extra.js';

export const CHECKED_AT = '2026-08';

const D = 'https://code.claude.com/docs/en/glossary';
const P = 'https://platform.claude.com/docs/en/about-claude/glossary';

const coreTerms = [
  // ===================== 챕터 1 — AI 기본기 =====================
  {
    term: '토큰', en: 'Token', chapter: 1,
    analogy: 'AI가 글자를 세는 단위. 사람은 "몇 장"으로 세고 AI는 "몇 토큰"으로 센다',
    explain: 'AI는 글을 통째로 읽지 않고 잘게 쪼갠 조각으로 처리한다. 한글은 대략 한 글자가 1~2토큰, 영어는 한 단어가 1토큰 안팎이다. 입력도 출력도 전부 토큰으로 계산되고, 요금과 한계도 여기서 나온다.',
    example: 'A4 한 장 분량 보고서가 대략 1,000~1,500토큰',
    myth: '"토큰 = 단어"가 아니다. 쪼개는 방식이 언어마다 달라서 한글은 영어보다 토큰을 더 많이 먹는다',
    source: P
  },
  {
    term: '컨텍스트 윈도우', en: 'Context Window', chapter: 1,
    analogy: 'AI의 책상 크기. 여기 올려둔 것만 보고 일한다',
    explain: '한 번의 작업에서 AI가 동시에 볼 수 있는 정보의 총량이다. 대화 기록, 첨부 파일, 지침이 전부 이 안에 들어간다. 꽉 차면 오래된 것부터 밀려나거나 요약된다.',
    example: '긴 회의록 10개를 한 대화에 넣으면 앞쪽 내용을 AI가 놓치기 시작한다',
    myth: '"크면 무조건 좋다"가 아니다. 컨텍스트 로트 참조',
    source: D
  },
  {
    term: '컨텍스트 로트', en: 'Context Rot', chapter: 1,
    analogy: '책상에 서류를 많이 쌓을수록 가운데 낀 종이를 못 찾는 현상',
    explain: '넣는 정보가 길어질수록 AI의 정확도가 떨어진다. 앞부분과 뒷부분은 잘 보는데 가운데 있는 정보를 놓친다. Chroma가 최신 모델 18종을 검사했더니 전부 입력이 길어질수록 나빠졌다.',
    example: '자료 20개를 한꺼번에 주는 것보다 관련된 3개만 주는 쪽이 답이 정확하다',
    myth: '"컨텍스트 윈도우가 크니까 다 넣으면 된다" — 넣을수록 나빠진다',
    source: 'https://www.trychroma.com/research/context-rot'
  },
  {
    term: '할루시네이션', en: 'Hallucination', chapter: 1,
    analogy: '모르는 걸 모른다고 못 하고 그럴듯하게 지어내는 것',
    explain: 'AI가 사실이 아니거나 준 자료와 어긋나는 내용을 만들어내는 현상이다. 문장이 자연스러울수록 알아채기 어렵다. 말투의 확신과 내용의 정확도는 아무 상관이 없다.',
    example: '존재하지 않는 법 조항 번호, 없는 논문 제목, 틀린 통계를 정확한 형식으로 제시',
    myth: '"좋은 모델은 안 그런다" — 줄어들 뿐 없어지지 않는다. 근거 확인은 사용자 몫이다',
    source: 'https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations'
  },
  {
    term: '시스템 프롬프트', en: 'System Prompt', chapter: 1,
    analogy: '일 시작 전에 미리 붙여둔 근무 수칙',
    explain: '대화가 시작되기 전에 AI에게 주어지는 기본 지침이다. 역할, 말투, 하지 말아야 할 것이 여기 들어간다. 사용자가 매번 쓰는 질문과는 층이 다르다.',
    example: '"너는 우리 회사 인사 규정 담당자다. 규정에 없는 건 없다고 답한다"',
    myth: '"대화창에 쓰는 첫 문장이 시스템 프롬프트" — 다르다. 그보다 위층이다',
    source: 'https://platform.claude.com/docs/en/api/messages'
  },
  {
    term: '프롬프트 엔지니어링', en: 'Prompt Engineering', chapter: 1,
    analogy: '신입에게 일 시킬 때 지시를 얼마나 정확히 쓰느냐',
    explain: '같은 AI라도 지시문을 어떻게 쓰느냐에 따라 결과가 크게 달라진다. 효과가 큰 4가지는 역할·맥락·형식·예시다. 특히 예시 한 개가 설명 열 줄보다 낫다.',
    example: '"요약해줘" → "너는 팀장이다. 이 회의록을 결정사항/할일/보류 3단락, 각 3줄 이내로"',
    myth: '"주문을 잘 외우면 되는 기술"이 아니다. 대부분은 맥락을 빠짐없이 주는 일이다',
    source: 'https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview'
  },
  {
    term: '컨텍스트 엔지니어링', en: 'Context Engineering', chapter: 1,
    analogy: '지시문을 다듬는 걸 넘어, 책상 위에 무엇을 올려둘지 관리하는 일',
    explain: '2025년부터 프롬프트 엔지니어링의 다음 단계로 불린다. 무엇을 넣을지보다 무엇을 빼야 정확해지는지가 핵심이다. 컨텍스트 로트 때문에 "다 넣기"는 실패한다.',
    example: 'AI에게 줄 지침서를 만들 때 규칙 30개를 다 넣지 않고 핵심 8개만 남긴다',
    myth: '"프롬프트 엔지니어링의 새 이름"이 아니다. 지시문 한 줄이 아니라 정보 환경 전체를 다룬다',
    source: 'https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents'
  },
  {
    term: 'RAG', en: 'Retrieval-Augmented Generation', chapter: 1,
    analogy: '시험 볼 때 외운 걸로 답하지 말고 자료집을 찾아보고 답하게 하는 것',
    explain: '질문이 들어오면 먼저 관련 문서를 찾아온 뒤, 그 문서를 근거로 답을 만든다. 모델이 학습하지 않은 사내 자료나 최신 정보를 다룰 때 쓴다. 엉뚱한 문서를 찾아오면 답도 엉뚱해진다.',
    example: '사내 규정 챗봇 — 질문마다 규정집에서 해당 조항을 찾아와 그것만 보고 답한다',
    myth: '"RAG를 붙이면 환각이 사라진다" — 줄어들 뿐이다. 찾아온 문서가 틀리면 그대로 틀린다',
    source: P
  },
  {
    term: '임베딩·벡터DB', en: 'Embedding / Vector DB', chapter: 1,
    analogy: '문장을 좌표로 바꿔서 "뜻이 가까운 것"끼리 모아두는 서랍',
    explain: '글의 의미를 숫자 목록으로 바꾼 것이 임베딩이고, 그걸 모아 검색하는 저장소가 벡터DB다. RAG가 관련 문서를 찾을 때 쓰는 방식이다. 단어가 안 겹쳐도 뜻이 비슷하면 찾아낸다.',
    example: '"연차 남은 거"로 검색해도 "잔여 휴가 일수" 문서가 걸린다',
    myth: '"검색어가 정확히 들어가야 찾는다"가 아니다. 뜻으로 찾는다',
    source: 'https://www.pinecone.io/learn/vector-database/'
  },
  {
    term: '멀티모달', en: 'Multimodal', chapter: 1,
    analogy: '글만 읽는 게 아니라 그림도 보고 소리도 듣는 것',
    explain: '글·이미지·음성·영상 등 여러 형태의 입력을 함께 다루는 능력이다. 표가 든 스크린샷을 그대로 읽거나, 손으로 쓴 메모를 정리할 수 있다.',
    example: '종이 영수증 사진 20장을 찍어 넣고 엑셀 표로 정리',
    myth: '"이미지를 만들어 주는 것"이 아니다. 그건 이미지 생성. 멀티모달은 읽고 이해하는 쪽',
    source: 'https://platform.claude.com/docs/en/build-with-claude/vision'
  },
  {
    term: '추론 모델', en: 'Reasoning Model', chapter: 1,
    analogy: '바로 답하지 않고 종이에 풀이를 써 본 뒤 답하는 것',
    explain: '답하기 전에 단계적으로 생각하는 과정을 거치는 모델이다. 느리고 비싸지만 복잡한 문제에서 정확도가 오른다. 얼마나 오래 생각할지를 노력 수준으로 조절한다.',
    example: '단순 요약은 빠른 모델, 계약서 조항 충돌 검토는 추론 모델',
    myth: '"항상 추론 모델이 낫다"가 아니다. 단순 작업엔 느리고 비싸기만 하다',
    source: 'https://platform.claude.com/docs/en/build-with-claude/thinking'
  },
  {
    term: '파인튜닝 vs 프롬프팅', en: 'Fine-tuning vs Prompting', chapter: 1,
    analogy: '직원을 새로 교육시키는 것 vs 업무 지시를 잘 쓰는 것',
    explain: '파인튜닝은 모델 자체를 우리 데이터로 다시 훈련시키는 것이고, 프롬프팅은 훈련된 모델에 지시만 잘 주는 것이다. 대부분의 사무 업무는 프롬프팅 + RAG로 충분하다.',
    example: '"우리 회사 문체로 써줘"는 예시 3개를 주는 게 파인튜닝보다 빠르고 싸다',
    myth: '"우리 데이터로 학습시켜야 우리 일을 안다" — 대부분 필요 없다. 자료를 찾아 읽게 하는 편이 낫다',
    source: P
  },

  // ===================== 챕터 2 — 도구 구분 =====================
  {
    term: '모델', en: 'Model', chapter: 2,
    analogy: '엔진',
    explain: '실제로 글을 이해하고 만들어내는 두뇌 부분이다. 사람이 직접 쓰는 게 아니라 제품 안에 들어간다. Claude Opus·Sonnet, GPT 계열, Gemini 등이 모델 이름이다.',
    example: '같은 Claude 모델이 웹·앱·터미널에서 똑같이 돈다',
    myth: '"ChatGPT는 모델 이름"이 아니다. ChatGPT는 제품, GPT가 모델',
    source: 'https://platform.claude.com/docs/en/about-claude/models/overview'
  },
  {
    term: '제품', en: 'Product', chapter: 2,
    analogy: '그 엔진으로 만든 자동차',
    explain: '모델을 감싸서 사람이 쓸 수 있게 만든 도구다. 파일을 읽고, 도구를 부르고, 권한을 확인하는 부분이 전부 여기 붙는다. 공식 문서의 표현이 정확하다 — "Claude Code가 하네스이고, Claude는 그 안에 든 모델이다".',
    example: 'ChatGPT, Claude.ai, Claude Code, Cowork, Codex는 전부 제품',
    myth: '"제품이 똑똑한 것"이 아니다. 똑똑한 건 모델, 제품은 그걸 일하게 만드는 껍데기. 둘 다 있어야 쓸모가 있다',
    source: D
  },
  {
    term: '표면', en: 'Surface', chapter: 2,
    analogy: '같은 은행을 창구·ATM·앱으로 이용하는 것',
    explain: '같은 제품을 쓰는 여러 창구를 말한다. Claude Code는 터미널·VS Code·JetBrains·데스크톱 앱·claude.ai 다섯 표면에서 돌아간다. 전부 같은 엔진이라 설정과 지침이 그대로 따라온다.',
    example: '회사에선 데스크톱 앱, 이동 중엔 휴대폰 — 같은 작업을 이어서',
    myth: '"표면마다 다른 제품"이 아니다. 창구만 다르다',
    source: D
  },
  {
    term: '프로젝트', en: 'Projects', chapter: 2,
    analogy: '자료와 업무 지침을 넣어둔 전용 작업방',
    explain: '공식 정의는 "각자의 대화 기록과 지식 베이스를 가진 독립된 작업 공간"이다. 안에 지침·자료·대화들이 함께 들어간다. 대화마다 배경을 다시 설명하지 않아도 되는 게 핵심이다.',
    example: '"인사규정 프로젝트"에 규정집을 올려두면 그 안의 모든 대화가 규정집을 알고 시작한다',
    myth: '"그냥 폴더 아닌가?" — 아니다. 폴더는 파일만 담지만 프로젝트는 지침까지 담아 AI의 행동을 바꾼다',
    source: 'https://support.claude.com/en/articles/9517075-what-are-projects'
  },
  {
    term: '아티팩트', en: 'Artifacts', chapter: 2,
    analogy: '대화 옆에 따로 열리는 작업물 창',
    explain: '대화가 아니라 결과물이다. 문서·표·코드·다이어그램·작동하는 웹앱이 대화창 옆 별도 창에 만들어지고 거기서 계속 고칠 수 있다. 공식 기준은 "분량이 있고 독립적이며, 대화 밖으로 가져가 쓸 만한 것".',
    example: '보고서 초안을 아티팩트로 만들고 "3번 문단만 짧게"를 반복하며 다듬는다',
    myth: '"파일 첨부와 같은 것?" — 반대다. 첨부는 내가 넣는 입력, 아티팩트는 AI가 만드는 출력',
    source: 'https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them'
  },
  {
    term: 'Claude Code', en: 'Claude Code', chapter: 2,
    analogy: '내 컴퓨터의 파일과 명령을 직접 다루는 작업자',
    explain: '공식 정의는 "코드베이스를 읽고, 파일을 수정하고, 명령을 실행하고, 개발 도구와 연동하는 에이전틱 코딩 도구"다. 터미널·IDE·데스크톱 앱·브라우저에서 돌아간다. 채팅과 다른 점은 말만 하는 게 아니라 실제로 파일을 고친다는 것이다.',
    example: '폴더 안 문서 200개의 머리말을 한 번에 통일, 파일 일괄 이름 변경',
    myth: '"이름에 Code가 있으니 개발자 전용?" — 공식 정의는 지금도 코딩 도구가 맞다. 다만 파일·명령을 다루는 도구라 비코딩 업무에도 쓰이기 시작했고, 그래서 비개발자용 Cowork가 따로 나왔다',
    source: 'https://code.claude.com/docs/en/overview'
  },
  {
    term: 'Cowork', en: 'Claude Cowork', chapter: 2,
    analogy: '코딩 빼고 나머지 사무 업무를 맡기는 동료',
    explain: '공식 소개는 "어디서든 방향을 잡아줄 수 있는 작업 완수 도구. 목표를 주면 내 파일과 도구를 넘나들며 일한다"이다. Claude Code와 같은 기술을 쓰되 비개발자의 사무 업무를 위해 만들어졌다. 데스크톱·웹·모바일에서 돌아간다.',
    example: '여러 자료를 대조해 표 만들기, 계약서 다수 검토, 정기 보고서 반복 생성',
    myth: '"Claude Code의 쉬운 버전?" — 대상과 용도가 다른 별개 제품이다',
    source: 'https://claude.com/product/cowork'
  },
  {
    term: 'Codex', en: 'OpenAI Codex', chapter: 2,
    analogy: 'OpenAI 쪽의 Claude Code에 해당하는 자리',
    explain: 'ChatGPT 데스크톱 앱·웹, CLI, IDE 확장, 클라우드에서 돌아가는 에이전트 제품이다. 클라우드에서 작업을 비동기로 돌려놓고 나중에 결과를 받을 수 있다.',
    example: '저장소를 통째로 맡겨 두고 자리를 비운 뒤 결과 확인',
    myth: '"2021년의 코드 자동완성 모델?" — 다른 물건이다. 2021년 Codex는 모델이었고 2023년 3월 폐기됐다. 2025년 5월 같은 이름으로 완전히 다른 에이전트 제품이 나왔다',
    source: 'https://learn.chatgpt.com/docs'
  },
  {
    term: '커맨드', en: 'Command', chapter: 2,
    analogy: '자주 쓰는 지시를 단축키로 등록해둔 것',
    explain: '프롬프트에 `/이름`을 쳐서 부르는 재사용 지시다. 기본 커맨드가 있고 직접 만들 수도 있다. 공식 문서가 "슬래시 커맨드"에서 "슬래시"를 뺐고, 직접 만드는 커맨드는 스킬로 대체됐다(기존 파일은 계속 동작).',
    example: '`/주간보고`를 치면 정해둔 형식으로 초안이 나오게',
    myth: '"커맨드 = 스킬" — 지금은 수렴 중이다. 다만 스킬은 AI가 알아서 불러오고, 커맨드는 내가 쳐서 부른다',
    source: D
  },
  {
    term: '스킬', en: 'Skills / SKILL.md', chapter: 2,
    analogy: '"이 일은 이렇게 한다"를 적어둔 업무 매뉴얼 묶음',
    explain: '지침·지식·절차를 담은 SKILL.md 파일이다. 핵심은 필요할 때 AI가 알아서 꺼내 쓴다는 것. 직접 `/이름`으로 부를 수도 있다. Agent Skills라는 공개 표준을 따른다.',
    example: '"품의서 작성" 스킬을 만들어 두면 품의 관련 요청이 올 때 자동으로 불려 나온다',
    myth: '"스킬 = 플러그인"이 아니다. 플러그인이 더 큰 상자이고 스킬은 그 안에 든 물건 중 하나다',
    source: D
  },
  {
    term: '서브에이전트', en: 'Subagent', chapter: 2,
    analogy: '큰일을 쪼개 맡기는 보조 담당자',
    explain: '자기만의 책상(별도 컨텍스트 윈도우)을 가진 별도 AI다. 맡은 일을 하고 요약만 돌려준다. 큰 조사를 시켜도 본 대화의 책상이 지저분해지지 않는 게 핵심 이점이다.',
    example: '자료 50개 훑는 일을 서브에이전트에 맡기고 본 대화에는 결론 5줄만 받는다',
    myth: '"스킬이랑 뭐가 다른데?" — 스킬은 방법(문서), 서브에이전트는 일꾼(별도 AI). 스킬은 읽는 것, 서브에이전트는 부리는 것',
    source: D
  },
  {
    term: '훅', en: 'Hooks', chapter: 2,
    analogy: '특정 순간마다 반드시 울리는 자동 알람',
    explain: '정해진 시점(도구 실행 전, 파일 수정 후, 세션 시작 등)에 자동으로 실행되는 처리다. 결정적으로 AI의 판단이 아니라 정해진 시점에 무조건 작동한다. 그래서 안전장치로 쓴다.',
    example: '파일을 고칠 때마다 자동 형식 검사, 외부 전송 전 반드시 확인 절차',
    myth: '"AI가 알아서 부르는 기능" — 반대다. AI가 건너뛸 수 없는 게 훅의 존재 이유다',
    source: D
  },
  {
    term: '플러그인', en: 'Plugin', chapter: 2,
    analogy: '스킬·훅·서브에이전트·연결을 한 상자에 담은 설치 꾸러미',
    explain: '공식 정의는 "스킬·훅·서브에이전트·MCP 서버를 하나의 설치 단위로 묶은 꾸러미"다. 팀에 배포할 때 쓴다.',
    example: '"우리 팀 문서 규칙" 플러그인 하나를 설치하면 관련 스킬과 검사 훅이 한꺼번에 깔린다',
    myth: '"스킬의 다른 말"이 아니다. 플러그인 ⊃ 스킬',
    source: D
  },
  {
    term: 'MCP', en: 'Model Context Protocol', chapter: 2,
    analogy: '어느 회사 기기든 꽂히는 표준 규격 콘센트',
    explain: 'AI를 외부 데이터·서비스에 연결하는 공개 표준이다. 이 규격을 따르면 사내 시스템·데이터베이스·브라우저 등을 AI의 도구로 붙일 수 있다. 규격이라서 특정 회사 것이 아니다.',
    example: '사내 문서 시스템을 MCP 서버로 만들어 두면 AI가 직접 검색할 수 있다',
    myth: '"특정 제품 기능"이 아니다. 프로토콜(약속)이다. 여러 회사가 함께 쓴다',
    source: D
  },
  {
    term: '커넥터', en: 'Connector', chapter: 2,
    analogy: '계정에 미리 등록해둔 콘센트',
    explain: '계정에 추가해 둔 MCP 서버다. 로컬에 직접 설정하는 것과 달리 계정을 따라다닌다. 회사가 조직 차원에서 미리 깔아 주고 도구별 권한을 걸 수도 있다.',
    example: '회사가 승인한 커넥터만 켜 두면 직원들이 개별 설정할 필요가 없다',
    myth: '"MCP와 다른 것"이 아니다. 커넥터는 MCP 서버를 계정에 등록하는 방식이다',
    source: D
  },
  {
    term: '최소 권한', en: 'Least Privilege', chapter: 2,
    analogy: '출입증에 필요한 층만 뚫어 주는 것',
    explain: 'AI에게 일에 필요한 만큼만 권한을 주는 원칙이다. 읽기만 하면 되는 일에 쓰기·삭제까지 열어 두지 않는다. 사고가 나도 피해 범위가 열어 준 만큼으로 묶인다.',
    example: '메일 초안만 쓰게 할 거면 "읽기"와 "임시보관함 저장"만 켜고 "발송"은 끈다',
    myth: '"불편하게 만드는 규제"가 아니다. 잘못 도는 날 손해가 어디까지 갈지를 미리 정해 두는 것이다',
    // 보안 표준 용어집의 정의를 그대로 따른다 —
    // "맡은 일을 해내는 데 필요한 최소한으로 접근 권한을 제한하는 보안 원칙"
    source: 'https://csrc.nist.gov/glossary/term/least_privilege'
  }
];

/** 도감에 실리는 용어 전체 */
export const terms = coreTerms.concat(workTerms, extraTerms);

/** 코스맵·도감에서 쓰는 챕터 이름 */
export const chapterNames = {
  1: 'AI 기본기',
  2: '도구 구분',
  3: '일 시키기',
  4: '안전장치',
  5: '실전 종합',
  6: '더 알아두면 좋은 것',
  9: '번외'
};

export function findTerm(name) {
  return terms.find(t => t.term === name) || null;
}
