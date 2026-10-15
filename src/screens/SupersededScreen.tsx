import { GuardedButton } from '../ui/GuardedButton';
import { useFocusOnChange } from '../ui/useFocus';

interface Props {
  onTakeOver: () => void;
}

/**
 * 저장된 게임이 이 화면 밖에서 바뀌었을 때(R-011): 이 탭은 더 이상 저장하지 않고 멈춘다.
 * 바뀐 곳이 다른 탭인지, 이미 닫은 탭인지, 같은 탭의 개발자 도구(저장을 직접 지우거나 바꿈)인지는 알 수 없으므로 문구는 어느 쪽도 단정하지 않는다(R-047, R-054).
 * 마지막으로 진행한 쪽이 이기고(마지막 쓰기 우선), 이 탭에서 계속하려면 저장된 최신 상태를 이어받는다. 두 탭이 서로의 진행을 덮어써서 되감기거나 깨지는 일이 없다.
 * 이어받을 저장이 없거나 읽을 수 없으면(지워졌거나 손상) 새 게임이 시작된다 — 버튼 옆에 미리 알린다(R-054).
 */
export function SupersededScreen({ onTakeOver }: Props) {
  const headingRef = useFocusOnChange<HTMLHeadingElement>();
  return (
    <main className="screen" data-testid="superseded-screen">
      <h1 ref={headingRef} tabIndex={-1}>
        수저 게임
      </h1>
      {/* 바뀐 곳이 어디인지(다른 탭·닫힌 탭·같은 탭의 직접 변경)는 알 수 없다 → "저장이 이 화면 밖에서 바뀌었다"고만 말한다. */}
      <p data-testid="superseded-text">저장된 게임이 이 화면 밖에서 바뀌었습니다.</p>
      <p className="muted">다른 탭이나 창에서 진행했거나, 저장이 직접 지워지거나 바뀌었을 수 있습니다. 이 화면은 최신이 아닐 수 있습니다. 이어서 하려면 아래 버튼을 누르세요. 저장된 가장 최근 내용을 이어받습니다.</p>
      <GuardedButton guardKey="superseded" onClick={onTakeOver} data-testid="take-over">
        이 탭에서 이어하기
      </GuardedButton>
      <p className="muted" data-testid="take-over-note">
        저장된 게임이 없거나 읽을 수 없으면 새 게임이 시작됩니다.
      </p>
    </main>
  );
}
