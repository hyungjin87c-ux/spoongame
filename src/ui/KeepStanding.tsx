import { Fragment, type ReactNode } from 'react';

/**
 * 순위 표현("상위 약 23%의", "하위 1% 안쪽의", "딱 중간쯤의")과 엔딩 출발선 구간의 표현("상위 8~28% 사이의", "하위 25%와" + "상위 45% 사이의")을 줄바꿈으로 쪼개지 않는다 (QA 사용감 3, R-091).
 * 구간이 두 덩어리인 "하위 25%와 상위 45% 사이의"는 "와" 뒤 공백에서만 줄이 바뀔 수 있다 — 한 덩어리로 묶으면 320px 폭에서 넘친다.
 * `word-break: keep-all`이어도 브라우저는 "%"와 뒤의 조사("의") 사이에서 줄을 바꿀 수 있어 "의"만 다음 줄로 넘어가곤 했다.
 * 이 컴포넌트는 글 자체(텍스트 내용)는 그대로 두고 순위 표현만 줄바꿈 없는 span으로 감싼다 — 스크린리더와 textContent는 달라지지 않는다.
 * 구간이 넓은 덩어리(「상위 3~17% 사이의」)는 숫자 구간과 뒤쪽 낱말 둘로 나눠 감싼다(standingPieces) — 320px·글자 200%에서 상자를 넘지 않게.
 */
const STANDING_UNIT = /((?:상위|하위) \d+(?:~\d+)?% 사이의?|(?:상위|하위) \d+%와|(?:상위|하위)(?: 약)? \d+%(?: 안쪽| 밖)?의?|딱 중간쯤의?)/;

export function splitStanding(text: string): string[] {
  return text.split(STANDING_UNIT); // 짝수 칸은 일반 글, 홀수 칸은 순위 표현
}

/**
 * 순위 표현 한 덩어리를 줄바꿈 없는 조각으로 나눈다. 「상위 3~17% 사이의」(12글자)는 320px·글자 200%에서 문장 상자(약 287px)보다 넓어(318px) 상자 밖으로 삐져나갔다(M7a r2 CM11 수정).
 * 숫자 구간(「상위 3~17%」)과 뒤쪽 낱말(「사이의」「안쪽의」「밖의」)로 나눠 **둘 사이의 공백에서만** 줄이 바뀔 수 있게 한다 — 숫자·「%」·조사는 여전히 쪼개지지 않고,
 * 줄머리에 오는 것은 온전한 낱말(「사이의」)이라 「의」가 홀로 남지 않는다. 짧은 덩어리(「상위 약 23%의」「하위 25%와」「딱 중간쯤의」)는 그대로 한 조각이다.
 */
export function standingPieces(unit: string): string[] {
  const m = /^((?:상위|하위) \d+(?:~\d+)?%) ((?:사이|안쪽|밖)의?)$/.exec(unit);
  return m === null ? [unit] : [m[1], m[2]];
}

export function KeepStanding({ text }: { text: string }): ReactNode {
  return splitStanding(text).map((part, i) => {
    if (i % 2 === 0) return part;
    const pieces = standingPieces(part);
    return pieces.map((piece, j) => (
      <Fragment key={`${i}-${j}`}>
        {j > 0 ? ' ' : null}
        <span className="nowrap">{piece}</span>
      </Fragment>
    ));
  });
}
