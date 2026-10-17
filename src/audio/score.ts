/**
 * BGM 악보 (SPEC-003 DB4): 코드가 직접 만드는 잔잔한 칩튠의 **음 높이·길이 데이터**. 순수 데이터와 순수 함수뿐이라 소리 없이도 단위 테스트한다(tests/bgm.test.ts).
 * 연주(Web Audio)는 audio/bgm.ts가 이 데이터를 읽는다. 음원 파일·외부 라이브러리는 없고, **기존 곡의 멜로디를 쓰지 않는다** — 아래 멜로디는 이 프로젝트를 위해 새로 지은 짧은 악구들이다.
 *
 * 규칙 (tests/bgm.test.ts가 단언한다)
 *  - 한 마디는 4/4, 박자(beats) 합이 정확히 4다. 한 곡(pattern)은 4마디.
 *  - 멜로디의 모든 음은 C 장음계(C D E F G A B) 위에 있고 E4(64)~C6(84) 안에 있다. 마디 첫 음(쉼표가 아니면)은 그 마디 코드의 구성음이다. 이어지는 음 사이의 도약은 한 옥타브 이내.
 *  - 코드는 C·F·G·Am·Dm·Em(모두 C 장조의 3화음). 반주 분산화음은 그 3화음의 음만, 베이스는 근음과 5음만 쓴다(옥타브는 C2~E3).
 *  - 패턴은 5개 이상(반복 피로를 줄인다): 코드 진행이 서로 다르고 멜로디도 서로 다르다. 곡의 형식(SONG_FORM)은 패턴을 섞어 24마디(약 76초)마다 돌아온다.
 */

/** 음 이름 → MIDI 번호 (C4 = 60). 자연음만 쓴다(C D E F G A B + 옥타브). */
const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteToMidi(name: string): number {
  const m = /^([A-G])([0-9])$/.exec(name);
  if (m === null) throw new RangeError(`noteToMidi: 알 수 없는 음 이름 「${name}」`);
  return (Number(m[2]) + 1) * 12 + PITCH_CLASS[m[1]];
}

/** MIDI 번호 → 주파수(Hz), A4 = 440 */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface ScoreNote {
  /** MIDI 번호, 쉼표는 null */
  pitch: number | null;
  /** 박자 수 (4분음표 = 1) */
  beats: number;
}

/** 「E5:1 G5:0.5 R:1」 꼴의 악보 글자를 음 목록으로 (R은 쉼표) */
export function parseNotes(spec: string): ScoreNote[] {
  return spec
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [name, beats] = token.split(':');
      const n = Number(beats);
      if (!Number.isFinite(n) || n <= 0) throw new RangeError(`parseNotes: 박자가 올바르지 않다 「${token}」`);
      return { pitch: name === 'R' ? null : noteToMidi(name), beats: n };
    });
}

export const BEATS_PER_BAR = 4;
export const BPM = 76;
/** 한 박자의 길이(초) */
export const BEAT_SECONDS = 60 / BPM;

/** 코드: 근음(베이스, MIDI)과 3화음(분산화음용, MIDI) */
export interface Chord {
  name: ChordName;
  /** 베이스 근음 */
  root: number;
  /** 베이스 5음 */
  fifth: number;
  /** 분산화음 3음 (낮은 음부터) */
  triad: readonly [number, number, number];
}
export type ChordName = 'C' | 'F' | 'G' | 'Am' | 'Dm' | 'Em';

export const CHORDS: Readonly<Record<ChordName, Chord>> = {
  C: { name: 'C', root: 36, fifth: 43, triad: [48, 52, 55] },
  F: { name: 'F', root: 41, fifth: 48, triad: [48, 53, 57] },
  G: { name: 'G', root: 43, fifth: 50, triad: [47, 50, 55] },
  Am: { name: 'Am', root: 45, fifth: 52, triad: [48, 52, 57] },
  Dm: { name: 'Dm', root: 38, fifth: 45, triad: [50, 53, 57] },
  Em: { name: 'Em', root: 40, fifth: 47, triad: [47, 52, 55] },
};

/** 한 마디: 코드와 멜로디 */
export interface Bar {
  chord: Chord;
  melody: ScoreNote[];
}

export interface Pattern {
  name: string;
  bars: Bar[];
}

function pattern(name: string, rows: ReadonlyArray<readonly [ChordName, string]>): Pattern {
  return { name, bars: rows.map(([chord, melody]) => ({ chord: CHORDS[chord], melody: parseNotes(melody) })) };
}

/** 패턴 다섯 개 (코드 진행과 멜로디가 모두 다르다) */
export const PATTERNS: readonly Pattern[] = [
  pattern('맑은 아침', [
    ['C', 'E5:1 G5:1 E5:0.5 D5:0.5 C5:1'],
    ['Am', 'C5:1.5 A4:0.5 C5:1 E5:1'],
    ['F', 'A5:1 G5:0.5 F5:0.5 E5:1 C5:1'],
    ['G', 'D5:1 B4:1 D5:1 R:1'],
  ]),
  pattern('골목 길', [
    ['F', 'C5:0.5 F5:0.5 A5:1 G5:1 F5:1'],
    ['G', 'G5:1.5 F5:0.5 D5:1 B4:1'],
    ['Em', 'B4:1 E5:1 G5:1 E5:0.5 D5:0.5'],
    ['Am', 'E5:2 C5:1 A4:1'],
  ]),
  pattern('오후의 창가', [
    ['C', 'G4:0.5 C5:0.5 E5:1 D5:0.5 C5:0.5 E5:1'],
    ['Em', 'G5:1 E5:1 B4:1 R:1'],
    ['Dm', 'A5:1 F5:1 D5:1 F5:1'],
    ['G', 'D5:1.5 G5:0.5 B5:1 R:1'],
  ]),
  pattern('저녁 바람', [
    ['Am', 'E5:1 A5:1 G5:0.5 E5:0.5 C5:1'],
    ['F', 'F5:1 A5:1 C6:1 A5:1'],
    ['C', 'G5:1 E5:0.5 G5:0.5 C6:2'],
    ['G', 'B5:1 G5:1 D5:1 R:1'],
  ]),
  pattern('늦은 밤', [
    ['Dm', 'A4:2 D5:1 F5:1'],
    ['G', 'G4:1 B4:1 D5:2'],
    ['C', 'E5:1 C5:1 G5:2'],
    ['Am', 'A5:2 E5:1 C5:1'],
  ]),
];

/** 곡의 형식: 패턴을 섞어 24마디마다 돌아온다 */
export const SONG_FORM: readonly number[] = [0, 1, 0, 2, 3, 4];

/** 한 번의 형식(루프)의 마디 수 */
export const SONG_BARS = SONG_FORM.length * 4;

export type Voice = 'melody' | 'arpeggio' | 'bass';

export interface NoteEvent {
  voice: Voice;
  /** 마디 시작을 0으로 센 시작 박 */
  startBeat: number;
  beats: number;
  midi: number;
}

/** 곡 전체에서 `barIndex`번째 마디(0부터, 형식을 반복해 센다)가 있는 패턴과 그 안의 마디 */
export function barAt(barIndex: number): { pattern: Pattern; bar: Bar; patternIndex: number; barInPattern: number } {
  const i = ((Math.floor(barIndex) % SONG_BARS) + SONG_BARS) % SONG_BARS;
  const patternIndex = SONG_FORM[Math.floor(i / 4)];
  const barInPattern = i % 4;
  const p = PATTERNS[patternIndex];
  return { pattern: p, bar: p.bars[barInPattern], patternIndex, barInPattern };
}

/**
 * 한 마디의 연주할 음들: 멜로디(쉼표 제외) + 분산화음(8분음표 8개, 3화음을 오르내리는 순서) + 베이스(근음 2박 + 5음 2박).
 * 순수 함수라 같은 마디 번호는 항상 같은 음이다.
 */
export function noteEventsForBar(barIndex: number): NoteEvent[] {
  const { bar } = barAt(barIndex);
  const out: NoteEvent[] = [];
  let at = 0;
  for (const n of bar.melody) {
    if (n.pitch !== null) out.push({ voice: 'melody', startBeat: at, beats: n.beats, midi: n.pitch });
    at += n.beats;
  }
  const t = bar.chord.triad;
  const arp = [t[0], t[1], t[2], t[1], t[0], t[1], t[2], t[1]];
  arp.forEach((midi, k) => out.push({ voice: 'arpeggio', startBeat: k * 0.5, beats: 0.5, midi }));
  out.push({ voice: 'bass', startBeat: 0, beats: 2, midi: bar.chord.root });
  out.push({ voice: 'bass', startBeat: 2, beats: 2, midi: bar.chord.fifth });
  return out;
}
