import { birthSentence } from './birthReport';
import { generateBirth } from './birth';
import { pickRandomGeneration } from './generationMixture';
import { appendHistory } from './history';
import { emptyPlay } from './playClock';
import { createRng } from './rng';
import { DEFAULT_BGM, type GameState, type GenerationChoice, type LifeLength, type ProfileId, type Settings, type Stats } from './types';

/** 출생 전 자리표시 스탯. 실제 값은 beginBirth가 채운다(건강은 0이 되지 않게 중립값). */
export const INITIAL_STATS: Stats = {
  education: 50,
  health: 50,
  happiness: 50,
  relationships: 50,
};

/** 첫 화면에서 처음 골라져 있는 세대 줄(「랜덤 세대」 — 처음 방문의 기본 선택, GS4)과 인생 길이(약 30분 ▲, FS5) */
export const DEFAULT_GENERATION: GenerationChoice = 'random';
export const DEFAULT_LIFE_LENGTH: LifeLength = 'short30';

export const DEFAULT_SETTINGS: Settings = {
  speed: 1,
  autoMode: false,
  generation: DEFAULT_GENERATION,
  lifeLength: DEFAULT_LIFE_LENGTH,
  bgm: { ...DEFAULT_BGM },
  theme: 'system',
  noteCards: true,
  // 설정 v5 (SPEC-005 SV2): 「무거운 장면 가리기」는 처음에 꺼져 있고(HV3 — 모든 장면 그대로, 형진 님 답 M12), 새 소식은 아직 본 적이 없다(빈 글자)
  gentle: false,
  notesSeen: '',
  // 설정 v6 (SPEC-004 MG1): 살아본 세대(GS10) · 내 출신 시도(RG3, 밝히지 않음) · 금액 보기(EY11, 당시 화폐)
  lived: [],
  homeRegion: null,
  moneyView: 'then',
};

/** 새 게임의 초기 상태. 시드는 주입한다(테스트·재현용). */
export function createInitialState(seed: number): GameState {
  const s = seed >>> 0;
  return {
    phase: 'title',
    generation: null,
    lifeLength: null,
    character: null,
    stats: { ...INITIAL_STATS },
    birthStats: null,
    age: 0,
    history: [],
    flags: [],
    seen: {},
    pending: null,
    lastChoiceAge: null,
    death: null,
    birthReport: null,
    peerSeed: null,
    paused: false,
    assets: null,
    familyFund: 0,
    seed: s,
    rngState: s,
  };
}

/**
 * 일시정지를 켜고 끈다 (DB3). 인생(life) 단계에서만 동작하고 값이 같으면 같은 객체를 돌려준다(연타·늦게 도착한 입력이 상태를 흔들지 않는다).
 * 일시정지 여부는 저장되는 판 상태다 — 「나가기」가 일시정지 상태로 저장하고(DB8), 새로고침해도 멈춘 채 열린다.
 */
export function setPaused(state: GameState, paused: boolean): GameState {
  return state.phase !== 'life' || state.paused === paused ? state : { ...state, paused };
}

/**
 * 엔딩 → 다시 태어나기: 새 시드로 새 판을 시작해 첫 화면(title)으로 돌아간다(SPEC-003 규칙 19). 이전 판은 이 상태로 대체되고 되돌릴 수 없다.
 * 세상·인생 길이는 판 상태가 아니라 설정에 있어 첫 화면에 마지막 선택이 그대로 눌려 있다.
 * ending 단계에서만 동작하므로 연타·더블탭이 와도 두 번째부터는 같은 상태를 돌려준다(두 판이 시작되지 않는다).
 * 시드는 호출하는 쪽(UI)이 정해 넘긴다 — core는 난수 원천을 직접 만들지 않는다. 설정(배속·자동 모드)은 세션에 있어 그대로 유지된다.
 */
export function rebirth(state: GameState, seed: number): GameState {
  return state.phase === 'ending' ? createInitialState(seed) : state;
}

/**
 * 「태어나기」: 첫 화면(title)에서 고른 세대 줄(`random`이면 지금 7세대를 같은 확률로 뽑는다, GS3)·인생 길이·(직접 골랐으면) 시도로 출생 결과를 **한 번에** 정해 저장한다(RL5). 시드 RNG만 사용한다.
 * 결과는 이 순간 확정되고 화면은 룰렛(roulette 단계)으로 넘어간다 — 룰렛은 이미 정해진 결과를 연출로 보여 줄 뿐이라(RL2) 도중·직후에 새로고침해도 결과가 같다.
 * 출생 연도는 GS7 가중으로 이때 보이지 않게 뽑힌다. title 단계에서만 동작하므로 연타해도 두 번 뽑히지 않는다. 인생 길이는 여기서 판에 고정된다(LM3).
 * 게임 데이터(출생 연도 표·이름 풀)가 아직 불러와지지 않았으면 같은 상태를 돌려준다(화면이 불러온 뒤에 부른다, MG8).
 */
export function beginBirth(
  state: GameState,
  choice: GenerationChoice | ProfileId = DEFAULT_GENERATION,
  lifeLength: LifeLength = DEFAULT_LIFE_LENGTH,
  regionPick: string | null = null,
): GameState {
  if (state.phase !== 'title') return state;
  const rng = createRng(state.rngState);
  // 랜덤 세대: 난수 1번으로 세대를 먼저 뽑고(같은 시드 → 같은 세대), 이어서 그 세대의 출생 결과를 정한다
  const fromRandom = choice === 'random';
  const generation: ProfileId = choice === 'random' ? pickRandomGeneration(rng) : choice;
  const { character, stats, report, peerSeed } = generateBirth(rng, { generation, regionPick });
  const next: GameState = {
    ...state,
    phase: 'roulette',
    generation,
    lifeLength,
    character,
    stats,
    birthStats: { ...stats },
    birthReport: report,
    peerSeed,
    age: 0,
    history: [],
    flags: [],
    seen: {},
    pending: null,
    lastChoiceAge: null,
    death: null,
    // 새 판은 집안 살림·자산이 비어 있다 — 첫 화면 상태에 무엇이 들어 있었든 20세 자산에 새어 들지 않는다(R-357)
    familyFund: 0,
    assets: null,
    rngState: rng.getState(),
  };
  // 선택 필드는 참일 때만 쓴다(없는 판의 저장은 그대로)
  const { regionPicked: _p, fromRandom: _f, ...rest } = next;
  void _p;
  void _f;
  return { ...rest, ...(regionPick !== null ? { regionPicked: true as const } : {}), ...(fromRandom ? { fromRandom: true as const } : {}) };
}

/**
 * 룰렛 → 출생신고(「출생신고 보기」). 룰렛 단계에서만 동작해 연타해도 한 번이다. 출생 결과는 이미 정해져 있어 바뀌는 것은 화면 단계뿐이다.
 */
export function enterBirth(state: GameState): GameState {
  return state.phase === 'roulette' ? { ...state, phase: 'birth' } : state;
}

/** 출생신고 → 인생 진행(「살아가기」). 생애 연표의 첫 줄(출생)에 출생신고의 한 줄 서술문(BR3)을 남긴다. */
export function enterLife(state: GameState): GameState {
  if (state.phase !== 'birth' || state.character === null || state.birthReport === null || state.generation === null) return state;
  return {
    ...state,
    phase: 'life',
    history: appendHistory(state.history, {
      age: 0,
      kind: 'stage',
      text: birthSentence(state.character, state.birthReport),
    }),
    // 플레이 시간 기록이 인생과 함께 0에서 시작한다(SPEC-003 LM6, M8) — 새 판은 늘 0이고 다시 태어나기는 이 필드 없는 새 상태에서 시작한다. 누적은 UI의 타이머(ui/usePlayTimer.ts)가 한다.
    play: emptyPlay(),
  };
}
