import { useRef, type RefObject } from 'react';
import {
  STAT_KEYS,
  SPEEDS,
  stageOf,
  type Character,
  type EventPool,
  type GameState,
  type Settings,
  type Speed,
  type TickInfo,
} from '../core';
import { EVENT_POOL } from '../data/events';
import { STAGE_TABLE } from '../data/lifeTable';
import { QUIET_YEAR_TEXT, STAT_LABEL } from '../data/lifeText';
import { GuardedButton } from '../ui/GuardedButton';
import { useLifeFocus } from '../ui/useFocus';

/**
 * 하단 컨트롤(속도 4개·다음 결정으로·자동 모드)의 입력 가드 키. 상수라서 가드는 이 화면이 새로 뜰 때(마운트)만 걸리고,
 * 플레이 중 배속 버튼을 누르거나 나이가 오를 때 다시 닫히지 않는다(R-035).
 */
export const CONTROLS_GUARD_KEY = 'life-controls';

/** 사건 로그에 보이는 최근 항목 수 (연표 전체는 저장 상태에 있고 엔딩(M5)에서 쓴다) */
export const LOG_VISIBLE = 6;

interface Props {
  game: GameState & { character: Character };
  settings: Settings;
  /** 직전에 처리한 걸음 (조용한 해 문구용) */
  tick: TickInfo | null;
  pool?: EventPool;
  onChoose: (key: string, choiceId: string) => void;
  onSkip: () => void;
  onSpeed: (speed: Speed) => void;
  onAuto: (auto: boolean) => void;
}

function StatsPanel({ game }: { game: GameState & { character: Character } }) {
  return (
    <section className="stats" aria-label="스탯" data-testid="stats">
      {STAT_KEYS.map((key) => (
        <div className="stat" key={key} data-stat={key}>
          <div className="stat-line">
            <span>{STAT_LABEL[key]}</span>
            <strong data-testid={`stat-${key}`}>{game.stats[key]}</strong>
          </div>
          <div className="bar" role="meter" aria-label={STAT_LABEL[key]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={game.stats[key]}>
            <div className="bar-fill" style={{ width: `${game.stats[key]}%` }} />
          </div>
        </div>
      ))}
      <div className="stat" data-stat="looks">
        <div className="stat-line">
          <span>외모</span>
          <strong data-testid="stat-looks">{game.character.looks}</strong>
        </div>
        <div className="bar" role="meter" aria-label="외모" aria-valuemin={0} aria-valuemax={100} aria-valuenow={game.character.looks}>
          <div className="bar-fill fixed" style={{ width: `${game.character.looks}%` }} />
        </div>
      </div>
    </section>
  );
}

function LogPanel({ game, live }: { game: GameState; live: boolean }) {
  const entries = game.history.slice(-LOG_VISIBLE).reverse();
  return (
    <section className="log" aria-label="사건 기록" data-testid="log">
      <ol aria-live={live ? 'polite' : 'off'} aria-relevant="additions">
        {entries.map((h, i) => (
          <li key={`${h.age}-${game.history.length - i}`} className={i === 0 ? 'latest' : undefined} data-kind={h.kind}>
            <span className="log-age">{h.age}세</span>
            <span className="log-body">
              {h.title ? <strong>{h.title}. </strong> : null}
              {h.text}
              {h.choice ? <em className="log-choice"> (선택: {h.choice})</em> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ChoicePanel({
  game,
  pool,
  auto,
  titleRef,
  onChoose,
}: {
  game: GameState;
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
    <section className="choice-panel" aria-labelledby="choice-title" data-testid="choice-panel" data-key={pending.key}>
      {/* 포커스 이동은 LifeScreen의 useLifeFocus가 한 곳에서 정한다(자동 모드·컨트롤 안 포커스 예외 포함, R-036). */}
      <h2 id="choice-title" ref={titleRef} tabIndex={-1} data-testid="choice-title">
        {ev.title}
      </h2>
      <p data-testid="choice-text">{ev.text}</p>
      <div className="choice-list" role="group" aria-label="선택지">
        {choices.map((c) => (
          // guardKey = 이 이벤트 인스턴스의 고유 키: 다음 선택지가 같은 자리에 떠도 새로 가드가 걸려 연타가 자동으로 눌리지 않는다.
          <GuardedButton key={c.id} guardKey={pending.key} data-testid={`choice-${c.id}`} onClick={() => onChoose(pending.key, c.id)}>
            {c.label}
          </GuardedButton>
        ))}
      </div>
      {auto ? (
        <p className="muted" data-testid="auto-note">
          자동 모드: 잠시 뒤 성향에 따라 고릅니다.
        </p>
      ) : null}
    </section>
  );
}

interface ControlsProps {
  speed: Speed;
  autoMode: boolean;
  /** 선택지가 대기 중인가 (대기 중에는 "다음 결정으로"를 누를 수 없다) */
  hasPending: boolean;
  containerRef?: RefObject<HTMLDivElement>;
  onSpeed: (speed: Speed) => void;
  onSkip: () => void;
  onAuto: (auto: boolean) => void;
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
 * 하단 컨트롤 그룹(속도 4개·다음 결정으로·자동 모드). 훅이 없는 순수 표시 컴포넌트라 요소 트리를 그대로 단위 테스트한다.
 *  - 6개 모두 GuardedButton + 상수 키 CONTROLS_GUARD_KEY: 화면이 뜬 직후 INPUT_GUARD_MS 동안 입력을 무시한다(R-035): "살아가기"·"이 탭에서 이어하기"
 *    더블클릭의 둘째 입력이 같은 좌표의 속도/다음 결정으로/자동 모드에 떨어지는 것을 막는다. 키가 상수라 이후 플레이 중에는 다시 닫히지 않는다.
 *  - "다음 결정으로"는 누를 수 없을 때 disabled가 아니라 aria-disabled(포커스는 받고 입력은 무시)다 — 그래야 선택지가 뜨든 사라지든 이 그룹의 Tab 순서가
 *    변하지 않는다. disabled면 Tab 순서에서 빠져, 포커스가 8배 버튼에 있다가 선택지가 뜨면 다음 Tab이 "자동 모드"에 닿아 Space가 자동 모드를 켜 버린다(R-036).
 */
export function LifeControls({ speed, autoMode, hasPending, containerRef, onSpeed, onSkip, onAuto }: ControlsProps) {
  const skipReason = skipBlockedReason(autoMode, hasPending);
  return (
    <div className="controls" role="group" aria-label="진행 속도" data-testid="controls" ref={containerRef}>
      <div className="speed-row">
        {SPEEDS.map((s) => (
          <GuardedButton key={s} guardKey={CONTROLS_GUARD_KEY} aria-pressed={speed === s} data-speed={s} onClick={() => onSpeed(s)}>
            {s}배
          </GuardedButton>
        ))}
      </div>
      <div className="action-row">
        <GuardedButton
          guardKey={CONTROLS_GUARD_KEY}
          className="secondary"
          data-testid="skip"
          aria-disabled={isSkipBlocked(autoMode, hasPending)}
          aria-describedby={skipReason === null ? undefined : SKIP_REASON_ID}
          onClick={onSkip}
        >
          다음 결정으로
        </GuardedButton>
        <GuardedButton
          guardKey={CONTROLS_GUARD_KEY}
          className="secondary"
          data-testid="auto"
          aria-pressed={autoMode}
          onClick={() => onAuto(!autoMode)}
        >
          자동 모드 {autoMode ? '켜짐' : '꺼짐'}
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

export function LifeScreen({ game, settings, tick, pool = EVENT_POOL, onChoose, onSkip, onSpeed, onAuto }: Props) {
  const c = game.character;
  const stage = stageOf(game.age);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const choiceTitleRef = useRef<HTMLHeadingElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const { noteSkip } = useLifeFocus({ pendingKey: game.pending?.key ?? null, autoMode: settings.autoMode, titleRef: headingRef, choiceTitleRef, controlsRef, liveRef });
  const quiet = tick?.kind === 'quiet';
  const fast = settings.speed >= 4 || settings.autoMode;
  return (
    <main className="screen life" data-testid="life-screen">
      <header className="life-head">
        <h1 ref={headingRef} tabIndex={-1} data-testid="life-name">
          {c.name}
        </h1>
        <p data-testid="life-age">
          <strong>{game.age}세</strong> · <span data-testid="life-stage">{STAGE_TABLE[stage].label}</span>
        </p>
        <p className="muted status" data-testid="life-status">
          {quiet ? QUIET_YEAR_TEXT : ' '}
        </p>
      </header>

      {/* 포커스가 컨트롤(속도 버튼 등) 안에 있을 때 선택지가 뜨면 포커스는 두고 이 영역으로만 알린다(R-036). */}
      <p className="sr-only" role="status" aria-live="polite" ref={liveRef} data-testid="choice-announce" />
      <ChoicePanel game={game} pool={pool} auto={settings.autoMode} titleRef={choiceTitleRef} onChoose={onChoose} />
      <LogPanel game={game} live={!fast} />
      <StatsPanel game={game} />

      <LifeControls
        speed={settings.speed}
        autoMode={settings.autoMode}
        hasPending={game.pending !== null}
        containerRef={controlsRef}
        onSpeed={onSpeed}
        onSkip={() => {
          noteSkip(); // 사용자가 직접 눌러 뜬 선택지는 포커스가 이 버튼에 있어도 선택지 제목으로 옮긴다(R-036)
          onSkip();
        }}
        onAuto={onAuto}
      />
    </main>
  );
}
