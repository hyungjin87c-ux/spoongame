import { eraBucketOf } from '../../core/birthProfile';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { calendarYear, citationFor, coParentsFn, heavyKindOfEvent, pendingLeadOf, type CitationView, type CoParents, type EventDef, type EventPool, type LeadCard, type TickInfo } from '../../core';
import type { ImpactItem } from '../../core/impact';
import { ageText } from '../../core/format';
import { DASH_TEXT, titleCharsFor } from '../../data/dashText';
import { HEAVY_KIND_TEXT, VEIL_TEXT } from '../../data/gentleText';
import { CHILD_CHIP_TEXT, CHILD_FLOW_TEXT, deciderIconOf, parentWording } from '../../data/parentDecisionTable';
import { FitPair } from '../FitPair';
import { GuardedButton } from '../GuardedButton';
import { Icon } from '../Brand';
import type { LifeGame } from './Cards';
import { CitationBox } from './CitationBox';
import { ImpactLine } from './Impact';
import { useVeilOpen } from './Veil';

/**
 * 부모님이 정한 카드 · 아이의 일로 흘러간 카드 (SPEC-005 PD5·PD8, 설계 문서 docs/data/parent-decision-model.md 3-2절, LR5 b).
 *
 * **모달 시트가 아니다.** 어린 시절의 큰 결정이 부모님이 정한 일(`by: 'parent'`)이거나 아이의 반응·행동이라 흘러간 일(`by: 'child'`)이면, 그 해의 결과 연출 대기 동안만 가운데 열 맨 위(인생 기록 바로 위)에
 * 이 비모달 카드가 보이고 해가 넘어가면 사라진다. 사용자의 동작이 필요 없고 **포커스를 가져가지 않는다**(포커스 표 `decideLifeFocus`의 `delegatedCard` 순간 = 이동 없음).
 * 구성(위에서부터): 칩(색 + 글자 + 아이콘) → 제목 → 상황 문장 → **고른 길 한 개(강조) + 도장 문구**(`parentWording`·`CHILD_FLOW_TEXT` 한 곳 — 부모 결정의 주어는 그 해 함께 사는 부모, SPEC-011 DS2) → 영향 줄(고른 길 하나, 표기 = 실제 효과) → 인용 박스(있으면 지금 카드와 같은 부품) →
 * (판의 첫 부모 카드에만) 안내 한 줄. 선택지 버튼·「잠시 덮어 두기」·자동 선택 안내·집안 사정 한 줄(「이 집에서는 고를 수 없었던 길」 류)은 없다(마스터 결정 M6).
 * 스크린리더: 카드는 정적 영역이고 낭독은 인생 기록 줄의 `aria-live`가 맡는다(같은 내용을 두 번 읽지 않게) — 그래서 이 카드에는 `aria-live`·`role="status"`가 없다.
 * **무거운 장면 가리기**(SPEC-005 QI6 HV4 ③ 「부모」 단위): `gentle`(설정값)이 켜져 있고 이벤트에 `heavy` 표지가 있으면 제목·상황·고른 길 라벨·영향 줄·인용을 가리고 칩·「{연도}년 · {나이}세」·**도장**(「부모님이 이렇게 정했습니다」 — 한 분만 함께 사는 해에는 「어머니가/아버지가 …」 — /「이렇게 흘러갔습니다」, 라벨 없이)·첫 부모 카드의 안내 한 줄은 그대로 보인다(HV8).
 * 제목 자리에 「무거운 주제 · {분류}」, 안내 한 줄, 「펼쳐서 읽기」 하나(고를 것이 없는 카드라 자동 고르기 버튼은 없다). 펼침은 이 카드의 상태일 뿐 저장하지 않고 설정이 바뀌면 초기화된다. 사건·효과·영향은 그대로다.
 * 카드는 틱(`TickInfo`)에서 **파생**된다: 새로고침하면 틱이 없어 다시 뜨지 않고 기록 줄만 남는다(PD7-5). 일시정지하면 틱이 그대로라 카드도 그 자리에 머문다.
 *
 * **같은 해 원서 카드(덧카드, SPEC-018 G2 「같은 해에 함께」 — 결정 후속 255·262·263, 시안 `docs/design/mockups/g2-together/`)**: 15세에 일반 추첨이 선택 카드를 뽑은 해에도 G2 「고등학교 원서」가 같은 해에 먼저
 * 부모 결정으로 해결되면 틱의 `lead`에 실린다. 같은 부품을 `variant`로 그린다 — 지금 부모 카드(`main`)의 id·testid(`pc-title`·`parent-card`·…)는 그대로이고, 덧카드는 `lc-`·`lead-` 접두라 두 장이 한 화면에 있어도 겹치지 않는다.
 *  - `lead`(전체형): 자동 모드의 인라인 결정 카드 위 · 결정 카드를 접었을 때 접힌 띠 위 · 그 해 카드도 부모·흘러감이면 그 카드 위(두 장 쌓기). 모양은 지금 부모 카드 그대로(클래스 `.lead-card`는 시험·측정 갈고리).
 *  - `lead-compact`(요약형, 결정 시트 안 맨 위 — 후속 263 ③): 머리 [칩 · 「자세히 보기」] → 제목 → 고른 길 → 영향 줄. 상황 문장·도장·인용(·첫 카드 안내)은 `hidden`으로 DOM 순서 그대로 있다가 「자세히 보기」(후속 263 ④)로 펼친다.
 *    펼침은 이 카드의 지역 상태다(저장하지 않고, 틱이 바뀌거나 시트를 접었다 다시 열면 닫힌다). 단추는 결정 카드와 같은 입력 가드 키를 받고, 눌러도 초점은 단추에 남는다. 연도·나이는 바로 아래 결정 카드 머리와 같은 해라 두지 않는다.
 */

export interface ParentCardModel {
  by: 'parent' | 'child';
  ev: EventDef;
  /** 고른 길의 라벨 — 부모일 때 `parentLabel ?? label` */
  label: string;
  impact: readonly ImpactItem[];
  cite: CitationView | null;
  /** 머리의 「{연도}년 · {나이}세」 — 결정이 일어난 해의 나이 */
  year: number;
  age: number;
  /** 판의 첫 부모 카드: 안내 한 줄이 붙는다 */
  firstParent: boolean;
  /** 칩·도장·안내의 주어 — 결정이 일어난 해(`age`)에 함께 사는 부모(`coParentsOf`, SPEC-011 DS1). 부모 결정이 아니면 `'both'`(쓰이지 않는다). 저장하지 않는 파생값 */
  subject: CoParents;
}

/** 이 틱에서 카드를 그리는가: 인생 단계에서 방금 부모님이 정한·흘러간 해의 결과 연출 대기 중(나이가 한 살 올라 있다)일 때만. 아니면 null */
export function parentCardModel(game: LifeGame, tick: TickInfo | null, pool: EventPool): ParentCardModel | null {
  if (tick === null || tick.by === undefined || tick.kind !== 'resolved' || tick.eventId === undefined || tick.choiceId === undefined) return null;
  if (game.phase !== 'life' || game.age !== tick.fromAge + 1) return null;
  const ev = pool.byId.get(tick.eventId);
  const choice = ev?.choices?.find((c) => c.id === tick.choiceId);
  if (ev === undefined || choice === undefined) return null;
  const year = calendarYear(game.character.birthYear, tick.fromAge);
  return {
    by: tick.by,
    ev,
    label: tick.by === 'parent' ? (choice.parentLabel ?? choice.label) : choice.label,
    impact: tick.impact ?? [],
    cite: citationFor(ev, eraBucketOf(game.generation, year), year),
    year,
    age: tick.fromAge,
    firstParent: tick.firstParent === true,
    subject: tick.by === 'parent' ? coParentsFn(game)(tick.fromAge) : 'both',
  };
}

export function useParentCardModel(game: LifeGame, tick: TickInfo | null, pool: EventPool): ParentCardModel | null {
  return useMemo(() => parentCardModel(game, tick, pool), [game, tick, pool]);
}

/** 덧카드(`LeadCard`) 하나를 카드 모델로 — 값은 엔진이 해결 전 상태로 계산해 틱에 실은 그대로다(영향 줄 = 실제 효과, EC5) */
function leadToModel(game: LifeGame, lead: LeadCard, fromAge: number, pool: EventPool): ParentCardModel | null {
  const ev = pool.byId.get(lead.eventId);
  const choice = ev?.choices?.find((c) => c.id === lead.choiceId);
  if (ev === undefined || choice === undefined) return null;
  const year = calendarYear(game.character.birthYear, fromAge);
  return {
    by: lead.by,
    ev,
    label: lead.by === 'parent' ? (choice.parentLabel ?? choice.label) : choice.label,
    impact: lead.impact,
    cite: citationFor(ev, eraBucketOf(game.generation, year), year),
    year,
    age: fromAge,
    firstParent: lead.firstParent === true,
    subject: lead.by === 'parent' ? coParentsFn(game)(fromAge) : 'both',
  };
}

/**
 * 이 틱에서 같은 해 원서 카드(덧카드)를 그리는가 (결정 후속 255·262, 계획 3-7절): ① 본인 동반 해 — 그 해 결정 카드가 아직 대기 중(`pendingLeadOf`) ② 위임 동반 해 — 부모·흘러감 카드의 결과 연출 대기 중(나이가 한 살 올라 있다).
 * 그 밖(사망 틱 · 고른 뒤의 결과 틱 · 새로고침 직후 틱 없음)은 null — 새로고침하면 다시 뜨지 않고 연표 줄만 남는다(PD7-5).
 */
export function leadCardModel(game: LifeGame, tick: TickInfo | null, pool: EventPool): ParentCardModel | null {
  if (tick === null || tick.lead === undefined || game.phase !== 'life') return null;
  const pendingLead = pendingLeadOf(game, tick);
  if (pendingLead !== null) return leadToModel(game, pendingLead, tick.fromAge, pool);
  if (tick.kind === 'resolved' && tick.by !== undefined && game.age === tick.fromAge + 1) return leadToModel(game, tick.lead, tick.fromAge, pool);
  return null;
}

export function useLeadCardModel(game: LifeGame, tick: TickInfo | null, pool: EventPool): ParentCardModel | null {
  return useMemo(() => leadCardModel(game, tick, pool), [game, tick, pool]);
}

/** 카드 변형: 지금 부모 카드 / 같은 해 원서 카드 전체형 / 결정 시트 안 요약형 */
export type ParentCardVariant = 'main' | 'lead' | 'lead-compact';

/** 결정 시트가 `aria-describedby`로 가리키는 요약 카드의 칩·제목·고른 길 — 시트가 열릴 때 이름 다음에 한 번 읽힌다(시안 6절 낭독) */
export const LEAD_SHEET_DESCRIBED_BY = 'lc-chip lc-title lc-label';

/** 변형별 id·testid — 지금 부모 카드(`main`)는 v0.6.0 값 그대로 */
function namesOf(variant: ParentCardVariant) {
  if (variant === 'main') {
    return { root: 'parent-card', chip: 'parent-chip', when: 'parent-when', title: 'parent-title', titleId: 'pc-title', text: 'parent-text', pick: 'parent-pick', label: 'parent-label', stamp: 'parent-stamp', impact: 'impact', cite: 'cite', hint: 'parent-hint', veilNote: 'veil-note', veilOpen: 'veil-open', ids: null };
  }
  return {
    root: 'lead-card',
    chip: 'lead-chip',
    when: 'lead-when',
    title: 'lead-title',
    titleId: 'lc-title',
    text: 'lead-text',
    pick: 'lead-pick',
    label: 'lead-label',
    stamp: 'lead-stamp',
    impact: 'lead-impact',
    cite: 'lead-cite',
    hint: 'lead-hint',
    veilNote: 'lead-veil-note',
    veilOpen: 'lead-veil-open',
    ids: { chip: 'lc-chip', text: 'lc-text', label: 'lc-label', stamp: 'lc-stamp', cite: 'lc-cite', hint: 'lc-hint' },
  };
}

export function ParentCard({
  model,
  gentle = false,
  variant = 'main',
  guardKey = null,
}: {
  model: ParentCardModel;
  /** 「무거운 장면 가리기」(설정값) */
  gentle?: boolean;
  /** 지금 부모 카드 / 같은 해 원서 카드 전체형 / 결정 시트 안 요약형 (결정 후속 262·263) */
  variant?: ParentCardVariant;
  /** 요약형의 「자세히 보기」 입력 가드 키 — 결정 카드의 선택지와 같은 키(`decisionGuardKey`)를 받는다 */
  guardKey?: string | null;
}) {
  const { by, ev, label, impact, cite, year, age, firstParent, subject } = model;
  const n = namesOf(variant);
  const compact = variant === 'lead-compact';
  // 요약형의 펼침(「자세히 보기」): 카드의 지역 상태 — 저장하지 않는다
  const [more, setMore] = useState(false);
  const wording = parentWording(subject);
  const chip = by === 'parent' ? wording.chip : CHILD_CHIP_TEXT;
  const stamp = by === 'parent' ? wording.stamp : CHILD_FLOW_TEXT;
  const heavy = gentle ? heavyKindOfEvent(ev) : null;
  const veil = useVeilOpen(gentle);
  const opened = veil.isOpen('card');
  const veiled = heavy !== null && !opened;
  // 「펼쳐서 읽기」를 누르면 버튼이 사라지므로 포커스는 제목으로 간다(제목 글자가 이벤트 제목으로 바뀌어 다시 읽힌다). 평소 이 카드는 포커스를 가져가지 않는다
  const titleRef = useRef<HTMLHeadingElement>(null);
  const wasOpened = useRef(opened);
  useEffect(() => {
    if (opened && !wasOpened.current) titleRef.current?.focus({ preventScroll: true });
    wasOpened.current = opened;
  }, [opened]);
  const kindName = heavy === null ? '' : HEAVY_KIND_TEXT[heavy];
  return (
    <section
      className={`card decision decision--parent${by === 'child' ? ' decision--child' : ''}${variant === 'main' ? '' : ' lead-card'}${compact ? ' lead-card--compact' : ''}`}
      aria-labelledby={n.titleId}
      data-testid={n.root}
      data-by={by}
      data-key={`${ev.id}@${age}`}
      data-veiled={veiled ? 'true' : undefined}
    >
      <div className="decision__head">
        <span className={`parent-chip parent-chip--${by}`} data-testid={n.chip} id={n.ids?.chip}>
          <Icon name={deciderIconOf(by)} />
          <span>{chip}</span>
        </span>
        {compact && !veiled ? (
          // 펼침 단추(후속 263 ④ 「자세히 보기」): 이름은 그대로이고 꼬리 ▾가 뒤집히며 aria-expanded가 바뀐다. 가리키는 것은 숨긴 상황 문장·도장·인용(·첫 카드 안내)
          <GuardedButton
            guardKey={guardKey}
            className="btn btn--ghost btn--sm lead-card__more"
            aria-expanded={more}
            aria-controls={[n.ids?.text, n.ids?.stamp, cite !== null ? n.ids?.cite : undefined, firstParent ? n.ids?.hint : undefined].filter((x) => x !== undefined).join(' ')}
            data-testid="lead-more"
            onClick={() => setMore((v) => !v)}
          >
            {DASH_TEXT.leadMore}{' '}
            <span className="lead-card__mark" aria-hidden="true">
              {DASH_TEXT.foldMark}
            </span>
          </GuardedButton>
        ) : compact ? null : (
          <span className="decision__when" data-testid={n.when}>
            <FitPair a={`${year}${DASH_TEXT.yearSuffix}`} b={ageText(age)} hideSeparator />
          </span>
        )}
      </div>
      <div className="decision__body">
        {veiled ? (
          <>
            {/* 가린 카드: 제목 자리에 분류 문구, 도장만 있는 고른 길 상자, 안내 한 줄, 「펼쳐서 읽기」 하나. 상황·고른 길 라벨·영향 줄·인용은 DOM에도 없다 */}
            <h2 id={n.titleId} ref={titleRef} tabIndex={-1} className="decision__title" style={{ '--title-chars': titleCharsFor(VEIL_TEXT.cardLead, kindName) } as CSSProperties} data-testid={n.title}>
              <FitPair a={VEIL_TEXT.cardLead} b={kindName} hideSeparator />
            </h2>
            <div className="parent-pick parent-pick--veiled" data-testid={n.pick}>
              <p className="parent-pick__stamp" data-testid={n.stamp}>
                {stamp}
              </p>
            </div>
            <p className="veil__note" data-testid={n.veilNote}>
              {VEIL_TEXT.parentNote}
            </p>
            <div className="veil__actions veil__actions--one">
              <button type="button" className="btn btn--secondary" data-testid={n.veilOpen} onClick={() => veil.open('card')}>
                {VEIL_TEXT.readCard}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 요약형은 제목 글자 크기를 CSS가 본문 크기(16px)로 고정한다 — 제목 상한 식의 변수는 전체형에만 */}
            <h2
              id={n.titleId}
              ref={titleRef}
              tabIndex={heavy === null ? undefined : -1}
              className="decision__title"
              style={compact ? undefined : ({ '--title-chars': titleCharsFor(ev.title) } as CSSProperties)}
              data-testid={n.title}
            >
              {ev.title}
            </h2>
            <p className="decision__text" data-testid={n.text} id={n.ids?.text} hidden={compact && !more ? true : undefined}>
              {ev.text}
            </p>
            <div className="parent-pick" data-testid={n.pick}>
              <p className="parent-pick__label" data-testid={n.label} id={n.ids?.label}>
                {label}
              </p>
              <p className="parent-pick__stamp" data-testid={n.stamp} id={n.ids?.stamp} hidden={compact && !more ? true : undefined}>
                {stamp}
              </p>
            </div>
            <ImpactLine items={impact} testId={n.impact} />
            {cite !== null ? <CitationBox view={cite} testId={n.cite} id={n.ids?.cite} hidden={compact && !more ? true : undefined} /> : null}
          </>
        )}
        {/* 판의 첫 부모 카드 안내: 요약형이면 펼친 영역 끝(시안 8절) */}
        {firstParent ? (
          <p className="parent-hint" data-testid={n.hint} id={n.ids?.hint} hidden={compact && !veiled && !more ? true : undefined}>
            {wording.hint}
          </p>
        ) : null}
      </div>
    </section>
  );
}
