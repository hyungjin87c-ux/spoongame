import { useState } from 'react';
import { ageText } from '../../core/format';
import { useAgeView } from '../ageView';
import type { EraRow } from '../../core/eraWindow';
import { VEIL_TEXT, veilButtonLabel } from '../../data/gentleText';
import { SCENE_TEXT, foresightButtonName, foresightLines, forecastReadName } from '../../data/sceneText';
import { Icon } from '../Brand';
import { FitPair } from '../FitPair';

/**
 * 인생 기록의 「시대의 창」 줄 (SPEC-009 FM5·FM2d, `docs/design/family-scene.md` 5-4절): 연표 줄 문법(`.log__row--tl`)의 다섯째 종류 `data-tl="era"`.
 *  - **저장하지 않는 파생 줄**이다(A-12): 인생 기록을 그릴 때 해마다 `eraOf`로 만든다. 판 길이 모델·`yearLineCount`·저장 크기·`history` 상한에 닿지 않는다.
 *  - 세 겹으로 다른 줄과 갈린다(색에만 의존하지 않는다): 새 색 토큰 `--c-era`(오디색) · 왼쪽 5px **겹선** · 표지 글자 「시대의 창」 + 창 아이콘 `#i-era`.
 *  - **낭독·미읽음에서 뺀다**(FM5b R-547): 줄 목록은 `aria-live="polite"` 영역인데, 늦게 도착한 10년 덩어리가 과거 해의 시대 줄 수십 개를 한꺼번에 끼워도 읽히지 않게 이 줄에 `aria-live="off"`를 둔다(줄은 탐색하면 읽힌다).
 *    「새 기록 N개」 수(`addedAbove`)와 읽던 자리 보존(`LogList`)도 이 줄의 끼어듦을 따로 다룬다.
 *  - 시대의 창 칸을 누르면 이 줄로 온다 — `id="log-y<연도>"`, `tabindex="-1"`(초점을 받는다), 잠깐 강조(`data-flash`). 줄의 id는 한 문서 안에서 유일하다.
 *  - **「예측」 칩 (SPEC-010 FU3)**: 2027년부터의 줄(`row.forecast`)은 표지 오른쪽에 칩(색 오디 + 글자 「예측」 + 아이콘 `#i-ahead`)과 근거 종류 글자(공식 전망 바탕·전문가 전망 바탕·가상 시나리오)가 붙는다. 칩은 해로 정하고, 가려진 줄에서도 가리지 않는다.
 *    칩 글자는 시각용(`aria-hidden`)이고 읽기 이름 「예측, <근거 종류>.」는 근거 종류 글자(단추의 접근 이름 또는 숨은 글)가 맡는다. 줄이 길어지거나 글자가 커지면 칩이 다음 줄로 내려가고 가로 넘침은 0이다.
 *  - **예측 근거 보기 (FU11)**: 장면에 근거 글(`row.foresight`)이 있으면 근거 종류 글자가 단추가 되어 문장 아래 접이식 칸을 연다(기본 닫힘, 펼침 상태는 저장하지 않는다 — 줄이 바뀌면 닫힌다).
 *    글(사람 · 직함 · 자료 · 연도: 자기 말 요약)은 10년 덩어리에서 오고 사람·회사 이름은 이 칸에만 있다. 가려진 줄은 가림을 펼치기 전에는 근거 단추도 내지 않는다(근거가 가린 장면의 내용을 말하지 않게).
 *    근거 글이 없는 수저별 「먼저」 줄(U12·U20)의 칸은 소개 문장 없이 「수저별 차이는 게임의 설정입니다.」 한 줄만 있다(`foresight.notes`가 빈 목록 + `byBand`, 마스터 2026-11-04).
 *  - **두 문장 줄 (SPEC-013 T3 4)**: 첫 문장(사회 사실 한 줄) 뒤에 둘째 문장(★ 사건만, 고른 수저 구간의 것 — `row.second`)이 같은 줄에 이어진다(`.log__second`, 보조 글자). 줄에 캡션을 다시 쓰지 않는다. 사건이 있던 해에만 줄이 있다.
 *  - 무거운 장면(`veiled`: 「무거운 장면 가리기」가 켜져 있고 재난·참상에 가까운 장면)은 기존 가리기 부품과 같은 모양 — 안내 + 「펼쳐 보기」, 원문은 `hidden`. 표지와 겹선은 가리지 않는다.
 */

/** 칩 + 근거 종류 글자 (+ 근거 보기 단추) — 표지와 같은 줄(`.log__tlrow`)에 선다 */
function ForecastMark({ row, whyOpen, onWhy, canWhy, whyId }: { row: EraRow; whyOpen: boolean; onWhy: () => void; canWhy: boolean; whyId: string }) {
  const basis = row.basis;
  return (
    <>
      <span className="chip--fc" data-testid="chip-fc" aria-hidden="true">
        <Icon name="i-ahead" />
        {SCENE_TEXT.forecast}
      </span>
      {basis === undefined ? (
        <span className="sr-only">{forecastReadName(undefined)}</span>
      ) : canWhy ? (
        <button type="button" className="log__basis log__basis--btn" aria-expanded={whyOpen} aria-controls={whyId} aria-label={foresightButtonName(basis)} data-testid="why-btn" onClick={onWhy}>
          {SCENE_TEXT.forecastBasis[basis]}
        </button>
      ) : (
        <>
          <span className="log__basis" data-testid="chip-basis" aria-hidden="true">
            {SCENE_TEXT.forecastBasis[basis]}
          </span>
          <span className="sr-only">{forecastReadName(basis)}</span>
        </>
      )}
    </>
  );
}

/** 둘째 문장(SPEC-013 T3 4) — 첫 문장 뒤에 같은 줄로 이어지는 보조 글자(색만 한 단 옅게, 크기·굵기 같음 — 색에만 의존하지 않도록 첫 문장과의 사이에 한 칸). 없으면 아무것도 그리지 않는다 */
function SecondSentence({ second }: { second: string | undefined }) {
  if (second === undefined) return null;
  return (
    <>
      {' '}
      <span className="log__second" data-testid="log-second">
        {second}
      </span>
    </>
  );
}

export function EraLogRow({ row, open, onToggle }: { row: EraRow; open: boolean; onToggle: () => void }) {
  const view = useAgeView();
  const bodyId = `veil-era-${row.year}`;
  const whyId = `why-era-${row.year}`;
  const [whyOpen, setWhyOpen] = useState(false);
  // 근거 글이 있는 예측 줄만 단추가 된다. 가려진 줄은 가림을 펼친 뒤에만(근거가 가린 장면의 내용을 먼저 말하지 않게)
  const foresight = row.forecast && row.basis !== undefined ? row.foresight : undefined;
  const canWhy = foresight !== undefined && (!row.veiled || open);
  return (
    <li className="log__row log__row--tl" data-kind="timeline" data-tl="era" id={`log-y${row.year}`} tabIndex={-1} aria-live="off" data-veiled={row.veiled ? 'true' : undefined} data-testid="log-row-era">
      <span className="log__age">
        {ageText(row.age, view)}
        <small className="log__year">{row.year}</small>
      </span>
      <span className="log__text">
        {row.forecast ? (
          <span className="log__tlrow">
            <span className="log__tl">
              <Icon name="i-era" />
              <span>{SCENE_TEXT.eraMark}</span>
            </span>
            <ForecastMark row={row} whyOpen={whyOpen && canWhy} onWhy={() => setWhyOpen((v) => !v)} canWhy={canWhy} whyId={whyId} />
          </span>
        ) : (
          <span className="log__tl">
            <Icon name="i-era" />
            <span>{SCENE_TEXT.eraMark}</span>
          </span>
        )}
        {row.veiled ? (
          <>
            <span className="veil__line">
              <span className="veil__lead" data-testid="veil-lead">
                <FitPair a={VEIL_TEXT.rowLead} b={SCENE_TEXT.eraVeilKind} hideSeparator />
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm veil__btn"
                aria-expanded={open}
                aria-controls={bodyId}
                aria-label={veilButtonLabel(open, row.age, SCENE_TEXT.eraVeilKind, view)}
                data-testid="veil-btn"
                onClick={onToggle}
              >
                {open ? VEIL_TEXT.close : VEIL_TEXT.open} <span className="veil__mark" aria-hidden="true">{open ? VEIL_TEXT.markClose : VEIL_TEXT.markOpen}</span>
              </button>
            </span>
            <span className="veil__body log__sent" id={bodyId} hidden={!open} data-testid="veil-body">
              {row.line}
              <SecondSentence second={row.second} />
            </span>
          </>
        ) : (
          <span className="log__sent">
            {row.line}
            <SecondSentence second={row.second} />
          </span>
        )}
        {foresight === undefined ? null : (
          <div className="log__why" id={whyId} hidden={!(whyOpen && canWhy)} data-testid="why-body">
            {foresight.notes.length > 0 ? <p className="log__why-intro">{SCENE_TEXT.foresightIntro}</p> : null}
            <ul>
              {foresightLines(foresight).map((text, i) => {
                const note = foresight.notes[i];
                return (
                  <li key={i} data-counter={note?.counter === true ? 'true' : undefined}>
                    {note?.counter === true ? <strong className="log__why-tag">{SCENE_TEXT.foresightCounter}</strong> : null}
                    {note?.counter === true ? ' ' : null}
                    {text}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </span>
    </li>
  );
}
