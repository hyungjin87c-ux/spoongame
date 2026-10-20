import type { HeavyKind } from '../core/types';

/**
 * 「무거운 장면 가리기」의 화면 문구 (SPEC-005 QI6 HV2~HV8) — 한 곳에 모았다. 문구는 모두 docs/design/copy.md 12절의 확정 글이다(R-124): 글자 그대로 옮겼고 새로 쓴 문장은 없다.
 *
 * 가림은 **지금의 설정값**으로 화면이 정한다(화면 규칙 (A), R-475): 설정 `gentle`이 켜져 있으면 지난 줄까지 모든 heavy 줄·카드·연표 줄·자살률 슬라이드가 가려지고 언제든 펼칠 수 있으며, 끄면 모두 원문이다.
 * 가려진 자리에는 **분류 이름**(아래 `HEAVY_KIND_TEXT`)만 보인다 — 그래서 이름은 그 분류의 모든 장면에 참이어야 한다(R-469: 죽음이 없는 돌봄 장면이 섞인 loss에 「사별」이라 쓰지 않는다).
 */

/**
 * 분류 화면 이름 (copy.md 12-1, R-469): `heavy.kind` 여섯과 1:1이다(tests/gentle.test.ts가 키 빠짐·남는 이름을 잡는다). 모두 6자 이하(「무거운 일이 있었습니다 · {분류}」가 글자 200%에서 두 줄 모드로 접힌다).
 *  - home 집안 사정 · school 또래 사이 · health 건강 · loss 돌봄과 이별(「돌봄」과 「이별」을 묶은 이름은 주제의 묶음이지 「둘 다 일어났다」가 아니다) · bond 멀어진 사이(loss와 낱말이 겹치지 않는다) · work 일과 생계
 */
export const HEAVY_KIND_TEXT: Readonly<Record<HeavyKind, string>> = {
  home: '집안 사정',
  school: '또래 사이',
  health: '건강',
  loss: '돌봄과 이별',
  bond: '멀어진 사이',
  work: '일과 생계',
};

/** 분류 이름의 글자 수 상한 (copy.md 12-1 ④) */
export const HEAVY_KIND_NAME_MAX = 6;

/** 첫 화면 자살률 슬라이드의 분류 문구 (HV7, copy.md 12-6): h3 「무거운 주제 · 마음 건강 통계」, 읽기 이름은 쉼표로 「무거운 주제, 마음 건강 통계」 */
export const HEAVY_SLIDE_TEXT = {
  lead: '무거운 주제',
  name: '마음 건강 통계',
  /** 쌍으로 묶은 한 줄 글자(h3) — 보이는 가운뎃점은 낭독에서 숨긴다(`FitPair`/`Glue`의 hideSeparator) */
  title: '무거운 주제 · 마음 건강 통계',
  /** 읽기 이름(article `aria-label`의 뒷부분, 점 버튼 이름의 insight 자리) */
  readName: '무거운 주제, 마음 건강 통계',
} as const;

export const VEIL_TEXT = {
  /** 가린 기록 줄·연표 줄 안내 「무거운 일이 있었습니다 · {분류}」의 앞 (copy.md 12-2) */
  rowLead: '무거운 일이 있었습니다',
  /** 가린 카드(결정·부모)의 제목 「무거운 주제 · {분류}」의 앞 (copy.md 12-3) */
  cardLead: '무거운 주제',
  /** 줄·슬라이드의 펼침 버튼 (보이는 글자) — 기호는 aria-hidden (「카드 접기 ▾」와 같은 꼴) */
  open: '펼쳐 보기',
  close: '접기',
  markOpen: '▾',
  markClose: '▴',
  /** 가린 결정 카드의 안내 한 줄 (copy.md 12-3) — 결정할 일이 있다는 사실과 두 길을 말한다 */
  decisionNote: '결정할 일이 있습니다. 펼쳐서 읽고 직접 고르거나, 이번에는 성향에 따라 자동으로 고르게 할 수 있습니다.',
  /** 가린 부모·흘러감 카드의 안내 한 줄 (copy.md 12-4) — 고를 것이 없는 카드라 펼치는 길만 말한다 */
  parentNote: '펼치면 무슨 일이었는지 읽을 수 있습니다.',
  /** 가린 카드의 버튼 둘 (copy.md 12-3): 「펼쳐서 읽기」(기본) · 「이번에는 자동으로 고르기」(보조 — 지금의 자동 선택 성향으로 고른다) */
  readCard: '펼쳐서 읽기',
  autoPick: '이번에는 자동으로 고르기',
  /** 엔딩 맨 위 한 줄 (HV6, copy.md 12-5) — 판의 기록 `gentleUsed` 기준이라 설정이 꺼져 있어도 보인다 */
  endingLine: '이 판은 무거운 장면을 가린 채 살았습니다.',
} as const;

/** 접근 가능한 이름 (copy.md 12-2): 보이는 글자 「펼쳐 보기」가 이름의 앞머리 (WCAG 2.5.3). 한 목록에 같은 버튼이 여럿이라 나이와 분류로 맥락을 붙인다. */
export function veilButtonLabel(open: boolean, age: number, kindName: string): string {
  return `${open ? VEIL_TEXT.close : VEIL_TEXT.open} ${age}세 ${kindName}`;
}
