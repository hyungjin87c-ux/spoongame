import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CHART_SIZE, buildCarousel, type CarouselData, type ChartSize } from '../core/carousel';
import { formatCount } from '../core/format';
import { tryVirtualPopulation } from '../core/population';
import { ERAS, LIFE_LENGTHS, isLifeLengthSelectable, type Era, type LifeLength } from '../core/types';
import { BUILD_LABEL } from '../buildInfo';
import { ERA_CONFIG } from '../data/birthTable';
import { NAMES } from '../data/names';
import { LIFE_LENGTH_TEXT, NOT_READY_TEXT, TITLE_TEXT, eraMetaText, footerStatsText, heroTagKeepParts } from '../data/titleText';
import { Icon, Spoon, Sprite, TitleLogos } from '../ui/Brand';
import { Glue } from '../ui/Glue';
import { GuardedButton, useInputGuard } from '../ui/GuardedButton';
import { StatsCarousel } from '../ui/StatsCarousel';
import { watchBarRelease } from '../ui/barRelease';
import { revealTopOfTallFocus, revealWithinReleasedBar } from '../ui/focusReveal';
import { useEpochMinute, useIsoLayoutEffect } from '../ui/hooks';
import { useFocusOnChange } from '../ui/useFocus';

/**
 * 첫 화면 (SPEC-003 FS1~FS8, M2). 위에서부터 로고+심볼 → 한 줄 설명 → 수저 다섯 자루 → 가상 인구 문구와 보조 문구 → 태어날 세상 → 인생 길이,
 * 폭 ≥ 960px에서는 오른쪽 열(그보다 좁으면 선택 아래)에 한국 사회 통계 캐러셀, 맨 아래 출처·빌드 버전, 하단 중앙에 고정된 「태어나기」.
 * 진행 중인 판이 있는 채 첫 화면을 다시 열었을 때(`saved`)는 같은 자리에 「이어서 살기」가 기본 버튼이고 「새로 태어나기」는 보조다(이전 판이 사라진다는 확인 단계).
 * 구조·클래스는 docs/design/mockups/title-a.html·title-continue.html과 같다. 문구는 모두 data/titleText.ts.
 */

/** 화면 전환 직후 입력 가드의 키: 엔딩의 「다시 태어나기」 더블탭이 같은 자리의 「태어나기」에 떨어지지 않게 한다(R-014, FS6). */
const GUARD_KEY = 'title';
const GUARD_KEY_SAVED = 'title-saved';
/** 확인 단계의 두 버튼이 같은 순간에 뜨므로 한 키를 같이 쓴다. 가드 시간은 표준(INPUT_GUARD_MS 400ms) 그대로다 — 「새로 태어나기」 더블탭의 둘째 입력이 확인 단계에 떨어져도 아무 일도 일어나지 않는다(R-204). */
const GUARD_KEY_CONFIRM = 'title-confirm';

export interface TitleSaved {
  onResume: () => void;
  /** 확인 단계를 거친 뒤에만 불린다 */
  onBeginNew: () => void;
}

interface Props {
  era: Era;
  lifeLength: LifeLength;
  onSelectEra: (era: Era) => void;
  onSelectLifeLength: (lifeLength: LifeLength) => void;
  onBegin: () => void;
  /** 진행 중인 판이 있고 첫 화면을 다시 연 상태 */
  saved?: TitleSaved | null;
  /** 이전 버전 저장을 버렸다는 안내(C6)를 보일지 */
  oldSaveNotice?: boolean;
  /** 가상 인구 계산에 쓸 시각(에포크 분). 없으면 이 기기의 시계(분 단위). 테스트가 고정값을 넣는다. */
  minute?: number;
  /** 캐러셀 데이터(테스트용 주입). 없으면 koreaStats.json에서 만든다(그래프는 화면에 그려지는 폭에 맞춰 다시 만든다). */
  carousel?: CarouselData;
}

interface RadioCardProps {
  name: string;
  value: string;
  checked: boolean;
  /** 화면 진입 직후 입력 가드가 풀렸는가. 닫혀 있는 동안의 클릭(엔딩의 「다시 태어나기」 더블탭의 둘째 입력 등)은 선택을 바꾸지 않는다(R-014·R-030 방식). */
  guardReady: boolean;
  onSelect: () => void;
  title: string;
  meta?: string;
  desc: string;
  testId: string;
  /** 고를 수 없는 카드(예: 「약 1시간」 — 준비 중). 라디오 그룹 안에 그대로 있고, 비활성 이유는 meta 글자(카드의 접근 가능한 이름에 포함)로 알린다. */
  disabled?: boolean;
}

function RadioCard({ name, value, checked, guardReady, onSelect, title, meta, desc, testId, disabled = false }: RadioCardProps) {
  return (
    <label className={`radio-card${checked ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => {
          // React는 라디오의 값이 바뀐 것을 click에서 알아채므로(preventDefault와 무관하게 onChange가 불린다) 가드가 닫혀 있으면 여기서도 막는다
          if (guardReady && !disabled) onSelect();
        }}
        onClick={(e) => {
          if (!guardReady) e.preventDefault(); // 가드가 닫혀 있으면 선택이 바뀌지 않는다(제어되는 라디오라 화면도 그대로다)
        }}
        data-testid={testId}
      />
      <span className="radio-card__mark">
        <Icon name="i-check" />
      </span>
      <span className="radio-card__body">
        <span className="radio-card__head">
          <span className="radio-card__title">{title}</span>
          {meta !== undefined ? <span className="radio-card__meta">{meta}</span> : null}
        </span>
        <span className="radio-card__desc">{desc}</span>
      </span>
      {checked ? <span className="sr-only">선택됨</span> : null}
    </label>
  );
}

/** 수저 다섯 단계의 이름 (줄바꿈 위치만 시안과 같게: 「다이아몬드/수저」) */
const SPOONS: ReadonlyArray<{ grade: 1 | 2 | 3 | 4 | 5; name: string; lines?: [string, string] }> = [
  { grade: 1, name: '흙수저' },
  { grade: 2, name: '동수저' },
  { grade: 3, name: '은수저' },
  { grade: 4, name: '금수저' },
  { grade: 5, name: '다이아몬드수저', lines: ['다이아몬드', '수저'] },
];

export function TitleScreen({ era, lifeLength, onSelectEra, onSelectLifeLength, onBegin, saved = null, oldSaveNotice = false, minute, carousel }: Props) {
  const headingRef = useFocusOnChange<HTMLHeadingElement>();
  const tagKeep = heroTagKeepParts();
  const clock = useEpochMinute();
  // 근거 통계를 읽을 수 없으면 null — 가상 인구 줄만 빠지고 첫 화면은 그대로 뜬다(R-211)
  const population = tryVirtualPopulation(minute ?? clock);
  const [chartSize, setChartSize] = useState<ChartSize>(DEFAULT_CHART_SIZE);
  const data = useMemo(() => carousel ?? buildCarousel(undefined, chartSize), [carousel, chartSize]);
  const [confirming, setConfirming] = useState(false);
  const guardReady = useInputGuard(GUARD_KEY);
  const barRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const beginNewRef = useRef<HTMLButtonElement>(null);
  /** 확인 단계 안내문(첫 줄) — 풀린 띠에서 포커스 버튼과 함께 화면 안에 오게 하는 기준 */
  const askRef = useRef<HTMLParagraphElement>(null);
  /** 띠가 풀려 있을 때 확인 단계를 연 직후 부른다(위 layout effect가 채운다) */
  const revealOnConfirm = useRef<() => void>(() => {});
  /** 확인 단계를 「돌아가기」·Esc로 닫았을 때만 true: 포커스를 「새로 태어나기」로 돌려준다(R-212). 「확인」으로 화면을 떠날 때는 필요 없다. */
  const returnFocus = useRef(false);

  // 옛 화면(출생·인생·엔딩)은 아직 고정 색이라, 토큰 바탕은 첫 화면이 떠 있는 동안에만 body에 건다(styles/title.css).
  useEffect(() => {
    document.body.classList.add('theme-surface');
    return () => document.body.classList.remove('theme-surface');
  }, []);

  // 하단 띠의 실제 높이를 CSS 변수(--bar-h)로 알려 본문 끝 여백이 상태별 띠 높이(새 판 68px·이어하기 120px·확인 단계 등)를 따르게 한다(R-203).
  // 변수는 문서 루트(<html>)에 건다 — 같은 높이로 **스크롤 여백(scroll-padding-bottom, title.css `html.has-bottom-bar`)**도 정해서, 키보드 Tab·프로그램 focus()가 요소를 화면 안으로 스크롤할 때
  // 고정 띠 위에 머물게 한다(CM10, QA-003-M2 M2-N14: 이 여백이 없을 때는 360×740에서 첫 Tab이 「지금 세상」 카드를 띠 밑으로 보냈다). 이 화면이 떠 있는 동안만 건다.
  // 낮은 화면(QM2-12): 띠 높이가 뷰포트 높이의 절반을 넘으면 `<html class="bar-released">`를 걸어 고정을 풀고 본문 끝에 둔다(styles/title.css가 스크롤 여백·본문 끝 여백·`--bar-h`에 묶인 계산을 함께 푼다).
  // 측정·판정은 ui/barRelease.ts#watchBarRelease가 한다(M3·M4의 띠도 같은 함수): 띠의 실제 높이를 **작은 뷰포트 높이(100svh)**와 견준다 — 주소창이 접혀도 변하지 않는 값이라 스크롤 도중 해제 ↔ 고정이 뒤집히지 않는다(R-240).
  // 클래스만 바꾸므로 포커스를 가진 요소는 포커스를 잃지 않는다. 풀리는 순간 포커스가 띠 안에 있으면(확인 단계를 열어 띠가 커진 경우) 안내문 첫 줄과 포커스 버튼이 함께 화면 안에 오게 하고,
  // 이미 풀린 채 열려 있는 확인 단계에서 글자를 키우거나 창 높이를 줄여도 같은 맞춤을 다시 한다(M2-B07).
  useIsoLayoutEffect(() => {
    const bar = barRef.current;
    if (bar === null) return;
    const root = document.documentElement;
    root.classList.add('has-bottom-bar');
    const revealBarFocus = () => {
      const active = document.activeElement;
      if (active === null || !bar.contains(active)) return;
      revealWithinReleasedBar(askRef.current, active);
    };
    const watch = watchBarRelease(bar, {
      root,
      onRelease: revealBarFocus,
      // 풀린 채 크기가 달라졌을 때는 확인 단계가 열려 있을 때만 맞춘다(안내문이 있을 때) — 다른 상태에서 스크롤을 건드리지 않는다
      onReleasedResize: () => {
        if (askRef.current !== null) revealBarFocus();
      },
    });
    // 확인 단계를 연 직후 띠가 이미 풀려 있으면(풀린 채로 열었을 때) 포커스 버튼과 안내문이 화면 안에 오게 한다
    revealOnConfirm.current = () => {
      if (watch.isReleased()) revealBarFocus();
    };
    return () => {
      revealOnConfirm.current = () => {};
      watch.dispose();
      root.classList.remove('has-bottom-bar');
    };
  }, []);

  // 가용 높이(화면 − 위·아래 스크롤 여백)보다 큰 포커스 대상(큰 글자·낮은 화면에서 라디오 카드·여러 줄 링크·슬라이드 영역이 그렇게 된다)은 위쪽 변이 보이게 맞춘다 — CM10 예외 ②를 화면 전체에 적용한다.
  // 키보드(:focus-visible)로 닿았을 때만 건드리고(눌러서 생긴 포커스는 화면이 점프하면 안 된다), 넓은 레이아웃의 따라다니는 카드(스스로 안쪽 스크롤) 안은 카드가 맡는다.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.closest('.title__side') !== null && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 960px)').matches) return;
      const card = t instanceof HTMLInputElement && t.type === 'radio' ? t.closest('label') : null; // 라디오 카드는 label이 링·크기를 가진다
      revealTopOfTallFocus(card ?? t, 7, t);
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  const closeConfirm = () => {
    returnFocus.current = true;
    setConfirming(false);
  };
  // 확인 단계가 열리면 포커스를 안전한 쪽(돌아가기)으로 옮기고, Esc로 닫는다. 닫히면 「새로 태어나기」로 포커스를 돌려준다.
  useEffect(() => {
    if (!confirming) {
      if (returnFocus.current) {
        returnFocus.current = false;
        beginNewRef.current?.focus();
      }
      return;
    }
    cancelRef.current?.focus();
    revealOnConfirm.current();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        returnFocus.current = true;
        setConfirming(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirming]);

  return (
    <div className="title-page" data-testid="title-screen">
      <Sprite />
      {/* 구조(R-220): 한 격자(.title)에 왼쪽 본문(main)·오른쪽 통계 카드(aside)·왼쪽 아래 푸터(footer)를 함께 둔다. 넓은 화면에서 오른쪽 카드가 푸터 줄까지 걸쳐
          (grid-row: 1 / span 2) 따라다니는(sticky) 범위가 문서 끝까지 이어진다 — 맨 아래에서도 카드가 열 끝에 밀려 올라가지 않는다. 푸터는 <main> 밖이라 페이지 푸터(contentinfo)로 남는다. */}
      <div className="title">
        <main className="title__main">
          {oldSaveNotice ? (
            <p className="title__notice" role="status" data-testid="old-save-notice">
              {TITLE_TEXT.oldSaveNotice}
            </p>
          ) : null}
          <header className="hero">
            <h1 ref={headingRef} tabIndex={-1} data-testid="title-heading">
              <span className="sr-only">수저 게임</span>
              <TitleLogos />
            </h1>
            <p className="hero__tag">
              {TITLE_TEXT.heroTagLead}
              <span className="keep-phrase">
                {tagKeep[0]}
                {tagKeep[1] === '' ? null : <span className="nowrap">{tagKeep[1]}</span>}
                {tagKeep[2]}
              </span>
            </p>
            <ul className="spoon-lineup" aria-label={TITLE_TEXT.spoonLineupLabel} data-testid="spoon-lineup">
              {SPOONS.map((s) => (
                <li key={s.grade} className={`spoon-fig grade--${s.grade}`}>
                  <Spoon grade={s.grade} large />
                  <span className="spoon-fig__name">
                    {s.lines === undefined ? (
                      s.name
                    ) : (
                      <>
                        {s.lines[0]}
                        <br />
                        {s.lines[1]}
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {population === null ? null : (
              <>
                {/* 「N명」을 함께 굵게(시안·docs/design/copy.md 1절: {N}명), 숫자만 data-testid로 따로 읽는다 */}
                <p className="hero__pop" data-testid="population-line">
                  <strong>
                    <span data-testid="population-count">{formatCount(population)}</span>
                    {TITLE_TEXT.populationUnit}
                  </strong>
                  {TITLE_TEXT.populationSuffix}
                </p>
                <p className="hero__note" data-testid="population-note">
                  <Glue text={TITLE_TEXT.populationNote} />
                </p>
              </>
            )}
          </header>
          <fieldset>
            <legend className="group-title">{TITLE_TEXT.eraGroup}</legend>
            <div className="choices choices--1" role="radiogroup" aria-label={TITLE_TEXT.eraGroup} data-testid="era-group">
              {ERAS.map((e) => (
                <RadioCard
                  key={e}
                  name="era"
                  value={e}
                  checked={e === era}
                  guardReady={guardReady}
                  onSelect={() => onSelectEra(e)}
                  title={ERA_CONFIG[e].label}
                  meta={eraMetaText(e, ERA_CONFIG[e].birthYears)}
                  desc={ERA_CONFIG[e].blurb}
                  testId={`era-${e}`}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="group-title">{TITLE_TEXT.lifeLengthGroup}</legend>
            <div className="choices choices--2" role="radiogroup" aria-label={TITLE_TEXT.lifeLengthGroup} data-testid="life-length-group">
              {LIFE_LENGTHS.map((l) => {
                const selectable = isLifeLengthSelectable(l);
                return (
                  <RadioCard
                    key={l}
                    name="lifeLength"
                    value={l}
                    checked={l === lifeLength}
                    guardReady={guardReady}
                    onSelect={() => onSelectLifeLength(l)}
                    title={LIFE_LENGTH_TEXT[l].title}
                    meta={selectable ? undefined : NOT_READY_TEXT}
                    desc={LIFE_LENGTH_TEXT[l].desc}
                    testId={`life-${l}`}
                    disabled={!selectable}
                  />
                );
              })}
            </div>
            <p className="t-sm t-muted" style={{ marginTop: 'var(--sp-2)' }} data-testid="life-length-hint">
              <Glue text={TITLE_TEXT.lifeLengthHint} />
            </p>
          </fieldset>
        </main>
        <aside className="title__side">
          <StatsCarousel data={data} onChartSize={carousel === undefined ? setChartSize : undefined} />
        </aside>
        <footer className="title-foot" data-testid="title-foot">
          {/* 법원 통계 자료 이용 조건: 출처를 구체적으로 표시한다(문구·주소는 names.json의 meta.attribution). */}
          <p className="credit" data-testid="names-credit">
            <a href={NAMES.meta.attribution.url} target="_blank" rel="noopener noreferrer">
              <Glue text={NAMES.meta.attribution.text} />
            </a>
          </p>
          <p data-testid="stats-credit">
            <Glue text={footerStatsText(data.orgs)} />
          </p>
          <p data-testid="population-info">
            <Glue text={TITLE_TEXT.populationInfo} />
          </p>
          <p className="num" data-testid="build-version">
            {BUILD_LABEL}
          </p>
        </footer>
      </div>
      <div className="page-end-space" />
      <div className="bottom-bar" data-testid="bottom-bar" ref={barRef}>
        {saved === null ? (
          <GuardedButton className="btn btn--primary btn--lg" guardKey={GUARD_KEY} data-testid="start-birth" onClick={onBegin}>
            {TITLE_TEXT.begin}
          </GuardedButton>
        ) : confirming ? (
          <>
            <p className="bottom-bar__ask" role="alert" data-testid="confirm-new-ask" ref={askRef}>
              {TITLE_TEXT.confirmNewTitle}
            </p>
            {/*
              자리 배치(R-204): 「새로 태어나기」(보조)가 있던 맨 아래 자리에는 안전한 「돌아가기」가 놓이고, 이전 판을 지우는 확인은 그 위 줄이다.
              「새로 태어나기」를 더블탭한 둘째 입력은 같은 자리의 「돌아가기」에 떨어져 가드에 막힌다 — 확인 없이 이전 판이 지워지는 일이 없다.
            */}
            <div className="bottom-bar__stack">
              <GuardedButton className="btn btn--secondary" guardKey={GUARD_KEY_CONFIRM} data-testid="confirm-new-yes" onClick={saved.onBeginNew}>
                {TITLE_TEXT.confirmNewYes}
              </GuardedButton>
              <GuardedButton ref={cancelRef} className="btn btn--primary btn--lg" guardKey={GUARD_KEY_CONFIRM} data-testid="confirm-new-no" onClick={closeConfirm}>
                {TITLE_TEXT.confirmNewNo}
              </GuardedButton>
            </div>
          </>
        ) : (
          <>
            <GuardedButton className="btn btn--primary btn--lg" guardKey={GUARD_KEY_SAVED} data-testid="resume" onClick={saved.onResume}>
              {TITLE_TEXT.resume}
            </GuardedButton>
            <GuardedButton ref={beginNewRef} className="btn btn--ghost btn--sm" guardKey={GUARD_KEY_SAVED} data-testid="begin-new" onClick={() => setConfirming(true)}>
              {TITLE_TEXT.beginNew}
            </GuardedButton>
          </>
        )}
      </div>
    </div>
  );
}
