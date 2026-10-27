import { formatMan } from '../../core/format';
import type { ProfileId } from '../../core/types';
import { amountsConverted } from '../../data/dashText';
import { FINAL_NET_TEXT } from '../../data/endingText';

/**
 * 엔딩 「최종 순자산」 줄 (SPEC-003 M5, docs/design/copy.md 4-6절 · design-system.md 6절): M4의 「재산」 미터(0~100) 자리의 한 줄이다. 금액은 formatMan(= formatWon) 출력 그대로(「약」 없음, 음수 U+2212, 0은 「0원」).
 * 세대 판은 금액 바로 아래에 「지금 가치로 환산」 태그(당시 화폐 전환은 GM10). 스무 살 전에 끝난 인생(net이 null)은 금액 없이 한 문장만 둔다.
 * M7e-3(copy.md 5-2 ① 1, QA-003-M5 O04): 금액 옆의 자리 글자(「같은 세상 안에서 {standingLabel}」)는 없앴다 — 「0원 = 하위 42%」처럼 절대값과 상대 자리가 한 줄에서 부딪쳤다. 자리는 출발선 카드(막대 + 범례 + 문장) 한 곳에서만 말한다.
 * 엔딩 화면과 시안 생성기(scripts/design/buildMockups.mjs — 시안 economy-m5.html)가 같은 컴포넌트를 쓴다.
 */
export function FinalNetLine({ generation, net }: { generation: ProfileId; net: number | null }) {
  if (net === null) {
    return (
      <dl className="final-net final-net--early" data-testid="final-net">
        <dt>{FINAL_NET_TEXT.label}</dt>
        <dd className="final-net__none" data-testid="final-net-none">
          {FINAL_NET_TEXT.early}
        </dd>
      </dl>
    );
  }
  return (
    <dl className="final-net" data-testid="final-net">
      <dt>{FINAL_NET_TEXT.label}</dt>
      <dd>
        <span className="final-net__value nowrap" data-testid="final-net-value">
          {formatMan(net)}
        </span>
        {amountsConverted(generation) ? (
          <span className="tag" data-testid="final-net-basis">
            {FINAL_NET_TEXT.basis}
          </span>
        ) : null}
      </dd>
    </dl>
  );
}
