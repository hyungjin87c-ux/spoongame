import { splitPair } from '../core/glue';
import { Glue } from './Glue';

/**
 * 「A · B」 짧은 쌍 (SPEC-003 QM2-10 규칙 3): 한 줄에 들어가면 「A · B」 한 줄로, 좁은 폭·큰 글자에서 한 줄을 넘으면 기호를 감추고 A·B를 따로 줄로 나눈다
 * (컨테이너 쿼리, title.css `.pair`) — 「·」가 줄 끝이나 첫머리에 혼자 남는 일이 없다. 글자는 그대로고(DOM 글자 「A · B」) 보이는 모양만 바뀐다.
 * 쌍이 아니면(구분 기호가 없거나 둘 이상) 일반 줄바꿈 묶음(`Glue`)으로 그린다.
 * kind: `basis`는 14px 기준 줄(「인구 10만 명당 · 2025년 기준」), `meta`는 12px 보조 줄(「통계 기준: 2025년 · 마지막 갱신 2026-10-15」) — 한 줄에 들어가는 폭의 문턱이 다르다.
 */
export function Pair({ text, kind }: { text: string; kind: 'basis' | 'meta' }) {
  const pair = splitPair(text);
  if (pair === null) return <Glue text={text} />;
  return (
    <span className={`pair pair--${kind}`}>
      <span className="pair__item">
        <Glue text={pair[0]} />
      </span>
      {/* 항목 사이의 일반 공백 하나는 기호 조각 밖에 둔다(R-242): 두 줄 모드에서 기호 조각이 display: none이어도 DOM에는 두 항목 사이에 공백이 남아
          블록 경계를 무시하고 이어 읽는 이름 계산·스크린리더가 「명당2025년」처럼 붙여 읽지 않는다. 한 줄 모드의 모양은 「A · B」 그대로다(공백 + 「· 」). */}
      {' '}
      <span className="pair__sep">· </span>
      <span className="pair__item">
        <Glue text={pair[1]} />
      </span>
    </span>
  );
}
