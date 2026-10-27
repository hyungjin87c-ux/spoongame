/**
 * 시·도 안정 키 17개 (SPEC-004 RG5 — 행정구역 연혁과 무관한 키)와 이름 (docs/data/dc2-dc7-regions-history.json `keys`, 줄임 이름은 룰렛·확률표·칩의 표기).
 * `now`는 DC2·DC7 자료 파일이 쓰는 현행 정식 이름이다. 이 파일은 첫 화면에서도 쓰는 작은 표라 지연 로드 덩어리에 넣지 않는다.
 */
export const REGION_KEYS = [
  { key: 'seoul', short: '서울', now: '서울특별시' },
  { key: 'busan', short: '부산', now: '부산광역시' },
  { key: 'daegu', short: '대구', now: '대구광역시' },
  { key: 'incheon', short: '인천', now: '인천광역시' },
  { key: 'gwangju', short: '광주', now: '광주광역시' },
  { key: 'daejeon', short: '대전', now: '대전광역시' },
  { key: 'ulsan', short: '울산', now: '울산광역시' },
  { key: 'sejong', short: '세종', now: '세종특별자치시' },
  { key: 'gyeonggi', short: '경기', now: '경기도' },
  { key: 'gangwon', short: '강원', now: '강원특별자치도' },
  { key: 'chungbuk', short: '충북', now: '충청북도' },
  { key: 'chungnam', short: '충남', now: '충청남도' },
  { key: 'jeonbuk', short: '전북', now: '전북특별자치도' },
  { key: 'jeonnam', short: '전남', now: '전라남도' },
  { key: 'gyeongbuk', short: '경북', now: '경상북도' },
  { key: 'gyeongnam', short: '경남', now: '경상남도' },
  { key: 'jeju', short: '제주', now: '제주특별자치도' },
] as const;

export type RegionKey = (typeof REGION_KEYS)[number]['key'];

export const REGION_KEY_LIST: readonly RegionKey[] = REGION_KEYS.map((r) => r.key);

export function isRegionKey(v: unknown): v is RegionKey {
  return typeof v === 'string' && (REGION_KEY_LIST as readonly string[]).includes(v);
}

export function regionShort(key: RegionKey): string {
  return REGION_KEYS.find((r) => r.key === key)!.short;
}

/**
 * 지금의 시·도 목록 16개 (RG1 직접 고르기 칩·RG3 내 출신 시도 설정의 선택지 — 2026-07-01 광주·전남 통합 반영, 룰렛 릴·확률표와 같은 줄임 이름).
 * 「전남광주」는 출생 연도 상한(2020) 앞에는 광주와 전라남도가 따로 있었으므로, 직접 고르면 그 해의 광주·전남 중 하나가 **그 해의 출생 비율대로** 뽑힌다(`MERGED_PICK`).
 */
export const CURRENT_REGION_NAMES = ['서울', '부산', '대구', '인천', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남광주', '경북', '경남', '제주'] as const;
export type CurrentRegionName = (typeof CURRENT_REGION_NAMES)[number];

/** 합쳐진 「전남광주」 칩의 이름 */
export const MERGED_PICK = '전남광주' as const;
/** 합쳐진 칩이 가리키는 옛 두 시·도 (출생 연도에는 따로 있었다) */
export const MERGED_PICK_PARTS: readonly [RegionKey, RegionKey] = ['gwangju', 'jeonnam'];

export function isCurrentRegionName(v: unknown): v is CurrentRegionName {
  return typeof v === 'string' && (CURRENT_REGION_NAMES as readonly string[]).includes(v);
}
