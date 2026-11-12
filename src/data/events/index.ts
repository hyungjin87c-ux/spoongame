import { createEventPool, type EventPool } from '../../core/events';
import { validateEventFiles } from '../../core/eventValidate';
import { ASK_PET_ENABLED } from '../askTable';

/**
 * 이벤트 데이터 로더. src/data/events/*.json 을 전부 읽는다 — 파일을 추가하기만 하면 코드 수정 없이 풀에 들어간다.
 * 로드할 때 스키마 검증(core/events.ts#validateEventFiles)을 하므로, 잘못된 데이터는 앱(개발 서버)을 처음 열 때, 테스트(npm test),
 * 그리고 빌드(npm run build — scripts/validateEvents.ts가 이 모듈을 똑같이 불러 검증하고 실패하면 빌드를 중단한다, R-043)에서
 * 문제 목록과 함께 바로 드러난다. 그래서 배포 번들이 이 검증에서 예외를 던져 빈 화면이 되는 일은 빌드 단계에서 막힌다.
 *
 * **예외 하나 — `ask-pet.json`**(어린 시절 조르기의 강아지 2사건, SPEC-011 AK9): 스위치 `ASK_PET_ENABLED`(`src/data/askTable.ts`)가 꺼져 있으면 이벤트 목록에 들어가지 않는다
 * (번들에도 들어가지 않는다 — 아래 두 glob 가운데 반려동물 파일만 따로 불러 스위치가 거짓이면 상수 접기로 사라진다). 이번 배포(v0.5.0)는 꺼져 있다.
 *
 * **JSON에는 주석을 달 수 없어 여기에 적는다 — `infant.json`·`school.json`의 선택지 효과 50곳(21개 사건)은 SPEC-011 AK10 결정 3(형진 님 2026-11-09 「보정한다」)으로 +1 했다**:
 * 조르기가 부모·흘러감 카드를 판당 약 1.6장 대신해 20세 평균 지식·관계가 내려간 몫을 남은 카드가 메운다(설계 문서 `docs/data/ask-model.md` 11절 사다리 4번의 사용 기록에 규칙 넷·올리지 않은 9곳·사유).
 * 규칙에 걸리나 올리지 않은 곳: 문서의 9곳 외에 `school-club/sports`·`books`(규칙 ② 해당이나 빠뜨림 — 배포 뒤 재측정 때 판단), `school-family-priority`는 규칙 ③·④ 대상 아님(전 구간을 흘러감으로 보지 않음). 값은 바꾸지 않았다.
 * 보정 전 원문은 `tests/fixtures/pre-ask-comp-events/`(재측정 기준 V11s)에 얼려 두었다. 이 효과를 또 바꾸면 `tests/stat20Guard.test.ts#PD_AT_20`·`tests/infantContent.test.ts`의 `PD_AT_8`·`tests/rngSnapshot.test.ts`를 함께 다시 잰다.
 */
const BASE_FILES: Readonly<Record<string, unknown>> = import.meta.glob(['./*.json', '!./ask-pet.json'], { eager: true, import: 'default' });
const PET_FILES: Readonly<Record<string, unknown>> = import.meta.glob('./ask-pet.json', { eager: true, import: 'default' });

export const EVENT_FILES: Readonly<Record<string, unknown>> = ASK_PET_ENABLED ? { ...BASE_FILES, ...PET_FILES } : BASE_FILES;

export const EVENT_POOL: EventPool = createEventPool(validateEventFiles(EVENT_FILES));
