import { looksStanding, wealthStanding, type Character, type Era } from '../core';
import { PARENTING_LABEL, WEALTH_TEXT, looksScoreText, looksText, parentingText, wealthStandingText } from '../data/birthText';
import { ERA_CONFIG } from '../data/birthTable';
import { GuardedButton } from '../ui/GuardedButton';
import { KeepStanding } from '../ui/KeepStanding';
import { useFocusOnChange } from '../ui/useFocus';

interface Props {
  era: Era;
  character: Character;
  onNext: () => void;
}

export function BirthScreen({ era, character: c, onNext }: Props) {
  // 상위/하위/중간 표현의 결정은 core(순수 함수)가 하고, 화면은 그 결과를 문구로 그리기만 한다(R-018).
  const wealthStandingResult = wealthStanding(era, c.parentWealth);
  const looksStandingResult = looksStanding(c.looks);
  const headingRef = useFocusOnChange<HTMLHeadingElement>();
  return (
    <main className="screen" data-testid="birth-screen">
      <p className="sub">{ERA_CONFIG[era].label}</p>
      <h1 ref={headingRef} tabIndex={-1} data-testid="birth-name">
        {c.name}
      </h1>
      <p data-testid="birth-year">
        {c.birthYear}년, {c.gender === 'male' ? '남자아이' : '여자아이'}로 태어났다.
      </p>
      <section className="facts">
        <p data-testid="birth-wealth">{WEALTH_TEXT[c.parentWealth]}</p>
        <p data-testid="birth-standing">
          <KeepStanding text={wealthStandingText(wealthStandingResult)} />
        </p>
        <p data-testid="birth-parenting">
          교육방식: {PARENTING_LABEL[c.parenting]}. {parentingText(c.parenting, c.parentWealth)}
        </p>
        <p data-testid="birth-looks">
          <KeepStanding text={looksScoreText(c.looks, looksStandingResult)} /> {looksText(c.looks)}
        </p>
      </section>
      {/* 출생 결과를 읽기도 전에 직전 화면의 더블클릭이 이 버튼에 떨어지지 않도록 가드한다(R-014). */}
      <GuardedButton guardKey="birth" onClick={onNext} data-testid="next-life">
        살아가기
      </GuardedButton>
    </main>
  );
}
