import type { Page } from '@playwright/test';

/**
 * e2e가 화면에 나온 이름·출처 표기를 대조할 때 쓰는 "원자료 직접 읽기". src의 풀 함수(core)를 거치지 않는다.
 * Playwright(Node)는 JSON을 직접 import할 수 없고 node 타입도 없어서, 개발 서버가 내주는 같은 파일을
 * 브라우저에서 fetch한다(e2e/helpers.ts#expectedBirth가 core를 불러오는 방식과 같다). 앱 페이지가 열려 있어야 한다.
 */
type Gender = 'male' | 'female';

export interface RawNames {
  scourt: { meta: { url: string; suggestedAttribution: string }; years: Record<string, Record<'M' | 'F', { name: string }[]>> };
  names: {
    meta: { attribution: { text: string; url: string } };
    decades: Record<string, Record<Gender, { verified: string[]; estimated: string[] }>>;
  };
}

export async function loadRawNames(page: Page): Promise<RawNames> {
  return page.evaluate<RawNames>(`(async () => {
    // 개발 서버(Vite)는 JSON 파일을 import가 아닌 일반 요청에는 파일 그대로 내준다 → 파일 내용을 직접 읽는다.
    const scourt = await (await fetch('/src/data/sources/scourt-birth-names.json')).json();
    const names = await (await fetch('/src/data/names.json')).json();
    return { scourt, names };
  })()`);
}

const col = (g: Gender) => (g === 'male' ? 'M' : 'F');

/** 출생 연도·성별에 허용되는 이름(성 제외) 목록. 시대별 규칙: 지난 1950~1989 연대 풀 / 지금 2008~2025 그 해 상위 20 / 다가올 2030~2060 2021~2025 합집합 */
export function allowedGivenNames(raw: RawNames, birthYear: number, gender: Gender): string[] {
  if (birthYear >= 1950 && birthYear <= 1989) {
    const d = raw.names.decades[String(Math.floor(birthYear / 10) * 10)][gender];
    return [...d.verified, ...d.estimated];
  }
  if (birthYear >= 2008 && birthYear <= 2025) return raw.scourt.years[String(birthYear)][col(gender)].map((r) => r.name);
  if (birthYear >= 2030 && birthYear <= 2060) {
    return [...new Set([2021, 2022, 2023, 2024, 2025].flatMap((y) => raw.scourt.years[String(y)][col(gender)].map((r) => r.name)))];
  }
  throw new Error(`${birthYear}년생은 어느 시대에도 속하지 않는다`);
}
