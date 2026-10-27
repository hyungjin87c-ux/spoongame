/**
 * 이벤트 데이터 검증 (빌드 전 단계, R-043).  실행: npm run check:events  (npm run build가 자동으로 먼저 실행한다)
 *
 * src/data/events/*.json 을 앱이 읽는 것과 똑같이 읽어(src/data/events/index.ts) core/events.ts#validateEventFiles로 검증한다.
 * 두 가지를 본다: (1) 스키마 검증(core/events.ts#validateEventFiles — 앱이 읽을 때 하는 것과 같다), (2) 문구 점검(core/eventLint.ts#lintEventData —
 * 느낌표·이모지·URL·달력 연도·실제 이름·말투·합쇼체 어체·해설 종결·길이·시대 소재 등. 예전에는 `npm test`에서만 걸렸다, QA 사용감 8)과 (3) 카드와 인용의 연결(`citation` id가 citations.json에 있고 쓸 수 있는가 — M7b).
 * (SPEC-003 M7e-3: 해라체 이행 목록 점검은 장치와 함께 걷어냈다 — 모든 이벤트가 합쇼체여야 한다.)
 * 잘못된 데이터가 있으면 문제 목록을 출력하고 종료 코드 1로 끝나므로 `npm run build`가 실패한다 —
 * 예전에는 vite build가 이 데이터를 실행하지 않아 빌드는 통과하고 배포본이 빈 화면이 될 수 있었다.
 * 새 의존성 없이 이미 쓰는 vite-node로 실행한다(import.meta.glob도 그대로 동작).
 */
export {}; // 모듈로 취급해 최상위 await를 쓴다

try {
  await import('../src/data/installAll'); // 지연 로드 데이터(이벤트 풀·출생 연도 표·인용 테이블)를 정적으로 놓는다 — core의 기본 인자가 읽는다(MG8)
  const { EVENT_FILES, EVENT_POOL } = await import('../src/data/events');
  const { lintEventData, citationLinkProblems, lintNoteFile, noteCardPoolProblems, parentTableProblems } = await import('../src/core');
  const { NOTE_CARDS, NOTE_MANUAL } = await import('../src/data/noteCards');
  // 스키마 검증은 위 import에서 이미 끝났다(통과하지 못하면 throw). 이어서 문구 규칙(어조·길이·시대 소재, QA 사용감 8)을 점검한다.
  // 카드와 인용의 연결(M7b): citation이 가리키는 id가 citations.json에 있고 쓸 수 있으며 금지된 이벤트에 붙지 않았는가 (형태는 위 스키마 검증이 이미 봤다)
  // 기록 카드(M7c, src/data/notes.json): 스키마는 위 import에서 이미 검증됐다(noteCards.ts). 문구 점검(질문 안전 기준·조사·길이·시대 낱말)과 풀 교차 점검(플래그·본 이벤트 id), 인용 연결을 함께 본다.
  const lint = [
    ...lintEventData(EVENT_POOL.events, EVENT_FILES),
    ...citationLinkProblems(EVENT_POOL.events, undefined, NOTE_CARDS),
    ...lintNoteFile({ manual: NOTE_MANUAL, cards: [...NOTE_CARDS] }),
    ...noteCardPoolProblems(NOTE_CARDS, EVENT_POOL.events),
    // 어린 시절 부모님 결정(SPEC-005 PD2): 19세 미만에서 일어나는 선택지 이벤트가 분류표에 모두 있고, 표의 id가 모두 실제로 있다 — 새 선택지 이벤트를 분류 없이 추가하면 빌드가 실패한다
    ...parentTableProblems(EVENT_POOL.events),
  ];
  if (lint.length > 0) {
    console.error('이벤트 문구 점검 실패: 빌드를 중단합니다.');
    console.error(['이벤트 문구 오류 ' + lint.length + '건:', ...lint.map((m) => '- ' + m)].join('\n'));
    process.exit(1);
  }
  const fileCount = Object.keys(EVENT_FILES).length;
  const choiceCount = EVENT_POOL.events.filter((ev) => ev.choices !== undefined).length;
  console.log(
    `이벤트 데이터 검증 통과(스키마 + 문구 점검): 파일 ${fileCount}개, 이벤트 ${EVENT_POOL.events.length}개 (선택지 ${choiceCount} + 서술 ${EVENT_POOL.events.length - choiceCount}), 모두 합쇼체 / 기록 카드 ${NOTE_CARDS.length}종 (질문 문구·풀 교차·인용 연결 통과) / 부모 결정 분류표 ${Object.keys((await import('../src/data/parentDecisionTable')).PARENT_DECISION_TABLE).length}장 통과`,
  );
} catch (error) {
  console.error('이벤트 데이터 검증 실패: 빌드를 중단합니다.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
