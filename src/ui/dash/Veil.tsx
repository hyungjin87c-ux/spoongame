import { useCallback, useState, type ReactNode } from 'react';
import type { DelegatedBy, HeavyKind } from '../../core/types';
import { HEAVY_KIND_TEXT, VEIL_TEXT, veilButtonLabel } from '../../data/gentleText';
import { decidedByText, deciderIconOf } from '../../data/parentDecisionTable';
import { Icon } from '../Brand';
import { FitPair } from '../FitPair';

/**
 * 무거운 장면 가리기의 공용 부품 (SPEC-005 QI6 HV4, docs/design/design-system.md 14-2·copy.md 12-2, diff-005 D5-41).
 *
 * **가림은 지금의 설정값(`gentle`)으로 화면이 정한다**(화면 규칙 (A)): 이 부품들은 「가려야 하는가」를 스스로 정하지 않고 호출한 쪽이 넘긴 `gentle`·분류를 따른다. 줄마다 가렸는지는 어디에도 저장하지 않는다.
 * 펼침 상태는 React 상태일 뿐이고 **저장하지 않으며, 설정이 바뀌면 모두 초기화된다**(M19 — `useVeilOpen`은 설정값별로 따로 기억해, 끄면 원문이 되고 다시 켜면 그 전에 열어 둔 줄도 다시 가려진다).
 * 가린 자리는 늘 **글자(안내 + 분류 이름) + 버튼**으로 말한다 — 색·점선·회색 상자로 「가림」을 표현하지 않는다. 원문은 `hidden`으로 DOM에만 두어 화면·접근성 트리·찾기에서 빠진다
 * (live region의 `aria-relevant="additions"`에 원문이 추가로 읽히지 않는다 — 펼치기·접기는 `hidden` 토글이라 「추가」가 아니다).
 */

export interface VeilOpen {
  /** 이 키의 줄·카드가 펼쳐져 있는가 */
  isOpen: (id: string) => boolean;
  /** 펼침 ↔ 접기 */
  toggle: (id: string) => void;
  /** 펼치기 (이미 펼쳐 있으면 그대로) */
  open: (id: string) => void;
}

/**
 * 펼친 줄·카드의 id 집합. 설정값(`gentle`)이 바뀌면 같은 렌더에서 모두 비워진다 — 상태를 설정값과 함께 들고 있다가 값이 다르면 비어 있는 것으로 읽는다(효과로 지우면 한 프레임 열린 채 그려진다).
 * 저장하지 않는다(새로고침하면 다시 가려진다, SV3).
 */
export function useVeilOpen(gentle: boolean): VeilOpen {
  const [state, setState] = useState<{ gentle: boolean; ids: ReadonlySet<string> }>({ gentle, ids: new Set() });
  const ids = state.gentle === gentle ? state.ids : EMPTY;
  const isOpen = useCallback((id: string) => ids.has(id), [ids]);
  const toggle = useCallback(
    (id: string) =>
      setState((prev) => {
        const base = prev.gentle === gentle ? prev.ids : EMPTY;
        const next = new Set(base);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { gentle, ids: next };
      }),
    [gentle],
  );
  const open = useCallback(
    (id: string) =>
      setState((prev) => {
        const base = prev.gentle === gentle ? prev.ids : EMPTY;
        return base.has(id) && prev.gentle === gentle ? prev : { gentle, ids: new Set(base).add(id) };
      }),
    [gentle],
  );
  return { isOpen, toggle, open };
}

const EMPTY: ReadonlySet<string> = new Set();

/** 안내 「무거운 일이 있었습니다 · {분류}」 (copy.md 12-2) — 좁거나 글자가 크면 기호 없이 두 줄(`FitPair`), 가운뎃점은 낭독에서 숨긴다 */
export function VeilLead({ kind }: { kind: HeavyKind }) {
  return (
    <span className="veil__lead" data-testid="veil-lead">
      <FitPair a={VEIL_TEXT.rowLead} b={HEAVY_KIND_TEXT[kind]} hideSeparator />
    </span>
  );
}

/**
 * 「펼쳐 보기 ▾」 ↔ 「접기 ▴」 (copy.md 12-2): `aria-expanded`·`aria-controls`, 접근 가능한 이름 「펼쳐 보기 {나이}세 {분류}」(보이는 글자가 이름의 앞머리 — WCAG 2.5.3). 기호는 aria-hidden(상태는 aria-expanded가 전한다).
 */
export function VeilButton({ open, age, kind, controls, onToggle }: { open: boolean; age: number; kind: HeavyKind; controls: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm veil__btn"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={veilButtonLabel(open, age, HEAVY_KIND_TEXT[kind])}
      data-testid="veil-btn"
      onClick={onToggle}
    >
      {open ? VEIL_TEXT.close : VEIL_TEXT.open} <span className="veil__mark" aria-hidden="true">{open ? VEIL_TEXT.markClose : VEIL_TEXT.markOpen}</span>
    </button>
  );
}

/** 가린 줄 위에 보이는 결정자 도장 「(부모님이 이렇게 정했습니다)」 — 칩·도장 낱말·아이콘은 가리지 않는다(HV8). 라벨은 없다. 펼치면 원문 쪽 도장(라벨 포함)이 대신하므로 `hidden`이다 */
export function VeilStamp({ by, open }: { by: DelegatedBy; open: boolean }) {
  return (
    <em className={`log__by log__by--${by}`} data-testid="veil-by" data-by={by} hidden={open}>
      <Icon name={deciderIconOf(by)} className="icon--xs" />({decidedByText(by)})
    </em>
  );
}

/** 연표 줄의 결정자 도장 (엔딩 `.tl-picked`와 같은 꼴, 라벨 없이) */
export function VeilTimelineStamp({ by, open }: { by: DelegatedBy; open: boolean }) {
  return (
    <span className="tl-picked" data-testid="veil-by" data-by={by} hidden={open}>
      <Icon name={deciderIconOf(by)} className="icon--xs" />
      {decidedByText(by)}
    </span>
  );
}

/**
 * 가린 줄 하나: 안내 줄(분류 + [도장] + 버튼) 아래에 원문(`hidden` ↔ 펼침). 인생 기록 줄과 엔딩 연표 줄이 함께 쓴다 — 바깥 요소(`span.log__text` / 연표의 둘째 `span`)와 `data-veiled`는 호출한 쪽이 건다.
 * `bodyId`는 `aria-controls`가 가리키는 원문 요소의 id다(한 문서 안에서 유일해야 한다).
 */
export function VeiledText({ kind, age, bodyId, open, onToggle, stamp, children }: { kind: HeavyKind; age: number; bodyId: string; open: boolean; onToggle: () => void; stamp?: ReactNode; children: ReactNode }) {
  return (
    <>
      <span className="veil__line">
        <VeilLead kind={kind} />
        {stamp}
        <VeilButton open={open} age={age} kind={kind} controls={bodyId} onToggle={onToggle} />
      </span>
      <span className="veil__body" id={bodyId} hidden={!open} data-testid="veil-body">
        {children}
      </span>
    </>
  );
}
