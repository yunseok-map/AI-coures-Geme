// AI 도구 도감 — 번외. 게임 클리어와 무관하게 언제든 열람 가능한 카탈로그.
//
// 설계 원칙 (프롬프트 §6-B, 이거 안 지키면 반년 만에 쓰레기가 된다):
//   1. 카테고리가 뼈대, 도구는 예시다. 이름은 갈려도 칸은 남는다
//   2. 순위·"최고" 표현 금지. "이 일에는 이 계열"로만 서술
//   3. 가격·성능 수치 금지. 무료 / 부분 무료 / 유료 정도의 거친 구분만
//   4. 벤더 홍보 문구 복붙 금지. "무슨 일에 쓰는 물건인지"로 다시 썼다
//   5. 모든 카드에 watchOut(주의점)과 checkedAt, 공식 링크 필수
//   6. 넣기 전에 현재도 서비스 중인지 확인 (2026-08-17 확인)

import { meetingCategory } from './tools-meeting.js';

export const CHECKED_AT = '2026-08';

/** 도감 맨 위에 고정되는 경고. 스크롤해도 사라지지 않는다 */
export const BANNER =
  '여기 나온 도구를 회사 업무에 바로 쓸 수 있다는 뜻이 아니다. ' +
  '사내 자료를 넣기 전에 승인된 도구인지 반드시 확인한다.';

const baseCategories = [
  {
    id: 'chat', name: '범용 채팅',
    use: '묻고 답 받기. 대부분의 사람이 “AI”라고 할 때 떠올리는 그것',
    tools: [
      { name: 'ChatGPT', oneLine: 'OpenAI의 채팅 제품. 안에서 도는 모델은 GPT 계열이다',
        goodAt: ['폭넓은 일반 업무', '이미지·음성까지 한 창에서'],
        watchOut: ['제품 이름과 모델 이름을 섞어 쓰기 쉽다', '무료 등급은 쓸 수 있는 모델이 제한된다'],
        useWhen: '딱히 정해진 게 없을 때의 기본값', pricing: '부분 무료',
        official: 'https://chatgpt.com' },
      { name: 'Claude', oneLine: 'Anthropic의 채팅 제품. 프로젝트·아티팩트가 여기 들어 있다',
        goodAt: ['긴 문서 다루기', '결과물을 옆에 띄워놓고 고치기'],
        watchOut: ['무료 등급은 사용량 한도가 빨리 찬다'],
        useWhen: '문서를 계속 손봐야 하는 일', pricing: '부분 무료',
        official: 'https://claude.ai' },
      { name: 'Gemini', oneLine: 'Google의 채팅 제품. 같은 이름의 모델과 층이 다르다',
        goodAt: ['구글 문서·메일과 이어 쓰기', '이미지 다루기'],
        watchOut: ['제품 Gemini와 모델 Gemini를 구분해야 한다'],
        useWhen: '구글 워크스페이스를 쓰는 조직', pricing: '부분 무료',
        official: 'https://gemini.google.com' },
      { name: 'Microsoft Copilot', oneLine: '마이크로소프트의 채팅 제품. 오피스 안에 들어와 있다',
        goodAt: ['엑셀·워드·팀즈 안에서 바로 쓰기'],
        watchOut: ['조직이 켜 주지 않으면 기능이 제한된다', '오피스 밖 작업은 다른 도구가 나을 때가 많다'],
        useWhen: '이미 M365를 쓰는 조직', pricing: '유료',
        official: 'https://copilot.microsoft.com' },
      { name: '뤼튼 (국내)', oneLine: '여러 회사 모델을 묶어 무료로 쓰게 해주는 국내 서비스',
        goodAt: ['한국어 사용', '여러 모델을 한 곳에서', 'AI 검색'],
        watchOut: ['안에서 도는 모델이 무엇인지 바뀔 수 있다. 모델이 아니라 플랫폼이다',
                   '무료라도 사내 자료를 넣는 건 별개 문제다. 승인부터 확인한다'],
        useWhen: '한국어로 가볍게 시작해 볼 때', pricing: '부분 무료',
        official: 'https://wrtn.ai',
        note: 'aggregator' }
    ]
  },

  {
    id: 'research', name: '리서치·검색',
    use: '자료를 찾아오고 근거를 붙여 정리하기',
    tools: [
      { name: 'Perplexity', oneLine: '지금 이 순간의 웹을 검색해 출처를 달아 답한다',
        goodAt: ['최신 정보 조사', '출처 링크가 붙은 답'],
        watchOut: ['찾아온 출처가 틀리면 답도 틀린다. 링크를 직접 열어 봐야 한다'],
        useWhen: '무엇이 있는지부터 찾아야 할 때', pricing: '부분 무료',
        official: 'https://perplexity.ai' },
      { name: 'Gemini Notebook (구 NotebookLM)', oneLine: '구글의 자료 기반 조사 도구. 내가 올린 자료를 근거로 답한다',
        goodAt: ['내 문서 묶음 정리', '자료 기반 요약·음성 브리핑'],
        watchOut: ['이름이 NotebookLM에서 Gemini Notebook으로 바뀌었다. 옛 이름으로 찾으면 헷갈린다',
                   '올린 자료 밖의 최신 정보는 모른다', '자료 자체가 낡았으면 답도 낡는다'],
        useWhen: '자료는 이미 있고 정리가 필요할 때', pricing: '부분 무료',
        official: 'https://notebook.google/' },
      { name: '각 사 딥리서치 기능', oneLine: '채팅 제품 안에 들어 있는 장시간 조사 모드',
        goodAt: ['여러 출처를 훑어 보고서 형태로 정리'],
        watchOut: ['한 번 돌리는 데 시간이 오래 걸린다', '중간에 방향이 틀리면 끝까지 틀린 채로 나온다'],
        useWhen: '따로 도구를 늘리고 싶지 않을 때', pricing: '부분 무료',
        official: 'https://claude.ai' }
    ]
  },

  {
    id: 'agent', name: '자율 에이전트',
    use: '목표만 주면 알아서 계획을 세우고 끝까지 해온다',
    tools: [
      { name: 'Manus', oneLine: '목표를 주면 스스로 계획하고 웹을 돌아다니며 결과물까지 만든다',
        goodAt: ['긴 조사 작업', '문서·표 형태의 완성물까지'],
        watchOut: ['중간에 방향이 틀리면 끝까지 틀린 채로 완성된다. 반드시 검토한다',
                   '작업이 밖에서 돌아간다. 사내 자료를 넣기 전에 승인부터 확인한다',
                   '회사 상태가 바뀌는 중이라는 안내가 붙어 있다. 작업물을 여기에만 쌓아 두지 않는 게 좋다'],
        useWhen: '사람이 몇 시간 붙어야 할 조사·정리 작업', pricing: '부분 무료',
        official: 'https://manus.im' },
      { name: 'Claude Cowork', oneLine: '내 파일과 도구를 넘나들며 사무 업무를 끝낸다. 개발자가 아닌 사람을 겨냥한 도구다',
        goodAt: ['여러 자료 대조해 표 만들기', '반복되는 정기 업무'],
        watchOut: ['내 파일을 실제로 만들고 고친다. 어떤 폴더를 열어 줄지 먼저 정한다'],
        useWhen: '코딩이 아닌 업무를 통째로 맡길 때', pricing: '유료',
        official: 'https://claude.com/product/cowork' },
      { name: '각 사 에이전트 모드', oneLine: '채팅 제품 안에서 여러 단계를 스스로 실행하는 모드',
        goodAt: ['도구를 새로 늘리지 않고 위임해 보기'],
        watchOut: ['어디까지 스스로 할지 경계가 제품마다 다르다', '돌리기 전에 무엇을 할지 확인하는 습관을 들인다'],
        useWhen: '자율 에이전트를 처음 겪어 볼 때', pricing: '부분 무료',
        official: 'https://chatgpt.com' }
    ]
  },

  {
    id: 'coding', name: 'CLI 에이전트 (터미널)',
    use: '터미널에 설치해서 내 컴퓨터의 파일과 명령을 직접 다룬다. 회사마다 하나씩 있고 조작이 거의 같다. 다른 건 지침 파일 이름뿐이다',
    tools: [
      { name: 'Claude Code (claude)', oneLine: '코드베이스를 읽고 파일을 고치고 명령을 실행하는 에이전틱 코딩 도구',
        goodAt: ['여러 파일에 걸친 일괄 작업', '터미널·IDE·데스크톱·웹 어디서나 같은 설정'],
        watchOut: ['공식 정의는 코딩 도구다. 개발자가 아닌 사람에게는 Cowork가 따로 있다',
                   '파일을 실제로 고친다. 되돌릴 방법을 먼저 확인한다',
                   '지침 파일은 CLAUDE.md'],
        useWhen: '내 PC의 파일을 실제로 건드려야 할 때', pricing: '유료',
        official: 'https://code.claude.com/docs/en/overview' },
      { name: 'Codex CLI (codex)', oneLine: '터미널을 벗어나지 않고 코드를 살펴보고 고치고 명령을 실행한다',
        goodAt: ['터미널에서 바로 작업', '클라우드에 오래 걸리는 작업을 맡겨 두기'],
        watchOut: ['제품 이름과 모델 갈래 이름이 똑같이 Codex다. 목록에서 보면 어느 쪽인지 먼저 가린다',
                   '지침 파일은 AGENTS.md (여러 도구가 함께 쓰는 공개 형식)'],
        useWhen: 'OpenAI 쪽 생태계를 쓸 때', pricing: '유료',
        official: 'https://learn.chatgpt.com/docs/codex/cli' },
      { name: 'Gemini CLI (gemini)', oneLine: 'Gemini를 터미널로 바로 가져오는 오픈소스 AI 에이전트',
        goodAt: ['터미널에서 바로 작업', '소스가 공개돼 있어 사내에서 뜯어볼 수 있다'],
        watchOut: ['오픈소스라 설치와 업데이트를 직접 챙겨야 한다',
                   '지침 파일은 GEMINI.md'],
        useWhen: 'Google 쪽 생태계를 쓰거나 도구 내부를 확인해야 할 때', pricing: '부분 무료',
        official: 'https://google-gemini.github.io/gemini-cli/' },
      { name: 'Cursor', oneLine: '편집기 자체에 AI가 들어간 형태. 여러 회사 모델을 골라 쓸 수 있고 자체 모델도 따로 있다',
        goodAt: ['코드를 보면서 고치는 작업'],
        watchOut: ['편집기를 갈아타야 한다', '고를 수 있는 모델이 여럿이라 지금 무엇이 도는지 봐야 한다'],
        useWhen: '편집기 안에서 작업하는 게 편할 때', pricing: '부분 무료',
        official: 'https://cursor.com' },
      { name: 'GitHub Copilot', oneLine: '쓰던 편집기에 붙는 AI 보조. 지금은 명령줄과 GitHub 안에서 에이전트에게 일을 맡기는 것까지 한다',
        goodAt: ['쓰던 편집기를 그대로 쓰면서 도움받기', '작업을 맡겨 두고 결과를 받기'],
        watchOut: ['옆에서 거들 때와 통째로 맡길 때는 확인해야 할 것이 다르다',
                   '고를 수 있는 모델이 여럿이라 지금 무엇이 도는지 봐야 한다'],
        useWhen: '도구를 바꾸지 않고 시작할 때', pricing: '부분 무료',
        official: 'https://github.com/features/copilot' }
    ]
  },

  {
    id: 'video', name: '영상 생성',
    use: '글이나 사진에서 움직이는 영상을 만든다. 이 칸은 변화가 제일 빠르다',
    tools: [
      { name: 'Veo (Google)', oneLine: '구글의 영상 생성 모델 계열',
        goodAt: ['화질 전반', '소리까지 함께 만들기'],
        watchOut: ['긴 영상은 앞뒤가 어긋나기 쉽다', '높은 화질은 상위 요금제에서만 열린다'],
        useWhen: '짧은 장면의 완성도가 중요할 때', pricing: '유료',
        official: 'https://deepmind.google/models/veo/' },
      { name: 'Kling', oneLine: '인물 일관성과 여러 컷 연결에 강한 영상 생성 계열',
        goodAt: ['같은 인물을 여러 컷에 유지', '대사·다중 장면'],
        watchOut: ['만들 때마다 결과가 달라져 여러 번 돌려야 한다'],
        useWhen: '사람이 나오는 짧은 이야기', pricing: '부분 무료',
        official: 'https://kling.ai/' },
      { name: 'Runway', oneLine: '편집 통제권이 넓은 영상 도구',
        goodAt: ['광고·납품물처럼 세밀한 조정이 필요한 작업'],
        watchOut: ['다룰 것이 많아 처음에는 오래 걸린다'],
        useWhen: '결과를 세밀하게 잡아야 할 때', pricing: '부분 무료',
        official: 'https://runway.com/' },
      { name: 'Higgsfield', oneLine: '★ 자기 모델이 아니라 여러 회사 모델을 골라 쓰게 해주는 플랫폼. 영상에서 시작해 이미지·음성·편집까지 넓어졌다',
        goodAt: ['한 곳에서 여러 엔진 비교', '카메라 움직임·인물 일관성 도구'],
        watchOut: ['모델이 아니라 플랫폼이다. 안에서 도는 엔진이 무엇인지 봐야 한다',
                   '엔진이 추가·교체되면 결과도 달라진다'],
        useWhen: '어떤 엔진이 맞는지 아직 모를 때', pricing: '유료',
        official: 'https://higgsfield.ai',
        note: 'aggregator' }
    ]
  },

  {
    id: 'avatar', name: '아바타·발표 영상',
    use: '사람이 말하는 영상. 위의 영상 생성과 다른 칸이다. 장면을 만드는 게 아니라 말하는 사람을 만든다',
    tools: [
      { name: 'HeyGen', oneLine: '대본을 넣으면 사람이 말하는 영상이 나온다',
        goodAt: ['교육·안내 영상', '여러 언어 더빙'],
        watchOut: ['긴 영상에서 입 모양이 조금씩 어긋난다', '고급 아바타·번역은 사용량을 빠르게 소모한다'],
        useWhen: '촬영 없이 안내 영상을 만들 때', pricing: '부분 무료',
        official: 'https://heygen.com' },
      { name: 'Synthesia', oneLine: '기업 교육용 아바타 영상에 집중한 도구다',
        goodAt: ['사내 교육 영상 대량 제작'],
        watchOut: ['목소리와 동작이 다소 딱딱하다는 평이 있다'],
        useWhen: '같은 형식의 교육 영상을 여러 편 만들 때', pricing: '유료',
        official: 'https://synthesia.io' }
    ]
  },

  {
    id: 'image', name: '이미지 생성',
    use: '그림·사진 만들기',
    tools: [
      { name: 'Midjourney', oneLine: '그림체와 분위기 쪽에 강한 이미지를 만든다',
        goodAt: ['일러스트·콘셉트 이미지'],
        watchOut: ['이미지 안의 글자가 자주 깨진다', '실제 사진처럼 보이는 제품 컷에는 다른 계열이 낫다'],
        useWhen: '분위기가 중요한 이미지', pricing: '유료',
        official: 'https://midjourney.com' },
      { name: 'Gemini 이미지 (나노바나나 계열)', oneLine: '같은 대상을 여러 번 고쳐도 일관되게 유지하는 쪽에 강하다',
        goodAt: ['제품 사진', '여러 사진 합치기', '반복 수정'],
        watchOut: ['모델 이름이 자주 바뀐다. 계열로 기억하는 편이 낫다'],
        useWhen: '같은 물건을 여러 장면에 넣을 때', pricing: '부분 무료',
        official: 'https://gemini.google.com' },
      { name: 'GPT 이미지', oneLine: 'ChatGPT 안에서 그대로 이미지를 만든다',
        goodAt: ['이미지 안의 글자', '대화하며 고치기'],
        watchOut: ['세밀한 화풍 통제는 전용 도구가 낫다'],
        useWhen: '따로 도구를 늘리지 않고 만들 때', pricing: '부분 무료',
        official: 'https://chatgpt.com' },
      { name: 'Flux', oneLine: '가중치가 공개돼 있어 직접 돌릴 수 있다',
        goodAt: ['자체 서버에서 운영', '글자 표현'],
        watchOut: ['직접 돌리려면 장비와 사람이 필요하다'],
        useWhen: '자료를 밖으로 보낼 수 없을 때', pricing: '부분 무료',
        official: 'https://bfl.ai/' }
    ]
  },

  {
    id: 'voice', name: '음성·더빙',
    use: '읽어주는 목소리 만들기, 다른 언어로 더빙하기',
    tools: [
      { name: 'ElevenLabs', oneLine: '글을 자연스러운 목소리로 읽어 준다',
        goodAt: ['긴 내레이션', '여러 언어'],
        watchOut: ['남의 목소리를 동의 없이 복제하면 안 된다. 법에도 걸리고 윤리에도 걸린다'],
        useWhen: '영상·교육 자료의 내레이션', pricing: '부분 무료',
        official: 'https://elevenlabs.io' }
    ]
  },

  {
    id: 'docs', name: '문서·슬라이드',
    use: '보고서·발표자료 만들기',
    tools: [
      { name: 'Gamma', oneLine: '한 줄 설명에서 발표 자료 초안을 빠르게 뽑는다',
        goodAt: ['초안을 링크로 공유', '빠른 시안'],
        watchOut: ['자체 형식이라 PowerPoint로 내보내면 배치가 흐트러지기도 한다'],
        useWhen: '초안을 빨리 보여줘야 할 때', pricing: '부분 무료',
        official: 'https://gamma.app' },
      { name: 'Microsoft 365 Copilot', oneLine: '오피스 안에서 슬라이드·문서를 만든다',
        goodAt: ['PowerPoint 파일로 그대로 나온다', '기존 사내 문서와 연결'],
        watchOut: ['조직이 라이선스를 줘야 쓸 수 있다'],
        useWhen: '결과물이 반드시 .pptx 여야 할 때', pricing: '유료',
        official: 'https://microsoft.com/microsoft-365/copilot' },
      { name: 'Claude 아티팩트 + 오피스 연동', oneLine: '대화 옆에서 문서를 만들고 계속 고친다',
        goodAt: ['문단 단위로 반복 수정', '표·문서 형태로 뽑기'],
        watchOut: ['대화 옆 결과물이라 파일 관리는 따로 해야 한다'],
        useWhen: '한 문서를 여러 번 다듬을 때', pricing: '부분 무료',
        official: 'https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them' }
    ]
  },

  {
    id: 'automation', name: '업무 자동화',
    use: '반복 업무를 사람 손 없이 흐르게 만들기',
    tools: [
      { name: 'n8n', oneLine: '자기 서버에 직접 설치해 돌릴 수 있는 자동화 도구',
        goodAt: ['사내망 안에서 운영', '내부 데이터베이스 직접 연결'],
        watchOut: ['직접 설치하고 굴릴 사람이 있어야 한다',
                   '오픈소스가 아니다. 사내에서 쓰는 건 되지만 밖에 서비스로 되파는 건 라이선스가 막는다'],
        useWhen: '자료를 밖으로 내보낼 수 없을 때', pricing: '부분 무료',
        official: 'https://n8n.io' },
      { name: 'Zapier', oneLine: '클라우드에서 도는 연결 자동화. 붙는 서비스 수가 많다',
        goodAt: ['설정이 쉽다', '연결 가능한 서비스가 매우 많다'],
        watchOut: ['자체 서버에는 못 깐다. 자료가 밖을 거쳐 간다'],
        useWhen: '외부 서비스끼리 잇는 일', pricing: '부분 무료',
        official: 'https://zapier.com' },
      { name: 'Make', oneLine: '흐름을 그림으로 그려 만드는 자동화',
        goodAt: ['복잡한 분기·반복을 눈으로 보며 구성'],
        watchOut: ['흐름이 커지면 화면이 복잡해진다'],
        useWhen: '조건 분기가 많은 업무', pricing: '부분 무료',
        official: 'https://make.com' },
      { name: 'Dify', oneLine: 'AI를 쓰는 사내 앱을 빠르게 만든다. 문서 질의응답이 대표적이다',
        goodAt: ['사내 문서 기반 질의응답 만들기'],
        watchOut: ['만든 뒤 답변 품질을 계속 점검해야 한다'],
        useWhen: '사내 자료 기반 챗봇을 만들 때', pricing: '부분 무료',
        official: 'https://dify.ai' }
    ]
  },

  {
    id: 'local', name: '로컬 실행',
    use: '자료를 밖으로 보내지 않고 내 컴퓨터·사내 서버에서만 돌리기',
    tools: [
      { name: 'LM Studio Bionic', oneLine: '설치하면 화면에서 바로 쓰는 로컬 실행 앱. 지금은 문서·코드 작업을 맡기는 기능까지 붙었다',
        goodAt: ['터미널 없이 시작', '모델 골라 받기', '내 PC 안에서 문서·코드 작업'],
        watchOut: ['같은 앱에서 클라우드 모델도 고를 수 있다. 지금 로컬로 도는 중인지 매번 확인한다',
                   '장비 성능이 곧 한계다', '최상급 클라우드 모델만큼은 아니다'],
        useWhen: '대외비 문서를 다뤄야 할 때', pricing: '무료',
        official: 'https://lmstudio.ai' },
      { name: 'Ollama', oneLine: '명령 한 줄로 모델을 받아 돌리는 로컬 실행 도구',
        goodAt: ['서버에 올려 사내 공용으로', '다른 프로그램에 붙이기'],
        watchOut: ['명령줄을 쓸 줄 알아야 한다'],
        useWhen: '사내 서버에서 공용으로 돌릴 때', pricing: '무료',
        official: 'https://ollama.com' }
    ]
  }
];

/**
 * 회의 기록·요약 칸은 파일을 나눠 두었다 (500줄 규칙).
 * 카테고리를 새로 추가하려면 파일 하나 + 여기 한 줄이면 된다.
 */
export const categories = baseCategories.concat(meetingCategory);

/** 애그리게이터 설명 — 챕터 2의 "모델 vs 제품"이 여기서 한 번 더 쓰인다 */
export const AGGREGATOR_NOTE = {
  cap: '알아두면 목록이 확 줄어드는 것 — 애그리게이터',
  body: '자기 모델을 만들지 않고 여러 회사 모델을 묶어 파는 층이 있다. 영상 생성에서 두드러졌고 지금은 이미지·음성·편집까지 넓어졌다. ' +
        '예를 들어 Higgsfield는 모델이 아니라 여러 회사 엔진을 골라 쓰게 해주는 플랫폼이다. ' +
        '“AI 툴이 수백 개”라는 말의 상당 부분은 같은 모델을 다르게 포장한 것이라, ' +
        '이 구조를 알면 외울 것이 크게 줄어든다.'
};

export function categoryById(id) {
  return categories.find(c => c.id === id) || null;
}

export const toolCount = categories.reduce((n, c) => n + c.tools.length, 0);
