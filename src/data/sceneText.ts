import type { EraBasis, EraForesight, EraForesightNote } from '../core/eraWindow';
import { commaList } from '../core/glue';

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
  /** 「예측」 칩 (SPEC-010 FU3) — 2027년부터의 시대 줄과 시대의 창 칸. 경제 칸의 「전망」과 이름·색·아이콘·모양이 모두 다르다 */
  forecast: '예측',
  /** 칩 옆 근거 종류 글자 (SPEC-010 「표기 규칙」): 신뢰도 낮음 단독은 「가상 시나리오」로 내려 적는다 */
  forecastBasis: { official: '공식 전망 바탕', expert: '전문가 전망 바탕', scenario: '가상 시나리오' } as const satisfies Record<EraBasis, string>,
  /** 근거 종류 글자를 누르면 펼쳐지는 「예측 근거 보기」 (SPEC-010 FU11) */
  foresightOpen: '근거 보기',
  /** 근거 칸 소개 한 줄 (REV-010-UI-1 R-610: 근거는 그림이 승인된 뒤에 조사됐고 U09의 근거는 반대 근거뿐이라 「그릴 때 참고한」은 사실과 다르다). 근거 글이 한 건도 없는 칸(수저별 안내만)에는 소개를 두지 않는다 */
  foresightIntro: '이 장면과 관련된 말과 자료입니다.',
  foresightReported: '보도 기준',
  foresightCounter: '반대 근거',
  foresightByBand: '수저별 차이는 게임의 설정입니다.',
} as const;

/** 줄의 읽기 이름 앞머리 「예측, 공식 전망 바탕.」 (근거 종류를 모르는 줄은 「예측.」) — 칩 글자는 시각용이라 이 글이 대신 읽힌다 (SPEC-010 구현 규칙 7) */
export function forecastReadName(basis: EraBasis | undefined): string {
  return basis === undefined ? `${SCENE_TEXT.forecast}.` : `${SCENE_TEXT.forecast}, ${SCENE_TEXT.forecastBasis[basis]}.`;
}

/** 근거 종류 글자를 누르는 단추의 접근 이름 = 「예측, 공식 전망 바탕. 근거 보기」 (눈에 보이는 글자를 그대로 담는다) */
export function foresightButtonName(basis: EraBasis): string {
  return `${forecastReadName(basis)} ${SCENE_TEXT.foresightOpen}`;
}

/**
 * 앞머리 「사람, 직함, 자료, 연도」(보도 기준이면 끝에 한 칸 더) — 뒤에 「: 요약」이 붙는다. 항목 넷·다섯이 한 줄을 넘는 나열이라 가운뎃점이 아니라 **쉼표 나열**이다(QM2-10 규칙 2 — `core/glue.ts#commaList`:
 * 가운뎃점 사슬은 한 줄에 들어가는 짧은 쌍에만 쓴다, 줄 가장자리에 기호가 혼자 남지 않게). SPEC-010 FU11의 「사람 · 직함 · 자료 · 연도」는 항목 순서의 뜻이다.
 */
export function foresightMeta(note: EraForesightNote): string {
  return commaList([note.who, note.role, note.work, `${note.year}년`, ...(note.reported === true ? [SCENE_TEXT.foresightReported] : [])]);
}

/** 근거 한 건의 글 전체 = 「앞머리: 요약 (+ 어긋나는 점)」 — 시험과 화면이 같은 함수를 쓴다 */
export function foresightText(note: EraForesightNote): string {
  return `${foresightMeta(note)}: ${note.said}${note.gap === undefined ? '' : ` ${note.gap}`}`;
}

/** 칸에 그릴 줄들 (근거 건마다 하나, 수저별 「먼저」 장면이면 끝에 설정 안내 한 줄) */
export function foresightLines(f: EraForesight): string[] {
  return [...f.notes.map(foresightText), ...(f.byBand === true ? [SCENE_TEXT.foresightByBand] : [])];
}

/** 시대의 창 칸이 읽어 주는 내용(SPEC-013 T3): 보이는 캡션 + 예측이면 「예측.」 + 첫 문장 + 둘째 문장(있으면) — 가린 해에는 가린 사건의 문장을 말하지 않는다 */
export interface EraSpoken {
  /** 보이는 캡션(가린 해의 「가려 둔 장면」 포함). 없으면 null */
  caption: string | null;
  /** 첫 문장 (가린 해에는 null — 문장이 가려져 있다) */
  line: string | null;
  /** 둘째 문장 (없으면 null) */
  second: string | null;
}

function eraSpokenText({ caption, line, second }: EraSpoken, forecast: boolean): string {
  const parts: string[] = [];
  if (caption !== null) parts.push(`${caption}.`);
  if (forecast) parts.push(`${SCENE_TEXT.forecast}.`);
  if (line !== null) parts.push(line);
  if (second !== null) parts.push(second);
  return parts.join(' ');
}

/**
 * 시대의 창 접근 이름 = 「캡션. (예측.) 첫 문장 둘째 문장 그해 기록으로」 (SPEC-013 T3 — 보이는 캡션 글자를 이름이 그대로 담는다, Label in Name). 가린 해는 캡션 「가려 둔 장면」 뒤에 문장이 없다.
 * 창의 말풍선(`title`) = 같은 글에서 「그해 기록으로」를 뺀 것.
 */
export function eraAccessibleName(spoken: EraSpoken, forecast = false): string {
  return `${eraSpokenText(spoken, forecast)} ${SCENE_TEXT.eraGo}`;
}
export function eraTitle(spoken: EraSpoken, forecast = false): string {
  return eraSpokenText(spoken, forecast);
}
