// 부트스트랩. 화면 전환만 담당하고 게임 로직은 갖지 않는다. (CLAUDE.md §3)

import { start, parse, go } from './core/router.js';
import { state } from './core/state.js';
import { loadGame, metaOf, nextOf, manifest } from './games/index.js';
import { renderTopbar } from './shell/topbar.js';
import { renderCourse } from './shell/coursemap.js';
import { renderCodex } from './shell/codex.js';
import { renderToolbook } from './shell/toolbook.js';
import { renderReport } from './shell/report.js';
import { showDebrief, hideDebrief } from './shell/debrief.js';
import { mountBookmark, refresh as refreshBook } from './shell/bookmark.js';
import { needEnter, showEnter } from './shell/enter.js';
import { stageIn, ripple } from './core/motion.js';
import { BUILD } from './core/version.js';

// 모듈이 실행됐다는 표시. index.html 의 file:// 안내가 이 값을 본다.
document.documentElement.setAttribute('data-booted', '1');

// index.html 의 안내는 1.2초 안에 부팅을 못 보면 뜨는데, 한 번 뜨면 스스로 사라지지 않는다.
// 느린 기기나 캐시가 빈 첫 방문에서는 정상 배포본에서도 뜬다 — 여기서 직접 지운다.
// 숨기는 것으로는 부족하다: 남아 있으면 화면 아래에 빈 공간이 생겨 게임 화면이 스크롤된다.
document.getElementById('boot-fallback')?.remove();

// 엔진. 진입할 때만 불러온다 — 첫 화면에서 전부 받지 않는다.
// A~E 는 세팅형(고르고 제출), F~H 는 실시간 액션형이다.
const ENGINES = {
  C: () => import(`./engines/build.js?v=${BUILD}`),     // 조립
  E: () => import(`./engines/preview.js?v=${BUILD}`),   // 미리보기
  W: () => import(`./engines/wire.js?v=${BUILD}`),      // 배선 — 상자를 선으로 이어 흐름을 만든다
  P: () => import(`./engines/bet.js?v=${BUILD}`),       // 예측 — 진실을 보기 전에 먼저 건다
  L: () => import(`./engines/assembly.js?v=${BUILD}`),  // 조립 라인 — 엔진을 차체에 끼워 출고한다
  T: () => import(`./engines/timeline.js?v=${BUILD}`),  // 발동 타임라인 — 하루에 걸어 두고 돌려 본다
  R: () => import(`./engines/dispatch.js?v=${BUILD}`),  // 실시간 관제 — 일감을 창구로 보낸다
  S: () => import(`./engines/library.js?v=${BUILD}`),   // 서고 — 낱말을 던져 걸린 것만 넘긴다
  V: () => import(`./engines/evidence.js?v=${BUILD}`),  // 증거판 — 문장을 근거 조항에 잇는다
  N: () => import(`./engines/map.js?v=${BUILD}`),       // 지형 답사 — 발품을 써서 구역을 고른다
  I: () => import(`./engines/inject.js?v=${BUILD}`),    // 숨은 지시 — 심어 보고, 편을 바꿔 막는다
  M: () => import(`./engines/gate.js?v=${BUILD}`),      // 권한 게이트 — 케이블 위의 문을 하나씩 연다
  F: () => import(`./engines/defense.js?v=${BUILD}`),   // 디펜스 — 내려오는 것을 막는다
  H: () => import(`./engines/qcline.js?v=${BUILD}`)     // 검토 라인 — 창구에서 승인/반려를 찍는다
};

const app = document.getElementById('app');
const topbarHost = document.createElement('header');
const stage = document.createElement('main');
stage.className = 'stage';

let activeEngine = null;

// 눌린 자리에서 파문이 퍼진다. 한 곳에서 위임 처리하므로 엔진은 이걸 몰라도 된다.
// 없어진 엔진의 선택자는 여기서도 같이 뺀다 — B(판별형)·A(분류형)·G(슈팅).
const TAPPABLE = '.bin,.part,.toggle,.node,.btn-primary,.btn-quiet,.tab,' +
                 '.def__slot,.ax__tool,.bt__pick,.asm__part,.tl__tool,.tl__box,.tl__key,' +
                 '.dp__job,.dp__desk,.lib__hit,.lib__word,.ev__line,.ev__span,.gt__gate,.mp__tile,.ij__opt,.ij__guard';
// 배선형 상자(.wf__node)는 여기 넣지 않는다. 파문은 host 를 넘어가지 않아야 해서
// `overflow: hidden` 이 전제인데, 그 상자는 선이 드나드는 동그라미를 테두리 **밖에**
// 달고 있어서 잘라낼 수 없다. 넣었더니 파문이 상자보다 크게 번져 이름을 덮었다.
document.addEventListener('pointerdown', (e) => {
  const t = e.target.closest && e.target.closest(TAPPABLE);
  if (!t || t.disabled) return;
  const box = t.getBoundingClientRect();
  ripple(t, e.clientX - box.left, e.clientY - box.top);
}, { passive: true });

boot();

/**
 * 이름을 먼저 묻고, 그 다음에 셸을 세운다.
 *
 * 순서가 뒤바뀌면 안 되는 이유: `core/state.js` 는 저장 키를 **모듈 로드 때
 * 한 번만** 읽는다. 코스맵을 먼저 그린 뒤에 사람을 정하면 앞사람 숫자가
 * 화면에 남는다. 그래서 사람이 바뀌는 경우 `showEnter` 는 새로고침으로 끝나고
 * 이 함수는 거기서 멈춘다 — 새 문서가 처음부터 다시 시작한다.
 *
 * 상단바·도감책도 이 뒤에 붙인다. 시작 화면에 진도 막대와 도감책이 떠 있으면
 * 그것부터 눌러 보게 되는데, 그때 숫자는 아직 누구 것인지 정해지지 않았다.
 */
async function boot() {
  if (needEnter()) await showEnter(app);

  app.textContent = '';
  app.append(topbarHost, stage);

  // 화면 옆에 떠 있는 도감책. 셸 바깥(body)에 붙여서 화면이 바뀌어도 살아 있다.
  mountBookmark(document.body);

  start(handle);
}

async function handle(route) {
  // 이전 화면 정리 — 타이머·이벤트가 남지 않게 반드시 먼저 한다.
  if (activeEngine) {
    try { activeEngine.unmount(); } catch { /* 이미 정리됨 */ }
    activeEngine = null;
  }
  hideDebrief();
  window.scrollTo(0, 0);

  renderTopbar(topbarHost, route);

  switch (route.name) {
    case 'codex':
      document.title = '용어 도감 — AI 연수원';
      renderCodex(stage, route.q);
      break;

    case 'tools':
      document.title = 'AI 도구 도감 — AI 연수원';
      renderToolbook(stage, route.q);
      break;

    case 'report':
      document.title = '결과 카드 — AI 연수원';
      renderReport(stage);
      break;

    case 'game':
      await openGame(route.id);
      break;

    default:
      document.title = 'AI 연수원 — 해보면서 배우는 AI';
      renderCourse(stage);
  }

  // 코스맵으로 돌아올 때는 뒤로 가는 느낌, 그 외에는 앞으로 나가는 느낌
  stageIn(stage, route.name === 'course');
}

async function openGame(id) {
  const meta = metaOf(id);
  if (!meta) { unknown(id); return; }

  let game = null, engineMod = null;
  try {
    [game, engineMod] = await Promise.all([
      loadGame(id),
      ENGINES[meta.engine] ? ENGINES[meta.engine]() : Promise.resolve(null)
    ]);
  } catch (err) {
    // 파일 하나가 깨져도 전체가 멈추지 않게 한다.
    broken(meta, err);
    return;
  }

  if (!game || !engineMod || typeof engineMod.mount !== 'function') {
    broken(meta, new Error('mount 없음'));
    return;
  }

  document.title = `${game.title} — AI 연수원`;
  activeEngine = engineMod;

  engineMod.mount(stage, game, {
    finish(result) {
      // 이번에 처음 딴 용어. 해설 패널이 "새로 모았다"를 구분하는 데 쓴다 —
      // 기록이 먼저 들어가므로 패널 쪽에서는 알 수 없다.
      const newTerms = state.record(id, result);
      renderTopbar(topbarHost, parse());   // 진행도·랭크를 즉시 반영
      refreshBook();                       // 떠 있는 책이 퍼덕인다

      const next = nextOf(id, (x) => state.isCleared(x));
      const allRequiredDone = manifest
        .filter(m => m.required).every(m => state.isCleared(m.id));

      showDebrief(game, result, {
        newTerms,
        retry: () => openGame(id),
        next: next ? () => go(`/game/${next.id}`) : () => go('/report'),
        nextLabel: next
          ? `다음: ${next.no}. ${next.title}`
          : '결과 카드 보기',
        toCourse: () => go('/'),
        hint: allRequiredDone && next ? '필수 코스는 전부 끝났다.' : ''
      });
    }
  });
}

function unknown(id) {
  stage.innerHTML =
    `<h1 class="stage__title">없는 주소</h1>` +
    `<p class="stage__sub">‘${esc(id)}’ 라는 코스는 없다.</p>`;
  stage.append(toCourseBtn());
}

function broken(meta, err) {
  console.error('[AI 연수원] 코스를 여는 데 실패:', meta && meta.id, err);
  stage.innerHTML =
    `<h1 class="stage__title">${esc(meta ? meta.title : '오류')}</h1>` +
    `<p class="stage__sub">이 코스를 여는 데 실패했다. 새로고침해도 같으면 다른 코스를 먼저 해도 된다.</p>`;
  stage.append(toCourseBtn());
}

function toCourseBtn() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-primary';
  b.style.marginTop = 'var(--sp-4)';
  b.textContent = '코스맵으로';
  b.addEventListener('click', () => go('/'));
  return b;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
