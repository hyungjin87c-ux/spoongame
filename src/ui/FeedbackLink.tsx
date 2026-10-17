import { useRef } from 'react';
import { DASH_TEXT } from '../data/dashText';
import { Icon } from './Brand';
import { useInputGuard, type GuardKey } from './GuardedButton';

/**
 * 「의견 보내기」 (SPEC-003 DB7): GitHub 이슈 작성 화면으로 가는 **새 탭 링크**(`target="_blank" rel="noopener noreferrer"`). 주소는 core/feedback.ts#buildFeedbackUrl이 허용 목록 필드만으로 만든다 —
 * 게임 실행 중 외부 서버로 나가는 요청은 없고(링크 이동은 사용자 행동이라 제외, CM3), 이름·기록·저장 데이터가 주소에 들어가지 않는다.
 * 진짜 링크(<a href>)라 길게 눌러 복사·새 탭 열기도 되고, 입력 가드(화면 진입 직후 0.4초, R-035)와 연타 방지(한 번 연 뒤 1.5초는 다시 열지 않는다 — 팝업 차단·탭 폭주 방지)를 가진다.
 * 가드로 닫혀 있는 동안은 `aria-disabled="true"`이고 눌러도 이동하지 않는다. 주소를 만들 수 없으면(저장소 주소가 빌드 설정에 없다) 아무것도 그리지 않는다.
 */

/** 한 번 열린 뒤 다시 열리지 않는 시간(ms) */
export const FEEDBACK_COOLDOWN_MS = 1500;

export function FeedbackLink({ url, guardKey }: { url: string | null; guardKey: GuardKey }) {
  const ready = useInputGuard(guardKey);
  const lastOpen = useRef<number | null>(null);
  if (url === null) return null;
  return (
    <a
      className="btn btn--tool"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={ready ? undefined : true}
      data-testid="tool-feedback"
      onClick={(e) => {
        const now = performance.now();
        if (!ready || (lastOpen.current !== null && now - lastOpen.current < FEEDBACK_COOLDOWN_MS)) {
          e.preventDefault();
          return;
        }
        lastOpen.current = now;
      }}
    >
      <Icon name="i-message" />
      <span>{DASH_TEXT.toolFeedback}</span>
      <span className="sr-only">{DASH_TEXT.feedbackNewTab}</span>
    </a>
  );
}
