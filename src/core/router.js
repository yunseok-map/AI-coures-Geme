// 아주 작은 해시 라우터. 뒤로가기가 브라우저 기본 동작과 어긋나지 않게 한다.
//
//   #/               코스맵
//   #/game/:id       미니게임
//   #/codex          용어 도감      (#/codex?q=아티팩트 로 검색어 전달)
//   #/tools          AI 도구 도감
//   #/report         결과 카드

let onChange = null;

export function parse(hash) {
  const raw = (hash || location.hash || '#/').replace(/^#/, '');
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const q = qs ? decodeURIComponent(new URLSearchParams(qs).get('q') || '') : '';

  if (parts[0] === 'game' && parts[1]) return { name: 'game', id: parts[1], q };
  if (parts[0] === 'codex')  return { name: 'codex', q };
  if (parts[0] === 'tools')  return { name: 'tools', q };
  if (parts[0] === 'report') return { name: 'report', q };
  return { name: 'course', q };
}

export function go(path) {
  if (location.hash === '#' + path) {
    // 같은 주소면 hashchange 가 안 뜨므로 직접 부른다.
    if (onChange) onChange(parse(path));
    return;
  }
  location.hash = path;
}

/** 뒤로가기. 히스토리가 없으면 코스맵으로 보낸다. */
export function back() {
  if (history.length > 1) history.back();
  else go('/');
}

export function start(handler) {
  onChange = handler;
  window.addEventListener('hashchange', () => handler(parse()));
  handler(parse());
}
