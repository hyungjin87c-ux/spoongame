import { ERAS, STAGES } from '../src/core/types';

/**
 * 소재 목록(docs/data/story-motifs.json) 점검의 순수 부분 — SPEC-002 T5 · SPEC-003 EV4~EV5 (M6c).
 * 파일 읽기·종료 코드는 scripts/validateMotifs.ts (`npm run check:motifs`)가 하고, 규칙은 여기에 모아 tests/validateMotifs.test.ts가 가짜 데이터로 확인한다.
 *
 * ## 점검 항목
 *  1. 구조: 최상위는 `categories`·`motifs` 둘뿐. 소재마다 필수 필드가 있고 정해진 필드 말고는 없다(T4: 위 필드 말고는 넣지 않는다).
 *  2. 값: id(m-###, 중복 없음)·category(분류표 안)·summary(15~60자)·stage(STAGES)·era(`all` 또는 ERAS 일부)·sensitivity(`normal`/`dark-real` — `excluded`는 목록에 올리지 않는다)·
 *     seenCount·sourceKind(`형진 님 제공` / `창작`)·collectedOn(실제 날짜)·usedBy(이벤트 id 목록).
 *  3. seenCount (SPEC-003 R3): 형진 님 제공 = 확인한 건수(정수, 1 이상 — SPEC-002 T3의 「2건 이상」을 R3가 완화) / 창작 = 읽은 글이 없으므로 정확히 0.
 *  4. 출처 표기: 형진 님 제공은 `sourceBoards`(「네이트판 톡톡 / <카테고리>」 수준까지만, 13개 카테고리 중 하나)가 필수이고, 창작에는 없다. `basisId`(s-###)는 창작에만.
 *  5. 금지 패턴(T4·T5): summary에 URL·`@`계정·전화번호 모양·따옴표·인용 부호(《》〈〉 포함)·날짜·시각 모양(작성일시)·「~님」 호칭(「손님」은 일반 명사라 허용)이 없다.
 *  6. 원문 겹침(CSV가 있을 때만): 어떤 글이 원문 제목과 6자 이상 연속으로 같거나(공백·구두점 무시) 제목 전체(5자 이상)를 포함하면 실패한다.
 *     **대상은 소재 요약(json)만이 아니다**(REV-003-M6c-1 R-100): 아이디어 문서·출처 문서의 표 칸과 본문 줄, 테스트 파일의 문자열 리터럴·주석, 이번 M6c의 ai-log·REV 문서까지
 *     기본 목록(`DEFAULT_EXTRA_TARGETS`)에 고정해 `npm run check:motifs -- <CSV>` 한 번에 본다. 다른 파일은 `--extra <파일…>`로 더한다.
 *     CSV 제목은 **링크 열 앞까지만** 읽는다(`titlesFromCsv`) — 따옴표 없는 쉼표 때문에 제목이 여러 칸으로 쪼개져도 제목 뒤 URL은 제목이 아니다.
 *     실패 메시지에는 파일·줄·위치·길이만 적고 **제목 글자는 적지 않는다**(터미널·로그에도 원문을 남기지 않는다, T4).
 *  7. 분량(EV5): 총 130건 이상▲, 건수 5 이상인 분류 10개 이상▲. 형진 님 제공분만 있는 동안은 경고, `--strict`면 실패.
 *  8. 일관성: 소재 id는 번호순으로 늘어나기만 한다(결번 재사용 금지 — 지운 소재의 번호는 비워 둔다). 형진 님 제공 소재의 `sourceBoards` 수는 `seenCount`를 넘지 못한다(한 제목은 한 카테고리에서 왔다).
 */

// ---------- 상수 ----------

export const SUMMARY_MIN = 15;
export const SUMMARY_MAX = 60;
export const OVERLAP_WINDOW = 6;
export const FULL_TITLE_MIN = 5;

export const SOURCE_KIND_PROVIDED = '형진 님 제공';
export const SOURCE_KIND_CREATED = '창작';
export const SOURCE_KINDS = [SOURCE_KIND_PROVIDED, SOURCE_KIND_CREATED] as const;

/** 수위 (SPEC-002 Q3 확정: normal / dark-real, excluded는 목록에 올리지 않는다) */
export const SENSITIVITIES = ['normal', 'dark-real'] as const;

export const SOURCE_BOARD_PREFIX = '네이트판 톡톡 / ';
/** 형진 님이 건넨 목록의 톡톡 카테고리 13개 (이름은 건네받은 파일의 표기 그대로). 대응표는 docs/data/story-motifs-sources.md */
export const TOKTOK_BOARDS = [
  '결혼/시집/친정',
  '맞벌이 부부 이야기',
  '임신/출산/육아',
  '남자들의 속깊은이야기',
  '지금은 연애중',
  '헤어진 다음날',
  '군화와 고무신',
  '군대일기',
  '회사생활',
  '취업과 면접',
  '알바 경험담',
  '백수&백조 이야기',
  '해석 남/여',
] as const;

export const TARGET_TOTAL = 130;
export const TARGET_CATEGORIES = 10;
export const TARGET_PER_CATEGORY = 5;

const ALLOWED_KEYS = ['id', 'category', 'summary', 'stage', 'era', 'sensitivity', 'seenCount', 'sourceKind', 'sourceBoards', 'collectedOn', 'usedBy', 'basisId'] as const;
const REQUIRED_KEYS = ['id', 'category', 'summary', 'stage', 'era', 'sensitivity', 'seenCount', 'sourceKind', 'collectedOn', 'usedBy'] as const;

// ---------- 금지 패턴 (T4·T5) ----------

export interface ForbiddenPattern {
  name: string;
  /** 걸리면 true */
  test(text: string): boolean;
}

const URL_RE = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|kr|io|me|tv|app|dev|xyz)\b/i;
const ACCOUNT_RE = /(?:^|[^A-Za-z0-9_])@[A-Za-z0-9_.]{2,}/;
const PHONE_RE = /(?:\+?82[-.\s]?\d{1,2}|0\d{1,2})[-.\s]?\d{3,4}[-.\s]?\d{4}\b|\b\d{9,}\b/;
/** 따옴표와 인용 부호(《》〈〉 포함, R-108) */
const QUOTE_RE = /["'“”‘’「」『』《》〈〉`]/;
/**
 * 날짜·시각 모양 = 글의 작성일시가 새어 들어올 길 (T4: 작성일시는 어디에도 남기지 않는다, R-108).
 * 연-월-일(구분자는 - . /), 두 자리씩 점으로 나눈 날짜, 시:분, 연·월 표기, 월·일 표기, 오전/오후 시각.
 */
const DATE_TIME_RE =
  /\d{4}\s*[-./]\s*\d{1,2}\s*[-./]\s*\d{1,2}|\b\d{2}\.\d{2}\.\d{2}\b|\d{1,2}\s*[:：]\s*\d{2}|\d{4}\s*년\s*\d{1,2}\s*월|\d{1,2}\s*월\s*\d{1,2}\s*일|(?:오전|오후)\s*\d{1,2}\s*시/;
/** 「손님」처럼 님으로 끝나는 일반 명사. 호칭 점검 전에 지운다 */
const NIM_NOUN_RE = /손님/g;
const HONORIFIC_RE = /(?:^|\s)님|[가-힣]님/;

export const FORBIDDEN_PATTERNS: readonly ForbiddenPattern[] = [
  { name: 'URL', test: (t) => URL_RE.test(t) },
  { name: '@계정', test: (t) => ACCOUNT_RE.test(t) },
  { name: '전화번호 모양', test: (t) => PHONE_RE.test(t) },
  { name: '따옴표 인용', test: (t) => QUOTE_RE.test(t) },
  { name: '날짜·시각 모양', test: (t) => DATE_TIME_RE.test(t) },
  { name: '「~님」 호칭', test: (t) => HONORIFIC_RE.test(t.replace(NIM_NOUN_RE, '')) },
];

/** 걸린 금지 패턴 이름들 */
export function forbiddenPatternProblems(text: string): string[] {
  return FORBIDDEN_PATTERNS.filter((p) => p.test(text)).map((p) => p.name);
}

/** 경고만 하는 식별 의심 (실존 상호·구체적 지명). 창작 소재에 정상 표현이 걸릴 수 있어 실패로 만들지 않고 사람이 본다 */
const IDENTITY_HINT_RE =
  /삼성|현대자동차|네이버|카카오|쿠팡|당근|롯데|스타벅스|맥도날드|유튜브|인스타|넷플릭스|구글|애플|서울|부산|대구|인천|광주|대전|울산|세종|제주|경기도|강원도|충청|전라|경상|\d{4}\s*년/;

export function identityHints(text: string): string[] {
  const m = IDENTITY_HINT_RE.exec(text);
  return m === null ? [] : [m[0]];
}

// ---------- 값 검사 ----------

export interface ValidateOptions {
  /** 분량 기준 미달을 실패로 본다(기본: 경고만). 형진 님 제공분 + 창작 보충이 끝난 뒤 쓴다 */
  strictCoverage?: boolean;
  minTotal?: number;
  minCategories?: number;
  minPerCategory?: number;
}

export interface MotifStats {
  total: number;
  provided: number;
  created: number;
  byCategory: Record<string, number>;
  bySensitivity: Record<string, number>;
  seenCountOne: number;
  seenCountSum: number;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  stats: MotifStats;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 사용자가 보는 글자 수(UTF-16이 아니라 코드 포인트) */
export function charCount(s: string): number {
  return Array.from(s).length;
}

function isRealDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m === null) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function hasDuplicates(list: readonly string[]): boolean {
  return new Set(list).size !== list.length;
}

const EVENT_ID_RE = /^[a-z][a-z0-9-]{1,47}$/;
const MOTIF_ID_RE = /^m-\d{3}$/;
const BASIS_ID_RE = /^s-\d{3}$/;

export function validateMotifs(data: unknown, options: ValidateOptions = {}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats: MotifStats = { total: 0, provided: 0, created: 0, byCategory: {}, bySensitivity: {}, seenCountOne: 0, seenCountSum: 0 };

  if (!isRecord(data)) return { errors: ['최상위가 객체가 아니다'], warnings, stats };
  for (const k of Object.keys(data)) if (k !== 'categories' && k !== 'motifs') errors.push(`최상위에 알 수 없는 항목이 있다: ${k} (categories·motifs만 쓴다)`);

  // 분류표
  let categories: string[] = [];
  if (!isStringArray(data.categories) || data.categories.length === 0) errors.push('categories는 비어 있지 않은 문자열 목록이어야 한다');
  else {
    categories = data.categories;
    if (hasDuplicates(categories)) errors.push('categories에 중복이 있다');
    categories.forEach((c) => {
      if (c.trim() === '' || c !== c.trim()) errors.push(`분류 이름이 비었거나 앞뒤 공백이 있다: 「${c}」`);
      const bad = forbiddenPatternProblems(c);
      if (bad.length > 0) errors.push(`분류 이름에 금지 패턴(${bad.join('·')})이 있다`);
    });
  }

  if (!Array.isArray(data.motifs)) {
    errors.push('motifs는 배열이어야 한다');
    return { errors, warnings, stats };
  }

  const seenIds = new Set<string>();
  const seenSummaries = new Set<string>();
  const boardSet = new Set<string>(TOKTOK_BOARDS.map((b) => SOURCE_BOARD_PREFIX + b));
  /** 앞 소재의 id 번호 (번호는 늘어나기만 한다 — 지운 소재의 번호를 다시 쓰지 못하게) */
  let lastIdNumber = 0;

  data.motifs.forEach((raw: unknown, index: number) => {
    const where = isRecord(raw) && typeof raw.id === 'string' ? raw.id : `motifs[${index}]`;
    const err = (msg: string) => errors.push(`${where}: ${msg}`);
    if (!isRecord(raw)) return err('소재가 객체가 아니다');
    const m = raw;

    for (const k of Object.keys(m)) if (!(ALLOWED_KEYS as readonly string[]).includes(k)) err(`알 수 없는 필드: ${k} (정해진 필드 말고는 넣지 않는다, T4)`);
    for (const k of REQUIRED_KEYS) if (!(k in m)) err(`필수 필드가 없다: ${k}`);

    // id
    if (typeof m.id !== 'string' || !MOTIF_ID_RE.test(m.id)) err('id는 m-### 형식(예: m-001)이어야 한다');
    else if (seenIds.has(m.id)) err('id가 중복이다');
    else {
      seenIds.add(m.id);
      const idNumber = Number(m.id.slice(2));
      if (idNumber <= lastIdNumber) err(`id 번호가 앞 소재(m-${String(lastIdNumber).padStart(3, '0')})보다 커야 한다 — 번호는 늘어나기만 하고 지운 소재의 번호는 비워 둔다`);
      lastIdNumber = Math.max(lastIdNumber, idNumber);
    }

    // category
    if (typeof m.category !== 'string') err('category가 문자열이 아니다');
    else if (!categories.includes(m.category)) err(`category가 분류표에 없다: ${m.category}`);

    // summary
    if (typeof m.summary !== 'string') err('summary가 문자열이 아니다');
    else {
      const s = m.summary;
      const n = charCount(s);
      if (n < SUMMARY_MIN || n > SUMMARY_MAX) err(`summary 길이가 ${SUMMARY_MIN}~${SUMMARY_MAX}자가 아니다 (${n}자)`);
      if (s !== s.trim()) err('summary 앞뒤에 공백이 있다');
      if (/[\r\n\t]/.test(s)) err('summary에 줄바꿈·탭이 있다 (한 줄 요약)');
      const bad = forbiddenPatternProblems(s);
      if (bad.length > 0) err(`summary에 금지 패턴이 있다: ${bad.join('·')}`);
      const hints = identityHints(s);
      if (hints.length > 0) warnings.push(`${where}: summary에 식별 의심 표현이 있다(${hints.join('·')}) — 사람이 확인한다`);
      if (seenSummaries.has(s)) err('summary가 다른 소재와 똑같다');
      else seenSummaries.add(s);
    }

    // stage
    if (!isStringArray(m.stage) || m.stage.length === 0) err('stage는 비어 있지 않은 문자열 목록이어야 한다');
    else {
      if (hasDuplicates(m.stage)) err('stage에 중복이 있다');
      for (const s of m.stage) if (!(STAGES as readonly string[]).includes(s)) err(`stage 값이 올바르지 않다: ${s} (${STAGES.join('·')})`);
    }

    // era
    if (!isStringArray(m.era) || m.era.length === 0) err('era는 비어 있지 않은 문자열 목록이어야 한다');
    else {
      if (hasDuplicates(m.era)) err('era에 중복이 있다');
      if (m.era.includes('all')) {
        if (m.era.length !== 1) err('era에 all을 쓰면 다른 값과 섞지 않는다');
      } else for (const e of m.era) if (!(ERAS as readonly string[]).includes(e)) err(`era 값이 올바르지 않다: ${e} (all 또는 ${ERAS.join('·')})`);
    }

    // sensitivity
    if (typeof m.sensitivity !== 'string' || !(SENSITIVITIES as readonly string[]).includes(m.sensitivity)) {
      err(m.sensitivity === 'excluded' ? 'excluded 수위 소재는 목록에 올리지 않는다 (T6)' : `sensitivity는 ${SENSITIVITIES.join(' / ')} 중 하나여야 한다`);
    } else stats.bySensitivity[m.sensitivity] = (stats.bySensitivity[m.sensitivity] ?? 0) + 1;

    // sourceKind · seenCount · sourceBoards · basisId
    const kind = m.sourceKind;
    if (kind !== SOURCE_KIND_PROVIDED && kind !== SOURCE_KIND_CREATED) err(`sourceKind는 「${SOURCE_KIND_PROVIDED}」 또는 「${SOURCE_KIND_CREATED}」여야 한다`);
    const seen = m.seenCount;
    if (typeof seen !== 'number' || !Number.isInteger(seen) || seen < 0) err('seenCount는 0 이상의 정수여야 한다');
    else if (kind === SOURCE_KIND_PROVIDED && seen < 1) err('형진 님 제공 소재의 seenCount는 1 이상이어야 한다 (R3: 확인한 건수)');
    else if (kind === SOURCE_KIND_CREATED && seen !== 0) err('창작 소재의 seenCount는 0이어야 한다 (읽은 글이 없다)');
    if (kind === SOURCE_KIND_PROVIDED) {
      if (!isStringArray(m.sourceBoards) || m.sourceBoards.length === 0) err('형진 님 제공 소재에는 sourceBoards(네이트판 톡톡 / 카테고리)가 필요하다');
      else {
        if (hasDuplicates(m.sourceBoards)) err('sourceBoards에 중복이 있다');
        for (const b of m.sourceBoards) if (!boardSet.has(b)) err(`sourceBoards 값이 「${SOURCE_BOARD_PREFIX}<톡톡 카테고리>」 형식이 아니거나 모르는 카테고리다`);
        // 한 제목은 한 카테고리에서 왔으므로, 서로 다른 카테고리 수는 제목 수(seenCount)를 넘을 수 없다 (R-108)
        if (typeof seen === 'number' && Number.isInteger(seen) && m.sourceBoards.length > seen) {
          err(`sourceBoards 수(${m.sourceBoards.length})가 seenCount(${seen})보다 많다 — 한 제목은 한 카테고리에서 왔으므로 카테고리 수는 제목 수를 넘지 못한다`);
        }
      }
    } else if (kind === SOURCE_KIND_CREATED && 'sourceBoards' in m) err('창작 소재에는 sourceBoards를 쓰지 않는다 (창작을 실제 사연처럼 표기하지 않는다)');
    if ('basisId' in m) {
      if (typeof m.basisId !== 'string' || !BASIS_ID_RE.test(m.basisId)) err('basisId는 s-### 형식이어야 한다');
      else if (kind !== SOURCE_KIND_CREATED) err('basisId는 창작 소재에만 쓴다');
    }

    // collectedOn · usedBy
    if (typeof m.collectedOn !== 'string' || !isRealDate(m.collectedOn)) err('collectedOn은 실제 날짜(YYYY-MM-DD)여야 한다');
    if (!isStringArray(m.usedBy)) err('usedBy는 이벤트 id 문자열 목록이어야 한다');
    else {
      if (hasDuplicates(m.usedBy)) err('usedBy에 중복이 있다');
      for (const u of m.usedBy) if (!EVENT_ID_RE.test(u)) err(`usedBy에 이벤트 id 형식이 아닌 값이 있다: ${u}`);
    }

    // 통계
    stats.total++;
    if (kind === SOURCE_KIND_PROVIDED) stats.provided++;
    if (kind === SOURCE_KIND_CREATED) stats.created++;
    if (typeof m.category === 'string') stats.byCategory[m.category] = (stats.byCategory[m.category] ?? 0) + 1;
    if (typeof seen === 'number') {
      stats.seenCountSum += seen;
      if (seen === 1) stats.seenCountOne++;
    }
  });

  // 분량 (EV5)
  const minTotal = options.minTotal ?? TARGET_TOTAL;
  const minCategories = options.minCategories ?? TARGET_CATEGORIES;
  const minPerCategory = options.minPerCategory ?? TARGET_PER_CATEGORY;
  const strict = options.strictCoverage === true;
  const note = (msg: string) => (strict ? errors : warnings).push(msg);
  if (stats.total < minTotal) note(`소재 총량이 ${minTotal}건 미만이다 (${stats.total}건)`);
  const enough = categories.filter((c) => (stats.byCategory[c] ?? 0) >= minPerCategory).length;
  if (enough < minCategories) note(`${minPerCategory}건 이상인 분류가 ${minCategories}개 미만이다 (${enough}개)`);
  for (const c of categories) if ((stats.byCategory[c] ?? 0) === 0) warnings.push(`분류 「${c}」에 소재가 없다`);

  return { errors, warnings, stats };
}

// ---------- CSV (원문 겹침 점검용) ----------

/** 따옴표·쉼표·줄바꿈이 들어간 칸을 처리하는 최소 CSV 파서. 맨 앞 BOM은 지운다. 빈 줄은 건너뛴다 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endRow = () => {
    row.push(field);
    field = '';
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      endRow();
    } else field += c;
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

const URL_START_RE = /^\s*(?:https?:\/\/|www\.)/i;

/**
 * 머리 줄에서 제목 열을 찾고 그 열의 값(비지 않은 것)만 모은다. 제목 열이 없으면 오류.
 *
 * **제목은 링크 열 앞까지만이다** (R-100). 제목에 따옴표 없는 쉼표가 들어 있으면 한 행이 머리 줄보다 칸이 많아져 제목이 여러 칸으로 쪼개진다 —
 * 그 경우 쪼개진 칸을 이어 붙여 하나의 제목으로 읽되, 링크 열(`원문_링크` 등)부터는 제목이 아니므로 버린다.
 * 링크 열을 못 찾아도 URL로 시작하는 칸이 나오면 거기서 멈추고, 제목 칸 안에 URL이 섞여 있으면 URL 앞까지만 쓴다.
 */
export function titlesFromCsv(text: string): string[] {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error('CSV가 비어 있다');
  const header = rows[0].map((h) => h.trim());
  let col = header.indexOf('게시글_제목');
  if (col < 0) col = header.findIndex((h) => h.includes('제목'));
  if (col < 0) throw new Error('CSV 머리 줄에서 제목 열(게시글_제목)을 찾지 못했다');
  const linkCol = header.findIndex((h, i) => i > col && /링크|link|url/i.test(h));
  const titles: string[] = [];
  for (const r of rows.slice(1)) {
    let parts: string[];
    if (linkCol > col) {
      // 링크 열 앞까지: 행이 머리 줄보다 길면 늘어난 칸만큼이 제목 쪽에 속한다
      const end = Math.max(col + 1, linkCol + (r.length - header.length));
      parts = r.slice(col, Math.min(end, r.length));
    } else {
      // 링크 열을 모르면 제목 칸 하나만, 단 뒤에 URL로 시작하는 칸이 나오면 그 앞까지가 제목이다
      const rest = r.slice(col);
      const firstUrl = rest.findIndex((p, i) => i > 0 && URL_START_RE.test(p));
      parts = firstUrl > 0 ? rest.slice(0, firstUrl) : rest.slice(0, 1);
    }
    // URL로 시작하는 칸부터는 제목이 아니다 (제목 칸 자신은 제외하고 본다)
    const urlAt = parts.findIndex((p, i) => i > 0 && URL_START_RE.test(p));
    if (urlAt > 0) parts = parts.slice(0, urlAt);
    let title = parts.map((p) => p.trim()).join(' ');
    const inline = /https?:\/\/|www\./i.exec(title);
    if (inline !== null) title = title.slice(0, inline.index);
    title = title.trim();
    if (title !== '') titles.push(title);
  }
  return titles;
}

// ---------- 원문 겹침 ----------

/** 공백·구두점·기호를 지우고 소문자로 만든 글자(코드 포인트) 배열. 띄어쓰기만 바꿔 피하는 것을 막는다 */
export function normalizeForOverlap(s: string): string[] {
  return Array.from(s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''));
}

export interface Overlap {
  /** 가장 길게 겹치는 구간의 길이 */
  length: number;
  /** 정규화한 요약에서 그 구간이 시작하는 위치(0부터) */
  summaryStart: number;
}

/** 두 글자 배열이 window자 이상 연속으로 같은 구간이 있으면 가장 긴 것을, 없으면 null */
export function findOverlap(summary: readonly string[], title: readonly string[], window = OVERLAP_WINDOW): Overlap | null {
  if (summary.length < window || title.length < window) return null;
  const grams = new Map<string, number[]>();
  for (let t = 0; t + window <= title.length; t++) {
    const g = title.slice(t, t + window).join('');
    const list = grams.get(g);
    if (list === undefined) grams.set(g, [t]);
    else list.push(t);
  }
  let best: Overlap | null = null;
  for (let s = 0; s + window <= summary.length; s++) {
    const starts = grams.get(summary.slice(s, s + window).join(''));
    if (starts === undefined) continue;
    for (const t of starts) {
      let a = s;
      let b = t;
      while (a > 0 && b > 0 && summary[a - 1] === title[b - 1]) {
        a--;
        b--;
      }
      let len = window + (s - a);
      while (a + len < summary.length && b + len < title.length && summary[a + len] === title[b + len]) len++;
      if (best === null || len > best.length) best = { length: len, summaryStart: a };
    }
  }
  return best;
}

export interface OverlapProblem {
  motifId: string;
  /** 데이터 행 번호(머리 줄 제외, 1부터) */
  row: number;
  kind: 'window' | 'whole-title';
  length: number;
  summaryStart: number;
}

// ----- 제목 색인: 제목이 650개여도 글이 수천 개여도 빠르게 (3글자 조각 → 제목 위치) -----

/** 색인 조각 길이. 최장 일치 길이를 3자부터 잴 수 있어 「파일별 최대 일치 길이」 보고에도 쓴다 */
export const INDEX_GRAM = 3;

export interface TitleIndex {
  /** 정규화한 제목들 (색인의 번호 = CSV 데이터 행 번호 - 1) */
  titles: ReadonlyArray<readonly string[]>;
  /** 제목마다 이어 붙인 문자열 */
  joined: readonly string[];
  grams: ReadonlyMap<string, ReadonlyArray<readonly [number, number]>>;
}

export function buildTitleIndex(titles: readonly string[]): TitleIndex {
  const norm = titles.map(normalizeForOverlap);
  const grams = new Map<string, Array<readonly [number, number]>>();
  norm.forEach((t, ti) => {
    for (let p = 0; p + INDEX_GRAM <= t.length; p++) {
      const g = t.slice(p, p + INDEX_GRAM).join('');
      const list = grams.get(g);
      if (list === undefined) grams.set(g, [[ti, p]]);
      else list.push([ti, p]);
    }
  });
  return { titles: norm, joined: norm.map((t) => t.join('')), grams };
}

export interface IndexHit {
  /** CSV 데이터 행 번호 (머리 줄 제외, 1부터) */
  row: number;
  /** 연속으로 같은 글자 수 */
  length: number;
  /** 정규화한 글에서 그 구간이 시작하는 위치(0부터) */
  start: number;
}

/** 정규화한 글 하나와 제목 하나하나의 최장 연속 일치 (제목마다 가장 긴 것 하나, minLength 이상만, 행 번호순) */
export function overlapsInIndex(unit: readonly string[], index: TitleIndex, minLength = OVERLAP_WINDOW): IndexHit[] {
  const best = new Map<number, IndexHit>();
  for (let s = 0; s + INDEX_GRAM <= unit.length; s++) {
    const occurrences = index.grams.get(unit.slice(s, s + INDEX_GRAM).join(''));
    if (occurrences === undefined) continue;
    for (const [ti, tp] of occurrences) {
      const t = index.titles[ti];
      let len = INDEX_GRAM;
      while (s + len < unit.length && tp + len < t.length && unit[s + len] === t[tp + len]) len++;
      if (len < minLength) continue;
      const cur = best.get(ti);
      if (cur === undefined || len > cur.length) best.set(ti, { row: ti + 1, length: len, start: s });
    }
  }
  return [...best.values()].sort((a, b) => a.row - b.row);
}

/** 정규화한 글 하나와 모든 제목 사이의 가장 긴 연속 일치 하나 (3자 미만이면 null). 같은 길이면 앞 행·앞 위치 */
export function longestOverlap(unit: readonly string[], index: TitleIndex): IndexHit | null {
  let best: IndexHit | null = null;
  for (let s = 0; s + INDEX_GRAM <= unit.length; s++) {
    const occurrences = index.grams.get(unit.slice(s, s + INDEX_GRAM).join(''));
    if (occurrences === undefined) continue;
    for (const [ti, tp] of occurrences) {
      const t = index.titles[ti];
      let len = INDEX_GRAM;
      while (s + len < unit.length && tp + len < t.length && unit[s + len] === t[tp + len]) len++;
      if (best === null || len > best.length || (len === best.length && ti + 1 < best.row)) best = { row: ti + 1, length: len, start: s };
    }
  }
  return best;
}

/** 글이 5자 이상 window자 미만의 짧은 제목 전체를 그대로 담고 있는지 (첫 번째 하나) */
export function wholeTitleHit(unit: readonly string[], index: TitleIndex, window = OVERLAP_WINDOW): IndexHit | null {
  const joined = unit.join('');
  for (let i = 0; i < index.joined.length; i++) {
    const t = index.joined[i];
    const n = index.titles[i].length;
    if (n >= FULL_TITLE_MIN && n < window && joined.includes(t)) return { row: i + 1, length: n, start: joined.indexOf(t) };
  }
  return null;
}

/** 모든 소재 요약을 모든 원문 제목과 대조한다. 제목 글자는 결과에 담지 않는다 */
export function checkOverlap(motifs: ReadonlyArray<{ id: string; summary: string }>, titles: readonly string[], window = OVERLAP_WINDOW): OverlapProblem[] {
  return checkOverlapIndexed(motifs, buildTitleIndex(titles), window);
}

/** `checkOverlap`과 같되 이미 만든 색인을 쓴다 (같은 제목들을 여러 번 대조할 때) */
export function checkOverlapIndexed(motifs: ReadonlyArray<{ id: string; summary: string }>, index: TitleIndex, window = OVERLAP_WINDOW): OverlapProblem[] {
  const out: OverlapProblem[] = [];
  for (const m of motifs) {
    const s = normalizeForOverlap(m.summary);
    const joined = s.join('');
    const mine: OverlapProblem[] = overlapsInIndex(s, index, window).map((h) => ({ motifId: m.id, row: h.row, kind: 'window', length: h.length, summaryStart: h.start }));
    const seenRows = new Set(mine.map((p) => p.row));
    // 5자 이상 window자 미만의 짧은 제목은 요약 안에 통째로 들어 있는지 본다
    index.joined.forEach((t, i) => {
      const n = index.titles[i].length;
      if (n >= FULL_TITLE_MIN && n < window && !seenRows.has(i + 1) && joined.includes(t)) {
        mine.push({ motifId: m.id, row: i + 1, kind: 'whole-title', length: n, summaryStart: joined.indexOf(t) });
      }
    });
    out.push(...mine.sort((a, b) => a.row - b.row));
  }
  return out;
}

export function overlapMessage(p: OverlapProblem): string {
  const from = p.summaryStart + 1;
  const to = p.summaryStart + p.length;
  return p.kind === 'window'
    ? `${p.motifId}: 요약(공백·구두점 제외)의 ${from}~${to}번째 글자(${p.length}자)가 CSV ${p.row}번째 데이터 행의 제목과 연속으로 같다 — 다른 말로 다시 쓴다`
    : `${p.motifId}: 요약이 CSV ${p.row}번째 데이터 행의 제목 전체(${p.length}자)를 그대로 포함한다 — 다른 말로 다시 쓴다`;
}

// ---------- 원문 겹침: 요약 말고 다른 글(문서·테스트·로그)까지 (R-100) ----------

/** 한 번에 대조하는 글 한 덩어리: 표 칸 하나 · 본문 한 줄 · 문자열 리터럴 하나 · 주석 한 줄 */
export interface TextUnit {
  /** 파일 안 줄 번호 (1부터) */
  line: number;
  /** 어떤 덩어리인가 (예: `표 3번째 칸`, `줄`, `문자열`, `주석`) */
  part: string;
  text: string;
}

const CODE_EXT_RE = /\.(?:ts|tsx|js|jsx|mjs|cjs|json)$/i;
const MARKDOWN_EXT_RE = /\.(?:md|markdown)$/i;
const LITERAL_RE = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;

/** 마크다운: 표 줄은 칸마다, 나머지는 줄마다 (칸을 이어 붙이면 칸 경계에서 우연히 겹쳐 보이므로 따로 본다) */
function unitsFromMarkdown(text: string): TextUnit[] {
  const units: TextUnit[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line === '') return;
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1);
      if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop();
      cells.forEach((cell, c) => {
        const t = cell.trim();
        if (t === '' || /^:?-{2,}:?$/.test(t)) return;
        units.push({ line: i + 1, part: `표 ${c + 1}번째 칸`, text: t });
      });
    } else units.push({ line: i + 1, part: '줄', text: line });
  });
  return units;
}

/**
 * 코드·JSON: 문자열 리터럴 하나하나와 주석. 한 줄 안에서 닫히지 않는 템플릿 리터럴(여러 줄)은 닫힐 때까지 줄 전체를 글로 본다.
 * 줄 단위의 가벼운 읽기라서 정규식 리터럴 속 따옴표 같은 것에는 틀릴 수 있지만, 틀려도 더 많이 보는 쪽(빠뜨리지는 않는다)이다.
 */
function unitsFromCode(text: string): TextUnit[] {
  const units: TextUnit[] = [];
  let inTemplate = false;
  let inBlockComment = false;
  text.split(/\r?\n/).forEach((raw, i) => {
    const lineNo = i + 1;
    const trimmed = raw.trim();
    if (trimmed === '') return;
    if (inBlockComment) {
      units.push({ line: lineNo, part: '주석', text: trimmed });
      if (trimmed.includes('*/')) inBlockComment = false;
      return;
    }
    if (inTemplate) {
      units.push({ line: lineNo, part: '문자열', text: trimmed });
      if (trimmed.includes('`')) inTemplate = false;
      return;
    }
    if (trimmed.startsWith('/*')) {
      units.push({ line: lineNo, part: '주석', text: trimmed });
      if (!trimmed.includes('*/')) inBlockComment = true;
      return;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
      units.push({ line: lineNo, part: '주석', text: trimmed });
      return;
    }
    let rest = raw;
    for (const m of raw.matchAll(LITERAL_RE)) {
      const body = m[1] ?? m[2] ?? m[3] ?? '';
      if (body.trim() !== '') units.push({ line: lineNo, part: '문자열', text: body });
      rest = rest.replace(m[0], ' '.repeat(m[0].length));
    }
    const comment = rest.indexOf('//');
    if (comment >= 0 && rest.slice(comment + 2).trim() !== '') units.push({ line: lineNo, part: '주석', text: rest.slice(comment + 2).trim() });
    if (rest.includes('`')) {
      // 짝이 안 맞는 백틱 = 여러 줄 템플릿 리터럴의 시작 (뒤쪽 글을 글로 본다)
      units.push({ line: lineNo, part: '문자열', text: rest.slice(rest.indexOf('`') + 1).trim() });
      inTemplate = true;
    }
  });
  return units.filter((u) => u.text !== '');
}

/** 파일 종류별로 글 덩어리를 뽑는다: .md = 표 칸·줄 / .ts·.tsx·.js·.mjs·.json = 문자열 리터럴·주석 / 그 밖(.txt·.csv·.tsv …) = 줄 */
export function textUnitsOf(path: string, content: string): TextUnit[] {
  if (MARKDOWN_EXT_RE.test(path)) return unitsFromMarkdown(content);
  if (CODE_EXT_RE.test(path)) return unitsFromCode(content);
  const units: TextUnit[] = [];
  content.split(/\r?\n/).forEach((raw, i) => {
    if (raw.trim() !== '') units.push({ line: i + 1, part: '줄', text: raw.trim() });
  });
  return units;
}

export interface FileOverlapProblem {
  file: string;
  line: number;
  part: string;
  kind: 'window' | 'whole-title';
  /** 연속으로 같은 글자 수(정규화 뒤) */
  length: number;
  /** CSV 데이터 행 번호 */
  row: number;
  /** 정규화한 그 덩어리 안의 시작 위치(0부터) */
  start: number;
}

export interface FileOverlapReport {
  file: string;
  /** 대조한 글 덩어리 수 */
  units: number;
  /** 제목과 가장 길게 이어진 글자 수 (3자 미만이면 0) — 기준 미만이어도 보고한다 */
  maxLength: number;
  problems: FileOverlapProblem[];
}

/** 덩어리 하나가 한꺼번에 알리는 겹침 수의 상한 (흔한 구절 하나가 수백 줄을 만들지 않게) */
const MAX_PROBLEMS_PER_UNIT = 3;

/** 여러 파일의 내용을 제목 색인과 대조한다. 제목 글자는 결과에 담지 않는다 */
export function checkOverlapFiles(files: ReadonlyArray<{ path: string; content: string }>, index: TitleIndex, window = OVERLAP_WINDOW): FileOverlapReport[] {
  return files.map(({ path, content }) => {
    const units = textUnitsOf(path, content);
    const problems: FileOverlapProblem[] = [];
    let maxLength = 0;
    for (const u of units) {
      const norm = normalizeForOverlap(u.text);
      if (norm.length < FULL_TITLE_MIN) continue;
      const longest = longestOverlap(norm, index);
      if (longest !== null) maxLength = Math.max(maxLength, longest.length);
      const hits = overlapsInIndex(norm, index, window)
        .sort((a, b) => b.length - a.length || a.row - b.row)
        .slice(0, MAX_PROBLEMS_PER_UNIT);
      for (const h of hits) problems.push({ file: path, line: u.line, part: u.part, kind: 'window', length: h.length, row: h.row, start: h.start });
      if (hits.length === 0) {
        const whole = wholeTitleHit(norm, index, window);
        if (whole !== null) problems.push({ file: path, line: u.line, part: u.part, kind: 'whole-title', length: whole.length, row: whole.row, start: whole.start });
      }
    }
    return { file: path, units: units.length, maxLength, problems };
  });
}

export function fileOverlapMessage(p: FileOverlapProblem): string {
  const where = `${p.file}:${p.line} (${p.part})`;
  return p.kind === 'window'
    ? `${where} — 공백·구두점 제외 ${p.start + 1}~${p.start + p.length}번째 글자(${p.length}자)가 CSV ${p.row}번째 데이터 행의 제목과 연속으로 같다 — 일반화한 표현이나 가짜 문장으로 바꾼다`
    : `${where} — CSV ${p.row}번째 데이터 행의 제목 전체(${p.length}자)를 그대로 포함한다 — 다른 말로 바꾼다`;
}

/** `npm run check:motifs -- <CSV>` 한 번에 소재 요약과 함께 보는 파일들 (R-100). 새 M6c 산출물이 늘면 여기에 더한다 */
export interface ExtraTarget {
  dir: string;
  matches(name: string): boolean;
  why: string;
}

export const DEFAULT_EXTRA_TARGETS: readonly ExtraTarget[] = [
  { dir: 'docs/data', matches: (n) => /^story-motifs.*\.md$/.test(n), why: '아이디어 문서·출처 문서 (표 칸·본문 줄)' },
  { dir: 'tests', matches: (n) => /^validateMotifs.*\.test\.ts$/.test(n), why: '테스트 파일의 문자열 리터럴·주석 (가짜 픽스처인지)' },
  { dir: 'scripts', matches: (n) => /^validateMotifs.*\.ts$/.test(n), why: '점검 도구 자신의 문자열·주석' },
  { dir: 'ai-log', matches: (n) => /M6c.*\.md$/.test(n), why: 'M6c 작업 로그' },
  { dir: 'docs/review', matches: (n) => /^REV-003-M6c.*\.md$/.test(n), why: 'M6c 검수 문서' },
];

/** 기본 목록에 맞는 파일 경로들 (정렬). 폴더 조회는 호출한 쪽이 넘긴다 — 없는 폴더는 빈 목록이면 된다 */
export function defaultExtraFiles(listDir: (dir: string) => string[], targets: readonly ExtraTarget[] = DEFAULT_EXTRA_TARGETS): string[] {
  const out: string[] = [];
  for (const t of targets) for (const name of listDir(t.dir).filter((n) => t.matches(n)).sort()) out.push(`${t.dir}/${name}`);
  return out;
}

// ---------- 보고 ----------

/** CLI가 찍는 요약 (제목·원문 없음) */
export function formatStats(stats: MotifStats, categories: readonly string[]): string[] {
  const lines = [
    `소재 ${stats.total}건 (형진 님 제공 ${stats.provided} · 창작 ${stats.created}), seenCount 합 ${stats.seenCountSum}, seenCount 1인 소재 ${stats.seenCountOne}건`,
    `수위: ${Object.entries(stats.bySensitivity).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'}`,
    '분류별: ' + categories.map((c) => `${c} ${stats.byCategory[c] ?? 0}`).join(' · '),
  ];
  return lines;
}
