import { useMemo, type CSSProperties } from 'react';
import { calendarYear, citationFor, type CitationView, type EventDef, type EventPool, type TickInfo } from '../../core';
import type { ImpactItem } from '../../core/impact';
import { DASH_TEXT, titleCharsFor } from '../../data/dashText';
import { CHILD_CHIP_TEXT, CHILD_FLOW_TEXT, FIRST_PARENT_HINT, PARENT_CHIP_TEXT, PARENT_DECIDED_TEXT, deciderIconOf } from '../../data/parentDecisionTable';
import { FitPair } from '../FitPair';
import { Icon } from '../Brand';
import type { LifeGame } from './Cards';
import { CitationBox } from './CitationBox';
import { ImpactLine } from './Impact';

/**
 * 부모님이 정한 카드 · 아이의 일로 흘러간 카드 (SPEC-005 PD5·PD8, 설계 문서 docs/data/parent-decision-model.md 3-2절, LR5 b).
 *
 * **모달 시트가 아니다.** 어린 시절의 큰 결정이 부모님이 정한 일(`by: 'parent'`)이거나 아이의 반응·행동이라 흘러간 일(`by: 'child'`)이면, 그 해의 결과 연출 대기 동안만 가운데 열 맨 위(인생 기록 바로 위)에
 * 이 비모달 카드가 보이고 해가 넘어가면 사라진다. 사용자의 동작이 필요 없고 **포커스를 가져가지 않는다**(포커스 표 `decideLifeFocus`의 `delegatedCard` 순간 = 이동 없음).
 * 구성(위에서부터): 칩(색 + 글자 + 아이콘) → 제목 → 상황 문장 → **고른 길 한 개(강조) + 도장 문구**(`PARENT_DECIDED_TEXT`·`CHILD_FLOW_TEXT` 한 곳) → 영향 줄(고른 길 하나, 표기 = 실제 효과) → 인용 박스(있으면 지금 카드와 같은 부품) →
 * (판의 첫 부모 카드에만) 안내 한 줄. 선택지 버튼·「카드 접기」·자동 선택 안내·집안 사정 한 줄(「이 집에서는 고를 수 없었던 길」 류)은 없다(마스터 결정 M6).
 * 스크린리더: 카드는 정적 영역이고 낭독은 인생 기록 줄의 `aria-live`가 맡는다(같은 내용을 두 번 읽지 않게) — 그래서 이 카드에는 `aria-live`·`role="status"`가 없다.
 * 카드는 틱(`TickInfo`)에서 **파생**된다: 새로고침하면 틱이 없어 다시 뜨지 않고 기록 줄만 남는다(PD7-5). 일시정지하면 틱이 그대로라 카드도 그 자리에 머문다.
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
    cite: citationFor(ev, game.era, year),
    year,
    age: tick.fromAge,
    firstParent: tick.firstParent === true,
  };
}

export function useParentCardModel(game: LifeGame, tick: TickInfo | null, pool: EventPool): ParentCardModel | null {
  return useMemo(() => parentCardModel(game, tick, pool), [game, tick, pool]);
}

export function ParentCard({ model }: { model: ParentCardModel }) {
  const { by, ev, label, impact, cite, year, age, firstParent } = model;
  const chip = by === 'parent' ? PARENT_CHIP_TEXT : CHILD_CHIP_TEXT;
  const stamp = by === 'parent' ? PARENT_DECIDED_TEXT : CHILD_FLOW_TEXT;
  return (
    <section className={`card decision decision--parent${by === 'child' ? ' decision--child' : ''}`} aria-labelledby="pc-title" data-testid="parent-card" data-by={by} data-key={`${ev.id}@${age}`}>
      <div className="decision__head">
        <span className={`parent-chip parent-chip--${by}`} data-testid="parent-chip">
          <Icon name={deciderIconOf(by)} />
          <span>{chip}</span>
        </span>
        <span className="decision__when" data-testid="parent-when">
          <FitPair a={`${year}${DASH_TEXT.yearSuffix}`} b={`${age}${DASH_TEXT.ageSuffix}`} hideSeparator />
        </span>
      </div>
      <div className="decision__body">
        <h2 id="pc-title" className="decision__title" style={{ '--title-chars': titleCharsFor(ev.title) } as CSSProperties} data-testid="parent-title">
          {ev.title}
        </h2>
        <p className="decision__text" data-testid="parent-text">
          {ev.text}
        </p>
        <div className="parent-pick" data-testid="parent-pick">
          <p className="parent-pick__label" data-testid="parent-label">
            {label}
          </p>
          <p className="parent-pick__stamp" data-testid="parent-stamp">
            {stamp}
          </p>
        </div>
        <ImpactLine items={impact} />
        {cite !== null ? <CitationBox view={cite} /> : null}
        {firstParent ? (
          <p className="parent-hint" data-testid="parent-hint">
            {FIRST_PARENT_HINT}
          </p>
        ) : null}
      </div>
    </section>
  );
}
