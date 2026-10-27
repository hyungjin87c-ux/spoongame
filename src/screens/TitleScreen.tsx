import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hasUnseenNotes } from '../core/build';
import { DEFAULT_CHART_SIZE, buildCarousel, type CarouselData, type ChartSize } from '../core/carousel';
import { buildFeedbackUrl, feedbackFieldsOf } from '../core/feedback';
import { genChartSource } from '../core/genChart';
import { pickAllowedForChoice, unpickableRegions } from '../core/birthProfile';
import { GENERATION_IDS, LIFE_LENGTHS, isLifeLengthSelectable, type GenerationChoice, type GenerationId, type LifeLength } from '../core/types';
import { BUILD_LABEL } from '../buildInfo';
import { APP_VERSION, REPO_URL } from '../buildInfo';
import { buildAboutFaq } from '../data/aboutFaq';
import { GEN_ROWS, GEN_TEXT, REGION_CHIP_NAMES, formalNames, type GenRowText } from '../data/generationText';
import { CURRENT_REGION_NAMES, REGION_KEYS, type CurrentRegionName } from '../data/regionKeys';
import { RELEASE_NOTES } from '../data/releaseNotes';
import { LIFE_LENGTH_TEXT, NOT_READY_TEXT, TITLE_TEXT } from '../data/titleText';
import { Icon, Sprite, TitleWordmark } from '../ui/Brand';
import { Glue } from '../ui/Glue';
import { GuardedButton, useInputGuard } from '../ui/GuardedButton';
import { InfoPanel, type InfoSection } from '../ui/InfoPanel';
import { StatsCarousel } from '../ui/StatsCarousel';
import { TitleFooter } from '../ui/TitleFooter';
import { watchBarRelease } from '../ui/barRelease';
import { revealGenRow, revealTopOfTallFocus, revealWithinReleasedBar } from '../ui/focusReveal';
import { useIsoLayoutEffect } from '../ui/hooks';
import { useFocusOnChange } from '../ui/useFocus';

/**
 * 첫 화면 (SPEC-003 FS1~FS8, M2 → SPEC-005 QI3 HS1~HS5·SH1~SH7 → **SPEC-004 GS1~GS4·GS10·GS11·RG1~RG3**). 위에서부터 로고(워드마크) → 부제 「다른 세대, 다른 삶, 같은 대한민국」 → 체험 한 줄 →
 * 선택 영역(큰 슬롯 「어느 세대로 살아보고 싶으세요?」 = **한 열 스크롤 세대 목록**(라디오 8줄: 첫 줄 「랜덤 세대」 + 세대 7종, 줄마다 작은 소개) → 작은 슬롯 태어나는 시도(룰렛에 맡기기 / 직접 고르기) · 인생 길이 분절 컨트롤 → 설정 줄 — HS3의 슬롯 원칙: 큰 결정 → 작은 결정),
 * 폭 ≥ 960px에서는 오른쪽 열에 한국 사회 통계 캐러셀(그보다 좁으면 선택 아래 — 캐러셀은 이번 단계에서 그대로 둔다), 맨 아래 출처·빌드 버전, 하단 중앙에 고정된 「태어나기」.
 * 오른쪽 위 일러스트·수저 다섯 자루 줄·가상 인구 문구는 없다(형진 님 GM3 게이트 ③ 답, D4-34·D4-36·5차 변경).
 * 「랜덤 세대」는 버튼이 아니라 목록의 첫 라디오다 — **고르는 것만으로는 뽑지 않고** 「태어나기」를 누를 때 뽑는다(GS3). 처음 방문의 기본 선택은 「랜덤 세대」(GS4).
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
  onBeginNew: (regionPick: string | null) => void;
}

interface Props {
  /** 세대 목록에서 고른 줄 (설정 `generation` — 처음 방문은 `random`) */
  generation: GenerationChoice;
  /** 이 기기에서 끝까지 살아본 세대 (GS10 「살아봄」 표시) */
  lived?: readonly GenerationId[];
  /** 내 출신 시도 설정 (RG3 — 밝히지 않음이면 null). 이 값은 첫 화면의 칩 바로가기와 설정 줄에만 쓴다 */
  homeRegion?: CurrentRegionName | null;
  lifeLength: LifeLength;
  onSelectGeneration: (generation: GenerationChoice) => void;
  onSetHomeRegion?: (region: CurrentRegionName | null) => void;
  onSelectLifeLength: (lifeLength: LifeLength) => void;
  /** 「태어나기」 — 시도를 직접 골랐으면 그 시도(줄임 이름), 룰렛에 맡겼으면 null. 이 단계에서 지연 로드 덩어리를 불러오므로 약속(Promise)을 돌려줄 수 있다 */
  onBegin: (regionPick: string | null) => void;
  /** 「태어나기」 뒤 지연 로드 덩어리를 불러오는 중인가 / 불러오기에 실패했는가 (MG8) */
  loading?: 'idle' | 'loading' | 'failed';
  onRetryLoad?: () => void;
  /** 진행 중인 판이 있고 첫 화면을 다시 연 상태 */
  saved?: TitleSaved | null;
  /** 이전 버전 저장을 버렸다는 안내(C6)를 보일지 */
  oldSaveNotice?: boolean;
  /** 캐러셀 데이터(테스트용 주입). 없으면 koreaStats.json에서 만든다(그래프는 화면에 그려지는 폭에 맞춰 다시 만든다). */
  carousel?: CarouselData;
  /**
   * 설정 줄의 「무거운 장면 가리기」 스위치(HV3, 설정 v5 `gentle`) — App이 설정값과 토글을 넘긴다. 이 값을 넘길 때만 설정 줄이 그려진다(시험이 자리만 보는 경우를 위해 선택).
   * 켜져 있으면 오른쪽 통계 카드의 자살률 슬라이드도 가려진다(HV7, 화면 규칙 (A) — 지금의 설정값으로 화면이 정한다).
   * 판 도중 바꾸는 자리는 이 스위치 하나다 — 인생 화면 도구 줄에는 버튼을 두지 않았다(「나가기 → 첫 화면 → 스위치 → 이어서 살기」가 같은 결과, designer 판단 copy.md 12-7).
   */
  gentle?: { on: boolean; onToggle: () => void };
  /** 마지막으로 본 새 소식의 버전 (설정 `notesSeen`, NT4). 지금 버전이 이보다 높으면 푸터 「새 소식」 링크 옆에 「새」 표시가 뜬다. 기본 빈 글자(본 적 없음) */
  notesSeen?: string;
  /** 정보 패널을 열었다 — 마지막으로 본 버전을 지금 버전으로 갱신한다 (설정 `notesSeen`) */
  onSeeNotes?: (version: string) => void;
  /** 지금 빌드의 버전·저장소 주소 (테스트 주입). 없으면 빌드 설정의 값. 푸터의 빌드 표기는 `BUILD_LABEL` 한 곳이다(QM2-7 d) */
  appVersion?: string;
  repoUrl?: string;
}

/** React 18은 `inert` 불리언 속성을 모른다 — 빈 문자열 속성으로 건다. 패널이 떠 있는 동안 바깥 전부에 거는 값이다 */
const INERT = { inert: '' } as Record<string, string>;

interface GenRowProps {
  row: GenRowText;
  checked: boolean;
  lived: boolean;
  /** 화면 진입 직후 입력 가드가 풀렸는가. 닫혀 있는 동안의 클릭(엔딩의 「다시 태어나기」 더블탭의 둘째 입력 등)은 선택을 바꾸지 않는다(R-014·R-030 방식). */
  guardReady: boolean;
  onSelect: () => void;
}

/**
 * 세대 목록의 한 줄 (GS1·GS2·GS10, 시안 `.gen-row`): 라디오 하나 + 표식 + [이름(+「살아봄」 체크+글자) ········ 메타 「{범위}년생 · 올해 N~M세」] / [작은 글씨 소개].
 * 「랜덤 세대」 줄은 메타가 없다(5차). 접근 가능한 이름 = 이름 + 메타(`aria-labelledby`), 소개는 `aria-describedby`(같은 글자). 「살아봄」은 이 줄의 이름 꼬리에 읽힌다.
 * 선택 상태는 색에만 의존하지 않는다(왼쪽 막대 + 표식 채움 + 체크 + 「선택됨」 읽기). 화살표 키는 라디오 묶음의 기본 동작이다.
 */
function GenRow({ row, checked, lived, guardReady, onSelect }: GenRowProps) {
  const id = row.id;
  return (
    <label className={`gen-row${checked ? ' is-selected' : ''}`} data-testid={`gen-row-${id}`}>
      <input
        type="radio"
        name="gen"
        value={id}
        checked={checked}
        aria-labelledby={`gen-name-${id}${row.meta === null ? '' : ` gen-meta-${id}`}${lived ? ` gen-lived-${id}` : ''}`}
        aria-describedby={`gen-desc-${id}`}
        onChange={() => {
          // React는 라디오의 값이 바뀐 것을 click에서 알아채므로(preventDefault와 무관하게 onChange가 불린다) 가드가 닫혀 있으면 여기서도 막는다
          if (guardReady) onSelect();
        }}
        onClick={(e) => {
          if (!guardReady) e.preventDefault(); // 가드가 닫혀 있으면 선택이 바뀌지 않는다(제어되는 라디오라 화면도 그대로다)
        }}
        data-testid={`gen-${id}`}
      />
      <span className="gen-row__mark" aria-hidden="true">
        <Icon name="i-check" />
      </span>
      <span className="gen-row__body">
        <span className="gen-row__line">
          <span className="gen-row__name" id={`gen-name-${id}`}>
            {row.name}
          </span>
          {lived ? (
            <span className="gen-row__lived" id={`gen-lived-${id}`} data-testid={`gen-lived-${id}`}>
              <Icon name="i-check" />
              {GEN_TEXT.lived}
            </span>
          ) : null}
          {row.meta === null ? null : (
            <span className="gen-row__meta" id={`gen-meta-${id}`}>
              <Glue text={`${row.meta.range} · ${row.meta.age}`} />
            </span>
          )}
        </span>
        <span className="gen-row__desc" id={`gen-desc-${id}`}>
          {row.desc}
          {row.note === null ? null : <span className="gen-row__note"> {row.note}</span>}
        </span>
      </span>
      {checked ? <span className="sr-only">선택됨</span> : null}
    </label>
  );
}

interface SegOptionProps {
  value: LifeLength;
  checked: boolean;
  guardReady: boolean;
  onSelect: () => void;
  title: string;
  /** 고를 수 없는 칸의 비활성 이유(「준비 중」) — 알약으로 보이고 칸의 접근 가능한 이름에 들어간다 */
  meta?: string;
  testId: string;
  disabled?: boolean;
}

/**
 * 인생 길이 분절 컨트롤의 칸 (HS2): 라디오 하나 + 체크 아이콘 + 이름. 선택 = 체크 + 테두리 + 연한 면(색에만 의존하지 않는다), 고를 수 없는 칸 = 점선 + 옅은 글자 + 「준비 중」.
 * 입력 가드(R-014·R-030)는 라디오 카드와 같다 — 화면 진입 직후의 더블탭 둘째 입력이 선택을 바꾸지 않는다. 보이는 높이는 32px이고 누르는 영역은 포인터 환경에서 ≥ 24×24, 거친 포인터에서 44px(CSS).
 */
function SegOption({ value, checked, guardReady, onSelect, title, meta, testId, disabled = false }: SegOptionProps) {
  return (
    <label className={`seg__opt${checked ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}>
      <input
        type="radio"
        name="lifeLength"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => {
          if (guardReady && !disabled) onSelect();
        }}
        onClick={(e) => {
          if (!guardReady) e.preventDefault();
        }}
        data-testid={testId}
      />
      <Icon name="i-check" />
      <span>{title}</span>
      {meta !== undefined ? <span className="seg__meta">{meta}</span> : null}
      {checked ? <span className="sr-only">선택됨</span> : null}
    </label>
  );
}

/**
 * 설정 줄의 「무거운 장면 가리기」 스위치 (HV3, copy.md 9-5). `role="switch"` + `aria-checked`, 이름 `aria-labelledby`·설명 `aria-describedby`. 상태 글자 「꺼짐/켜짐」은 보조(aria-hidden — 상태는 aria-checked가 전한다).
 * 켜짐은 트랙 색 + 썸 위치 + 글자로 구분한다(색에만 의존하지 않는다). 동작(설정 v5 `gentle`·가림 UI)은 QI6에서 연결했다 — TitleScreen은 `gentle` prop이 있을 때만 이 줄을 그린다.
 * 화면 진입 직후 입력 가드(0.4초, R-014)를 다른 선택 컨트롤(라디오 카드·인생 길이)과 같이 받는다 — 「첫 화면으로 나가기」·엔딩 「다시 태어나기」 더블탭의 둘째 입력이 스위치에 떨어져 설정을 바꾸지 않게(판 도중 켜면 `gentleUsed`가 참이 되므로 잘못 눌린 입력의 값이 크다). 가드 중에는 조용히 무시한다(라디오 카드와 같다).
 */
function GentleSwitch({ on, onToggle, guardReady }: { on: boolean; onToggle: () => void; guardReady: boolean }) {
  return (
    <div className="slot slot--setting" data-testid="gentle-slot">
      <button type="button" className="switch" role="switch" aria-checked={on} aria-labelledby="gentle-name" aria-describedby="gentle-desc" data-testid="gentle-switch" onClick={() => (guardReady ? onToggle() : undefined)}>
        <span className="switch__track" aria-hidden="true">
          <span className="switch__thumb" />
        </span>
        <span className="switch__text">
          <span className="switch__name" id="gentle-name">
            {TITLE_TEXT.gentleName}
          </span>
          <span className="switch__state" aria-hidden="true">
            {on ? TITLE_TEXT.gentleOn : TITLE_TEXT.gentleOff}
          </span>
          <span className="switch__desc" id="gentle-desc">
            {TITLE_TEXT.gentleDesc}
          </span>
        </span>
      </button>
    </div>
  );
}

/**
 * 태어나는 시도 묶음 (RG1·RG2, 시안 `.slot--region`): 분절 「룰렛에 맡기기 / 직접 고르기」 + 직접 고르기를 고르면 시·도 칩(라디오). 고를 수 없는 칩(세종 × 산업화~밀레니얼, 「랜덤 세대」에서도 세종)은
 * 점선 + 비활성(`aria-disabled`) + 이유 한 줄로 알린다(색에만 의존하지 않는다). 설정에 「내 출신 시도」가 있으면 칩 맨 앞에 바로가기 칩(RG3). 확정(태어나기) 뒤에는 바꿀 수 없다.
 */
function RegionSlot({
  generation,
  mode,
  picked,
  homeRegion,
  guardReady,
  pickNeeded,
  onMode,
  onPick,
}: {
  generation: GenerationChoice;
  mode: 'roulette' | 'pick';
  picked: string | null;
  homeRegion: CurrentRegionName | null;
  guardReady: boolean;
  /** 「직접 고르기」인데 칩을 고르지 않고 「태어나기」를 눌렀다 — 안내 한 줄을 보인다 (R-519 b) */
  pickNeeded: boolean;
  onMode: (m: 'roulette' | 'pick') => void;
  onPick: (name: string) => void;
}) {
  const disabledKeys = generation === 'random' ? [...new Set(GENERATION_IDS.flatMap((g) => unpickableRegions(g)))] : unpickableRegions(generation);
  const disabledNames = new Set<string>(disabledKeys.map((k) => REGION_KEYS.find((r) => r.key === k)!.short));
  const reason = disabledKeys.length === 0 ? null : generation === 'random' ? GEN_TEXT.regionNoneRandom(formalNames(disabledKeys)) : GEN_TEXT.regionNone(formalNames(disabledKeys));
  const guarded = (fn: () => void) => () => {
    if (guardReady) fn();
  };
  const chip = (name: CurrentRegionName) => {
    const disabled = disabledNames.has(name);
    const on = picked === name && !disabled;
    return (
      <label key={name} className={`chip-opt${disabled ? ' is-disabled' : ''}${on ? ' is-selected' : ''}`} aria-disabled={disabled ? 'true' : undefined}>
        <input type="radio" name="sido" value={name} checked={on} disabled={disabled} onChange={guarded(() => onPick(name))} onClick={(e) => (guardReady ? undefined : e.preventDefault())} data-testid={`sido-${name}`} />
        <Icon name="i-check" />
        <span>{name}</span>
      </label>
    );
  };
  /**
   * 내 출신 시도 바로가기 (RG3): 칩 맨 앞의 **단추** — 누르면 같은 시·도의 일반 칩을 고른다. 라디오가 아니라서 같은 시도의 칩과 둘 다 「고른」 모양이 되지 않는다(화면·접근성 상태 하나, R-519 a).
   * 고를 수 없는 시·도(세종 × 산업화~밀레니얼)이면 비활성이다.
   */
  const originShortcut =
    homeRegion === null ? null : (
      <button type="button" className={`chip-opt chip-opt--origin${disabledNames.has(homeRegion) ? ' is-disabled' : ''}`} disabled={disabledNames.has(homeRegion)} onClick={guarded(() => onPick(homeRegion))} data-testid={`sido-origin-${homeRegion}`}>
        {GEN_TEXT.originChip(homeRegion)}
      </button>
    );
  return (
    <fieldset className="slot slot--small slot--region" data-testid="region-slot">
      <legend className="group-title group-title--inline">{GEN_TEXT.regionTitle}</legend>
      <div className="seg" role="radiogroup" aria-label={GEN_TEXT.regionModeLabel} data-testid="region-mode">
        {(['roulette', 'pick'] as const).map((m) => (
          <label key={m} className={`seg__opt${mode === m ? ' is-selected' : ''}`}>
            <input type="radio" name="regmode" value={m} checked={mode === m} onChange={guarded(() => onMode(m))} onClick={(e) => (guardReady ? undefined : e.preventDefault())} data-testid={`regmode-${m}`} />
            <Icon name="i-check" />
            <span>{m === 'roulette' ? GEN_TEXT.regionRoulette : GEN_TEXT.regionPick}</span>
            {mode === m ? <span className="sr-only">선택됨</span> : null}
          </label>
        ))}
      </div>
      {mode === 'roulette' ? (
        <p className="seg__hint seg__hint--roulette" data-testid="region-hint">
          <Glue text={GEN_TEXT.regionHint} />
        </p>
      ) : (
        <>
          <div className="chipset" data-testid="region-chipset">
            {originShortcut}
            <div className="chipset__radios" role="radiogroup" aria-label={GEN_TEXT.regionChipsLabel} data-testid="region-chips">
              {REGION_CHIP_NAMES.map((name) => chip(name))}
            </div>
          </div>
          <p className="seg__hint chipset__note" data-testid="region-pick-hint">
            {GEN_TEXT.regionPickHint}
            {reason === null ? null : ` ${reason}`}
          </p>
          {pickNeeded ? (
            <p className="seg__hint chipset__note chipset__alert" role="alert" data-testid="region-pick-needed">
              {GEN_TEXT.regionPickNeeded}
            </p>
          ) : null}
        </>
      )}
    </fieldset>
  );
}

/** 내 출신 시도 설정 (RG3): 설정 줄의 접이식 한 줄 — 열면 선택 상자 + 「지우기」 + 개인정보 한 줄. 이 기기의 설정 키 하나에만 남는다(게임 저장·의견 보내기 주소·콘솔·공유 문구에 넣지 않는다) */
function OriginSetting({ value, onChange }: { value: CurrentRegionName | null; onChange: (region: CurrentRegionName | null) => void }) {
  return (
    <details className="disclosure origin" id="origin" data-testid="origin-setting">
      <summary>
        {GEN_TEXT.originTitle} <span className="tag origin__cur" data-testid="origin-current">{value ?? GEN_TEXT.originNone}</span>
      </summary>
      <div className="origin__body">
        <label>
          <span className="sr-only">{GEN_TEXT.originTitle}</span>
          <select className="origin__select" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : (e.target.value as CurrentRegionName))} data-testid="origin-select">
            <option value="">{GEN_TEXT.originNone}</option>
            {CURRENT_REGION_NAMES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange(null)} disabled={value === null} data-testid="origin-clear">
          {GEN_TEXT.originClear}
        </button>
        <p className="origin__desc">
          <Glue text={GEN_TEXT.originDesc} />
        </p>
      </div>
    </details>
  );
}

export function TitleScreen({ generation, lived = [], homeRegion = null, lifeLength, onSelectGeneration, onSetHomeRegion, onSelectLifeLength, onBegin, loading = 'idle', onRetryLoad, saved = null, oldSaveNotice = false, carousel, gentle, notesSeen = '', onSeeNotes, appVersion = APP_VERSION, repoUrl = REPO_URL }: Props) {
  const headingRef = useFocusOnChange<HTMLHeadingElement>();
  // 태어나는 시도 (RG1): 룰렛에 맡기기(기본) / 직접 고르기 — 고른 시도는 「태어나기」를 누를 때 함께 넘어간다. 저장하지 않는다(판마다 새로 정한다)
  const [regionMode, setRegionMode] = useState<'roulette' | 'pick'>('roulette');
  const [regionPicked, setRegionPicked] = useState<string | null>(null);
  // 「직접 고르기」인데 칩을 고르지 않고 「태어나기」를 눌렀다 (R-519 b): 진행하지 않고 안내 한 줄을 보인다. 칩을 고르거나 「룰렛에 맡기기」로 바꾸면 사라진다
  const [pickNeeded, setPickNeeded] = useState(false);
  const pickBlocked = regionMode === 'pick' && regionPicked === null;
  const requirePick = () => {
    setPickNeeded(true);
    // 포커스를 첫 칩으로 — 안내가 화면 밖일 때 칩이 보이는 자리로 오고, 안내(role=alert)는 읽힌다
    window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-testid="region-chips"] input:not(:disabled)')?.focus(), 0);
  };
  const listRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState<ChartSize>(DEFAULT_CHART_SIZE);
  const data = useMemo(() => carousel ?? buildCarousel(undefined, chartSize), [carousel, chartSize]);
  // 캐러셀 첫 장 「세대 그래프」의 재료 (출생아 수·기대수명 — koreaStats.json에서, 확인된 값이 없으면 null이고 그러면 첫 장이 없다)
  const genSource = useMemo(() => genChartSource(), []);
  const [confirming, setConfirming] = useState(false);
  const guardReady = useInputGuard(GUARD_KEY);
  // 정보 패널 「새 소식과 소개」 (QI7 NT4·NT5·FQ1): 열려 있는 구역(없으면 닫힘)과 열었던 링크(닫히면 포커스가 돌아간다). 저장하지 않는다 — 새로고침하면 닫힌 첫 화면이다(SV3)
  const [panel, setPanel] = useState<{ section: InfoSection; token: number } | null>(null);
  const panelOpener = useRef<HTMLElement | null>(null);
  const panelTokens = useRef(0);
  const wasPanelOpen = useRef(false);
  const unseenNotes = hasUnseenNotes(appVersion, notesSeen);
  const openPanel = (section: InfoSection, opener: HTMLElement) => {
    panelOpener.current = opener;
    panelTokens.current += 1;
    setConfirming(false); // 확인 단계(이전 판 지우기)가 열려 있었다면 접는다 — 패널이 그 위에 뜨므로
    setPanel({ section, token: panelTokens.current });
    onSeeNotes?.(appVersion);
  };
  const onPanelClosed = useCallback(() => setPanel(null), []);
  // 패널이 닫히면 포커스는 **열었던 링크**로 돌아간다 (NT5)
  useEffect(() => {
    if (panel === null && wasPanelOpen.current) panelOpener.current?.focus();
    wasPanelOpen.current = panel !== null;
  }, [panel]);
  const feedbackUrl = buildFeedbackUrl(feedbackFieldsOf({ phase: 'title', generation: null, lifeLength: null }, repoUrl, BUILD_LABEL));
  const panelInert = panel === null ? {} : INERT;
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
      // 넓은 레이아웃의 따라다니는 카드(스스로 안쪽 스크롤) 안은 카드가 맡는다 — 단, 카드가 본문 끝에서 문서와 함께 올라가 대상의 윗변이 화면 위로 나가 있으면(GM4 2차: 하단이 두 열을 가로지르며 카드는 본문 첫 줄까지만 따라다닌다) 문서 스크롤로 윗변을 들인다
      if (t.closest('.title__side') !== null && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 960px)').matches && t.getBoundingClientRect().top >= 0) return;
      const card = t instanceof HTMLInputElement && t.type === 'radio' ? t.closest('label') : null; // 라디오 카드는 label이 링·크기를 가진다
      const genList = card !== null && card.classList.contains('gen-row') ? card.parentElement : null;
      if (card !== null && genList !== null && genList.classList.contains('gen-list')) {
        // 세대 목록 줄: 목록 창과 문서를 함께 맞춘다. 브라우저의 기본 포커스 스크롤이 끝난 뒤(다음 프레임)에도 한 번 더 맞춘다
        revealGenRow(card, genList, t);
        requestAnimationFrame(() => revealGenRow(card, genList, t));
        return;
      }
      revealTopOfTallFocus(card ?? t, 7, t);
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  // 고른 세대에서 고를 수 없는 시도가 되면(세종 × 산업화~밀레니얼, 랜덤 세대의 세종) 고른 시도를 푼다 — 비활성 칩이 고른 채 남지 않는다 (RG2 b)
  useEffect(() => {
    if (regionPicked !== null && !pickAllowedForChoice(generation, regionPicked)) setRegionPicked(null);
  }, [generation, regionPicked]);

  // 고른 줄을 목록 창 안에 둔다 — 목록의 scrollTop만 움직인다(scrollIntoView는 문서까지 끌어올린다, D4-38). 처음 칠할 때는 즉시(smooth가 진행 중이면 첫 그림에서 고른 줄이 반쯤 걸친다)
  useIsoLayoutEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>('.gen-row.is-selected');
    if (list === null || list === undefined || row === null || row === undefined) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    // 키보드(방향키)로 고른 줄이면 목록은 즉시 움직이고(부드러운 스크롤이 도는 동안 문서 위치를 잘못 잡지 않게) 문서도 그 줄이 하단 띠·위 가장자리에 가리지 않게 맞춘다(WCAG 2.4.11, ui/focusReveal.ts#revealGenRow).
    // 눌러서 고른 줄은 문서를 건드리지 않는다(화면이 점프하면 안 된다).
    const input = row.querySelector<HTMLInputElement>('input');
    if (input !== null && document.activeElement === input && input.matches(':focus-visible')) {
      revealGenRow(row, list, input);
      return;
    }
    // 줄이 창 밖이면 그 줄의 윗변을 창 윗변에 맞춘다 — 목록은 scroll-snap(줄 윗변이 맞춤 자리)이라 「아랫변을 맞추는」 값은 브라우저가 가장 가까운 윗변 자리로 되돌려 줄 아래가 잘린다
    if (top < list.scrollTop || bottom > list.scrollTop + list.clientHeight) list.scrollTop = top;
  }, [generation]);

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
      <div className="title" {...panelInert}>
        <main className="title__main">
          {oldSaveNotice ? (
            <p className="title__notice" role="status" data-testid="old-save-notice">
              {TITLE_TEXT.oldSaveNotice}
            </p>
          ) : null}
          <header className="hero hero--005 hero--r3">
            <h1 ref={headingRef} tabIndex={-1} data-testid="title-heading">
              <span className="sr-only">수저 게임</span>
              <TitleWordmark />
            </h1>
            <p className="hero__tag">
              {GEN_TEXT.tagLead}
              <span className="nowrap">{GEN_TEXT.tagKeep}</span>
            </p>
            <p className="hero__span" data-testid="hero-span">
              <Glue text={GEN_TEXT.span} />
            </p>
          </header>
          <fieldset className="slot slot--big slot--gen8">
            <legend className="group-title">{GEN_TEXT.question}</legend>
            {/* 한 열 스크롤 라디오 목록 (GS1): 줄 8개 — 첫 줄 「랜덤 세대」, 이어서 세대 7종. 화면 비율에 맞춘 높이 안에서 스크롤하고 고른 줄은 늘 창 안에 있다(D4-37·D4-38) */}
            <div className="gen-list" role="radiogroup" aria-label={GEN_TEXT.listLabel} ref={listRef} data-testid="gen-list">
              {GEN_ROWS.map((row) => (
                <GenRow
                  key={row.id}
                  row={row}
                  checked={row.id === generation}
                  lived={row.id !== 'random' && lived.includes(row.id)}
                  guardReady={guardReady}
                  onSelect={() => onSelectGeneration(row.id)}
                />
              ))}
            </div>
            <details className="disclosure slot__fold" data-testid="gen-fold">
              <summary>{GEN_TEXT.foldSummary}</summary>
              <p>
                <Glue text={GEN_TEXT.foldBody} />
              </p>
            </details>
          </fieldset>
          {/* 작은 슬롯(HS3 ③) — 인생 길이 분절 컨트롤 + 한 줄 안내, 그 아래 설정 줄(④ 무거운 장면 가리기, QI6 전에는 gentle prop이 없어 그려지지 않는다) */}
          <div className="slots-bottom">
            <RegionSlot generation={generation} mode={regionMode} picked={regionPicked} homeRegion={homeRegion} guardReady={guardReady}
              pickNeeded={pickNeeded && pickBlocked}
              onMode={(m) => {
                setRegionMode(m);
                setPickNeeded(false);
              }}
              onPick={(name) => {
                setRegionPicked(name);
                setPickNeeded(false);
              }}
            />
            <fieldset className="slot slot--small">
              <legend className="group-title group-title--inline">{TITLE_TEXT.lifeLengthGroup}</legend>
              <div className="seg" role="radiogroup" aria-label={TITLE_TEXT.lifeLengthGroup} data-testid="life-length-group">
                {LIFE_LENGTHS.map((l) => {
                  const selectable = isLifeLengthSelectable(l);
                  return (
                    <SegOption
                      key={l}
                      value={l}
                      checked={l === lifeLength}
                      guardReady={guardReady}
                      onSelect={() => onSelectLifeLength(l)}
                      title={LIFE_LENGTH_TEXT[l].title}
                      meta={selectable ? undefined : NOT_READY_TEXT}
                      testId={`life-${l}`}
                      disabled={!selectable}
                    />
                  );
                })}
              </div>
              <p className="seg__hint" data-testid="life-length-hint">
                <Glue text={TITLE_TEXT.lifeLengthHint} />
              </p>
            </fieldset>
            {gentle === undefined ? null : <GentleSwitch on={gentle.on} onToggle={gentle.onToggle} guardReady={guardReady} />}
            {onSetHomeRegion === undefined ? null : (
              <div className="slot slot--setting" data-testid="origin-slot">
                <OriginSetting value={homeRegion} onChange={onSetHomeRegion} />
              </div>
            )}
          </div>
        </main>
        <aside className="title__side">
          <StatsCarousel data={data} onChartSize={carousel === undefined ? setChartSize : undefined} gentle={gentle?.on === true} generation={generation} genSource={genSource} />
        </aside>
        {/* 하단 (GS12): 서비스 소개 · 운영자 의도 · 작은 링크 줄 · 이름·통계 출처 · 운영자와 버전 — 푸터 링크는 같은 정보 패널의 구역(소개·개인정보 처리방침·이용 안내·새 소식)을 연다. 링크 이름 = 구역 이름 */}
        <TitleFooter orgs={data.orgs} feedbackUrl={feedbackUrl} unseenNotes={unseenNotes} openPanel={openPanel} guardKey="title-foot" />
      </div>
      <div className="page-end-space" {...panelInert} />
      <div className="bottom-bar" data-testid="bottom-bar" ref={barRef} {...panelInert}>
        {saved === null ? (
          <>
            {loading === 'failed' ? (
              <p className="bottom-bar__ask" role="alert" data-testid="load-failed">
                {TITLE_TEXT.loadFailed}
              </p>
            ) : null}
            <GuardedButton className="btn btn--primary btn--lg" guardKey={GUARD_KEY} data-testid="start-birth" aria-disabled={loading === 'loading' ? true : undefined} aria-busy={loading === 'loading' ? true : undefined} onClick={() => (loading === 'loading' ? undefined : loading === 'failed' && onRetryLoad !== undefined ? onRetryLoad() : pickBlocked ? requirePick() : onBegin(regionMode === 'pick' ? regionPicked : null))}>
              {loading === 'loading' ? TITLE_TEXT.loading : loading === 'failed' ? TITLE_TEXT.loadRetry : TITLE_TEXT.begin}
            </GuardedButton>
          </>
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
              <GuardedButton className="btn btn--secondary" guardKey={GUARD_KEY_CONFIRM} data-testid="confirm-new-yes" onClick={() => saved.onBeginNew(regionMode === 'pick' ? regionPicked : null)}>
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
            <GuardedButton ref={beginNewRef} className="btn btn--ghost btn--sm" guardKey={GUARD_KEY_SAVED} data-testid="begin-new" onClick={() => (pickBlocked ? requirePick() : setConfirming(true))}>
              {TITLE_TEXT.beginNew}
            </GuardedButton>
          </>
        )}
      </div>
      {/* 정보 패널: 바깥(.title·본문 끝 여백·하단 띠)이 모두 inert인 동안만 있다 — aria-modal만으로는 Tab이 뒤로 샌다(design-system.md 11-10) */}
      {panel === null ? null : <InfoPanel key={panel.token} section={panel.section} notes={RELEASE_NOTES} faq={buildAboutFaq({ orgs: data.orgs })} feedbackUrl={feedbackUrl} onClosed={onPanelClosed} guardKey={`info-panel:${panel.token}`} />}
    </div>
  );
}
