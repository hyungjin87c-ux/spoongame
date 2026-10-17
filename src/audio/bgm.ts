import { BEATS_PER_BAR, BEAT_SECONDS, midiToHz, noteEventsForBar, type NoteEvent, type Voice } from './score';

/**
 * BGM 연주기 (SPEC-003 DB4): Web Audio로 **코드가 직접 소리를 만든다** — 음원 파일·외부 라이브러리·외부 요청이 없다. 악보 데이터는 audio/score.ts.
 *  - 소리: 멜로디(사각파 + 낮은 통과 필터로 부드럽게), 분산화음(삼각파), 베이스(삼각파). 모든 음에 짧은 소리 울림(attack·release)을 줘서 딱딱한 클릭 소리를 막는다.
 *  - 시작은 **사용자 활성화 입력 뒤에만**(모바일 자동재생 정책): `start()`는 `pointerup`·`touchend`·`click`·`keydown` 같은 입력 안에서 불러야 하고, 그 전에는 AudioContext를 만들지 않는다.
 *    모바일은 `touchstart`·터치 `pointerdown`을 사용자 활성화로 치지 않는다 — 그 입력에서 `resume()`을 불러 봐야 장치가 계속 멈춰 있다(R-325). 연주 중인데 장치가 멈춰 있으면(`isSuspended()`) 다음 입력마다 다시 `resume()`한다.
 *  - 탭이 가려지면 `suspend()`로 일시 중단하고 다시 보이면 `resume()`으로 이어간다(ui/useBgm.ts가 가시성을 읽어 부른다).
 *  - 볼륨(0~100)은 마스터 이득 하나로 건다: 0.35 × (볼륨/100)^1.5 — 낮은 볼륨에서 더 세밀하고, 100이어도 0.35라 시끄럽지 않다.
 *  - 일정은 앞서 읽기(lookahead) 방식: 50ms마다 깨어 지금부터 0.6초 안에 시작할 마디의 음을 AudioContext 시계로 예약한다 — 타이머가 조금 늦어도 박자가 흔들리지 않는다.
 * 테스트(tests/bgm.test.ts)는 가짜 AudioContext를 주입해 예약된 음의 주파수·시각·마스터 볼륨·중단을 확인한다. 실제 소리는 형진 님이 모바일에서 청취해 확인한다(완료 기준).
 */

// ---------- Web Audio의 쓰는 부분만 좁게 적은 모양 (가짜를 주입하기 쉽게) ----------

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  cancelScheduledValues(time: number): unknown;
}
export interface AudioNodeLike {
  connect(destination: unknown): unknown;
  disconnect(): unknown;
}
export interface OscillatorLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
  start(time?: number): unknown;
  stop(time?: number): unknown;
  onended: (() => void) | null;
}
export interface GainLike extends AudioNodeLike {
  gain: AudioParamLike;
}
export interface FilterLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
}
export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: unknown;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  createBiquadFilter(): FilterLike;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
}

export type AudioContextFactory = () => AudioContextLike | null;

/** 브라우저의 AudioContext를 만든다. 지원하지 않으면 null(BGM 버튼은 눌려도 소리가 나지 않고 오류도 나지 않는다). */
export function browserAudioContext(): AudioContextLike | null {
  const w = typeof window === 'undefined' ? undefined : (window as unknown as { AudioContext?: new () => AudioContextLike; webkitAudioContext?: new () => AudioContextLike });
  const Ctor = w?.AudioContext ?? w?.webkitAudioContext;
  if (Ctor === undefined) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

// ---------- 음색 표 ----------

interface VoiceSpec {
  wave: 'square' | 'triangle';
  /** 음 하나의 최대 이득 */
  gain: number;
  /** 소리가 켜지는 시간 / 꺼지는 시간(초) */
  attack: number;
  release: number;
}
export const VOICES: Readonly<Record<Voice, VoiceSpec>> = {
  melody: { wave: 'square', gain: 0.16, attack: 0.012, release: 0.12 },
  arpeggio: { wave: 'triangle', gain: 0.2, attack: 0.008, release: 0.08 },
  bass: { wave: 'triangle', gain: 0.3, attack: 0.02, release: 0.18 },
};

/** 마스터 이득 최대값(볼륨 100) */
export const MASTER_MAX_GAIN = 0.35;
/** 앞서 읽는 시간(초)과 깨어나는 간격(ms) */
export const LOOKAHEAD_SECONDS = 0.6;
export const TICK_MS = 50;
/** 멜로디 낮은 통과 필터 경계(Hz) — 칩튠의 날카로운 윗소리를 깎아 잔잔하게 */
export const LOWPASS_HZ = 2400;

/** 볼륨(0~100) → 마스터 이득. 범위 밖은 끝값으로, 유한하지 않으면 0. */
export function masterGainFor(volume: number): number {
  if (!Number.isFinite(volume)) return 0;
  const v = Math.min(100, Math.max(0, volume)) / 100;
  return MASTER_MAX_GAIN * Math.pow(v, 1.5);
}

export interface BgmEngine {
  /** 연주를 시작한다(사용자 제스처 안에서 부른다). 이미 연주 중이면 볼륨만 바꾼다. 소리를 낼 수 없는 환경이면 false. */
  start(volume: number): boolean;
  /** 연주를 멈추고 예약된 음을 정리한다 */
  stop(): void;
  setVolume(volume: number): void;
  /** 탭이 가려졌다 — 시계를 멈춘다 */
  suspend(): void;
  /** 탭이 다시 보인다 — 시계를 다시 흐르게 한다(연주 중일 때만) */
  resume(): void;
  isPlaying(): boolean;
  /**
   * 연주 중인데 소리 장치가 돌고 있지 않은가(`running`이 아님 — 브라우저가 사용자 활성화 전이라 멈춰 둔 `suspended`, iOS의 전화·알림 뒤 `interrupted` 포함).
   * 사용자 입력이 들어올 때마다 이 값이 참이면 `resume()`을 다시 부른다(ui/useBgm.ts, R-325).
   */
  isSuspended(): boolean;
  /** 모든 자원을 놓는다(화면이 사라질 때) */
  dispose(): void;
}

/** 타이머를 주입할 수 있게 한 모양(테스트가 직접 tick을 부른다) */
export interface BgmTimers {
  setInterval(fn: () => void, ms: number): number;
  clearInterval(id: number): void;
}
const browserTimers: BgmTimers = {
  setInterval: (fn, ms) => window.setInterval(fn, ms),
  clearInterval: (id) => window.clearInterval(id),
};

export function createBgm(factory: AudioContextFactory = browserAudioContext, timers: BgmTimers = browserTimers): BgmEngine {
  let ctx: AudioContextLike | null = null;
  let master: GainLike | null = null;
  let lead: FilterLike | null = null;
  let timer: number | null = null;
  let playing = false;
  /** 다음에 예약할 마디 번호와 그 마디가 시작할 AudioContext 시각 */
  let nextBar = 0;
  let nextBarTime = 0;
  const live = new Set<OscillatorLike>();

  function schedule(event: NoteEvent, barStart: number): void {
    if (ctx === null || master === null || lead === null) return;
    const spec = VOICES[event.voice];
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = spec.wave;
    const start = barStart + event.startBeat * BEAT_SECONDS;
    // 음 길이의 85%만 울리고 나머지는 쉬어 음 사이가 또렷하다(스타카토 아님)
    const hold = Math.max(0.05, event.beats * BEAT_SECONDS * 0.85);
    osc.frequency.setValueAtTime(midiToHz(event.midi), start);
    amp.gain.setValueAtTime(0, start);
    amp.gain.linearRampToValueAtTime(spec.gain, start + spec.attack);
    amp.gain.setValueAtTime(spec.gain, start + hold);
    amp.gain.linearRampToValueAtTime(0, start + hold + spec.release);
    osc.connect(amp);
    amp.connect(event.voice === 'melody' ? lead : master);
    osc.onended = () => {
      live.delete(osc);
      osc.disconnect();
      amp.disconnect();
    };
    live.add(osc);
    osc.start(start);
    osc.stop(start + hold + spec.release + 0.02);
  }

  function pump(): void {
    if (ctx === null || !playing) return;
    const horizon = ctx.currentTime + LOOKAHEAD_SECONDS;
    while (nextBarTime < horizon) {
      for (const e of noteEventsForBar(nextBar)) schedule(e, nextBarTime);
      nextBar++;
      nextBarTime += BEATS_PER_BAR * BEAT_SECONDS;
    }
  }

  function build(): boolean {
    if (ctx !== null) return true;
    const c = factory();
    if (c === null) return false;
    ctx = c;
    master = c.createGain();
    master.gain.value = 0;
    master.connect(c.destination);
    lead = c.createBiquadFilter();
    lead.type = 'lowpass';
    lead.frequency.value = LOWPASS_HZ;
    lead.connect(master);
    return true;
  }

  function setMaster(volume: number): void {
    if (ctx === null || master === null) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(masterGainFor(volume), t + 0.05);
  }

  const engine: BgmEngine = {
    start(volume) {
      if (!build() || ctx === null) return false;
      setMaster(volume);
      if (playing) return true;
      playing = true;
      void ctx.resume();
      nextBar = 0;
      nextBarTime = ctx.currentTime + 0.1;
      pump();
      timer = timers.setInterval(pump, TICK_MS);
      return true;
    },
    stop() {
      playing = false;
      if (timer !== null) {
        timers.clearInterval(timer);
        timer = null;
      }
      if (ctx !== null && master !== null) {
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0, t + 0.08);
      }
      for (const o of live) {
        try {
          o.stop(ctx === null ? 0 : ctx.currentTime + 0.1);
        } catch {
          // 이미 멈춘 음
        }
      }
    },
    setVolume(volume) {
      if (playing) setMaster(volume);
    },
    suspend() {
      if (ctx !== null && playing) void ctx.suspend();
    },
    resume() {
      if (ctx !== null && playing) void ctx.resume();
    },
    isPlaying: () => playing,
    isSuspended: () => ctx !== null && playing && ctx.state !== 'running',
    dispose() {
      engine.stop();
      const c = ctx;
      ctx = null;
      master = null;
      lead = null;
      live.clear();
      if (c !== null) void c.close().catch(() => undefined);
    },
  };
  return engine;
}
