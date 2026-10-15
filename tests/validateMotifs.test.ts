import { describe, expect, it } from 'vitest';
import motifsData from '../docs/data/story-motifs.json';
import sourcesMd from '../docs/data/story-motifs-sources.md?raw';
import ideasMd from '../docs/data/story-motifs-ideas.md?raw';
import { STAGES } from '../src/core/types';
import {
  DEFAULT_EXTRA_TARGETS,
  FORBIDDEN_PATTERNS,
  SOURCE_BOARD_PREFIX,
  SOURCE_KIND_CREATED,
  SOURCE_KIND_PROVIDED,
  SUMMARY_MAX,
  SUMMARY_MIN,
  TOKTOK_BOARDS,
  buildTitleIndex,
  charCount,
  checkOverlap,
  checkOverlapFiles,
  defaultExtraFiles,
  fileOverlapMessage,
  findOverlap,
  forbiddenPatternProblems,
  identityHints,
  longestOverlap,
  normalizeForOverlap,
  overlapMessage,
  overlapsInIndex,
  parseCsv,
  textUnitsOf,
  titlesFromCsv,
  validateMotifs,
  wholeTitleHit,
} from '../scripts/validateMotifsLib';

/**
 * 소재 목록 점검(`npm run check:motifs`, scripts/validateMotifsLib.ts)의 규칙을 가짜 데이터로 확인한다 — SPEC-002 T5 · SPEC-003 EV4~EV5 (M6c).
 * 실제 원문 CSV는 저장소에 없으므로(T4) 여기서 쓰는 「제목」·요약·예시 문장은 전부 이 테스트가 지어낸 가짜 문장이다(REV-003-M6c-1 R-100: 이 파일도
 * `npm run check:motifs -- <CSV 경로>`의 원문 겹침 점검 대상이다). 진짜 같은 문장을 픽스처로 쓰지 않는다.
 */

/**
 * 저장소 파일 읽기 (vitest는 node에서 도니까 node:fs를 쓰되, tsconfig.json(tests)에는 node 타입이 없어 모양만 적어서 불러온다 — designAssets.test.ts와 같은 방식).
 */
interface FsLike {
  readdirSync(path: URL): string[];
  readFileSync(path: URL, encoding: 'utf-8'): string;
  statSync(path: URL): { isDirectory(): boolean };
}
const fsSpec = 'node:fs';
const fs = (await import(/* @vite-ignore */ fsSpec)) as FsLike;
const REPO = new URL('../', import.meta.url);

/** 저장소 안 폴더의 항목 이름들 (없으면 빈 목록) */
function listRepoDir(relative: string): string[] {
  try {
    return fs.readdirSync(new URL(relative === '' ? './' : relative.replace(/\/?$/, '/'), REPO));
  } catch {
    return [];
  }
}

/** 저장소 전체의 파일 경로(상대) 중 확장자가 맞는 것. node_modules·dist·.git·test-results·playwright-report는 건너뛴다 */
function repoFiles(extensions: readonly string[]): string[] {
  const skip = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report']);
  const out: string[] = [];
  const walk = (relative: string) => {
    for (const name of listRepoDir(relative)) {
      if (skip.has(name)) continue;
      const path = relative === '' ? name : `${relative}/${name}`;
      let isDir = false;
      try {
        isDir = fs.statSync(new URL(path, REPO)).isDirectory();
      } catch {
        continue;
      }
      if (isDir) walk(path);
      else if (extensions.some((e) => name.toLowerCase().endsWith(e))) out.push(path);
    }
  };
  walk('');
  return out;
}

const CATS = ['돈·빚', '일·진로', '관계'];

/** 형진 님 제공 소재 하나 (기본값은 모두 통과하는 값) */
function provided(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'm-001',
    category: '돈·빚',
    summary: '달빛 아래 오래된 시계탑 앞에서 약속 시각을 기다리며 서성이는 사람의 마음',
    stage: ['youth'],
    era: ['all'],
    sensitivity: 'normal',
    seenCount: 2,
    sourceKind: SOURCE_KIND_PROVIDED,
    sourceBoards: [SOURCE_BOARD_PREFIX + TOKTOK_BOARDS[0]],
    collectedOn: '2026-10-15',
    usedBy: [],
    ...over,
  };
}

/** 창작 소재 하나 */
function created(over: Record<string, unknown> = {}): Record<string, unknown> {
  const base = provided({ id: 'm-002', summary: '전셋집 계약이 끝나 갈 즈음 집주인이 보증금을 올려 달라고 말을 꺼내는 일', seenCount: 0, sourceKind: SOURCE_KIND_CREATED });
  delete base.sourceBoards;
  return { ...base, ...over };
}

function file(motifs: unknown[], categories: unknown = CATS): unknown {
  return { categories, motifs };
}

function errorsOf(motifs: unknown[], categories: unknown = CATS): string[] {
  return validateMotifs(file(motifs, categories)).errors;
}

/** 지정한 글자 수(코드 포인트)의 한글 요약 */
function summaryOfLength(n: number): string {
  return '가'.repeat(n);
}

describe('소재 목록 점검 — 구조와 필수 필드 (T5)', () => {
  it('정상 데이터(형진 님 제공 + 창작)는 오류 0건', () => {
    const r = validateMotifs(file([provided(), created()]));
    expect(r.errors).toEqual([]);
    expect(r.stats.total).toBe(2);
    expect(r.stats.provided).toBe(1);
    expect(r.stats.created).toBe(1);
  });

  it('통계에서 나온 창작 소재는 basisId(s-###)를 가질 수 있다', () => {
    expect(errorsOf([created({ basisId: 's-014' })])).toEqual([]);
  });

  it('최상위가 객체가 아니거나 알 수 없는 항목이 있으면 실패', () => {
    expect(validateMotifs([]).errors).toHaveLength(1);
    expect(validateMotifs(null).errors).toHaveLength(1);
    expect(validateMotifs({ categories: CATS, motifs: [], meta: {} }).errors.join('\n')).toContain('알 수 없는 항목');
    expect(validateMotifs({ categories: CATS }).errors.join('\n')).toContain('motifs는 배열');
  });

  it('필수 필드가 하나라도 없으면 그 필드 이름과 함께 실패', () => {
    for (const key of ['id', 'category', 'summary', 'stage', 'era', 'sensitivity', 'seenCount', 'sourceKind', 'collectedOn', 'usedBy']) {
      const m = provided();
      delete m[key];
      expect(errorsOf([m]).join('\n'), key).toContain(`필수 필드가 없다: ${key}`);
    }
  });

  it('정해진 필드 말고는 넣을 수 없다 (원문 제목·링크·글 번호·닉네임 필드가 끼어들지 못한다, T4)', () => {
    for (const key of ['title', 'url', 'link', 'postId', 'nickname', 'originalTitle', 'postedAt']) {
      expect(errorsOf([provided({ [key]: 'x' })]).join('\n'), key).toContain(`알 수 없는 필드: ${key}`);
    }
  });

  it('id는 m-### 형식이고 중복이 없다', () => {
    for (const bad of ['m-1', 'm-0001', 'x-001', 'M-001', '', 5]) expect(errorsOf([provided({ id: bad })]).join('\n'), String(bad)).toContain('m-### 형식');
    const dup = errorsOf([provided(), provided({ summary: '다른 요약이지만 같은 번호를 쓴 소재는 허용되지 않는 경우' })]);
    expect(dup.join('\n')).toContain('id가 중복이다');
  });

  it('id 번호는 늘어나기만 한다 — 빈 번호(결번)는 허용하되 앞 번호로 되돌아가거나 지운 번호를 다시 쓸 수 없다', () => {
    expect(errorsOf([provided({ id: 'm-001' }), provided({ id: 'm-005', summary: '결번이 생겨도 뒤 번호가 이어지는 것은 허용되는 경우입니다' })])).toEqual([]);
    const back = errorsOf([provided({ id: 'm-005' }), provided({ id: 'm-003', summary: '앞 번호보다 작은 번호로 돌아간 소재는 허용되지 않는 경우입니다' })]);
    expect(back.join('\n')).toContain('앞 소재(m-005)보다 커야');
    expect(back.join('\n')).toContain('비워 둔다');
  });

  it('category는 분류표(categories) 안에 있어야 한다', () => {
    expect(errorsOf([provided({ category: '없는 분류' })]).join('\n')).toContain('분류표에 없다');
    expect(errorsOf([provided({ category: '관계' })])).toEqual([]);
  });

  it('categories는 비어 있지 않은 문자열 목록이고 중복·금지 패턴이 없다', () => {
    expect(errorsOf([], [])).not.toEqual([]);
    expect(errorsOf([], 'x')).not.toEqual([]);
    expect(errorsOf([], ['관계', '관계']).join('\n')).toContain('중복');
    expect(errorsOf([], ['관계 www.example.com']).join('\n')).toContain('금지 패턴');
  });

  it(`summary 길이는 ${SUMMARY_MIN}~${SUMMARY_MAX}자 (경계 14/15/60/61)`, () => {
    expect(errorsOf([provided({ summary: summaryOfLength(SUMMARY_MIN - 1) })]).join('\n')).toContain('길이');
    expect(errorsOf([provided({ summary: summaryOfLength(SUMMARY_MIN) })])).toEqual([]);
    expect(errorsOf([provided({ summary: summaryOfLength(SUMMARY_MAX) })])).toEqual([]);
    expect(errorsOf([provided({ summary: summaryOfLength(SUMMARY_MAX + 1) })]).join('\n')).toContain('길이');
  });

  it('summary 글자 수는 코드 포인트로 센다 (이모지 하나는 한 글자)', () => {
    expect(charCount('가나다')).toBe(3);
    expect(charCount('😀'.repeat(3))).toBe(3);
  });

  it('summary는 한 줄이고 앞뒤 공백이 없으며 다른 소재와 같지 않다', () => {
    expect(errorsOf([provided({ summary: ' ' + summaryOfLength(20) })]).join('\n')).toContain('앞뒤에 공백');
    expect(errorsOf([provided({ summary: summaryOfLength(10) + '\n' + summaryOfLength(10) })]).join('\n')).toContain('줄바꿈');
    expect(errorsOf([provided(), provided({ id: 'm-002' })]).join('\n')).toContain('똑같다');
  });

  it('stage는 영유아·학창·청년·중년·노년 값만, 비어 있지 않게, 중복 없이', () => {
    expect(errorsOf([provided({ stage: ['infant', 'school', 'youth', 'middle', 'senior'] })])).toEqual([]);
    expect(errorsOf([provided({ stage: [] })]).join('\n')).toContain('stage는');
    expect(errorsOf([provided({ stage: ['adult'] })]).join('\n')).toContain('stage 값이 올바르지 않다');
    expect(errorsOf([provided({ stage: ['youth', 'youth'] })]).join('\n')).toContain('중복');
    expect(errorsOf([provided({ stage: 'youth' })]).join('\n')).toContain('stage는');
  });

  it('era는 all 하나이거나 past·present·future 일부이며 all을 다른 값과 섞지 않는다', () => {
    expect(errorsOf([provided({ era: ['all'] })])).toEqual([]);
    expect(errorsOf([provided({ era: ['past', 'future'] })])).toEqual([]);
    expect(errorsOf([provided({ era: ['all', 'past'] })]).join('\n')).toContain('all을 쓰면');
    expect(errorsOf([provided({ era: ['ancient'] })]).join('\n')).toContain('era 값이 올바르지 않다');
    expect(errorsOf([provided({ era: [] })]).join('\n')).toContain('era는');
    expect(errorsOf([provided({ era: ['past', 'past'] })]).join('\n')).toContain('중복');
  });

  it('수위는 normal / dark-real 둘뿐이고 excluded는 목록에 올리지 않는다 (T6)', () => {
    expect(errorsOf([provided({ sensitivity: 'normal' })])).toEqual([]);
    expect(errorsOf([provided({ sensitivity: 'dark-real' })])).toEqual([]);
    expect(errorsOf([provided({ sensitivity: 'excluded' })]).join('\n')).toContain('올리지 않는다');
    expect(errorsOf([provided({ sensitivity: 'dark-soft' })]).join('\n')).toContain('sensitivity는');
    expect(errorsOf([provided({ sensitivity: 3 })]).join('\n')).toContain('sensitivity는');
  });

  it('collectedOn은 실제 날짜여야 한다', () => {
    expect(errorsOf([provided({ collectedOn: '2026-10-15' })])).toEqual([]);
    for (const bad of ['2026-02-30', '2026-13-01', '2026/10/15', '20261015', '', 20261015]) expect(errorsOf([provided({ collectedOn: bad })]).join('\n'), String(bad)).toContain('collectedOn');
  });

  it('usedBy는 이벤트 id 목록이다 (비어 있어도 된다)', () => {
    expect(errorsOf([provided({ usedBy: [] })])).toEqual([]);
    expect(errorsOf([provided({ usedBy: ['middle-debt-guarantee'] })])).toEqual([]);
    expect(errorsOf([provided({ usedBy: ['Bad Id'] })]).join('\n')).toContain('이벤트 id 형식');
    expect(errorsOf([provided({ usedBy: ['a-b', 'a-b'] })]).join('\n')).toContain('중복');
    expect(errorsOf([provided({ usedBy: 'x' })]).join('\n')).toContain('usedBy는');
  });
});

describe('소재 목록 점검 — 출처 구분과 seenCount (SPEC-003 EV4·R3)', () => {
  it('sourceKind는 「형진 님 제공」 / 「창작」 둘 중 하나', () => {
    expect(errorsOf([provided({ sourceKind: '네이트판 톡톡 / 회사생활' })]).join('\n')).toContain('sourceKind는');
    expect(errorsOf([provided({ sourceKind: '사이트 이름 / 게시판 이름' })]).join('\n')).toContain('sourceKind는');
  });

  it('형진 님 제공은 seenCount 1 이상(R3: 확인한 건수), 0이거나 정수가 아니면 실패', () => {
    expect(errorsOf([provided({ seenCount: 1 })])).toEqual([]);
    expect(errorsOf([provided({ seenCount: 7 })])).toEqual([]);
    expect(errorsOf([provided({ seenCount: 0 })]).join('\n')).toContain('1 이상');
    expect(errorsOf([provided({ seenCount: 1.5 })]).join('\n')).toContain('정수');
    expect(errorsOf([provided({ seenCount: -1 })]).join('\n')).toContain('정수');
    expect(errorsOf([provided({ seenCount: '2' })]).join('\n')).toContain('정수');
  });

  it('창작은 읽은 글이 없으므로 seenCount가 정확히 0', () => {
    expect(errorsOf([created({ seenCount: 0 })])).toEqual([]);
    expect(errorsOf([created({ seenCount: 2 })]).join('\n')).toContain('0이어야');
  });

  it('형진 님 제공은 sourceBoards(「네이트판 톡톡 / <카테고리>」)가 필요하고 13개 카테고리 중 하나여야 한다', () => {
    const noBoards = provided();
    delete noBoards.sourceBoards;
    expect(errorsOf([noBoards]).join('\n')).toContain('sourceBoards');
    expect(errorsOf([provided({ sourceBoards: [] })]).join('\n')).toContain('sourceBoards');
    expect(errorsOf([provided({ sourceBoards: ['네이트판 톡톡 / 없는 카테고리'] })]).join('\n')).toContain('모르는 카테고리');
    expect(errorsOf([provided({ sourceBoards: ['결혼/시집/친정'] })]).join('\n')).toContain('형식이 아니거나');
    expect(errorsOf([provided({ sourceBoards: [SOURCE_BOARD_PREFIX + TOKTOK_BOARDS[0], SOURCE_BOARD_PREFIX + TOKTOK_BOARDS[0]] })]).join('\n')).toContain('중복');
    for (const board of TOKTOK_BOARDS) expect(errorsOf([provided({ sourceBoards: [SOURCE_BOARD_PREFIX + board] })]), board).toEqual([]);
    expect(TOKTOK_BOARDS).toHaveLength(13);
  });

  it('sourceBoards 수는 seenCount를 넘을 수 없다 (한 제목은 한 카테고리에서 왔다, R-108)', () => {
    const two = [SOURCE_BOARD_PREFIX + TOKTOK_BOARDS[0], SOURCE_BOARD_PREFIX + TOKTOK_BOARDS[1]];
    expect(errorsOf([provided({ seenCount: 1, sourceBoards: two })]).join('\n')).toContain('sourceBoards 수(2)가 seenCount(1)보다 많다');
    expect(errorsOf([provided({ seenCount: 2, sourceBoards: two })])).toEqual([]);
    expect(errorsOf([provided({ seenCount: 5, sourceBoards: two })])).toEqual([]);
  });

  it('창작 소재에는 sourceBoards를 쓸 수 없다 (창작을 실제 사연처럼 표기하지 않는다)', () => {
    expect(errorsOf([created({ sourceBoards: [SOURCE_BOARD_PREFIX + TOKTOK_BOARDS[0]] })]).join('\n')).toContain('창작 소재에는 sourceBoards를 쓰지 않는다');
  });

  it('basisId는 s-### 형식이고 창작 소재에만 쓴다', () => {
    expect(errorsOf([created({ basisId: 's-1' })]).join('\n')).toContain('s-### 형식');
    expect(errorsOf([provided({ basisId: 's-014' })]).join('\n')).toContain('창작 소재에만');
  });
});

describe('소재 목록 점검 — 분량 (EV5)', () => {
  /** 분류 cats마다 n건씩 만든다 */
  function bulk(cats: string[], n: number): unknown[] {
    const out: unknown[] = [];
    let k = 1;
    for (const c of cats) {
      for (let i = 0; i < n; i++) {
        const id = `m-${String(k++).padStart(3, '0')}`;
        out.push(provided({ id, category: c, summary: `${c} 소재 ${id}에 대한 한 줄 요약을 새로 지어 쓴 글입니다` }));
      }
    }
    return out;
  }

  it('기본은 분량 미달을 경고만 한다 (형진 님 제공분만 있는 동안)', () => {
    const r = validateMotifs(file(bulk(CATS, 2), CATS));
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('\n')).toContain('총량이');
    expect(r.warnings.join('\n')).toContain('분류가');
  });

  it('strictCoverage면 총량 130건·5건 이상인 분류 10개 미만은 실패', () => {
    const r = validateMotifs(file(bulk(CATS, 2), CATS), { strictCoverage: true });
    expect(r.errors.join('\n')).toContain('총량이 130건 미만');
    expect(r.errors.join('\n')).toContain('10개 미만');
  });

  it('기준 이상이면 strict에서도 통과 (분류 10개 × 13건 = 130건)', () => {
    const cats = Array.from({ length: 10 }, (_, i) => `분류${i + 1}`);
    const r = validateMotifs(file(bulk(cats, 13), cats), { strictCoverage: true });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.stats.total).toBe(130);
  });

  it('소재가 없는 분류는 경고한다', () => {
    const r = validateMotifs(file([provided()], CATS));
    expect(r.warnings.join('\n')).toContain('「일·진로」에 소재가 없다');
  });
});

describe('금지 패턴 (T4·T5: URL · @계정 · 전화번호 · 따옴표·인용 부호 · 날짜·시각 · 「~님」 호칭)', () => {
  const cases: Array<[string, string[], string[]]> = [
    [
      'URL',
      ['자세한 내용은 https://example.com/a 에 있다', 'http://a.b 로 가면 된다', 'www.example.kr 을 참고', '예시닷컴 example.com 이라는 곳', '사이트 abc-def.net 에서 본 이야기'],
      ['요금제 비교 사이트를 훑어보다 지쳐 버린 일', '온라인 커뮤니티에 짧은 글을 남기는 일', '3.5배 오른 월세', '카페에서 에이 점 비 구 일을 하는 일', '메신저 답장이 늦어 서운한 일'],
    ],
    [
      '@계정',
      ['@abc123 계정에 올라온 이야기', '인스타 @my_id 에서 본 일', '문의는 @bar_baz 로', '아이디 @user.name 을 쓰는 사람', '친구 @ab_cd 와 다툰 일'],
      ['월급이 입금되면 이체부터 하는 일', '둘이 합쳐 4천 정도를 모았다는 이야기', '전세 보증금 5억 앳된 부부', '골목에서 마주친 이웃과 인사', '다음 주 월요일 오전 열 시'],
    ],
    [
      '전화번호 모양',
      ['010-1234-5678 로 연락이 온 일', '연락처 01012345678 을 알려 준 일', '02-123-4567 번으로 걸려 온 전화', '031 123 4567 로 문의', '+82 10 1234 5678 번호'],
      ['감 3개를 따서 이웃 1집에 나눠 준 일', '한 달에 90만 원씩 모으기로 한 일', '연도 표기 없이 정리한 내용', '시급 1만 원 안팎의 일자리', '스물다섯 살 때 처음 해 본 일'],
    ],
    [
      '따옴표 인용',
      [
        '그는 "별빛" 이라고 속삭였다',
        "'안녕히' 라는 인사를 건넨 일",
        '“바람이 분다” 는 혼잣말',
        '‘내일 보자’ 며 손을 흔든 일',
        '「고마웠다」 는 말을 남긴 일',
        '《달빛》 이라는 이름을 붙인 일',
        '〈별무리〉 라고 부르는 모임',
      ],
      ['별빛이라고 속삭이며 웃은 일', '안녕히 가시라는 인사를 건넨 일', '바람이 분다는 혼잣말을 한 일', '내일 보자며 손을 흔든 두 사람', '고마웠다는 말을 남기고 떠난 일'],
    ],
    [
      '날짜·시각 모양',
      ['2031-04-02에 있었던 일', '2031.4.2 에 정리한 내용', '31.04.02 기록', '모임은 18:30에 시작했다', '2031년 4월에 시작한 일', '4월 2일에 생긴 일', '오후 3시에 약속을 잡은 일'],
      ['3.5배 오른 월세', '한 달에 90만 원씩 모으기로 한 일', '결혼 20년 안팎의 부부', '일이 분만 늦어도 휴가를 쓰라는 규정', '스무 해가 넘도록 같은 자리에서 일한 사람'],
    ],
    [
      '「~님」 호칭',
      ['사장님이 갑자기 일정을 바꾼 일', '팀장님 눈치를 보며 퇴근하는 일', '선생님께 말씀드리기 어려운 일', '형진 님이 건넨 이야기', '님 이라는 호칭을 붙여 부르는 일'],
      ['손님이 몰려와 마감이 늘어지는 일', '단골 손님과 정이 쌓이는 일', '사장이 갑자기 일정을 바꾼 일', '팀장 눈치를 보며 퇴근하는 일', '손님에게 사과부터 해야 하는 일'],
    ],
  ];

  it('금지 패턴 6종이 정의되어 있다', () => {
    expect(FORBIDDEN_PATTERNS.map((p) => p.name)).toEqual(cases.map((c) => c[0]));
  });

  for (const [name, bad, good] of cases) {
    it(`${name}: 걸리는 문장 ${bad.length}개 · 통과하는 문장 ${good.length}개`, () => {
      // 「손님」은 일반 명사라 호칭 규칙에서 빠진다
      for (const t of bad) expect(forbiddenPatternProblems(t), t).toContain(name);
      for (const t of good) expect(forbiddenPatternProblems(t), t).not.toContain(name);
    });
  }

  it('validateMotifs는 summary의 금지 패턴을 소재 id와 함께 실패로 보고한다', () => {
    const e = errorsOf([provided({ summary: '사장님이 https://x.com 주소를 보내 줘서 놀란 일이 있었다' })]).join('\n');
    expect(e).toContain('m-001');
    expect(e).toContain('URL');
    expect(e).toContain('「~님」 호칭');
  });

  it('식별 의심 표현(상호·지명·달력 연도)은 실패가 아니라 경고', () => {
    const r = validateMotifs(file([provided({ summary: '서울 시내 어느 가게에서 일하며 겪은 이야기를 적은 글' })]));
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('\n')).toContain('식별 의심');
    expect(identityHints('쿠팡 같은 곳에서 일하는 사람')).toEqual(['쿠팡']);
    expect(identityHints('2031년에 있었던 일')).toHaveLength(1);
    expect(identityHints('월급을 모아 이사를 준비하는 일')).toEqual([]);
  });
});

describe('CSV 읽기 (원문 겹침 점검용 — 가짜 데이터)', () => {
  it('BOM·따옴표 속 쉼표와 따옴표·CRLF·끝 빈 줄을 처리한다', () => {
    const text = '﻿카테,순번,게시글_제목\r\n가,1,"제목, 쉼표 포함"\r\n나,2,"따옴표 ""안"" 포함"\r\n\r\n다,3,보통 제목\r\n';
    const rows = parseCsv(text);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual(['카테', '순번', '게시글_제목']);
    expect(rows[1][2]).toBe('제목, 쉼표 포함');
    expect(rows[2][2]).toBe('따옴표 "안" 포함');
    expect(rows[3][2]).toBe('보통 제목');
  });

  it('제목 열은 머리 줄에서 찾고(게시글_제목 우선, 없으면 「제목」이 든 열), 없으면 오류', () => {
    expect(titlesFromCsv('가,게시글_제목,다\n1,첫째,x\n2,둘째,y\n3,,z')).toEqual(['첫째', '둘째']);
    expect(titlesFromCsv('가,글 제목,다\n1,첫째,x')).toEqual(['첫째']);
    expect(() => titlesFromCsv('가,나,다\n1,2,3')).toThrow('제목 열');
    expect(() => titlesFromCsv('')).toThrow('비어');
  });

  const HEADER = '톡톡_카테고리,순번,게시글_제목,원문_링크,게시판_주소';

  it('제목은 링크 열 앞까지만 읽는다 — 따옴표 없는 쉼표로 칸이 늘어난 행도 제목 뒤 주소는 제목이 아니다 (R-100)', () => {
    const csv = [
      HEADER,
      '가,1,일반 제목,https://example.com/a,https://example.com/b',
      '가,2,"따옴표 속 쉼표, 있는 제목",https://example.com/c,https://example.com/d',
      '가,3,따옴표 없는 쉼표, 있는 제목,https://example.com/e,https://example.com/f',
      '가,4,쉼표가, 둘, 있는 제목,https://example.com/g,https://example.com/h',
    ].join('\n');
    const titles = titlesFromCsv(csv);
    expect(titles).toEqual(['일반 제목', '따옴표 속 쉼표, 있는 제목', '따옴표 없는 쉼표 있는 제목', '쉼표가 둘 있는 제목']);
    for (const t of titles) expect(t).not.toMatch(/https?:|example/);
  });

  it('링크 열 이름을 못 찾아도 URL로 시작하는 칸에서 멈추고, 제목 칸 안에 섞인 URL은 앞까지만 쓴다', () => {
    expect(titlesFromCsv('순번,게시글_제목,주소\n1,앞부분,https://example.com/a')).toEqual(['앞부분']);
    expect(titlesFromCsv('순번,게시글_제목,주소\n1,앞부분, 이어지는 부분,https://example.com/a')).toEqual(['앞부분 이어지는 부분']);
    expect(titlesFromCsv('가,게시글_제목,나\n1,"제목 뒤에 https://example.com/a 가 붙음",x')).toEqual(['제목 뒤에']);
    expect(titlesFromCsv('가,게시글_제목,나\n1,www.example.com 으로 시작,x')).toEqual([]);
  });
});

describe('원문 겹침 점검 (6자 이상 연속 / 제목 전체 포함)', () => {
  const n = (s: string) => normalizeForOverlap(s);

  it('정규화: 공백·구두점·기호를 지우고 소문자로 맞춘다', () => {
    expect(n('가 나,다.라! ABC?').join('')).toBe('가나다라abc');
    expect(n('①②').join('')).not.toBe('');
  });

  it('연속으로 같은 구간의 길이를 센다 (5자는 통과, 6자는 걸림)', () => {
    expect(findOverlap(n('가나다라마바사'), n('아가나다라마자'))).toBeNull(); // 가나다라마 = 5자
    const hit = findOverlap(n('가나다라마바사'), n('아가나다라마바자'));
    expect(hit).toEqual({ length: 6, summaryStart: 0 });
  });

  it('가장 길게 겹치는 구간을 돌려준다', () => {
    const hit = findOverlap(n('xx가나다라마바사아yy'), n('가나다라마바사아'));
    expect(hit).toEqual({ length: 8, summaryStart: 2 });
  });

  it('띄어쓰기·구두점만 바꾼 베끼기도 걸린다', () => {
    const title = '고양이가 우주선을 몰고, 달 시장에 장 보러 가는 이야기';
    const hits = checkOverlap([{ id: 'm-009', summary: '고양이가우주선을 몰고 달시장에 장보러 가는 이야기라 웃음이 나는 일' }], [title]);
    expect(hits).toHaveLength(1);
    expect(hits[0].kind).toBe('window');
  });

  it('겹침이 5자 이하이면 통과 (일반 낱말은 쓸 수 있다)', () => {
    expect(checkOverlap([{ id: 'm-001', summary: '맞벌이 부부의 저녁 풍경이 늘 바쁜 일' }], ['맞벌이 부부 이야기'])).toEqual([]);
  });

  it('제목 전체(5자 이상)를 포함하면 걸리고, 4자 이하의 짧은 제목은 낱말이라 무시한다', () => {
    const five = checkOverlap([{ id: 'm-003', summary: '이번 달 가계부 정리 뒤에 남은 일' }], ['가계부 정리']);
    expect(five).toHaveLength(1);
    expect(five[0].kind).toBe('whole-title');
    expect(checkOverlap([{ id: 'm-003', summary: '이번 달 가계부 정리 뒤에 남은 일' }], ['가계부'])).toEqual([]);
    expect(checkOverlap([{ id: 'm-003', summary: '이번 달 가계부 정리 뒤에 남은 일' }], ['정리'])).toEqual([]);
  });

  it('결과·메시지에는 제목 글자가 없고 소재 id·위치·길이·행 번호만 있다 (T4)', () => {
    const title = '아주특이한가짜제목입니다';
    const hits = checkOverlap([{ id: 'm-042', summary: '앞에 덧붙인 말 아주특이한가짜제목입니다 뒤에 덧붙인 말' }], ['다른 제목', title]);
    expect(hits).toHaveLength(1);
    expect(hits[0].row).toBe(2);
    const msg = overlapMessage(hits[0]);
    expect(msg).toContain('m-042');
    expect(msg).toContain('2번째 데이터 행');
    expect(msg).not.toContain('특이한가짜제목');
    expect(JSON.stringify(hits[0])).not.toContain('특이한');
  });

  it('여러 소재 × 여러 제목을 모두 대조한다', () => {
    const motifs = [
      { id: 'm-001', summary: '완전히 새로 지어 쓴 깨끗한 한 줄 요약입니다' },
      { id: 'm-002', summary: '둘째 소재는 어느제목의일부분과같은문장 을 쓴다' },
    ];
    const hits = checkOverlap(motifs, ['첫 번째 가짜 제목', '어느 제목의 일부분과 같은 문장입니다']);
    expect(hits.map((h) => h.motifId)).toEqual(['m-002']);
  });
});

describe('원문 겹침 점검 — 요약 말고 다른 글(문서·테스트·로그)까지 (R-100)', () => {
  const TITLE = '은하수 정거장에서 별빛 국수를 파는 로봇 할머니';
  const n = (s: string) => normalizeForOverlap(s);
  const index = buildTitleIndex(['첫 번째 가짜 제목', TITLE, '가계부 정리']);

  it('색인으로 구한 최장 일치는 글자 배열 비교(findOverlap)와 같다', () => {
    const samples = ['앞 말 은하수정거장에서별빛국수 뒤 말', '별빛 국수 한 그릇', '로봇 할머니는 없는 말', '전혀 상관없는 완전히 새로운 문장입니다', '은하수 정거장에서 별빛 국수를 파는 로봇 할머니'];
    for (const s of samples) {
      const viaIndex = longestOverlap(n(s), index);
      const viaPair = findOverlap(n(s), n(TITLE), 3);
      expect(viaIndex?.length ?? 0, s).toBe(viaPair?.length ?? 0);
    }
  });

  it('overlapsInIndex는 제목마다 가장 긴 일치를 행 번호순으로, minLength 미만은 빼고 돌려준다', () => {
    const hits = overlapsInIndex(n('은하수 정거장에서 별빛 국수 첫 번째 가짜 제목'), index, 6);
    expect(hits.map((h) => [h.row, h.length])).toEqual([
      [1, 7],
      [2, 12],
    ]);
    expect(overlapsInIndex(n('별빛 국수 한 그릇'), index, 6)).toEqual([]);
    expect(overlapsInIndex(n('별빛 국수 한 그릇'), index, 3).map((h) => h.row)).toEqual([2]);
  });

  it('5자 이상 6자 미만의 짧은 제목은 통째로 담겼을 때만 걸린다 (wholeTitleHit)', () => {
    expect(wholeTitleHit(n('이번 달 가계부 정리 뒤에 남은 일'), index)?.row).toBe(3);
    expect(wholeTitleHit(n('가계부만 정리하는 날'), index)).toBeNull();
  });

  it('마크다운은 표 칸마다·줄마다 나눈다 (칸 경계에서 우연히 이어 붙지 않게)', () => {
    const md = ['# 제목줄', '', '| id | 카드 | 선택지 |', '|---|:---:|---|', '| m-001 | 첫째 칸 글 | 둘째 칸 글 / 셋째 |', '본문 줄입니다'].join('\n');
    expect(textUnitsOf('a.md', md).map((u) => [u.line, u.part, u.text])).toEqual([
      [1, '줄', '# 제목줄'],
      [3, '표 1번째 칸', 'id'],
      [3, '표 2번째 칸', '카드'],
      [3, '표 3번째 칸', '선택지'],
      [5, '표 1번째 칸', 'm-001'],
      [5, '표 2번째 칸', '첫째 칸 글'],
      [5, '표 3번째 칸', '둘째 칸 글 / 셋째'],
      [6, '줄', '본문 줄입니다'],
    ]);
  });

  it('코드는 문자열 리터럴 하나하나와 주석, 여러 줄 템플릿 리터럴을 글로 뽑는다 (URL 속 슬래시는 주석이 아니다)', () => {
    const ts = [
      '// 줄 주석입니다',
      "const a = ['첫째 문자열', \"둘째 문자열\", 'https://example.com/x']; // 뒤에 붙은 주석",
      '/* 블록 주석 시작',
      ' * 블록 안쪽 줄',
      ' */',
      'const t = `여러 줄',
      '템플릿 가운데 줄',
      '끝 줄`;',
      'const re = /abc/;',
    ].join('\n');
    const units = textUnitsOf('a.ts', ts);
    expect(units.map((u) => [u.line, u.part])).toEqual([
      [1, '주석'],
      [2, '문자열'],
      [2, '문자열'],
      [2, '문자열'],
      [2, '주석'],
      [3, '주석'],
      [4, '주석'],
      [5, '주석'],
      [6, '문자열'],
      [7, '문자열'],
      [8, '문자열'],
    ]);
    expect(units.filter((u) => u.line === 2).map((u) => u.text)).toEqual(['첫째 문자열', '둘째 문자열', 'https://example.com/x', '뒤에 붙은 주석']);
    // 그 밖의 확장자(.txt·.csv·.tsv)는 줄 단위
    expect(textUnitsOf('a.txt', '한 줄\n\n둘째 줄').map((u) => [u.line, u.part, u.text])).toEqual([
      [1, '줄', '한 줄'],
      [3, '줄', '둘째 줄'],
    ]);
  });

  it('표 칸·문자열·주석 어디에 있든 파일·줄·덩어리 종류와 함께 걸리고, 메시지에는 제목 글자가 없다', () => {
    const files = [
      { path: 'docs/a.md', content: '| m-001 | 앞 칸은 괜찮은 문장입니다 | 은하수 정거장에서 별빛 국수를 파는 이야기 |' },
      { path: 'tests/b.test.ts', content: "it('x', () => { expect(f('은하수정거장에서별빛국수를 파는 로봇')).toBe(1); });\nconst ok = '아무 상관 없는 새 문장 하나';" },
      { path: 'ai-log/c.md', content: '이번 이야기는 은하수 정거장에서 별빛 국수를 파는 로봇 할머니 그대로입니다.' },
    ];
    const reports = checkOverlapFiles(files, index);
    expect(reports.map((r) => [r.file, r.problems.length])).toEqual([
      ['docs/a.md', 1],
      ['tests/b.test.ts', 1],
      ['ai-log/c.md', 1],
    ]);
    const [a, b, c] = reports.map((r) => r.problems[0]);
    expect([a.line, a.part, a.kind, a.row]).toEqual([1, '표 3번째 칸', 'window', 2]);
    expect([b.line, b.part, b.kind]).toEqual([1, '문자열', 'window']);
    expect([c.line, c.part]).toEqual([1, '줄']);
    expect(a.length).toBeGreaterThanOrEqual(12);
    expect(reports[1].units).toBe(3);
    for (const p of [a, b, c]) {
      const msg = fileOverlapMessage(p);
      expect(msg).toContain(`${p.file}:${p.line}`);
      expect(msg).toContain(p.part);
      expect(msg).not.toMatch(/정거장|별빛|국수|로봇|할머니/);
    }
  });

  it('기준 미만의 우연한 일치는 걸리지 않고, 파일별 최대 일치 길이로만 보고된다', () => {
    const [report] = checkOverlapFiles([{ path: 'docs/d.md', content: '별빛 국수 한 그릇을 먹고 돌아오는 길\n전혀 다른 새 문장입니다' }], index);
    expect(report.problems).toEqual([]);
    expect(report.maxLength).toBe(4);
    expect(report.units).toBe(2);
  });

  it('제목 전체(5자 이상)를 담은 문서 줄도 걸린다', () => {
    const [report] = checkOverlapFiles([{ path: 'docs/e.md', content: '이번 달 가계부 정리 뒤에 남은 일' }], index);
    expect(report.problems.map((p) => [p.kind, p.row])).toEqual([['whole-title', 3]]);
  });

  it('기본 점검 대상은 아이디어·출처 문서, 테스트, 점검 도구, M6c ai-log, M6c REV를 덮는다 (폴더 조회는 호출한 쪽이 준다)', () => {
    const dirs: Record<string, string[]> = {
      'docs/data': ['story-motifs-sources.md', 'story-motifs-ideas.md', 'story-motifs.json', 'events-stats-basis.md'],
      tests: ['validateMotifs.test.ts', 'validateMotifsExtra.test.ts', 'life.test.ts'],
      scripts: ['validateMotifs.ts', 'validateMotifsLib.ts', 'simulate.ts'],
      'ai-log': ['2026-10-15_SPEC-003_dev-M6c-motifs.md', '2026-10-15_SPEC-003_dev-M6a.md', 'README.md'],
      'docs/review': ['REV-003-M6c-1.md', 'REV-003-M6c-2.md', 'REV-003-M5-1.md'],
    };
    expect(defaultExtraFiles((dir) => dirs[dir] ?? [])).toEqual([
      'docs/data/story-motifs-ideas.md',
      'docs/data/story-motifs-sources.md',
      'tests/validateMotifs.test.ts',
      'tests/validateMotifsExtra.test.ts',
      'scripts/validateMotifs.ts',
      'scripts/validateMotifsLib.ts',
      'ai-log/2026-10-15_SPEC-003_dev-M6c-motifs.md',
      'docs/review/REV-003-M6c-1.md',
      'docs/review/REV-003-M6c-2.md',
    ]);
    expect(defaultExtraFiles(() => [])).toEqual([]);
    expect(DEFAULT_EXTRA_TARGETS.map((t) => t.dir)).toEqual(['docs/data', 'tests', 'scripts', 'ai-log', 'docs/review']);
  });
});

describe('실제 소재 목록 docs/data/story-motifs.json (M6c 형진 님 제공분)', () => {
  const data = motifsData as unknown as { categories: string[]; motifs: Array<Record<string, unknown>> };
  const motifs = data.motifs as Array<{
    id: string;
    category: string;
    summary: string;
    stage: string[];
    era: string[];
    sensitivity: string;
    seenCount: number;
    sourceKind: string;
    sourceBoards?: string[];
    usedBy: string[];
  }>;

  it('점검(필수 필드·길이·분류표·seenCount·금지 패턴)을 오류 0건으로 통과한다', () => {
    const r = validateMotifs(motifsData);
    expect(r.errors).toEqual([]);
    expect(r.stats.total).toBeGreaterThan(0);
  });

  /** 출처 문서 「결번(재사용 금지): m-036 · m-077」 줄의 번호들 */
  const retiredIds = ((/결번\(재사용 금지\):([^\n]+)/.exec(sourcesMd)?.[1] ?? '').match(/m-\d{3}/g) ?? []) as string[];
  const idNumber = (id: string) => Number(id.slice(2));

  it('id는 번호순으로 늘어나기만 하고, 빈 번호는 출처 문서의 결번 목록(재사용 금지)과 정확히 같다 (R-103·R-104)', () => {
    const numbers = motifs.map((m) => idNumber(m.id));
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    const present = new Set(numbers);
    const gaps: string[] = [];
    for (let i = 1; i <= Math.max(...numbers); i++) if (!present.has(i)) gaps.push(`m-${String(i).padStart(3, '0')}`);
    expect(gaps).toEqual(['m-036', 'm-077']);
    expect(retiredIds).toEqual(gaps);
    expect(sourcesMd).toContain('번호는 비워 두고 다시 쓰지 않는다');
  });

  it('병합·삭제한 소재(m-036·m-077)는 목록에도 아이디어 문서의 표에도 없고, 합쳐진 쪽이 두 소재의 제목 수와 출처를 이어받는다 (R-104)', () => {
    const byId = new Map(motifs.map((m) => [m.id, m]));
    for (const id of retiredIds) {
      expect(byId.has(id), id).toBe(false);
      expect(ideasMd.split('\n').some((l) => l.startsWith(`| ${id} |`)), `${id}: 아이디어 표`).toBe(false);
    }
    expect(byId.get('m-034')?.seenCount).toBe(2);
    expect(byId.get('m-034')?.sourceBoards).toHaveLength(2);
    expect(byId.get('m-087')?.seenCount).toBe(2);
    expect(byId.get('m-087')?.sourceBoards).toHaveLength(2);
    expect(byId.get('m-087')?.category).toBe('회사생활');
  });

  it('m-031은 입학 시기 고민(출생신고 시기 같은 구체 제도가 아니다), m-122는 검진을 미루는 일로 일반화되어 있다 (R-104)', () => {
    const byId = new Map(motifs.map((m) => [m.id, m.summary]));
    expect(byId.get('m-031')).toContain('입학 시기');
    expect(byId.get('m-031')).not.toMatch(/출생신고|연말/);
    expect(byId.get('m-122')).toContain('검진을 미루');
    expect(byId.get('m-122')).not.toMatch(/맥박|운동/);
  });

  it('m-090은 한쪽 시점의 세대 고정관념이 아니라 양쪽 시점의 구조로 쓰였고, m-120 아이디어는 어느 세대도 탓하지 않는다 (R-103)', () => {
    const m090 = motifs.find((m) => m.id === 'm-090')?.summary ?? '';
    expect(m090).toMatch(/새로 온 사람/);
    expect(m090).toMatch(/기존 팀/);
    expect(m090).not.toMatch(/신입|요즘|세대|토라/);
    const row120 = ideasMd.split('\n').find((l) => l.startsWith('| m-120 |')) ?? '';
    expect(row120).toContain('양쪽 시점');
    expect(row120).not.toMatch(/아버지|아들/);
    const row090 = ideasMd.split('\n').find((l) => l.startsWith('| m-090 |')) ?? '';
    expect(row090).toContain('양쪽 시점');
    expect(row090).not.toContain('세대 갈등');
  });

  it('모두 「형진 님 제공」이고 sourceBoards가 있다 (창작은 별도 작업에서 채운다)', () => {
    for (const m of motifs) {
      expect(m.sourceKind, m.id).toBe(SOURCE_KIND_PROVIDED);
      expect(m.sourceBoards?.length ?? 0, m.id).toBeGreaterThan(0);
    }
  });

  it('사용처(usedBy)는 아직 비어 있다 — 이벤트로 만드는 것은 M7a/M7d', () => {
    for (const m of motifs) expect(m.usedBy, m.id).toEqual([]);
  });

  it('모든 요약의 금지 패턴 0건, 길이 범위 안', () => {
    for (const m of motifs) {
      expect(forbiddenPatternProblems(m.summary), m.id).toEqual([]);
      const n = charCount(m.summary);
      expect(n, m.id).toBeGreaterThanOrEqual(SUMMARY_MIN);
      expect(n, m.id).toBeLessThanOrEqual(SUMMARY_MAX);
    }
  });

  it('분류표의 모든 분류 이름이 중복 없고, 쓰인 분류는 모두 분류표 안', () => {
    expect(new Set(data.categories).size).toBe(data.categories.length);
    for (const m of motifs) expect(data.categories, m.id).toContain(m.category);
  });

  it('원문 저장 금지(T4): 저장소에 형진 님이 건넨 톡톡 제목 목록(CSV·TSV·TXT·JSON) 형태의 파일이 없다', () => {
    // 다른 자료의 CSV·JSON(예: 통계 출처 목록)은 있어도 된다 — 파일 이름과 머리 줄(열 이름)·JSON 키로 제목 목록을 알아본다 (R-108: csv만 보던 것을 확장)
    const dumpColumns = ['톡톡_카테고리', '게시글_제목', '원문_링크', '게시판_주소'];
    const files = repoFiles(['.csv', '.tsv', '.txt', '.json']);
    expect(files.length, '저장소 파일을 읽었다').toBeGreaterThan(20);
    for (const path of files) {
      expect(/톡톡|게시글|네이트판/.test(path), `${path}: 파일 이름`).toBe(false);
      const text = fs.readFileSync(new URL(path, REPO), 'utf-8').replace(/^﻿/, '');
      if (path.toLowerCase().endsWith('.json')) {
        for (const col of dumpColumns) expect(text.includes(col), `${path}: JSON 안의 ${col}`).toBe(false);
      } else {
        const header = text.split(/\r?\n/, 1)[0];
        for (const col of dumpColumns) expect(header.includes(col), `${path}: 머리 줄의 ${col}`).toBe(false);
      }
    }
  });

  it('덤프 검사는 가짜 TSV·TXT·JSON도 알아본다 (검사 규칙 자체의 확인)', () => {
    const dumpColumns = ['톡톡_카테고리', '게시글_제목', '원문_링크', '게시판_주소'];
    const header = (text: string) => text.replace(/^﻿/, '').split(/\r?\n/, 1)[0];
    expect(dumpColumns.some((c) => header('톡톡_카테고리\t순번\t게시글_제목\n가\t1\t나').includes(c))).toBe(true);
    expect(dumpColumns.some((c) => header('﻿게시글_제목 원문_링크\n가 나').includes(c))).toBe(true);
    expect(dumpColumns.some((c) => '[{"게시글_제목":"가","원문_링크":"나"}]'.includes(c))).toBe(true);
    expect(dumpColumns.some((c) => header('분류,이름,값\n가,나,다').includes(c))).toBe(false);
  });

  it('기본 원문 겹침 점검 대상이 실제 저장소의 M6c 파일(문서·테스트·도구·ai-log·REV)을 모두 덮는다 (R-100)', () => {
    const files = defaultExtraFiles(listRepoDir);
    for (const expected of [
      'docs/data/story-motifs-ideas.md',
      'docs/data/story-motifs-sources.md',
      'tests/validateMotifs.test.ts',
      'scripts/validateMotifs.ts',
      'scripts/validateMotifsLib.ts',
      'ai-log/2026-10-15_SPEC-003_dev-M6c-motifs.md',
      'ai-log/2026-10-15_SPEC-003_dev-M6c-r2.md',
      'docs/review/REV-003-M6c-1.md',
    ]) {
      expect(files, expected).toContain(expected);
    }
  });

  it('소재 JSON·출처 문서·아이디어 문서에 URL·계정·글 주소가 없다', () => {
    const files: Record<string, string> = { 'story-motifs.json': JSON.stringify(motifsData), 'story-motifs-sources.md': sourcesMd, 'story-motifs-ideas.md': ideasMd };
    for (const [name, text] of Object.entries(files)) {
      expect(/https?:\/\//i.test(text), `${name}: URL`).toBe(false);
      expect(/www\./i.test(text), `${name}: www`).toBe(false);
      expect(/pann\.nate\.com\/talk/i.test(text), `${name}: 글 주소`).toBe(false);
      expect(/(?:^|[^A-Za-z0-9_])@[A-Za-z0-9_.]{2,}/.test(text), `${name}: @계정`).toBe(false);
    }
  });

  it('출처 문서가 판정(불통과)·robots 규칙·확인일·입력 건수와 숫자(소재 건수·사유별 합)를 실제 데이터와 맞게 담고 있다', () => {
    const seenSum = motifs.reduce((a, m) => a + m.seenCount, 0);
    const input = 650;
    expect(sourcesMd).toContain('불통과');
    expect(sourcesMd).toContain('User-agent: *');
    expect(sourcesMd).toContain('Disallow: /');
    expect(sourcesMd).toContain('ClaudeBot');
    expect(sourcesMd).toContain('2026-10-15');
    expect(sourcesMd).toContain(`입력 ${input}건`);
    expect(sourcesMd).toContain(`소재로 쓴 제목 ${seenSum}건`);
    expect(sourcesMd).toContain(`유형 ${motifs.length}개`);
    expect(sourcesMd).toContain(`제외 ${input - seenSum}건`);
    // 사유별 개수 표의 숫자 합 = 제외 건수
    const reasonRows = sourcesMd.split('\n').filter((l) => /^\| 제외 사유 \d+ /.test(l));
    expect(reasonRows.length).toBeGreaterThan(0);
    const reasonSum = reasonRows.reduce((a, l) => a + Number(l.split('|')[3]?.trim()), 0);
    expect(reasonSum).toBe(input - seenSum);
  });

  it('아이디어 문서에 모든 소재 id가 한 번씩 있다', () => {
    for (const m of motifs) {
      const count = ideasMd.split('\n').filter((l) => l.startsWith(`| ${m.id} |`)).length;
      expect(count, m.id).toBe(1);
    }
  });

  /** 마크다운에서 `### <제목>`으로 시작하는 절의 본문 (다음 `###`·`##` 전까지) */
  function section(md: string, heading: string): string {
    const start = md.indexOf(heading);
    expect(start, `절 ${heading}`).toBeGreaterThanOrEqual(0);
    const rest = md.slice(start + heading.length);
    const next = rest.search(/\n#{2,3} /);
    return next < 0 ? rest : rest.slice(0, next);
  }

  it('출처 문서의 분포 숫자(제목 수·단계·수위·시대·seenCount)가 실제 데이터와 같다 (R-101·R-102)', () => {
    const count = (f: (m: (typeof motifs)[number]) => boolean) => motifs.filter(f).length;
    const stageCount = (s: string) => count((m) => m.stage.includes(s));
    expect(sourcesMd).toContain(`youth ${stageCount('youth')} · middle ${stageCount('middle')} · school ${stageCount('school')} · senior ${stageCount('senior')} · infant ${stageCount('infant')}`);
    expect(sourcesMd).toContain(`normal ${count((m) => m.sensitivity === 'normal')}개 · dark-real ${count((m) => m.sensitivity === 'dark-real')}개`);
    const eraKey = (m: (typeof motifs)[number]) => m.era.join('+');
    expect(sourcesMd).toContain(`모든 시대 \`all\` ${count((m) => eraKey(m) === 'all')}개`);
    expect(sourcesMd).toContain(`지금+다가올 \`present\`·\`future\` ${count((m) => eraKey(m) === 'present+future')}개`);
    expect(sourcesMd).toContain(`지난+지금 \`past\`·\`present\` ${count((m) => eraKey(m) === 'past+present')}개`);
    const seenN = (k: number) => count((m) => m.seenCount === k);
    expect(sourcesMd).toContain(`1건 ${seenN(1)}개 · 2건 ${seenN(2)}개 · 3건 ${seenN(3)}개 · 4건 ${seenN(4)}개 · 5건 이상 ${count((m) => m.seenCount >= 5)}개`);
    expect(sourcesMd).toContain(`1건짜리 유형(${seenN(1)}개)`);
  });

  it('출처 문서 4.1 분류별 현황(유형 수·제목 수·seenCount 1인 유형)과 3.1 톡톡 카테고리별 기여 유형 수가 실제 데이터와 같다', () => {
    const rows = section(sourcesMd, '### 4.1 분류별 현황').split('\n').filter((l) => l.startsWith('| '));
    for (const c of data.categories) {
      const row = rows.find((l) => l.startsWith(`| ${c} |`));
      expect(row, `4.1 표의 ${c} 행`).toBeDefined();
      const cells = (row ?? '').split('|').map((x) => x.trim());
      const mine = motifs.filter((m) => m.category === c);
      expect(Number(cells[2]), `${c}: 유형 수`).toBe(mine.length);
      expect(Number(cells[3]), `${c}: 제목 수`).toBe(mine.reduce((a, m) => a + m.seenCount, 0));
      expect(Number(cells[4]), `${c}: seenCount 1인 유형`).toBe(mine.filter((m) => m.seenCount === 1).length);
    }
    const boardRows = section(sourcesMd, '### 3.1 톡톡 카테고리별').split('\n').filter((l) => l.startsWith('| '));
    for (const b of TOKTOK_BOARDS) {
      const row = boardRows.find((l) => l.startsWith(`| ${b} |`));
      expect(row, `3.1 표의 ${b} 행`).toBeDefined();
      const cells = (row ?? '').split('|').map((x) => x.trim());
      expect(Number(cells[5]), `${b}: 기여한 유형 수`).toBe(motifs.filter((m) => m.sourceBoards?.includes(SOURCE_BOARD_PREFIX + b)).length);
    }
  });

  it('수위 판정 기준(R-102): 출처 문서 5.2절 표의 소재 = 실제 dark-real 소재 전부, 아이디어 문서 2절의 dark-real 목록도 같고 E13 항목 이름이 들어 있다', () => {
    const darkIds = motifs.filter((m) => m.sensitivity === 'dark-real').map((m) => m.id);
    const tableRows = section(sourcesMd, '### 5.2 수위(sensitivity) 판정 기준').split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| E13 항목'));
    const inTable = tableRows.flatMap((l) => l.split('|')[2]?.match(/m-\d{3}/g) ?? []);
    expect([...inTable].sort()).toEqual([...darkIds].sort());
    expect(new Set(inTable).size).toBe(inTable.length);
    // 아이디어 문서의 dark-real 목록 줄
    const line = ideasMd.split('\n').find((l) => l.includes(`**dark-real ${darkIds.length}개**`)) ?? '';
    expect((line.split('(')[0].match(/m-\d{3}/g) ?? []).sort()).toEqual([...darkIds].sort());
    expect(sourcesMd).toContain('SPEC-002 E13');
    for (const topic of ['입시·취업 경쟁', '실직', '비정규직', '과로', '빚', '이혼·가정 해체', '큰 병', '가난의 대물림']) expect(tableRows.join('\n'), topic).toContain(topic);
  });

  it('수위 재분류 결과: 입시·취업 경쟁·비정규직·실직 소재는 dark-real, 부모 동거 갈등(m-119)은 normal, 바뀐 건수가 문서에 있다 (R-102)', () => {
    const sens = new Map(motifs.map((m) => [m.id, m.sensitivity]));
    for (const id of ['m-072', 'm-073', 'm-074', 'm-103', 'm-107', 'm-108', 'm-109', 'm-125']) expect(sens.get(id), id).toBe('dark-real');
    expect(sens.get('m-119')).toBe('normal');
    expect(sourcesMd).toContain('바뀐 건수(검수 1회차 R-102)**: 9건');
  });

  it('stage는 단계 순서대로 적고, 아이가 직접 겪을 수 있는 육아 소재에는 영유아·학창 단계가 달려 있다 (R-101)', () => {
    for (const m of motifs) {
      const order = m.stage.map((s) => (STAGES as readonly string[]).indexOf(s));
      expect(order, m.id).toEqual([...order].sort((a, b) => a - b));
    }
    const stages = new Map(motifs.map((m) => [m.id, m.stage]));
    for (const id of ['m-021', 'm-022', 'm-029', 'm-030', 'm-031', 'm-032', 'm-037', 'm-039', 'm-040']) expect(stages.get(id), id).toContain('infant');
    for (const id of ['m-021', 'm-022', 'm-031', 'm-034', 'm-038', 'm-039']) expect(stages.get(id), id).toContain('school');
    // 영유아 소재 0건이라는 잘못된 보고가 다시 나오지 않게: 영유아 소재는 9건 이상이다
    const infantMotifs = motifs.filter((m) => m.stage.includes('infant'));
    expect(infantMotifs.length).toBeGreaterThanOrEqual(9);
    expect(sourcesMd).toContain('stage = 이 소재를 쓸 수 있는 캐릭터의 생애 단계');
    // 부모의 일뿐이라 아이 단계를 달지 않은 소재
    for (const id of ['m-023', 'm-024', 'm-025', 'm-033', 'm-035']) expect(stages.get(id), id).not.toContain('infant');
  });

  it('아이디어 문서의 원칙(R-105): 권리 구제·공공 서비스 선택지는 모든 판에 보이고, 재력 차이는 대가·위험으로 쓴다 — 재력으로 숨기라는 문장이 없다', () => {
    const head = ideasMd.slice(0, ideasMd.indexOf('\n## 1.'));
    expect(head).toContain('권리 구제·공공 서비스 선택지는 모든 판에 보인다');
    for (const word of ['노동청', '요양 서비스', '모든 판에 보인다', '대가와 위험', '일자리를 잃을 위험', '생활비 공백', '비급여 간병비', '대기 기간']) expect(head, word).toContain(word);
    // 0절 밖의 모든 줄: 권리·서비스 낱말과 「숨김」 낱말이 함께 있지 않다
    const body = ideasMd.slice(ideasMd.indexOf('\n## 1.')).split('\n');
    for (const l of body) {
      if (/노동청|진정|신고|요양 서비스|채무 조정|상담/.test(l)) expect(l, l.slice(0, 60)).not.toMatch(/보이지 않|사라지|숨기|숨긴|`requires`로 숨/);
    }
    const row = (id: string) => ideasMd.split('\n').find((l) => l.startsWith(`| ${id} |`)) ?? '';
    expect(row('m-097')).toContain('모든 판에 보임');
    expect(row('m-119')).toContain('모든 판에 보임');
  });

  it('아이디어 문서는 「요약에서만 출발했다」고 거짓으로 말하지 않고, 원문 겹침 점검 대상임을 밝힌다 (R-100)', () => {
    const head = ideasMd.slice(0, ideasMd.indexOf('\n## 0.'));
    expect(head).not.toContain('소재 요약에서만 출발했다');
    expect(head).toContain('요약에 없는 디테일을 모두 일반화');
    expect(head).toContain('check:motifs');
  });

  it('제공분만 있는 동안의 분량: 건수와 제공/창작 비율을 숨기지 않고 센다 (EV5)', () => {
    const r = validateMotifs(motifsData);
    expect(r.stats.provided + r.stats.created).toBe(r.stats.total);
    expect(r.stats.created).toBe(0);
    expect(r.stats.seenCountSum).toBe(motifs.reduce((a, m) => a + m.seenCount, 0));
  });

  it('창작이 섞여도 규칙이 유지된다 (제공분 + 창작 가짜 소재 1건을 더해 다시 점검)', () => {
    // 새 소재는 가장 큰 번호 다음부터 (결번을 다시 쓰지 않는다)
    const next = Math.max(...motifs.map((m) => Number(m.id.slice(2)))) + 1;
    const extra = created({ id: `m-${String(next).padStart(3, '0')}`, category: data.categories[0] });
    const r = validateMotifs({ categories: data.categories, motifs: [...data.motifs, extra] });
    expect(r.errors).toEqual([]);
    expect(r.stats.created).toBe(1);
    expect(SOURCE_KIND_CREATED).toBe('창작');
  });
});
