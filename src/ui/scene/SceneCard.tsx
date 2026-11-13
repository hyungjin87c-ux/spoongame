import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { bandOfWealth, eraDecadeOf, eraOf, isForecastYear, type EraPick, type EraWindow } from '../../core/eraWindow';
import { petPhrases, sceneInputOf, sceneKey, sceneLineOf, sceneOf, scenePetsText, sceneRowsOf, type SceneSpec } from '../../core/scene';
import type { FamilyGame } from '../../core/familyView';
import { eraAccessibleName, eraTitle, SCENE_TEXT, type EraSpoken } from '../../data/sceneText';
import { ageText } from '../../core/format';
import { useReducedMotion } from '../hooks';
import { FitList, FitPair } from '../FitPair';
import { Icon } from '../Brand';
import { SvgMarkup } from '../svgNodes';
import { goToLogRow } from './eraLink';
import { SceneSvg } from './SceneSvg';
import type { SceneArt } from './useFamilyArt';

/**
 * 집과 가족 그림 카드 (SPEC-009 FH1~FH6·FT1~FT6, FM5; 시안 `docs/design/mockups/family/dashboard-family.html`, 규칙 `docs/design/family-scene.md` 1·5절).
 *
 * 구성: 집 그림(카드 폭 전체 — SPEC-016 H4부터 시대의 창이 따로 칸이라 빈 자리만큼 넓어졌고 **높이는 그대로**) → 아래 한 줄 → 펼침 「함께 사는 사람」 · 「그림 접기」.
 * 시대의 창은 이 카드가 아니라 **따로 카드**(`EraCard`, 같은 파일): PC(≥ 960px 3열)는 오른쪽 열 맨 위 식구 카드 위, 휴대폰(1열)은 집과 가족 그림 카드 바로 아래다(LifeScreen·dash.css `.col--right`).
 *  - 집 그림은 `role="img"`이고 대체 글은 연도 표 + 아래 한 줄 + 반려동물 문장(`aria-labelledby`)이다. 그림에만 있는 정보는 없다(FH6). 연도 표 「1988년」은 집 그림 오른쪽 위의 HTML이다(그림 안 글자 0).
 *  - 그림 덩어리(`familyArt`)가 오기 전·실패한 동안에는 **크기가 고정된 자리 틀**만 보이고 아래 한 줄·펼침(글)이 먼저 보인다(FH9). 실패하면 「다시 불러오기」가 나온다.
 *  - 시대의 창(SPEC-013 T3, SPEC-016 H4부터 `EraCard`): 굵직한 사건이 있던 해에는 그림 + **항상 보이는 캡션**(사건 이름, 그림 아래 — 휴대폰 띠는 그림 옆)이고 칸 전체가 그해 인생 기록 줄로 가는 링크 하나(초점 정지점 1, FT5, 접근 이름 「캡션. 첫 문장 …」)다.
 *    사건이 없는 해(약 3분의 2)에도 **칸의 자리·크기는 그대로**이고 안은 그림 없는 **빈 종이틀**(연도 표만, 캡션 없음, 링크 없음)이다. 「무거운 장면 가리기」(`settings.gentle`)가 켜지면 무거운 사건(재난·정치)은 대체 사건 그림(1987 12월 투표)이 있으면 그 그림과 캡션, 없으면 빈 해와 같은 틀 + 캡션 「가려 둔 장면」이다. 고르기는 `core/eraWindow.ts#eraOf`(출생 연도·수저 구간).
 *  - 바뀌는 해(구성이 달라진 해)에는 짧은 교차 페이드, 움직임 줄이기·빠른 진행(4배속 이상·자동 모드)이면 즉시 교체한다. 변화의 내용은 인생 기록 문장이 알린다 — 그림은 `aria-live`를 쓰지 않는다(이중 낭독 방지).
 *  - 접으면(`fold`) 집 그림이 사라지고 아래 한 줄·펼침만 남는다. 시대의 창 카드는 접어도 계속 보인다(SPEC-016 Q6 — 접기는 집 그림에만). 접힘은 설정에 저장된다(`settings.sceneFold`) — 새 설정·저장 필드 없음.
 */

export type SceneGame = FamilyGame;

interface Props {
  game: SceneGame;
  fold: boolean;
  onFold: (fold: boolean) => void;
  /** 바뀌는 해의 교차 페이드를 쓸 것인가 — 빠른 진행(4배속 이상·자동 모드)이면 끈다 */
  animate?: boolean;
  /** 그림 덩어리와 시대의 창 10년 덩어리 (`useSceneArt`가 만든다 — 인생 기록 시대 줄과 함께 쓴다) */
  scene: SceneArt;
}

/** 교차 페이드 길이(ms) — `--dur-slow`(400ms)와 같다 */
const FADE_MS = 400;

/**
 * 열쇠가 바뀌면 바로 앞 값을 `FADE_MS` 동안 돌려준다(겹쳐 두고 앞 그림만 사라지게 하려고). `enabled`가 거짓이면 늘 null(즉시 교체).
 * 값 자체는 렌더 때 받은 최신 값을 쓰고, 이 훅은 「직전 값」만 맡는다.
 */
function usePrevWhileSwapping<T>(value: T, key: string, enabled: boolean): T | null {
  const [s, setS] = useState<{ key: string; last: T; prev: T | null }>({ key, last: value, prev: null });
  if (s.key !== key) setS({ key, last: value, prev: enabled ? s.last : null });
  else if (s.last !== value) setS({ key: s.key, last: value, prev: s.prev });
  useEffect(() => {
    if (s.prev === null) return;
    const id = window.setTimeout(() => setS((cur) => (cur.key === s.key ? { ...cur, prev: null } : cur)), FADE_MS + 80);
    return () => window.clearTimeout(id);
  }, [s.prev, s.key]);
  return s.prev;
}

// ---------------------------------------------------------------- 그해 인생 기록 줄로

/** 시대의 창을 누르면 인생 기록의 그해 시대 줄로 간다 — 동작은 `eraLink.ts`(합성 요소로 시험). 주소(#)는 바꾸지 않는다 */
function onEraClick(event: MouseEvent, year: number, reduced: boolean): void {
  event.preventDefault();
  goToLogRow((id) => document.getElementById(id), year, reduced, (fn, ms) => void window.setTimeout(fn, ms));
}

// ---------------------------------------------------------------- 시대의 창 칸

function EraPic({ pick, art, inst }: { pick: EraPick; art: Readonly<Record<string, string>>; inst: string }) {
  const markup = pick.pic === null ? undefined : art[pick.pic.draw];
  if (markup === undefined) return null;
  return (
    <svg viewBox="0 0 40 32" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <SvgMarkup markup={markup} inst={inst} />
    </svg>
  );
}

/** 빈 틀 「빈 종이」(SPEC-013 T3, 형진 님 선택 안 B — `docs/design/era-empty-frame.md`): 파인 면 쟁반 안에 6px 들어간 빈 종이 한 장. 빈 해와 가리기 켠 해(대체 그림 없음)가 같은 틀이다. 장식이라 읽히지 않는다 */
function EmptyFrame() {
  return (
    <span className="era__pic era__pic--empty" aria-hidden="true">
      <i className="era__sheet" />
    </span>
  );
}

/** 시대의 창 칸의 그림 상자: 지금 그림 + 바뀌는 해의 교차 페이드용 이전 그림 */
function EraPicBox({ shown, prev, pick, art }: { shown: EraWindow | null; prev: EraPick | null; pick: EraPick; art: Readonly<Record<string, string>> }) {
  return (
    <span className="era__pic" aria-hidden="true">
      {prev !== null && prev.pic !== null && art[prev.pic.draw] !== undefined && prev.pic.id !== shown?.id ? (
        <span className="era__prev">
          <EraPic pick={prev} art={art} inst="era-prev" />
        </span>
      ) : null}
      {shown === null ? null : <EraPic pick={pick} art={art} inst="era" />}
    </span>
  );
}

function EraCell({ pick, year, art, animate, reduced }: { pick: EraPick; year: number; art: Readonly<Record<string, string>>; animate: boolean; reduced: boolean }) {
  const shown = pick.pic !== null && art[pick.pic.draw] !== undefined ? pick.pic : null;
  const key = shown?.id ?? (pick.veiled ? 'veiled' : 'none');
  const prev = usePrevWhileSwapping(pick, key, animate && !reduced);
  // 링크가 있는 칸: 그림이 있거나, 가려 둔 해(그림 없이 빈 틀만) — 그해 기록 줄이 있다. 줄도 그림도 없으면(사건이 없는 해) 링크 없는 빈 종이틀이다
  const linked = shown !== null || (pick.veiled && pick.line !== null);
  if (!linked) {
    return (
      <div className="era" id="scene-era" data-empty="true" data-hidden="false">
        <EmptyFrame />
      </div>
    );
  }
  // 톤 A의 10년대 번호(필터는 1940~2000년대에만 있다) — 2026년 이후도 그 해의 10년대다
  const dec = shown === null ? undefined : eraDecadeOf(year);
  // 「예측」은 해로 정한다(그림으로 정하지 않는다) — 칩 표·미래 톤(밑그림)이 같은 판단이다 (SPEC-010 구현 규칙 4·7)
  const forecast = isForecastYear(year);
  // 줄이 없는 칸(2111년부터의 끝 장면, SPEC-010 구현 규칙 3)은 갈 곳이 없으니 링크가 아니라 그림만이다 (REV-010-UI-1 R-601) — 캡션 없음
  if (shown !== null && pick.line === null) {
    const name = eraTitle({ caption: null, line: shown.line, second: null });
    return (
      <div className="era" id="scene-era" data-end="true" data-era={shown.id} data-kind={shown.kind} data-hidden="false" data-dec={dec} role="img" aria-label={name} title={name}>
        <EraPicBox shown={shown} prev={prev} pick={pick} art={art} />
      </div>
    );
  }
  // 보이는 캡션: 그림이 있으면 그 사건의 캡션(가린 해의 대체 그림이면 그 그림의 캡션), 그림 없이 가린 해는 「가려 둔 장면」(상수 한 곳). 끝 줄(2110, 빈 캡션)은 캡션이 없다
  const caption = shown !== null ? pick.caption : SCENE_TEXT.eraVeiled;
  const visibleCaption = caption !== null && caption !== '' ? caption : null;
  // 줄의 첫 문장은 가린 해에는 말하지 않는다(가려진 줄의 문장이 가린 장면의 내용을 먼저 말하지 않게). 둘째 문장은 가린 해에 없다
  const spoken: EraSpoken = { caption: visibleCaption, line: pick.veiled || pick.line === null ? null : pick.line.line, second: pick.second };
  return (
    <a
      className="era"
      id="scene-era"
      href={`#log-y${year}`}
      data-era={shown?.id ?? ''}
      data-kind={shown?.kind ?? pick.line?.kind}
      data-hidden={shown === null ? 'true' : 'false'}
      data-dec={dec}
      data-future={forecast ? 'true' : undefined}
      title={eraTitle(spoken, forecast)}
      onClick={(e) => onEraClick(e, year, reduced)}
    >
      {shown === null ? <EmptyFrame /> : <EraPicBox shown={shown} prev={prev} pick={pick} art={art} />}
      {forecast ? (
        <span className="era__fc" data-testid="era-fc" aria-hidden="true">
          <Icon name="i-ahead" />
          {SCENE_TEXT.forecast}
        </span>
      ) : null}
      {visibleCaption === null ? null : (
        <span className="era__cap" data-testid="era-caption" aria-hidden="true">
          {visibleCaption}
        </span>
      )}
      <span className="sr-only">{eraAccessibleName(spoken, forecast)}</span>
    </a>
  );
}

// ---------------------------------------------------------------- 시대의 창 카드 (SPEC-016 H4)

/** 시대의 창 따로 칸 (SPEC-016 H4, 형진 님 2026-11-10): 집 그림 옆 작은 칸이던 시대의 창을 떼어 낸 카드. 그림이 칸 폭을 다 쓰고(PC 오른쪽 열 맨 위 — 식구 카드 위) 휴대폰은 집 그림 카드 아래 띠다.
 * 그림·캡션·「예측」 칩·링크(그해 기록으로)·빈 종이틀·가린 해 「가려 둔 장면」·접근 이름은 SPEC-013 그대로(`EraCell`). 제목은 기존 문구 「시대의 창」(`SCENE_TEXT.eraName`).
 * 집 그림의 접기(`settings.sceneFold`)는 이 카드에 걸리지 않는다(Q6) — 접어도 계속 보인다. */
export function EraCard({ game, gentle, scene, animate = true }: { game: SceneGame; gentle: boolean; scene: SceneArt; animate?: boolean }) {
  const reduced = useReducedMotion();
  const { era } = scene;
  const input = useMemo(() => sceneInputOf(game), [game.age, game.flags, game.assets, game.family, game.seed, game.peerSeed, game.birthReport, game.character, game.seen]);
  const calYear = input.state.calYear;
  const birthYear = calYear - input.state.me.age;
  const band = bandOfWealth(input.wealth);
  const pick = useMemo(() => eraOf(calYear, { regionKey: input.region, gentle, seed: input.seed, windows: era.windows, birthYear, band }), [calYear, birthYear, band, input.region, input.seed, gentle, era.windows]);
  return (
    <section className="card era-card" id="era-card" aria-labelledby="era-title" data-testid="era-card">
      <h2 id="era-title" className="card__title card__title--gap">
        {SCENE_TEXT.eraName}
      </h2>
      <EraCell pick={pick} year={calYear} art={era.art} animate={animate} reduced={reduced} />
    </section>
  );
}

// ---------------------------------------------------------------- 카드

export function SceneCard({ game, fold, onFold, scene, animate = true }: Props) {
  const reduced = useReducedMotion();
  const { art, status, retry } = scene;
  const input = useMemo(() => sceneInputOf(game), [game.age, game.flags, game.assets, game.family, game.seed, game.peerSeed, game.birthReport, game.character, game.seen]);
  const spec = useMemo(() => sceneOf(input), [input]);
  const line = sceneLineOf(input);
  const petsText = scenePetsText(spec.pets);
  const { rows, more } = sceneRowsOf(input);
  const calYear = input.state.calYear;
  const swapKey = useMemo(() => sceneKey(spec), [spec]);
  const prevSpec = usePrevWhileSwapping<SceneSpec>(spec, swapKey, animate && !reduced && art !== null);
  const phrases = petPhrases(spec.pets);
  const labelledBy = `scene-year scene-line${petsText === '' ? '' : ' scene-pets'}`;

  const openFamily = (): void => {
    const h = document.getElementById('family-t');
    if (h === null) return;
    h.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    h.focus({ preventScroll: true });
  };

  return (
    <section className="card scene-card" aria-labelledby="scene-title" data-fold={fold ? 'true' : 'false'} data-scene-art={status} data-testid="family-scene">
      <h2 id="scene-title" className="sr-only">
        {SCENE_TEXT.cardTitle}
      </h2>
      <div className="scene" id="scene-pic" data-testid="scene-pic">
        <div className="scene__house" data-testid="scene-house">
          {art !== null ? (
            <>
              <SceneSvg spec={spec} art={art} inst="scene" labelledBy={labelledBy} />
              {prevSpec !== null ? <SceneSvg spec={prevSpec} art={art} inst="scene-prev" decorative className="scene__svg scene__svg--prev" /> : null}
            </>
          ) : (
            <div className="scene__svg scene__ph" data-testid="scene-placeholder" role="img" aria-labelledby={labelledBy} />
          )}
          <p className="scene__year" id="scene-year">
            <time dateTime={String(calYear)}>{SCENE_TEXT.year(calYear)}</time>
          </p>
        </div>
      </div>
      {status === 'failed' && !fold ? (
        <p className="scene__note" role="status" data-testid="scene-art-failed">
          <span>{SCENE_TEXT.artFailed}</span>{' '}
          <button type="button" className="btn btn--ghost btn--sm" onClick={retry} data-testid="scene-art-retry">
            {SCENE_TEXT.artRetry}
          </button>
        </p>
      ) : null}
      <p className="scene__line" id="scene-line" data-testid="scene-line">
        <FitList items={line.split(' · ')} />
      </p>
      {petsText === '' ? null : (
        <p className="sr-only" id="scene-pets" data-testid="scene-pets">
          {petsText}
        </p>
      )}
      <div className="scene__row">
        <details className="scene__more" id="scene-more" data-testid="scene-more">
          <summary>{SCENE_TEXT.more}</summary>
          <ul className="scene__people" data-testid="scene-people">
            {rows.map((r, i) => (
              <li key={i} data-self={r.self ? 'true' : undefined}>
                <FitPair a={r.label} b={ageText(r.age)} />
              </li>
            ))}
            {more > 0 ? <li>{SCENE_TEXT.moreOthers(more)}</li> : null}
            {phrases.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="scene__open">
            <button type="button" className="btn btn--ghost btn--sm" onClick={openFamily} data-testid="scene-open-family">
              {SCENE_TEXT.openFamily}
            </button>
          </p>
        </details>
        <button type="button" className="btn btn--ghost btn--sm scene__fold" aria-expanded={!fold} aria-controls="scene-pic" onClick={() => onFold(!fold)} data-testid="scene-fold">
          {fold ? SCENE_TEXT.unfold : SCENE_TEXT.fold}
        </button>
      </div>
    </section>
  );
}
