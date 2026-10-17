import { useEffect, useRef, type RefObject } from 'react';
import { SPEEDS, buildFeedbackUrl, calendarYear, feedbackFieldsOf, type BgmSettings, type EventPool, type Settings, type Speed, type ThemeChoice } from '../core';
import { BGM_VOLUME_MAX, BGM_VOLUME_MIN } from '../core/types';
import { EVENT_POOL } from '../data/events';
import { DASH_TEXT } from '../data/dashText';
import { BUILD_LABEL, REPO_URL } from '../buildInfo';
import { HeaderLogo, Icon, Sprite } from '../ui/Brand';
import { FeedbackLink } from '../ui/FeedbackLink';
import { GuardedButton } from '../ui/GuardedButton';
import { AssetsCard, FamilyCard, PeersNowCard, ProfileCard, StatusCard, type LifeGame } from '../ui/dash/Cards';
import { LogCard } from '../ui/dash/LogCard';
import { useExitAskFit, useForceReleaseRef } from '../ui/exitAsk';
import { useStickyHead } from '../ui/headRelease';
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
 * 중대 결정 카드는 기존 동작(선택지 이벤트의 제목·본문·선택지, 포커스 규칙 R-036, 입력 가드)을 그대로 두고 새 틀(카드)에 담았다 — 영향 표기·인용·접기는 M5·M7b.
 */

/** 하단 컨트롤(진행 줄)과 도구 줄의 입력 가드 키. 상수라서 가드는 이 화면이 새로 뜰 때(마운트)만 걸리고, 플레이 중 배속을 누르거나 나이가 오를 때 다시 닫히지 않는다(R-035). */
export const CONTROLS_GUARD_KEY = 'life-controls';
/** 나가기 확인 단계의 두 버튼이 같은 순간에 뜨므로 한 키를 같이 쓴다 */
const EXIT_GUARD_KEY = 'life-exit';

export type { LifeGame };

interface Props {
  game: LifeGame;
  settings: Settings;
  pool?: EventPool;
  /** 올해 진행률 시계 (App이 `useYearClock`으로 만든다) */
  clock: YearClock;
  /** 나가기 확인 단계가 열려 있는가 (App이 갖는다 — 열려 있는 동안 시계도 멈춘다) */
  exitOpen: boolean;
  onExitOpen: (open: boolean) => void;
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

function ChoicePanel({
  game,
  pool,
  auto,
  titleRef,
  onChoose,
}: {
  game: LifeGame;
  pool: EventPool;
  auto: boolean;
  titleRef: RefObject<HTMLHeadingElement>;
  onChoose: Props['onChoose'];
}) {
  const pending = game.pending;
  const ev = pending ? pool.byId.get(pending.eventId) : undefined;
  if (!pending || !ev) return null;
  const choices = pending.choiceIds.map((id) => ev.choices?.find((c) => c.id === id)).filter((c) => c !== undefined);
  return (
    <section className="card choice-panel" aria-labelledby="choice-title" data-testid="choice-panel" data-key={pending.key}>
      <span className="choice-panel__kind">{DASH_TEXT.choiceKind}</span>
      {/* 포커스 이동은 LifeScreen의 useLifeFocus가 한 곳에서 정한다(자동 모드·컨트롤 안 포커스 예외 포함, R-036). */}
      <h2 id="choice-title" className="choice-panel__title" ref={titleRef} tabIndex={-1} data-testid="choice-title">
        {ev.title}
      </h2>
      <p data-testid="choice-text">{ev.text}</p>
      <div className="choices-list" role="group" aria-label={DASH_TEXT.choiceGroup}>
        {choices.map((c, i) => (
          // guardKey = 이 이벤트 인스턴스의 고유 키: 다음 선택지가 같은 자리에 떠도 새로 가드가 걸려 연타가 자동으로 눌리지 않는다.
          <GuardedButton key={c.id} className="choice" guardKey={pending.key} data-testid={`choice-${c.id}`} onClick={() => onChoose(pending.key, c.id)}>
            <span className="choice__no" aria-hidden="true">
              {i + 1}
            </span>
            <span className="choice__body">
              <span className="choice__label">{c.label}</span>
            </span>
          </GuardedButton>
        ))}
      </div>
      {auto ? (
        <p className="t-sm t-muted" data-testid="auto-note">
          {DASH_TEXT.autoNote}
        </p>
      ) : null}
    </section>
  );
}

interface ControlsProps {
  speed: Speed;
  autoMode: boolean;
  paused: boolean;
  /** 선택지가 대기 중인가 (대기 중에는 "다음 결정으로"를 누를 수 없다) */
  hasPending: boolean;
  containerRef?: RefObject<HTMLDivElement>;
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
export function LifeControls({ speed, autoMode, paused, hasPending, containerRef, onSpeed, onSkip, onAuto, onPause }: ControlsProps) {
  const skipReason = skipBlockedReason(autoMode, hasPending);
  return (
    <div className="controls-fixed" role="group" aria-label={DASH_TEXT.controlsGroup} data-testid="controls" ref={containerRef}>
      <div className="controls__speed">
        <GuardedButton guardKey={CONTROLS_GUARD_KEY} className="btn btn--sm" data-testid="pause" data-paused={paused ? 'true' : 'false'} onClick={() => onPause(!paused)}>
          <Icon name={paused ? 'i-play' : 'i-pause'} className="icon--sm" />
          <span>{paused ? DASH_TEXT.play : DASH_TEXT.pause}</span>
        </GuardedButton>
        {SPEEDS.map((s) => (
          <GuardedButton key={s} guardKey={CONTROLS_GUARD_KEY} className="btn btn--sm" aria-pressed={speed === s} data-speed={s} onClick={() => onSpeed(s)}>
            {s}
            {DASH_TEXT.speedUnit}
          </GuardedButton>
        ))}
      </div>
      <div className="controls__more">
        <GuardedButton
          guardKey={CONTROLS_GUARD_KEY}
          className="btn btn--sm btn--secondary"
          data-testid="skip"
          aria-disabled={isSkipBlocked(autoMode, hasPending)}
          aria-describedby={skipReason === null ? undefined : SKIP_REASON_ID}
          onClick={onSkip}
        >
          <Icon name="i-next" className="icon--sm" />
          <span>{DASH_TEXT.skip}</span>
        </GuardedButton>
        <GuardedButton guardKey={CONTROLS_GUARD_KEY} className="btn btn--sm btn--secondary" data-testid="auto" aria-pressed={autoMode} onClick={() => onAuto(!autoMode)}>
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
  settings: Settings;
  dark: boolean;
  feedbackUrl: string | null;
  exitButtonRef: RefObject<HTMLButtonElement>;
  onBgm: Props['onBgm'];
  onDark: () => void;
  onExitOpen: () => void;
}

/**
 * 도구 줄 (DB3): BGM · 생각 남기기 · 다크 모드 · 의견 보내기 · 나가기. 켜짐 상태(BGM·다크 모드)는 aria-pressed + 색 반전·아래 막대 + 아이콘 교체 + 읽기 전용 「켜짐」이 함께 알린다(R-136②).
 * 「다크 모드」의 켜짐 = 지금 화면에 다크 테마가 적용된 상태(시스템 설정을 따르는 중이든 수동 선택이든). 누르면 반대 테마를 수동 선택으로 저장한다(DB6).
 */
function LifeTools({ settings, dark, feedbackUrl, exitButtonRef, onBgm, onDark, onExitOpen }: ToolsProps) {
  return (
    <div className="controls__tools" role="group" aria-label={DASH_TEXT.toolsGroup} data-testid="tools">
      <GuardedButton guardKey={CONTROLS_GUARD_KEY} className="btn btn--tool" aria-pressed={settings.bgm.on} data-testid="tool-bgm" onClick={() => onBgm({ on: !settings.bgm.on })}>
        <Icon name="i-music" />
        <span>{DASH_TEXT.toolBgm}</span>
        <span className="sr-only">{settings.bgm.on ? DASH_TEXT.toolOn : ''}</span>
      </GuardedButton>
      {/* 생각 남기기: M7c까지 버튼 자리만 — 선택할 수 없고(aria-disabled, 누르면 아무 일도 없다) 점선·옅은 글자로 그렇게 보이며(GuardedButton의 data-unavailable), 눈에 보이는 「준비 중」이 접근 가능한 이름에 든다(R-326) */}
      <GuardedButton guardKey={CONTROLS_GUARD_KEY} className="btn btn--tool" aria-disabled={true} data-testid="tool-note">
        <Icon name="i-pencil" />
        <span>{DASH_TEXT.toolNote}</span>{' '}
        <span className="tool-soon">{DASH_TEXT.toolSoon}</span>
      </GuardedButton>
      <GuardedButton guardKey={CONTROLS_GUARD_KEY} className="btn btn--tool" aria-pressed={dark} data-testid="tool-dark" onClick={onDark}>
        <Icon name={dark ? 'i-sun' : 'i-moon'} />
        <span>{DASH_TEXT.toolDark}</span>
        <span className="sr-only">{dark ? DASH_TEXT.toolOn : ''}</span>
      </GuardedButton>
      <FeedbackLink url={feedbackUrl} guardKey={CONTROLS_GUARD_KEY} />
      <GuardedButton ref={exitButtonRef} guardKey={CONTROLS_GUARD_KEY} className="btn btn--tool" data-testid="tool-exit" onClick={onExitOpen}>
        <Icon name="i-exit" />
        <span>{DASH_TEXT.toolExit}</span>
      </GuardedButton>
    </div>
  );
}

export function LifeScreen({ game, settings, pool = EVENT_POOL, clock, exitOpen, onExitOpen, onChoose, onSkip, onSpeed, onAuto, onPause, onBgm, onTheme, onExit, minute, repoUrl = REPO_URL, buildLabel = BUILD_LABEL }: Props) {
  const c = game.character;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headRef = useRef<HTMLElement>(null);
  const choiceTitleRef = useRef<HTMLHeadingElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const exitButtonRef = useRef<HTMLButtonElement>(null);
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
  const { noteSkip } = useLifeFocus({ pendingKey: game.pending?.key ?? null, autoMode: settings.autoMode, titleRef: headingRef, choiceTitleRef, controlsRef, liveRef });
  const fast = settings.speed >= 4 || settings.autoMode;
  const feedbackUrl = buildFeedbackUrl(feedbackFieldsOf(game, repoUrl, buildLabel));

  // 나가기 확인 단계: 열리면 안전한 쪽(돌아가기)으로 포커스를 옮기고, Esc로 닫으면 「나가기」 도구로 포커스를 돌려준다(첫 화면의 확인 단계와 같은 방식, R-212).
  // 열 때의 화면 맞춤(안내문 첫 줄과 「돌아가기」가 함께 보이게)은 useExitAskFit이 한다 — 브라우저의 기본 포커스 스크롤은 버튼만 화면에 넣고 안내문을 위로 밀어내므로 스크롤은 막는다(QA-003-M4 O03).
  const returnFocus = useRef(false);
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
      if (e.key === 'Escape') {
        returnFocus.current = true;
        onExitOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [exitOpen, onExitOpen]);

  const closeExit = () => {
    returnFocus.current = true;
    onExitOpen(false);
  };

  return (
    <div className="page dash-page" data-testid="life-screen">
      <Sprite />
      <header className="dash-head" ref={headRef} data-testid="dash-head">
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

      <div className="toolbar">
        <div className="toolbar__inner">
          <LifeControls
            speed={settings.speed}
            autoMode={settings.autoMode}
            paused={game.paused}
            hasPending={game.pending !== null}
            containerRef={controlsRef}
            onSpeed={onSpeed}
            onSkip={() => {
              noteSkip(); // 사용자가 직접 눌러 뜬 선택지는 포커스가 이 버튼에 있어도 선택지 제목으로 옮긴다(R-036)
              onSkip();
            }}
            onAuto={onAuto}
            onPause={onPause}
          />
          <LifeTools
            settings={settings}
            dark={dark}
            feedbackUrl={feedbackUrl}
            exitButtonRef={exitButtonRef}
            onBgm={onBgm}
            onDark={() => onTheme(dark ? 'light' : 'dark')}
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
              <p className="t-sm t-muted">{DASH_TEXT.exitAskSub}</p>
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

      {/* 포커스가 컨트롤(속도 버튼 등) 안에 있을 때 선택지가 뜨면 포커스는 두고 이 영역으로만 알린다(R-036). */}
      <p className="sr-only" role="status" aria-live="polite" ref={liveRef} data-testid="choice-announce" />

      <main className="dash">
        <div className="col col--left">
          <ProfileCard game={game} />
          <StatusCard stats={game.stats} />
          <AssetsCard age={game.age} />
        </div>
        <div className="col col--center">
          <ChoicePanel game={game} pool={pool} auto={settings.autoMode} titleRef={choiceTitleRef} onChoose={onChoose} />
          <LogCard history={game.history} name={c.name} live={!fast} minute={minute} />
        </div>
        <div className="col col--right">
          <FamilyCard game={game} />
          <PeersNowCard game={game} />
        </div>
      </main>
      <div className="page-end-space" />
    </div>
  );
}
