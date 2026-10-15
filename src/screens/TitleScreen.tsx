import { NAMES } from '../data/names';
import { GuardedButton } from '../ui/GuardedButton';
import { useFocusOnChange } from '../ui/useFocus';

interface Props {
  onStart: () => void;
}

export function TitleScreen({ onStart }: Props) {
  const headingRef = useFocusOnChange<HTMLHeadingElement>();
  return (
    <main className="screen title" data-testid="title-screen">
      <div className="title-body">
        <h1 ref={headingRef} tabIndex={-1}>
          수저 게임
        </h1>
        <p className="sub">한 번의 인생을, 끝까지.</p>
        {/* guardKey: 같은 위치의 <main>/버튼이 화면 사이에서 재사용돼도 화면마다 가드가 새로 걸리게 한다. */}
        <GuardedButton guardKey="title" onClick={onStart}>
          시작
        </GuardedButton>
      </div>
      {/* 법원 통계 자료 이용 조건: 출처를 구체적으로 표시한다(문구·주소는 names.json의 meta.attribution). */}
      <p className="credit" data-testid="names-credit">
        <a href={NAMES.meta.attribution.url} target="_blank" rel="noopener noreferrer">
          {NAMES.meta.attribution.text}
        </a>
      </p>
    </main>
  );
}
