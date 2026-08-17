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
import { stageIn, ripple } from './core/motion.js';

// 모듈이 실행됐다는 표시. index.html 의 file:// 안내가 이 값을 본다.
document.documentElement.setAttribute('data-booted', '1');

// 엔진 5종. 진입할 때만 불러온다 — 첫 화면에서 5개를 다 받지 않는다.
const ENGINES = {
  A: () => import('./engines/sort.js'),      // 분류
  B: () => import('./engines/spot.js'),      // 찾기·판별
  C: () => import('./engines/build.js'),     // 조립
  D: () => import('./engines/timeline.js'),  // 배치
  E: () => import('./engines/preview.js')    // 미리보기
};

const app = document.getElementById('app');
const topbarHost = document.createElement('header');
const stage = document.createElement('main');
stage.className = 'stage';
app.append(topbarHost, stage);

let activeEngine = null;

// 눌린 자리에서 파문이 퍼진다. 한 곳에서 위임 처리하므로 엔진은 이걸 몰라도 된다.
const TAPPABLE = '.bin,.part,.cell,.toggle,.target,.board__row,.node,.btn-primary,.btn-quiet,.tab';
document.addEventListener('pointerdown', (e) => {
  const t = e.target.closest && e.target.closest(TAPPABLE);
  if (!t || t.disabled) return;
  const box = t.getBoundingClientRect();
  ripple(t, e.clientX - box.left, e.clientY - box.top);
}, { passive: true });

start(handle);

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
      state.record(id, result);
      renderTopbar(topbarHost, parse());   // 진행도·랭크를 즉시 반영

      const next = nextOf(id, (x) => state.isCleared(x));
      const allRequiredDone = manifest
        .filter(m => m.required).every(m => state.isCleared(m.id));

      showDebrief(game, result, {
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
