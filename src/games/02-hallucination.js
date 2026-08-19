// 미니게임 2 — 지어낸 답 찾기 (엔진 V 증거판)
// 배우는 것: 할루시네이션 · 근거 확인
//
// 왜 슈팅을 버렸나:
//   슈팅판의 조작은 "쏜다 / 안 쏜다" 두 값뿐이었다. 그래서 이겨도 왜 이겼는지가
//   안 남는다. 게다가 규정 원문이 옆에 떠 있으니 **낱말 대조**로 풀린다 —
//   "이월" 은 원문에 없다, 끝. 정작 배워야 할 것이 안 나온다.
//
// 여기서는 문장마다 **어디에 걸리는지를 대야 한다.** 걸 곳이 없으면 없다고
// 직접 표시해야 하고, 그럴듯한 조항에 잘못 걸면 그것도 틀린 것으로 잡힌다.
// 낱말 대조로는 두 문장에서 반드시 진다:
//   - 4번 문장은 규정과 같은 낱말(신청·승인)을 쓰지만 근거는 없다
//   - 3번 문장은 규정과 낱말이 거의 안 겹치지만 근거는 있다
//
// 말투가 함정이다. **가장 자신 있고 숫자까지 붙은 문장 셋이 전부 무근거**이고,
// 근거가 있는 문장 하나는 일부러 애매하게 써 두었다. 그래서 "자신 있게
// 쓰였으니 맞겠지" 가 끝에 가서 무너진다.
//
// 근거 문서는 가상의 사내 규정이다. 실재하는 회사·시스템을 가리키지 않는다.

import { Run, applyFault, applyGain } from '../core/sim.js';
import { judge, KIND } from '../core/evidence.js';

export default {
  id: 'hallucination',
  engine: 'V',
  title: '지어낸 답 찾기',
  subtitle: '문장마다 근거를 찾아 선으로 잇는다',
  chapter: 1,
  required: true,
  concept: ['할루시네이션'],
  checkedAt: '2026-08',

  data: {
    askCap: '돌아온 답변',
    ask: 'AI에게 연차 규정을 물었더니 답변 문장 7개가 돌아왔다.',

    runCaption: '표시한 대로 이 답변을 보고서에 쓴다면',

    labels: {
      lines: 'AI 답변',
      spans: '사내 규정 발췌',
      none: '무근거',
      noneMark: '×',
      noneHint: '규정 어디에도 걸 곳이 없다',
      meter: '표시한 문장',
      hold: '전부 표시해야 결과가 나온다',
      reset: '표시 지우기',
      run: '이대로 보고하기',
      hint: '문장을 누르고, 그 문장의 근거가 되는 조항을 누른다.',
      hintArmed: '걸 자리를 누른다. 같은 문장을 다시 누르면 놓는다.',
      statusLeft: '남은 문장',
      statusFull: '문장 7개를 전부 표시했다',
      sheet: '어디에 걸렸어야 했나',
      blank: '표시 없음',
      aria: '아직 걸 자리를 정하지 않았다.',
      sayPick: '번 문장을 집었다. 걸 자리를 누른다.',
      sayLink: '조항에 이었다.',
      sayCut: '번 문장의 선을 끊었다.',
      sayDrop: '놓았다.',
      sayNeedLine: '문장을 먼저 누른다.'
    },

    // 근거 문서 — 이 안에 있는 것만 사실이다. 마지막 조항은 아무 문장도 뒷받침하지
    // 않는다. 걸 데가 마땅치 않은 문장을 여기에 억지로 거는 것을 잡으려고 둔다.
    spans: [
      { id: 's1', mark: '가',
        text: '제12조 (발생) 입사 1년 미만 직원은 매달 1일의 연차가 생긴다.' },
      { id: 's2', mark: '나',
        text: '제13조 (기한) 연차는 생긴 날부터 1년 안에 쓴다.' },
      { id: 's3', mark: '다',
        text: '제14조 (신청) 연차는 쓰기 3일 전까지 신청한다.' },
      { id: 's4', mark: '라',
        text: '제15조 (확정) 부서장이 승인하면 확정된다.' },
      { id: 's5', mark: '마',
        text: '제16조 (보관) 연차 사용 기록은 인사 담당자가 보관한다.' }
    ],

    // tone 은 판정에 안 쓴다. 함정이 데이터에 실제로 들어 있는지 세는 데만 쓴다
    // (core/evidence.js 의 toneTrap). 화면에도 안 나온다 — 나오면 답이 샌다.
    //   sure  자신 있고 숫자까지 붙은 말투
    //   vague 애매해서 믿음이 안 가는 말투
    lines: [
      { id: 'l1', src: 's1', tone: 'plain',
        text: '입사 1년이 안 된 직원은 매달 1일씩 연차가 생깁니다.',
        why: '발생 조항이 매달 1일을 그대로 적고 있다.' },

      { id: 'l2', src: null, tone: 'sure',
        text: '미사용 연차는 다음 해로 최대 5일까지 이월되고, 이월분은 3월 31일까지 써야 합니다.',
        why: '이월 얘기는 규정에 한 번도 안 나온다. 숫자가 셋이나 붙어 제일 확실해 보였는데 근거는 하나도 없다.' },

      { id: 'l3', src: 's3', tone: 'vague',
        text: '신청은 쓰기 며칠 전까지 미리 해 두어야 하는 것으로 알고 있습니다.',
        why: '애매하게 쓰였을 뿐 신청 조항이 그대로 뒷받침한다. 말투와 근거는 따로 논다.' },

      { id: 'l4', src: null, tone: 'sure',
        text: '신청서를 올리면 평균 1.5일 안에 승인이 납니다.',
        why: '승인에 며칠 걸리는지는 규정에 없다. 낱말이 겹쳐 확정 조항에 걸기 쉬운데, 그 조항은 날짜를 한마디도 안 한다.' },

      { id: 'l5', src: 's2', tone: 'plain',
        text: '연차는 생긴 날부터 1년 안에 써야 합니다.',
        why: '기한 조항이 1년을 그대로 적고 있다.' },

      { id: 'l6', src: null, tone: 'sure',
        text: '연차는 오전 9시부터 오후 1시, 오후 1시부터 6시까지 반나절로 나뉩니다.',
        why: '반나절로 나눠 쓴다는 말은 규정에 없다. 묻지도 않은 것을 시간까지 붙여 덧붙였다. 이게 환각이다.' },

      { id: 'l7', src: 's4', tone: 'plain',
        text: '부서장이 승인하면 연차가 확정됩니다.',
        why: '확정 조항이 부서장 승인을 그대로 적고 있다.' }
    ]
  },

  /**
   * setup = { marks, lines, spans }
   *   marks  문장 id → 구간 id 또는 'none'
   *
   * 잇기 규칙은 core/evidence.js 가 판단한다 — 엔진이 마지막 화면을 그릴 때
   * 쓰는 것과 **같은 함수**다. 둘이 어긋나면 화면과 점수가 다른 말을 한다.
   */
  simulate(setup, d) {
    const r = new Run();
    const rows = judge(d.lines, setup.marks);
    const mistakes = [];
    const textOf = (id) => (d.lines.find(l => l.id === id) || {}).text || '';
    const whyOf = (id) => (d.lines.find(l => l.id === id) || {}).why || '';

    r.read('규정 원문과 답변을 나란히 놓는다');

    for (const row of rows) {
      const t = short(textOf(row.id));
      switch (row.kind) {
        case KIND.LINK_OK:    r.ok(`제자리 — ${t}`); break;
        case KIND.NONE_OK:    r.ok(`걸러냄 — ${t}`); break;
        case KIND.LINK_NONE:  r.fail(`근거 없이 인정 — ${t}`); break;
        case KIND.LINK_WRONG: r.warn(`엉뚱한 조항 — ${t}`); break;
        case KIND.NONE_MISS:  r.warn(`규정에 있는데 지움 — ${t}`); break;
        default:              r.warn(`표시 안 함 — ${t}`);
      }
      if (!row.ok) mistakes.push({ itemId: row.id, hint: whyOf(row.id) });
    }

    // 무근거 문장을 어딘가에 걸어 준 것 — 지어낸 문장을 사실로 인정한 것이다
    const passed = rows.filter(x => x.kind === KIND.LINK_NONE).length;
    for (let i = 0; i < passed; i++) applyFault(r, 'halluc', 26);

    for (const row of rows) {
      if (row.kind === KIND.LINK_WRONG) {
        r.fault('엉뚱한 근거', '그 조항은 이 문장을 뒷받침하지 않는다', 18);
      } else if (row.kind === KIND.NONE_MISS) {
        r.fault('근거를 놓침', '규정에 있는 내용을 걸 곳 없다고 지웠다', 18);
      } else if (row.kind === KIND.BLANK) {
        r.fault('표시 안 함', '근거를 대지 않은 문장이 그대로 남았다', 18);
      }
    }

    const right = rows.filter(x => x.ok).length;
    const wrong = rows.length - right;

    if (!wrong) {
      applyGain(r, 'grounded', 10);
      r.gain('환각 판별', '말투가 아니라 근거로 판단했다', 5);
    } else if (right) {
      r.gain('근거 확인', `${right}건은 걸 자리를 제대로 찾았다`, 4);
    }

    r.out(passed
      ? `근거 없는 문장 ${passed}건이 보고서에 그대로 남는다`
      : wrong
        ? '지어낸 문장은 다 잡았지만 근거 자리가 어긋났다'
        : `문장 ${rows.length}건이 전부 제 근거에 걸렸다`);

    return r.finish({ pass: 88, partial: 52 }, { mistakes });
  },

  named: {
    all: 'AI가 근거도 없이 사실인 양 말한다. 이게 **할루시네이션**(환각)이다. ' +
         '근거를 대라고 하면 지어낸 문장은 걸 곳이 없다. 방금 그 자리를 하나씩 찾아봤다.'
  },

  debrief: {
    pass: '제일 자신 있고 숫자까지 붙은 문장이 하나도 걸리지 않았다.\n애매해서 못 믿을 것 같던 문장은 오히려 규정에 그대로 있었다.\n말투는 근거가 아니다. 근거가 어디 있냐고 되묻는 습관 하나면 대부분 걸러진다.',
    partial: '몇 문장은 제자리를 찾았지만 몇 문장은 어긋났다.\n있을 법한 것과 규정에 적힌 것은 다르다. 그럴듯하다고 근거가 되진 않는다.\n근거 있는 문장을 지웠다면 반대쪽 실수다. 의심만으로는 판단이 안 된다.',
    fail: '문장이 매끄러우면 사실처럼 읽힌다. 그래서 환각이 무섭다.\n답부터 읽지 말자. 규정을 먼저 읽고 나서 문장마다 걸 자리를 찾으면 된다.\n이월, 반나절, 평균 며칠은 규정 어디에도 없다.'
  }
};

/** 로그 한 줄에 문장 전체를 넣으면 읽히지 않는다 */
function short(text) {
  const s = String(text).replace(/[.]$/, '');
  return s.length > 18 ? s.slice(0, 17) + '…' : s;
}
