import { Fragment, type ReactNode } from 'react';
import { glueSegments, type GlueSegment } from '../core/glue';

/**
 * 화면 글자를 줄바꿈 묶음(core/glue.ts)으로 감싸 그린다 (SPEC-003 QM2-5): 「A · B」는 한 묶음(.keep-phrase), 숫자+단위·날짜는 줄이 바뀌지 않는다(.nowrap).
 * 글자는 그대로고 감싸는 표시만 더한다 — 읽는 이름·복사되는 글자는 같다.
 */
function render(segments: readonly GlueSegment[], hideSeparator: boolean) {
  return segments.map((s, i) => {
    if (s.kind === 'plain') return <Fragment key={i}>{plain(s.text, hideSeparator)}</Fragment>;
    if (s.kind === 'nowrap') return <span key={i} className="nowrap">{s.text}</span>;
    return <span key={i} className="keep-phrase">{render(s.parts, hideSeparator)}</span>;
  });
}

/** 띄어 쓴 가운뎃점 사슬 「A · B」의 「·」만 접근성 트리에서 숨긴다 — 글자·공백·묶음은 그대로고 낭독만 「A B」가 된다(R-403 ⑤, D-74) */
function plain(text: string, hideSeparator: boolean): ReactNode {
  if (!hideSeparator || !text.includes(' · ')) return text;
  return text.split(' · ').map((part, i) => (
    <Fragment key={i}>
      {i === 0 ? null : (
        <>
          {' '}
          <span aria-hidden="true">·</span>{' '}
        </>
      )}
      {part}
    </Fragment>
  ));
}

/**
 * `hideSeparator`: 머리·라벨의 짧은 쌍(엔딩 머리 「{세상} · 생애 기록」 등)의 가운뎃점을 낭독에서 숨긴다(M7c D-74 — 보이는 글자·묶음은 그대로, 본문 속 붙여 쓴 「·」는 건드리지 않는다).
 */
export function Glue({ text, hideSeparator = false }: { text: string; hideSeparator?: boolean }) {
  return <>{render(glueSegments(text), hideSeparator)}</>;
}
