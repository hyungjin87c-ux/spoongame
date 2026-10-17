import { formatMan } from '../../core/format';
import type { Standing } from '../../core/standing';
import type { Era } from '../../core/types';
import { FINAL_NET_TEXT, finalNetStandingText } from '../../data/endingText';
import { KeepStanding } from '../KeepStanding';

/**
 * 엔딩 「최종 순자산」 줄 (SPEC-003 M5, docs/design/copy.md 4-6절 · design-system.md 6절): M4의 「재산」 미터(0~100) 자리의 한 줄이다. 금액은 formatMan(= formatWon) 출력 그대로(「약」 없음, 음수 U+2212, 0은 「0원」),
 * 자리는 「같은 세상 안에서 {standingLabel}」(같은 시대 분포표 안의 위치). 지난·다가올 세상은 금액 바로 아래에 「지금 가치로 환산」 태그. 스무 살 전에 끝난 인생(net 또는 standing이 null)은 자리를 말하지 않고 한 문장만 둔다.
 * 엔딩 화면과 시안 생성기(scripts/design/buildMockups.mjs — 시안 economy-m5.html)가 같은 컴포넌트를 쓴다.
 */
export function FinalNetLine({ era, net, standing }: { era: Era; net: number | null; standing: Standing | null }) {
  if (net === null || standing === null) {
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
        {era === 'present' ? null : (
          <span className="tag" data-testid="final-net-basis">
            {FINAL_NET_TEXT.basis}
          </span>
        )}
        <span className="final-net__standing" data-testid="final-net-standing">
          <KeepStanding text={finalNetStandingText(standing)} />
        </span>
      </dd>
    </dl>
  );
}
