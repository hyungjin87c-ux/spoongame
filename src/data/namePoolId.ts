/**
 * 이름 풀의 종류와 키 (SPEC-004 NR4·G-03) — 데이터를 읽지 않는 작은 부분만 따로 둔다. 풀 자체(`data/names.ts`, 이름 풀 JSON 두 개)는 「태어나기」 뒤의 지연 덩어리에 있다(MG8·R-520).
 * `court`(연도 풀) 또는 `decade`(연대 풀 — 2000은 2000~2007).
 */
export type NamePoolId = { kind: 'court'; year: number } | { kind: 'decade'; decade: number };

/** 풀 id 글자 (`court-2013` · `decade-1990`) — GENERATION_CONFIG.namePool과 같은 체계 */
export function namePoolKey(id: NamePoolId): string {
  return id.kind === 'court' ? `court-${id.year}` : `decade-${id.decade}`;
}
