/**
 * 집과 가족 그림 카드와 인생 기록 「시대의 창」 줄의 문구 (SPEC-009 FM5, `docs/design/family-scene.md` 5절). 한 곳에 모았다 — 문구 기준은 `docs/design/copy.md`(절제된 어조, 합쇼체, 평가어 없음).
 * 아래 한 줄·펼침의 사람 줄·반려동물 문장은 순수 함수(`core/scene.ts`)가 만든다.
 */
export const SCENE_TEXT = {
  /** 카드 제목(화면에는 보이지 않고 스크린리더가 읽는다) */
  cardTitle: '집과 가족',
  /** 펼침 단추 */
  more: '함께 사는 사람',
  moreOthers: (n: number): string => `그 밖에 ${n}명`,
  ageSuffix: '세',
  openFamily: '가족과 삶 열기',
  fold: '그림 접기',
  unfold: '그림 펼치기',
  /** 그림 덩어리가 오지 않을 때 */
  artFailed: '그림을 불러오지 못했습니다. 글은 그대로 볼 수 있습니다.',
  artRetry: '다시 불러오기',
  /** 연도 표 */
  year: (y: number): string => `${y}년`,
  /** 시대의 창 */
  eraName: '시대의 창',
  eraVeiled: '가려 둔 장면',
  eraGo: '그해 기록으로',
  /** 인생 기록 시대 줄의 표지 글자 */
  eraMark: '시대의 창',
  /** 무거운 장면 가리기 안내의 분류 이름 (「무거운 일이 있었습니다 · 시대의 일」) — 사건 분류 여섯(`HEAVY_KIND_TEXT`)에 없는 세상의 큰 사건용. 6자 이하(`HEAVY_KIND_NAME_MAX`, `tests/eraLog.test.tsx`가 잠근다). 임시 문구 — FM7에서 확정한다 (R-548) */
  eraVeilKind: '시대의 일',
} as const;

/** 시대의 창 접근 이름 = 「시대의 창 · {문장} 그해 기록으로」, 말풍선 글 = 「시대의 창 · {문장}」 */
export function eraAccessibleName(line: string | null, veiled: boolean): string {
  const what = veiled || line === null ? SCENE_TEXT.eraVeiled : line;
  return `${SCENE_TEXT.eraName} · ${what} ${SCENE_TEXT.eraGo}`;
}
export function eraTitle(line: string | null, veiled: boolean): string {
  return `${SCENE_TEXT.eraName} · ${veiled || line === null ? SCENE_TEXT.eraVeiled : line}`;
}
