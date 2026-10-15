import { createEventPool, validateEventFiles, type EventPool } from '../../core/events';

/**
 * 이벤트 데이터 로더. src/data/events/*.json 을 전부 읽는다 — 파일을 추가하기만 하면 코드 수정 없이 풀에 들어간다.
 * 로드할 때 스키마 검증(core/events.ts#validateEventFiles)을 하므로, 잘못된 데이터는 앱(개발 서버)을 처음 열 때, 테스트(npm test),
 * 그리고 빌드(npm run build — scripts/validateEvents.ts가 이 모듈을 똑같이 불러 검증하고 실패하면 빌드를 중단한다, R-043)에서
 * 문제 목록과 함께 바로 드러난다. 그래서 배포 번들이 이 검증에서 예외를 던져 빈 화면이 되는 일은 빌드 단계에서 막힌다.
 */
export const EVENT_FILES: Readonly<Record<string, unknown>> = import.meta.glob('./*.json', { eager: true, import: 'default' });

export const EVENT_POOL: EventPool = createEventPool(validateEventFiles(EVENT_FILES));
