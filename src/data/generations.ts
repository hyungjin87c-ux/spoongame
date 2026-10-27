import { GENERATION_IDS, type GenerationId } from '../core/types';

/**
 * 세대 정의표 `GENERATIONS` (SPEC-004 GD1 — 이름·순서·출생 연도 범위는 형진 님 표, `docs/data/generations.md` 2절). 표시 이름·범위·BGM 참고 id만 갖는다.
 * 세대별 설정값(수저·교육방식·이름 풀·랜덤 가중)은 `data/generationConfig.ts#GENERATION_CONFIG`(NR6)가 갖는다.
 * 출생 연도 범위는 양 끝 포함이다. 1960~1963년은 베이비붐과 86세대 양쪽에서 나올 수 있다(GD2) — 저장되는 `generation`이 BGM 참고·엔딩 표기·소개를 정하고 출생 연도 자체가 달력을 정한다.
 */

/** BGM 장르 id (참고용 — 판의 음악 전환은 달력 연도만 입력으로 한다, BG3. 장르 엔진은 GM5) */
export const BGM_GENRE_IDS = ['trot', 'folk', 'citypop', 'njs', 'electropop', 'lofi', 'chiptune'] as const;
export type BgmGenreId = (typeof BGM_GENRE_IDS)[number];

export interface GenerationDef {
  id: GenerationId;
  /** 표시 이름 (GD1 표 그대로) */
  label: string;
  /** 릴 칸·좁은 자리용 줄임 이름 (copy.md 16-3: 산업화는 「산업화·전후 세대」) */
  short: string;
  /** 출생 연도(포함) */
  birth: { readonly from: number; readonly to: number };
  bgm: BgmGenreId;
}

/** 출생 연도 상한 — 알파 세대의 마지막 해. 2021년 이후 출생은 어느 세대에도 없다(r3: 「지금 세상」「다가올 세상」 없음) */
export const LAST_BIRTH_YEAR = 2020;
/** 출생 연도 하한 — 산업화 세대의 첫 해 (연표의 `FIRST_YEAR`와 같다) */
export const FIRST_BIRTH_YEAR = 1940;

export const GENERATIONS: readonly GenerationDef[] = [
  { id: 'industrial', label: '산업화 세대 · 전후 세대', short: '산업화·전후 세대', birth: { from: 1940, to: 1954 }, bgm: 'trot' },
  { id: 'boomer', label: '베이비붐 세대', short: '베이비붐 세대', birth: { from: 1955, to: 1963 }, bgm: 'folk' },
  { id: 'g86', label: '86세대', short: '86세대', birth: { from: 1960, to: 1969 }, bgm: 'citypop' },
  { id: 'genx', label: 'X세대', short: 'X세대', birth: { from: 1970, to: 1980 }, bgm: 'njs' },
  { id: 'millennial', label: '밀레니얼 세대', short: '밀레니얼 세대', birth: { from: 1981, to: 1996 }, bgm: 'electropop' },
  { id: 'genz', label: 'Z세대', short: 'Z세대', birth: { from: 1997, to: 2012 }, bgm: 'lofi' },
  { id: 'alpha', label: '알파 세대', short: '알파 세대', birth: { from: 2013, to: LAST_BIRTH_YEAR }, bgm: 'chiptune' },
];

/** 세대 정의 한 줄. 모르는 id면 throw */
export function generationDef(id: GenerationId): GenerationDef {
  const g = GENERATIONS.find((x) => x.id === id);
  if (g === undefined) throw new RangeError(`generationDef: 알 수 없는 세대 ${String(id)}`);
  return g;
}

/** 이 세대의 출생 연도 목록 (오름차순, 양 끝 포함) */
export function yearsOfGeneration(id: GenerationId): number[] {
  const { from, to } = generationDef(id).birth;
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** 이 출생 연도를 범위에 가진 세대들 (겹침 해 1960~1963은 둘) */
export function generationsOfYear(year: number): GenerationId[] {
  return GENERATIONS.filter((g) => year >= g.birth.from && year <= g.birth.to).map((g) => g.id);
}

export function isGenerationId(v: unknown): v is GenerationId {
  return typeof v === 'string' && (GENERATION_IDS as readonly string[]).includes(v);
}

/** 세대 7종 전체의 출생 연도 범위 (「랜덤 세대」 줄의 「1940~2020년생」) */
export const ALL_GENERATIONS_RANGE = { from: FIRST_BIRTH_YEAR, to: LAST_BIRTH_YEAR } as const;
