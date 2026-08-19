// 미니게임 14 — 결재 반려 (엔진 H 검토 라인형)
// 배우는 것: 워크슬롭 · AI 슬롭 · 검증 부채 · AI 번아웃
//
// 설계 의도: 워크슬롭의 정의는 "그럴듯한데 알맹이가 없는 것"이다.
// 정의를 읽는 것과, 시간에 쫓기며 실제로 걸러내 보는 것은 다르다.
// 시간 압박을 일부러 넣었다 — 워크슬롭이 통과되는 이유가 바로 그것이기 때문이다.
//
// 왜 검토 라인인가: 체크박스 + 전체 제한시간일 때는 6건을 한눈에 훑어보고
// 천천히 고를 수 있었다. 그러면 "바빠서 통과시킨다"가 재현되지 않는다.
// 서류가 창구를 하나씩 지나가고 **안 찍으면 그대로 통과되는** 형태여야
// 워크슬롭이 통과되는 실제 경로가 그대로 재현된다.
// 승인 버튼과 반려 버튼이 나란히 있는 것도 의도다 — 승인도 행동이고 책임이다.
//
// --- 왜 3라운드인가 (이번에 고친 부분)
// 예전 판은 한 라운드로 끝났다. 그래서 통과시킨 워크슬롭의 대가가 그 자리에서
// 점수로만 끝났고, 이 판이 가르치려는 **검증 부채는 복리로 돌아온다**가 나오지 않았다.
// 지금은 통과시킨 한 건이 다음 라운드에 재작업 두 건이 되어 창구로 돌아온다.
// 멀쩡한 것을 반려하면 그 한 건이 다시 올라온다 — 그래서 "다 반려하면 되겠네"도 안 통한다.
// 창구가 한 라운드에 받는 건수는 정해져 있어서, 넘치는 것은 손도 못 대고 더미가 된다.
// 3라운드에서 도장만 찍은 사람은 자기가 만든 더미에 깔린다.
//
// 내용(반려 기준·산출물·사유)은 검증된 것을 그대로 옮겼다. 새로 지어낸 사실 없음.

import { Run, applyGain } from '../core/sim.js';

/**
 * 복리 규칙. 화면(엔진 H)과 판정(simulate)이 이 숫자 하나를 같이 본다 —
 * 둘이 어긋나면 화면에 뜬 것과 결과가 달라져서 판이 아무것도 못 가르친다.
 *
 * 숫자의 근거:
 *   rounds 3        — 전체 90초 안에 끝나야 한다. 4라운드는 물량이 늘어 넘긴다.
 *   lineCap 7       — 한 라운드에 창구가 받는 최대 건수. 이 위는 그대로 밀린다.
 *                     최악의 경우에도 한 라운드가 22초를 넘지 않게 잡은 값이다.
 *   reworkPerPass 2 — 통과시킨 나쁜 것 하나가 다음 라운드에 두 건이 된다(복리).
 *   redoPerReject 1 — 멀쩡한 것을 반려하면 한 건이 다시 올라온다(선형).
 *                     반려의 대가가 통과의 대가보다 가벼워야 "그럼 다 반려" 가
 *                     정답이 되지 않으면서도 공짜가 아니게 된다.
 */
export const RULES = {
  rounds: 3,
  lineCap: 7,
  reworkPerPass: 2,
  redoPerReject: 1
};

const data = {
  source: {
    cap: '반려 기준',
    body: '형식이 아니라 알맹이로 판단한다. ' +
          '① 주장에 **근거**(숫자·출처·조항)가 있는가 ② 읽는 사람이 **다음 행동**을 정할 수 있는가. ' +
          '둘 중 하나라도 없으면 반려다.'
  },

  prompt: 'AI가 만든 산출물이 3라운드에 걸쳐 결재로 올라온다',
  runHint: '창구에 들어온 것만 판단할 수 있다. 그냥 지나가면 결재한 것이 된다',
  bandLabel: '검토 창구',
  lineLabel: '여기를 지나가면 그대로 다음 단계로 간다',
  runLabel: '결재 시작',
  runCaption: '결재한 대로 산출물이 다음 단계로 넘어간다',
  cardIcon: 'doc',

  roundCount: RULES.rounds,

  travelSec: 6,
  gapSec: 2.6,
  bandFrom: 0.38,
  bandTo: 0.78,

  labels: {
    approve: '승인', reject: '반려',
    okApprove: '옳게 승인', okReject: '옳게 반려',
    badApprove: '워크슬롭을 통과시켰다', badReject: '멀쩡한 것을 반려',
    auto: '못 보고 통과',
    round: '라운드',
    rework: '재작업',
    pile: '되돌아온 일감',
    next: '이어서',
    empty: '되돌아온 일감이 없다. 창구가 비어 있다'
  },

  // round = 이 산출물이 처음 올라오는 라운드. 되돌아오는 것은 규칙이 만든다.
  items: [
    { id: 'r1', round: 1, bad: false,
      label: '거래처 이탈 분석 — “3분기 이탈 12곳 중 9곳이 납기 지연 경험. 납기 SLA 재협상 필요.” (원본 데이터 링크 첨부)' },

    { id: 'r2', round: 1, bad: true,
      label: '시장 동향 보고 — “시장은 빠르게 변화하고 있으며, 다각적 접근이 요구됩니다. 지속적인 모니터링이 중요합니다.”',
      why: '문장은 매끄러운데 숫자도 출처도 없고, 읽고 나서 할 일이 정해지지 않는다. 전형적인 워크슬롭이다.' },

    { id: 'r3', round: 1, bad: false,
      label: '재고 회전율 점검 — “A품목 회전율 2.1회(작년 3.4회). 발주 주기 6주→4주 단축 제안.” (산출식 포함)' },

    { id: 'r4', round: 1, bad: true,
      label: '경쟁사 분석 — “업계 관계자에 따르면 경쟁사는 내년 대규모 투자를 검토 중인 것으로 알려졌습니다.”',
      why: '“관계자에 따르면”, “알려졌습니다”는 출처가 아니다. 확인할 길 없는 문장을 근거인 척 세워 뒀다.' },

    { id: 'r5', round: 2, bad: true,
      label: '고객 만족도 요약 — 표는 완벽하게 정리됐으나 응답 수·조사 시점·질문 문항이 어디에도 없다.',
      why: '형식이 완벽할수록 검토가 느슨해진다. 표본과 시점이 없으면 숫자를 해석할 수 없다.' },

    { id: 'r6', round: 2, bad: false,
      label: '월간 비용 리포트 — “클라우드 비용 전월 대비 18% 증가. 원인은 로그 보관 정책 변경(4/12).” (변경 이력 첨부)' },

    { id: 'r7', round: 2, bad: false,
      label: '반품 사유 집계 — “지난달 반품 210건 중 88건이 포장 파손. 완충재 규격 상향을 요청한다.” (사진 기록 첨부)' },

    { id: 'r8', round: 2, bad: true,
      label: '분기 성과 요약 — “전반적으로 목표에 근접했고 일부 항목은 개선이 필요합니다. 지속적인 관리가 요구됩니다.”',
      why: '근접·일부·지속적 — 숫자가 하나도 없다. 읽고 나서 무엇을 할지 정해지지 않는다.' },

    { id: 'r9', round: 3, bad: false,
      label: '교육 이수 현황 — “대상 140명 중 96명 완료. 미이수 44명에게 다음 주 재안내.” (명단 첨부)' },

    { id: 'r10', round: 3, bad: true,
      label: '고객 문의 분석 — “문의 유형을 종합적으로 분류한 결과 만족도는 양호한 수준으로 판단됩니다.”',
      why: '건수도 기준도 없이 분류했다고만 한다. 판단됩니다로 끝나는 문장은 근거가 아니다.' },

    { id: 'r11', round: 3, bad: false,
      label: '설비 점검 결과 — “3호기 진동값이 기준 상한 초과. 다음 정기 점검 전에 부품 교체 요청.” (측정 기록 첨부)' }
  ]
};

// ---------------------------------------------------------------- 라운드 규칙 (순수)
//
// DOM 을 쓰지 않는다. 그래서 화면 없이 Node 로 그대로 돌려 볼 수 있고,
// 복리 구조가 실제로 성립하는지를 검사가 증명한다 (_tests/test-qc.mjs).

/** 되돌아온 서류의 원본 번호. 재작업 서류는 `r2~2-0` 처럼 꼬리표가 붙는다. */
export function origin(id) {
  return String(id).split('~')[0];
}

/** 번호로 원본 산출물을 찾는다. 못 찾으면 판정이 멈추지 않게 빈 값을 준다. */
export function itemOf(id, d = data) {
  return (d.items || []).find(i => i.id === origin(id)) || { id: origin(id), bad: false, why: '' };
}

/**
 * 이번 라운드에 창구로 흘려보낼 서류를 정한다.
 *
 * 되돌아온 것이 먼저다 — 밀린 일이 새 일보다 앞에 오는 것이 실제 순서다.
 * 창구가 받을 수 있는 양(lineCap)을 넘으면 손도 못 대고 그대로 더미가 된다.
 *
 * @param {number} no       라운드 번호 (1부터)
 * @param {Array}  pending  이월된 일감 [{ from, kind }]
 * @returns {{no:number, items:Array, backlog:Array}}
 */
export function buildRound(no, pending, d = data) {
  const fresh = (d.items || []).filter(i => i.round === no).map(i => ({ from: i.id, kind: 'new' }));
  const queue = (pending || []).concat(fresh);
  const items = queue.slice(0, RULES.lineCap).map((e, i) => paper(e, no, i, d));
  return { no, items, backlog: queue.slice(RULES.lineCap) };
}

function paper(entry, no, i, d) {
  const src = itemOf(entry.from, d);
  const back = entry.kind !== 'new';
  return {
    id: back ? `${src.id}~${no}-${i}` : src.id,
    label: src.label,
    bad: !!src.bad,
    why: src.why,
    rework: back
  };
}

/**
 * 이번 라운드의 결과가 다음 라운드에 무엇을 만드는가 — 이 판의 전부.
 *
 *   통과시킨 나쁜 것 1건 → 재작업 2건 (복리)
 *   멀쩡한 것을 반려 1건 → 다시 올라오는 것 1건 (선형이지만 공짜가 아니다)
 */
export function returnsOf(out, d = data) {
  const back = [];
  for (const id of leakedIn(out, d)) {
    for (let k = 0; k < RULES.reworkPerPass; k++) back.push({ from: origin(id), kind: 'rework' });
  }
  for (const id of (out.wrongReject || [])) {
    for (let k = 0; k < RULES.redoPerReject; k++) back.push({ from: origin(id), kind: 'redo' });
  }
  return back;
}

/** 이번 라운드에 다음 단계로 넘어간 나쁜 산출물 — 도장을 찍은 것과 못 본 것이 같다 */
export function leakedIn(out, d = data) {
  return (out.passed || []).concat((out.auto || []).filter(id => itemOf(id, d).bad));
}

/**
 * 라운드 진행을 통째로 돌린다. 화면 없이 전략 하나를 넣으면 결과가 나온다.
 * 검사가 이걸로 복리 구조를 증명한다.
 *
 * @param {(item:object, no:number)=>('approve'|'reject'|'skip')} decide
 */
export function runRounds(decide, d = data) {
  const rounds = [];
  let pending = [];

  for (let no = 1; no <= RULES.rounds; no++) {
    const built = buildRound(no, pending, d);
    const out = { no, size: built.items.length, items: built.items,
      okReject: [], okApprove: [], passed: [], wrongReject: [], auto: [] };

    for (const it of built.items) {
      const v = decide(it, no) || 'skip';
      if (v === 'approve') (it.bad ? out.passed : out.okApprove).push(it.id);
      else if (v === 'reject') (it.bad ? out.okReject : out.wrongReject).push(it.id);
      else out.auto.push(it.id);
    }

    rounds.push(out);
    pending = built.backlog.concat(returnsOf(out, d));
  }

  return { rounds, backlog: pending.length, pending };
}

// ---------------------------------------------------------------- 판정

export default {
  id: 'reject-approval',
  engine: 'H',
  title: '결재 반려',
  subtitle: 'AI가 만든 산출물이 창구를 지나간다. 통과시킨 것은 다음 라운드에 두 배로 돌아온다',
  chapter: 4,
  required: false,
  concept: ['워크슬롭', 'AI 슬롭', '검증 부채', 'AI 번아웃 · AI 피로'],
  checkedAt: '2026-08',

  data,

  /** 엔진이 라운드마다 부른다 — 엔진은 무엇이 워크슬롭인지 모른다 */
  plan(no, pending) { return buildRound(no, pending, data); },
  /** 이번 라운드가 다음 라운드에 만들어 놓는 것 */
  carry(out) { return returnsOf(out, data); },

  /**
   * setup = { rounds: [ 라운드별 기록 ], backlog, bestCombo }
   *   라운드 기록 = { no, size, okReject, okApprove, passed, wrongReject, auto }
   *   passed   워크슬롭을 승인 버튼으로 통과시켰다
   *   auto     창구를 지나쳐 판단 자체를 못 했다 (좋은 것도 나쁜 것도 섞인다)
   *   backlog  창구에 오지도 못하고 밀린 일감 = 눈에 보이는 검증 부채
   */
  simulate(setup, d) {
    const r = new Run();
    const mistakes = [];
    const rounds = (setup.rounds && setup.rounds.length)
      ? setup.rounds
      : [{ no: 1, ...setup }];
    const backlog = setup.backlog || 0;

    let leaked = 0, over = 0, caught = 0, blind = 0;

    r.read('결재 기록을 라운드 순서대로 되돌려 본다');

    for (const rd of rounds) {
      const size = rd.size ?? countOf(rd);
      const ok = (rd.okReject || []).length;
      const gone = leakedIn(rd, d);
      const wrong = rd.wrongReject || [];
      const missedFine = (rd.auto || []).filter(id => !itemOf(id, d).bad);

      caught += ok; leaked += gone.length; over += wrong.length; blind += missedFine.length;

      r.do(`${rd.no}라운드 — 서류 ${size}건 중 ${ok}건 반려`);

      // 사유 이름은 배운 용어 그대로다(`core/sim.js` 의 FAULT.slop = '워크슬롭').
      // 이름을 '워크슬롭' 하나로 두지 않은 이유: 잘한 점이 '워크슬롭 판별' 이라
      // 결과 화면에 "워크슬롭 3건 / 워크슬롭 판별 2건" 이 나란히 뜬다.
      // 무엇이 잘못됐는지가 이름에서 바로 읽혀야 한다 — 통과시킨 것이 잘못이다.
      for (const id of gone) {
        const it = itemOf(id, d);
        r.fault('워크슬롭 통과', it.why, 15);
        mistakes.push({ itemId: it.id, hint: it.why });
      }
      for (const id of wrong) {
        r.fault('과잉 반려', '근거가 있는 산출물을 반려하면 일이 되돌아온다', 8);
        mistakes.push({ itemId: origin(id),
          hint: '근거와 다음 행동이 다 있는 산출물이다. 반려할 이유가 없었다.' });
      }

      if (gone.length) {
        r.fail(`통과된 ${gone.length}건이 재작업 ${gone.length * RULES.reworkPerPass}건이 된다`);
      }
      if (wrong.length) r.warn(`반려한 ${wrong.length}건이 다시 올라온다`);
      if (missedFine.length) r.warn(`${missedFine.length}건은 보지도 않고 통과됐다`);
    }

    // 눈에 보이는 부채 — 창구에 오지도 못하고 쌓인 것
    for (let i = 0; i < backlog; i++) {
      r.fault('검증 부채', '확인하지 않고 넘긴 일감이 창구 앞에 그대로 쌓였다', 6);
    }
    if (backlog) r.fail(`책상에 ${backlog}건이 밀린 채로 남았다`);

    if (!leaked && !over && !backlog && !blind) {
      applyGain(r, 'grounded', 8);
      r.gain('워크슬롭 판별', '형식이 아니라 근거와 다음 행동으로 판단했다', 6);
    } else if (caught) {
      r.gain('워크슬롭 판별', `${caught}건은 걸러냈다`, 4);
    }

    r.out(backlog
      ? `재작업에 깔려 ${backlog}건은 그대로 밀렸다`
      : leaked
        ? `알맹이 없는 산출물 ${leaked}건이 다음 단계로 넘어갔다`
        : over
          ? '워크슬롭은 다 걸렀지만 멀쩡한 것이 계속 되돌아왔다'
          : `워크슬롭 ${caught}건을 모두 반려했다 — 창구가 밀리지 않았다`);

    // pass 는 창구를 밀리게 두지 않았을 때만이다. 워크슬롭 한 건만 통과시켜도
    // 다음 라운드에 두 건이 돌아오므로 "깨끗하게 끝냈다"고 말할 수 없다.
    return r.finish({ pass: 90, partial: 55 }, { mistakes });
  },

  named: {
    all: '방금 반려한 게 **워크슬롭**이다. ' +
         '“좋은 작업물인 척하지만 일을 진전시킬 알맹이가 없는 AI 생성 결과물”을 말한다. ' +
         '같은 것이 회사 밖 인터넷에 쌓이면 **AI 슬롭**이라고 따로 부른다. ' +
         '만든 사람은 시간을 아꼈는데, 확인하는 품은 고스란히 받는 사람에게 넘어간다. ' +
         '이렇게 쌓인 부담이 **검증 부채**다. 부채가 계속 쌓이면 **AI 번아웃 · AI 피로**가 온다.'
  },

  debrief: {
    pass: '통과시킨 것에는 숫자·출처·다음 행동이 다 있었다. 반려한 것에는 그게 없었다.\n창구를 밀리게 두지 않아서 3라운드가 1라운드만큼 가벼웠다.\n검증은 시간을 쓰는 일이 아니라 다음 라운드의 시간을 버는 일이다.',
    partial: '몇 건은 걸렀다. 놓친 건 대개 형식이 아주 깔끔한 쪽이었을 것이다.\n그 한 건이 다음 라운드에 재작업 두 건이 되어 창구로 돌아왔다.\n창구를 그냥 지나가게 둔 것도 승인한 것과 같다.',
    fail: '도장을 빨리 찍을수록 다음 라운드가 무거워졌다. 마지막에 남은 더미가 그 결과다.\n기준은 두 개뿐이다. 근거가 있는가, 읽고 나서 할 일이 정해지는가.\n검증을 건너뛰면 그만큼이 사라지지 않고 재작업으로 되돌아온다.'
  }
};

function countOf(rd) {
  return ['okReject', 'okApprove', 'passed', 'wrongReject', 'auto']
    .reduce((n, k) => n + ((rd[k] || []).length), 0);
}
