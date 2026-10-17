import { IMPACT_KEYS, type ImpactItem, type ImpactKey } from '../core/impact';

/**
 * 선택지 영향 줄의 문구 (SPEC-003 M5 EC5, docs/design/copy.md 4절 — 항목 이름 7개 · 스크린리더 문장 42개 · 안내 한 줄). 데이터(항목·방향·칸 수)는 core/impact.ts가 만들고(`previewChoice`),
 * 이 파일은 그 데이터를 글자로 바꾼다. 어체는 합쇼체(D17). 화면 DOM에는 「·」 글자가 없고 이 파일에도 항목을 「 · 」로 잇는 함수가 없다 — 항목 사이의 「·」는 CSS가 그린다(design-system.md 11-9절, tests/glue.test.ts가 가운뎃점으로 잇는 목록 조립의 사용처를 잠근다).
 */

/** 화면에 보이는 항목 이름 (copy.md 4-1). 자산 카드의 「순자산」과 달리 영향 줄에는 「자산」을 쓴다 — 자산 점수 = Δ순자산 + 3 × Δ연 현금흐름이라서 */
export const IMPACT_LABEL: Record<ImpactKey, string> = {
  family: '집안 살림',
  assets: '자산',
  debt: '부채',
  relationships: '관계',
  happiness: '행복',
  health: '건강',
  education: '지식',
};

/** 주격 조사: 「자산이」「부채가」 (copy.md 4-1 「조사」 열) */
const SUBJECT_JOSA: Record<ImpactKey, '이' | '가'> = {
  family: '이',
  assets: '이',
  debt: '가',
  relationships: '가',
  happiness: '이',
  health: '이',
  education: '이',
};

/** 크기말: 1칸 「조금 」 · 2칸 (없음) · 3칸 「크게 」 (copy.md 4-2) */
const SIZE_WORD: Record<1 | 2 | 3, string> = { 1: '조금 ', 2: '', 3: '크게 ' };
const VERB = { up: '늘어납니다', down: '줄어듭니다' } as const;

/** 스크린리더 문장 42개: 키 `<항목>.<방향>.<칸 수>` (core/impact.ts#ImpactItem.sr와 같다). 형식 「{이름}{이/가} {크기말}{늘어납니다|줄어듭니다}.」 */
export const IMPACT_SR: Readonly<Record<string, string>> = (() => {
  const out: Record<string, string> = {};
  for (const key of IMPACT_KEYS) {
    for (const direction of ['up', 'down'] as const) {
      for (const steps of [1, 2, 3] as const) out[`${key}.${direction}.${steps}`] = `${IMPACT_LABEL[key]}${SUBJECT_JOSA[key]} ${SIZE_WORD[steps]}${VERB[direction]}.`;
    }
  }
  return out;
})();

/** 한 항목의 스크린리더 문장 (눈에 보이는 「자산 ▼▼▼」은 aria-hidden이고 이 문장만 읽힌다) */
export function impactSentence(item: ImpactItem): string {
  const s = IMPACT_SR[item.sr];
  if (s === undefined) throw new Error(`impactSentence: 문장 키가 없다 (${item.sr})`);
  return s;
}

/** 눈에 보이는 기호: ▲(값이 늘어남) 또는 ▼(줄어듦)를 칸 수만큼 */
export function impactSymbols(item: Pick<ImpactItem, 'direction' | 'steps'>): string {
  return (item.direction === 'up' ? '▲' : '▼').repeat(item.steps);
}

export type ImpactToneName = 'good' | 'bad';

/**
 * 기호의 색조 = 그 변화가 이로운지(good, `--c-up` 초록)·해로운지(bad, `--c-down` 붉음) (r2 마스터 결정, copy.md 4-1·4-8): 늘어남이 이로운 항목이 대부분이지만 **부채만 반대**다 —
 * 부채 ▲(빚이 늘어남)는 bad, 부채 ▼는 good. 색은 보조라 방향·크기는 기호 모양·개수가, 스크린리더는 문장이 전한다. 이 한 함수가 톤을 정한다 — 다른 곳에서 부채를 따로 가르지 않는다.
 */
export function impactTone(item: Pick<ImpactItem, 'key' | 'direction'>): ImpactToneName {
  if (item.key === 'debt') return item.direction === 'up' ? 'bad' : 'good';
  return item.direction === 'up' ? 'good' : 'bad';
}

/** 영향 줄 전체의 접근 가능한 글자 = 항목 문장을 공백 한 칸으로 이은 것 (copy.md 4-3) */
export function impactSrText(items: readonly ImpactItem[]): string {
  return items.map(impactSentence).join(' ');
}

/** 선택지 버튼의 접근 가능한 이름 = 「{선택지 이름} {영향 줄}」 (copy.md 4-3). 영향이 없으면 이름만 */
export function choiceAccessibleName(label: string, items: readonly ImpactItem[]): string {
  return items.length === 0 ? label : `${label} ${impactSrText(items)}`;
}

/** 선택지 묶음 아래 안내 한 줄 (copy.md 4-4). 둘째 문장은 눈에 보이는 글자(aria-hidden)와 스크린리더 대체 글자가 다르다(기호 이름이 읽히지 않게) */
export const IMPACT_HINT = {
  lead: (name: string): string => `선택지 아래 글씨는 지금 ${name}에게 일어날 변화입니다.`,
  symbols: '▲는 늘어남, ▼는 줄어듦이며 표시가 많을수록 변화가 큽니다.',
  symbolsSr: '위쪽 세모는 늘어남, 아래쪽 세모는 줄어듦이며 표시가 많을수록 변화가 큽니다.',
} as const;
