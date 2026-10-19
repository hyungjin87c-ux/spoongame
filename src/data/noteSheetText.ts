/**
 * 기록 시트(「생각 남기기」, SPEC-003 M7c) 문구 상수 — 글자는 docs/design/copy.md 7-2절 ①~⑫와 같다(designer 최종 문구, 2026-10-19). 질문 7종·수동 질문·연표 라벨 주제는 `src/data/notes.json`에 있다.
 * 이름은 copy.md 7-3절 「문구 상수 제안」을 따랐다. 글자 수·남은 글자는 함수(`count`·`countSr`)가 만든다 — 시험(tests/noteSheet.test.tsx)이 copy.md와 글자까지 대조한다.
 */

export const NOTE_TEXT = {
  /** 대화상자 종류 이름(`#nc-kind`) — `aria-labelledby="nc-kind nc-title"`의 앞 */
  kind: '생각 남기기',
  /** 입력란의 읽기 전용 이름(`<label class="sr-only">`) */
  inputLabel: '남길 글',
  /** 입력란 아래 안내(FR8) */
  hint: '실명·연락처 같은 개인정보는 적지 마십시오. 이 기기에만 저장됩니다.',
  /** 보이는 글자 수 「34/140」(`aria-hidden`) */
  count: (n: number, max: number): string => `${n}/${max}`,
  /** 읽기 전용 글자 수 「34자 입력, 140자까지」 */
  countSr: (n: number, max: number): string => `${n}자 입력, ${max}자까지`,
  /** 두 버튼 (원문 그대로) + 보조 설명 */
  keep: '적어두고 살기',
  keepSub: '인생 기록에 한 줄로 더해집니다.',
  skip: '마음속에 담고 살기',
  skipSub: '아무것도 저장하지 않고 넘어갑니다.',
  /** 알림 줄(role=status) */
  remaining: (n: number): string => `${n}자 남았습니다.`,
  reachedMax: (max: number): string => `${max}자까지 적었습니다.`,
  truncated: (max: number): string => `${max}자까지 적을 수 있어 넘는 부분은 줄였습니다.`,
  linesFull: '줄은 세 줄까지 적을 수 있습니다.',
  /** 빈 입력에서 1번 (FR3) */
  emptyError: '적을 말이 없다면 「마음속에 담고 살기」를 골라도 됩니다.',
  /** 「저절로 뜨는 기록 카드 끄기/켜기」 칸과 누른 뒤 알림 */
  cardsOff: '저절로 뜨는 기록 카드 끄기',
  cardsOn: '저절로 뜨는 기록 카드 켜기',
  cardsOffNotice: '이제 기록 카드가 저절로 뜨지 않습니다. 「생각 남기기」로는 언제든 적을 수 있습니다.',
  cardsOnNotice: '다음 기록 카드부터 다시 저절로 뜹니다.',
  /** 기록 40개 도달 뒤 */
  limitTitle: '이 인생에서 남길 수 있는 기록은 40개까지입니다.',
  limitSub: '적은 글은 인생 기록과 엔딩 연표에 그대로 남습니다.',
  close: '닫기',
  /** 확인 단계 (글이 있는데 2번·Esc) */
  confirmTitle: '적은 글을 지우고 넘어갈까요?',
  confirmSub: '적은 글은 저장되지 않습니다. 돌아가면 그대로 이어 쓸 수 있습니다.',
  confirmDiscard: '글을 지우고 담아 두기',
  confirmBack: '돌아가서 이어 쓰기',
  /** 「나의 기록」 줄 라벨의 앞부분 (연표·엔딩) */
  rowLabel: '나의 기록',
} as const;
