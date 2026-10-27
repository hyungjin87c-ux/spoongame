import { describe, expect, it } from 'vitest';
import { advanceUntilDecision, holdDelayMs, type PendingChoice } from '../src/core';
import { startLife } from '../scripts/simulateLib';
import { AUTO_CHOICE_MS } from '../src/data/timingTable';
import { decisionGuardKey } from '../src/ui/dash/DecisionCard';
import { FOLD_INITIAL, autoChooseArmed, foldCard, isFolded, leaveLife, reopenCard } from '../src/ui/decisionFold';
import { INPUT_GUARD_MS, reconcileGuard, openGuard } from '../src/ui/GuardedButton';
import { lifeFocusMoment, type FocusSnapshot } from '../src/ui/useFocus';

/**
 * 잠시 덮어 두기·다시 열기의 판단 (SPEC-003 MD1, M7b — content-M7b 4-2절 U1·U3·U5·U8·U9·U10, 마스터 결정 M-7). 접힘 상태(`App` 수준) · 자동 선택 타이머를 거는 조건 · 입력 가드 키 · 포커스 순간.
 * DOM이 필요한 동작(접은 동안 나이·진행률 불변, 자동 선택 정지·재개 시간, 새로고침 복원, 더블탭 가드)은 e2e/m7b-decision.spec.ts가 실제 브라우저에서 본다.
 */

const ARMED = { autoMode: true, hasPending: true, superseded: false, visible: true, showTitle: false, paused: false, exitAsk: false, folded: false };

describe('접힘 상태 (U10: App 수준, 저장하지 않는다 — U5)', () => {
  it('처음에는 아무것도 접히지 않았다', () => {
    expect(FOLD_INITIAL).toEqual({ key: null, epoch: 0 });
    expect(isFolded(FOLD_INITIAL, 'school-tutoring@12')).toBe(false);
    expect(isFolded(FOLD_INITIAL, null)).toBe(false);
  });

  it('접기: 대기 중인 선택지의 키로 접고 epoch가 오른다. 선택지가 없으면 아무 일도 없다', () => {
    const s = foldCard(FOLD_INITIAL, 'a@3');
    expect(s).toEqual({ key: 'a@3', epoch: 1 });
    expect(isFolded(s, 'a@3')).toBe(true);
    expect(foldCard(FOLD_INITIAL, null)).toBe(FOLD_INITIAL);
  });

  it('다음 선택지는 늘 열린 채 뜬다: 키가 다르면 접히지 않은 것이다 (이전 키의 접힘이 새 카드를 가리지 않는다)', () => {
    const s = foldCard(FOLD_INITIAL, 'a@3');
    expect(isFolded(s, 'b@4')).toBe(false);
    // 선택지가 사라진 동안도 접힘이 아니다
    expect(isFolded(s, null)).toBe(false);
  });

  it('다시 열기: 접힘을 지우고 epoch가 오른다. 이미 열려 있으면 그대로(연타해도 가드 키가 흔들리지 않는다)', () => {
    const folded = foldCard(FOLD_INITIAL, 'a@3');
    const open = reopenCard(folded);
    expect(open).toEqual({ key: null, epoch: 2 });
    expect(reopenCard(open)).toBe(open);
  });

  it('접기·다시 열기를 연타해도 마지막 눌림이 상태를 정한다: 접기 → 열기 → 접기 = 접힘, epoch는 눌린 횟수', () => {
    let s = FOLD_INITIAL;
    for (let i = 0; i < 20; i++) s = i % 2 === 0 ? foldCard(s, 'a@3') : reopenCard(s);
    expect(isFolded(s, 'a@3')).toBe(false);
    expect(s.epoch).toBe(20);
    s = foldCard(s, 'a@3');
    expect(isFolded(s, 'a@3')).toBe(true);
    expect(s.epoch).toBe(21);
  });

  it('인생 화면을 떠나면(첫 화면 다시 열기·엔딩) 접힘을 지운다 — 돌아오면 열린 카드가 뜬다. epoch는 유지', () => {
    const s = foldCard(FOLD_INITIAL, 'a@3');
    expect(leaveLife(s)).toEqual({ key: null, epoch: 1 });
    expect(leaveLife(FOLD_INITIAL)).toBe(FOLD_INITIAL);
  });
});

describe('자동 선택 타이머를 거는 조건 (U3(a)) — 접은 동안 정지, 다시 열면 AUTO_CHOICE_MS부터 새로', () => {
  it('열린 카드에서는 건다', () => {
    expect(autoChooseArmed(ARMED)).toBe(true);
  });

  it('접은 동안에는 걸지 않는다 (다른 정지 조건과 같다: 일시정지·나가기 확인·가려진 탭·첫 화면·밀린 화면)', () => {
    expect(autoChooseArmed({ ...ARMED, folded: true })).toBe(false);
    for (const k of ['paused', 'exitAsk', 'superseded', 'showTitle'] as const) expect(autoChooseArmed({ ...ARMED, [k]: true }), k).toBe(false);
    expect(autoChooseArmed({ ...ARMED, visible: false })).toBe(false);
    expect(autoChooseArmed({ ...ARMED, hasPending: false })).toBe(false);
    expect(autoChooseArmed({ ...ARMED, autoMode: false })).toBe(false);
  });

  it('기록 시트(「생각 남기기」, noteOpen)가 열려 있는 동안에도 걸지 않는다 (SPEC-003 M7c LM5·5-3절) — 닫으면 다시 참이 되어 AUTO_CHOICE_MS부터 새로 센다. noteOpen을 안 주면 예전과 같다', () => {
    expect(autoChooseArmed({ ...ARMED, noteOpen: true })).toBe(false);
    expect(autoChooseArmed({ ...ARMED, noteOpen: false })).toBe(true);
    expect(autoChooseArmed(ARMED)).toBe(true);
    // 접힌 띠나 다른 정지 조건과 겹쳐도 거짓이다
    expect(autoChooseArmed({ ...ARMED, noteOpen: true, folded: true })).toBe(false);
    expect(autoChooseArmed({ ...ARMED, noteOpen: true, paused: true })).toBe(false);
  });

  it('접힌 채 자동 모드를 켜도 걸지 않는다 (U8) — 켠 모드와 접힘은 독립이라 folded가 이긴다', () => {
    expect(autoChooseArmed({ ...ARMED, autoMode: true, folded: true })).toBe(false);
    // 다시 열면 참이 되어 효과가 다시 돌고 타이머는 처음부터 센다 (App의 의존 배열에 folded가 있다)
    expect(autoChooseArmed({ ...ARMED, autoMode: true, folded: false })).toBe(true);
  });

  it('접힘은 시계(한 해 진행)에 영향이 없다: 선택지가 대기 중이면 어차피 시계가 멈춘다 — 접은 동안 게임은 정지를 유지한다 (U1)', () => {
    const s = advanceUntilDecision(startLife(11, 'alpha')).state;
    expect(s.pending).not.toBeNull();
    // 연출 대기 시간은 선택지·사망에서 null(타이머 없음) — 접든 열든 같다
    expect(holdDelayMs('choice', 1)).toBeNull();
    expect(AUTO_CHOICE_MS).toBe(3000);
  });
});

describe('입력 가드 키 (U9): 접기·다시 열기 직후 400ms', () => {
  const pending: PendingChoice = { eventId: 'school-tutoring', key: 'school-tutoring@12', age: 12, choiceIds: ['a', 'b'] };

  it('가드 키 = 선택지 인스턴스 + epoch: 접거나 다시 열 때마다 키가 바뀌고, 같은 epoch에서는 같다', () => {
    expect(decisionGuardKey(pending, 0)).toBe('school-tutoring@12#0');
    expect(decisionGuardKey(pending, 1)).not.toBe(decisionGuardKey(pending, 0));
    expect(decisionGuardKey(pending, 2)).not.toBe(decisionGuardKey(pending, 1));
    expect(decisionGuardKey(pending, 1)).toBe(decisionGuardKey(pending, 1));
    expect(decisionGuardKey({ ...pending, key: 'other@12' }, 1)).not.toBe(decisionGuardKey(pending, 1));
  });

  it('키가 바뀐 렌더에서 즉시 닫히고(ready=false) 400ms 뒤에 열린다 — 같은 버튼 요소가 재사용돼도 가드가 다시 걸린다', () => {
    expect(INPUT_GUARD_MS).toBe(400);
    const open = { key: decisionGuardKey(pending, 0), ready: true };
    expect(reconcileGuard(open, decisionGuardKey(pending, 0)).ready).toBe(true);
    const after = reconcileGuard(open, decisionGuardKey(pending, 1));
    expect(after.ready).toBe(false);
    expect(openGuard(after, decisionGuardKey(pending, 1)).ready).toBe(true);
    // 그 사이 다시 키가 바뀌었으면(연타) 이전 타이머는 열지 못한다
    expect(openGuard(reconcileGuard(after, decisionGuardKey(pending, 2)), decisionGuardKey(pending, 1)).ready).toBe(false);
  });
});

describe('포커스 순간 lifeFocusMoment (D-52, 48칸 표의 입력 — r4에서 60칸)', () => {
  const now = (o: Partial<FocusSnapshot>): FocusSnapshot => ({ key: 'a@3', autoMode: false, folded: false, ...o });

  it('화면이 막 뜸: 선택지 없음 = enter, 있음 = enterWithChoice (복원된 카드는 열린 채 — 접힘을 저장하지 않는다)', () => {
    expect(lifeFocusMoment(null, now({ key: null }), false)).toBe('enter');
    expect(lifeFocusMoment(null, now({}), false)).toBe('enterWithChoice');
  });

  it('선택지가 뜸/사라짐: skip을 눌렀으면 choiceAppearedBySkip, 아니면 choiceAppeared, 사라지면 choiceResolved', () => {
    expect(lifeFocusMoment(now({ key: null }), now({}), false)).toBe('choiceAppeared');
    expect(lifeFocusMoment(now({ key: null }), now({}), true)).toBe('choiceAppearedBySkip');
    expect(lifeFocusMoment(now({}), now({ key: null }), false)).toBe('choiceResolved');
    expect(lifeFocusMoment(now({ key: 'a@3' }), now({ key: 'b@4' }), false)).toBe('choiceAppeared');
  });

  it('접기·다시 열기: 같은 선택지에서 접힘이 바뀌면 cardCollapsed / cardReopened', () => {
    expect(lifeFocusMoment(now({}), now({ folded: true }), false)).toBe('cardCollapsed');
    expect(lifeFocusMoment(now({ folded: true }), now({}), false)).toBe('cardReopened');
    // 자동 모드에서도 같다 (접기를 허용한다 — U3)
    expect(lifeFocusMoment(now({ autoMode: true }), now({ autoMode: true, folded: true }), false)).toBe('cardCollapsed');
    expect(lifeFocusMoment(now({ autoMode: true, folded: true }), now({ autoMode: true }), false)).toBe('cardReopened');
  });

  it('열린 카드에서 자동 모드가 꺼지면 autoTurnedOff, 접힌 채 꺼지면 순간이 아니다 (옮길 제목이 없다)', () => {
    expect(lifeFocusMoment(now({ autoMode: true }), now({ autoMode: false }), false)).toBe('autoTurnedOff');
    expect(lifeFocusMoment(now({ autoMode: true, folded: true }), now({ autoMode: false, folded: true }), false)).toBeNull();
  });

  // r4 UX12(QI12)가 바꾼 단언: 옛 단언은 「켜는 것은 순간이 아니다」(자동 모드를 켜는 길은 도구 줄뿐이고 시트가 떠 있는 동안 inert라 열린 카드에서 켜지는 일이 없었다, M-6).
  // 마스터 결정 M-6이 시트 하단 「이후 결정을 자동으로 고르게 하기」 하나에 한해 개정돼 열린 카드(시트)에서 자동 모드가 켜지고 같은 카드가 인라인으로 바뀐다 → 이 순간이 생겼다. 접힌 채 켜는 길(도구 줄)은 여전히 순간이 아니다.
  it('열린 카드에서 자동 모드가 켜지면 autoTurnedOn(r4 UX12 — 시트의 자동 고르기 버튼), 접힌 채 켜면 순간이 아니다 (다시 열 때 cardReopened)', () => {
    expect(lifeFocusMoment(now({ autoMode: false }), now({ autoMode: true }), false)).toBe('autoTurnedOn');
    expect(lifeFocusMoment(now({ autoMode: false, folded: true }), now({ autoMode: true, folded: true }), false)).toBeNull();
    // 선택지가 없는 동안 켜는 것(도구 줄)도 순간이 아니다
    expect(lifeFocusMoment(now({ key: null, autoMode: false }), now({ key: null, autoMode: true }), false)).toBeNull();
  });

  it('아무 일도 없는 갱신(나이·진행률 등)은 순간이 아니다. 선택지가 없는 동안의 접힘 변화도 순간이 아니다', () => {
    expect(lifeFocusMoment(now({}), now({}), false)).toBeNull();
    expect(lifeFocusMoment(now({ key: null }), now({ key: null }), false)).toBeNull();
    expect(lifeFocusMoment(now({ key: null, folded: true }), now({ key: null }), false)).toBeNull();
  });
});
