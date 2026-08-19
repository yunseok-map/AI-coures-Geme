// 미니게임 3 — 지시문 고쳐쓰기 (엔진 E 미리보기형)
// 배우는 것: 프롬프트 엔지니어링 · 시스템 프롬프트
//
// 설계 의도: 예전 판은 블록을 켤수록 점수가 올라갔다. 그래서 "전부 켜기"가 늘 정답이었고,
// 고민할 것이 없었다. 그 판은 "많이 넣으면 좋다"는 오해를 오히려 굳혔다.
//
// 지금 판은 이렇다.
//   ① 목표 결과물(팀장 책상에 올라가야 하는 네 줄)이 **먼저** 주어진다.
//   ② 블록을 켜고 끄면 결과가 그 자리에서 다시 쓰인다 — 새로 생긴 줄 · 달라진 줄 · 사라진 줄.
//   ③ 점수는 정답 조합을 맞혔는가가 아니라 **만들어진 줄이 목표 줄과 얼마나 겹치는가**다.
//   그리고 형식("항목별로 나눠")과 제약("한 문단으로 짧게")은 **서로의 효과를 지운다.**
//      둘 다 켜면 항목은 나뉘지만 각 줄에서 원인이 잘려 나가 목표에서 멀어진다.
//
// 그래서 전부 켠 조합은 최고점이 아니다. 이게 이 판이 깨려는 오해 그 자체다.
//
// LLM 호출은 없다. compose() 가 규칙대로 미리 써 둔 줄을 고를 뿐이고,
// compose · distance 는 DOM 을 안 쓰는 순수 함수라 Node 로 그대로 검사할 수 있다.

import { Run, applyFault, applyGain } from '../core/sim.js';

const data = {
  goalCap: '목표 결과물 — 팀장 책상에 올라가야 하는 보고',
  goalNote: '이 네 줄에 얼마나 가까운지가 점수다',
  outCap: 'AI가 내놓는 결과',
  trayLabel: '지시문에 넣을 블록 — 켜면 오른쪽이 그 자리에서 다시 쓰인다',
  runLabel: '이대로 보내기',
  runCaption: '완성된 지시로 일을 시킨다',

  /** 목표 결과물. lines 의 열쇠말로 적는다 — 결과 줄과 같은 글이라야 겹침을 셀 수 있다. */
  goal: ['head', 'good', 'bad', 'next'],

  /** 서로 반대로 시키는 블록 한 쌍. 둘 다 켜지면 화면에서 부딪히는 표시가 난다. */
  clash: ['format', 'brief'],

  /** 지시문에 붙는 줄 */
  asks: {
    base:    '지난달 팀 실적 정리해줘.',
    role:    '너는 지난달 실적을 팀장에게 보고하는 담당자다.',
    context: '자료는 첨부한 월간 매출표와 영업일지다. 읽는 사람은 팀장이고, 다음 달 목표를 정하는 데 쓴다.',
    format:  '잘된 점 / 부진한 점 / 다음 달 제안으로 나눠 쓴다.',
    brief:   '한 문단으로 짧게, 세 줄 안에 끝낸다.',
    example: '예시) 잘된 점: A제품 매출 12% 증가 — 신규 채널 3곳 확보가 원인.'
  },

  /** AI 가 내놓을 수 있는 줄 전부. 목표에 든 것은 head · good · bad · next 넷이다. */
  lines: {
    head:      '지난달 실적을 보고드립니다. 다음 달 목표를 정하는 데 쓰실 자료입니다.',
    good:      '잘된 점: A제품 매출 12% 증가 — 신규 채널 3곳 확보가 원인.',
    bad:       '부진한 점: B제품 재구매율 4%p 하락 — 납기 지연 6건과 시점이 겹친다.',
    next:      '다음 달 제안: 납기 기준 재점검, A제품 채널 2곳 추가 검토.',

    headThin:  '지난달 실적을 정리했습니다.',

    // 예시가 없으면 숫자가 흐려지고, 짧게 쓰라고 하면 원인이 잘린다.
    // 목표 줄과 한 글자라도 다르면 그건 목표에 못 닿은 줄이다.
    goodThin:  '잘된 점: A제품 매출이 늘었습니다.',
    badThin:   '부진한 점: B제품 재구매율이 떨어졌습니다.',
    goodBrief: '잘된 점: 매출이 늘었습니다.',
    badBrief:  '부진한 점: 재구매율이 떨어졌습니다.',
    goodCut:   '잘된 점: A제품 매출 12% 증가.',
    badCut:    '부진한 점: B제품 재구매율 4%p 하락.',

    merged:    '잘된 점은 A제품 매출이 12% 늘었고 부진한 점은 B제품 재구매율이 떨어졌으며 다음 달에는 납기를 다시 보겠습니다.',
    mergedWhy: '잘된 점은 A제품 매출 12% 증가로 신규 채널 3곳 확보가 원인이고, 부진한 점은 B제품 재구매율 4%p 하락으로 납기 지연 6건과 시점이 겹친다.',
    briefPara: 'A제품은 늘고 B제품은 줄었습니다. 다음 달에 납기를 다시 보겠습니다.',
    briefShape:'A제품 매출 12% 증가, B제품 재구매율 4%p 하락. 다음 달에 납기를 다시 보겠습니다.',

    vagueGood: '매출은 일부 품목에서 늘고 일부는 줄었습니다.',
    vagueBad:  '원인은 줄 자료가 없어 특정하기 어렵습니다.',
    vagueNext: '다음 달에는 개선이 필요해 보입니다.',
    vaguePara: '지난달 팀 실적은 전반적으로 무난한 흐름을 보였습니다. 일부는 나아졌고 일부는 더 노력이 필요해 보입니다.',
    vagueBrief:'지난달 실적은 무난했습니다. 앞으로도 꾸준한 관리가 중요합니다.'
  },

  toggles: [
    { id: 'role',    label: '역할', tag: '누가',
      desc: '누구의 입장에서 쓸 것인가' },
    { id: 'context', label: '맥락', tag: '무엇을',
      desc: '어떤 자료를, 누구에게, 왜' },
    { id: 'format',  label: '형식', tag: '어떻게',
      desc: '잘된 점 / 부진한 점 / 제안으로 나눈다' },
    { id: 'brief',   label: '제약', tag: '얼마나',
      desc: '한 문단으로 짧게, 세 줄 안에' },
    { id: 'example', label: '예시', tag: '이렇게',
      desc: '원하는 줄을 하나 보여준다' }
  ]
};

// ---------------------------------------------------------------- 순수 함수 두 개
//
// 화면 없이 결과물을 만들고, 화면 없이 목표와의 거리를 잰다.
// 이 둘이 순수해야 "전부 켜면 나빠진다"를 Node 로 증명할 수 있다.

/**
 * 켠 블록으로 결과물을 만든다.
 *
 * 줄마다 `slot` 이 있다 — 같은 자리에 다른 글이 오면 "달라진 줄",
 * 자리가 새로 생기면 "새로 생긴 줄", 자리가 없어지면 "사라진 줄"이다.
 *
 * @param {string[]} active  켠 블록 id 목록
 * @returns {Array<{slot:string, id:string, text:string}>}
 */
export function compose(active, d = data) {
  const on = id => active.includes(id);
  const L = d.lines;
  const out = [];
  const put = (slot, id) => out.push({ slot, id, text: L[id] });

  // 머리말 — 역할이 있어야 나오고, 맥락이 있어야 "누구에게 왜"까지 적힌다
  if (on('role')) put('head', on('context') ? 'head' : 'headThin');

  const rich = on('context');
  const ex = on('example');
  const br = on('brief');

  if (on('format')) {
    if (rich) {
      // 예시가 있어야 "결과 — 원인" 형태가 되는데, 짧게 쓰라는 제약이 뒷부분을 잘라낸다.
      // 이 한 줄이 충돌 쌍의 전부다 — 둘 다 켜면 목표 줄에 못 닿는다.
      const k = ex ? (br ? 'Cut' : '') : (br ? 'Brief' : 'Thin');
      put('good', 'good' + k);
      put('bad',  'bad' + k);
      put('next', 'next');
    } else {
      // 맥락이 없으면 무엇을 더 붙여도 일반론이다 — 붙일 자리가 없다
      put('good', 'vagueGood');
      put('bad',  'vagueBad');
      put('next', 'vagueNext');
    }
  } else {
    // 형식을 안 주면 세 항목이 한 덩어리로 뭉친다
    put('para', rich ? (ex ? (br ? 'briefShape' : 'mergedWhy') : (br ? 'briefPara' : 'merged'))
                     : (br ? 'vagueBrief' : 'vaguePara'));
  }
  return out;
}

/**
 * 목표와의 거리.
 *
 * 정답 조합을 맞혔는지 보지 않는다. **만들어진 줄이 목표 줄과 겹치는지**만 본다.
 * 목표에 있어야 하는데 안 나온 줄이 비싸고(15), 목표에 없는 줄이 낀 것도 값을 치른다(5).
 */
export function distance(active, d = data) {
  const made = compose(active, d);
  const goal = d.goal;
  const madeIds = new Set(made.map(l => l.id));

  const missing = goal.filter(id => !madeIds.has(id));
  const extra = made.filter(l => !goal.includes(l.id)).map(l => l.id);
  for (const l of made) l.hit = goal.includes(l.id);

  return {
    made, missing, extra,
    hit: goal.length - missing.length,
    total: goal.length,
    score: Math.max(0, 100 - missing.length * 15 - extra.length * 5)
  };
}

/** 충돌 쌍이 둘 다 켜졌는가 */
export function clashing(active, d = data) {
  return (d.clash || []).every(id => active.includes(id));
}

// ----------------------------------------------------------------

export default {
  id: 'rewrite-prompt',
  engine: 'E',
  title: '지시문 고쳐쓰기',
  subtitle: '목표 결과물이 먼저 있다. 블록을 켜고 끄며 그 네 줄에 다가간다',
  chapter: 1,
  required: true,
  concept: ['프롬프트 엔지니어링', '시스템 프롬프트'],
  checkedAt: '2026-08',

  data,

  render(active, d = data) {
    const on = id => active.includes(id);
    const A = d.asks;

    const prompt = [];
    const ask = (slot, key) => prompt.push({ slot, id: key, text: A[key] });
    if (on('role')) ask('role', 'role');
    ask('base', 'base');
    if (on('context')) ask('context', 'context');
    if (on('format')) ask('format', 'format');
    if (on('brief')) ask('brief', 'brief');
    if (on('example')) ask('example', 'example');

    const res = distance(active, d);
    return {
      prompt,
      output: res.made,
      hit: res.hit,
      total: res.total,
      clash: clashing(active, d),
      say: `목표 ${res.total}줄 중 ${res.hit}줄이 맞았다.`
    };
  },

  simulate(active, d = data) {
    const on = id => active.includes(id);
    const res = distance(active, d);
    const clash = clashing(active, d);
    const r = new Run();

    r.read(`목표를 다시 본다 — 팀장에게 갈 ${res.total}줄`);
    r.read(`지시문을 읽는다 — 켠 블록 ${active.length}개`);

    if (on('role')) r.do('보고 담당자 입장을 잡는다');
    else r.warn('누구 입장에서 쓸지 정해지지 않았다');

    if (on('context')) {
      r.read('첨부한 월간 매출표와 영업일지를 읽는다');
      r.ok('숫자마다 원인을 짝지었다');
    } else {
      r.warn('볼 자료도 읽는 사람도 안 정해 줬다');
      applyFault(r, 'slop', 0);
    }

    if (clash) {
      r.warn('짧게 쓰라는 지시와 항목별로 나누라는 지시가 서로 충돌한다');
      r.fail('항목은 나누었지만 각 줄에서 원인이 잘려 나갔다');
      r.fault('지시 충돌', '서로 반대로 시키는 블록을 같이 켜서 결과가 어정쩡해졌다', 0);
    } else if (on('format')) {
      r.do('잘된 점 / 부진한 점 / 다음 달 제안으로 나눈다');
    } else if (on('brief')) {
      r.warn('한 문단으로 줄이느라 세 항목이 한 덩어리로 이어졌다');
    } else {
      r.warn('구조를 안 줘서 한 문단으로 이어 쓴다');
    }

    if (on('example')) {
      if (!on('context')) r.warn('예시 형태는 따라 했지만 채울 숫자가 없다');
      else if (clash) { /* 부딪힌 결과는 바로 위에서 이미 말했다 */ }
      else if (on('brief')) r.warn('짧게 쓰느라 예시가 보여준 원인 부분이 잘렸다');
      else r.do('예시와 같은 “결과 — 원인” 형태로 맞춘다');
    }

    // 점수는 등급 계산에 쓰이기 전에 목표와의 거리로 덮어쓴다.
    // 위의 fault 들은 값을 깎지 않는다(cost 0) — 깎는 것은 거리 하나뿐이다.
    r.score = res.score;

    if (res.missing.length === 0) {
      r.gain('프롬프트 엔지니어링', '켠 블록이 하나 적은데 결과는 목표에 더 가까워졌다', 0);
    }
    if (on('format') && !clash && on('context')) {
      applyGain(r, 'lean', 0);
    }

    r.out(`목표 ${res.total}줄 중 ${res.hit}줄이 맞았다`);

    return r.finish({ pass: 88, partial: 50 });
  },

  named: {
    all: '방금 켠 것이 **프롬프트 엔지니어링**의 재료다 — 역할 · 맥락 · 형식 · 예시 · 제약. ' +
         '다만 “한 문단으로 짧게”와 “항목별로 나눠”는 서로의 효과를 지운다. 다 켜면 목표에서 되레 멀어진다. ' +
         '역할 줄을 매번 쓰지 말고 대화 앞에 붙박이로 걸어 둘 수 있다. 그게 **시스템 프롬프트**다.'
  },

  debrief: {
    pass: '목표 네 줄을 그대로 맞췄다. 켠 것은 넷이고 끈 것이 하나다.\n짧게 쓰라는 제약을 끄는 순간 각 줄에 원인이 다시 붙었다.\n잘 쓴 지시는 많이 넣은 지시가 아니라 서로 충돌하지 않는 지시다.',
    partial: '블록을 켜고 끌 때 목표와의 거리가 어느 쪽으로 움직였는지 다시 보자.\n형식과 제약을 같이 켜면 항목은 나뉘지만 각 줄에서 원인이 잘려 나간다.\n하나를 더 켜기 전에 지금 켠 것과 충돌하지 않는지부터 본다.',
    fail: '맥락을 안 준 결과를 다시 읽어 보자. 틀린 말은 없는데 쓸 데가 없다.\n어떤 자료를 누구에게 왜 주는지가 빠지면 나머지를 아무리 다듬어도 일반론이 나온다.\n블록을 하나씩 켜면서 오른쪽 줄이 목표에 가까워지는지 멀어지는지 보면 된다.'
  }
};
