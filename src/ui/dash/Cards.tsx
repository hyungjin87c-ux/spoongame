import { wealthMixtureOfGame } from '../../core/birthProfile';
import { Fragment, useMemo, useState } from 'react';
import { looksStanding } from '../../core/birth';
import { formatMan } from '../../core/format';
import { reportPlaceLabel } from '../../core/birthReport';
import { startBandOf } from '../../core/ending';
import { familyCardOf, type CardRow } from '../../core/familyCard';
import { currentHomeOf, sceneInputOf } from '../../core/scene';
import { peersNow } from '../../core/peerNow';
import { educationLabel } from '../../core/profile';
import type { Character, BirthReport, GameState, ProfileId } from '../../core/types';
import { BIRTH_TEXT, genderLabel, yearMonthText } from '../../data/birthReportText';
import { standingLabel } from '../../data/birthText';
import { ASSETS_AMOUNTS_SHIPPED, DASH_TEXT, STATUS_LABEL, STATUS_ORDER, amountsConverted, statusHelpText } from '../../data/dashText';
import { bandLabel } from '../../data/endingText';
import { FAMILY_CARD_TEXT } from '../../data/familyCardText';
import { placeLabel, regionLabelAt } from '../../data/regionNames';
import { Icon } from '../Brand';
import { Face } from '../Face';
import { FitList, FitPair } from '../FitPair';
import { GradeChip, GradeLine } from '../Grade';
import { Glue } from '../Glue';

/**
 * 대시보드의 카드들 (SPEC-003 DB9~DB13, VP4): 프로필 · 상태 · 자산 현황 · 식구 · 같은 해 태어난 사람들. 계산은 모두 core의 순수 함수(profile·family·peerNow)이고 여기서는 결과를 문구로 그리기만 한다.
 * 클래스·구조는 시안 docs/design/mockups/dashboard-adult.html·dashboard-infant.html과 같다. 문구는 data/dashText.ts·familyText.ts(copy.md 기준).
 */

/** 인생 단계(life)의 게임 상태 — 출생 결과가 모두 있다 */
export type LifeGame = GameState & { character: Character; generation: ProfileId; birthReport: BirthReport; peerSeed: number };

// ---------- 프로필 (DB9) ----------

export function ProfileCard({ game }: { game: LifeGame }) {
  const c = game.character;
  const home = currentHomeOf(sceneInputOf(game));
  return (
    <section className="card profile" aria-label={DASH_TEXT.profileLabel} data-testid="profile-card">
      <div className="profile__top">
        <Face age={game.age} gender={c.gender} looks={c.looks} large />
        <div>
          <p className="profile__name" data-testid="profile-name">
            {c.name}
          </p>
          <p className="t-sm t-muted" data-testid="profile-gender">
            {genderLabel(c.gender)}
          </p>
        </div>
      </div>
      <dl className="facts">
        <dt>{DASH_TEXT.profileBorn}</dt>
        <dd data-testid="profile-born">{yearMonthText(c.birthYear, game.birthReport.month)}</dd>
        <dt>{DASH_TEXT.profileLive}</dt>
        <dd data-testid="profile-place">{reportPlaceLabel(game.birthReport, game.character.birthYear)}</dd>
        {/* 「지금 사는 곳」(FC8): 그림·아래 한 줄과 같은 입력에서 만든 「사는 곳 · 집 낱말」 — 시도는 평생 출생 시도다 */}
        <dt>{DASH_TEXT.profileNow}</dt>
        <dd data-testid="profile-now">
          <FitPair a={home.place} b={home.word} />
        </dd>
        <dt>{DASH_TEXT.profileHome}</dt>
        <dd data-testid="profile-home">
          {/* 수저 칩 + 구간: 룰렛·출생신고와 같은 함수 한 곳의 출력(bandLabel(startBandOf)) — 같은 인물의 구간이 화면마다 달라지지 않는다(R-170) */}
          <GradeLine grade={c.parentWealth} range={`(${bandLabel(startBandOf(wealthMixtureOfGame(game), c.parentWealth))})`} />
        </dd>
        <dt>{DASH_TEXT.profileEdu}</dt>
        <dd data-testid="profile-edu">{educationLabel(game.age, game.flags)}</dd>
        <dt>{DASH_TEXT.profileLooks}</dt>
        <dd data-testid="profile-looks">
          {/* 외모는 점수가 아니라 「상위/하위 약 N%」 한 가지로만 (R-135) */}
          <small>{BIRTH_TEXT.looksSub}</small> {standingLabel(looksStanding(c.looks))}
        </dd>
      </dl>
    </section>
  );
}

// ---------- 상태 (DB10) ----------

export function StatusCard({ stats, generation }: { stats: GameState['stats']; generation: ProfileId }) {
  return (
    <section className="card stack stack--sm" aria-label={DASH_TEXT.statusTitle} data-testid="stats">
      <div className="card__head card__head--flush">
        <h2 className="card__title">{DASH_TEXT.statusTitle}</h2>
      </div>
      {STATUS_ORDER.map(({ key, icon, tone }) => (
        <div className={`meter meter--${tone}`} key={key} data-stat={key}>
          <span className="meter__label">
            <Icon name={icon} />
            {STATUS_LABEL[key]}
          </span>
          <div className="meter__track" role="meter" aria-label={STATUS_LABEL[key]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats[key]}>
            <div className="meter__fill" style={{ width: `${stats[key]}%` }} />
          </div>
          <span className="meter__value" data-testid={`stat-${key}`}>
            {stats[key]}
          </span>
        </div>
      ))}
      <details className="disclosure">
        <summary>{DASH_TEXT.statusHelpSummary}</summary>
        <p>
          <Glue text={statusHelpText(ASSETS_AMOUNTS_SHIPPED, generation)} />
        </p>
      </details>
    </section>
  );
}

// ---------- 자산 현황 (DB11, M5) ----------

/**
 * 자산 현황 카드 (SPEC-003 DB11·M5 — 문구·DOM은 docs/design/copy.md 4-5절, CSS는 styles/dash.css 「자산 현황」). 20세 미만은 안내 한 줄만(집안 살림 누적값은 화면에 없다).
 * 20세부터 순자산·연 소득·부채를 `formatMan`(= `formatWon`)으로 보인다. `.neg`(▼ 접두)는 쓰지 않는다 — ▼는 영향 줄의 「줄어듦」 기호라 수준(음수)에 쓰면 변화로 읽힌다(D-32).
 * 세대 판은 카드 머리에 「지금 가치로 환산」 태그가 있고 금액 묶음이 `aria-describedby`로 그것을 가리킨다. 시험 전용 R1 프로필(지금 세상)은 태그가 없다(기준은 상태 도움말이 밝힌다).
 */
export function AssetsCard({ age, assets, generation }: { age: number; assets: GameState['assets']; generation: ProfileId }) {
  if (age < 20 || assets === null) {
    return (
      <section className="card" aria-label={DASH_TEXT.assetsTitle} data-testid="assets-card">
        <div className="card__head">
          <h2 className="card__title">{DASH_TEXT.assetsTitle}</h2>
        </div>
        <p className="t-sm t-muted" data-testid="assets-note">
          {DASH_TEXT.assetsYoung}
        </p>
      </section>
    );
  }
  const converted = amountsConverted(generation);
  return (
    <section className="card card--assets" aria-labelledby="assets-title" data-testid="assets-card">
      <div className="card__head">
        <h2 id="assets-title" className="card__title">
          {DASH_TEXT.assetsTitle}
        </h2>
        {converted ? (
          <span className="tag" id="assets-basis" data-testid="assets-basis">
            {DASH_TEXT.assetsBasis}
          </span>
        ) : null}
      </div>
      <dl className="assets" aria-describedby={converted ? 'assets-basis' : undefined} data-testid="assets">
        <div className="assets__row">
          <dt>{DASH_TEXT.assetsNet}</dt>
          <dd className="nowrap" data-testid="assets-net">
            {formatMan(assets.net)}
          </dd>
        </div>
        <div className="assets__row">
          <dt>{DASH_TEXT.assetsIncome}</dt>
          <dd className="nowrap" data-testid="assets-income">
            {formatMan(assets.income)}
          </dd>
        </div>
        <div className="assets__row">
          <dt>{DASH_TEXT.assetsDebt}</dt>
          <dd className="nowrap" data-testid="assets-debt">
            {formatMan(assets.debt)}
          </dd>
        </div>
      </dl>
      <p className="assets__note" data-testid="assets-note">
        {DASH_TEXT.assetsNote}
      </p>
    </section>
  );
}

// ---------- 식구 (DB13 → SPEC-009 FC1~FC10) ----------

/** 기본 화면에 보이는 사람 줄 수 상한 (FC1) — 떠난 가족은 항상 보이고(접지 않는다), 나머지가 남은 자리를 채운다. 더 있으면 「더 보기」 */
export const FAMILY_ROWS_VISIBLE = 12;

const ROW_TESTID: Readonly<Record<CardRow['role'], string>> = {
  mother: 'family-mother',
  father: 'family-father',
  grandparent: 'family-grandparent',
  sibling: 'family-sibling',
  spouse: 'family-spouse',
  child: 'family-child',
  friend: 'family-friend',
};

/** 사람 한 줄: 호칭(dt) — 이름 · 나이(dd) 아래에 사이 · 직업 · (따로 삶). 떠난 사람은 이름 아래에 「N세에 세상을 떠남」(글자로 — 색·취소선에 기대지 않는다, FC4) */
function PersonRow({ r, expanded }: { r: CardRow; expanded: boolean }) {
  const gone = r.state === 'gone';
  const items = gone
    ? []
    : [r.closenessText, r.jobText, r.statusText, r.state === 'apart' && r.role !== 'friend' ? FAMILY_CARD_TEXT.apart : null].filter((x): x is string => x !== null);
  return (
    <>
      <dt>{r.label}</dt>
      <dd data-testid={ROW_TESTID[r.role]} data-state={r.state}>
        <span className="family-who">{gone ? r.name : `${r.name} ${r.age}${DASH_TEXT.ageSuffix}`}</span>
        {gone ? (
          <small>
            <FitList flow items={[r.goneText ?? FAMILY_CARD_TEXT.goneAt(r.age), ...(expanded && r.goneMyText !== undefined ? [r.goneMyText] : [])]} />
          </small>
        ) : (
          <small>
            <FitList flow items={items} />
          </small>
        )}
      </dd>
    </>
  );
}

export function FamilyCard({ game }: { game: LifeGame }) {
  const { age, flags, seen, assets, family, character, birthReport, peerSeed, seed } = game;
  const card = useMemo(() => familyCardOf({ age, flags, seen, assets, family, character, birthReport, peerSeed, seed }), [age, flags, seen, assets, family, character, birthReport, peerSeed, seed]);
  const [expanded, setExpanded] = useState(false);
  const living = [...card.together, ...card.apart, ...card.adult, ...card.friends];
  const budget = Math.max(4, FAMILY_ROWS_VISIBLE - card.gone.length);
  const shown = expanded ? living : living.slice(0, budget);
  const hidden = living.length - shown.length;
  const hasMore = living.length > budget || card.gone.some((g) => g.goneMyText !== undefined);
  return (
    <section className="card family" aria-labelledby="family-t" data-testid="family-card">
      <h2 id="family-t" className="card__title card__title--gap" tabIndex={-1}>
        {DASH_TEXT.familyTitle}
      </h2>
      <dl className="family-list" data-testid="family-list">
        {shown.map((r) => (
          <PersonRow key={r.key} r={r} expanded={expanded} />
        ))}
      </dl>
      {card.pets.length === 0 ? null : (
        <>
          <h3 className="family-sub">{FAMILY_CARD_TEXT.petsHeading}</h3>
          <dl className="family-list" data-testid="family-pets">
            {card.pets.map((p) => (
              <Fragment key={p.name}>
                <dt>{p.speciesText}</dt>
                <dd data-testid="family-pet" data-state={p.status}>
                  <span className="family-who">{p.name}</span>
                  <small>{p.statusText}</small>
                </dd>
              </Fragment>
            ))}
          </dl>
        </>
      )}
      {card.things.length === 0 ? null : (
        <>
          <h3 className="family-sub">{FAMILY_CARD_TEXT.thingsHeading}</h3>
          {/* 항목은 일반 명사 여덟 안팎 — 한 줄에 못 담으면 항목마다 줄이 되는 FitList 대신 쉼표로 이어 자연스럽게 줄바꿈한다(항목 안은 끊지 않는다). 가운뎃점은 줄 끝에 혼자 남아 쓰지 않는다 */}
          <p className="family-things" data-testid="family-things">
            {card.things.map((t, i) => (
              <Fragment key={t}>
                {i === 0 ? null : ', '}
                <span className="nowrap">{t}</span>
              </Fragment>
            ))}
          </p>
        </>
      )}
      {card.gone.length === 0 ? null : (
        <>
          <h3 className="family-sub">{FAMILY_CARD_TEXT.goneHeading}</h3>
          <dl className="family-list family-list--gone" data-testid="family-gone">
            {card.gone.map((r) => (
              <PersonRow key={r.key} r={r} expanded={expanded} />
            ))}
          </dl>
        </>
      )}
      {hasMore ? (
        <button type="button" className="btn btn--ghost btn--sm family-more" aria-expanded={expanded} data-testid="family-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? FAMILY_CARD_TEXT.less : FAMILY_CARD_TEXT.more}
          {expanded || hidden === 0 ? null : <span className="sr-only"> ({FAMILY_CARD_TEXT.rowsLabel(hidden)})</span>}
        </button>
      ) : null}
      <details className="disclosure family-basis" data-testid="family-basis">
        <summary>{FAMILY_CARD_TEXT.basisSummary}</summary>
        <p>{FAMILY_CARD_TEXT.basisIntro}</p>
        <ul>
          {card.basis.map((b) => (
            <li key={b.id}>
              <strong>{b.kind}</strong> {b.note}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

// ---------- 같은 해 태어난 사람들 — 요즘 모습 (VP4) ----------

export function PeersNowCard({ game }: { game: LifeGame }) {
  // 또래의 요즘 모습은 0세부터 한 해씩 따라가 정하므로(core/peerNow.ts#peerStatusSeries) 나이·또래 시드가 같으면 다시 계산하지 않는다 — 진행률 바가 화면을 다시 그릴 때마다 120걸음 × 4명을 돌지 않게
  const { age, peerSeed, character, birthReport } = game;
  const peers = useMemo(() => peersNow({ age, peerSeed, character, birthReport }), [age, peerSeed, character, birthReport]);
  return (
    <section className="card peers-now" aria-labelledby="peers-now-t" data-testid="peers-now-card">
      <div className="card__head card__head--tight">
        <h2 id="peers-now-t" className="card__title">
          {DASH_TEXT.peersTitle}
        </h2>
        <span className="card__sub">{DASH_TEXT.peersSub}</span>
      </div>
      <ul className="people" data-testid="peers-now">
        {peers.map((p) => (
          <li key={p.name} data-testid="peer-now">
            <div className="people__who">
              <div className="people__line">
                <span className="name" data-testid="peer-now-name">
                  {p.name}
                </span>{' '}
                <span className="sub">{genderLabel(p.gender)}</span>
              </div>
              <div className="sub">{p.sigungu !== undefined && p.sigunguSido !== undefined ? placeLabel({ region: p.region, sigunguSido: p.sigunguSido, sigungu: p.sigungu }) : regionLabelAt(p.region, game.character.birthYear)}</div>
            </div>
            {/* 수저 칩: 출생신고 또래 목록과 같은 표기 — 「수저 → 지금의 삶」 연결이 읽히게 (M4 착수 결정 1, 등급명 허용 화면에 VP4 추가) */}
            <GradeChip grade={p.wealth} />
            <span className="people__now" data-testid="peer-now-label">
              {p.label}
            </span>
          </li>
        ))}
      </ul>
      <p className="t-xs t-faint card__note">{DASH_TEXT.peersNote}</p>
    </section>
  );
}
