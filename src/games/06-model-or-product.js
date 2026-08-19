// 미니게임 6 — 모델이냐 제품이냐 (엔진 L 조립 라인)
// 배우는 것: 모델 · 제품 · 표면
//
// 설계 의도: 이 구분은 통 두 개에 이름을 나눠 넣어서는 안 잡힌다. 그건 이름을
// 보고 통을 고르는 일이고, 정작 배워야 할 **관계**가 화면에 안 나온다 —
// 같은 엔진이 여러 제품에 들어가고, 한 제품의 엔진은 갈아 끼울 수 있다는 것.
//
// 그래서 공장으로 만들었다. 엔진을 집어 차체에 끼우고 출고한다.
//   · 엔진만 올려도 출고 버튼은 눌린다 → "켤 수 있는 물건이 아니다"를 직접 겪는다
//   · 같은 엔진을 다음 주문에서 다른 차체에 또 끼운다 → 1:N 이 손에 남는다
//   · 다 끝나면 오늘 출고 목록이 엔진 하나에서 여러 갈래로 뻗은 그림이 된다
//
// 내용은 data/products.js 검증본을 그대로 쓴다. 새로 지어낸 제품 정보 없음.

import { Run } from '../core/sim.js';
import { eulReul, iGa } from '../core/ko.js';

const ENGINES = [
  { id: 'opus',   label: 'Claude Opus', note: '모델 계열' },
  { id: 'gpt',    label: 'GPT 계열',     note: '모델 계열' },
  { id: 'gemini', label: 'Gemini(모델)', note: '모델 계열' }
];

const CHASSIS = [
  { id: 'chat',  label: '채팅 제품',
    surfaces: ['웹', '모바일 앱', '데스크톱 앱'],
    can: '묻고 답한다. 결과물을 옆 창에 띄워 고칠 수 있다' },
  { id: 'cli',   label: 'CLI 에이전트',
    surfaces: ['터미널', 'IDE', '데스크톱 앱'],
    can: '내 컴퓨터의 파일을 읽고 고치고 명령을 실행한다' },
  { id: 'work',  label: '업무 에이전트',
    surfaces: ['데스크톱', '웹'],
    can: '코딩이 아닌 사무 업무를 여러 단계에 걸쳐 통째로 맡는다' },
  { id: 'inhouse', label: '사내 앱',
    surfaces: ['사내 웹'],
    can: '우리가 만든 화면 안에서 정해진 일만 한다' }
];

const ORDERS = [
  {
    id: 'o1',
    cap: '출고 주문 1',
    text: '터미널에서 파일 200개를 한 번에 고쳐야 한다. 엔진은 아무거나 좋다.',
    want: 'cli',
    why: '파일과 명령을 다루는 일이라 CLI 에이전트 차체가 맞다.'
  },
  {
    id: 'o2',
    cap: '출고 주문 2',
    text: '바로 앞에서 쓴 것과 **같은 엔진**으로, 이번엔 사무 업무를 통째로 맡기고 싶다.',
    want: 'work',
    sameEngineAs: 'o1',
    why: '엔진은 그대로 두고 차체만 바꾼 것이다. 같은 엔진이 전혀 다른 일을 하게 된다.'
  },
  {
    id: 'o3',
    cap: '출고 주문 3',
    text: '“GPT 계열을 그냥 켜서 쓰고 싶다.” 담당자가 엔진 이름을 그대로 적어 보냈다.',
    want: null,          // 채울 수 있는 차체가 없다 — 이 주문 자체가 틀렸다
    trap: true,
    why: '모델은 사람이 켜는 물건이 아니다. 차체가 있어야 켤 것이 생긴다.'
  },
  {
    id: 'o4',
    cap: '출고 주문 4',
    text: '웹에서 제안서를 옆에 띄워 놓고 계속 고쳐 나가고 싶다.',
    want: 'chat',
    why: '웹에서 도는 채팅 제품 차체다. 결과물을 옆 창에 띄우는 게 이 차체가 하는 일이다.'
  }
];

const engOf = id => ENGINES.find(e => e.id === id) || null;
const chOf = id => CHASSIS.find(c => c.id === id) || null;

export default {
  id: 'model-or-product',
  engine: 'L',
  title: '모델이냐 제품이냐',
  subtitle: '엔진을 차체에 끼워 출고한다. 엔진만 내보내면 어떻게 되는지도 본다',
  chapter: 2,
  required: true,
  concept: ['모델', '제품', '표면'],
  checkedAt: '2026-08',

  data: {
    engineShelfLabel: '엔진 — 사람이 직접 켜지 않는다. 제품 안에 들어간다',
    chassisShelfLabel: '차체 — 사람이 켜서 쓴다. 엔진을 감싸고 있다',
    engineSlotLabel: '엔진 자리',
    chassisSlotLabel: '차체 자리',
    shipLabel: '출고',
    shippedLabel: '라인에서 나온 것',
    ledgerLabel: '오늘 출고한 것 — 엔진 하나가 어디로 갔나',
    runCaption: '출고한 것을 켜 본다',
    engines: ENGINES,
    chassis: CHASSIS,
    orders: ORDERS
  },

  /**
   * 출고 한 건을 그 자리에서 켜 본다. 엔진(assembly.js)이 주문마다 부른다.
   * 순수 함수라 Node 로 그대로 돌릴 수 있다.
   */
  judge(build, order) {
    const r = new Run();
    const eng = engOf(build.engine);
    const ch = chOf(build.chassis);

    // 이 판의 임팩트 모먼트 — 엔진만 내보냈을 때.
    if (!ch) {
      r.read(eng ? `${eng.label} 하나가 상자에 담겨 나갔다` : '빈 상자가 나갔다');
      r.warn('켜는 곳이 없다 — 화면도, 명령창도, 버튼도 없다');
      r.fail(eng ? `${eulReul(eng.label)} 받은 사람이 아무것도 하지 못한다`
                 : '받은 사람이 아무것도 하지 못한다');
      r.out('출고 실패 — 켤 수 있는 물건이 아니다');
      return { ...r.finish(), ok: false };
    }

    if (!eng) {
      r.read(`${ch.label} 껍데기가 나갔다`);
      r.do('켜 본다 — 화면은 뜬다');
      r.warn('무엇을 물어도 답이 없다. 안에 엔진이 없다');
      r.fail('껍데기만으로는 아무 일도 못 한다');
      r.out('출고 실패 — 엔진이 빠졌다');
      return { ...r.finish(), ok: false };
    }

    r.read(`${ch.label} — 안에 ${eng.label}`);
    r.do(`켤 수 있는 곳: ${ch.surfaces.join(' · ')}`);
    r.do(ch.can);

    // 주문이 요구한 차체와 맞는가
    if (order.trap) {
      r.warn('주문서에 적힌 것은 엔진 이름이다 — 그 이름으로 켤 수 있는 것은 없다');
      r.ok(`대신 ${iGa(ch.label)} 있어서 이 엔진을 실제로 쓸 수 있게 됐다`);
      r.out(`출고 — 주문서가 잘못 적혀 있었다`);
      return { ...r.finish(), ok: true };
    }

    if (order.want && ch.id !== order.want) {
      r.warn('주문이 요구한 일을 이 차체는 하지 못한다');
      r.fail(`받은 사람이 ${iGa(chOf(order.want).label)} 필요하다고 되돌려 보냈다`);
      r.out('출고 — 반품');
      return { ...r.finish(), ok: false };
    }

    r.ok('주문한 일을 그대로 한다');
    r.out(`출고 완료 — ${ch.label}`);
    return { ...r.finish(), ok: true };
  },

  simulate(setup) {
    const r = new Run();
    const builds = setup.builds || [];
    const byOrder = new Map(builds.map(b => [b.orderId, b]));

    r.read(`오늘 출고한 ${builds.length}건을 펼친다`);

    let bad = 0;

    // 껍데기·알맹이만 나간 것
    const husk = builds.filter(b => !b.chassis);
    const empty = builds.filter(b => b.chassis && !b.engine);
    if (husk.length) {
      bad += husk.length;
      r.warn(`엔진만 나간 것 ${husk.length}건`);
      r.fault('켤 수 없는 물건',
        '모델은 사람이 켜는 물건이 아니다. 감싸는 제품이 있어야 쓸 수 있게 된다', 22 * husk.length);
    }
    if (empty.length) {
      bad += empty.length;
      r.warn(`엔진 없이 껍데기만 나간 것 ${empty.length}건`);
      r.fault('빈 껍데기', '제품은 엔진을 감싼 것이다. 안이 비면 화면만 남는다', 18 * empty.length);
    }

    // 주문과 다른 차체
    for (const o of ORDERS) {
      const b = byOrder.get(o.id);
      if (!b || !b.chassis || !b.engine || o.trap || !o.want) continue;
      if (b.chassis !== o.want) {
        bad++;
        r.warn(`${o.cap} — ${iGa(chOf(b.chassis).label)} 나갔다`);
        // 반품이다 — 주문이 아예 안 채워졌다. 가볍게 매기면 세 번 틀려도 통과한다.
        r.fault('차체 선택',
          '같은 엔진이라도 어떤 차체에 넣느냐로 할 수 있는 일이 달라진다', 30);
      }
    }

    // 같은 엔진을 다른 차체에 또 넣었는가 — 이 판이 가르치려는 관계
    const perEngine = new Map();
    for (const b of builds) {
      if (!b.engine || !b.chassis) continue;
      if (!perEngine.has(b.engine)) perEngine.set(b.engine, new Set());
      perEngine.get(b.engine).add(b.chassis);
    }
    const reused = [...perEngine.entries()].filter(([, set]) => set.size >= 2);
    if (reused.length) {
      const [id, set] = reused[0];
      r.ok(`${engOf(id).label} 하나가 서로 다른 완성품 ${set.size}대에 들어갔다`);
      r.do(`${[...set].map(c => chOf(c).label).join(' · ')} — 엔진은 같고 하는 일은 다르다`);
      r.gain('모델과 제품의 관계', '엔진 하나를 여러 차체에 끼워 서로 다른 제품을 만들었다', 8);
    } else {
      r.warn('엔진 하나가 여러 완성품에 들어가는 것을 보지 못했다');
    }

    // 같은 엔진을 요구한 주문
    const same = ORDERS.find(o => o.sameEngineAs);
    if (same) {
      const a = byOrder.get(same.sameEngineAs), b = byOrder.get(same.id);
      if (a && b && a.engine && b.engine && a.engine !== b.engine) {
        r.warn(`${iGa(same.cap)} 같은 엔진을 요구했는데 다른 엔진이 들어갔다`);
        r.fault('엔진 바꿔치기', '차체를 바꾸는 것과 엔진을 바꾸는 것은 다른 일이다', 12);
      }
    }

    r.out(bad ? '오늘 출고 — 되돌아온 것이 있다' : '오늘 출고 — 전부 켜서 쓸 수 있다');
    return r.finish({ pass: 80, partial: 45 });
  },

  named: {
    all: '엔진이 **모델**이다. 그걸 감싸서 사람이 켤 수 있게 만든 것이 **제품**, ' +
         '같은 제품을 쓰는 여러 창구가 **표면**이다. 방금 엔진 하나를 여러 차체에 끼워 봤듯이 ' +
         '둘의 관계는 1대1이 아니다. 공식 문서의 한 문장이 이 관계를 정확히 말한다 — ' +
         '“Claude Code가 하네스이고, Claude는 그 안에 든 모델이다.” **Agent = Model + Harness**.'
  },

  debrief: {
    pass: '엔진과 차체를 나눠 보면 “AI 도구가 수백 개”라는 혼란이 크게 줄어든다.\n상당수는 같은 엔진을 다른 차체에 넣은 것이기 때문이다.\n새 도구 이름을 들으면 “이건 엔진인가 차체인가”부터 물어보면 된다.',
    partial: '조립은 됐지만 되돌아온 것이 있다. 같은 엔진이라도 차체가 하는 일이 다르다.\n터미널에서 파일을 고치는 차체와 웹에서 문서를 다듬는 차체는 바꿔 쓸 수 없다.\n엔진을 고르는 것과 차체를 고르는 것은 별개의 결정이다.',
    fail: '엔진만 출고한 게 있었다면 거기가 핵심이다. 모델은 켤 수 있는 물건이 아니다.\n똑똑한 건 엔진이고, 그 엔진을 켜서 쓰게 만드는 껍데기가 제품이다.\n둘을 다 올리고 다시 출고해 보자.'
  }
};
