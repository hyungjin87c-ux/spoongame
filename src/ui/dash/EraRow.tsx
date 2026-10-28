import type { EraRow } from '../../core/eraWindow';
import { DASH_TEXT } from '../../data/dashText';
import { VEIL_TEXT, veilButtonLabel } from '../../data/gentleText';
import { SCENE_TEXT } from '../../data/sceneText';
import { Icon } from '../Brand';
import { FitPair } from '../FitPair';

/**
 * 인생 기록의 「시대의 창」 줄 (SPEC-009 FM5·FM2d, `docs/design/family-scene.md` 5-4절): 연표 줄 문법(`.log__row--tl`)의 다섯째 종류 `data-tl="era"`.
 *  - **저장하지 않는 파생 줄**이다(A-12): 인생 기록을 그릴 때 해마다 `eraOf`로 만든다. 판 길이 모델·`yearLineCount`·저장 크기·`history` 상한에 닿지 않는다.
 *  - 세 겹으로 다른 줄과 갈린다(색에만 의존하지 않는다): 새 색 토큰 `--c-era`(오디색) · 왼쪽 5px **겹선** · 표지 글자 「시대의 창」 + 창 아이콘 `#i-era`.
 *  - 시대의 창 칸을 누르면 이 줄로 온다 — `id="log-y<연도>"`, `tabindex="-1"`(초점을 받는다), 잠깐 강조(`data-flash`). 줄의 id는 한 문서 안에서 유일하다.
 *  - 무거운 장면(`veiled`: 「무거운 장면 가리기」가 켜져 있고 재난·참상에 가까운 장면)은 기존 가리기 부품과 같은 모양 — 안내 + 「펼쳐 보기」, 원문은 `hidden`. 표지와 겹선은 가리지 않는다.
 */

export function EraLogRow({ row, open, onToggle }: { row: EraRow; open: boolean; onToggle: () => void }) {
  const bodyId = `veil-era-${row.year}`;
  return (
    <li className="log__row log__row--tl" data-kind="timeline" data-tl="era" id={`log-y${row.year}`} tabIndex={-1} data-veiled={row.veiled ? 'true' : undefined} data-testid="log-row-era">
      <span className="log__age">
        {row.age}
        {DASH_TEXT.ageSuffix}
        <small className="log__year">{row.year}</small>
      </span>
      <span className="log__text">
        <span className="log__tl">
          <Icon name="i-era" />
          <span>{SCENE_TEXT.eraMark}</span>
        </span>
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
                aria-label={veilButtonLabel(open, row.age, SCENE_TEXT.eraVeilKind)}
                data-testid="veil-btn"
                onClick={onToggle}
              >
                {open ? VEIL_TEXT.close : VEIL_TEXT.open} <span className="veil__mark" aria-hidden="true">{open ? VEIL_TEXT.markClose : VEIL_TEXT.markOpen}</span>
              </button>
            </span>
            <span className="veil__body log__sent" id={bodyId} hidden={!open} data-testid="veil-body">
              {row.line}
            </span>
          </>
        ) : (
          <span className="log__sent">{row.line}</span>
        )}
      </span>
    </li>
  );
}
