import { describe, expect, it } from 'vitest';
import { decideLifeFocus, lostFocusPlace, type FocusPlace, type LifeFocusAction, type LifeFocusMoment } from '../src/ui/useFocus';

/**
 * R-036·R-048 인생 화면 포커스 규칙의 판단 부분(순수 함수) — M7b에서 8순간 × 자동 모드 2 × 위치 3 = 48칸이 됐다(D-52). SPEC-005 PD5-a가 아홉째 순간 `delegatedCard`(부모님이 정한·흘러간 카드가 뜸 — 포커스 이동 없음)를 더해 9 × 2 × 3 = 54칸이었고, SPEC-005 r4 UX12(QI12)가 열째 순간 `autoTurnedOn`(시트의 「이후 결정을 자동으로 고르게 하기」 — 같은 카드가 인라인으로 바뀜, 선택지 제목으로)을 더해 10 × 2 × 3 = 60칸이다.
 * 실제 포커스 이동(DOM)은 e2e/life-focus.spec.ts·e2e/m7b-decision.spec.ts가 본다. 표는 사람이 직접 적은 기대값이다 (구현이 쓰는 상수·함수를 다시 계산하지 않는다).
 *
 * M7b가 바꾼 것 (마스터 확인 D-52): 수동 모드에서는 카드가 **모달 시트**이고 바깥이 `inert`다. 시트가 뜨는 순간 컨트롤에 있던 포커스는 body로 떨어지므로 「컨트롤 안이면 포커스는 두고 알리기만」(R-036 규칙 2)은
 * 성립하지 않는다 → `choiceAppeared`·`autoTurnedOff`의 수동 × controls 칸이 `announce`에서 `choiceTitle`로 바뀌었다. 그리고 순간 둘이 늘었다: `cardCollapsed`(→ 「결정 다시 열기」)·`cardReopened`(→ 선택지 제목).
 */
const PLACES: FocusPlace[] = ['body', 'controls', 'other'];
const MOMENTS: LifeFocusMoment[] = ['enter', 'enterWithChoice', 'choiceAppeared', 'choiceAppearedBySkip', 'autoTurnedOff', 'choiceResolved', 'cardCollapsed', 'cardReopened', 'delegatedCard', 'autoTurnedOn'];

describe('decideLifeFocus (R-036, R-048, M7b D-52)', () => {
  it('화면이 처음 뜰 때: 선택지가 없으면 인생 화면 제목(R-030) — 포커스 위치·자동 모드와 무관', () => {
    for (const auto of [false, true]) for (const place of PLACES) expect(decideLifeFocus('enter', auto, place)).toBe('lifeTitle');
  });

  it('화면이 뜰 때 선택지가 이미 있으면(새로고침 복원): 수동 모드는 선택지 제목, 자동 모드는 인생 화면 제목', () => {
    for (const place of PLACES) {
      expect(decideLifeFocus('enterWithChoice', false, place)).toBe('choiceTitle');
      expect(decideLifeFocus('enterWithChoice', true, place)).toBe('lifeTitle');
    }
  });

  it('플레이 중 시간이 흘러 선택지가 뜰 때: 자동 모드(인라인 카드)는 어디에 있든 옮기지 않는다', () => {
    for (const place of PLACES) expect(decideLifeFocus('choiceAppeared', true, place)).toBe('none');
  });

  it('플레이 중 시간이 흘러 선택지가 뜰 때(수동): 포커스가 어디에 있든 — 컨트롤 안이어도 — 선택지 제목으로 간다. 모달 시트가 컨트롤을 inert로 만들어 「알리기만」 칸이 사라졌다 (D-52)', () => {
    for (const place of PLACES) expect(decideLifeFocus('choiceAppeared', false, place), place).toBe('choiceTitle');
  });

  it('사용자가 "다음 결정으로"를 눌러 선택지가 뜰 때: 포커스가 어디에 있든 선택지 제목으로 (R-036 4)', () => {
    for (const place of PLACES) expect(decideLifeFocus('choiceAppearedBySkip', false, place)).toBe('choiceTitle');
  });

  it('복원 경로(enterWithChoice)와 플레이 경로(choiceAppeared)는 같은 대상(선택지 제목)을 쓴다 — 수동 모드의 모든 위치에서', () => {
    for (const place of PLACES) expect(decideLifeFocus('enterWithChoice', false, place)).toBe(decideLifeFocus('choiceAppeared', false, place));
  });

  it('선택지가 대기 중인 채 자동 모드가 꺼질 때(R-048): 인라인 카드가 시트로 바뀌므로 어디에 있었든 선택지 제목으로. 자동 모드가 켜진 채로는 이 순간이 오지 않지만 오더라도 건드리지 않는다', () => {
    for (const place of PLACES) {
      expect(decideLifeFocus('autoTurnedOff', false, place), place).toBe('choiceTitle');
      expect(decideLifeFocus('autoTurnedOff', true, place)).toBe('none');
    }
  });

  it('선택지가 대기 중인 채 사용자가 시트의 「이후 결정을 자동으로 고르게 하기」로 자동 모드를 켜면(r4 UX12, autoTurnedOn): 같은 카드가 인라인으로 바뀌고 누른 버튼이 사라지므로 어느 위치든 선택지 제목으로 간다 — 자동 모드가 켜졌어도 사용자가 직접 눌렀다 (cardReopened와 같은 원칙)', () => {
    for (const auto of [false, true]) for (const place of PLACES) expect(decideLifeFocus('autoTurnedOn', auto, place), `${auto} ${place}`).toBe('choiceTitle');
  });

  it('선택지가 사라질 때: 포커스가 body로 떨어졌으면 — 자동·수동 모두 — 인생 화면 제목으로, 이미 다른 곳에 있으면 그대로 둔다 (R-393: 자동 모드 「다시 열기 → 자동 선택」 뒤 포커스 유실)', () => {
    for (const auto of [false, true]) {
      expect(decideLifeFocus('choiceResolved', auto, 'body'), `${auto} body`).toBe('lifeTitle');
      expect(decideLifeFocus('choiceResolved', auto, 'controls'), `${auto} controls`).toBe('none');
      expect(decideLifeFocus('choiceResolved', auto, 'other'), `${auto} other`).toBe('none');
    }
  });

  it('lostFocusPlace(R-393): body가 「잃은 포커스」인지 가른다 — 있던 요소가 사라져 body가 된 경우만 body, 처음부터 body였거나 요소가 그대로면 other, body가 아니면 그대로', () => {
    const gone = { isConnected: false };
    const still = { isConnected: true };
    expect(lostFocusPlace('body', gone)).toBe('body');
    expect(lostFocusPlace('body', still)).toBe('other'); // 포커스를 푼 것이지 요소가 사라진 것이 아니다
    expect(lostFocusPlace('body', null)).toBe('other'); // 처음부터 아무것도 누르지 않은 자동 진행 — 건드리지 않는다
    for (const place of ['controls', 'other'] as const) for (const el of [gone, still, null]) expect(lostFocusPlace(place, el)).toBe(place);
    // 결합: 사라진 요소 때문에 body가 된 경우만 인생 화면 제목으로 간다
    expect(decideLifeFocus('choiceResolved', true, lostFocusPlace('body', gone))).toBe('lifeTitle');
    expect(decideLifeFocus('choiceResolved', true, lostFocusPlace('body', null))).toBe('none');
  });

  it('카드를 접으면(cardCollapsed) 어느 모드·어느 위치든 접힌 띠의 「결정 다시 열기」로 간다 (U6(b)) — 자동 모드에서 접어도 같다', () => {
    for (const auto of [false, true]) for (const place of PLACES) expect(decideLifeFocus('cardCollapsed', auto, place), `${auto} ${place}`).toBe('foldOpen');
  });

  it('카드를 다시 열면(cardReopened) 어느 모드·어느 위치든 선택지 제목으로 간다 — 자동 모드여도 사용자가 직접 눌렀다 (choiceAppearedBySkip과 같은 원칙)', () => {
    for (const auto of [false, true]) for (const place of PLACES) expect(decideLifeFocus('cardReopened', auto, place), `${auto} ${place}`).toBe('choiceTitle');
  });

  it('전체 표: 10개 순간 × 자동 모드 2 × 위치 3 = 60칸이 사람이 적은 기대값과 모두 같다 (아홉째 delegatedCard는 어느 칸에서도 none, 열째 autoTurnedOn은 어느 칸에서도 choiceTitle)', () => {
    // 칸 순서: [body, controls, other]
    const manual: Record<LifeFocusMoment, LifeFocusAction[]> = {
      enter: ['lifeTitle', 'lifeTitle', 'lifeTitle'],
      enterWithChoice: ['choiceTitle', 'choiceTitle', 'choiceTitle'],
      choiceAppeared: ['choiceTitle', 'choiceTitle', 'choiceTitle'],
      choiceAppearedBySkip: ['choiceTitle', 'choiceTitle', 'choiceTitle'],
      autoTurnedOff: ['choiceTitle', 'choiceTitle', 'choiceTitle'],
      choiceResolved: ['lifeTitle', 'none', 'none'],
      cardCollapsed: ['foldOpen', 'foldOpen', 'foldOpen'],
      cardReopened: ['choiceTitle', 'choiceTitle', 'choiceTitle'],
      delegatedCard: ['none', 'none', 'none'],
      autoTurnedOn: ['choiceTitle', 'choiceTitle', 'choiceTitle'],
    };
    const auto: Record<LifeFocusMoment, LifeFocusAction[]> = {
      enter: ['lifeTitle', 'lifeTitle', 'lifeTitle'],
      enterWithChoice: ['lifeTitle', 'lifeTitle', 'lifeTitle'],
      choiceAppeared: ['none', 'none', 'none'],
      choiceAppearedBySkip: ['none', 'none', 'none'],
      autoTurnedOff: ['none', 'none', 'none'],
      choiceResolved: ['lifeTitle', 'none', 'none'],
      cardCollapsed: ['foldOpen', 'foldOpen', 'foldOpen'],
      cardReopened: ['choiceTitle', 'choiceTitle', 'choiceTitle'],
      delegatedCard: ['none', 'none', 'none'],
      autoTurnedOn: ['choiceTitle', 'choiceTitle', 'choiceTitle'],
    };
    expect(MOMENTS).toHaveLength(10);
    let cells = 0;
    for (const moment of MOMENTS) {
      PLACES.forEach((place, i) => {
        expect(decideLifeFocus(moment, false, place), `수동 / ${moment} / ${place}`).toBe(manual[moment][i]);
        expect(decideLifeFocus(moment, true, place), `자동 / ${moment} / ${place}`).toBe(auto[moment][i]);
        cells += 2;
      });
    }
    expect(cells, '칸 수').toBe(60);
  });

  it('불변식 1: 자동 모드에서 선택지 제목으로 가는 것은 사용자가 직접 누른 경우 — 「결정 다시 열기」(cardReopened)와 시트의 「이후 결정을 자동으로 고르게 하기」(autoTurnedOn, r4)뿐이다', () => {
    for (const moment of MOMENTS) {
      for (const place of PLACES) {
        if (decideLifeFocus(moment, true, place) === 'choiceTitle') expect(['cardReopened', 'autoTurnedOn'], `자동 모드에서 선택지 제목으로 이동: ${moment} / ${place}`).toContain(moment);
      }
    }
  });

  it('불변식 2: 수동 모드에서 카드가 열리는 모든 순간(뜸·복원·skip·자동 모드 끔·다시 열기)은 위치와 무관하게 선택지 제목이다 — 열린 시트는 모달이라 포커스를 컨트롤에 둘 수 없다', () => {
    for (const moment of ['enterWithChoice', 'choiceAppeared', 'choiceAppearedBySkip', 'autoTurnedOff', 'cardReopened'] as const) {
      expect(new Set(PLACES.map((place) => decideLifeFocus(moment, false, place))), moment).toEqual(new Set(['choiceTitle']));
    }
  });

  it('불변식 4 (R-393): 자동 모드에서 포커스를 옮기는 순간은 enter·enterWithChoice(인생 화면 제목)·cardCollapsed·cardReopened·autoTurnedOn(사용자가 직접 누름)과 「포커스를 잃은 채 선택지가 사라진」 choiceResolved × body뿐이다 — 뜸·skip·자동 모드 끔에서는 빼앗지 않는다', () => {
    const MOVES = new Set(['enter', 'enterWithChoice', 'cardCollapsed', 'cardReopened', 'autoTurnedOn']);
    for (const moment of MOMENTS) {
      for (const place of PLACES) {
        const moves = decideLifeFocus(moment, true, place) !== 'none';
        const allowed = MOVES.has(moment) || (moment === 'choiceResolved' && place === 'body');
        expect(moves, `자동 / ${moment} / ${place}`).toBe(allowed);
      }
    }
  });

  it('불변식 3: 접기는 카드가 닫히는 순간이라 선택지 제목이 아니라 접힌 띠로 간다 — 닫힌 시트의 제목으로 가면 포커스가 사라진 요소에 남는다', () => {
    for (const auto of [false, true]) for (const place of PLACES) expect(decideLifeFocus('cardCollapsed', auto, place)).not.toBe('choiceTitle');
  });
});
