/**
 * 「이 삶의 이름들」 열린 화면의 고정 문구 (SPEC-022 EC1 8·11항, docs/design/copy.md 22절 — 글자 그대로). 버튼을 누른 뒤 받는 덩어리의 상수다.
 * 누르기 전에 보이는 문구(제목·설명·버튼·오류 문구·머리 띠 화면 이름)는 첫 덩어리 쪽 `data/endingText.ts#CREDITS_ENTRY_TEXT`에 있다.
 * 400·700 글꼴 조각 안의 글자만 쓴다(tests/fonts.test.tsx). 이 기능을 흔히 부르는 외래어 이름은 어디에도 쓰지 않는다(조각 밖 글자).
 */
export const CREDITS_TEXT = {
  /** 가족 장 제목 */
  familyTitle: '가족과 친구',
  /** 선택 장 제목 */
  choiceTitle: '기록에 남은 선택',
  /** 시대 장 제목 */
  eraTitle: '그 시절의 기록',
  /** 결정자 줄 — 싣는 기록이 본인 선택뿐이라 이 한 가지다 */
  byYou: '본인이 정한 일',
  /** 고른 길 줄의 앞 */
  pickLead: '고른 길',
  /** 끝 문장의 뒤 (앞에 이름) */
  endTail: '의 생애 기록을 마쳤습니다.',
  /** 조작 단추 */
  close: '기록으로 돌아가기',
  restart: '처음부터 보기',
  pause: '일시정지',
  resume: '이어 보기',
  toList: '목록으로 보기',
} as const;
