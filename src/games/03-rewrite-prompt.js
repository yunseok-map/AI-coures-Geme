// 미니게임 3 — 지시문 고쳐쓰기 (엔진 E 미리보기형)
// 배우는 것: 프롬프트 엔지니어링의 4요소 (역할 · 맥락 · 형식 · 예시)
//
// 설계 의도: "프롬프트를 잘 쓰라"는 조언은 아무것도 바꾸지 못한다.
// 항목을 하나 켤 때마다 오른쪽 결과물이 그 자리에서 다시 쓰이는 걸 봐야
// "아, 내가 안 알려줘서 저렇게 나온 거였구나"가 온다.
//
// LLM 호출은 없다. 켠 조합에 따라 미리 써 둔 조각을 규칙대로 이어 붙인다.

import { Run, applyGain } from '../core/sim.js';

const BASE = '지난달 팀 실적 정리해줘.';

export default {
  id: 'rewrite-prompt',
  engine: 'E',
  title: '지시문 고쳐쓰기',
  subtitle: '항목을 켜면 오른쪽 결과가 바로 다시 쓰인다',
  chapter: 1,
  required: true,
  concept: ['프롬프트 엔지니어링', '시스템 프롬프트'],
  checkedAt: '2026-08',

  data: {
    outCap: 'AI가 내놓는 결과',
    trayLabel: '지시문에 넣을 것 — 켜면 오른쪽이 바로 바뀐다',
    runLabel: '이대로 보내기',
    runCaption: '완성된 지시로 일을 시킨다',

    toggles: [
      { id: 'role',    label: '역할', tag: '누가',
        desc: '누구의 입장에서 볼 것인가' },
      { id: 'context', label: '맥락', tag: '무엇을',
        desc: '어떤 자료를, 누구에게, 왜' },
      { id: 'format',  label: '형식', tag: '어떻게',
        desc: '몇 줄, 어떤 구조로' },
      { id: 'example', label: '예시', tag: '이렇게',
        desc: '원하는 결과를 한 줄 보여준다' }
    ]
  },

  render(active) {
    const on = id => active.includes(id);

    // ---- 왼쪽: 지시문이 조립된다 ----
    const lines = [];
    if (on('role')) lines.push('너는 우리 팀 실적을 팀장에게 보고하는 담당자다.');
    lines.push(BASE);
    if (on('context')) lines.push('자료는 첨부한 월간 매출표와 영업일지다. 읽는 사람은 팀장이고, 다음 달 목표를 정하는 데 쓴다.');
    if (on('format')) lines.push('형식: 잘된 점 / 부진한 점 / 다음 달 제안, 각 2줄 이내.');
    if (on('example')) lines.push('예시) 잘된 점: A제품 매출 12% 증가 — 신규 채널 3곳 확보가 원인.');

    // ---- 오른쪽: 결과가 달라진다 ----
    let out;
    if (!on('role') && !on('context') && !on('format') && !on('example')) {
      out = '지난달 팀 실적은 전반적으로 무난한 흐름을 보였습니다. ' +
            '일부 항목에서 개선이 있었고, 일부는 추가적인 노력이 필요해 보입니다. ' +
            '지속적인 관리가 중요합니다.';
    } else {
      const parts = [];

      if (on('role')) {
        parts.push(on('context')
          ? '<em>[팀장 보고용]</em> 지난달 실적을 보고드립니다.'
          : '<em>[보고 담당자 관점]</em> 지난달 실적을 정리했습니다.');
      }

      const body = on('context')
        ? [
            '잘된 점: A제품 매출 12% 증가. 신규 채널 3곳 확보가 원인.',
            '부진한 점: B제품 재구매율 4%p 하락. 납기 지연 6건과 시점이 겹침.',
            '다음 달 제안: 납기 SLA 재점검, A제품 채널 2곳 추가 검토.'
          ]
        : [
            '매출은 일부 품목에서 늘고 일부는 줄었습니다.',
            '원인은 자료가 없어 특정하기 어렵습니다.',
            '다음 달에는 개선이 필요해 보입니다.'
          ];

      if (on('format')) {
        parts.push(body.map(l => '· ' + l).join('\n'));
      } else {
        parts.push(body.join(' '));
      }

      if (on('example') && on('context')) {
        parts.push('<em>(각 줄이 “결과 — 원인” 형태로 맞춰졌다)</em>');
      } else if (on('example')) {
        parts.push('<em>(형식은 흉내 냈지만 채울 숫자가 없다)</em>');
      }

      out = parts.join('\n\n');
    }

    const count = ['role', 'context', 'format', 'example'].filter(on).length;
    return {
      prompt: lines.join('\n'),
      output: out,
      say: `${count}개 항목이 켜졌습니다. 결과가 바뀌었습니다.`
    };
  },

  simulate(active) {
    const on = id => active.includes(id);
    const r = new Run();
    const count = ['role', 'context', 'format', 'example'].filter(on).length;

    r.read(`지시문을 읽는다 — 넣은 항목 ${count}개`);

    if (on('role')) r.do('보고 담당자 입장에서 관점을 잡는다');
    else { r.warn('누구 입장에서 쓸지 정해지지 않았다'); r.score -= 12; }

    if (on('context')) {
      r.read('첨부된 매출표와 영업일지를 읽는다');
      r.ok('숫자와 원인을 짝지었다');
    } else {
      r.warn('볼 자료가 지정되지 않았다');
      r.fault('맥락 없음', '자료도 읽는 사람도 모르면 일반론밖에 나오지 않는다', 25);
    }

    if (on('format')) r.do('잘된 점 / 부진한 점 / 제안 세 덩어리로 나눈다');
    else { r.warn('구조가 없어 한 문단으로 이어 쓴다'); r.score -= 12; }

    if (on('example')) {
      if (on('context')) { r.do('예시와 같은 “결과 — 원인” 형태로 맞춘다'); applyGain(r, 'lean', 8); }
      else { r.warn('예시 형태는 따라 했지만 채울 내용이 없다'); r.score -= 5; }
    } else {
      r.score -= 8;
    }

    if (count === 4) {
      r.gain('프롬프트 엔지니어링', '역할·맥락·형식·예시 네 가지를 모두 넣었다', 10);
    }

    r.out(count >= 3 && on('context')
      ? '보고 초안 완성 — 각 줄에 숫자와 원인이 붙어 있다'
      : '보고 초안 — 읽고 나서 할 일이 정해지지 않는다');

    return r.finish({ pass: 85, partial: 55 });
  },

  named: {
    all: '방금 켠 네 가지가 **프롬프트 엔지니어링**의 4요소다 — 역할 · 맥락 · 형식 · 예시. ' +
         '이 중 결과를 가장 많이 바꾸는 건 맥락이다. 나머지 셋을 다 넣어도 볼 자료가 없으면 일반론이 나온다. ' +
         '맨 위에 켠 “역할”을 매번 쓰지 않고 대화 시작 전에 붙박이로 걸어 두면, 그것이 **시스템 프롬프트**다.'
  },

  debrief: {
    pass: '네 가지를 다 넣었더니 “무난했습니다” 같은 문장이 사라졌다.\n특히 맥락(어떤 자료를, 누구에게, 왜)이 없으면 나머지를 아무리 다듬어도 일반론이 나온다.\n프롬프트를 잘 쓴다는 건 주문을 외우는 게 아니라 맥락을 빠짐없이 주는 일이다.',
    partial: '몇 개는 켰다. 어느 항목을 켰을 때 결과가 가장 크게 바뀌었는지 다시 보라.\n대개 맥락 하나가 나머지 셋을 합친 것보다 크게 바꾼다.\n형식과 예시는 맥락이 있어야 효과가 난다.',
    fail: '아무것도 안 넣었을 때의 결과를 다시 읽어 보라 — 틀린 말은 하나도 없는데 쓸 데가 없다.\n그게 “지시를 안 줘서 나온 결과”다. AI가 못한 게 아니다.\n항목을 하나씩 켜면서 오른쪽이 어떻게 달라지는지 보라.'
  }
};
