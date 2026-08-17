// 미니게임 6 — 모델이냐 제품이냐 (엔진 A 분류형 / rapid 모드)
// 배우는 것: 모델 · 제품 · 표면
//
// 리듬을 일부러 빠르게 잡았다. 이 구분은 고민해서 푸는 문제가 아니라
// 몸에 붙여야 하는 기준이라, 연속으로 던져 넣는 편이 낫다.
// 내용은 전부 공식 문서 검증본 (data/products.js 와 같은 출처).

export default {
  id: 'model-or-product',
  engine: 'A',
  mode: 'rapid',
  title: '모델이냐 제품이냐',
  subtitle: '이름을 보고 두 통 중 하나에 빠르게 던져 넣는다',
  chapter: 2,
  required: true,
  concept: ['모델', '제품', '표면'],
  checkedAt: '2026-08',

  data: {
    bins: [
      { id: 'model',   label: '모델 (엔진)',
        hint: '사람이 직접 쓰지 않는다. 제품 안에 들어간다' },
      { id: 'product', label: '제품 (도구)',
        hint: '사람이 켜서 쓴다. 모델을 감싸고 있다' }
    ],

    cards: [
      { id: 'm1', bin: 'model', text: 'Claude Opus',
        why: '모델 계열 이름이다. 이 이름으로 켜는 앱은 없다.' },
      { id: 'p1', bin: 'product', text: 'ChatGPT',
        why: '제품이다. 그 안에서 도는 모델이 GPT 계열이다. 가장 흔한 혼동이 바로 이것.' },
      { id: 'm2', bin: 'model', text: 'GPT-5 계열',
        why: '모델이다. 제품 이름 ChatGPT 와 헷갈리기 쉽다.' },
      { id: 'p2', bin: 'product', text: 'Claude Code',
        why: '제품이다. 공식 정의는 “코드베이스를 읽고 파일을 고치는 에이전틱 코딩 도구”.' },
      { id: 'm3', bin: 'model', text: 'Claude Sonnet',
        why: '모델이다. 같은 Sonnet 이 웹·앱·터미널 어디서나 똑같이 돈다.' },
      { id: 'p3', bin: 'product', text: 'Cowork',
        why: '제품이다. Claude Code 와 같은 기술을 쓰되 비개발자의 사무 업무용으로 나왔다.' },
      { id: 'p4', bin: 'product', text: 'Codex',
        why: '지금의 Codex 는 제품(에이전트)이다. 2021년의 Codex 는 모델이었고 2023년에 폐기됐다.' },
      { id: 'm4', bin: 'model', text: 'Gemini (모델 쪽)',
        why: '모델이다. 같은 이름의 앱도 있어서 특히 헷갈린다 — 이름이 같아도 층이 다르다.' },
      { id: 'p5', bin: 'product', text: 'Gemini 앱',
        why: '제품이다. 바로 앞의 “Gemini 모델”과 이름만 같다.' },
      { id: 'p6', bin: 'product', text: 'Claude.ai',
        why: '제품이다. 프로젝트와 아티팩트가 이 안에 들어 있다.' },
      { id: 'p7', bin: 'product', text: 'Cursor',
        why: '제품이다. 자기 모델을 만들지 않고 여러 회사 모델을 골라 쓴다.' },
      { id: 'p8', bin: 'product', text: 'Microsoft Copilot',
        why: '제품이다. 안에서 도는 모델은 따로 있다.' }
    ],

    pass: { minCorrect: 10 }
  },

  named: {
    all: '엔진이 **모델**, 그 엔진으로 만든 도구가 **제품**, 같은 제품을 쓰는 여러 창구가 **표면**이다. ' +
         '공식 문서의 한 문장이 이 관계를 정확히 말한다 — “Claude Code 가 하네스이고, Claude 는 그 안에 든 모델이다.”'
  },

  debrief: {
    pass: '이 구분이 되면 “AI 도구가 수백 개”라는 혼란이 크게 줄어든다.\n상당수는 같은 모델을 다르게 포장한 제품이기 때문이다.\n다음에 새 도구 이름을 들으면 “모델인가 제품인가”부터 물어보면 된다.',
    partial: '이름만 보면 헷갈리는 게 정상이다. 기준은 하나다 — 내가 켜서 쓸 수 있으면 제품, 그 안에 들어 있으면 모델.\nGemini 처럼 같은 이름이 양쪽에 있는 경우가 특히 함정이다.\n한 번 더 하면 대부분 잡힌다.',
    fail: '“ChatGPT = 모델”이라고 생각했다면 그게 가장 흔한 오해다.\n똑똑한 건 모델이고, 그 모델이 파일을 읽고 도구를 부르게 만드는 껍데기가 제품이다.\n통 설명을 다시 읽고 해보라.'
  }
};
