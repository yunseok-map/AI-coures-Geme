// AI 실행 시뮬레이터 — 이 게임의 핵심 장치.
//
// 왜 있나: 이 게임은 용어 설명집이 아니다. 플레이어가 **직접 세팅하고, 실행 버튼을 누르고,
// 자기가 세팅한 대로 AI가 움직이는 걸 눈으로 본 뒤**, 결과를 보고 "아 이래서 이게 필요하구나"를
// 스스로 알아채게 만드는 것이 목표다. 그래서 판정은 점수만 주지 않고 **과정을 보여준다.**
//
// LLM 호출은 없다. 전부 규칙이다. (프롬프트 §2 — API 호출 금지)
//
// 각 미니게임은 자기 파일에서 simulate(setup) 를 내보내고, 여기 있는 빌더로 로그를 만든다.

/** 로그 한 줄 종류 — 색과 아이콘이 달라진다 */
export const KIND = {
  READ: 'read',   // 자료를 읽는다
  DO:   'do',     // 일을 한다
  OK:   'ok',     // 잘 됐다
  WARN: 'warn',   // 위험 신호
  FAIL: 'fail',   // 사고
  OUT:  'out'     // 최종 산출물
};

/**
 * 실행 로그 빌더.
 *
 *   const s = new Run();
 *   s.read('규정집을 읽는다').do('초안을 만든다').warn('근거가 없다')
 *    .out('보고서 초안 완성')
 *    .fault('환각', '근거 없이 사실을 주장했다');
 *   return s.finish({ pass: 90, partial: 60 });
 */
export class Run {
  constructor() {
    this.steps = [];
    this.faults = [];   // 실패 사유 — 결과 화면에 이름 그대로 뜬다
    this.gains = [];    // 잘한 점
    this.score = 100;
  }

  _push(kind, text, ms) {
    this.steps.push({ kind, text, ms: ms ?? defaultMs(kind) });
    return this;
  }

  read(text, ms) { return this._push(KIND.READ, text, ms); }
  do(text, ms)   { return this._push(KIND.DO, text, ms); }
  ok(text, ms)   { return this._push(KIND.OK, text, ms); }
  warn(text, ms) { return this._push(KIND.WARN, text, ms); }
  fail(text, ms) { return this._push(KIND.FAIL, text, ms); }
  out(text, ms)  { return this._push(KIND.OUT, text, ms ?? 700); }

  /**
   * 실패 사유를 기록한다. name 은 배운 용어 그대로 쓴다 —
   * "왜 실패했는지가 결과 화면에서 즉시 이해된다"(프롬프트 §0)를 만족시키는 부분이다.
   *
   * **일어난 일을 하나씩 다 적는다.** 같은 사유가 세 번이면 세 개다 —
   * 실시간 판에서는 "3건 놓쳤다"가 점수와 mistakes 에 정확히 반영돼야 한다.
   * 화면에 똑같은 줄이 세 개 뜨는 문제는 여기서 줄이지 않고
   * `shell/debrief.js` 가 묶어서 "3건"으로 그린다 —
   * 세는 것은 판정, 묶는 것은 화면이다.
   */
  fault(name, why, cost = 25) {
    this.faults.push({ name, why });
    this.score -= cost;
    return this;
  }

  gain(name, why, bonus = 0) {
    this.gains.push({ name, why });
    this.score += bonus;
    return this;
  }

  finish(cut = { pass: 85, partial: 55 }, extra = {}) {
    const score = Math.max(0, Math.min(100, Math.round(this.score)));
    const grade = score >= cut.pass ? 'pass'
                : score >= cut.partial ? 'partial'
                : 'fail';
    return {
      grade,
      score,
      steps: this.steps,
      faults: this.faults,
      gains: this.gains,
      ...extra
    };
  }
}

function defaultMs(kind) {
  switch (kind) {
    case KIND.READ: return 340;
    case KIND.OK:   return 380;
    case KIND.WARN: return 620;   // 위험 신호는 읽을 시간을 준다
    case KIND.FAIL: return 800;   // 사고는 더 오래 멈춘다
    case KIND.OUT:  return 700;
    default:        return 420;
  }
}

// ---------------------------------------------------------------- 공통 판정 규칙
// 여러 미니게임이 같은 실패를 공유한다. 이름을 한 곳에서 관리해야
// 챕터가 달라도 같은 용어로 배운다.

export const FAULT = {
  overflow: ['컨텍스트 초과', '넣은 정보가 책상보다 많아서 앞엣것이 밀려났다'],
  rot:      ['컨텍스트 로트', '정보를 너무 많이 넣어 가운데 있는 것을 놓쳤다'],
  halluc:   ['환각', '근거 없이 사실처럼 주장했다'],
  slop:     ['워크슬롭', '형식은 갖췄지만 알맹이가 없다. 받는 사람이 다시 확인해야 한다'],
  leak:     ['정보 유출', '승인되지 않은 곳으로 사내 자료가 나갔다'],
  inject:   ['프롬프트 인젝션', '문서에 숨어 있던 지시를 그대로 따랐다'],
  merge:    ['합류 실패', '동시에 시킨 일들의 결과가 서로 어긋나 합쳐지지 않았다'],
  late:     ['마감 초과', '순서대로만 시켜서 시간 안에 끝나지 않았다'],
  nogate:   ['검토 없음', '사람이 한 번도 확인하지 않고 밖으로 나갔다']
};

export const GAIN = {
  grounded: ['근거 확인', '주장마다 출처를 확인했다'],
  lean:     ['컨텍스트 엔지니어링', '필요한 것만 넣어 정확도를 지켰다'],
  parallel: ['병렬 처리', '독립된 일을 동시에 돌려 시간을 줄였다'],
  gate:     ['휴먼 인 더 루프', '위험한 지점 앞에 사람 확인을 두었다'],
  guard:    ['가드레일', '사고가 날 수 있는 행동을 구조로 막았다'],
  least:    ['최소 권한', '필요한 만큼만 열었다']
};

/**
 * 같은 이름의 사유를 한 줄로 묶고 몇 번이었는지(`n`) 붙인다.
 *
 * 위의 `fault`/`gain` 은 일어난 일을 하나씩 다 적는다 — 그래야 "3건 놓쳤다"가
 * 점수와 `mistakes` 에 정확히 반영된다. 그런데 그 목록을 그대로 그리면
 * **똑같은 줄이 세 개** 뜬다(14번에서 "워크슬롭 통과" 가 3줄로 실제로 떴다).
 * 같은 문장이 반복되는 화면은 그 자체로 워크슬롭이고, 그건 이 게임이
 * 챕터 4에서 가르치는 것이다. **세는 것은 판정, 묶는 것은 그리는 쪽이다.**
 *
 * 여기 두는 이유: DOM 을 안 쓰는 순수 함수라 Node 로 검사할 수 있고,
 * 판정 결과의 모양을 아는 것은 이 파일이다. 처음 나온 순서를 지킨다 —
 * 시간 순으로 읽히던 것이 뒤섞이면 안 된다.
 *
 * @param {Array<{name:string, why:string}>} list
 * @returns {Array<{name:string, why:string, n:number}>}
 */
export function groupReasons(list) {
  const out = [];
  const at = new Map();
  for (const r of list || []) {
    if (!r || !r.name) continue;
    if (at.has(r.name)) { out[at.get(r.name)].n++; continue; }
    at.set(r.name, out.length);
    out.push({ name: r.name, why: r.why, n: 1 });
  }
  return out;
}

/** FAULT/GAIN 상수를 Run 에 바로 넣기 위한 도우미 */
export function applyFault(run, key, cost) {
  const [name, why] = FAULT[key];
  return run.fault(name, why, cost);
}

export function applyGain(run, key, bonus) {
  const [name, why] = GAIN[key];
  return run.gain(name, why, bonus);
}
