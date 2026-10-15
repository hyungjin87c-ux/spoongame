import { Fragment } from 'react';
import { glueSegments, type GlueSegment } from '../core/glue';

/**
 * 화면 글자를 줄바꿈 묶음(core/glue.ts)으로 감싸 그린다 (SPEC-003 QM2-5): 「A · B」는 한 묶음(.keep-phrase), 숫자+단위·날짜는 줄이 바뀌지 않는다(.nowrap).
 * 글자는 그대로고 감싸는 표시만 더한다 — 읽는 이름·복사되는 글자는 같다.
 */
function render(segments: readonly GlueSegment[]) {
  return segments.map((s, i) => {
    if (s.kind === 'plain') return <Fragment key={i}>{s.text}</Fragment>;
    if (s.kind === 'nowrap') return <span key={i} className="nowrap">{s.text}</span>;
    return <span key={i} className="keep-phrase">{render(s.parts)}</span>;
  });
}

export function Glue({ text }: { text: string }) {
  return <>{render(glueSegments(text))}</>;
}
