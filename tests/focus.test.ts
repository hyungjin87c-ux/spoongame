import { describe, expect, it } from 'vitest';
import { decideLifeFocus, type FocusPlace, type LifeFocusAction, type LifeFocusMoment } from '../src/ui/useFocus';

/**
 * R-036·R-048 인생 화면 포커스 규칙의 판단 부분(순수 함수). 실제 포커스 이동(DOM)은 e2e/life-focus.spec.ts가 본다.
 * 표는 사람이 직접 적은 기대값이다 (구현이 쓰는 상수·함수를 다시 계산하지 않는다).
 */
const PLACES: FocusPlace[] = ['body', 'controls', 'other'];
const MOMENTS: LifeFocusMoment[] = ['enter', 'enterWithChoice', 'choiceAppeared', 'choiceAppearedBySkip', 'autoTurnedOff', 'choiceResolved'];

describe('decideLifeFocus (R-036, R-048)', () => {
  it('화면이 처음 뜰 때: 선택지가 없으면 인생 화면 제목(R-030) — 포커스 위치·자동 모드와 무관', () => {
    for (const auto of [false, true]) for (const place of PLACES) expect(decideLifeFocus('enter', auto, place)).toBe('lifeTitle');
  });

  it('화면이 뜰 때 선택지가 이미 있으면(새로고침 복원): 수동 모드는 선택지 제목, 자동 모드는 인생 화면 제목', () => {
    for (const place of PLACES) {
      expect(decideLifeFocus('enterWithChoice', false, place)).toBe('choiceTitle');
      expect(decideLifeFocus('enterWithChoice', true, place)).toBe('lifeTitle');
    }
  });

  it('플레이 중 시간이 흘러 선택지가 뜰 때: 자동 모드는 어디에 있든 옮기지 않는다', () => {
    for (const place of PLACES) expect(decideLifeFocus('choiceAppeared', true, place)).toBe('none');
  });

  it('플레이 중 시간이 흘러 선택지가 뜰 때(수동): 포커스가 컨트롤 그룹 안이면 옮기지 않고 알리기만, 그 밖(body·제목 등)이면 선택지 제목으로', () => {
    expect(decideLifeFocus('choiceAppeared', false, 'controls')).toBe('announce');
    expect(decideLifeFocus('choiceAppeared', false, 'body')).toBe('choiceTitle');
    expect(decideLifeFocus('choiceAppeared', false, 'other')).toBe('choiceTitle');
  });

  it('사용자가 "다음 결정으로"를 눌러 선택지가 뜰 때: 포커스가 어디에 있든(그 버튼 = 컨트롤 안이어도) 선택지 제목으로 (R-036 2)', () => {
    for (const place of PLACES) expect(decideLifeFocus('choiceAppearedBySkip', false, place)).toBe('choiceTitle');
    // 같은 "컨트롤 안" 포커스라도 시간이 흘러 뜬 선택지는 알리기만 한다 → 두 경우를 가르는 것은 "방금 skip을 눌렀다"는 표시뿐이다
    expect(decideLifeFocus('choiceAppeared', false, 'controls')).not.toBe(decideLifeFocus('choiceAppearedBySkip', false, 'controls'));
  });

  it('복원 경로(enterWithChoice)와 플레이 경로(choiceAppeared)는 같은 대상(선택지 제목)을 쓴다 — 포커스가 body이거나 제목에 있을 때', () => {
    for (const place of ['body', 'other'] as const) {
      expect(decideLifeFocus('enterWithChoice', false, place)).toBe(decideLifeFocus('choiceAppeared', false, place));
    }
  });

  it('선택지가 대기 중인 채 자동 모드가 꺼질 때(R-048): 플레이 중 선택지가 뜰 때의 수동 규칙과 같다 — 컨트롤 안이면 알리기만, 그 밖이면 선택지 제목으로', () => {
    expect(decideLifeFocus('autoTurnedOff', false, 'controls')).toBe('announce');
    expect(decideLifeFocus('autoTurnedOff', false, 'body')).toBe('choiceTitle');
    expect(decideLifeFocus('autoTurnedOff', false, 'other')).toBe('choiceTitle');
    // 자동 모드가 켜진 상태에서는 이 순간이 오지 않지만, 오더라도 포커스를 건드리지 않는다
    for (const place of PLACES) expect(decideLifeFocus('autoTurnedOff', true, place)).toBe('none');
  });

  it('선택지가 사라질 때(수동): 포커스가 body로 떨어졌으면 인생 화면 제목으로, 이미 다른 곳에 있으면 그대로 둔다. 자동 모드는 건드리지 않는다', () => {
    expect(decideLifeFocus('choiceResolved', false, 'body')).toBe('lifeTitle');
    expect(decideLifeFocus('choiceResolved', false, 'controls')).toBe('none');
    expect(decideLifeFocus('choiceResolved', false, 'other')).toBe('none');
    for (const place of PLACES) expect(decideLifeFocus('choiceResolved', true, place)).toBe('none');
  });

  it('전체 표: 6개 순간 × 자동 모드 2 × 위치 3 = 36칸이 사람이 적은 기대값과 모두 같다', () => {
    // 칸 순서: [body, controls, other]
    const manual: Record<LifeFocusMoment, LifeFocusAction[]> = {
      enter: ['lifeTitle', 'lifeTitle', 'lifeTitle'],
      enterWithChoice: ['choiceTitle', 'choiceTitle', 'choiceTitle'],
      choiceAppeared: ['choiceTitle', 'announce', 'choiceTitle'],
      choiceAppearedBySkip: ['choiceTitle', 'choiceTitle', 'choiceTitle'],
      autoTurnedOff: ['choiceTitle', 'announce', 'choiceTitle'],
      choiceResolved: ['lifeTitle', 'none', 'none'],
    };
    const auto: Record<LifeFocusMoment, LifeFocusAction[]> = {
      enter: ['lifeTitle', 'lifeTitle', 'lifeTitle'],
      enterWithChoice: ['lifeTitle', 'lifeTitle', 'lifeTitle'],
      choiceAppeared: ['none', 'none', 'none'],
      choiceAppearedBySkip: ['none', 'none', 'none'],
      autoTurnedOff: ['none', 'none', 'none'],
      choiceResolved: ['none', 'none', 'none'],
    };
    for (const moment of MOMENTS) {
      PLACES.forEach((place, i) => {
        expect(decideLifeFocus(moment, false, place), `수동 / ${moment} / ${place}`).toBe(manual[moment][i]);
        expect(decideLifeFocus(moment, true, place), `자동 / ${moment} / ${place}`).toBe(auto[moment][i]);
      });
    }
  });

  it('불변식: 컨트롤 안의 포커스를 선택지 제목으로 가져오는 것은 사용자가 skip을 누른 경우(와 막 열린 화면)뿐이다. 자동 모드에서는 어떤 경우에도 선택지 제목으로 가지 않는다', () => {
    for (const moment of MOMENTS) {
      for (const place of PLACES) {
        if (decideLifeFocus(moment, true, place) === 'choiceTitle') throw new Error(`자동 모드에서 선택지 제목으로 이동: ${moment} / ${place}`);
      }
      if (decideLifeFocus(moment, false, 'controls') === 'choiceTitle') {
        expect(['choiceAppearedBySkip', 'enterWithChoice'], `${moment}에서 컨트롤 안의 포커스를 선택지 제목으로 가져온다`).toContain(moment);
      }
    }
  });
});
