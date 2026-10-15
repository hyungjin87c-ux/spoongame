import { COMPARABLE_STATS, STAT_KEYS, reviewEnding, type EndingGame, type EndingReview, type HistoryEntry, type StatKey } from '../core';
import { ERA_CONFIG } from '../data/birthTable';
import {
  EARLY_WEALTH_LABEL,
  ENDING_HEADINGS,
  JOURNEY_NOTE,
  MOVEMENT_TEXT,
  REBIRTH_LABEL,
  REBIRTH_NOTE,
  choiceCountText,
  deathLineText,
  journeyText,
  stageHeadingText,
  startedAtText,
} from '../data/endingText';
import { birthEntryText, STAT_LABEL } from '../data/lifeText';
import { GuardedButton } from '../ui/GuardedButton';
import { KeepStanding } from '../ui/KeepStanding';
import { useFocusOnChange } from '../ui/useFocus';

/** 화면 전환 직후 입력 가드의 키: 마지막 선택·"다음 결정으로"를 누른 손가락의 둘째 입력이 "다시 태어나기"에 떨어지지 않게 한다. */
export const ENDING_GUARD_KEY = 'ending';

interface Props {
  game: EndingGame;
  /** "다시 태어나기": 새 판으로 바꾸고 시대 선택 화면으로 간다 */
  onRebirth: () => void;
  /** 테스트에서 회고를 직접 주입한다 (기본: 게임 상태에서 계산) */
  review?: EndingReview;
}

function FinalStatRow({ stat, label, value, started }: { stat: StatKey | 'looks'; label: string; value: number; started?: number }) {
  return (
    <div className="stat" data-stat={stat}>
      <div className="stat-line">
        <span>{label}</span>
        <span className="stat-value">
          {started !== undefined ? (
            <span className="muted stat-started" data-testid={`started-${stat}`}>
              {startedAtText(started)}
            </span>
          ) : null}
          <strong data-testid={`final-${stat}`}>{value}</strong>
        </span>
      </div>
      <div className="bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className={`bar-fill${stat === 'looks' ? ' fixed' : ''}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function TimelineItem({ entry }: { entry: HistoryEntry }) {
  return (
    <li className={entry.kind === 'choice' ? 'tl-choice' : undefined} data-kind={entry.kind} data-testid="timeline-entry">
      <span className="log-age">{entry.age}세</span>
      <span className="log-body">
        {entry.title ? <strong>{entry.title}</strong> : null}
        {entry.choice ? (
          <span className="tl-picked" data-testid="timeline-picked">
            선택: {entry.choice}
          </span>
        ) : null}
        <span className="tl-text">{entry.text}</span>
      </span>
    </li>
  );
}

/**
 * 엔딩: 담담한 회고 (SPEC-001 "엔딩"). 위에서 아래로 — 누구의 인생이었나, 출발선에서 마지막까지(같은 세상 안의 자리), 최종 스탯, 생애 연표, 다시 태어나기.
 * 계산(자리·방향·연표 묶기)은 core/ending.ts의 순수 함수가 하고, 이 화면은 결과를 그리기만 한다. 사망 상태는 저장돼 있어 새로고침해도 그대로다.
 */
export function EndingScreen({ game, onRebirth, review = reviewEnding(game) }: Props) {
  const headingRef = useFocusOnChange<HTMLHeadingElement>();
  const c = game.character;
  const early = review.journey.kind === 'early';
  return (
    <main className="screen ending" data-testid="ending-screen">
      <header className="ending-head">
        <p className="sub">{ERA_CONFIG[game.era].label}</p>
        <h1 ref={headingRef} tabIndex={-1} data-testid="ending-name">
          {c.name}
        </h1>
        <p data-testid="ending-born">{birthEntryText(c.birthYear, c.gender)}</p>
        <p data-testid="ending-death">{deathLineText(game.death)}</p>
        <p className="muted" data-testid="ending-choices">
          {choiceCountText(review.choiceCount)}
        </p>
      </header>

      <section className="ending-section" aria-labelledby="ending-journey-title" data-testid="ending-journey-section">
        <h2 id="ending-journey-title">{ENDING_HEADINGS.journey}</h2>
        <p data-testid="ending-journey">
          <KeepStanding text={journeyText(review.journey)} />
        </p>
        {review.journey.kind === 'compared' ? (
          <>
            <p data-testid="ending-movement">{MOVEMENT_TEXT[review.journey.movement]}</p>
            <p className="muted" data-testid="ending-note">
              {JOURNEY_NOTE}
            </p>
          </>
        ) : null}
      </section>

      <section className="ending-section" aria-labelledby="ending-stats-title" data-testid="ending-stats">
        <h2 id="ending-stats-title">{ENDING_HEADINGS.stats}</h2>
        <div className="stats">
          {STAT_KEYS.map((key) => {
            const change = review.changes.find((x) => x.stat === key);
            const label = key === 'wealth' && early ? EARLY_WEALTH_LABEL : STAT_LABEL[key];
            // 처음 값을 옆에 붙이는 것은 뜻이 변하지 않는 학력·행복·관계뿐이다(COMPARABLE_STATS). 재산(집안 형편 → 내가 가진 것)과 건강은 붙이지 않는다.
            return (
              <FinalStatRow
                key={key}
                stat={key}
                label={label}
                value={game.stats[key]}
                started={change !== undefined && (COMPARABLE_STATS as readonly string[]).includes(key) ? change.from : undefined}
              />
            );
          })}
          <FinalStatRow stat="looks" label="외모" value={c.looks} />
        </div>
      </section>

      <section className="ending-section" aria-labelledby="ending-timeline-title" data-testid="ending-timeline">
        <h2 id="ending-timeline-title">{ENDING_HEADINGS.timeline}</h2>
        {review.timeline.map((group) => (
          <div className="tl-group" key={group.stage} data-testid={`timeline-${group.stage}`}>
            <h3>{stageHeadingText(group.stage)}</h3>
            <ol className="timeline">
              {group.entries.map((e, i) => (
                <TimelineItem key={`${e.age}-${i}`} entry={e} />
              ))}
            </ol>
          </div>
        ))}
      </section>

      <section className="ending-rebirth">
        <p className="muted">{REBIRTH_NOTE}</p>
        <GuardedButton guardKey={ENDING_GUARD_KEY} data-testid="rebirth" onClick={onRebirth}>
          {REBIRTH_LABEL}
        </GuardedButton>
      </section>
    </main>
  );
}
