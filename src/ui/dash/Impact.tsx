import type { ImpactItem } from '../../core/impact';
import { Glue } from '../Glue';
import { ASK_UNKNOWN_IMPACT_TEXT } from '../../data/askTable';
import { IMPACT_HINT, IMPACT_LABEL, impactSentence, impactSymbols, impactTone } from '../../data/impactText';

/**
 * 선택지 영향 줄 (SPEC-003 M5 EC5, 문구·DOM은 docs/design/copy.md 4절, CSS는 design-system.md 11-9절 · styles/dash.css 「영향 표기」).
 * 항목(이름 + 기호)은 한 덩어리이고 줄은 항목 단위로만 접힌다. 「·」는 글자로 넣지 않고 CSS(`.impact__item::before`)가 그린다 — 줄 가장자리에 남지 않는다.
 * 눈에 보이는 「자산 ▼▼▼」은 aria-hidden이고, 스크린리더는 항목마다 합쇼체 문장(`.sr-only`)을 듣는다. 기호의 색은 이로움·해로움(`impactTone`, 부채만 반대)이고 보조 표시다.
 * 변화가 없으면(항목 0개) 요소를 그리지 않는다.
 */
export function ImpactLine({ items }: { items: readonly ImpactItem[] }) {
  if (items.length === 0) return null;
  return (
    <span className="impact" data-testid="impact">
      {items.map((it) => (
        <span className="impact__item" key={it.key} data-key={it.key} data-direction={it.direction} data-steps={it.steps}>
          <span className="impact__show" aria-hidden="true">
            <span className="impact__name">{IMPACT_LABEL[it.key]}</span>
            <span className={`impact__step impact__step--${impactTone(it)}`}>{impactSymbols(it)}</span>
          </span>
          <span className="sr-only">{impactSentence(it)}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * 조른다·떼를 쓴다 선택지의 영향 줄 자리의 **고정 한 줄** (SPEC-011 AK8, `docs/design/copy.md` 20-2): 「들어주실지는 알 수 없습니다」. 들어줄지는 해시와 확률이 정해 화면에 방향·숫자가 없다(G4).
 * 새 줄 종류가 아니다 — 영향 줄(`.impact`) 자리에 같은 글자 크기·색으로 앉고, 항목 점(「·」)과 줄바꿈 금지만 뺐다(글자 200%·360px에서 한 줄이 넘치면 어절에서 접힌다). 눈에 보이는 글자가 그대로 스크린리더 이름이다.
 */
export function ImpactFixedLine({ text = ASK_UNKNOWN_IMPACT_TEXT }: { text?: string }) {
  return (
    <span className="impact impact--fixed" data-testid="impact-fixed">
      <span className="impact__item impact__item--fixed">
        <Glue text={text} />
      </span>
    </span>
  );
}

/** 선택지 묶음 아래 안내 한 줄: 첫 문장은 그대로 읽히고, 둘째 문장(기호 설명)은 눈에 보이는 글자가 aria-hidden이며 스크린리더에는 대체 글자가 읽힌다 (copy.md 4-4) */
export function ImpactHint({ name }: { name: string }) {
  return (
    <p className="decision__hint" data-testid="choice-hint">
      <Glue text={IMPACT_HINT.lead(name)} /> <span aria-hidden="true">{IMPACT_HINT.symbols}</span>
      <span className="sr-only">{IMPACT_HINT.symbolsSr}</span>
    </p>
  );
}
