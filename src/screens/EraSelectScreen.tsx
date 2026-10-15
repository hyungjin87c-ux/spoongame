import { DEFAULT_ERA, ERAS, type Era } from '../core';
import { ERA_CONFIG } from '../data/birthTable';
import { GuardedButton } from '../ui/GuardedButton';
import { useFocusOnChange } from '../ui/useFocus';

/** 화면 전환 직후 입력 가드의 키(타이틀의 "시작" 더블클릭이 시대 카드·확정 버튼에 떨어지지 않게). */
const GUARD_KEY = 'era';

interface Props {
  selected: Era | null;
  onSelect: (era: Era) => void;
  onConfirm: () => void;
}

export function EraSelectScreen({ selected, onSelect, onConfirm }: Props) {
  const current = selected ?? DEFAULT_ERA;
  const headingRef = useFocusOnChange<HTMLHeadingElement>();
  return (
    <main className="screen" data-testid="era-screen">
      <h1 ref={headingRef} tabIndex={-1}>
        어느 세상에서 태어날까
      </h1>
      <p className="sub">한 번 고르면 되돌릴 수 없다.</p>
      <div className="era-list" role="group" aria-label="시대 선택">
        {ERAS.map((era) => {
          const cfg = ERA_CONFIG[era];
          const on = era === current;
          return (
            <GuardedButton
              key={era}
              guardKey={GUARD_KEY}
              className={`era-card${on ? ' on' : ''}`}
              aria-pressed={on}
              data-era={era}
              onClick={() => onSelect(era)}
            >
              <strong>{cfg.label}</strong>
              <span>{cfg.blurb}</span>
              <span className="muted">
                {cfg.birthYears.min}~{cfg.birthYears.max}년생
              </span>
            </GuardedButton>
          );
        })}
      </div>
      <GuardedButton guardKey={GUARD_KEY} onClick={onConfirm} data-testid="confirm-era">
        이 세상에서 태어나기
      </GuardedButton>
    </main>
  );
}
