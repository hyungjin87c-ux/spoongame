import type { ReactNode } from 'react';

/**
 * 순위 표현("상위 약 23%의", "하위 1% 안쪽의", "딱 중간쯤의")과 엔딩 출발선 구간의 표현("상위 8~28% 사이의", "하위 25%와" + "상위 45% 사이의")을 줄바꿈으로 쪼개지 않는다 (QA 사용감 3, R-091).
 * 구간이 두 덩어리인 "하위 25%와 상위 45% 사이의"는 "와" 뒤 공백에서만 줄이 바뀔 수 있다 — 한 덩어리로 묶으면 320px 폭에서 넘친다.
 * `word-break: keep-all`이어도 브라우저는 "%"와 뒤의 조사("의") 사이에서 줄을 바꿀 수 있어 "의"만 다음 줄로 넘어가곤 했다.
 * 이 컴포넌트는 글 자체(텍스트 내용)는 그대로 두고 순위 표현만 줄바꿈 없는 span으로 감싼다 — 스크린리더와 textContent는 달라지지 않는다.
 */
const STANDING_UNIT = /((?:상위|하위) \d+(?:~\d+)?% 사이의?|(?:상위|하위) \d+%와|(?:상위|하위)(?: 약)? \d+%(?: 안쪽| 밖)?의?|딱 중간쯤의?)/;

export function splitStanding(text: string): string[] {
  return text.split(STANDING_UNIT); // 짝수 칸은 일반 글, 홀수 칸은 순위 표현
}

export function KeepStanding({ text }: { text: string }): ReactNode {
  return splitStanding(text).map((part, i) =>
    i % 2 === 1 ? (
      <span className="nowrap" key={i}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}
