import { useEffect, useMemo, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { calendarYear, citationFor, heavyKindOfEvent, previewPending, type CitationView, type ChoiceDef, type EventDef, type EventPool, type HeavyKind, type PendingChoice } from '../../core';
import type { ImpactItem } from '../../core/impact';
import { DASH_TEXT, titleCharsFor } from '../../data/dashText';
import { insightFor } from '../../data/citationInsights';
import { HEAVY_KIND_TEXT, VEIL_TEXT } from '../../data/gentleText';
import { FitPair } from '../FitPair';
import { revealTopOfTallCard } from '../focusReveal';
import { Glue } from '../Glue';
import { GuardedButton } from '../GuardedButton';
import { useScrollLock } from '../useScrollLock';
import type { LifeGame } from './Cards';
import { CitationBox } from './CitationBox';
import { ImpactHint, ImpactLine } from './Impact';

/**
 * 중대 결정 카드 (SPEC-003 MD1, M7b — 문구·DOM·전환은 docs/design/copy.md 6절, CSS는 styles/dash.css 「중대 결정 카드」, 시안 mockups/decision-{adult,infant}.html).
 *
 * 한 카드가 **두 틀**로 뜬다(마스터 결정 M-6 — 기준은 자동 모드 하나, 배속은 기준이 아니다):
 *  - 자동 모드 꺼짐 = **모달 시트**(`DecisionSheet`): `.overlay > .sheet[role=dialog aria-modal]`. 떠 있는 동안 바깥은 `inert`(LifeScreen이 건다), Esc = 잠시 덮어 두기, 포커스는 제목으로.
 *  - 자동 모드 켜짐 = **비모달 인라인 카드**(`DecisionInline`): 대시보드 가운데 열 맨 위(1열은 헤더·진행 줄 바로 아래). 스크림·inert·포커스 이동 없음 — 자동 모드 끄기(컨트롤)에 그대로 닿는다.
 * 안쪽(머리 → 몸)은 `DecisionCard` 하나다. 접으면 카드 자리에 **접힌 띠**(`DecisionFold`)가 생기고, 접힘 상태는 `App`이 갖는다(U10 — M7c가 읽는다).
 *
 * **SPEC-005 r4 (v0.2.1, copy.md 15절)**: ① 질문 줄 「어떻게 하겠습니까?」(UX10) — 선택지 묶음의 첫 자식이고 묶음의 이름이다(`aria-labelledby`). ② 머리의 버튼 이름 「잠시 덮어 두기」(UX11, 이전 이름을 새로 지어 바꿨다 — copy.md 15-2).
 * ③ 카드 맨 끝의 **자동 고르기 묶음**(UX12): 시트(자동 모드 꺼짐)에는 「이후 결정을 자동으로 고르게 하기」, 인라인 카드(켜짐)에는 「이후 결정을 직접 고르기」 — 둘 다 기존 자동 모드(`settings.autoMode`)와 같은 설정을 바꾸는 또 하나의 길이다.
 * 마스터 결정 M-6은 이 버튼 하나에 한해 개정됐다(누르면 같은 카드가 시트 ↔ 인라인으로 바뀐다 — 전환의 포커스·가드·타이머·낭독은 `App`·`useFocus`). 가린 카드에는 이 묶음이 없다(M22). ④ 인용 박스 안 풀이 줄(UX14) — 본인이 고르는 이 카드만 넘긴다(M23).
 *
 * **무거운 장면 가리기**(SPEC-005 QI6 HV4 ②): 설정이 켜져 있고 이 카드의 이벤트에 `heavy` 표지가 있으면(`DecisionModel.heavy`) 호출한 쪽(LifeScreen)이 `veiled`를 켜서 보낸다 — 제목 자리에 「무거운 주제 · {분류}」, 상황·인용·선택지·영향 줄은 **그리지 않고**,
 * 안내 한 줄과 버튼 둘(「펼쳐서 읽기」 / 「이번에는 자동으로 고르기」)만 보인다. 머리(「◆ 중대 결정」·「{연도}년 · {나이}세」·「잠시 덮어 두기」)와 자동 모드 안내는 틀이라 그대로다. 사건·효과·확률·난수는 그대로이고 자동 모드의 선택 타이머도 그대로 돈다.
 * 펼침은 App의 메모리 상태다(접기 → 다시 열기에서 유지, 새로고침·설정 변경이면 다시 가림 — M19).
 *
 * 선택지 버튼·영향 줄·입력 가드는 M4·M5 그대로다. 가드 키 = `${pending.key}#${epoch}`: 새 카드가 뜰 때뿐 아니라 접기·다시 열기마다 `epoch`가 올라 다시 400ms 가드가 걸린다(U9) —
 * 「잠시 덮어 두기」 더블탭의 둘째 입력이 그 자리에 생긴 「결정 다시 열기」에, 「결정 다시 열기」 더블탭의 둘째 입력이 새로 뜬 카드의 「잠시 덮어 두기」·선택지에 떨어지지 않게.
 */

/** 카드 한 장을 그리는 데 필요한 값 (계산은 core 순수 함수 — previewPending·citationFor) */
export interface DecisionModel {
  pending: PendingChoice;
  ev: EventDef;
  choices: ChoiceDef[];
  /** 선택지 하나의 영향 줄 항목 (core/impact.ts — 인생 진행이 선택을 적용하는 코드와 같은 코드로 미리 계산한다, 숨은 효과 0) */
  impactOf: (choiceId: string) => ImpactItem[];
  anyImpact: boolean;
  /** 이 카드가 이 세상·이 해에 보일 인용 (없으면 null → 인용 박스 요소가 없다) */
  cite: CitationView | null;
  /** 머리의 「{연도}년 · {나이}세」 — 연도는 대시보드 머리가 이미 보이는 값이다(M-12) */
  year: number;
  age: number;
  name: string;
  /** 무거운 장면 분류 (이벤트의 `heavy` 표지, 없으면 null) — 가릴지는 설정값이 정한다(화면 규칙 (A)) */
  heavy: HeavyKind | null;
}

/** 대기 중인 선택지가 있으면 카드 모델을, 없으면 null. 영향·인용은 대기 중인 선택지와 상태가 같은 동안 다시 계산하지 않는다 */
export function useDecisionModel(game: LifeGame, pool: EventPool): DecisionModel | null {
  const pending = game.pending;
  const ev = pending ? pool.byId.get(pending.eventId) : undefined;
  const previews = useMemo(() => (pending && ev ? previewPending(game, pool) : null), [game, pool, pending, ev]);
  const year = calendarYear(game.character.birthYear, game.age);
  const cite = useMemo(() => (ev ? citationFor(ev, game.era, year) : null), [ev, game.era, year]);
  return useMemo(() => {
    if (!pending || !ev) return null;
    const choices = pending.choiceIds.map((id) => ev.choices?.find((c) => c.id === id)).filter((c): c is ChoiceDef => c !== undefined);
    const impactOf = (id: string): ImpactItem[] => previews?.find((p) => p.choiceId === id)?.impact.items ?? [];
    return { pending, ev, choices, impactOf, anyImpact: choices.some((c) => impactOf(c.id).length > 0), cite, year, age: game.age, name: game.character.name, heavy: heavyKindOfEvent(ev) };
  }, [pending, ev, previews, cite, year, game.age, game.character.name]);
}

/** 가드 키: 카드 인스턴스 + 접기·다시 열기 횟수 */
export function decisionGuardKey(pending: PendingChoice, epoch: number): string {
  return `${pending.key}#${epoch}`;
}

interface CardProps {
  model: DecisionModel;
  /** 자동 모드 켜짐 = 인라인 틀. 안내 문장 하나(켜짐/꺼짐)를 고르고, 인라인에서만 큰 선택지 카드의 위쪽 변 맞춤을 건다 */
  auto: boolean;
  epoch: number;
  titleRef: RefObject<HTMLHeadingElement>;
  onFold: () => void;
  onChoose: (key: string, choiceId: string) => void;
  /** 카드 맨 끝의 자동 고르기 버튼 (UX12): `true` = 「이후 결정을 자동으로 고르게 하기」(시트), `false` = 「이후 결정을 직접 고르기」(인라인). 기존 자동 모드 설정을 바꾸고 전환의 가드·낭독은 호출한 쪽(App)이 한다 */
  onAutoSwitch?: (auto: boolean) => void;
  /** 가린 카드인가 (설정이 켜져 있고 무거운 장면이고 아직 펼치지 않았다) — 제목·상황·인용·선택지·영향 줄 대신 안내와 버튼 둘이 보인다 */
  veiled?: boolean;
  /** 「펼쳐서 읽기」 */
  onOpenVeil?: () => void;
  /** 「이번에는 자동으로 고르기」 — 지금의 자동 선택 성향으로 이 카드를 한 번 고른다 */
  onAutoPick?: (key: string) => void;
}

/**
 * 카드 안쪽 (두 틀 공통): 머리 → 제목 → 상황 → 인용(있을 때만, 풀이 줄 포함) → 질문 → 선택지 → 영향 안내(영향 줄이 있는 묶음에만) → 자동 고르기 묶음(자동 모드 안내 한 문장 + 버튼 + 보조 한 줄).
 * 질문은 선택지 묶음 `.choices-list`의 첫 자식이다(묶음 이름 = 질문). 가린 카드는 안내 한 줄·버튼 둘·자동 모드 안내만이다(질문·풀이·자동 고르기 버튼 없음).
 */
export function DecisionCard({ model, auto, epoch, titleRef, onFold, onChoose, onAutoSwitch, veiled = false, onOpenVeil, onAutoPick }: CardProps) {
  const { pending, ev, choices, impactOf, anyImpact, cite, year, age, name } = model;
  const guardKey = decisionGuardKey(pending, epoch);
  const kind = veiled ? model.heavy : null;
  const kindName = kind === null ? '' : HEAVY_KIND_TEXT[kind];
  return (
    <>
      <div className="decision__head">
        <span className="decision__kind">{DASH_TEXT.choiceKind}</span>
        <div className="row">
          <span className="decision__when" data-testid="decision-when">
            <FitPair a={`${year}${DASH_TEXT.yearSuffix}`} b={`${age}${DASH_TEXT.ageSuffix}`} hideSeparator />
          </span>
          <GuardedButton guardKey={guardKey} className="btn btn--ghost btn--sm decision__fold" data-testid="decision-fold-btn" onClick={onFold}>
            {DASH_TEXT.foldCard} <span aria-hidden="true">{DASH_TEXT.foldMark}</span>
          </GuardedButton>
        </div>
      </div>
      <div className="decision__body">
        {/* 포커스 이동은 LifeScreen의 useLifeFocus가 한 곳에서 정한다(포커스 표 48칸, R-036). 제목 글자 크기 상한(완료 기준 17②)의 칸 수는 제목의 가장 긴 낱말 + 1 */}
        {kind !== null ? (
          <>
            {/* 가린 카드: 제목 자리에 분류 문구(대화상자 이름·포커스 대상 그대로 — 글자만 바뀐다), 안내 한 줄, 버튼 둘. 상황·인용·선택지·영향 줄은 DOM에도 없다(그릴 것이 없다) */}
            <h2 id="dc-title" className="decision__title" ref={titleRef} tabIndex={-1} style={{ '--title-chars': titleCharsFor(VEIL_TEXT.cardLead, kindName) } as CSSProperties} data-testid="choice-title">
              <FitPair a={VEIL_TEXT.cardLead} b={kindName} hideSeparator />
            </h2>
            <p className="decision__text veil__note" data-testid="veil-note">
              {VEIL_TEXT.decisionNote}
            </p>
            <div className="veil__actions">
              <GuardedButton guardKey={guardKey} className="btn btn--primary" data-testid="veil-open" onClick={onOpenVeil}>
                {VEIL_TEXT.readCard}
              </GuardedButton>
              <GuardedButton guardKey={guardKey} className="btn btn--secondary" data-testid="veil-auto" onClick={() => onAutoPick?.(pending.key)}>
                {VEIL_TEXT.autoPick}
              </GuardedButton>
            </div>
          </>
        ) : (
          <>
            <h2 id="dc-title" className="decision__title" ref={titleRef} tabIndex={-1} style={{ '--title-chars': titleCharsFor(ev.title) } as CSSProperties} data-testid="choice-title">
              {ev.title}
            </h2>
            <p className="decision__text" data-testid="choice-text">
              {ev.text}
            </p>
            {cite !== null ? <CitationBox view={cite} insight={insightFor(cite.id)} /> : null}
            <div className="choices-list" role="group" aria-labelledby="dc-ask">
              {/* 공통 질문 (UX10): 묶음의 첫 자식 = 묶음의 이름. 묶음 안이라 선택지와 12px(본문 블록 사이 16px보다 가깝다) */}
              <p className="decision__ask" id="dc-ask" data-testid="choice-ask">
                {DASH_TEXT.choiceAsk}
              </p>
              {choices.map((c, i) => (
                // 인라인 틀에서 글자 200%·좁은 폭이라 선택지 카드가 가용 높이(화면 − 하단 띠)보다 커지면 키보드 포커스 때 카드의 위쪽 변을 화면에 맞춘다(CM10 예외 ②, ui/focusReveal.ts#revealTopOfTallCard).
                // 시트는 자기 스크롤 영역이라(scroll-padding) 브라우저의 기본 포커스 스크롤에 맡긴다 — 문서 스크롤을 건드리지 않는다.
                <GuardedButton key={c.id} className="choice" guardKey={guardKey} data-testid={`choice-${c.id}`} onFocus={auto ? (e) => revealTopOfTallCard(e.currentTarget) : undefined} onClick={() => onChoose(pending.key, c.id)}>
                  <span className="choice__no" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="choice__body">
                    <span className="choice__label">{c.label}</span>
                    <ImpactLine items={impactOf(c.id)} />
                  </span>
                </GuardedButton>
              ))}
            </div>
            {anyImpact ? <ImpactHint name={name} /> : null}
          </>
        )}
        {/* 자동 모드 안내: 정적 문장이다(role=status 아님 — 자동 선택 때마다 낭독되지 않게, content-M7b 4-3) */}
        {kind !== null ? (
          <p className="decision__auto" data-testid="auto-note">
            {auto ? DASH_TEXT.autoNoteOn : DASH_TEXT.autoNoteOff}
          </p>
        ) : (
          // 자동 고르기 묶음 (UX12, M-6 개정): 안내 문장이 상태를 말하고 그 아래 버튼이 그것을 바꾼다. 선택지(2px 상자·굵은 라벨)보다 낮은 위계의 보조 버튼 — 가린 카드의 「펼쳐 보기」 급.
          // 가드 키는 선택지와 같아(`decisionGuardKey`) 카드가 새로 뜨거나 전환(시트 ↔ 인라인은 다른 부모라 새로 마운트)될 때마다 400ms 닫힌다 — 더블탭의 둘째 입력이 전환된 카드의 버튼·선택지에 떨어지지 않는다(U9).
          <div className="decision__autoset" data-testid="auto-set">
            <p className="decision__auto" data-testid="auto-note">
              {auto ? DASH_TEXT.autoNoteOn : DASH_TEXT.autoNoteOff}
            </p>
            <GuardedButton
              guardKey={guardKey}
              className="btn btn--ghost btn--sm decision__autobtn"
              aria-describedby="dc-autosub"
              data-testid={auto ? 'auto-off-btn' : 'auto-on-btn'}
              onClick={() => onAutoSwitch?.(!auto)}
            >
              {auto ? DASH_TEXT.autoOffBtn : DASH_TEXT.autoOnBtn}
            </GuardedButton>
            <p className="decision__autosub" id="dc-autosub" data-testid="auto-sub">
              <Glue text={auto ? DASH_TEXT.autoOffSub : DASH_TEXT.autoOnSub} />
            </p>
          </div>
        )}
      </div>
    </>
  );
}

/** 모달 시트 (자동 모드 꺼짐). 바깥을 `inert`로 두는 일은 이 시트를 렌더하는 LifeScreen이 한다 — React 트리에서 시트가 그 형제들 바깥에 있어야 한다 */
export function DecisionSheet({ model, onFold, children, veiled = false }: { model: DecisionModel; onFold: () => void; children: ReactNode; /** 가린 카드(무거운 장면 가리기) — 표지만 단다 */ veiled?: boolean }) {
  // 시트가 떠 있는 동안 문서 스크롤을 잠근다(M7c T1 — 기록 시트와 열린 시트 수를 같이 센다, ui/useScrollLock.ts)
  useScrollLock();
  // Esc = 잠시 덮어 두기 (U7). 스크림 탭은 접기와 같게 처리하지 않는다 — 다시 열기 더블탭의 둘째 입력이 새 시트의 스크림에 떨어져 곧바로 접히는 일을 막는다(D-56은 선택)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      onFold();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onFold]);
  return (
    <div className="overlay" data-testid="decision-overlay">
      <div className="sheet decision decision--sheet" role="dialog" aria-modal="true" aria-labelledby="dc-title" data-testid="choice-panel" data-mode="sheet" data-key={model.pending.key} data-veiled={veiled ? 'true' : undefined}>
        {children}
      </div>
    </div>
  );
}

/** 비모달 인라인 카드 (자동 모드 켜짐): 대시보드 가운데 열 맨 위(1열은 헤더·진행 줄 바로 아래). 스크림·inert·포커스 이동 없음 */
export function DecisionInline({ model, children, veiled = false }: { model: DecisionModel; children: ReactNode; veiled?: boolean }) {
  return (
    <section className="card decision decision--inline" aria-labelledby="dc-title" data-testid="choice-panel" data-mode="inline" data-key={model.pending.key} data-veiled={veiled ? 'true' : undefined}>
      {children}
    </section>
  );
}

/** 접힌 띠: 카드가 있던 자리의 한 줄. 버튼의 접근 가능한 이름은 「결정 다시 열기 {제목}」(눈에 보이는 글자가 이름의 앞머리 — WCAG 2.5.3) */
export function DecisionFold({ model, epoch, openRef, onReopen, veiled = false }: { model: DecisionModel; epoch: number; openRef: RefObject<HTMLButtonElement>; onReopen: () => void; /** 가린 카드를 접은 띠인가 — 제목 자리에 분류 문구(「무거운 주제 · {분류}」, 버튼 이름도 이를 따른다) */ veiled?: boolean }) {
  return (
    <section className="card fold" aria-labelledby="dc-fold-title" data-testid="decision-fold" data-key={model.pending.key} data-veiled={veiled && model.heavy !== null ? 'true' : undefined}>
      <span className="fold__kind">{DASH_TEXT.choiceKind}</span>
      <span className="fold__title" id="dc-fold-title" data-testid="decision-fold-title">
        {veiled && model.heavy !== null ? <FitPair a={VEIL_TEXT.cardLead} b={HEAVY_KIND_TEXT[model.heavy]} hideSeparator /> : model.ev.title}
      </span>
      <span className="fold__note">{DASH_TEXT.foldNote}</span>
      <GuardedButton
        ref={openRef}
        guardKey={decisionGuardKey(model.pending, epoch)}
        className="btn btn--secondary btn--sm fold__open"
        id="dc-fold-open"
        aria-labelledby="dc-fold-open dc-fold-title"
        data-testid="decision-reopen"
        onClick={onReopen}
      >
        {DASH_TEXT.reopenDecision}
      </GuardedButton>
    </section>
  );
}
