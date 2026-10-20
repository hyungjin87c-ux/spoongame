import type { CSSProperties } from 'react';
import { COMPARABLE_STATS, displaySeconds, isCleanRun, looksStanding, reviewEnding, standingScore, type EndingGame, type EndingReview, type HistoryEntry, type PlayTime as PlayRecord, type StatKey } from '../core';
import { ERA_CONFIG } from '../data/birthTable';
import { BIRTH_TEXT } from '../data/birthReportText';
import { standingLabel } from '../data/birthText';
import { decidedByText, deciderIconOf, delegatedSummaryText } from '../data/parentDecisionTable';
import { DASH_TEXT, STATUS_LABEL, STATUS_ORDER, titleCharsFor } from '../data/dashText';
import {
  ENDING_HEADINGS,
  ENDING_HEAD_LABEL,
  JOURNEY_NOTE,
  JOURNEY_BAR_LEGEND,
  MOVEMENT_TEXT,
  PLAYTIME_TEXT,
  REBIRTH_LABEL,
  REBIRTH_NOTE,
  bandLabel,
  breakdownParts,
  choiceCountText,
  deathLineText,
  endingSpanText,
  journeyBarLabel,
  journeyText,
  stageHeadingText,
  startedAtText,
} from '../data/endingText';
import { SiteHead, Icon, Sprite } from '../ui/Brand';
import { Face } from '../ui/Face';
import { Glue } from '../ui/Glue';
import { GradeChip } from '../ui/Grade';
import { GuardedButton } from '../ui/GuardedButton';
import { FinalNetLine } from '../ui/dash/FinalNet';
import { NoteBody } from '../ui/dash/NoteText';
import { KeepStanding } from '../ui/KeepStanding';
import { PlayTime } from '../ui/PlayTime';
import { useFocusOnChange } from '../ui/useFocus';
import { useScrollTopOnMount, useThemeSurface } from '../ui/useBottomBar';

/** 화면 전환 직후 입력 가드의 키: 마지막 선택·"다음 결정으로"를 누른 손가락의 둘째 입력이 "다시 태어나기"에 떨어지지 않게 한다. */
export const ENDING_GUARD_KEY = 'ending';

/** 공통 헤더의 화면 이름 (DS1, copy.md 엔딩 행) */
export const ENDING_HEAD_NAME = '엔딩';

interface Props {
  game: EndingGame;
  /** "다시 태어나기": 새 판으로 바꾸고 시대 선택 화면으로 간다 */
  onRebirth: () => void;
  /** 테스트에서 회고를 직접 주입한다 (기본: 게임 상태에서 계산) */
  review?: EndingReview;
}

/** 최종 상태 막대 한 줄 (건강·행복·지식·관계) */
function FinalMeter({ stat, label, value, tone, icon, started }: { stat: StatKey; label: string; value: number; tone: string; icon: string | null; started?: number }) {
  return (
    <div className={`meter meter--${tone}`} data-stat={stat}>
      <span className="meter__label">
        {icon === null ? null : <Icon name={icon} />}
        {label}
      </span>
      <div className="meter__track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className="meter__fill" style={{ width: `${value}%` }} />
      </div>
      <span className="meter__value" data-testid={`final-${stat}`}>
        {value}
      </span>
      {started !== undefined ? (
        <span className="meter__sub" data-testid={`started-${stat}`}>
          {startedAtText(started)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * 이 판의 플레이 시간 블록 (SPEC-003 LM6, M8 — docs/design/copy.md 8절, diff-003.md D-93~D-95): 「사망과 선택」 카드의 세 번째 요소. 값 = 연출 + 결정 읽기를 **버킷별로 초를 버린 뒤 더한 값**(core/playClock.ts#displaySeconds)이라
 * 보조 문장의 분해 두 값(세월이 흐른 시간·결정을 읽고 고른 시간)을 더하면 늘 이 값이다. 보조 문장은 분해 → 제외 범위 → [배속·자동 모드·「다음 결정으로」를 쓴 판에만] → 이 기기에만.
 * 이어하기 횟수(resumes)·일시정지 횟수는 그리지 않는다(누적만 — 마스터 승인). 이 컴포넌트는 play가 있는 판에서만 부른다(M8 이전 저장은 블록 자체가 없다).
 */
function PlayTimeBlock({ play }: { play: PlayRecord }) {
  const [lead, mid, tail] = breakdownParts();
  return (
    <div className="playtime" data-testid="ending-playtime">
      <dl className="playtime__row">
        <dt>{PLAYTIME_TEXT.label}</dt>
        <dd>
          <PlayTime seconds={displaySeconds(play)} className="playtime__value" testId="ending-playtime-value" />
        </dd>
      </dl>
      <p className="t-xs t-faint playtime__note" data-testid="ending-playtime-note">
        {/* 글자 조각마다 Glue (D-98): 관형사 「그」「이」가 줄 끝에 홀로 남지 않게 — 글자·낭독은 그대로, 공백 조각은 그대로 둔다 */}
        <Glue text={lead} />
        <PlayTime seconds={Math.floor(play.hold / 1000)} testId="ending-playtime-hold" />
        <Glue text={mid} />
        <PlayTime seconds={Math.floor(play.decide / 1000)} testId="ending-playtime-decide" />
        <Glue text={tail} /> <Glue text={PLAYTIME_TEXT.excluded} /> {isCleanRun(play) ? null : <><Glue text={PLAYTIME_TEXT.notClean} /> </>}
        <Glue text={PLAYTIME_TEXT.device} />
      </p>
    </div>
  );
}

function TimelineItem({ entry }: { entry: HistoryEntry }) {
  // 「나의 기록」 줄(M7c FR9): 인생 기록(LogCard)과 같은 부품 — 라벨 「나의 기록 · {주제}」 + 사용자 글(`<bdi data-user-text>`). 글을 읽는 분기는 없다
  if (entry.kind === 'note') {
    return (
      <li className="is-note" data-kind="note" data-testid="timeline-entry">
        <span className="log__age">{entry.age}세</span>
        <span>
          <NoteBody entry={entry} textClassName="tl-text" />
        </span>
      </li>
    );
  }
  return (
    <li className={entry.kind === 'choice' ? 'is-choice' : undefined} data-kind={entry.kind} data-testid="timeline-entry">
      <span className="log__age">{entry.age}세</span>
      <span>
        {entry.title ? <strong>{entry.title}</strong> : null}
        {entry.choice ? (
          <span className="tl-picked" data-testid="timeline-picked" data-by={entry.by}>
            {entry.by !== undefined ? (
              // 부모님이 정한 일·아이의 일로 흘러간 일 (PD6·PD9): 인생 기록 줄과 같은 문구 한 곳 + 아이콘(색에만 의존하지 않는다)
              <>
                <Icon name={deciderIconOf(entry.by)} className="icon--xs" />
                {decidedByText(entry.by)}: {entry.choice}
              </>
            ) : (
              <>선택: {entry.choice}</>
            )}
          </span>
        ) : null}
        <span className="tl-text">{entry.text}</span>
      </span>
    </li>
  );
}

/**
 * 엔딩: 담담한 회고 (SPEC-001 "엔딩", 새 디자인 틀은 SPEC-003 M4 — 시안 docs/design/mockups/ending.html). 공통 헤더(DS1: 게임명 로고 + 화면 이름 「엔딩」) 아래 위에서 아래로 —
 * 누구의 인생이었나(마지막 나이의 얼굴·시대·출생·사망), 출발선에서 마지막까지(같은 세상 안의 자리), 최종 스탯, 생애 연표, 다시 태어나기.
 * 계산(자리·방향·연표 묶기)은 core/ending.ts의 순수 함수가 하고, 이 화면은 결과를 그리기만 한다. 사망 상태는 저장돼 있어 새로고침해도 그대로다.
 * 외모는 어디에도 원점수가 없다 — 얼굴 그림과 「상위/하위 약 N%」 글자만(R-135, M4 완료 기준). 회고·연표 문구는 endingText.ts·lifeText.ts의 함수 출력 그대로다.
 *
 * M7e-3(REV-003-M4-1 R-327, docs/design/copy.md 5-3·5-4, diff-003.md D-41~D-46): 새 디자인 — 머리 「{세상} · 생애 기록」 + 「{출생 연월} ~ {사망 연도}년 · {나이}세」, 출발선 카드의 **출발선 막대**(구간 띠 + 50% 눈금 + 마지막 마름모,
 * `role="img"` + 함수 조합 `aria-label`)와 **범례**(출발선 = 수저 칩 + 「({구간})」, 마지막 = 자리), 합쇼체 문장. 막대의 숫자는 모두 구현 함수에서 온다(`startBandOf`의 low·high, `standingScore(end)`).
 */
export function EndingScreen({ game, onRebirth, review = reviewEnding(game) }: Props) {
  const headingRef = useFocusOnChange<HTMLHeadingElement>();
  useThemeSurface();
  useScrollTopOnMount();
  const c = game.character;
  const title = `${c.name}${DASH_TEXT.endingTitleSuffix}`;
  const delegatedLine = delegatedSummaryText(review.delegated.parent, review.delegated.child);
  return (
    <div className="page ending-page" data-testid="ending-screen">
      <Sprite />
      <SiteHead name={ENDING_HEAD_NAME} />
      <main className="ending">
        <div className="ending__head">
          <Face age={game.death.age} gender={c.gender} looks={c.looks} large />
          {/* 텍스트 칸: 제목 글자 크기 상한의 컨테이너다(R-320·R-321 — 얼굴 타일이 아니라 이 칸만 flex로 늘어난다, dash.css `.ending__who`) */}
          <div className="ending__who">
            <p className="label" data-testid="ending-era">
              <Glue text={`${ERA_CONFIG[game.era].label} · ${ENDING_HEAD_LABEL}`} hideSeparator />
            </p>
            <h1 className="t-title" ref={headingRef} tabIndex={-1} data-testid="ending-name" style={{ '--title-chars': titleCharsFor(title) } as CSSProperties}>
              {title}
            </h1>
            <p className="t-muted" data-testid="ending-span">
              <Glue text={endingSpanText(c.birthYear, game.birthReport === null ? null : game.birthReport.month, c.birthYear + game.death.age, game.death.age)} hideSeparator />
            </p>
          </div>
        </div>

        <section className="card stack stack--sm" aria-label={DASH_TEXT.endingSummaryLabel}>
          <p data-testid="ending-death">{deathLineText(game.death)}</p>
          <p className="t-muted" data-testid="ending-choices">
            {choiceCountText(review.choiceCount)}
          </p>
          {/* 어린 시절의 큰 결정 가운데 M번은 부모님이 내렸고 K번은 아이의 일로 흘러갔습니다 (PD9, copy.md 11-1 ③) — 둘 다 0이면 줄이 없다(조기 사망 등) */}
          {delegatedLine === null ? null : (
            <p className="t-muted" data-testid="ending-delegated">
              {delegatedLine}
            </p>
          )}
          {/* 플레이 시간(M8 LM6): 시간 기록이 있는 판에만 — M8 이전 저장은 블록이 없다 */}
          {game.play !== undefined ? <PlayTimeBlock play={game.play} /> : null}
        </section>

        <section className="card" aria-labelledby="ending-journey-title" data-testid="ending-journey-section">
          <h2 id="ending-journey-title" className="card__title card__title--gap">
            {ENDING_HEADINGS.journey}
          </h2>
          <div className="journey">
            {/* 출발선 막대: 선(0 = 하위 끝, 100 = 상위 끝) 위에 출발선 구간 띠(네모) · 50% 눈금 · 마지막 마름모. 글자 크기와 무관한 px 그림이고, 읽기용 설명은 aria-label이 글로 말한다 (R-191(d)) */}
            <div className="journey__bar" role="img" aria-label={journeyBarLabel(review.journey)} data-testid="ending-bar">
              <div className="journey__track">
                <span className="journey__band" style={{ '--from': `${review.journey.start.low}%`, '--to': `${review.journey.start.high}%` } as CSSProperties} />
                <span className="journey__mid" />
                {review.journey.kind === 'compared' ? <span className="journey__end" style={{ '--at': `${standingScore(review.journey.end)}%` } as CSSProperties} data-testid="ending-bar-end" /> : null}
              </div>
              <div className="journey__axis" aria-hidden="true">
                <span>{JOURNEY_BAR_LEGEND.axisLow}</span>
                <span>{JOURNEY_BAR_LEGEND.axisHigh}</span>
              </div>
            </div>
            <dl className="journey__legend" data-testid="ending-legend">
              <div>
                <dt>
                  <i className="journey__key journey__key--band" aria-hidden="true" />
                  {JOURNEY_BAR_LEGEND.start}
                </dt>
                <dd className="grade-line">
                  <GradeChip grade={c.parentWealth} />
                  <span className="grade-line__range" data-testid="grade-range">
                    <Glue text={`(${bandLabel(review.journey.start)})`} />
                  </span>
                </dd>
              </div>
              {review.journey.kind === 'compared' ? (
                <div>
                  <dt>
                    <i className="journey__key journey__key--end" aria-hidden="true" />
                    {JOURNEY_BAR_LEGEND.end}
                  </dt>
                  <dd data-testid="ending-legend-end">
                    <KeepStanding text={standingLabel(review.journey.end)} />
                  </dd>
                </div>
              ) : null}
            </dl>
            <p data-testid="ending-journey">
              <KeepStanding text={journeyText(review.journey)} />
            </p>
            {review.journey.kind === 'compared' ? (
              <>
                <p data-testid="ending-movement">{MOVEMENT_TEXT[review.journey.movement]}</p>
                <p className="t-xs t-faint" data-testid="ending-note">
                  <Glue text={JOURNEY_NOTE} />
                </p>
              </>
            ) : null}
          </div>
        </section>

        <section className="card stack stack--sm ending-stats" aria-labelledby="ending-stats-title" data-testid="ending-stats">
          <h2 id="ending-stats-title" className="card__title">
            {ENDING_HEADINGS.stats}
          </h2>
          {STATUS_ORDER.map(({ key, icon, tone }) => {
            // 처음 값을 옆에 붙이는 것은 뜻이 변하지 않는 지식(학력)·행복·관계뿐이다(COMPARABLE_STATS). 건강은 붙이지 않는다.
            const change = review.changes.find((x) => x.stat === key);
            const started = change !== undefined && (COMPARABLE_STATS as readonly string[]).includes(key) ? change.from : undefined;
            return <FinalMeter key={key} stat={key} label={STATUS_LABEL[key]} value={game.stats[key]} tone={tone} icon={icon} started={started} />;
          })}
          {/* 「재산」 막대 자리: 최종 순자산 한 줄(M5) — 위끝 1px 선이 네 막대와 가른다 */}
          <FinalNetLine era={game.era} net={review.journey.kind === 'compared' && game.assets !== null ? game.assets.net : null} />
          <dl className="facts">
            <dt>{DASH_TEXT.profileLooks}</dt>
            <dd data-testid="final-looks">
              {/* 외모: 점수가 아니라 「상위/하위 약 N%」만 (R-135) */}
              <small>{BIRTH_TEXT.looksSub}</small> {standingLabel(looksStanding(c.looks))}
            </dd>
          </dl>
        </section>

        <section className="card" aria-labelledby="ending-timeline-title" data-testid="ending-timeline">
          {/* 연표는 시간순(위가 처음)이다 — 살아가기 화면의 인생 기록은 최신순(SPEC-005 LR1)이라 두 화면의 순서가 달라 헷갈리지 않게 제목 옆에 순서를 적는다(LR6, 마스터 결정 M1) */}
          <div className="card__head">
            <h2 id="ending-timeline-title" className="card__title">
              {ENDING_HEADINGS.timeline}
            </h2>
            <span className="t-xs t-faint" data-testid="ending-timeline-order">
              {ENDING_HEADINGS.timelineOrder}
            </span>
          </div>
          {review.timeline.map((group) => (
            <div className="tl-group" key={group.stage} data-testid={`timeline-${group.stage}`}>
              <h3>
                <Glue text={stageHeadingText(group.stage)} />
              </h3>
              <ol className="timeline">
                {group.entries.map((e, i) => (
                  <TimelineItem key={`${e.age}-${i}`} entry={e} />
                ))}
              </ol>
            </div>
          ))}
        </section>

        <section className="rebirth">
          <GuardedButton className="btn btn--primary btn--lg" guardKey={ENDING_GUARD_KEY} data-testid="rebirth" onClick={onRebirth}>
            {REBIRTH_LABEL}
          </GuardedButton>
          <p className="t-sm t-muted">
            <Glue text={REBIRTH_NOTE} />
          </p>
        </section>
      </main>
    </div>
  );
}
