import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import faceSource from '../src/ui/Face.tsx?raw';
import cardsSource from '../src/ui/dash/Cards.tsx?raw';
import endingSource from '../src/screens/EndingScreen.tsx?raw';
import { AGE_GROUPS, LOOKS_TIER_MIN_SCORE, ageGroupOf, looksTierOf, type AgeGroupId, type LooksTier } from '../src/assets/faces/faceLayers';
import { FACE_PHOTO_SIZE, Face, hasFacePhotos, millennialFaceSrc } from '../src/ui/Face';

/**
 * 밀레니얼 얼굴 그림 80장 적용 (PL13, IMG-001, 결정 후속 267): 세대가 밀레니얼(출생 1981~1996)일 때만 `<img>`, 그 밖은 지금의 `<svg>`.
 * 로드 실패(onError) 대체는 DOM 없이 가짜 이벤트로 facePhotoError.test.tsx가, 실제 브라우저의 로드·요청은 e2e/face-photo.spec.ts가 본다.
 */
const GROUPS = AGE_GROUPS.map((g) => g.id);
const TIERS: LooksTier[] = [1, 2, 3, 4, 5];
const MILLENNIAL_YEAR = 1990;
const BASE: string = import.meta.env.BASE_URL;

const markup = (age: number, gender: 'female' | 'male', looks: number, birthYear?: number) => renderToStaticMarkup(<Face age={age} gender={gender} looks={looks} birthYear={birthYear} large />);
const srcOf = (html: string): string | null => /<img [^>]*?src="([^"]+)"/.exec(html)?.[1] ?? null;

describe('public/faces/millennial/: 80조합 파일이 모두 있다', () => {
  const fsSpec = 'node:fs';
  type Fs = { readdirSync(path: URL): string[]; readFileSync(path: URL): Uint8Array };
  const fsOf = async (): Promise<Fs> => (await import(/* @vite-ignore */ fsSpec)) as Fs;
  const dir = new URL('../public/faces/millennial/', import.meta.url);

  it('연령대 8 × 성별 2 × 단계 5 = 80개가 있고, 폴더에는 그 80개뿐이다', async () => {
    const fs = await fsOf();
    const expected: string[] = [];
    for (const g of GROUPS) for (const s of ['f', 'm']) for (const t of TIERS) expected.push(`millennial-${g}-${s}-t${t}-p1.webp`);
    expect(expected).toHaveLength(80);
    expect(fs.readdirSync(dir).sort()).toEqual([...expected].sort());
  });

  it('모두 WebP(RIFF…WEBP)이고 한 장이 12KB 이하다', async () => {
    const fs = await fsOf();
    for (const name of fs.readdirSync(dir)) {
      const buf = fs.readFileSync(new URL(name, dir));
      const tag = (a: number, b: number) => String.fromCharCode(...Array.from(buf.slice(a, b)));
      expect(tag(0, 4), name).toBe('RIFF');
      expect(tag(8, 12), name).toBe('WEBP');
      expect(buf.length, name).toBeLessThanOrEqual(12 * 1024);
    }
  });
});

describe('Face: 어느 세대가 사진 그림인가', () => {
  it('출생 1981~1996만 사진이고, 그 밖(1980·1997·산업화~Z·알파·없음)은 아니다', () => {
    for (const y of [1981, 1985, 1990, 1996]) expect(hasFacePhotos(y), String(y)).toBe(true);
    for (const y of [1940, 1960, 1970, 1980, 1997, 2005, 2013, 2020, undefined]) expect(hasFacePhotos(y), String(y)).toBe(false);
  });

  it('밀레니얼이 아니면 svg를 그리고 img는 없다 — 지금 그림 그대로(birthYear를 안 넘겨도 같다)', () => {
    for (const y of [1975, 1997, 2015, undefined]) {
      const html = markup(30, 'female', 50, y);
      expect(html, String(y)).toContain('<svg ');
      expect(html, String(y)).not.toContain('<img');
    }
    expect(markup(30, 'male', 50, 1975)).toBe(markup(30, 'male', 50));
  });

  it('밀레니얼이면 img이고 svg는 없다. 상자(.face·.face--lg·data-testid·data-age-group)는 SVG 때와 같다', () => {
    const html = markup(30, 'female', 50, MILLENNIAL_YEAR);
    expect(html).toContain('<img ');
    expect(html).not.toContain('<svg');
    expect(html).toMatch(/^<div class="face face--lg" data-testid="face" data-age-group="young"><img /);
  });

  it('이미지는 alt=""(장식)·width·height 192·loading=lazy·decoding=async이다', () => {
    const html = markup(30, 'male', 70, MILLENNIAL_YEAR);
    const tag = /<img [^>]*>/.exec(html)![0];
    expect(FACE_PHOTO_SIZE).toBe(192);
    expect(tag).toContain('alt=""');
    expect(tag).toContain('width="192"');
    expect(tag).toContain('height="192"');
    expect(tag).toContain('loading="lazy"');
    expect(tag).toContain('decoding="async"');
    expect(tag).not.toContain('aria-label');
  });
});

describe('Face: 고른 파일 이름 — 나이 경계 × 단계 경계', () => {
  const GROUP_AT: Array<[number, AgeGroupId]> = [
    [2, 'infant'], [3, 'toddler'], [6, 'toddler'], [7, 'child'], [12, 'child'], [13, 'teen'], [19, 'teen'], [20, 'young'],
    [39, 'young'], [40, 'middle'], [59, 'middle'], [60, 'senior'], [74, 'senior'], [75, 'elder'],
  ];
  /** [looks 값, 단계] — 각 경계의 −1과 0 */
  const TIER_AT: Array<[number, LooksTier]> = [[0, 1], [27, 1], [28, 2], [40, 2], [41, 3], [59, 3], [60, 4], [71, 4], [72, 5], [100, 5]];

  it('경계 값이 코드의 경계(LOOKS_TIER_MIN_SCORE)와 같은 칸이다 (이 표가 어긋나면 먼저 알린다)', () => {
    expect([...LOOKS_TIER_MIN_SCORE]).toEqual([0, 28, 41, 60, 72]);
    for (const [looks, tier] of TIER_AT) expect(looksTierOf(looks), String(looks)).toBe(tier);
    for (const [age, g] of GROUP_AT) expect(ageGroupOf(age), String(age)).toBe(g);
  });

  it('14개 나이 × 10개 점수 × 2성별에서 파일 이름이 millennial-<연령대>-<f|m>-t<단계>-p1.webp다 (base 경로 포함)', () => {
    let n = 0;
    for (const [age, group] of GROUP_AT)
      for (const [looks, tier] of TIER_AT)
        for (const [gender, letter] of [['female', 'f'], ['male', 'm']] as const) {
          const html = markup(age, gender, looks, MILLENNIAL_YEAR);
          expect(srcOf(html), `${age}세 looks ${looks} ${gender}`).toBe(`${BASE}faces/millennial/millennial-${group}-${letter}-t${tier}-p1.webp`);
          expect(html).toContain(`data-age-group="${group}"`);
          n++;
        }
    expect(n).toBe(14 * 10 * 2);
  });

  it('경로는 base 기준이다: GitHub Pages 하위 경로를 주면 그 아래를 가리킨다', () => {
    expect(millennialFaceSrc('young', 'female', 3, '/sub/')).toBe('/sub/faces/millennial/millennial-young-f-t3-p1.webp');
    expect(millennialFaceSrc('elder', 'male', 5, '/')).toBe('/faces/millennial/millennial-elder-m-t5-p1.webp');
  });

  it('쓰는 곳 두 군데(프로필 카드·엔딩)가 캐릭터의 출생 연도를 넘긴다', () => {
    expect(cardsSource).toContain('birthYear={c.birthYear}');
    expect(endingSource).toContain('birthYear={c.birthYear}');
  });
});

describe('Face.tsx 소스: 원시 HTML 삽입 없음', () => {
  it('dangerouslySetInnerHTML·innerHTML이 없다 (tests/innerHtml.test.ts와 같은 요구)', () => {
    expect(faceSource.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
  });
});
