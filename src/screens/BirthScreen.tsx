import { useMemo, useRef, type ReactNode } from 'react';
import { looksStanding } from '../core/birth';
import { birthSentence, reportPlaceLabel, weightStanding } from '../core/birthReport';
import { startBandOf } from '../core/ending';
import { peersOf } from '../core/peers';
import type { BirthReport, Character, Era } from '../core/types';
import { buildComparison, compareShown, lifeGapLine } from '../data/birthCompare';
import { PARENTING_LABEL, standingLabel } from '../data/birthText';
import { BIRTH_TEXT, REPORT_NOTES, formatKg, genderLabel, housingText, orderText, parentingDocText, yearMonthText } from '../data/birthReportText';
import { bandLabel } from '../data/endingText';
import { getRegionFootnote } from '../data/koreaStatsAccess';
import { placeLabel } from '../data/regionNames';
import { SiteHead, Sprite } from '../ui/Brand';
import { FitPair } from '../ui/FitPair';
import { Glue } from '../ui/Glue';
import { GradeChip, GradeLine } from '../ui/Grade';
import { GuardedButton } from '../ui/GuardedButton';
import { OCCUPATION_LABEL } from '../data/birthReportTable';
import { useBottomBar, useScrollTopOnMount, useThemeSurface } from '../ui/useBottomBar';
import { useFocusOnChange } from '../ui/useFocus';

/**
 * 출생신고 화면 (SPEC-003 BR1~BR7, VP3, 시안 docs/design/mockups/birth.html). 서류처럼 보이는 문서: 쪽빛 띠(「출생 신고」·가상의 서류) · 큰 이름 · 한 줄 서술문(BR3) · 정보 격자(BR2) ·
 * 같은 해 태어난 사람들(VP3) · 다른 집 아이들과 견주면(BR5, 출처가 확인된 행만) · 하단 고정 「살아가기」.
 *
 * - 값은 모두 저장된 출생 결과(`character`·`birthReport`)에서 읽는다 — 화면은 계산하지 않고 core의 결과를 문구로 그리기만 한다(R-018). 새로고침해도 같은 출생신고다(R-021).
 * - 집안 형편 = 수저 칩 + `bandLabel(startBandOf(era, wealth))`(「흙수저(하위 25% 안쪽)」, R-170) 한 함수의 출력. 통계 소득 5분위라고 쓰지 않는다.
 * - 외모는 점수(N점)로 적지 않는다 — `standingLabel(looksStanding)`의 「상위/하위 약 N%」만(R-135, 옛 출생 화면의 「외모 N점」은 없어졌다).
 * - 「살아가기」는 입력 가드(진입 직후 0.4초, R-014)와 연타 방어(reducer가 birth 단계에서만 받는다)를 가진다(BR7).
 */

interface Props {
  era: Era;
  character: Character;
  report: BirthReport;
  peerSeed: number;
  onNext: () => void;
}

/** 서술문 끝의 「(3.3kg은 상위 약 38%)」를 따로 묶는다: 줄에 안 들어가면 통째로 다음 줄로 내려가고, 묶음 자체가 한 줄보다 길 때(큰 글자·320px)만 안에서 줄이 바뀐다 */
function Sentence({ text }: { text: string }): ReactNode {
  const m = /^(.*?)(\([^()]*\))$/.exec(text);
  if (m === null) return text;
  return (
    <>
      {m[1]}
      <span className="keep-phrase">{m[2]}</span>
    </>
  );
}

/**
 * wide: 항상 한 줄을 다 쓴다 / span2: 두 칸을 쓴다 — 좁은 화면(2열)에서는 한 줄을 다 쓰고, 넓은 화면(3열 격자)에서는 두 칸(3분의 2)을 쓴다.
 * 「태어난 곳」에 쓴다: 「전남광주통합특별시」(9글자)처럼 긴 낱말이 한 칸(글자 150%부터 칸 폭 205px 초과)에서 중간에 끊기지 않게 한다(R-269, R-281).
 */
function Field({ id, label, wide, span2, children }: { id: string; label: string; wide?: boolean; span2?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? 'wide' : span2 ? 'span-2' : undefined} data-testid={`birth-field-${id}`}>
      <dt>{label}</dt>
      <dd data-testid={id === 'month' ? 'birth-year' : `birth-${id}`}>{children}</dd>
    </div>
  );
}

export function BirthScreen({ era, character: c, report, peerSeed, onNext }: Props) {
  const headingRef = useFocusOnChange<HTMLHeadingElement>();
  const barRef = useRef<HTMLDivElement>(null);
  useThemeSurface();
  useScrollTopOnMount();
  useBottomBar(barRef);

  const sentence = birthSentence(c, report, era);
  const place = reportPlaceLabel(report, era);
  const band = bandLabel(startBandOf(era, c.parentWealth));
  const looks = standingLabel(looksStanding(c.looks));
  const weight = `${formatKg(report.birthWeightKg)}`;
  const weightRank = standingLabel(weightStanding(report.birthWeightKg, c.gender));
  const peers = useMemo(() => peersOf(peerSeed, c.birthYear, report.month, c.name), [peerSeed, c.birthYear, c.name, report.month]);
  // 비교 표는 지금 세상에서만 보인다(통계가 2024~2025년 값, R-263). 지난·다가올 세상은 만들지도 않는다.
  const showCompare = compareShown(era);
  const rows = useMemo(() => (showCompare ? buildComparison(c.parentWealth) : []), [showCompare, c.parentWealth]);
  const gapLine = useMemo(() => (showCompare ? lifeGapLine() : null), [showCompare]);

  return (
    <div className="page birth-page" data-testid="birth-screen">
      <Sprite />
      <SiteHead name={BIRTH_TEXT.headName} />
      <main className="doc-page">
        <article className="doc" aria-labelledby="doc-title">
          <div className="doc__band">
            <h1 id="doc-title" ref={headingRef} tabIndex={-1} data-testid="birth-heading">
              {BIRTH_TEXT.docTitle}
            </h1>
            <span className="doc__tag">
              <FitPair a={BIRTH_TEXT.docTag[0]} b={BIRTH_TEXT.docTag[1]} />
            </span>
          </div>
          <div className="doc__body">
            {/* 도장은 본문 위쪽 모서리에 놓는다(본문이 기준) — 띠 높이가 글자 크기에 따라 커져도(폭 320·글자 200%의 띠 오른쪽 표기 4줄) 띠 글자를 가리지 않는다 */}
            <div className="stamp" aria-hidden="true">
              {BIRTH_TEXT.stamp}
            </div>
            <div>
              <p className="label">{BIRTH_TEXT.nameLabel}</p>
              <p className="doc__name" data-testid="birth-name">
                {c.name}
              </p>
            </div>
            <p className="doc__sentence" data-testid="birth-sentence">
              <Sentence text={sentence} />
            </p>
            <dl className="doc__grid" data-testid="birth-grid">
              <Field id="gender" label={BIRTH_TEXT.gridLabels.gender}>
                {genderLabel(c.gender)}
              </Field>
              <Field id="month" label={BIRTH_TEXT.gridLabels.month}>
                {yearMonthText(c.birthYear, report.month)}
              </Field>
              <Field id="place" label={BIRTH_TEXT.gridLabels.place} span2>
                {place}
              </Field>
              <Field id="wealth" label={BIRTH_TEXT.gridLabels.wealth} wide>
                <GradeLine grade={c.parentWealth} range={`(${band})`} size="lg" />
              </Field>
              <Field id="mother" label={BIRTH_TEXT.gridLabels.mother}>
                <FitPair a={`${report.mother.age}세`} b={OCCUPATION_LABEL[report.mother.job]} />
              </Field>
              <Field id="father" label={BIRTH_TEXT.gridLabels.father}>
                <FitPair a={`${report.father.age}세`} b={OCCUPATION_LABEL[report.father.job]} />
              </Field>
              <Field id="housing" label={BIRTH_TEXT.gridLabels.housing}>
                {housingText(report.housing)}
              </Field>
              <Field id="weight" label={BIRTH_TEXT.gridLabels.weight}>
                {weight} <span className="cell-sub">({weightRank})</span>
              </Field>
              <Field id="order" label={BIRTH_TEXT.gridLabels.order}>
                {orderText(report.birthOrder)}
              </Field>
              <Field id="looks" label={BIRTH_TEXT.gridLabels.looks}>
                <span className="cell-sub">{BIRTH_TEXT.looksSub}</span> {looks}
              </Field>
              <Field id="parenting" label={BIRTH_TEXT.gridLabels.parenting} wide>
                {PARENTING_LABEL[c.parenting]} <span className="cell-sub">{parentingDocText(c.parenting, c.parentWealth)}</span>
              </Field>
            </dl>
          </div>
        </article>

        <section className="card" aria-labelledby="peers-t" data-testid="peers-card">
          <div className="card__head">
            <h2 id="peers-t" className="card__title">
              {BIRTH_TEXT.peersTitle}
            </h2>
          </div>
          <ul className="people" data-testid="peers">
            {peers.map((p) => (
              <li key={p.name} data-testid="peer">
                <div className="people__who">
                  {/* 성별은 「여성/남성」으로 이름 옆에 둔다 — 장소 줄 끝에 「여」·「남」 한 글자가 혼자 남지 않게(R-269) */}
                  <div className="people__line">
                    <span className="name" data-testid="peer-name">
                      {p.name}
                    </span>{' '}
                    <span className="sub" data-testid="peer-gender">
                      {genderLabel(p.gender)}
                    </span>
                  </div>
                  <div className="sub" data-testid="peer-place">
                    {placeLabel(p, era)}
                  </div>
                </div>
                <GradeChip grade={p.wealth} />
              </li>
            ))}
          </ul>
          <p className="t-sm t-muted card__note">
            <Glue text={BIRTH_TEXT.peersNote} />
          </p>
        </section>

        {showCompare && rows.length > 0 ? (
          <section className="card card--cmp" aria-labelledby="cmp-t" data-testid="compare-card">
            <div className="card__head">
              <h2 id="cmp-t" className="card__title">
                {BIRTH_TEXT.compareTitle}
              </h2>
            </div>
            <table className="table table--cmp" role="table" data-testid="compare-table">
              <caption className="sr-only">{BIRTH_TEXT.compareCaption}</caption>
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    {BIRTH_TEXT.compareColItem}
                  </th>
                  <th scope="col" role="columnheader" className="num">
                    {BIRTH_TEXT.compareColAll}
                  </th>
                  <th scope="col" role="columnheader" className="num">
                    {BIRTH_TEXT.compareColThis}
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {rows.map((r) => (
                  <tr key={r.id} role="row" data-testid="compare-row" data-row-id={r.id}>
                    <th scope="row" role="rowheader">
                      {r.label}
                      <span className="cmp__source t-xs t-faint">
                        <Glue text={r.source} />
                      </span>
                    </th>
                    <td role="cell" className="num" data-label={BIRTH_TEXT.compareColAll}>
                      {r.average}
                    </td>
                    <td role="cell" className="num" data-label={BIRTH_TEXT.compareColThis}>
                      <strong>{r.child}</strong>
                      <span className="cmp__note t-xs t-faint">{r.childNote}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="t-xs t-faint card__note" data-testid="compare-note">
              <Glue text={BIRTH_TEXT.compareNote} />
            </p>
            {/* 기대수명의 소득 격차: 표 칸이 아니라 모든 수저 단계에 같은 한 줄 서술이다 — 이 가정을 겨냥하지 않는다(R-261) */}
            {gapLine === null ? null : (
              <>
                <p className="t-sm card__note" data-testid="life-gap">
                  <Glue text={gapLine.text} />
                </p>
                <p className="t-xs t-faint" data-testid="life-gap-source">
                  <Glue text={gapLine.source} />
                </p>
              </>
            )}
          </section>
        ) : null}

        <div className="doc-notes t-xs t-faint" data-testid="page-foot">
          <p data-testid="report-footnote-region">
            {/* 지난 세상은 시·군·구가 2025년 행정구역 이름이라는 한 줄, 지금·다가올 세상은 2026년 개편 설계값 한 줄(R-264) */}
            <Glue text={era === 'past' ? REPORT_NOTES.regionPast : getRegionFootnote()} />
          </p>
          <p>
            <Glue text={REPORT_NOTES.stats} />
          </p>
          <p>
            <Glue text={REPORT_NOTES.housing} />
          </p>
          <p>
            <Glue text={REPORT_NOTES.design} />
          </p>
          {era === 'present' ? null : (
            <p data-testid="report-footnote-era">
              <Glue text={era === 'past' ? REPORT_NOTES.eraPast : REPORT_NOTES.eraFuture} />
            </p>
          )}
        </div>
      </main>
      <div className="page-end-space" />
      <div className="bottom-bar" data-testid="bottom-bar" ref={barRef}>
        {/* 룰렛의 「출생신고 보기」와 같은 자리에 놓이므로 진입 직후 입력 가드로 더블탭이 곧바로 인생 시작으로 넘어가지 않게 한다(R-014, BR7) */}
        <GuardedButton className="btn btn--primary btn--lg" guardKey="birth" data-testid="next-life" onClick={onNext}>
          {BIRTH_TEXT.next}
        </GuardedButton>
      </div>
    </div>
  );
}
