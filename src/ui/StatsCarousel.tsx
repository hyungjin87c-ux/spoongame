import { Fragment, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { AUTO_ADVANCE_MS, chartSizeFor, dotLabel, nextSlideIndex, pointerCountsAsHover, shouldAutoAdvance, showDots, slideReadName, swipeStep, valueWidthEm, type CarouselData, type CarouselSlide, type ChartSize, type SlideSideValue } from '../core/carousel';
import { HEAVY_SLIDE_TEXT, VEIL_TEXT } from '../data/gentleText';
import { TITLE_TEXT } from '../data/titleText';
import { Icon } from './Brand';
import { Glue } from './Glue';
import { GuardedButton } from './GuardedButton';
import { Pair } from './Pair';
import { BarTable, SlideChartView, SrTable, Swatch, SwatchRect } from './StatsChart';
import { useIsoLayoutEffect, usePageHidden, useReducedMotion } from './hooks';

/**
 * 한국 사회 통계 캐러셀 (SPEC-003 SC1~SC7). 슬라이드 모델은 core/carousel.ts, 값은 koreaStats.json(접근자는 data/koreaStatsAccess.ts).
 * 동작(SC5): 자동 전환 9초(SPEC-005 M8), 이전·다음 버튼·일시정지 버튼(점은 지표가 5개 이하일 때만, R-133), 포인터가 올라가거나 포커스가 안에 있으면 정지, 터치 스와이프, 키보드 ←/→,
 * 움직임 줄이기이면 자동 전환 없음. 스크린리더 알림(aria-live)은 **자동으로 넘어가는 동안에만 off**이고, 멈춘 상태(일시정지·포커스·포인터·움직임 줄이기)에서는
 * 사용자가 직접 넘길 때 바뀐 슬라이드를 읽도록 polite다(R-205: 멈춘 사유와 무관하게 `auto` 하나로 정한다).
 * 조작 줄(이전·위치·다음·일시정지)은 카드 **오른쪽 위**에 작게 있다(SPEC-005 SH5, 보이는 상자 28px · 거친 포인터 44px) — 슬라이드의 높이가 달라도 같은 자리에 있고, 낮은 화면에서도 하단 띠에 가려지지 않는다(R-200).
 * 카드 머리글(「한국 사회 통계」·「7초마다 다음 지표」/「자동 넘김 멈춤」)은 눈에 보이지 않는다(SH4): 제목은 `h2.sr-only`, 영역 이름은 `aria-label`이 맡고, **자동 넘김의 상태는 일시정지 버튼 자체**(아이콘 + 이름)가 말한다(SH6, WCAG 2.2.2).
 * 슬라이드 위에서부터 표제어(`h3`, 큰 글씨) → 공식 통계명(기준)(작고 연하게) → 값 → 그래프 → 정의 → 출처(SH1).
 * 재개 불변식(QM2-2): 멈춤 사유(일시정지·포인터·키보드 포커스·가려진 탭)가 모두 풀리면 반드시 다시 돈다. 포인터가 카드 위에 있는지는 React의 enter/leave 짝에 기대지 않고
 * **문서 수준 pointermove로 「지금 포인터 밑 요소가 카드 안인가」를 직접 본다** — 「다시 시작」을 누르면 버튼 아이콘이 바뀌면서 포인터 밑 요소가 사라지고, 브라우저가 pointerout 없이
 * 다음 이동 이벤트만 보내면 React의 onPointerLeave(pointerout에서 만들어진다)가 오지 않아 hovering이 true로 남았다(QA-003-M2 M2-A15). 터치는 사유로 세지 않는다(I4).
 * **무거운 장면 가리기**(SPEC-005 QI6 HV7, REV-005-HV-1 7절): `gentle`(설정값)이 켜져 있으면 상담전화 안내(`slide.safety`)가 붙은 자살률 슬라이드가 가려진다 — 표제어 자리에 「무거운 주제 · 마음 건강 통계」, 「펼쳐 보기」 하나(`aria-expanded`·`aria-controls` 두 묶음),
 * 공식 통계명·값·기준·그래프(읽기 이름 포함)·정의 / 출처·기준 줄은 `hidden` 두 묶음에 들어간다. **상담전화 묶음(`slide__help`)은 두 묶음 사이에서 늘 보인다**(이름은 바꾸지도 순화하지도 않는다). 눈에 안 보이는 읽기 이름
 * (슬라이드 `article`의 `aria-label`, 점 버튼 이름)도 분류 문구로 바뀐다. 펼침은 저장하지 않고 **슬라이드를 떠나면(이전·다음·점) 다시 가린다**, 설정이 바뀌어도 초기화된다. 다른 지표는 가리지 않는다(인구 통계이지 장면이 아니다).
 * **펼쳐 둔 동안은 자동 넘김도 멈춘다**(QI6·QI7 뒤 마스터 결정 ③ — 읽는 중에 넘어가 다시 가려지지 않게, 터치 포함: `shouldAutoAdvance`의 `veilOpen` 사유). 접거나 슬라이드를 떠나면 다시 돈다.
 * **전망 슬라이드**(QI4, FC2): 표제어 위 「전망」 칩(색 + 글자 + 아이콘), 정의 줄 아래 한 줄 안내(`slide__projnote`), 접근 가능한 이름 「n/N 전망, …」. 격차·폭염·아기 슬라이드의 그래프 밖 표(sr-only)와 네모 범례 견본도 여기서 그린다.
 * 그래프는 화면에 그려지는 폭으로 좌표를 만든다(`onChartSize`로 폭·레이아웃을 알려 주면 부모가 `buildCarousel(undefined, size)`로 다시 만들어 넘긴다, R-206).
 */

/** 첫 화면이 막 떴을 때의 입력 가드 키(TitleScreen과 같다): 엔딩 「다시 태어나기」 더블탭의 둘째 입력이 캐러셀 버튼에 떨어져도 슬라이드가 넘어가지 않는다. */
const CAROUSEL_GUARD_KEY = 'title';

/**
 * 키보드(또는 보조기기)로 닿은 포커스인가. 마우스·터치로 버튼을 눌러 생긴 포커스는 자동 전환을 멈추지 않는다 —
 * 그렇지 않으면 「다시 시작」을 마우스로 눌러도 버튼에 포커스가 남아 영원히 멈춰 있다. (:focus-visible을 모르는 환경에서는 포커스가 있으면 멈춘다)
 */
function isKeyboardFocus(target: EventTarget): boolean {
  try {
    return (target as Element).matches(':focus-visible');
  } catch {
    return true;
  }
}

/** 큰 값 줄의 글자 크기를 칸 폭에 맞추는 CSS 변수(title.css .slide__value): 값 글자 폭(em)과 단위 글자 수. 글자 크기를 200%로 키워도 숫자가 중간에서 끊기거나 칸을 넘치지 않는다(CM11·QM2-5). */
function valueSizing(valueTexts: readonly string[], unitText: string): CSSProperties {
  const em = Math.max(...valueTexts.map(valueWidthEm), 1);
  return { '--value-em': em, '--unit-chars': Math.max(unitText.length, 1) } as CSSProperties;
}

/** 무거운 장면 가리기가 이 슬라이드에 적용되는가: 설정이 켜져 있고 상담전화 안내가 붙은 슬라이드(자살률)일 때 (HV7) */
export function isVeilableSlide(slide: CarouselSlide, gentle: boolean): boolean {
  return gentle && slide.safety !== null;
}

/**
 * 큰 값 아래 보조 줄 한 줄. QI4 전망 슬라이드의 「2072년 고위 추계(최대인구) …명, 저위 추계(최소인구) …명」은 항목마다 줄바꿈 묶음(`.keep-phrase`)으로 그린다 —
 * `.pair`(「A · B」 짝)로 두면 좁은 칸에서 둘째 항목이 중간에서 갈라졌다(copy.md 14-6). 글자는 `text`와 같다.
 */
function SideLine({ side }: { side: SlideSideValue }) {
  return (
    <p className="slide__side" data-testid="slide-side-value">
      {side.phrases === undefined ? (
        <Glue text={side.text} />
      ) : (
        <>
          <Glue text={side.phrases.lead} />{' '}
          {/* 쉼표는 앞 항목 묶음 안에 둔다 — 묶음이 inline-block이라 묶음 밖에 두면 줄이 쉼표 앞에서 끊겨 쉼표가 줄 첫머리에 온다(QM2-5·QM2-10, 인용 박스와 같은 방법) */}
          {side.phrases.items.map((item, i, all) => (
            <Fragment key={item}>
              {i > 0 ? ' ' : null}
              <span className="keep-phrase">
                <Glue text={i < all.length - 1 ? `${item},` : item} />
              </span>
            </Fragment>
          ))}
        </>
      )}
    </p>
  );
}

function SlideView({ slide, index, count, active, gentle = false, open = false, onToggleVeil }: { slide: CarouselSlide; index: number; count: number; active: boolean; gentle?: boolean; open?: boolean; onToggleVeil?: () => void }) {
  const veilable = isVeilableSlide(slide, gentle);
  const veiled = veilable && !open;
  const chart = <SlideChartView chart={slide.chart} label={slide.chartLabel} />;
  const unit = slide.unitText !== '' ? <small className="slide__unit">{slide.unitText}</small> : null;
  // 표제어 아래 ~ 정의 줄 (가림 대상의 앞 묶음) — 공식 통계명·값·기준·그래프·범례·정의
  const top = (
    <>
      <p className="slide__official" data-testid="slide-official">
        <Glue text={slide.officialText} />
      </p>
      {slide.caption !== null ? (
        <p className="slide__caption">
          <Glue text={slide.caption} />
        </p>
      ) : null}
      {/* 값 줄은 「값 + 단위 낱말」 한 줄, 기준 줄(분모 문구 — 연도·범위는 공식 통계명 줄로 옮겼다, SH3)은 그 아래 따로 — 값 옆 칸에는 단위 낱말만 있다(QM2-4).
          제목에 이름이 든 보조 계열의 값(조혼인율)은 큰 값 바로 아래 줄에 글자로 보인다(QM2-11). 공식 통계명 줄(「혼인 건수·조혼인율(2025년)」)은 둘 다 가리킨다. */}
      {slide.headlines.length > 1 ? (
        // 값이 둘(남자·여자): 라벨을 위에 두고 나란히, 각자 단위를 붙인다
        <p className="slide__value slide__value--multi" style={valueSizing(slide.headlines.map((h) => h.value), slide.unitText)}>
          {slide.headlines.map((h) => (
            <span className="slide__hv" key={h.label ?? h.value}>
              <small className="slide__label">{h.label}</small>
              <span className="slide__num">
                <span data-testid="slide-value">{h.value}</span>
                {unit}
              </span>
            </span>
          ))}
        </p>
      ) : slide.valueText !== null ? (
        <p className="slide__value" style={valueSizing([slide.valueText], slide.unitText)}>
          <span data-testid="slide-value">{slide.valueText}</span>
          {unit}
        </p>
      ) : null}
      {slide.sideValues.map((v) => (
        <SideLine side={v} key={v.name} />
      ))}
      {slide.basisText !== null ? (
        <p className="slide__basis" data-testid="slide-basis-line">
          <Glue text={slide.basisText} />
        </p>
      ) : null}
      {chart}
      {slide.chart.kind === 'bar' ? <BarTable chart={slide.chart} caption={`${slide.title} — 큰 값부터`} /> : null}
      {slide.tables.map((t) => (
        <SrTable table={t} key={t.caption} />
      ))}
      {slide.legend.length >= 2 ? (
        <ul className="legend" aria-label={slide.legendLabel}>
          {slide.legend.map((l) => (
            <li key={l.key}>
              {l.rect === undefined ? <Swatch dash={l.dash} /> : <SwatchRect kind={l.rect} />}
              <span>
                <Glue text={l.label} />
                {l.valueText === '' ? null : (
                  <>
                    {' '}
                    <strong>{l.valueText}</strong>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {slide.seriesNote !== null ? (
        <p className="slide__meta">
          <Glue text={slide.seriesNote} />
        </p>
      ) : null}
      <p className="t-sm t-muted">
        <Glue text={slide.definition} />
      </p>
      {/* 「전망은 예측이 아니라 공식 추계입니다. …」 한 줄 (FC2): 정의 줄 아래, 출처 줄 위 — 칩(위)·점선(그래프)·이 줄(아래) 세 자리가 전망임을 되풀이한다 */}
      {slide.projection !== null ? (
        <p className="slide__projnote" data-testid="slide-projnote">
          {slide.projection.note}
        </p>
      ) : null}
    </>
  );
  // 상담전화 안내 — 가림 대상이 아니다(SC6): 가린 슬라이드에서도 두 묶음 사이에 늘 보인다. 이름·번호·시간은 데이터(helpLine) 그대로
  const help =
    slide.safety !== null ? (
      <aside className="slide__help" data-testid="slide-help" aria-label={slide.safety.name}>
        <p>{TITLE_TEXT.helpLead}</p>
        <p>
          <strong>{slide.safety.name}</strong> <a href={`tel:${slide.safety.number}`}>{slide.safety.number}</a> ({slide.safety.hours})
        </p>
      </aside>
    ) : null;
  // 출처 줄·기준 줄 (가림 대상의 뒤 묶음)
  const bottom = (
    <>
      <p className="slide__meta">
        출처: <Glue text={slide.sourceText} />
      </p>
      <p className="slide__meta" data-testid="slide-basis">
        <Pair text={slide.basisLine} kind="meta" />
      </p>
    </>
  );
  return (
    <article
      className={`slide${active ? ' is-active' : ''}${veiled ? ' slide--veiled' : ''}`}
      data-testid="stat-slide"
      data-slide-id={slide.id}
      aria-roledescription="슬라이드"
      aria-label={veiled ? `${index + 1}/${count} ${HEAVY_SLIDE_TEXT.readName}` : slideReadName(slide, index, count)}
    >
      {/* 「전망」 칩 (FC2): 표제어 위 첫 줄 — 색(놋쇠) + 글자 + 아이콘(점선 꺾은선) 세 겹, 색에만 기대지 않는다 */}
      {slide.projection !== null ? (
        <p className="slide__chips" data-testid="slide-chips">
          <span className="chip chip--proj" data-testid="slide-chip">
            <Icon name="i-proj" />
            {slide.projection.chip}
          </span>
        </p>
      ) : null}
      <h3 className="slide__insight">
        <Glue text={veiled ? HEAVY_SLIDE_TEXT.title : slide.insight} hideSeparator={veiled} />
      </h3>
      {veilable ? (
        <>
          <button type="button" className="btn btn--ghost btn--sm slide__veil-btn" aria-expanded={open} aria-controls={`veil-${slide.id}-a veil-${slide.id}-b`} data-testid="slide-veil-btn" onClick={onToggleVeil}>
            {open ? VEIL_TEXT.close : VEIL_TEXT.open} <span aria-hidden="true">{open ? VEIL_TEXT.markClose : VEIL_TEXT.markOpen}</span>
          </button>
          <div className="slide__veiled" id={`veil-${slide.id}-a`} hidden={!open} data-testid="slide-veiled-top">
            {top}
          </div>
          {help}
          <div className="slide__veiled" id={`veil-${slide.id}-b`} hidden={!open} data-testid="slide-veiled-bottom">
            {bottom}
          </div>
        </>
      ) : (
        <>
          {top}
          {help}
          {bottom}
        </>
      )}
    </article>
  );
}

/** 캐러셀이 오른쪽 열에 놓이는(카드 높이가 슬라이드마다 다른) 넓은 레이아웃인가 — title.css의 같은 경계(960px) */
const WIDE_LAYOUT_QUERY = '(min-width: 960px)';

export function StatsCarousel({ data, onChartSize, gentle = false }: { data: CarouselData; /** 그래프를 그릴 크기(화면에 그려지는 폭·레이아웃)가 바뀔 때 알린다. 없으면 알리지 않는다(주입된 데이터로 그릴 때). */ onChartSize?: (size: ChartSize) => void; /** 「무거운 장면 가리기」(설정값) — 켜져 있으면 자살률 슬라이드가 가려진다(HV7). 기본 꺼짐 */ gentle?: boolean }) {
  const count = data.slides.length;
  const slidesRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  // 펼친 가린 슬라이드의 id (HV7) — 저장하지 않는다. 슬라이드를 떠나거나 설정이 바뀌면 다시 가린다(아래 효과)
  const [veilOpenId, setVeilOpenId] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const pageHidden = usePageHidden();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // 가린 슬라이드를 「펼쳐 보기」로 연 동안은 자동 넘김도 멈춘다 — 읽는 중에 넘어가 다시 가려지지 않게(QI6·QI7 뒤 마스터 결정 ③). 상태라서 터치도 같고, 슬라이드를 떠나면(아래 효과) 펼침이 지워져 다시 돈다.
  const auto = shouldAutoAdvance({ count, paused, hovering, focusWithin, reducedMotion: reduced, pageHidden, veilOpen: veilOpenId !== null });
  // 슬라이드가 그려지는 폭을 재서 부모에게 알린다: 첫 그림 전에 한 번(layout effect), 이후 크기가 바뀔 때마다.
  useIsoLayoutEffect(() => {
    const el = slidesRef.current;
    if (el === null || onChartSize === undefined) return;
    let last = '';
    const report = () => {
      const size = chartSizeFor(el.clientWidth, typeof window.matchMedia === 'function' && window.matchMedia(WIDE_LAYOUT_QUERY).matches);
      const key = `${size.width}x${size.lineHeight}`;
      if (key === last) return; // 슬라이드가 바뀌어 높이만 달라졌을 때는 알리지 않는다
      last = key;
      onChartSize(size);
    };
    report();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onChartSize]);
  // 포인터(마우스·펜)가 카드 위에 있는가 — QM2-2 I3. 포인터가 움직일 때마다(문서 수준) 그 밑 요소가 카드 안인지 직접 보고,
  // 카드를 나가는 네이티브 pointerleave(밑 요소가 바뀌어도 브라우저는 보낸다)와 창 밖으로 나가는 경우도 함께 듣는다. 터치는 건드리지 않는다(I4).
  const hasCard = count > 0;
  useEffect(() => {
    const card = sectionRef.current;
    if (card === null) return;
    const over = (e: globalThis.PointerEvent) => {
      if (!pointerCountsAsHover(e.pointerType)) return;
      setHovering(e.target instanceof Node && card.contains(e.target));
    };
    const left = (e: globalThis.PointerEvent) => {
      if (pointerCountsAsHover(e.pointerType)) setHovering(false);
    };
    const leftWindow = () => setHovering(false);
    document.addEventListener('pointermove', over, { passive: true });
    document.addEventListener('pointerover', over, { passive: true });
    card.addEventListener('pointerleave', left, { passive: true });
    document.documentElement.addEventListener('pointerleave', leftWindow, { passive: true });
    return () => {
      document.removeEventListener('pointermove', over);
      document.removeEventListener('pointerover', over);
      card.removeEventListener('pointerleave', left);
      document.documentElement.removeEventListener('pointerleave', leftWindow);
    };
  }, [hasCard]);
  useEffect(() => {
    if (!auto) return;
    // 슬라이드가 바뀔 때마다(자동이든 손으로든) 9초를 다시 센다
    const id = window.setTimeout(() => setIndex((i) => nextSlideIndex(i, count, 1)), AUTO_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [auto, index, count]);

  const currentIndex = Math.min(index, Math.max(count - 1, 0));
  // 가린 슬라이드를 떠나면(이전·다음·점·자동 넘김) 다시 가린다 — 그리고 설정이 바뀌면 펼침을 모두 지운다(M19). 현재 슬라이드가 바뀌거나 설정이 바뀔 때마다 비운다
  useEffect(() => {
    setVeilOpenId(null);
  }, [currentIndex, gentle]);

  if (count === 0) return null;
  const current = currentIndex;
  const go = (step: 1 | -1) => setIndex((i) => nextSlideIndex(i, count, step));

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    }
  };
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse') return;
    touchStart.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (start === null) return;
    const step = swipeStep(e.clientX - start.x, e.clientY - start.y);
    if (step !== null) go(step);
  };

  return (
    <section
      ref={sectionRef}
      className="card carousel carousel--005"
      data-testid="carousel"
      // 지금 자동 전환이 돌고 있는가(멈춤 사유: 사용자 일시정지·포인터·키보드 포커스·움직임 줄이기·가려진 탭). e2e가 시계를 흘리기 전에 기다리는 기준이다.
      data-autoplay={auto ? 'on' : 'off'}
      aria-roledescription="캐러셀"
      aria-label={TITLE_TEXT.carouselRegionLabel}
      onKeyDown={onKeyDown}
      onFocus={(e) => setFocusWithin(isKeyboardFocus(e.target))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
      }}
    >
      <h2 className="sr-only">{TITLE_TEXT.carouselHeading}</h2>
      <div className="carousel__nav" data-testid="carousel-nav">
        <GuardedButton className="nav-btn" guardKey={CAROUSEL_GUARD_KEY} data-testid="carousel-prev" aria-label={TITLE_TEXT.carouselPrev} onClick={() => go(-1)}>
          <span className="nav-btn__box">
            <Icon name="i-prev" />
          </span>
        </GuardedButton>
        <span className="carousel__status num" data-testid="carousel-count" aria-hidden="true">
          {current + 1} / {count}
        </span>
        <GuardedButton className="nav-btn" guardKey={CAROUSEL_GUARD_KEY} data-testid="carousel-next" aria-label={TITLE_TEXT.carouselNext} onClick={() => go(1)}>
          <span className="nav-btn__box">
            <Icon name="i-forward" />
          </span>
        </GuardedButton>
        {/* 자동 넘김의 상태는 이 버튼의 아이콘·이름이 말한다(SH6): 돌고 있으면 일시정지 아이콘 + 「자동 넘김 일시정지」, 멈추면 재생 아이콘 + 「자동 넘김 다시 시작」. 움직임 줄이기에서는 자동 넘김이 없어 버튼도 없다 */}
        {reduced ? null : (
          <GuardedButton
            className="nav-btn carousel__pause"
            guardKey={CAROUSEL_GUARD_KEY}
            data-testid="carousel-pause"
            aria-label={paused ? TITLE_TEXT.carouselPlay : TITLE_TEXT.carouselPause}
            onClick={() => setPaused((p) => !p)}
          >
            <span className="nav-btn__box">
              <Icon name={paused ? 'i-play' : 'i-pause'} />
            </span>
          </GuardedButton>
        )}
      </div>
      <div
        className="carousel__viewport"
        role="group"
        tabIndex={0}
        aria-label={TITLE_TEXT.carouselViewport}
        data-testid="carousel-viewport"
        // 좁은 화면(한 칸 레이아웃)의 슬라이드 영역은 낮은 화면의 가용 높이보다 클 수 있다 — 키보드로 닿았을 때 위쪽 변이 보이게 맞추는 일(CM10 예외 ②)은 첫 화면 전체의 focusin 한 곳(TitleScreen)이 맡는다
        // (r5까지는 여기에도 같은 호출이 있어 narrow 레이아웃에서 두 번 불렸다 — REV-003-M2-4 R-241). 넓은 화면에서는 이 영역이 따라다니는 카드(스스로 안쪽 스크롤) 안에 있어 카드가 맡는다.
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          touchStart.current = null;
        }}
      >
        <div className="slides" ref={slidesRef} aria-live={auto ? 'off' : 'polite'}>
          {data.slides.map((s, i) => (
            <SlideView key={s.id} slide={s} index={i} count={count} active={i === current} gentle={gentle} open={i === current && veilOpenId === s.id} onToggleVeil={() => setVeilOpenId((id) => (id === s.id ? null : s.id))} />
          ))}
        </div>
      </div>
      {showDots(count) ? (
        <div className="dots" role="group" aria-label="지표 선택" data-testid="carousel-dots">
          {data.slides.map((s, i) => (
            <GuardedButton key={s.id} guardKey={CAROUSEL_GUARD_KEY} data-testid={`carousel-dot-${i}`} aria-label={dotLabel(i, count, isVeilableSlide(s, gentle) && !(i === current && veilOpenId === s.id) ? HEAVY_SLIDE_TEXT.readName : s.insight)} aria-current={i === current ? 'true' : undefined} onClick={() => setIndex(i)}>
              <i />
            </GuardedButton>
          ))}
        </div>
      ) : null}
    </section>
  );
}
