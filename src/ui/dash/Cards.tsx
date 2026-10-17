import { useMemo } from 'react';
import { looksStanding } from '../../core/birth';
import { reportPlaceLabel } from '../../core/birthReport';
import { startBandOf } from '../../core/ending';
import { familyOf, type ParentView, type SiblingView } from '../../core/family';
import { peersNow } from '../../core/peerNow';
import { educationLabel } from '../../core/profile';
import type { Character, BirthReport, Era, GameState } from '../../core/types';
import { OCCUPATION_LABEL } from '../../data/birthReportTable';
import { BIRTH_TEXT, genderLabel, yearMonthText } from '../../data/birthReportText';
import { standingLabel } from '../../data/birthText';
import { DASH_TEXT, STATUS_LABEL, STATUS_ORDER } from '../../data/dashText';
import { bandLabel } from '../../data/endingText';
import { CHILD_LABEL, GONE_LABEL, PARENT_STATE_LABEL, SPOUSE_LABEL, siblingGapText, siblingLabel } from '../../data/familyText';
import { placeLabel } from '../../data/regionNames';
import { Icon } from '../Brand';
import { Face } from '../Face';
import { FitPair } from '../FitPair';
import { GradeChip, GradeLine } from '../Grade';
import { Glue } from '../Glue';

/**
 * 대시보드의 카드들 (SPEC-003 DB9~DB13, VP4): 프로필 · 상태 · 자산 현황 · 식구 · 같은 해 태어난 사람들. 계산은 모두 core의 순수 함수(profile·family·peerNow)이고 여기서는 결과를 문구로 그리기만 한다.
 * 클래스·구조는 시안 docs/design/mockups/dashboard-adult.html·dashboard-infant.html과 같다. 문구는 data/dashText.ts·familyText.ts(copy.md 기준).
 */

/** 인생 단계(life)의 게임 상태 — 출생 결과가 모두 있다 */
export type LifeGame = GameState & { character: Character; era: Era; birthReport: BirthReport; peerSeed: number };

// ---------- 프로필 (DB9) ----------

export function ProfileCard({ game }: { game: LifeGame }) {
  const c = game.character;
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
        <dd data-testid="profile-place">{reportPlaceLabel(game.birthReport, game.era)}</dd>
        <dt>{DASH_TEXT.profileHome}</dt>
        <dd data-testid="profile-home">
          {/* 수저 칩 + 구간: 룰렛·출생신고와 같은 함수 한 곳의 출력(bandLabel(startBandOf)) — 같은 인물의 구간이 화면마다 달라지지 않는다(R-170) */}
          <GradeLine grade={c.parentWealth} range={`(${bandLabel(startBandOf(game.era, c.parentWealth))})`} />
        </dd>
        <dt>{DASH_TEXT.profileEdu}</dt>
        <dd data-testid="profile-edu">{educationLabel(game.age, game.flags)}</dd>
        <dt>{DASH_TEXT.profileLooks}</dt>
        <dd data-testid="profile-looks">
          {/* 외모는 점수가 아니라 「상위/하위 약 N%」 한 가지로만 (R-135) */}
          {standingLabel(looksStanding(c.looks))} <small>{BIRTH_TEXT.looksSub}</small>
        </dd>
      </dl>
    </section>
  );
}

// ---------- 상태 (DB10) ----------

export function StatusCard({ stats }: { stats: GameState['stats'] }) {
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
          <Glue text={DASH_TEXT.statusHelp} />
        </p>
      </details>
    </section>
  );
}

// ---------- 자산 현황 (DB11 — M4는 자리만) ----------

export function AssetsCard({ age }: { age: number }) {
  return (
    <section className="card" aria-label={DASH_TEXT.assetsTitle} data-testid="assets-card">
      <div className="card__head">
        <h2 className="card__title">{DASH_TEXT.assetsTitle}</h2>
      </div>
      <p className="t-sm t-muted" data-testid="assets-note">
        {age < 20 ? DASH_TEXT.assetsYoung : DASH_TEXT.assetsSoon}
      </p>
    </section>
  );
}

// ---------- 식구 (DB13) ----------

function ParentRow({ label, p }: { label: string; p: ParentView }) {
  const gone = p.state === 'gone';
  return (
    <>
      <dt>{label}</dt>
      <dd data-testid={`family-${label === DASH_TEXT.familyMother ? 'mother' : 'father'}`}>
        {gone ? GONE_LABEL : `${p.age}${DASH_TEXT.ageSuffix}`}
        <small>{gone ? OCCUPATION_LABEL[p.job] : <FitPair a={OCCUPATION_LABEL[p.job]} b={PARENT_STATE_LABEL[p.state]} />}</small>
      </dd>
    </>
  );
}

function SiblingRow({ s, player }: { s: SiblingView; player: Character['gender'] }) {
  return (
    <dd data-testid="family-sibling">
      {siblingLabel(player, s.kind)} {s.gone ? GONE_LABEL : `${s.age}${DASH_TEXT.ageSuffix}`}
      {s.gone ? null : <small>{siblingGapText(s.gap, s.older)}</small>}
    </dd>
  );
}

export function FamilyCard({ game }: { game: LifeGame }) {
  const f = familyOf(game);
  return (
    <section className="card family" aria-labelledby="family-t" data-testid="family-card">
      <h2 id="family-t" className="card__title card__title--gap">
        {DASH_TEXT.familyTitle}
      </h2>
      <dl className="family-list">
        <ParentRow label={DASH_TEXT.familyMother} p={f.mother} />
        <ParentRow label={DASH_TEXT.familyFather} p={f.father} />
        <dt>{DASH_TEXT.familySiblings}</dt>
        {f.siblings.length === 0 ? (
          <dd data-testid="family-sibling">{DASH_TEXT.familyNone}</dd>
        ) : (
          f.siblings.map((s, i) => <SiblingRow key={i} s={s} player={game.character.gender} />)
        )}
        {f.spouse === null ? null : (
          <>
            <dt>{DASH_TEXT.familySpouse}</dt>
            <dd data-testid="family-spouse">{SPOUSE_LABEL[f.spouse]}</dd>
          </>
        )}
        {f.child === null ? null : (
          <>
            <dt>{DASH_TEXT.familyChild}</dt>
            <dd data-testid="family-child">{CHILD_LABEL[f.child]}</dd>
          </>
        )}
      </dl>
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
              <div className="sub">{placeLabel(p, game.era)}</div>
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
