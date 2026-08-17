// 효과음 · 진동. 음원 파일을 두지 않는다 — 그 자리에서 합성한다(외부 요청 0건).
//
// 기본은 **꺼짐**이다. 이 게임은 사무실에서 열린다. 갑자기 소리가 나면
// 그것만으로 창을 닫는다. 켜고 싶은 사람만 켠다.
//
// AudioContext 는 사용자가 화면을 한 번 누른 뒤에만 만들 수 있다(브라우저 정책).
// 그래서 첫 play() 때 만든다 — play() 는 항상 탭 이후에 불린다.

import { state } from './state.js';

let ctx = null;
let master = null;
let enabled = state.setting('sfx', false);

function ensure() {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;      // 교육 자료다. 크면 안 된다.
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    // 오디오를 못 쓰는 환경에서도 게임은 그대로 돌아야 한다.
    return null;
  }
}

/** 짧은 음 하나. from → to 로 음높이가 미끄러진다. */
function tone({ from, to, type = 'square', dur = 0.09, gain = 0.2, delay = 0 }) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (to && to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  // 딸깍거리지 않게 앞뒤를 짧게 여닫는다
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** 잡음 한 줌 — 부딪히는 소리, 터지는 소리에 쓴다 */
function noise({ dur = 0.12, gain = 0.16, cutoff = 1400, delay = 0 }) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const ch = buf.getChannelData(0);
  // Math.random 을 쓰지 않는다 — 고정 패턴이면 매번 같은 소리가 나서 예측 가능하다
  for (let i = 0; i < n; i++) {
    ch[i] = (Math.sin(i * 12.9898) * 43758.5453 % 2) - 1;
    ch[i] *= 1 - i / n;                // 뒤로 갈수록 잦아든다
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cutoff;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(lp); lp.connect(g); g.connect(master);
  src.start(t0);
}

function buzz(ms) {
  try { navigator.vibrate && navigator.vibrate(ms); } catch { /* 지원 안 함 */ }
}

// ---------------------------------------------------------------- 소리 목록
// 이름은 "무슨 일이 일어났는가"로 짓는다. 엔진이 음높이를 몰라도 되게.

const BANK = {
  /** 장치를 집었다 */
  pick:  () => tone({ from: 520, to: 660, dur: 0.05, gain: 0.12, type: 'triangle' }),
  /** 장치를 놓았다 */
  place: () => { tone({ from: 300, to: 200, dur: 0.07, gain: 0.16, type: 'triangle' }); buzz(12); },
  /** 발사 */
  shot:  () => tone({ from: 900, to: 380, dur: 0.06, gain: 0.13, type: 'square' }),
  /** 막았다 · 맞혔다 */
  block: () => {
    tone({ from: 660, to: 990, dur: 0.08, gain: 0.18, type: 'square' });
    noise({ dur: 0.08, gain: 0.1, cutoff: 2200 });
    buzz(18);
  },
  /** 헛방 — 안전한 것을 건드렸다 */
  wrong: () => { tone({ from: 220, to: 160, dur: 0.16, gain: 0.16, type: 'sawtooth' }); buzz(30); },
  /** 사고가 났다 */
  leak:  () => {
    tone({ from: 180, to: 60, dur: 0.42, gain: 0.22, type: 'sawtooth' });
    noise({ dur: 0.3, gain: 0.18, cutoff: 700 });
    buzz([40, 60, 40]);
  },
  /** 콤보가 올라간다 — 단계마다 반음씩 높아진다 */
  combo: (n = 1) => tone({ from: 520 * Math.pow(1.06, Math.min(n, 12)), dur: 0.05, gain: 0.12, type: 'triangle' }),
  /** 웨이브 시작 카운트다운 */
  count: () => tone({ from: 440, dur: 0.07, gain: 0.14, type: 'triangle' }),
  /** 판정 — 승인 */
  pass:  () => { tone({ from: 523, dur: 0.1, gain: 0.18, type: 'triangle' });
                 tone({ from: 659, dur: 0.1, gain: 0.18, type: 'triangle', delay: 0.09 });
                 tone({ from: 784, dur: 0.18, gain: 0.18, type: 'triangle', delay: 0.18 }); },
  /** 판정 — 반려 */
  fail:  () => { tone({ from: 330, dur: 0.12, gain: 0.18, type: 'sawtooth' });
                 tone({ from: 247, dur: 0.24, gain: 0.18, type: 'sawtooth', delay: 0.11 }); }
};

export const sfx = {
  play(name, arg) {
    if (!enabled) return;
    const f = BANK[name];
    if (f) { try { f(arg); } catch { /* 소리 하나 실패로 게임을 멈추지 않는다 */ } }
  },

  get on() { return enabled; },

  /** 토글. 켠 직후 한 번 울려 줘야 켜진 걸 안다. */
  toggle() {
    enabled = !enabled;
    state.setSetting('sfx', enabled);
    if (enabled) this.play('place');
    return enabled;
  }
};
