import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { COMPARABLE_STATS, displaySeconds, entryHeadline, heavyKindOfEntry, isCleanRun, reviewEnding, reachedIndependence, type CoParents, type EndingGame, type EndingReview, type HistoryEntry, type PlayTime as PlayRecord, type StatKey } from '../core';
import { profileLabel } from '../core/birthProfile';
import { ageText } from '../core/format';
import { reportPlaceLabel } from '../core/birthReport';
import { looksText } from '../data/looksText';
import { familyLineViewText } from '../data/familyLineText';
import { VEIL_TEXT } from '../data/gentleText';
import { TITLE_TEXT } from '../data/titleText';
import { loadCredits, type CreditsLoaded } from '../credits/loader';
import { decidedByText, deciderIconOf } from '../data/parentDecisionTable';
import { DASH_TEXT, STATUS_LABEL, STATUS_ORDER, titleCharsFor } from '../data/dashText';
import {
  CREDITS_ENTRY_TEXT,
  ENDING_HEADINGS,
  ENDING_HEAD_LABEL,
  ENDING_HOME_ASK,
  endingBornText,
  PLAYTIME_TEXT,
  REBIRTH_LABEL,
  REBIRTH_NOTE,
  breakdownParts,
  choiceCountText,
  deathLineText,
  endingSpanText,
  stageHeadingText,
  startedAtText,
} from '../data/endingText';
import { SiteHead, Icon, Sprite } from '../ui/Brand';
import { Face } from '../ui/Face';
import { FitPair } from '../ui/FitPair';
import { Glue } from '../ui/Glue';
import { GuardedButton } from '../ui/GuardedButton';
import { FinalNetLine } from '../ui/dash/FinalNet';
import { NoteBody } from '../ui/dash/NoteText';
import { VeiledText, VeilTimelineStamp, useVeilOpen } from '../ui/dash/Veil';
import { PlayTime } from '../ui/PlayTime';
import { useFocusOnChange } from '../ui/useFocus';
import { useIsoLayoutEffect } from '../ui/hooks';
import { useScrollTopOnMount, useThemeSurface } from '../ui/useBottomBar';

/** 화면 전환 직후 입력 가드의 키: 마지막 선택·"다음 결정으로"를 누른 손가락의 둘째 입력이 "다시 태어나기"에 떨어지지 않게 한다. */
export const ENDING_GUARD_KEY = 'ending';

/** 로고 확인 단계의 두 버튼이 같은 순간에 뜨므로 한 키를 같이 쓴다 (인생 화면 나가기 확인 단계와 같다) */
export const ENDING_HOME_GUARD_KEY = 'ending-home';

/** 공통 헤더의 화면 이름 (DS1, copy.md 엔딩 행) */
export const ENDING_HEAD_NAME = '엔딩';

interface Props {
  game: EndingGame;
  /** "다시 태어나기": 새 판으로 바꾸고 시대 선택 화면으로 간다 */
  onRebirth: () => void;
  /** 테스트에서 회고를 직접 주입한다 (기본: 게임 상태에서 계산) */
  review?: EndingReview;
  /**
   * 「무거운 장면 가리기」(설정값, SPEC-005 HV3·HV4 ④): 켜져 있으면 생애 연표의 무거운 장면 줄이 지난 줄까지 가려지고 「펼쳐 보기」로 연다(엔딩을 볼 때의 설정값을 따른다 — 줄마다 가렸는지는 저장하지 않는다).
   * 엔딩 맨 위 한 줄은 이 값이 아니라 **판의 기록 `game.gentleUsed`**가 정한다(HV6). 기본 false
   */
  gentle?: boolean;
  /** 개발 서버 전용 탐침 `?__creditsThrow`(App.tsx만 읽는다) — 참이면 「이 삶의 이름들」 줄 모델 계산이 예외를 던진다(자기 오류 경계 e2e) */
  creditsThrow?: boolean;
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

/** 연표 줄 하나의 내용(질문 또는 제목 → 고른 길 → 결과 문장) — 가린 줄의 펼친 원문도 이 부품이라 설정을 끈 화면과 같다 */
function TimelineBody({ entry, subject }: { entry: HistoryEntry; subject: CoParents }) {
  const headline = entryHeadline(entry); // 질문 문장 우선, 없으면 제목 (SPEC-014 QS2)
  return (
    <>
      {headline !== undefined ? <strong>{headline}</strong> : null}
      {entry.choice ? (
        <span className="tl-picked" data-testid="timeline-picked" data-by={entry.by}>
          {entry.by !== undefined ? (
            // 부모님이 정한 일·아이의 일로 흘러간 일 (PD6·PD9): 인생 기록 줄과 같은 문구 한 곳 + 아이콘(색에만 의존하지 않는다)
            <>
              <Icon name={deciderIconOf(entry.by)} className="icon--xs" />
              {decidedByText(entry.by, subject)}: {entry.choice}
            </>
          ) : (
            <>선택: {entry.choice}</>
          )}
        </span>
      ) : null}
      <span className="tl-text">{familyLineViewText(entry.eventId, entry.text)}</span>
    </>
  );
}

function TimelineItem({ entry, subject = 'both', gentle = false, veilId, open = false, onToggle }: { entry: HistoryEntry; /** 부모 결정 줄의 도장 주어 — 그 줄 나이에 함께 사는 부모(SPEC-011 DS1, `review.timeline[].subjects`) */ subject?: CoParents; gentle?: boolean; veilId?: string; open?: boolean; onToggle?: () => void }) {
  // 「나의 기록」 줄(M7c FR9): 인생 기록(LogCard)과 같은 부품 — 라벨 「나의 기록 · {주제}」 + 사용자 글(`<bdi data-user-text>`). 글을 읽는 분기는 없다
  if (entry.kind === 'note') {
    return (
      <li className="is-note" data-kind="note" data-testid="timeline-entry">
        <span className="log__age">{ageText(entry.age)}</span>
        <span>
          <NoteBody entry={entry} textClassName="tl-text" />
        </span>
      </li>
    );
  }
  const heavy = gentle ? heavyKindOfEntry(entry) : null;
  if (heavy !== null && veilId !== undefined) {
    // 가린 줄 (HV4 ④): 인생 기록 줄과 같은 부품 — 안내 「무거운 일이 있었습니다 · {분류}」 + [결정자 도장] + 「펼쳐 보기」, 펼치면 제목 → 고른 길 → 결과 문장. 사망 줄은 heavy가 아니라 여기 오지 않는다(원인 낱말까지 그대로, R-470)
    return (
      <li className={entry.kind === 'choice' ? 'is-choice' : undefined} data-kind={entry.kind} data-veiled="true" data-testid="timeline-entry">
        <span className="log__age">{ageText(entry.age)}</span>
        <span className="veil">
          <VeiledText kind={heavy} age={entry.age} bodyId={`veil-${veilId}`} open={open} onToggle={onToggle ?? (() => undefined)} stamp={entry.by !== undefined ? <VeilTimelineStamp by={entry.by} open={open} subject={subject} /> : null}>
            <TimelineBody entry={entry} subject={subject} />
          </VeiledText>
        </span>
      </li>
    );
  }
  return (
    <li className={entry.kind === 'choice' ? 'is-choice' : undefined} data-kind={entry.kind} data-testid="timeline-entry">
      <span className="log__age">{ageText(entry.age)}</span>
      <span>
        <TimelineBody entry={entry} subject={subject} />
      </span>
    </li>
  );
}

/**
 * 엔딩: 담담한 회고 (SPEC-001 "엔딩", 새 디자인 틀은 SPEC-003 M4 — 시안 docs/design/mockups/ending.html). 공통 헤더(DS1: 게임명 로고 + 화면 이름 「엔딩」) 아래 위에서 아래로 —
 * 누구의 인생이었나(마지막 나이의 얼굴·시대·출생·사망), 최종 스탯, 생애 연표, 다시 태어나기.
 * 계산(자리·방향·연표 묶기)은 core/ending.ts의 순수 함수가 하고, 이 화면은 결과를 그리기만 한다. 사망 상태는 저장돼 있어 새로고침해도 그대로다.
 * 외모는 어디에도 원점수가 없다 — 얼굴 그림과 「상위/하위 약 N%」 글자만(R-135, M4 완료 기준). 회고·연표 문구는 endingText.ts·lifeText.ts의 함수 출력 그대로다.
 *
 * M7e-3(REV-003-M4-1 R-327, docs/design/copy.md 5-3·5-4, diff-003.md D-41~D-46): 새 디자인 — 머리 「{세상} · 생애 기록」 + 「{출생 연월} ~ {사망 연도}년 · {나이}세」, 합쇼체 문장.
 * 2026-11-13: 「출발선에서 마지막까지」 카드(출발선 막대·범례·도착 자리 문장·이동 판정)는 삭제했다(결정 후속 256). 최종 순자산 줄은 「20세 넘어 마친 판이고 자산이 있음」일 때만 금액을 보인다.
 */
export function EndingScreen({ game, onRebirth, review = reviewEnding(game), gentle = false, creditsThrow = false }: Props) {
  const headingRef = useFocusOnChange<HTMLHeadingElement>();
  useThemeSurface();
  useScrollTopOnMount();
  // 이 삶의 이름들을 뒤로가기로 닫을 때 브라우저가 history 항목의 옛 스크롤(맨 위)로 되돌리지 않게, 이 화면이 떠 있는 동안은 스크롤 복원을 직접 한다(닫을 때 아래 효과가 열기 전 위치로 되돌린다)
  useEffect(() => {
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = prev;
    };
  }, []);
  const c = game.character;
  const title = `${c.name}${DASH_TEXT.endingTitleSuffix}`;
  const veil = useVeilOpen(gentle);

  // 「이 삶의 이름들」(SPEC-022 EC1): 버튼을 누른 뒤에야 지연 덩어리를 받고(받는 중·실패는 버튼 글자로), 열려 있는 동안에도 이 화면은 언마운트하지 않는다 — 회고 본문만 `hidden`이다. 닫는 길 넷은 이 삶의 이름들 덩어리의 「닫기 요청」 하나로 모인다.
  const [namesLoad, setNamesLoad] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [names, setNames] = useState<CreditsLoaded | null>(null);
  const [namesOpen, setNamesOpen] = useState(false);
  const openRef = useRef<HTMLButtonElement>(null);
  const closeNamesRef = useRef<(() => void) | null>(null);
  const savedScroll = useRef(0);
  const alive = useRef(true);
  const namesShown = useRef(false); // 이미 열려 있으면 다시 열지 않는다(스크롤 위치를 열린 화면의 0으로 덮지 않는다)
  const busy = useRef(false); // 연타·키 반복에도 한 번만 받고 한 번만 연다(상태는 다음 렌더에야 바뀌므로 ref로 막는다)
  const homeAskOpen = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const openNames = () => {
    if (busy.current || namesShown.current) return;
    busy.current = true;
    setNamesLoad('loading');
    loadCredits(c.birthYear, game.death.age, game.birthReport !== null).then(
      (loaded) => {
        busy.current = false;
        if (!alive.current) return;
        setNamesLoad('idle');
        if (homeAskOpen.current || namesShown.current) return; // 로고 확인 단계가 열려 있으면 열지 않고 버튼만 원래 문구로 돌린다
        namesShown.current = true;
        savedScroll.current = window.scrollY;
        setNames(loaded);
        setNamesOpen(true);
      },
      () => {
        busy.current = false;
        if (alive.current) setNamesLoad('failed');
      },
    );
  };
  const wasOpen = useRef(false);
  useIsoLayoutEffect(() => {
    if (namesOpen) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const y = savedScroll.current;
    window.scrollTo(0, y); // 닫은 뒤 회고의 스크롤 위치·초점(호출한 버튼)을 되돌린다 — 브라우저가 늦게 옛 위치를 되살려도 다음 프레임에 한 번 더 맞춘다
    window.requestAnimationFrame(() => window.scrollTo(0, y));
    window.setTimeout(() => window.scrollTo(0, y), 150);
    openRef.current?.focus({ preventScroll: true });
  }, [namesOpen]);

  // 헤더 로고 → 한 번 묻고 첫 화면 (SPEC-016 H1, 형진 님 2026-11-10): 엔딩은 `hasProgress` 밖이라 `openTitle`이 움직이지 않고, 끝난 판이라 첫 화면으로 가면 「다시 태어나기」와 같이 새 판이 된다(이 인생의 기록은 사라진다).
  // 그래서 인생 화면 「나가기」와 같은 모양의 확인 단계(`.exit-ask`)를 한 번 거치고, 확정은 같은 `onRebirth`다(reducer는 ending에서만 받아 연타에도 새 판은 하나). 취소·Esc는 엔딩 그대로 두고 로고로 포커스를 돌려준다. 새 액션·저장 필드 없음.
  const [homeAsk, setHomeAsk] = useState(false);
  homeAskOpen.current = homeAsk;
  const logoRef = useRef<HTMLButtonElement>(null);
  // 열린 채 로고를 다시 누르면 새로 열지 않고 포커스만 안전한 쪽으로 다시 가져온다(상자는 하나뿐, title-ci.md 3-6 동작 4)
  const openHomeAsk = () => {
    if (homeAsk) cancelRef.current?.focus({ preventScroll: true });
    else setHomeAsk(true);
  };
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const closeHomeAsk = () => {
    returnFocus.current = true;
    setHomeAsk(false);
  };
  useEffect(() => {
    if (!homeAsk) {
      if (returnFocus.current) {
        returnFocus.current = false;
        logoRef.current?.focus();
      }
      return;
    }
    cancelRef.current?.focus({ preventScroll: true }); // 열리면 안전한 쪽(계속 보기)으로
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        returnFocus.current = true;
        setHomeAsk(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [homeAsk]);

  return (
    <div className="page ending-page" data-testid="ending-screen">
      <Sprite />
      {/* 이 화면이 열려 있으면 화면 이름은 「이름과 시간」이고 로고는 확인 단계 없이 먼저 회고로 돌아간다 */}
      <SiteHead name={namesOpen ? CREDITS_ENTRY_TEXT.headName : ENDING_HEAD_NAME} onHome={namesOpen ? () => closeNamesRef.current?.() : openHomeAsk} homeRef={logoRef} />
      <main className="ending" hidden={namesOpen}>
        {homeAsk ? (
          <div className="exit-ask" role="group" aria-labelledby="ending-home-ask-t" data-testid="ending-home-ask">
            <p className="exit-ask__title" id="ending-home-ask-t" role="alert" data-testid="ending-home-ask-title">
              {ENDING_HOME_ASK.title}
            </p>
            <p className="t-sm t-muted">
              <Glue text={ENDING_HOME_ASK.sub} />
            </p>
            <div className="exit-ask__actions">
              <GuardedButton guardKey={ENDING_HOME_GUARD_KEY} className="btn btn--secondary" data-testid="ending-home-yes" onClick={onRebirth}>
                {ENDING_HOME_ASK.yes}
              </GuardedButton>
              <GuardedButton ref={cancelRef} guardKey={ENDING_HOME_GUARD_KEY} className="btn btn--primary" data-testid="ending-home-no" onClick={closeHomeAsk}>
                {ENDING_HOME_ASK.no}
              </GuardedButton>
            </div>
          </div>
        ) : null}
        {/* 이 판은 무거운 장면 가리기를 켠 채 살았다 (HV6): 기준은 설정이 아니라 **판의 기록**(`gentleUsed` — 판 도중 한 번이라도 켜졌으면 참)이라 설정이 꺼져 있어도 보인다. 의견 보내기 주소·플레이 시간에는 싣지 않는다 */}
        {game.gentleUsed === true ? (
          <p className="ending__gentle" data-testid="ending-gentle">
            {VEIL_TEXT.endingLine}
          </p>
        ) : null}
        <div className="ending__head">
          <Face age={game.death.age} gender={c.gender} looks={c.looks} birthYear={c.birthYear} large />
          {/* 텍스트 칸: 제목 글자 크기 상한의 컨테이너다(R-320·R-321 — 얼굴 타일이 아니라 이 칸만 flex로 늘어난다, dash.css `.ending__who`) */}
          <div className="ending__who">
            <p className="label" data-testid="ending-era">
              {ENDING_HEAD_LABEL}
            </p>
            <h1 className="t-title" ref={headingRef} tabIndex={-1} data-testid="ending-name" style={{ '--title-chars': titleCharsFor(title) } as CSSProperties}>
              {title}
            </h1>
            {/* 세대 표기 (GS9·GD2): 「{세대 이름} · {연도}년생」과 태어난 곳(그 해의 행정구역 이름 + 지금의 시도) */}
            <p className="ending__meta" data-testid="ending-gen">
              <strong>
                <FitPair a={profileLabel(game.generation)} b={`${c.birthYear}년생`} hideSeparator />
              </strong>
              {game.birthReport === null ? null : <span>{endingBornText(reportPlaceLabel(game.birthReport, c.birthYear))}</span>}
            </p>
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
          {/* 어린 시절 부모 결정·흘러감 횟수 요약 문장(PD9 둘째 줄)은 형진 님 요청으로 없앴다(2026-11-08) — 「N번의 선택」은 본인이 고른 선택만 센다 */}
          {/* 플레이 시간(M8 LM6): 시간 기록이 있는 판에만 — M8 이전 저장은 블록이 없다 */}
          {game.play !== undefined ? <PlayTimeBlock play={game.play} /> : null}
        </section>

        {/* 「이 삶의 이름들」 진입부(SPEC-022 EC1 1항): 제목 · 설명 한 줄 · 버튼 하나. 받는 중·실패에도 버튼의 자리·크기는 그대로다(기본 문구가 보이지 않는 자리잡이로 남는다) */}
        <section className="ending__names" aria-labelledby="ending-names-title">
          <h2 id="ending-names-title" className="ending__names-title">
            {CREDITS_ENTRY_TEXT.title}
          </h2>
          <p className="t-muted">{CREDITS_ENTRY_TEXT.note}</p>
          <GuardedButton ref={openRef} className="btn btn--primary ending__names-open" guardKey={ENDING_GUARD_KEY} data-testid="ending-credits-open" aria-disabled={namesLoad === 'loading' ? true : undefined} aria-busy={namesLoad === 'loading' ? true : undefined} onClick={openNames}>
            <span aria-hidden="true">{CREDITS_ENTRY_TEXT.open}</span>
            <span>{namesLoad === 'loading' ? TITLE_TEXT.loading : namesLoad === 'failed' ? TITLE_TEXT.loadRetry : CREDITS_ENTRY_TEXT.open}</span>
          </GuardedButton>
          {namesLoad === 'failed' ? (
            <p className="ending__names-fail" role="alert">
              {CREDITS_ENTRY_TEXT.fail}
            </p>
          ) : null}
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
          <FinalNetLine generation={game.generation} net={reachedIndependence(game.death.age) && game.assets !== null ? game.assets.net : null} />
          <dl className="facts">
            <dt>{DASH_TEXT.profileLooks}</dt>
            <dd data-testid="final-looks">
              {/* 외모: 점수·퍼센트가 아니라 이목구비 글 두 문장 (SPEC-015 AP3) — 출생신고·프로필과 같은 인물의 같은 글(과거형) */}
              {looksText(c, 'ending', game.death.age, game.seed)}
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
                {group.entries.map((e, i) => {
                  const veilId = `tl-${group.stage}-${i}`;
                  return <TimelineItem key={`${e.age}-${i}`} entry={e} subject={group.subjects[i]} gentle={gentle} veilId={veilId} open={veil.isOpen(veilId)} onToggle={() => veil.toggle(veilId)} />;
                })}
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
      {namesOpen && names !== null ? <names.Screen game={game} gentle={gentle} windows={names.windows} onClosed={() => {
          namesShown.current = false;
          setNamesOpen(false);
        }} closeRef={closeNamesRef} probeThrow={creditsThrow} /> : null}
    </div>
  );
}
