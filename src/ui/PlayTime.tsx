import { formatPlayTime } from '../core/playClock';

/**
 * 플레이 시간 값 하나 (SPEC-003 LM6, M8 — docs/design/copy.md 8-2·8-3): 엔딩 블록의 세 자리(표시값 · 분해 둘)가 같은 부품을 쓴다.
 * 눈에 보이는 mm:ss는 aria-hidden(「29:12」는 시각으로 읽힐 수 있다), 낭독은 sr-only 「{m}분 {s}초」, datetime은 ISO 8601 기간(PT29M12S). CSS `.playtime time`이 nowrap + tabular로 숫자가 줄 가운데서 갈리지 않게 한다.
 * 이 부품 바로 뒤에는 조사를 두지 않는다(design-system.md 11-4) — 문장 조각은 `data/endingText.ts#breakdownParts`가 쉼표·「의」로만 잇는다.
 */
export function PlayTime({ seconds, className, testId }: { seconds: number; className?: string; testId?: string }) {
  const t = formatPlayTime(seconds);
  return (
    <time className={className} dateTime={t.iso} data-testid={testId}>
      <span className="sr-only">{t.spoken}</span>
      <span aria-hidden="true">{t.text}</span>
    </time>
  );
}
