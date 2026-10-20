/**
 * 첫 화면 정보 패널 「새 소식과 소개」의 화면 문구 (SPEC-005 QI7 NT4·NT5·FQ1) — 한 곳에 모았다. 문구는 모두 docs/design/copy.md 13-1절의 확정 글이다(R-124).
 * 패널 전체가 해요체다(N1). 새 소식 항목은 `releaseNotes.ts`, 소개 질문과 답은 `aboutFaq.ts`.
 */
export const INFO_TEXT = {
  /** 패널(dialog) 제목 h2 — 두 구역의 이름을 「과」로 이은 것 */
  panelTitle: '새 소식과 소개',
  /** 구역 h3 / 푸터 링크 이름 (링크 이름 = 구역 이름, QM3-3) */
  newsName: '새 소식',
  introName: '소개',
  close: '닫기',
  /** 구역 머리 한 줄 — 쓴 주체를 말하지 않는다(N8) */
  newsLead: '새 소식에는 눈에 보이는 달라진 점만 적어요.',
  introLead: '이 게임에 대해 질문과 답으로 정리했어요.',
  /** 「새」 표시: 알약 글자는 aria-hidden, 링크 이름의 읽기 전용 꼬리가 뜻을 전한다(색 + 글자) */
  badge: '새',
  badgeSr: '(읽지 않은 소식 있음)',
} as const;

/** 처음부터 펼쳐 보이는 최신 버전 수 (NT4: 최신 3개 펼침, 나머지는 접힘) */
export const NOTES_OPEN_COUNT = 3;
