import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { profileLabel } from '../core/birthProfile';
import { ROULETTE_TIMING, buildRoulette, type RouletteGame } from '../core/roulette';
import { startBandOf } from '../core/ending';
import { GENERATION_IDS, R1_PRESENT, type BirthReport, type Character, type GameState } from '../core/types';
import { bandLabel } from '../data/endingText';
import { GRADE_NAME, ROULETTE_GEN_TEXT, ROULETTE_TEXT, ROULETTE_TITLE_CHARS, longestWordLength, regionNoteText } from '../data/birthReportText';
import { GENERATIONS } from '../data/generations';
import { Sprite, SiteHead } from '../ui/Brand';
import { Glue } from '../ui/Glue';
import { GradeChip, GradeLine } from '../ui/Grade';
import { GuardedButton } from '../ui/GuardedButton';
import { Reel } from '../ui/Reel';
import { useReducedMotion } from '../ui/hooks';
import { useBottomBar, useScrollTopOnMount, useThemeSurface } from '../ui/useBottomBar';
import { useFocusOnChange } from '../ui/useFocus';

/**
 * 룰렛 화면 (SPEC-003 RL1~RL6 + SPEC-004 GS3·GS6·GS7). **지역·수저 두 릴만** 돈다(지역이 먼저, 수저가 마지막에 멈춘다) — 출생 연도는 룰렛에 나오지 않는다:
 * `generateBirth`가 GS7 가중으로 보이지 않게 먼저 뽑았고(RL2) 연도는 출생신고에서 처음 드러난다. 화면 글자에는 세대 범위의 양 끝(「1981~1996년생 가운데」)만 있다.
 *
 * - 릴 아래 지역·수저 표는 **고른 세대 전체 기준**의 섞은 값이라 릴이 도는 동안에도 바뀌지 않는다(`core/roulette.ts#buildRoulette`, D4-47).
 * - **결과는 이미 정해져 있다**(RL2): `game.character`·`game.birthReport`(출생 로직이 「태어나기」 순간 저장)에서 멈출 자리를 읽을 뿐 여기서 난수를 쓰지 않는다. 연출이 확률을 바꾸지 못한다.
 * - 「랜덤 세대」 경로(`game.fromRandom`)는 두 릴 앞에 짧은 「세대 뽑기」 단계(약 1.2초)가 있다 — 일곱 세대 릴이 먼저 정해진 세대에서 멈춘다(GS3, N3). 건너뛰기·움직임 줄이기는 두 릴과 같다.
 * - 시도를 직접 골랐으면(`game.regionPicked`) 지역 릴은 돌지 않고 고른 칸에 멈춰 있으며 지역 표 자리에 「직접 고른 시도」가 있다(GS6·RG2 d).
 * - 연출 중인지는 세션 상태(`spin`, 저장되지 않음)로 정한다 → 룰렛 도중·직후 새로고침하면 다시 돌지 않고 결과가 확정된 모습으로 열린다(RL5). 다시 굴리기는 없다.
 * - **움직임 줄이기**(시스템 설정 또는 앱 설정)이면 회전 화면을 거치지 않고 곧바로 결과 상태 + 안내 한 줄 + 「출생신고 보기」(R-171).
 * - 회전 중 값은 스크린리더가 읽지 않고(릴은 aria-hidden) 결과만 `role="status"` 한 줄로 알린다(RL6). 키보드로 건너뛰기·이동 가능.
 * - 하단 고정 띠: 회전 중 「건너뛰기」(보조) → 결과 「출생신고 보기」(기본), 같은 자리·같은 버튼. 키가 바뀌면 입력 가드가 다시 닫혀(0.4초) 건너뛰기 더블탭이 곧바로 출생신고로 넘어가지 못한다(R-014).
 */

interface Props {
  game: RouletteGame & Pick<GameState, 'fromRandom'> & { character: Character; birthReport: BirthReport };
  /** 연출 중인가(세션 상태). false면 처음부터 결과 상태 */
  spin: boolean;
  /** 연출이 끝났거나 건너뛰었다 */
  onFinishSpin: () => void;
  /** 「출생신고 보기」 */
  onNext: () => void;
}

/** 세대 뽑기 단계의 릴이 멈추는 시각(ms) — 0.8~1.5초 안(GS3 ▲). 총 연출 4~6초는 이 뒤의 두 릴이 지킨다 */
const DRAW_STOP_MS = 1200;
const DRAW_TITLE_CHARS = longestWordLength([ROULETTE_GEN_TEXT.drawTitle]) + 1;

export function RouletteScreen({ game, spin, onFinishSpin, onNext }: Props) {
  const headingRef = useFocusOnChange<HTMLHeadingElement>();
  const barRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useThemeSurface();
  useScrollTopOnMount();
  useBottomBar(barRef);

  const { character, birthReport: report } = game;
  const generation = game.generation;
  if (generation === null) throw new Error('RouletteScreen: 세대가 없다');
  const view = useMemo(() => buildRoulette(game), [game]);
  const playing = spin && !reduced;
  // 「랜덤 세대」 경로에서 연출이 시작될 때만 세대 뽑기 단계를 거친다 (새로고침·움직임 줄이기는 곧바로 결과)
  const [drawn, setDrawn] = useState(!(game.fromRandom === true && playing));
  const drawing = playing && !drawn;

  // 움직임 줄이기이면 연출 상태를 곧바로 끈다(회전 화면을 거치지 않는다, R-171)
  useEffect(() => {
    if (spin && reduced) onFinishSpin();
  }, [spin, reduced, onFinishSpin]);

  const grade = character.parentWealth;
  // 수저 구간은 표와 같은 섞은 값으로 센다(D4-48) — 연도를 드러내지 않는다
  const band = bandLabel(startBandOf(view.wealthOdds.map((o) => o.percent), grade));
  const resultRegion = report.region;
  const label = profileLabel(generation);
  const r1 = generation === R1_PRESENT;

  // 수저 릴은 왕복 순서(흙 동 은 금 다이아 금 은 동)라 같은 단계가 두 번 나온다 — 칸 번호를 키로 쓴다(R-274)
  const wealthItems = view.wealthReel.map((w, i) => <GradeChip key={i} grade={w} size="reel" />);
  const regionItems = view.regionReel;
  const genRange = view.range;

  if (drawing) {
    const cells = GENERATIONS.map((g) => (
      <span key={g.id} className="reel__cell-gen">
        <span>{g.short}</span>
        <small>{g.birth.from}~{g.birth.to}</small>
      </span>
    ));
    const drawnIndex = GENERATION_IDS.indexOf(generation as (typeof GENERATION_IDS)[number]);
    return (
      <div className="page roulette-page is-spinning" data-testid="roulette-screen" data-state="draw">
        <Sprite />
        <SiteHead name={ROULETTE_TEXT.headName} />
        <main className="roulette">
          <div className="roulette__lead">
            <h1 className="t-title" ref={headingRef} tabIndex={-1} data-testid="roulette-heading" style={{ '--title-chars': DRAW_TITLE_CHARS } as CSSProperties}>
              {ROULETTE_GEN_TEXT.drawTitle}
            </h1>
            <p className="t-muted" role="status" data-testid="roulette-status">
              {ROULETTE_GEN_TEXT.drawNote}
            </p>
          </div>
          <div className="reels">
            <div className="reel-col reel-col--gen">
              <Reel items={cells} resultIndex={drawnIndex} spinning stopMs={DRAW_STOP_MS} onStop={() => setDrawn(true)} testId="reel-generation" />
              <div className="odds odds--gen odds--r3" data-testid="odds-generation">
                <table>
                  <caption className="sr-only">{ROULETTE_GEN_TEXT.drawOddsCaption}</caption>
                  <tbody>
                    {GENERATIONS.map((g) => (
                      <tr key={g.id}>
                        <th scope="row">{g.label}</th>
                        <td>{ROULETTE_GEN_TEXT.drawOdds}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="odds__note">{ROULETTE_GEN_TEXT.drawOddsNote}</p>
              </div>
            </div>
          </div>
          <p className="t-xs t-faint roulette__after" aria-hidden="true">
            {ROULETTE_TEXT.afterNote}
          </p>
        </main>
        <div className="page-end-space" />
        <div className="bottom-bar" data-testid="bottom-bar" ref={barRef}>
          <GuardedButton className="btn btn--secondary btn--lg" guardKey="roulette-draw" data-testid="skip-roulette" onClick={onFinishSpin}>
            {ROULETTE_TEXT.skip}
          </GuardedButton>
        </div>
      </div>
    );
  }

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
          {r1 || genRange === null ? null : (
            <p className="roulette__gen" data-testid="roulette-gen">
              {game.fromRandom === true ? <span className="roulette__from">{ROULETTE_GEN_TEXT.fromRandom}</span> : null}
              <span className="gen-tag">
                <Glue text={label} />
              </span>
              <span>{ROULETTE_GEN_TEXT.among(genRange.from, genRange.to)}</span>
            </p>
          )}
          {/* 상태 문장: 회전 중에는 안내(값이 바뀌지 않는다), 끝나면 결과로 바뀐다 → 스크린리더는 결과만 읽는다(RL6). 결과에는 출생 연도가 없다(GS6) */}
          <p className={playing ? 't-muted' : 'roulette__result'} role="status" data-testid="roulette-status">
            {playing ? (
              view.picked ? ROULETTE_GEN_TEXT.spinNotePicked : ROULETTE_TEXT.spinNote
            ) : (
              <>
                <span className="roulette__place">{resultRegion}</span>
                <GradeLine grade={grade} range={`(${band})`} />
              </>
            )}
          </p>
          {!playing && reduced ? (
            <p className="motion-note t-sm t-muted" data-testid="motion-note">
              {ROULETTE_TEXT.motionNote}
            </p>
          ) : null}
        </div>
        <div className="reels reels--2">
          <div className="reel-col">
            <h2 className="reel-col__title">{ROULETTE_TEXT.regionTitle}</h2>
            <Reel items={regionItems} resultIndex={view.regionIndex} spinning={playing && !view.picked} stopMs={ROULETTE_TIMING.regionStopMs} testId="reel-region" />
            {view.picked ? (
              <p className="odds__picked" data-testid="odds-region">
                {ROULETTE_GEN_TEXT.pickedRegion}
              </p>
            ) : (
              <div className="odds odds--cols odds--region odds--r3" data-testid="odds-region">
                <p className="odds__head">{ROULETTE_GEN_TEXT.oddsHead(label)}</p>
                <table>
                  <caption className="sr-only">
                    {ROULETTE_TEXT.regionOddsCaption} — {ROULETTE_GEN_TEXT.oddsHead(label)}
                  </caption>
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
                  <Glue text={r1 ? ROULETTE_GEN_TEXT.regionNoteR1 : regionNoteText(view)} />
                </p>
              </div>
            )}
          </div>
          <div className="reel-col">
            <h2 className="reel-col__title">{ROULETTE_TEXT.wealthTitle}</h2>
            <Reel items={wealthItems} resultIndex={view.wealthReelIndex} spinning={playing} stopMs={ROULETTE_TIMING.wealthStopMs} onStop={onFinishSpin} testId="reel-wealth" />
            <div className="odds odds--spoon odds--r3" data-testid="odds-wealth">
              <p className="odds__head">{ROULETTE_GEN_TEXT.oddsHead(label)}</p>
              <table>
                <caption className="sr-only">
                  {ROULETTE_TEXT.wealthOddsCaption} — {ROULETTE_GEN_TEXT.oddsHead(label)}
                </caption>
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
                <Glue text={genRange === null ? ROULETTE_GEN_TEXT.wealthNoteR1 : ROULETTE_GEN_TEXT.wealthNote(genRange.from, genRange.to)} />
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
