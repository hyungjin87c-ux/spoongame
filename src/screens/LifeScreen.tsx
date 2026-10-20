import { useEffect, useRef, type RefObject } from 'react';
import { SPEEDS, buildFeedbackUrl, calendarYear, feedbackFieldsOf, noteCount, type BgmSettings, type EventPool, type NoteCardDef, type Settings, type Speed, type ThemeChoice, type TickInfo } from '../core';
import { BGM_VOLUME_MAX, BGM_VOLUME_MIN } from '../core/types';
import { EVENT_POOL } from '../data/events';
import { DASH_TEXT } from '../data/dashText';
import { BUILD_LABEL, REPO_URL } from '../buildInfo';
import { HeaderLogo, Icon, Sprite } from '../ui/Brand';
import { FeedbackLink } from '../ui/FeedbackLink';
import { GuardedButton } from '../ui/GuardedButton';
import { AssetsCard, FamilyCard, PeersNowCard, ProfileCard, StatusCard, type LifeGame } from '../ui/dash/Cards';
import { DecisionCard, DecisionFold, DecisionInline, DecisionSheet, useDecisionModel } from '../ui/dash/DecisionCard';
import { LogCard } from '../ui/dash/LogCard';
import { ParentCard, useParentCardModel } from '../ui/dash/ParentCard';
import { NoteSheet } from '../ui/dash/NoteSheet';
import { Glue } from '../ui/Glue';
import { useExitAskFit, useForceReleaseRef } from '../ui/exitAsk';
import { revealCard } from '../ui/focusReveal';
import { useStickyHead } from '../ui/headRelease';
import { decideNoteFocus, type NoteFocusVia } from '../ui/noteFocus';
import { isDarkApplied, useSystemDark } from '../ui/theme';
import { useBottomBar, useScrollTopOnMount, useThemeSurface } from '../ui/useBottomBar';
import { useLifeFocus } from '../ui/useFocus';
import type { YearClock } from '../ui/useYearClock';
import { YearRow } from '../ui/YearBar';

/**
 * 인생 화면 = 대시보드 (SPEC-003 DB1~DB14, M4). 시안 docs/design/mockups/dashboard-adult.html·dashboard-infant.html, 규칙은 docs/design/design-system.md 6·10·11절.
 *
 * 구성: 헤더(로고 · 이름 · 나이 · 올해 진행률 바 — sticky 고정 요소, `ui/headRelease.ts`) → 진행 줄(일시정지·1·2·4·8배·다음 결정으로·자동 모드 — 모바일에서는 화면 아래에 고정된 띠, `ui/useBottomBar.ts`)과
 * 도구 줄(BGM · 생각 남기기 · 다크 모드 · 의견 보내기 · 나가기) → 본문. 폭 ≥ 960px은 3열(왼쪽: 프로필·상태·자산 현황 / 가운데: 중대 결정 카드·인생 기록 / 오른쪽: 식구·같은 해 태어난 사람들),
 * 좁은 화면은 1열(프로필 → 상태 → 자산 → 인생 기록 → 식구 → 또래; 결정을 기다리는 카드는 맨 위로 올라온다 — 곧바로 눈에 띄고 포커스가 가 닿는다).
 *
 * 이 화면은 계산하지 않는다: 값은 core의 순수 함수(profile·family·peerNow·progress·feedback)가 만들고, 시간은 App이 돌리는 올해 시계(`ui/useYearClock.ts`)가 흘린다.
 * 중대 결정 카드(M7b, `ui/dash/DecisionCard.tsx`): 자동 모드가 꺼져 있으면 **모달 시트**(바깥 전부 `inert`, Esc = 카드 접기), 켜져 있으면 **비모달 인라인 카드**(가운데 열 맨 위). 접으면 그 자리에 접힌 띠가 생기고
 * 접힘 상태는 `App`이 갖는다(U10). 포커스는 `ui/useFocus.ts#decideLifeFocus`(8순간 × 자동 2 × 위치 3 = 48칸)가 한 곳에서 정한다.
 */

/** 하단 컨트롤(진행 줄)과 도구 줄의 입력 가드 키. 상수라서 가드는 이 화면이 새로 뜰 때(마운트)만 걸리고, 플레이 중 배속을 누르거나 나이가 오를 때 다시 닫히지 않는다(R-035). */
export const CONTROLS_GUARD_KEY = 'life-controls';

/** 진행 줄·도구 줄의 입력 가드 키 — 화면이 뜰 때 + 가드 세대가 오를 때(접기·다시 열기·시트 닫힘, M7c r2 F-1)마다 달라진다 */
export function controlsGuardKey(guardEpoch: number): string {
  return `${CONTROLS_GUARD_KEY}:${guardEpoch}`;
}
/** 나가기 확인 단계의 두 버튼이 같은 순간에 뜨므로 한 키를 같이 쓴다 */
const EXIT_GUARD_KEY = 'life-exit';

export type { LifeGame };

/**
 * 지금 열려 있는 기록 시트 (App이 갖는다 — `noteOpen`, M7c). 저절로 뜬 카드(`via: 'auto'`, `card`가 있다)이거나 도구 줄 「생각 남기기」로 연 수동 기록(`via: 'manual'`, `card: null`).
 * `token`은 시트를 새로 열 때마다 오르는 값으로 입력 가드 키에 들어간다.
 */
export interface NoteSheetState {
  via: NoteFocusVia;
  card: NoteCardDef | null;
  token: number;
}

interface Props {
  game: LifeGame;
  settings: Settings;
  pool?: EventPool;
  /**
   * 직전에 처리한 걸음(App의 세션 `tick`, 저장하지 않으며 새로고침 직후에는 null). 부모님이 정한·흘러간 해의 결과 연출 동안 비모달 카드(`ParentCard`)를 파생하는 데 쓴다 — 카드는 이 틱에서만 나온다(PD5·PD7-5). 기본 null(카드 없음)
   */
  tick?: TickInfo | null;
  /** 올해 진행률 시계 (App이 `useYearClock`으로 만든다) */
  clock: YearClock;
  /** 나가기 확인 단계가 열려 있는가 (App이 갖는다 — 열려 있는 동안 시계도 멈춘다) */
  exitOpen: boolean;
  onExitOpen: (open: boolean) => void;
  /** 대기 중인 중대 결정 카드가 접혀 있는가 (App이 갖는다 — M7c 카드가 읽는다, U10). 기본 false(열림) */
  folded?: boolean;
  /**
   * 입력 가드 세대 — 접기·다시 열기 횟수에 사용자가 시트(기록·결정)를 닫은 횟수를 더한 값(App이 갖는다). 입력 가드 키에 들어가, 이 값이 오르는 **그 렌더에서** 진행 줄·도구 줄·결정 카드·접힌 띠의 모든 가드 버튼이
   * 다시 400ms 닫힌다(U9; M7c r2 F-1). 접기·다시 열기·시트 닫힘 직후 같은 자리에 드러나는 컨트롤이 더블탭의 둘째 탭에 눌리지 않게 한다. 기본 0
   */
  guardEpoch?: number;
  onFold?: () => void;
  onReopen?: () => void;
  /**
   * 대기 중인 가린 결정 카드를 펼쳤는가 (App이 갖는다 — 접힘처럼 UI 상태일 뿐 저장하지 않고, 설정이 바뀌면 초기화된다, SPEC-005 M19). 무거운 장면이 아니거나 설정이 꺼져 있으면 뜻이 없다. 기본 false
   */
  veilOpened?: boolean;
  /** 가린 카드의 「펼쳐서 읽기」 */
  onVeilOpen?: () => void;
  /** 가린 카드의 「이번에는 자동으로 고르기」 — 지금의 자동 선택 성향으로 이 카드를 한 번 고른다 */
  onAutoPick?: (key: string) => void;
  /** 열려 있는 기록 시트 (없으면 null) — 떠 있는 동안 바깥은 inert, 시계·자동 선택은 App이 멈춘다 */
  noteSheet?: NoteSheetState | null;
  /** 도구 줄 「생각 남기기」 */
  onOpenNote?: () => void;
  /** 시트의 「1. 적어두고 살기」 (입력란의 값 — 정리 전) */
  onNoteSave?: (text: string) => void;
  /** 시트의 「2. 마음속에 담고 살기」·40개 안내의 「닫기」 */
  onNoteDismiss?: () => void;
  /** 시트의 「저절로 뜨는 기록 카드 끄기/켜기」 */
  onNoteCards?: (on: boolean) => void;
  onChoose: (key: string, choiceId: string) => void;
  onSkip: () => void;
  onSpeed: (speed: Speed) => void;
  onAuto: (auto: boolean) => void;
  onPause: (paused: boolean) => void;
  onBgm: (bgm: Partial<BgmSettings>) => void;
  onTheme: (theme: ThemeChoice) => void;
  /** 확인 단계를 거친 뒤에만 불린다 (일시정지 상태로 저장하고 첫 화면으로) */
  onExit: () => void;
  /** 가상 인구 계산에 쓸 시각(에포크 분). 없으면 이 기기의 시계. 테스트가 고정값을 넣는다. */
  minute?: number;
  /** 의견 보내기 주소를 만들 저장소 주소·빌드 표기(테스트 주입). 없으면 빌드 설정의 값. */
  repoUrl?: string;
  buildLabel?: string;
}

interface ControlsProps {
  speed: Speed;
  autoMode: boolean;
  paused: boolean;
  /** 선택지가 대기 중인가 (대기 중에는 "다음 결정으로"를 누를 수 없다) */
  hasPending: boolean;
  containerRef?: RefObject<HTMLDivElement>;
  /** 입력 가드 키 — 기본 CONTROLS_GUARD_KEY(화면이 뜰 때만 걸린다). LifeScreen은 접기·다시 열기 횟수를 덧붙여 그 직후에도 걸리게 한다 */
  guardKey?: string;
  onSpeed: (speed: Speed) => void;
  onSkip: () => void;
  onAuto: (auto: boolean) => void;
  onPause: (paused: boolean) => void;
}

/** "다음 결정으로"를 누를 수 없는 때: 선택지 대기 중이거나 자동 모드(자동 모드의 선택은 타이머가 한다, R-038) */
export function isSkipBlocked(autoMode: boolean, hasPending: boolean): boolean {
  return autoMode || hasPending;
}

/** "다음 결정으로"의 사유를 담은 숨은 설명 요소의 id (aria-describedby가 가리킨다, R-056) */
export const SKIP_REASON_ID = 'skip-reason';

/**
 * 비활성 "다음 결정으로"가 왜 눌리지 않는지 보조기기에 알리는 문구 (R-056). 누를 수 있으면 null.
 * 자동 모드가 선택지 대기보다 먼저다: 자동 모드에서는 선택지가 떠 있어도 "자동으로 정해진다"가 더 정확한 사유다(선택지는 곧 스스로 고른다).
 */
export function skipBlockedReason(autoMode: boolean, hasPending: boolean): string | null {
  if (autoMode) return '자동 모드에서는 선택지를 스스로 고르므로 누를 수 없습니다.';
  if (hasPending) return '선택지가 나와 있어 먼저 하나를 골라야 합니다.';
  return null;
}

/**
 * 진행 줄(일시정지/다시 진행 · 1·2·4·8배 · 다음 결정으로 · 자동 모드). 훅이 없는 순수 표시 컴포넌트라 요소 트리를 그대로 단위 테스트한다(R-005).
 *  - 일시정지 포함 7개 모두 GuardedButton + 상수 키 CONTROLS_GUARD_KEY: 화면이 뜬 직후 INPUT_GUARD_MS 동안 입력을 무시한다(R-035): "살아가기"·"이 탭에서 이어하기"
 *    더블클릭의 둘째 입력이 같은 좌표의 일시정지/속도/다음 결정으로/자동 모드에 떨어지는 것을 막는다. 키가 상수라 이후 플레이 중에는 다시 닫히지 않는다.
 *  - "다음 결정으로"는 누를 수 없을 때 disabled가 아니라 aria-disabled(포커스는 받고 입력은 무시)다 — 그래야 선택지가 뜨든 사라지든 이 그룹의 Tab 순서가
 *    변하지 않는다. disabled면 Tab 순서에서 빠져, 포커스가 8배 버튼에 있다가 선택지가 뜨면 다음 Tab이 "자동 모드"에 닿아 Space가 자동 모드를 켜 버린다(R-036).
 *  - 일시정지 버튼은 이름이 「일시정지」 ↔ 「다시 진행」으로 바뀐다(아이콘도 교체) — 이름이 상태를 전하므로 aria-pressed를 따로 쓰지 않는다(copy.md).
 */
export function LifeControls({ speed, autoMode, paused, hasPending, containerRef, guardKey = CONTROLS_GUARD_KEY, onSpeed, onSkip, onAuto, onPause }: ControlsProps) {
  const skipReason = skipBlockedReason(autoMode, hasPending);
  return (
    <div className="controls-fixed" role="group" aria-label={DASH_TEXT.controlsGroup} data-testid="controls" ref={containerRef}>
      <div className="controls__speed">
        <GuardedButton guardKey={guardKey} className="btn btn--sm" data-testid="pause" data-paused={paused ? 'true' : 'false'} onClick={() => onPause(!paused)}>
          <Icon name={paused ? 'i-play' : 'i-pause'} className="icon--sm" />
          <span>{paused ? DASH_TEXT.play : DASH_TEXT.pause}</span>
        </GuardedButton>
        {SPEEDS.map((s) => (
          <GuardedButton key={s} guardKey={guardKey} className="btn btn--sm" aria-pressed={speed === s} data-speed={s} onClick={() => onSpeed(s)}>
            {s}
            {DASH_TEXT.speedUnit}
          </GuardedButton>
        ))}
      </div>
      <div className="controls__more">
        <GuardedButton
          guardKey={guardKey}
          className="btn btn--sm btn--secondary"
          data-testid="skip"
          aria-disabled={isSkipBlocked(autoMode, hasPending)}
          aria-describedby={skipReason === null ? undefined : SKIP_REASON_ID}
          onClick={onSkip}
        >
          <Icon name="i-next" className="icon--sm" />
          <span>{DASH_TEXT.skip}</span>
        </GuardedButton>
        <GuardedButton guardKey={guardKey} className="btn btn--sm btn--secondary" data-testid="auto" aria-pressed={autoMode} onClick={() => onAuto(!autoMode)}>
          <Icon name="i-auto" className="icon--sm" />
          <span>{autoMode ? DASH_TEXT.autoOn : DASH_TEXT.autoOff}</span>
        </GuardedButton>
      </div>
      {/*
        스크린리더가 "다음 결정으로"에 닿았을 때 읽는 사유(R-056). 누를 수 있을 때는 아예 없다.
        hidden이다(R-090): .sr-only(눈에만 안 보임)로 두면 스크린리더의 둘러보기 모드에서 이 문장이 별도 내용으로 한 번 더 읽힌다.
        aria-describedby가 가리키는 요소는 hidden이어도 접근성 설명으로 계산된다(accname 규칙) — 버튼에 닿았을 때만 읽힌다.
      */}
      {skipReason === null ? null : (
        <span id={SKIP_REASON_ID} hidden data-testid="skip-reason">
          {skipReason}
        </span>
      )}
    </div>
  );
}

/** 볼륨 한 단계(%) */
export const BGM_VOLUME_STEP = 5;

interface ToolsProps {
  guardKey: string;
  settings: Settings;
  dark: boolean;
  feedbackUrl: string | null;
  exitButtonRef: RefObject<HTMLButtonElement>;
  noteButtonRef: RefObject<HTMLButtonElement>;
  onBgm: Props['onBgm'];
  onDark: () => void;
  onNote: () => void;
  onExitOpen: () => void;
}

/**
 * 도구 줄 (DB3): BGM · 생각 남기기 · 다크 모드 · 의견 보내기 · 나가기. 켜짐 상태(BGM·다크 모드)는 aria-pressed + 색 반전·아래 막대 + 아이콘 교체 + 읽기 전용 「켜짐」이 함께 알린다(R-136②).
 * 「다크 모드」의 켜짐 = 지금 화면에 다크 테마가 적용된 상태(시스템 설정을 따르는 중이든 수동 선택이든). 누르면 반대 테마를 수동 선택으로 저장한다(DB6).
 */
function LifeTools({ guardKey, settings, dark, feedbackUrl, exitButtonRef, noteButtonRef, onBgm, onDark, onNote, onExitOpen }: ToolsProps) {
  return (
    <div className="controls__tools" role="group" aria-label={DASH_TEXT.toolsGroup} data-testid="tools">
      <GuardedButton guardKey={guardKey} className="btn btn--tool" aria-pressed={settings.bgm.on} data-testid="tool-bgm" onClick={() => onBgm({ on: !settings.bgm.on })}>
        <Icon name="i-music" />
        <span>{DASH_TEXT.toolBgm}</span>
        <span className="sr-only">{settings.bgm.on ? DASH_TEXT.toolOn : ''}</span>
      </GuardedButton>
      {/* 생각 남기기(M7c, D-75): 보통 버튼 — 누르면 기록 시트가 열린다(모달이라 `aria-haspopup="dialog"`). 결정 시트가 열려 있는 동안은 도구 줄 전체가 inert라 누를 수 없고, 접힌 띠·일시정지·자동 모드에서는 연다(content-M7c 5-4절) */}
      <GuardedButton ref={noteButtonRef} guardKey={guardKey} className="btn btn--tool" aria-haspopup="dialog" data-testid="tool-note" onClick={onNote}>
        <Icon name="i-pencil" />
        <span>{DASH_TEXT.toolNote}</span>
      </GuardedButton>
      <GuardedButton guardKey={guardKey} className="btn btn--tool" aria-pressed={dark} data-testid="tool-dark" onClick={onDark}>
        <Icon name={dark ? 'i-sun' : 'i-moon'} />
        <span>{DASH_TEXT.toolDark}</span>
        <span className="sr-only">{dark ? DASH_TEXT.toolOn : ''}</span>
      </GuardedButton>
      <FeedbackLink url={feedbackUrl} guardKey={guardKey} />
      <GuardedButton ref={exitButtonRef} guardKey={guardKey} className="btn btn--tool" data-testid="tool-exit" onClick={onExitOpen}>
        <Icon name="i-exit" />
        <span>{DASH_TEXT.toolExit}</span>
      </GuardedButton>
    </div>
  );
}

const NOOP = () => undefined;

/** React 18은 `inert` 불리언 속성을 모른다 — 빈 문자열 속성으로 건다(켜져 있을 때만; 끄면 속성 자체가 없다). 시트가 떠 있는 동안 바깥 전부에 거는 값이다 */
const INERT = { inert: '' } as Record<string, string>;

export function LifeScreen({ game, settings, pool = EVENT_POOL, tick = null, clock, exitOpen, onExitOpen, folded = false, guardEpoch = 0, onFold = NOOP, onReopen = NOOP, veilOpened = false, onVeilOpen = NOOP, onAutoPick = NOOP, noteSheet = null, onOpenNote = NOOP, onNoteSave = NOOP, onNoteDismiss = NOOP, onNoteCards = NOOP, onChoose, onSkip, onSpeed, onAuto, onPause, onBgm, onTheme, onExit, minute, repoUrl = REPO_URL, buildLabel = BUILD_LABEL }: Props) {
  const c = game.character;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headRef = useRef<HTMLElement>(null);
  const choiceTitleRef = useRef<HTMLHeadingElement>(null);
  const foldOpenRef = useRef<HTMLButtonElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const exitButtonRef = useRef<HTMLButtonElement>(null);
  const noteButtonRef = useRef<HTMLButtonElement>(null);
  const exitCancelRef = useRef<HTMLButtonElement>(null);
  const exitBoxRef = useRef<HTMLDivElement>(null);
  const exitTitleRef = useRef<HTMLParagraphElement>(null);
  const systemDark = useSystemDark();
  const dark = isDarkApplied(settings.theme, systemDark);
  useThemeSurface();
  useScrollTopOnMount();
  // 나가기 확인 단계가 열려 있을 때 안내문 첫 줄~「돌아가기」와 고정 요소(헤더·진행 줄)가 한 화면에 못 들어가면 두 고정 요소를 푼다(QA-003-M4 O03, ui/exitAsk.ts)
  const forceRelease = useForceReleaseRef();
  const bottomBar = useBottomBar(controlsRef, forceRelease);
  const stickyHead = useStickyHead(headRef, controlsRef, forceRelease);
  useExitAskFit(forceRelease, exitOpen, { titleRef: exitTitleRef, cancelRef: exitCancelRef, boxRef: exitBoxRef, headRef, barRef: controlsRef }, [bottomBar, stickyHead]);
  const decision = useDecisionModel(game, pool);
  // 부모님이 정한·흘러간 해의 카드 (PD5): 사람이 고르는 카드(decision)와 같은 해에 뜨지 않는다 — 카드 간격 규칙(2년)이 보장한다
  const parentCard = useParentCardModel(game, tick, pool);
  // 접힘은 대기 중인 선택지가 있을 때만 뜻이 있다(App이 키로 묶어 두지만 여기서도 못 박는다)
  const isFolded = decision !== null && folded;
  // 카드 틀: 자동 모드 하나가 정한다(M-6) — 꺼짐 = 모달 시트(바깥 inert), 켜짐 = 비모달 인라인. 접었다 다시 열면 그때의 자동 모드에 맞는 틀로 뜬다
  const sheetOpen = decision !== null && !isFolded && !settings.autoMode;
  // 무거운 장면 가리기 (HV4 ②): 설정이 켜져 있고 이 카드가 무거운 장면이고 아직 펼치지 않았으면 가린 카드(접힌 띠의 제목도 같다). 사건·효과·확률·자동 선택 타이머는 그대로다
  const veiled = settings.gentle && decision !== null && decision.heavy !== null && !veilOpened;
  const { noteSkip } = useLifeFocus({ pendingKey: game.pending?.key ?? null, autoMode: settings.autoMode, folded: isFolded, titleRef: headingRef, choiceTitleRef, foldOpenRef, controlsRef });
  // 「펼쳐서 읽기」를 누르면 버튼이 사라지므로 포커스는 제목(#dc-title)으로 간다 — 제목 글자가 이벤트 제목으로 바뀌어 다시 읽힌다(copy.md 12-3). 시트는 문서 스크롤을 건드리지 않고, 인라인 카드는 위쪽 변을 화면에 맞춘다
  const wasVeilOpened = useRef(veilOpened);
  useEffect(() => {
    if (veilOpened && !wasVeilOpened.current) {
      const title = choiceTitleRef.current;
      if (title !== null) {
        title.focus({ preventScroll: true });
        if (title.closest('[role="dialog"]') === null) revealCard(title.closest('section') ?? title);
      }
    }
    wasVeilOpened.current = veilOpened;
  }, [veilOpened]);
  const fast = settings.speed >= 4 || settings.autoMode;
  // 진행 줄·도구 줄의 입력 가드: 화면이 뜰 때 + 카드를 접거나 다시 연 직후(U9). 접기 더블탭의 둘째 입력이 시트가 사라진 자리의 컨트롤에 떨어지지 않게 한다
  const controlsGuard = controlsGuardKey(guardEpoch);
  // 기록 시트도 모달이다(M7c): 열려 있는 동안 바깥 전부 inert. 결정 시트와 동시에 열리는 일은 없다 — 기록 카드는 해의 첫머리(결정 대기 없음), 수동 기록은 결정 시트가 열린 동안 도구 줄이 inert라 누를 수 없다(content-M7c 5-4절)
  const noteOpen = noteSheet !== null;
  const inert = sheetOpen || noteOpen ? INERT : {};
  const feedbackUrl = buildFeedbackUrl(feedbackFieldsOf(game, repoUrl, buildLabel));

  // 나가기 확인 단계: 열리면 안전한 쪽(돌아가기)으로 포커스를 옮기고, Esc로 닫으면 「나가기」 도구로 포커스를 돌려준다(첫 화면의 확인 단계와 같은 방식, R-212).
  // 열 때의 화면 맞춤(안내문 첫 줄과 「돌아가기」가 함께 보이게)은 useExitAskFit이 한다 — 브라우저의 기본 포커스 스크롤은 버튼만 화면에 넣고 안내문을 위로 밀어내므로 스크롤은 막는다(QA-003-M4 O03).
  const returnFocus = useRef(false);
  // 모달 시트가 위에 있으면 Esc는 시트(카드 접기)의 몫이다 — 나가기 확인이 열린 채 「다음 결정으로」로 시트가 뜬 뒤 Esc 한 번이 두 리스너를 함께 돌려 확인 단계 닫기와 카드 접기가 같이 일어나던 것을 막는다(REV-003-M7b-1 관찰 3).
  // 맨 위 하나만 처리한다: 시트가 접히고 나면 다음 Esc가 나가기 확인을 닫는다. 이 효과가 시트 여닫음에 다시 돌지 않도록(포커스를 다시 가져가지 않도록) 값은 ref로 읽는다.
  const sheetOpenRef = useRef(false);
  sheetOpenRef.current = sheetOpen || noteOpen; // 기록 시트의 Esc(= 2번)도 시트의 몫이다
  useEffect(() => {
    if (!exitOpen) {
      if (returnFocus.current) {
        returnFocus.current = false;
        exitButtonRef.current?.focus();
      }
      return;
    }
    exitCancelRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sheetOpenRef.current) {
        returnFocus.current = true;
        onExitOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [exitOpen, onExitOpen]);

  // 기록 시트가 닫힌 뒤의 포커스는 여는 길이 정한다(D-76, content-M7c 5-9 `decideNoteFocus`): 저절로 뜬 카드 → 인생 화면 제목(스크롤 그대로), 수동 → 도구 줄 「생각 남기기」 버튼
  const lastNoteVia = useRef<NoteFocusVia | null>(null);
  const noteVia = noteSheet === null ? null : noteSheet.via;
  useEffect(() => {
    if (noteVia !== null) {
      lastNoteVia.current = noteVia;
      return;
    }
    const via = lastNoteVia.current;
    if (via === null) return;
    lastNoteVia.current = null;
    if (decideNoteFocus('closed', via) === 'lifeTitle') headingRef.current?.focus({ preventScroll: true });
    else noteButtonRef.current?.focus({ preventScroll: true });
  }, [noteVia]);

  const closeExit = () => {
    returnFocus.current = true;
    onExitOpen(false);
  };

  return (
    <div className="page dash-page" data-testid="life-screen">
      <Sprite />
      <header className="dash-head" ref={headRef} data-testid="dash-head" {...inert}>
        <div className="dash-head__inner">
          <div className="dash-head__top">
            <HeaderLogo />
            <div className="who">
              <h1 className="who__name" ref={headingRef} tabIndex={-1} data-testid="life-name">
                {c.name}
              </h1>
              <span className="who__age" data-testid="life-age">
                <b>{game.age}</b>
                {DASH_TEXT.ageSuffix}
              </span>
            </div>
          </div>
          <YearRow year={calendarYear(c.birthYear, game.age)} clock={clock} paused={game.paused} />
        </div>
      </header>

      <div className="toolbar" {...inert}>
        <div className="toolbar__inner">
          <LifeControls
            speed={settings.speed}
            autoMode={settings.autoMode}
            paused={game.paused}
            hasPending={game.pending !== null}
            containerRef={controlsRef}
            guardKey={controlsGuard}
            onSpeed={onSpeed}
            onSkip={() => {
              noteSkip(); // 사용자가 직접 눌러 뜬 선택지는 포커스가 이 버튼에 있어도 선택지 제목으로 옮긴다(R-036)
              onSkip();
            }}
            onAuto={onAuto}
            onPause={onPause}
          />
          <LifeTools
            guardKey={controlsGuard}
            settings={settings}
            dark={dark}
            feedbackUrl={feedbackUrl}
            exitButtonRef={exitButtonRef}
            noteButtonRef={noteButtonRef}
            onBgm={onBgm}
            onDark={() => onTheme(dark ? 'light' : 'dark')}
            onNote={onOpenNote}
            onExitOpen={() => onExitOpen(true)}
          />
          {settings.bgm.on ? (
            <label className="volume" data-testid="bgm-volume">
              <span>{DASH_TEXT.bgmVolume}</span>
              <input
                type="range"
                min={BGM_VOLUME_MIN}
                max={BGM_VOLUME_MAX}
                step={BGM_VOLUME_STEP}
                value={settings.bgm.volume}
                aria-valuetext={`${settings.bgm.volume}%`}
                onChange={(e) => onBgm({ volume: Number(e.target.value) })}
                data-testid="bgm-volume-input"
              />
              <output>{settings.bgm.volume}%</output>
            </label>
          ) : null}
          {exitOpen ? (
            <div className="exit-ask" role="group" aria-labelledby="exit-ask-t" data-testid="exit-ask" ref={exitBoxRef}>
              <p className="exit-ask__title" id="exit-ask-t" role="alert" data-testid="exit-ask-title" ref={exitTitleRef}>
                {DASH_TEXT.exitAsk}
              </p>
              <p className="t-sm t-muted">
                <Glue text={DASH_TEXT.exitAskSub} />
              </p>
              <div className="exit-ask__actions">
                <GuardedButton guardKey={EXIT_GUARD_KEY} className="btn btn--secondary" data-testid="exit-yes" onClick={onExit}>
                  {DASH_TEXT.exitYes}
                </GuardedButton>
                <GuardedButton ref={exitCancelRef} guardKey={EXIT_GUARD_KEY} className="btn btn--primary" data-testid="exit-no" onClick={closeExit}>
                  {DASH_TEXT.exitNo}
                </GuardedButton>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <main className="dash" {...inert}>
        <div className="col col--left">
          <ProfileCard game={game} />
          <StatusCard stats={game.stats} era={game.era} />
          <AssetsCard age={game.age} assets={game.assets} era={game.era} />
        </div>
        <div className="col col--center">
          {/* 카드 자리: 접히면 접힌 띠, 자동 모드면 인라인 카드. 모달 시트는 아래(이 형제들 바깥)에서 그린다 */}
          {decision !== null && isFolded ? <DecisionFold model={decision} epoch={guardEpoch} openRef={foldOpenRef} onReopen={onReopen} veiled={veiled} /> : null}
          {decision !== null && !isFolded && settings.autoMode ? (
            <DecisionInline model={decision} veiled={veiled}>
              <DecisionCard model={decision} auto epoch={guardEpoch} titleRef={choiceTitleRef} onFold={onFold} onChoose={onChoose} veiled={veiled} onOpenVeil={onVeilOpen} onAutoPick={onAutoPick} />
            </DecisionInline>
          ) : null}
          {/* 부모님이 정한·흘러간 카드: 인생 기록 바로 위(LR5 b — [결정 카드 또는 접힌 띠 → 부모 결정 카드 → 인생 기록]). 비모달이라 포커스·inert와 무관하다 */}
          {parentCard !== null ? <ParentCard key={`${parentCard.ev.id}@${parentCard.age}`} model={parentCard} gentle={settings.gentle} /> : null}
          <LogCard history={game.history} name={c.name} live={!fast} minute={minute} gentle={settings.gentle} />
        </div>
        <div className="col col--right">
          <FamilyCard game={game} />
          <PeersNowCard game={game} />
        </div>
      </main>
      <div className="page-end-space" {...inert} />
      {/* 모달 시트: 바깥(헤더·도구 줄·main·본문 끝 여백)이 모두 inert인 동안만 있다 — aria-modal만으로는 Tab이 뒤로 샌다(design-system.md 11-10) */}
      {sheetOpen ? (
        <DecisionSheet model={decision} onFold={onFold} veiled={veiled}>
          <DecisionCard model={decision} auto={false} epoch={guardEpoch} titleRef={choiceTitleRef} onFold={onFold} onChoose={onChoose} veiled={veiled} onOpenVeil={onVeilOpen} onAutoPick={onAutoPick} />
        </DecisionSheet>
      ) : null}
      {/* 기록 시트(M7c): 바깥이 모두 inert인 동안만 있다. 같은 시트가 두 길(저절로 뜬 카드 / 「생각 남기기」 버튼)로 열린다 */}
      {noteSheet !== null ? (
        <NoteSheet
          via={noteSheet.via}
          card={noteSheet.card}
          game={game}
          count={noteCount(game)}
          cardsOn={settings.noteCards}
          guardKey={`note:${noteSheet.via}:${noteSheet.card === null ? 'manual' : noteSheet.card.id}:${noteSheet.token}`}
          onSave={onNoteSave}
          onDismiss={onNoteDismiss}
          onToggleCards={onNoteCards}
        />
      ) : null}
    </div>
  );
}
