/**
 * 코드에 명시한 「의도된 줄바꿈 지점」 목록 (SPEC-003 QM3-1 (b), M3-L02).
 *
 * 한 낱말을 일부러 두 줄로 나눠도 되는 곳은 `<wbr>`(또는 `&shy;`·소프트 하이픈 U+00AD)로 코드에 적은 곳뿐이다. 그 낱말을 이 목록에 올린다.
 * `<wbr>`는 글자를 더하지 않으므로 읽는 이름·복사되는 글자는 같다 — 화면 글자(`textContent`)는 `<wbr>`가 있어도 그 낱말 그대로다.
 *
 * 규칙
 *  - 낱말·조합을 손으로 늘려 끊김을 허용하지 않는다. 목록에 없는 낱말에 `<wbr>`를 쓰려면 이유와 함께 여기에 올린다.
 *  - `tests/wordBreaks.test.ts`가 `src/` 전체의 `<wbr`·`&shy;`·U+00AD 사용처를 모아 이 목록과 같음을 단언한다
 *    (목록에 없는 사용도, 코드에 없는 목록 항목도 실패).
 *  - e2e 감사기(`e2e/lineBreaks.ts#measureWordBreaks`)는 낱말 안의 줄바꿈이 모두 `<wbr>` 바로 뒤이고 그 낱말이 이 목록에 있을 때만 `intended`로 센다.
 *
 * 강제 줄바꿈 `<br>`는 이 목록이 아니라 아래 `FORCED_BREAKS`(등록제)가 따로 관리한다 — 같은 SPEC 「허용은 둘뿐」의 둘째(코드에 명시한 줄바꿈)에 들고, 감사기가 `forced`로 따로 보고한다(R-300).
 *
 * Playwright에 의존하지 않아 vitest에서도 가져온다.
 */
export interface IntendedBreak {
  /** 낱말 (`<wbr>` 없이 이어 붙인 글자) */
  word: string;
  /** 쓰는 파일 (저장소 기준 상대 경로) */
  file: string;
  /** 왜 이 낱말에 줄바꿈 지점을 두는가 */
  why: string;
}

export const INTENDED_BREAKS: readonly IntendedBreak[] = [
  {
    word: '다이아몬드수저',
    file: 'src/ui/Grade.tsx',
    why: '가장 긴 수저 이름(7글자)이라 좁은 칩·릴 칸(글자 150%+·폭 320의 릴 칸 79px)에서 칩이 칸 밖으로 넘치는 것을 낱말 단위(「다이아몬드 / 수저」)로 푼다. 읽는 이름은 같다.',
  },
];

/** 목록의 낱말만 */
export const INTENDED_BREAK_WORDS: readonly string[] = INTENDED_BREAKS.map((b) => b.word);

/**
 * 코드에 명시한 「강제 줄바꿈 `<br>`」 등록 목록 (REV-003-M3-4 R-300). `<wbr>`가 폭에 따라 갈릴 수 있는 지점이라면 `<br>`는 **폭과 상관없이 늘 줄이 바뀌는** 자리다.
 * 글자 사이에 바로 붙은 `<br>`(「다이아몬드<br>수저」)는 낱말 한가운데를 가르므로 SPEC 「허용은 둘뿐」(한 줄보다 긴 낱말 · 코드에 명시한 줄바꿈 지점)의 둘째에 들려면 여기에 이유와 함께 올려야 한다.
 *
 * 규칙
 *  - 낱말·조합을 손으로 늘려 끊김을 허용하지 않는다. 목록에 없는 낱말 한가운데의 `<br>`는 e2e 감사기가 폭과 상관없이 `broken`으로 센다.
 *  - `tests/wordBreaks.test.ts`가 `src/` 전체의 `<br>` 사용처(파일별 개수)와 이 목록이 같음을 단언한다(목록에 없는 사용도, 코드에 없는 목록 항목도 실패).
 *    낱말은 데이터로 채워지는 경우가 있어(첫 화면 수저 띠의 `lines`) 소스 글자만으로는 알 수 없으므로, 그 화면을 서버 렌더한 마크업에서 `<br>` 앞뒤로 이어 붙은 낱말을 찾아 이 목록의 낱말과 대조한다.
 *  - e2e 감사기(`measureWordBreaks`)는 `<br>`에서만 갈린 목록 낱말을 `forced`로 따로 보고하고, 호출하는 e2e가 그 집합이 화면의 기대와 같음을 단언한다
 *    (첫 화면: 새 판·이어하기·확인 단계마다 이 목록의 낱말 하나씩. 룰렛·출생신고·캐러셀: 0).
 */
export interface ForcedBreak extends IntendedBreak {
  /** 그 파일 안의 `<br>` 태그 수 (주석 제외) */
  tags: number;
}

/**
 * 등록한 강제 줄바꿈 `<br>`: 지금은 **없다** (SPEC-004 GS11 — 첫 화면 제목 아래 다섯 수저 이름표 띠를 없애며 「다이아몬드 / 수저」 `<br>`도 함께 없어졌다. 룰렛·출생신고의 수저 이름표는 `<wbr>`다).
 * `<br>`가 다시 생기면 이 목록에 낱말·이유와 함께 올려야 tests/wordBreaks.test.ts가 통과한다.
 */
export const FORCED_BREAKS: readonly ForcedBreak[] = [];

/** 목록의 낱말만 */
export const FORCED_BREAK_WORDS: readonly string[] = FORCED_BREAKS.map((b) => b.word);
