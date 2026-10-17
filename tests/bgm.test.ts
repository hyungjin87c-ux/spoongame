import { describe, expect, it } from 'vitest';
import bgmSource from '../src/audio/bgm.ts?raw';
import scoreSource from '../src/audio/score.ts?raw';
import {
  LOOKAHEAD_SECONDS,
  LOWPASS_HZ,
  MASTER_MAX_GAIN,
  TICK_MS,
  VOICES,
  browserAudioContext,
  createBgm,
  masterGainFor,
  type AudioContextLike,
  type AudioParamLike,
  type BgmTimers,
  type FilterLike,
  type GainLike,
  type OscillatorLike,
} from '../src/audio/bgm';
import { BEATS_PER_BAR, BEAT_SECONDS, BPM, CHORDS, PATTERNS, SONG_BARS, SONG_FORM, barAt, midiToHz, noteEventsForBar, noteToMidi, parseNotes, type ChordName } from '../src/audio/score';

/**
 * BGM (SPEC-003 DB4): 코드가 만드는 잔잔한 칩튠. 실제 소리는 사람이 듣고 확인하지만(완료 기준: 형진 님이 모바일에서 청취), 악보 규칙·예약되는 음의 주파수와 시각·볼륨·중단·제스처 뒤에만 시작은 여기서 기계로 본다.
 */

// ---------- 악보 ----------

const C_MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]);
const CHORD_TONES: Record<ChordName, number[]> = { C: [0, 4, 7], F: [5, 9, 0], G: [7, 11, 2], Am: [9, 0, 4], Dm: [2, 5, 9], Em: [4, 7, 11] };
const pc = (midi: number) => ((midi % 12) + 12) % 12;
const E4 = noteToMidi('E4');
const C6 = noteToMidi('C6');

describe('음 이름·주파수', () => {
  it('C4 = 60, A4 = 69, 440Hz, 한 옥타브는 2배', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C6')).toBe(84);
    expect(midiToHz(69)).toBeCloseTo(440, 10);
    expect(midiToHz(81)).toBeCloseTo(880, 8);
    expect(midiToHz(60)).toBeCloseTo(261.6256, 3);
  });

  it('알 수 없는 음 이름·박자는 던진다 (조용히 틀린 음을 만들지 않는다)', () => {
    for (const bad of ['H4', 'c4', 'C#4', 'C', 'C44', '']) expect(() => noteToMidi(bad), bad).toThrow(RangeError);
    for (const bad of ['C4:0', 'C4:-1', 'C4:x', 'C4']) expect(() => parseNotes(bad), bad).toThrow(RangeError);
    expect(parseNotes('E5:1 R:0.5')).toEqual([
      { pitch: 76, beats: 1 },
      { pitch: null, beats: 0.5 },
    ]);
  });
});

describe('악보 규칙', () => {
  it('패턴은 5개 이상이고 모두 4마디, 마디마다 박자 합이 정확히 4다', () => {
    expect(PATTERNS.length).toBeGreaterThanOrEqual(5);
    for (const p of PATTERNS) {
      expect(p.bars, p.name).toHaveLength(4);
      for (const [i, bar] of p.bars.entries()) expect(bar.melody.reduce((a, n) => a + n.beats, 0), `${p.name} ${i + 1}마디`).toBe(BEATS_PER_BAR);
    }
  });

  it('멜로디의 모든 음이 C 장음계 위에 있고 E4~C6 안이다', () => {
    let count = 0;
    for (const p of PATTERNS)
      for (const bar of p.bars)
        for (const n of bar.melody) {
          if (n.pitch === null) continue;
          expect(C_MAJOR.has(pc(n.pitch)), `${p.name}: ${n.pitch}`).toBe(true);
          expect(n.pitch).toBeGreaterThanOrEqual(E4 - 2); // G4(67)까지 내려가는 악구가 있다
          expect(n.pitch).toBeLessThanOrEqual(C6);
          count++;
        }
    expect(count).toBeGreaterThan(60);
  });

  it('마디 첫 음(쉼표가 아니면)은 그 마디 코드의 구성음이다', () => {
    for (const p of PATTERNS)
      for (const [i, bar] of p.bars.entries()) {
        const first = bar.melody[0];
        if (first.pitch === null) continue;
        expect(CHORD_TONES[bar.chord.name], `${p.name} ${i + 1}마디 ${bar.chord.name}`).toContain(pc(first.pitch));
      }
  });

  it('이어지는 음 사이의 도약은 한 옥타브 이내다 (곡 전체를 이어 붙인 24마디, 쉼표는 건너뛴다, 처음으로 돌아오는 이음매 포함)', () => {
    const pitches: number[] = [];
    for (let b = 0; b < SONG_BARS + 1; b++) for (const n of barAt(b).bar.melody) if (n.pitch !== null) pitches.push(n.pitch);
    for (let i = 1; i < pitches.length; i++) expect(Math.abs(pitches[i] - pitches[i - 1]), `${i}번째 음 도약`).toBeLessThanOrEqual(12);
  });

  it('코드는 C·F·G·Am·Dm·Em 3화음이고, 분산화음 3음은 코드 구성음, 베이스는 근음과 5음이다 (베이스 C2~E3)', () => {
    expect(Object.keys(CHORDS).sort()).toEqual(['Am', 'C', 'Dm', 'Em', 'F', 'G']);
    for (const c of Object.values(CHORDS)) {
      for (const m of c.triad) expect(CHORD_TONES[c.name], `${c.name} 분산화음 ${m}`).toContain(pc(m));
      expect(new Set(c.triad.map(pc)).size, `${c.name} 3화음`).toBe(3);
      expect(pc(c.root), `${c.name} 근음`).toBe(CHORD_TONES[c.name][0]);
      expect(pc(c.fifth), `${c.name} 5음`).toBe(CHORD_TONES[c.name][2]);
      expect(c.fifth - c.root === 7 || c.fifth - c.root === 14 || c.fifth - c.root === 7 + 12 || (c.fifth - c.root + 12) % 12 === 7, `${c.name} 5도`).toBe(true);
      expect(c.root).toBeGreaterThanOrEqual(noteToMidi('C2'));
      expect(c.fifth).toBeLessThanOrEqual(noteToMidi('E3'));
    }
  });

  it('패턴마다 코드 진행과 멜로디가 서로 다르다 (반복 피로를 줄인다)', () => {
    const progressions = PATTERNS.map((p) => p.bars.map((b) => b.chord.name).join('-'));
    expect(new Set(progressions).size, progressions.join(' / ')).toBe(PATTERNS.length);
    const melodies = PATTERNS.map((p) => JSON.stringify(p.bars.map((b) => b.melody)));
    expect(new Set(melodies).size).toBe(PATTERNS.length);
  });

  it('곡의 형식: 모든 패턴이 쓰이고 24마디(약 76초)마다 돌아온다. 마디 번호가 커져도 음이 같다', () => {
    expect(new Set(SONG_FORM)).toEqual(new Set(PATTERNS.map((_, i) => i)));
    expect(SONG_BARS).toBe(24);
    expect(SONG_BARS * BEATS_PER_BAR * BEAT_SECONDS).toBeCloseTo(75.8, 1);
    expect(BPM).toBe(76);
    for (const b of [0, 5, 23]) expect(noteEventsForBar(b + SONG_BARS)).toEqual(noteEventsForBar(b));
    expect(noteEventsForBar(-1)).toEqual(noteEventsForBar(SONG_BARS - 1)); // 음수도 안전
    expect(noteEventsForBar(3)).toEqual(noteEventsForBar(3));
  });

  it('한 마디의 음 목록: 멜로디(쉼표 제외) + 분산화음 8개 + 베이스 2개이고 모두 마디 안에 들어간다', () => {
    for (let b = 0; b < SONG_BARS; b++) {
      const events = noteEventsForBar(b);
      const bar = barAt(b).bar;
      const voice = (v: string) => events.filter((e) => e.voice === v);
      expect(voice('melody')).toHaveLength(bar.melody.filter((n) => n.pitch !== null).length);
      expect(voice('arpeggio')).toHaveLength(8);
      expect(voice('bass').map((e) => e.midi)).toEqual([bar.chord.root, bar.chord.fifth]);
      for (const e of events) {
        expect(e.startBeat).toBeGreaterThanOrEqual(0);
        expect(e.startBeat + e.beats, `${b}마디`).toBeLessThanOrEqual(BEATS_PER_BAR);
      }
    }
  });

  it('외부 음원·기존 곡 파일 없음: 소스에 파일 불러오기·오디오 요소·외부 주소가 없고 저장소에 음원 파일이 없다', () => {
    for (const src of [bgmSource, scoreSource]) {
      expect(src).not.toMatch(/\bfetch\s*\(|new Audio\s*\(|XMLHttpRequest|https?:\/\/|decodeAudioData|\.(?:mp3|ogg|wav|m4a)\b/);
    }
    const files = import.meta.glob('../{src,public}/**/*.{mp3,ogg,wav,m4a,aac,flac,opus,weba}');
    expect(Object.keys(files)).toEqual([]);
  });
});

// ---------- 연주기: 가짜 AudioContext ----------

class FakeParam implements AudioParamLike {
  value = 0;
  calls: Array<{ kind: 'set' | 'ramp' | 'cancel'; value?: number; time: number }> = [];
  setValueAtTime(value: number, time: number) {
    this.calls.push({ kind: 'set', value, time });
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.calls.push({ kind: 'ramp', value, time });
  }
  cancelScheduledValues(time: number) {
    this.calls.push({ kind: 'cancel', time });
  }
  ramps() {
    return this.calls.filter((c) => c.kind === 'ramp');
  }
}
class FakeNode {
  connected: unknown[] = [];
  disconnected = 0;
  connect(destination: unknown) {
    this.connected.push(destination);
  }
  disconnect() {
    this.disconnected++;
  }
}
class FakeOsc extends FakeNode implements OscillatorLike {
  type = 'sine';
  frequency = new FakeParam();
  startedAt: number | null = null;
  stoppedAt: number[] = [];
  onended: (() => void) | null = null;
  start(time?: number) {
    this.startedAt = time ?? 0;
  }
  stop(time?: number) {
    this.stoppedAt.push(time ?? 0);
  }
}
class FakeGain extends FakeNode implements GainLike {
  gain = new FakeParam();
}
class FakeFilter extends FakeNode implements FilterLike {
  type = 'allpass';
  frequency = new FakeParam();
}
class FakeCtx implements AudioContextLike {
  currentTime = 0;
  state = 'suspended';
  destination = { name: 'destination' };
  oscillators: FakeOsc[] = [];
  gains: FakeGain[] = [];
  filters: FakeFilter[] = [];
  calls: string[] = [];
  createOscillator() {
    const o = new FakeOsc();
    this.oscillators.push(o);
    return o;
  }
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createBiquadFilter() {
    const f = new FakeFilter();
    this.filters.push(f);
    return f;
  }
  async resume() {
    this.calls.push('resume');
    this.state = 'running';
  }
  async suspend() {
    this.calls.push('suspend');
    this.state = 'suspended';
  }
  async close() {
    this.calls.push('close');
    this.state = 'closed';
  }
}
class FakeTimers implements BgmTimers {
  fns = new Map<number, () => void>();
  next = 1;
  cleared: number[] = [];
  intervals: number[] = [];
  setInterval(fn: () => void, ms: number) {
    const id = this.next++;
    this.fns.set(id, fn);
    this.intervals.push(ms);
    return id;
  }
  clearInterval(id: number) {
    this.cleared.push(id);
    this.fns.delete(id);
  }
  tick() {
    for (const fn of [...this.fns.values()]) fn();
  }
  get active() {
    return this.fns.size;
  }
}

function setup() {
  const ctx = new FakeCtx();
  const timers = new FakeTimers();
  let made = 0;
  const engine = createBgm(
    () => {
      made++;
      return ctx;
    },
    timers,
  );
  return { ctx, timers, engine, made: () => made };
}
const master = (ctx: FakeCtx) => ctx.gains[0];
const lead = (ctx: FakeCtx) => ctx.filters[0];
const hz = (o: FakeOsc) => o.frequency.calls.find((c) => c.kind === 'set')!.value!;

describe('masterGainFor: 볼륨 0~100 → 마스터 이득', () => {
  it('0이면 무음, 100이어도 0.35 이하 (시끄럽지 않다), 단조 증가', () => {
    expect(masterGainFor(0)).toBe(0);
    expect(masterGainFor(100)).toBeCloseTo(MASTER_MAX_GAIN, 10);
    expect(MASTER_MAX_GAIN).toBeLessThanOrEqual(0.35);
    let last = -1;
    for (let v = 0; v <= 100; v++) {
      const g = masterGainFor(v);
      expect(g).toBeGreaterThanOrEqual(last);
      last = g;
    }
    expect(masterGainFor(30)).toBeCloseTo(0.35 * Math.pow(0.3, 1.5), 10);
  });

  it('범위 밖은 끝값, 유한하지 않으면 무음', () => {
    expect(masterGainFor(-20)).toBe(0);
    expect(masterGainFor(500)).toBeCloseTo(MASTER_MAX_GAIN, 10);
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) expect(masterGainFor(bad), String(bad)).toBe(0);
  });
});

describe('createBgm: 가짜 AudioContext로 예약되는 음을 본다', () => {
  it('만들기만 해서는 AudioContext를 만들지 않는다 — 제스처(start) 전에는 아무것도 없다', () => {
    const { made, timers, engine } = setup();
    expect(made()).toBe(0);
    expect(engine.isPlaying()).toBe(false);
    expect(timers.active).toBe(0);
    engine.stop();
    engine.setVolume(50);
    engine.suspend();
    engine.resume();
    engine.dispose();
    expect(made(), '멈춤·볼륨·중단·정리도 만들지 않는다').toBe(0);
  });

  it('소리를 낼 수 없는 환경(AudioContext 없음)이면 false이고 오류가 나지 않는다', () => {
    const timers = new FakeTimers();
    const engine = createBgm(() => null, timers);
    expect(engine.start(30)).toBe(false);
    expect(engine.isPlaying()).toBe(false);
    expect(timers.active).toBe(0);
    expect(() => {
      engine.setVolume(10);
      engine.stop();
      engine.dispose();
    }).not.toThrow();
    expect(browserAudioContext(), '브라우저 전역이 없는 환경').toBeNull();
  });

  it('start: 마스터 이득 → 목적지, 멜로디 필터(낮은 통과 2400Hz) → 마스터, 컨텍스트를 깨우고 50ms마다 일정을 읽는다', () => {
    const { ctx, timers, engine } = setup();
    expect(engine.start(30)).toBe(true);
    expect(engine.isPlaying()).toBe(true);
    expect(master(ctx).connected).toEqual([ctx.destination]);
    expect(lead(ctx).type).toBe('lowpass');
    expect(lead(ctx).frequency.value).toBe(LOWPASS_HZ);
    expect(lead(ctx).connected).toEqual([master(ctx)]);
    expect(ctx.calls).toContain('resume');
    expect(timers.intervals).toEqual([TICK_MS]);
    expect(timers.active).toBe(1);
    // 볼륨은 부드럽게(0.05초 램프) 목표 값으로
    const ramps = master(ctx).gain.ramps();
    expect(ramps.at(-1)!.value).toBeCloseTo(masterGainFor(30), 10);
    expect(ramps.at(-1)!.time).toBeCloseTo(0.05, 10);
  });

  it('처음 읽기에서 0번째 마디만 예약된다: 개수·주파수·시작 시각이 악보와 같다 (과거 시각 없음)', () => {
    const { ctx, engine } = setup();
    engine.start(30);
    const events = noteEventsForBar(0);
    expect(ctx.oscillators).toHaveLength(events.length);
    const barStart = 0.1;
    events.forEach((e, i) => {
      const osc = ctx.oscillators[i];
      expect(hz(osc), `${e.voice} ${e.midi}`).toBeCloseTo(midiToHz(e.midi), 8);
      expect(osc.startedAt!).toBeCloseTo(barStart + e.startBeat * BEAT_SECONDS, 8);
      expect(osc.startedAt!).toBeGreaterThanOrEqual(ctx.currentTime);
      expect(osc.type).toBe(VOICES[e.voice].wave);
      // 이어지는 마디 끝에 stop이 예약돼 있다
      expect(osc.stoppedAt).toHaveLength(1);
      expect(osc.stoppedAt[0]).toBeGreaterThan(osc.startedAt!);
    });
  });

  it('멜로디는 필터로, 반주·베이스는 마스터로 흐른다. 음마다 이득 노드를 거쳐 클릭 소리를 막는다 (0에서 올라가고 0으로 내려간다)', () => {
    const { ctx, engine } = setup();
    engine.start(30);
    const events = noteEventsForBar(0);
    events.forEach((e, i) => {
      const osc = ctx.oscillators[i];
      const amp = osc.connected[0] as FakeGain;
      expect(amp).toBeInstanceOf(FakeGain);
      expect(amp.connected, `${e.voice}`).toEqual([e.voice === 'melody' ? lead(ctx) : master(ctx)]);
      const spec = VOICES[e.voice];
      const first = amp.gain.calls[0];
      expect(first).toMatchObject({ kind: 'set', value: 0 });
      const ramps = amp.gain.ramps();
      expect(ramps[0].value).toBe(spec.gain);
      expect(ramps[0].time - first.time).toBeCloseTo(spec.attack, 10);
      expect(ramps.at(-1)!.value, '끝은 0').toBe(0);
      expect(spec.gain).toBeLessThanOrEqual(0.3);
      expect(spec.attack).toBeGreaterThan(0);
      expect(spec.release).toBeGreaterThan(0);
    });
  });

  it('시계가 흐르면 앞으로 0.6초 안에 시작하는 마디를 예약하고, 같은 시각에 다시 깨어나도 중복 예약하지 않는다', () => {
    const { ctx, timers, engine } = setup();
    engine.start(30);
    const bar = BEATS_PER_BAR * BEAT_SECONDS;
    const first = ctx.oscillators.length;
    timers.tick();
    timers.tick();
    expect(ctx.oscillators.length, '시계가 안 흐르면 그대로').toBe(first);
    // 0번째 마디 시작(0.1)+3.158 = 1번째 마디 시작 3.258. 시계 2.7이면 horizon 3.3 > 3.258 → 1번째 마디 예약
    ctx.currentTime = 3.258 - LOOKAHEAD_SECONDS + 0.01;
    timers.tick();
    const second = ctx.oscillators.length;
    expect(second).toBe(first + noteEventsForBar(1).length);
    timers.tick();
    expect(ctx.oscillators.length).toBe(second);
    // 둘째 마디의 첫 음 시작 시각은 마디 길이만큼 뒤다
    const firstOfBar1 = ctx.oscillators[first];
    expect(firstOfBar1.startedAt!).toBeCloseTo(0.1 + bar + noteEventsForBar(1)[0].startBeat * BEAT_SECONDS, 8);
    // 타이머가 오래 늦어져도(탭 백그라운드 등) 밀린 마디를 한꺼번에 따라잡되 시각은 어긋나지 않는다
    ctx.currentTime = 20;
    timers.tick();
    const times = ctx.oscillators.map((o) => o.startedAt!);
    expect(Math.max(...times)).toBeLessThan(20 + LOOKAHEAD_SECONDS + bar);
    expect(Math.min(...times.slice(second))).toBeGreaterThan(0);
  });

  it('setVolume: 연주 중에만 새 목표 값으로 부드럽게 바꾼다', () => {
    const { ctx, engine } = setup();
    engine.start(30);
    const before = master(ctx).gain.ramps().length;
    engine.setVolume(80);
    const ramps = master(ctx).gain.ramps();
    expect(ramps).toHaveLength(before + 1);
    expect(ramps.at(-1)!.value).toBeCloseTo(masterGainFor(80), 10);
    engine.stop();
    const afterStop = master(ctx).gain.ramps().length;
    engine.setVolume(10);
    expect(master(ctx).gain.ramps(), '멈춘 뒤에는 바꾸지 않는다').toHaveLength(afterStop);
  });

  it('start를 또 부르면 컨텍스트·타이머를 새로 만들지 않고 볼륨만 바꾼다', () => {
    const { ctx, timers, engine, made } = setup();
    engine.start(30);
    const osc = ctx.oscillators.length;
    expect(engine.start(60)).toBe(true);
    expect(made()).toBe(1);
    expect(timers.active).toBe(1);
    expect(ctx.oscillators).toHaveLength(osc);
    expect(master(ctx).gain.ramps().at(-1)!.value).toBeCloseTo(masterGainFor(60), 10);
  });

  it('stop: 타이머를 끄고 마스터를 0으로 내리고 울리는 음을 멈춘다. 멈춘 뒤에는 더 예약하지 않는다. 다시 켜면 처음 마디부터', () => {
    const { ctx, timers, engine } = setup();
    engine.start(30);
    const count = ctx.oscillators.length;
    engine.stop();
    expect(engine.isPlaying()).toBe(false);
    expect(timers.active).toBe(0);
    expect(timers.cleared).toHaveLength(1);
    expect(master(ctx).gain.ramps().at(-1)!.value).toBe(0);
    for (const o of ctx.oscillators) expect(o.stoppedAt.length, '울리는 음 모두에 stop').toBeGreaterThanOrEqual(2);
    ctx.currentTime = 50;
    timers.tick();
    expect(ctx.oscillators).toHaveLength(count);
    engine.start(30);
    expect(ctx.oscillators.length).toBe(count + noteEventsForBar(0).length);
    expect(ctx.oscillators.at(-1)!.startedAt!).toBeGreaterThanOrEqual(50);
    expect(timers.active).toBe(1);
  });

  it('음이 끝나면(onended) 노드를 풀어 놓고, 그 음은 stop 때 다시 건드리지 않는다', () => {
    const { ctx, engine } = setup();
    engine.start(30);
    const osc = ctx.oscillators[0];
    const amp = osc.connected[0] as FakeGain;
    expect(typeof osc.onended).toBe('function');
    osc.onended!();
    expect(osc.disconnected).toBe(1);
    expect(amp.disconnected).toBe(1);
    const stopsBefore = osc.stoppedAt.length;
    engine.stop();
    expect(osc.stoppedAt).toHaveLength(stopsBefore);
  });

  it('이미 멈춘 음에 stop이 던져도 stop()은 끝까지 간다', () => {
    const { ctx, engine } = setup();
    engine.start(30);
    ctx.oscillators[1].stop = () => {
      throw new Error('InvalidStateError');
    };
    expect(() => engine.stop()).not.toThrow();
    expect(engine.isPlaying()).toBe(false);
  });

  it('suspend·resume: 연주 중일 때만 컨텍스트를 멈추고 다시 흐르게 한다', () => {
    const { ctx, engine } = setup();
    engine.suspend();
    engine.resume();
    expect(ctx.calls).toEqual([]);
    engine.start(30);
    ctx.calls.length = 0;
    engine.suspend();
    expect(ctx.calls).toEqual(['suspend']);
    engine.resume();
    expect(ctx.calls).toEqual(['suspend', 'resume']);
    engine.stop();
    ctx.calls.length = 0;
    engine.suspend();
    engine.resume();
    expect(ctx.calls, '멈춘 뒤에는 건드리지 않는다').toEqual([]);
  });

  it('dispose: 멈추고 컨텍스트를 닫는다. 다시 start하면 새 컨텍스트를 만든다', () => {
    const { ctx, timers, engine, made } = setup();
    engine.start(30);
    engine.dispose();
    expect(engine.isPlaying()).toBe(false);
    expect(timers.active).toBe(0);
    expect(ctx.calls).toContain('close');
    engine.start(30);
    expect(made(), '닫은 뒤에는 새로 만든다').toBe(2);
  });
});
