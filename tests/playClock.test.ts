import { describe, expect, it } from 'vitest';
import {
  PLAY_MAX_COUNT,
  PLAY_MAX_MS,
  PLAY_TICK_MAX_MS,
  accruePlay,
  addResume,
  addSkip,
  createSession,
  displaySeconds,
  emptyPlay,
  enterLife,
  formatPlayClock,
  formatPlayTime,
  isCleanRun,
  parseGame,
  playBucketOf,
  playClockDatetime,
  playDisplayMs,
  playEqual,
  playNotBehind,
  readPlay,
  serializeGame,
  sessionReducer,
  spokenPlayClock,
  type GameState,
  type PlayBucket,
  type PlayInputs,
  type PlayTime,
} from '../src/core';
import { autoChooseArmed } from '../src/ui/decisionFold';
import { startLife } from '../scripts/simulateLib';

/**
 * 플레이 시간 타이머의 순수 부분 (SPEC-003 LM5·LM6, M8 — docs/data/content-M8.md 5절, 완료 기준 11~13): 버킷 판정 표(조합 전수), 누적기(시간 주입), 저장 검증·표시.
 * 시계(performance.now)·React는 만지지 않는다 — 타이머 훅(ui/usePlayTimer.ts)은 e2e/m8-playtime.spec.ts가 실제 브라우저에서 본다.
 */

const KEYS = ['superseded', 'showTitle', 'exitAsk', 'visible', 'paused', 'noteOpen', 'hasPending', 'folded'] as const;
type Flag = (typeof KEYS)[number];

/** 8개 조건의 모든 조합(256가지) */
function* combos(): Generator<Record<Flag, boolean>> {
  for (let bits = 0; bits < 1 << KEYS.length; bits++) {
    yield Object.fromEntries(KEYS.map((k, i) => [k, (bits & (1 << i)) !== 0])) as Record<Flag, boolean>;
  }
}
const inputs = (f: Record<Flag, boolean>, over: Partial<PlayInputs> = {}): PlayInputs => ({ timed: true, inLife: true, ...f, ...over });

/** 사람이 적은 기대값: 표(content-M8.md 5-1절)를 위에서부터 읽는 규칙 목록 */
function expectedBucket(f: Record<Flag, boolean>): PlayBucket {
  const rules: Array<[boolean, PlayBucket]> = [
    [f.superseded || f.showTitle || f.exitAsk, 'idle'], // 1 밀린 화면 · 첫 화면 다시 열기 · 나가기 확인
    [!f.visible, 'idle'], // 2 탭 가림
    [f.paused, 'idle'], // 3 일시정지
    [f.noteOpen, 'note'], // 4 기록 시트
    [f.hasPending && f.folded, 'fold'], // 5 결정 카드 대기 + 접힘
    [f.hasPending, 'decide'], // 6 결정 카드 대기 + 열림
    [true, 'hold'], // 7 그 밖
  ];
  return rules.find(([when]) => when)![1];
}

describe('playBucketOf: 버킷 판정 표 (완료 기준 11)', () => {
  it('8개 조건 256가지 조합 전수가 사람이 적은 기대값과 같다', () => {
    let n = 0;
    for (const f of combos()) {
      expect(playBucketOf(inputs(f)), JSON.stringify(f)).toBe(expectedBucket(f));
      n++;
    }
    expect(n).toBe(256);
  });

  it('표의 핵심 칸: 열린 일반 상태 = hold, 결정 카드 = decide, 접힘 = fold, 기록 시트 = note, 일시정지·탭 가림·나가기 확인 = idle', () => {
    const base: Record<Flag, boolean> = { superseded: false, showTitle: false, exitAsk: false, visible: true, paused: false, noteOpen: false, hasPending: false, folded: false };
    expect(playBucketOf(inputs(base))).toBe('hold');
    expect(playBucketOf(inputs({ ...base, hasPending: true }))).toBe('decide');
    expect(playBucketOf(inputs({ ...base, hasPending: true, folded: true }))).toBe('fold');
    expect(playBucketOf(inputs({ ...base, noteOpen: true }))).toBe('note');
    expect(playBucketOf(inputs({ ...base, paused: true }))).toBe('idle');
    expect(playBucketOf(inputs({ ...base, visible: false }))).toBe('idle');
    expect(playBucketOf(inputs({ ...base, exitAsk: true }))).toBe('idle');
    expect(playBucketOf(inputs({ ...base, showTitle: true }))).toBe('idle');
    expect(playBucketOf(inputs({ ...base, superseded: true }))).toBe('idle');
    // 일시정지 중에 열려 있는 결정 카드를 읽어도 센 시간이 아니다 (3이 5·6보다 앞)
    expect(playBucketOf(inputs({ ...base, paused: true, hasPending: true }))).toBe('idle');
    // 접힌 카드라도 기록 시트가 열렸으면 note (4가 5보다 앞)
    expect(playBucketOf(inputs({ ...base, noteOpen: true, hasPending: true, folded: true }))).toBe('note');
  });

  it('인생 단계가 아니거나(룰렛·출생신고·엔딩) 시간 기록이 없는 판(M8 이전 저장)은 어떤 조합에서도 세지 않는다 (off)', () => {
    for (const f of combos()) {
      expect(playBucketOf(inputs(f, { inLife: false })), JSON.stringify(f)).toBe('off');
      expect(playBucketOf(inputs(f, { timed: false })), JSON.stringify(f)).toBe('off');
    }
  });

  it('불변식: 연출 시계의 running이 참인 모든 상태는 hold이고 (그 역도 성립), 자동 선택 타이머가 걸린 상태는 모두 decide다 — 시계와 타이머가 서로 다른 값을 읽지 않는다', () => {
    for (const f of combos()) {
      // App.tsx의 시계 조건과 같은 식: inLife = life && !showTitle && !superseded, running = inLife && visible && !paused && !exitAsk && !noteOpen && pending === null
      const inLife = !f.showTitle && !f.superseded;
      const running = inLife && f.visible && !f.paused && !f.exitAsk && !f.noteOpen && !f.hasPending;
      const bucket = playBucketOf(inputs(f));
      expect(bucket === 'hold', `running ${running} ⇔ hold ${JSON.stringify(f)}`).toBe(running);
      for (const autoMode of [true, false]) {
        const armed = autoChooseArmed({ autoMode, hasPending: f.hasPending, superseded: f.superseded, visible: f.visible, showTitle: f.showTitle, paused: f.paused, exitAsk: f.exitAsk, folded: f.folded, noteOpen: f.noteOpen });
        if (armed) expect(bucket, `자동 선택이 걸렸다 ${JSON.stringify(f)}`).toBe('decide');
        if (autoMode && bucket === 'decide') expect(armed, `decide인데 자동 선택이 안 걸렸다 ${JSON.stringify(f)}`).toBe(true);
      }
    }
  });
});

describe('accruePlay: 누적기 (시간 주입 — 완료 기준 12)', () => {
  const ctx = { speedOne: true, auto: false };
  /** 1초 틱을 n번 더한다 */
  const run = (p: PlayTime, bucket: PlayBucket, ticks: number, c = ctx): PlayTime => {
    let cur = p;
    for (let i = 0; i < ticks; i++) cur = accruePlay(cur, bucket, 1000, c);
    return cur;
  };

  it('일시정지·탭 가림·나가기(idle)에서는 표시 시간(hold + decide)이 늘지 않고 idle만 는다', () => {
    const p = run(emptyPlay(), 'idle', 30);
    expect(playDisplayMs(p)).toBe(0);
    expect(p.hold + p.decide + p.fold + p.note).toBe(0);
    expect(p.idle).toBe(30_000);
  });

  it('카드를 접어 둔 시간은 fold에만, 기록 시트가 열린 시간은 note에만 쌓이고 표시 시간은 그대로다', () => {
    const folded = run(emptyPlay(), 'fold', 20);
    expect(folded).toMatchObject({ fold: 20_000, hold: 0, decide: 0, note: 0, idle: 0 });
    expect(playDisplayMs(folded)).toBe(0);
    const noted = run(emptyPlay(), 'note', 20);
    expect(noted).toMatchObject({ note: 20_000, hold: 0, decide: 0, fold: 0 });
    expect(playDisplayMs(noted)).toBe(0);
  });

  it('연출(hold)과 결정 읽기(decide)는 표시 시간에 들어간다: 표시 = hold + decide', () => {
    let p = run(emptyPlay(), 'hold', 90);
    p = run(p, 'decide', 20, ctx);
    p = run(p, 'fold', 15, ctx);
    expect(p.hold).toBe(90_000);
    expect(p.decide).toBe(20_000);
    expect(playDisplayMs(p)).toBe(110_000);
    expect(formatPlayClock(playDisplayMs(p))).toBe('01:50');
  });

  it('한 번에 5초를 넘게 건너뛴 틱은 5초만 센다 (기기 절전·디버거 정지·가려진 탭의 늦은 타이머 방어)', () => {
    expect(PLAY_TICK_MAX_MS).toBe(5000);
    expect(accruePlay(emptyPlay(), 'hold', 60_000, ctx).hold).toBe(5000);
    expect(accruePlay(emptyPlay(), 'decide', 5000, ctx).decide).toBe(5000);
    expect(accruePlay(emptyPlay(), 'decide', 5001, ctx).decide).toBe(5000);
    expect(accruePlay(emptyPlay(), 'decide', 4999, ctx).decide).toBe(4999);
    expect(accruePlay(emptyPlay(), 'idle', 3_600_000, ctx).idle).toBe(5000);
  });

  it('이상한 시간(0·음수·NaN·Infinity·소수)은 같은 객체이거나 정수 ms로 반올림된다, off는 세지 않는다', () => {
    const p = emptyPlay();
    for (const dt of [0, -5, Number.NaN, Number.NEGATIVE_INFINITY]) expect(accruePlay(p, 'hold', dt, ctx), String(dt)).toBe(p);
    expect(accruePlay(p, 'hold', Number.POSITIVE_INFINITY, ctx), 'Infinity').toBe(p);
    expect(accruePlay(p, 'hold', 0.4, ctx)).toBe(p); // 반올림해서 0이면 그대로
    expect(accruePlay(p, 'hold', 1000.6, ctx).hold).toBe(1001);
    expect(accruePlay(p, 'off', 3000, ctx)).toBe(p);
    // 원본은 바뀌지 않는다
    const before = { ...p };
    accruePlay(p, 'hold', 1000, ctx);
    expect(p).toEqual(before);
  });

  it('1배속이 아닌 hold는 offSpeed에도 쌓이고, 자동 모드 중의 hold·decide는 auto에도 쌓인다 (깨끗한 판 표시)', () => {
    const fast = run(emptyPlay(), 'hold', 10, { speedOne: false, auto: false });
    expect(fast).toMatchObject({ hold: 10_000, offSpeed: 10_000, auto: 0 });
    expect(isCleanRun(fast)).toBe(false);
    const auto = run(run(emptyPlay(), 'hold', 4, { speedOne: true, auto: true }), 'decide', 3, { speedOne: true, auto: true });
    expect(auto).toMatchObject({ hold: 4000, decide: 3000, auto: 7000, offSpeed: 0 });
    expect(isCleanRun(auto)).toBe(false);
    // 결정 읽기에서의 배속·일시정지 중의 자동 모드는 세지 않는다
    expect(run(emptyPlay(), 'decide', 5, { speedOne: false, auto: false }).offSpeed).toBe(0);
    expect(run(emptyPlay(), 'idle', 5, { speedOne: false, auto: true })).toMatchObject({ offSpeed: 0, auto: 0 });
    expect(isCleanRun(run(emptyPlay(), 'hold', 10, ctx))).toBe(true);
    expect(isCleanRun(addSkip(emptyPlay()))).toBe(false);
  });

  it('개발 서버의 시간 배율(timeScale)은 hold에만 곱한다 (연출 시계만 빨라지므로) — 5초 상한 뒤에 곱한다', () => {
    expect(accruePlay(emptyPlay(), 'hold', 1000, { speedOne: true, auto: false, timeScale: 100 }).hold).toBe(100_000);
    expect(accruePlay(emptyPlay(), 'hold', 60_000, { speedOne: true, auto: false, timeScale: 100 }).hold).toBe(500_000);
    expect(accruePlay(emptyPlay(), 'decide', 1000, { speedOne: true, auto: false, timeScale: 100 }).decide).toBe(1000);
    expect(accruePlay(emptyPlay(), 'hold', 1000, { speedOne: true, auto: false, timeScale: 0 }).hold).toBe(1000); // 이상한 배율은 1
  });

  it('필드마다 24시간 상한을 넘지 않는다', () => {
    const near: PlayTime = { ...emptyPlay(), hold: PLAY_MAX_MS - 100 };
    expect(accruePlay(near, 'hold', 1000, ctx).hold).toBe(PLAY_MAX_MS);
  });

  it('addSkip·addResume은 횟수를 하나 올리고 상한을 넘지 않는다', () => {
    expect(addSkip(emptyPlay()).skips).toBe(1);
    expect(addResume(addResume(emptyPlay())).resumes).toBe(2);
    expect(addSkip({ ...emptyPlay(), skips: PLAY_MAX_COUNT }).skips).toBe(PLAY_MAX_COUNT);
  });

  it('한 판의 합성 시퀀스: 연출 90초 → 결정 읽기 20초 → 접기 15초 → 일시정지 30초 → 기록 12초 → 다시 연출 5초 — 표시 시간은 연출 + 결정 읽기만', () => {
    let p = emptyPlay();
    const seq: Array<[PlayBucket, number]> = [['hold', 90], ['decide', 20], ['fold', 15], ['idle', 30], ['note', 12], ['hold', 5]];
    for (const [bucket, sec] of seq) p = run(p, bucket, sec);
    expect(p).toMatchObject({ hold: 95_000, decide: 20_000, fold: 15_000, idle: 30_000, note: 12_000 });
    expect(formatPlayClock(playDisplayMs(p))).toBe('01:55');
  });
});

describe('readPlay: 저장 검증 — 이상한 값은 undefined (완료 기준 12)', () => {
  const ok = (): PlayTime => ({ hold: 1000, decide: 2000, fold: 3000, note: 4000, idle: 5000, offSpeed: 0, auto: 0, skips: 2, resumes: 1 });

  it('올바른 기록은 같은 값으로 읽히고, JSON 왕복 뒤에도 같다', () => {
    expect(readPlay(ok())).toEqual(ok());
    expect(readPlay(JSON.parse(JSON.stringify(ok())))).toEqual(ok());
    expect(readPlay(emptyPlay())).toEqual(emptyPlay());
    expect(playEqual(readPlay(ok())!, ok())).toBe(true);
  });

  it('음수·문자열·소수·NaN(JSON에서는 null)·상한 초과(1e308·24시간 넘음)·배열·null·키 모자람/넘침은 모두 undefined다', () => {
    const bad: unknown[] = [
      { ...ok(), hold: -1 },
      { ...ok(), hold: '1000' },
      { ...ok(), decide: 1.5 },
      { ...ok(), fold: Number.NaN },
      { ...ok(), note: null },
      { ...ok(), idle: 1e308 },
      { ...ok(), hold: PLAY_MAX_MS + 1 },
      { ...ok(), skips: PLAY_MAX_COUNT + 1 },
      { ...ok(), resumes: -2 },
      { ...ok(), offSpeed: Number.POSITIVE_INFINITY },
      { ...ok(), auto: [] },
      { ...ok(), extra: 1 },
      [1, 2, 3],
      [],
      null,
      undefined,
      'play',
      7,
      true,
      {},
    ];
    for (const v of bad) expect(readPlay(v), JSON.stringify(v)).toBeUndefined();
    const missing = ok() as unknown as Record<string, unknown>;
    delete missing.resumes;
    expect(readPlay(missing)).toBeUndefined();
  });

  it('경계값: 0과 24시간(정확히)은 허용, -0은 0으로 읽힌다', () => {
    expect(readPlay({ ...ok(), hold: PLAY_MAX_MS })?.hold).toBe(PLAY_MAX_MS);
    expect(Object.is(readPlay({ ...ok(), hold: -0 })?.hold, 0)).toBe(true);
  });

  it('playNotBehind: 모든 필드가 줄지 않았을 때만 참이다', () => {
    const a = ok();
    expect(playNotBehind(a, a)).toBe(true);
    expect(playNotBehind({ ...a, hold: a.hold + 1 }, a)).toBe(true);
    expect(playNotBehind({ ...a, hold: a.hold - 1 }, a)).toBe(false);
    expect(playNotBehind({ ...a, skips: a.skips - 1 }, a)).toBe(false);
  });
});

describe('parseGame: play는 선택 필드 — 없으면 시간을 재지 않은 판, 이상하면 그 필드만 버리고 판은 그대로 연다 (스키마 v8 유지 — LD-6)', () => {
  const life = (): GameState => startLife(4242, 'present');
  const withRaw = (patch: (d: Record<string, unknown>) => void): string => {
    const env = JSON.parse(serializeGame(life())) as { version: number; data: Record<string, unknown> };
    patch(env.data);
    return JSON.stringify(env);
  };

  it('인생이 시작되면 play가 0으로 생긴다 (enterLife) — 새 판은 0에서 시작', () => {
    expect(life().play).toEqual(emptyPlay());
    // 첫 화면(title)·룰렛에는 없다
    expect(startLife(1, 'past').play).toEqual(emptyPlay());
  });

  it('직렬화 왕복: play가 그대로 돌아온다', () => {
    const g: GameState = { ...life(), play: { hold: 61_000, decide: 5_000, fold: 1, note: 2, idle: 3, offSpeed: 4, auto: 5, skips: 6, resumes: 7 } };
    expect(parseGame(serializeGame(g))).toEqual(g);
  });

  it('필드가 없는 v8 저장(M8 이전)은 그대로 유효하고 play는 없다', () => {
    const raw = withRaw((d) => {
      delete d.play;
    });
    const g = parseGame(raw);
    expect(g).not.toBeNull();
    expect(g!.play).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(g!, 'play')).toBe(false);
  });

  it('이상한 값(음수·문자열·1e308·NaN·배열·null·소수·키 넘침)은 그 필드만 버린다 — 판의 나머지는 그대로다', () => {
    const base = life();
    for (const bad of [{ ...emptyPlay(), hold: -5 }, { ...emptyPlay(), hold: '12' }, { ...emptyPlay(), idle: 1e308 }, { ...emptyPlay(), note: null }, [1, 2], null, { ...emptyPlay(), decide: 0.5 }, { ...emptyPlay(), zzz: 1 }, 'x']) {
      const g = parseGame(withRaw((d) => (d.play = bad)));
      expect(g, JSON.stringify(bad)).not.toBeNull();
      expect(g!.play, JSON.stringify(bad)).toBeUndefined();
      expect({ ...g!, play: undefined }, JSON.stringify(bad)).toEqual({ ...base, play: undefined });
    }
  });

  it('인생·엔딩이 아닌 단계(첫 화면·룰렛·출생신고)에 붙은 play는 버린다', () => {
    const roulette = startLife(1, 'present');
    for (const phase of ['roulette', 'birth'] as const) {
      const env = JSON.parse(serializeGame({ ...roulette, phase, history: [], age: 0 })) as { version: number; data: Record<string, unknown> };
      env.data.play = emptyPlay();
      const g = parseGame(JSON.stringify(env));
      expect(g, phase).not.toBeNull();
      expect(g!.play, phase).toBeUndefined();
    }
  });

  it('엔딩에서도 play가 보존된다 (엔딩에서 새로고침해도 같은 값)', () => {
    let g: GameState = life();
    for (let i = 0; i < 300 && g.phase === 'life'; i++) g = sessionReducer(createSession(g, { speed: 1, autoMode: true }), g.pending !== null ? { type: 'autoChoose', key: g.pending.key } : { type: 'advance', fromAge: g.age }).game;
    expect(g.phase).toBe('ending');
    const ended: GameState = { ...g, play: { ...emptyPlay(), hold: 123_456, decide: 7_890 } };
    expect(parseGame(serializeGame(ended))!.play).toEqual(ended.play);
  });
});

describe('syncPlay (세션 reducer): 타이머가 쌓은 기록을 판 상태로 옮긴다', () => {
  const session = () => createSession(startLife(4242, 'present'), { speed: 1, autoMode: false });
  const play = (hold: number): PlayTime => ({ ...emptyPlay(), hold });

  it('인생 단계에서 같은 판의 늘어난 기록을 받는다, tick은 그대로', () => {
    const s = session();
    const next = sessionReducer(s, { type: 'syncPlay', seed: s.game.seed, play: play(12_000) });
    expect(next.game.play).toEqual(play(12_000));
    expect(next.tick).toBe(s.tick);
    expect({ ...next.game, play: undefined }).toEqual({ ...s.game, play: undefined }); // 인생은 그대로
  });

  it('같은 기록·줄어드는 기록·다른 판의 기록·이상한 기록·엔딩의 기록은 같은 객체를 돌려준다 (늦게 도착한 오래된 기록이 새 판에 새지 않는다)', () => {
    const s = sessionReducer(session(), { type: 'syncPlay', seed: session().game.seed, play: play(12_000) });
    expect(sessionReducer(s, { type: 'syncPlay', seed: s.game.seed, play: play(12_000) })).toBe(s);
    expect(sessionReducer(s, { type: 'syncPlay', seed: s.game.seed, play: play(11_999) })).toBe(s);
    expect(sessionReducer(s, { type: 'syncPlay', seed: s.game.seed + 1, play: play(99_000) })).toBe(s);
    expect(sessionReducer(s, { type: 'syncPlay', seed: s.game.seed, play: { ...play(99_000), hold: -1 } })).toBe(s);
    expect(sessionReducer(s, { type: 'syncPlay', seed: s.game.seed, play: { ...play(99_000), skips: Number.NaN } })).toBe(s);
    // 시간 기록이 없는 판(M8 이전 저장)은 받지 않는다
    const legacy = { ...s, game: { ...s.game, play: undefined } };
    expect(sessionReducer(legacy, { type: 'syncPlay', seed: legacy.game.seed, play: play(1000) })).toBe(legacy);
    // 인생 단계가 아니면(출생신고) 받지 않는다
    const birth = { ...s, game: { ...s.game, phase: 'birth' as const } };
    expect(sessionReducer(birth, { type: 'syncPlay', seed: birth.game.seed, play: play(99_000) })).toBe(birth);
  });

  it('enterLife 직후의 0 기록과 새 판(다시 태어나기)은 이전 판의 기록을 이어받지 않는다', () => {
    const fresh = enterLife({ ...startLife(77, 'past'), phase: 'birth', history: [] });
    expect(fresh.play).toEqual(emptyPlay());
  });
});

describe('표시: formatPlayClock · playClockDatetime (완료 기준 13)', () => {
  it('mm:ss — 0:59 → 00:59, 61분 5초 → 61:05, 100분 → 100:00, 초 이하는 버린다', () => {
    expect(formatPlayClock(59_000)).toBe('00:59');
    expect(formatPlayClock(61 * 60_000 + 5_000)).toBe('61:05');
    expect(formatPlayClock(100 * 60_000)).toBe('100:00');
    expect(formatPlayClock(27 * 60_000 + 46_900)).toBe('27:46');
    expect(formatPlayClock(0)).toBe('00:00');
    expect(formatPlayClock(999)).toBe('00:00');
    expect(formatPlayClock(PLAY_MAX_MS * 2)).toBe('2880:00');
  });

  it('이상한 값(음수·NaN·Infinity)은 00:00이다', () => {
    for (const ms of [-1, Number.NaN, Number.NEGATIVE_INFINITY]) expect(formatPlayClock(ms), String(ms)).toBe('00:00');
  });

  it('displaySeconds: 버킷별로 초를 버린 뒤 더한다 — hold 910.9초 + decide 756.9초 = 910 + 756 = 1666초(27:46), 통째로 버린 1667초(27:47)가 아니다 (D-94)', () => {
    const p = { ...emptyPlay(), hold: 910_900, decide: 756_900 };
    expect(displaySeconds(p)).toBe(1666);
    expect(formatPlayClock(playDisplayMs(p))).toBe('27:46');
    expect(Math.floor((p.hold + p.decide) / 1000)).toBe(1667); // 통째 버림이면 1초 어긋난다
    expect(displaySeconds(emptyPlay())).toBe(0);
    // 분해 두 값(각각 버림)의 합이 늘 표시값이다
    for (const [hold, decide] of [[1_999, 1_999], [59_999, 59_999], [3_599_999, 1], [123_456, 789_012]]) {
      expect(displaySeconds({ ...emptyPlay(), hold, decide })).toBe(Math.floor(hold / 1000) + Math.floor(decide / 1000));
    }
  });

  it('formatPlayTime·spokenPlayClock: 세 꼴(mm:ss · 「N분 N초」 · PT) — 59초 / 3665초 / 6000초 (D-94 단위 표)', () => {
    expect(formatPlayTime(59)).toEqual({ text: '00:59', spoken: '0분 59초', iso: 'PT0M59S' });
    expect(formatPlayTime(3665)).toEqual({ text: '61:05', spoken: '61분 5초', iso: 'PT61M5S' });
    expect(formatPlayTime(6000)).toEqual({ text: '100:00', spoken: '100분 0초', iso: 'PT100M0S' });
    expect(spokenPlayClock(27 * 60_000 + 46_900)).toBe('27분 46초');
    expect(spokenPlayClock(Number.NaN)).toBe('0분 0초');
  });

  it('time 요소용 기간 문자열: 27분 46초 = PT27M46S', () => {
    expect(playClockDatetime(27 * 60_000 + 46_000)).toBe('PT27M46S');
    expect(playClockDatetime(0)).toBe('PT0M0S');
    expect(playClockDatetime(3_661_000)).toBe('PT61M1S');
  });

  // 이어하기 횟수는 앱이 뜰 때(`resumeGame`, 삭제 — R-417) 올리지 않고 그 탭에서 hold·decide가 처음 쌓일 때 core/playTimer.ts가 올린다 → tests/playTimer.test.ts
});
