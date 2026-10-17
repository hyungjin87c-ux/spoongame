import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { ROULETTE_TIMING, buildRoulette } from '../core/roulette';
import { startBandOf } from '../core/ending';
import type { BirthReport, Character, Era } from '../core/types';
import { bandLabel } from '../data/endingText';
import { GRADE_NAME, ROULETTE_TEXT, ROULETTE_TITLE_CHARS, regionOddsNote } from '../data/birthReportText';
import { getUsableIndicator } from '../data/koreaStatsAccess';
import { Sprite, SiteHead } from '../ui/Brand';
import { FitPair } from '../ui/FitPair';
import { Glue } from '../ui/Glue';
import { GradeChip } from '../ui/Grade';
import { GuardedButton } from '../ui/GuardedButton';
import { Reel } from '../ui/Reel';
import { useReducedMotion } from '../ui/hooks';
import { useBottomBar, useScrollTopOnMount, useThemeSurface } from '../ui/useBottomBar';
import { useFocusOnChange } from '../ui/useFocus';

/**
 * 룰렛 화면 (SPEC-003 RL1~RL6, 시안 docs/design/mockups/roulette-spin·roulette-result·roulette-result-reduced.html).
 * 수저 릴과 지역 릴이 나란히 돌고(지역 릴이 먼저, 수저 릴이 마지막에 멈춘다), 각 릴 아래 작은 글씨로 확률을 적는다. 「건너뛰기」는 바로 결과 상태로 넘긴다.
 *
 * - **결과는 이미 정해져 있다**(RL2): `game.character`·`game.birthReport`(출생 로직이 「태어나기」 순간 저장)에서 멈출 자리를 읽을 뿐 여기서 난수를 쓰지 않는다. 연출이 확률을 바꾸지 못한다.
 * - 연출 중인지는 세션 상태(`spin`, 저장되지 않음)로 정한다 → 룰렛 도중·직후 새로고침하면 다시 돌지 않고 결과가 확정된 모습으로 열린다(RL5). 다시 굴리기는 없다.
 * - **움직임 줄이기**(시스템 설정 또는 앱 설정)이면 회전 화면을 거치지 않고 곧바로 결과 상태 + 안내 한 줄 + 「출생신고 보기」(R-171).
 * - 회전 중 값은 스크린리더가 읽지 않고(릴은 aria-hidden) 결과만 `role="status"` 한 줄로 알린다(RL6). 키보드로 건너뛰기·이동 가능.
 * - 하단 고정 띠: 회전 중 「건너뛰기」(보조) → 결과 「출생신고 보기」(기본), 같은 자리·같은 버튼. 키가 바뀌면 입력 가드가 다시 닫혀(0.4초) 건너뛰기 더블탭이 곧바로 출생신고로 넘어가지 못한다(R-014).
 */

interface Props {
  era: Era;
  character: Character;
  report: BirthReport;
  /** 연출 중인가(세션 상태). false면 처음부터 결과 상태 */
  spin: boolean;
  /** 연출이 끝났거나 건너뛰었다 */
  onFinishSpin: () => void;
  /** 「출생신고 보기」 */
  onNext: () => void;
}

export function RouletteScreen({ era, character, report, spin, onFinishSpin, onNext }: Props) {
  const headingRef = useFocusOnChange<HTMLHeadingElement>();
  const barRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useThemeSurface();
  useScrollTopOnMount();
  useBottomBar(barRef);

  const view = useMemo(() => buildRoulette(era, character, report), [era, character, report]);
  const playing = spin && !reduced;

  // 움직임 줄이기이면 연출 상태를 곧바로 끈다(회전 화면을 거치지 않는다, R-171)
  useEffect(() => {
    if (spin && reduced) onFinishSpin();
  }, [spin, reduced, onFinishSpin]);

  const grade = character.parentWealth;
  const band = bandLabel(startBandOf(era, grade));
  const resultGrade = `${GRADE_NAME[grade]}(${band})`;
  const resultRegion = view.regionOdds[view.regionIndex].name;

  const stats = getUsableIndicator('birth-by-sido');
  const note = regionOddsNote(view.basis, era, { org: stats?.source.org ?? '', year: stats?.latest.year ?? 0 });

  // 수저 릴은 왕복 순서(흙 동 은 금 다이아 금 은 동)라 같은 단계가 두 번 나온다 — 칸 번호를 키로 쓴다(R-274)
  const wealthItems = view.wealthReel.map((w, i) => <GradeChip key={i} grade={w} size="reel" />);
  const regionItems = view.regionOdds.map((o) => o.name);

  return (
    <div className={`page roulette-page${playing ? ' is-spinning' : ''}`} data-testid="roulette-screen" data-state={playing ? 'spinning' : 'result'}>
      <Sprite />
      <SiteHead name={ROULETTE_TEXT.headName} />
      <main className="roulette">
        <div className="roulette__lead">
          {/* 제목 글자 크기 상한(QM3-2): 가장 긴 낱말(「정해졌습니다」)이 어떤 폭·글자 크기에서도 한 줄에 들어가도록 줄 폭 ÷ 글자 수로 정한다 — doc.css `.roulette__lead .t-title` */}
          <h1 className="t-title" ref={headingRef} tabIndex={-1} data-testid="roulette-heading" style={{ '--title-chars': ROULETTE_TITLE_CHARS } as CSSProperties}>
            {playing ? ROULETTE_TEXT.spinTitle : ROULETTE_TEXT.doneTitle}
          </h1>
          {/* 상태 문장: 회전 중에는 안내(값이 바뀌지 않는다), 끝나면 결과로 바뀐다 → 스크린리더는 결과만 읽는다(RL6) */}
          <p className="t-muted" role="status" data-testid="roulette-status">
            {playing ? ROULETTE_TEXT.spinNote : <FitPair a={resultGrade} b={resultRegion} />}
          </p>
          {!playing && reduced ? (
            <p className="motion-note t-sm t-muted" data-testid="motion-note">
              {ROULETTE_TEXT.motionNote}
            </p>
          ) : null}
        </div>
        <div className="reels">
          <div className="reel-col">
            <h2 className="reel-col__title">{ROULETTE_TEXT.wealthTitle}</h2>
            <Reel items={wealthItems} resultIndex={view.wealthReelIndex} spinning={playing} stopMs={ROULETTE_TIMING.wealthStopMs} onStop={onFinishSpin} testId="reel-wealth" />
            <div className="odds" data-testid="odds-wealth">
              <table>
                <caption className="sr-only">{ROULETTE_TEXT.wealthOddsCaption}</caption>
                <tbody>
                  {view.wealthOdds.map((o) => (
                    <tr key={o.wealth}>
                      <th scope="row">{GRADE_NAME[o.wealth]}</th>
                      <td>{o.percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="odds__note" data-testid="odds-wealth-note">
                {ROULETTE_TEXT.wealthOddsNote}
              </p>
            </div>
          </div>
          <div className="reel-col">
            <h2 className="reel-col__title">{ROULETTE_TEXT.regionTitle}</h2>
            <Reel items={regionItems} resultIndex={view.regionIndex} spinning={playing} stopMs={ROULETTE_TIMING.regionStopMs} testId="reel-region" />
            <div className="odds odds--cols" data-testid="odds-region">
              <table>
                <caption className="sr-only">{ROULETTE_TEXT.regionOddsCaption}</caption>
                <tbody>
                  {view.regionOdds.map((o) => (
                    <tr key={o.name}>
                      <th scope="row">{o.name}</th>
                      <td>{o.percent.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="odds__note" data-testid="odds-region-note">
                <Glue text={note} />
              </p>
            </div>
          </div>
        </div>
        {/* 결과 뒤에만 보이는 고지(R-132). 회전 중에는 자리만 차지하고 보이지 않아(visibility: hidden — 스크린리더도 읽지 않는다) 결과로 바뀔 때 화면 길이가 변하지 않는다. */}
        <p className="t-xs t-faint roulette__after" data-testid="page-foot" aria-hidden={playing ? true : undefined}>
          {ROULETTE_TEXT.afterNote}
        </p>
      </main>
      <div className="page-end-space" />
      <div className="bottom-bar" data-testid="bottom-bar" ref={barRef}>
        {playing ? (
          <GuardedButton className="btn btn--secondary btn--lg" guardKey="roulette-spin" data-testid="skip-roulette" onClick={onFinishSpin}>
            {ROULETTE_TEXT.skip}
          </GuardedButton>
        ) : (
          <GuardedButton className="btn btn--primary btn--lg" guardKey="roulette-done" data-testid="to-birth" onClick={onNext}>
            {ROULETTE_TEXT.toBirth}
          </GuardedButton>
        )}
      </div>
    </div>
  );
}
