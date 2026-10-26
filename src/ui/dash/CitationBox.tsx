import { Fragment } from 'react';
import { dominantLang, latinRuns, type CitationView } from '../../core/citations';
import { DASH_TEXT } from '../../data/dashText';
import { Glue } from '../Glue';

/**
 * 인용 박스 (SPEC-003 MD2·EV6, M7b — 문구·DOM은 docs/design/copy.md 6-3절, CSS는 styles/dash.css `.cite`).
 * 줄 순서 = 종류 라벨(통계/연구) → 요약(시대 머리말 + 한 칸 + 요약 — 「방과후학교·돌봄」처럼 붙여 쓴 구분 기호와 숫자+단위·날짜는 Glue가 줄 끝·첫머리에 혼자 남지 않게 묶는다) → 출처 한 줄(「{누가}({연도}),」는 한 덩어리로 줄바꿈을 지키고 자료 이름은 Glue).
 * 영문 저자 성·약어·원제는 `lang="en"`으로 가른다(QA-003-M7b K11 — 스크린 리더가 한국어 음성으로 영문을 읽지 않게): 앞머리는 라틴 문자 덩어리마다, 자료 이름은 영문이 한글보다 많으면 통째로.
 * 링크·DOI·URL·PMID는 어디에도 그리지 않는다(EV6 — 외부 이동 방지). 보일 인용이 없는 카드에는 이 컴포넌트를 부르지 않는다(빈 박스 0).
 *
 * **풀이 줄**(SPEC-005 r4 UX14·QI14, copy.md 15-4): `insight`가 있으면 출처 줄 뒤에 한 문장을 더한다. **화면에는 「풀이」 라벨이 없다**(형진 님 2026-10-26) — 문장만 색·굵기로 요약·출처와 구분하고(styles/dash.css 「r4 구현 변경 — 풀이」), 스크린리더에게만 눈에 안 보이는 접두 「풀이:」(`.sr-only`)를 읽는다. 없으면 요소 자체가 없다(빈 줄 0). **호출자가 넘긴 값만** 그린다 —
 * 본인이 고르는 중대 결정 카드(`DecisionCard`)만 `insightFor(인용 id)`를 넘기고, 부모 결정·흘러감 카드(`ParentCard`)와 기록 카드(`NoteSheet`)는 넘기지 않는다(M23·UX14-2 — 같은 부품, 호출자가 정한다, PD8 (b)).
 */
export function CitationBox({ view, insight = null }: { view: CitationView; insight?: string | null }) {
  return (
    <div className="cite" data-testid="cite" data-citation={view.id}>
      <p className="cite__kind">{DASH_TEXT.citeKindLabel[view.kind]}</p>
      <p className="cite__text" data-testid="cite-text">
        <Glue text={view.text} />
      </p>
      <p className="cite__src" data-testid="cite-src">
        <span className="keep-phrase">
          {latinRuns(view.sourceWho).map((run, i) =>
            run.latin ? (
              <span key={i} lang="en">
                {run.text}
              </span>
            ) : (
              <Fragment key={i}>{run.text}</Fragment>
            ),
          )}
        </span>{' '}
        <span lang={dominantLang(view.sourceTitle)}>
          <Glue text={view.sourceTitle} />
        </span>
      </p>
      {insight === null ? null : (
        <div className="cite__insight" data-testid="cite-insight">
          <p className="cite__insight-text">
            <span className="sr-only">{DASH_TEXT.citeInsightLabel}: </span>
            <Glue text={insight} />
          </p>
        </div>
      )}
    </div>
  );
}
