import { Fragment } from 'react';
import { dominantLang, latinRuns, type CitationView } from '../../core/citations';
import { DASH_TEXT } from '../../data/dashText';
import { Glue } from '../Glue';

/**
 * 인용 박스 (SPEC-003 MD2·EV6, M7b — 문구·DOM은 docs/design/copy.md 6-3절, CSS는 styles/dash.css `.cite`).
 * 줄 순서 = 종류 라벨(통계/연구) → 요약(시대 머리말 + 한 칸 + 요약 — 「방과후학교·돌봄」처럼 붙여 쓴 구분 기호와 숫자+단위·날짜는 Glue가 줄 끝·첫머리에 혼자 남지 않게 묶는다) → 출처 한 줄(「{누가}({연도}),」는 한 덩어리로 줄바꿈을 지키고 자료 이름은 Glue).
 * 영문 저자 성·약어·원제는 `lang="en"`으로 가른다(QA-003-M7b K11 — 스크린 리더가 한국어 음성으로 영문을 읽지 않게): 앞머리는 라틴 문자 덩어리마다, 자료 이름은 영문이 한글보다 많으면 통째로.
 * 링크·DOI·URL·PMID는 어디에도 그리지 않는다(EV6 — 외부 이동 방지). 보일 인용이 없는 카드에는 이 컴포넌트를 부르지 않는다(빈 박스 0).
 */
export function CitationBox({ view }: { view: CitationView }) {
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
    </div>
  );
}
