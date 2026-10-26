/**
 * 중대 결정 카드의 접힘 상태 (SPEC-003 MD1, M7b — content-M7b 4-2절 U1~U11, 마스터 결정 M-7).
 * 접힘은 UI 상태일 뿐이라 저장하지 않는다(새로고침은 열린 카드로, U5 — 저장 스키마 불변). `App`이 이 상태를 갖는다(U10 — M7c의 생각 남기기 카드가 읽는다).
 * 순수 함수라 DOM 없이 단위 테스트한다(tests/decisionCollapse.test.tsx). 타이머·포커스는 `App.tsx`·`ui/useFocus.ts`가 이 판단을 읽어 움직인다.
 *
 * 상태 = 접힌 선택지의 키(`pending.key`) + 접기·다시 열기 횟수(`epoch`):
 *  - 키로 묶여 있어 **다음 선택지는 늘 열린 채 뜬다**(이전 키와 다르다). 선택지가 사라지면 접힘도 뜻이 없다.
 *  - `epoch`는 접기·다시 열기마다 오른다 — 입력 가드 키에 들어가 직후 400ms 동안 같은 자리의 버튼이 눌리지 않게 한다(U9).
 */

export interface FoldState {
  /** 접혀 있는 선택지의 키 (없으면 null) */
  key: string | null;
  epoch: number;
}

export const FOLD_INITIAL: FoldState = { key: null, epoch: 0 };

/** 지금 대기 중인 선택지가 접혀 있는가 */
export function isFolded(state: FoldState, pendingKey: string | null): boolean {
  return pendingKey !== null && state.key === pendingKey;
}

/** 「잠시 덮어 두기」(또는 Esc): 지금 대기 중인 선택지를 접는다. 대기 중인 선택지가 없으면 아무 일도 없다 */
export function foldCard(state: FoldState, pendingKey: string | null): FoldState {
  return pendingKey === null ? state : { key: pendingKey, epoch: state.epoch + 1 };
}

/** 「결정 다시 열기」: 연다. 이미 열려 있으면(접히지 않은 키) 그대로 */
export function reopenCard(state: FoldState): FoldState {
  return state.key === null ? state : { key: null, epoch: state.epoch + 1 };
}

/** 인생 화면을 떠났다(첫 화면 다시 열기·엔딩 등): 접힘을 지운다. 돌아오면 열린 카드가 뜬다 */
export function leaveLife(state: FoldState): FoldState {
  return state.key === null ? state : { key: null, epoch: state.epoch };
}

/** 자동 모드가 선택지를 고르는 타이머를 걸어도 되는가 — 일시정지·나가기 확인·가려진 탭·첫 화면과 같이, **카드를 접은 동안에도 걸지 않는다**(U3(a)), 기록 시트(`noteOpen` — M7c 「생각 남기기」)가 열려 있는 동안에도 걸지 않는다(시간이 멈춘다, LM5). 다시 열면 이 조건이 참이 되어 `AUTO_CHOICE_MS`부터 새로 센다 */
export function autoChooseArmed(o: { autoMode: boolean; hasPending: boolean; superseded: boolean; visible: boolean; showTitle: boolean; paused: boolean; exitAsk: boolean; folded: boolean; noteOpen?: boolean }): boolean {
  return o.autoMode && o.hasPending && !o.superseded && o.visible && !o.showTitle && !o.paused && !o.exitAsk && !o.folded && o.noteOpen !== true;
}
