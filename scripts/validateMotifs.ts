import { existsSync, readFileSync, readdirSync } from 'node:fs';
import {
  DEFAULT_EXTRA_TARGETS,
  OVERLAP_WINDOW,
  buildTitleIndex,
  checkOverlapFiles,
  checkOverlapIndexed,
  defaultExtraFiles,
  fileOverlapMessage,
  formatStats,
  longestOverlap,
  normalizeForOverlap,
  overlapMessage,
  titlesFromCsv,
  validateMotifs,
} from './validateMotifsLib';

/**
 * 소재 목록 점검 (SPEC-002 T5 · SPEC-003 EV4~EV5, M6c).
 * 실행: npm run check:motifs [-- <CSV 경로> [--extra <파일…>]] [--strict] [--file=<소재 JSON 경로>]
 *
 *  - 기본은 docs/data/story-motifs.json 의 필수 필드·요약 길이·분류표·seenCount·sourceKind·금지 패턴(URL·@계정·전화번호·따옴표·인용 부호·날짜·시각·「~님」 호칭)과
 *    id 번호 순서·sourceBoards 수 ≤ seenCount 를 본다.
 *  - CSV 경로를 주면(형진 님이 건넨 톡톡 제목 목록) 원문 겹침을 본다. **소재 요약만이 아니라** 아래 기본 목록의 문서·테스트·로그 전부를 같이 본다(R-100):
 *      docs/data/story-motifs*.md (아이디어·출처 문서 — 표 칸·본문 줄), tests/validateMotifs*.test.ts (문자열 리터럴·주석),
 *      scripts/validateMotifs*.ts, ai-log/*M6c*.md, docs/review/REV-003-M6c*.md.
 *    `--extra <파일…>`로 파일을 더 붙일 수 있다(CSV 경로 뒤에, 다음 `--` 옵션 앞까지). 연속 6자 이상 같거나 제목 전체(5자 이상)를 포함하면 실패.
 *    CSV는 저장소 밖에 둔다(T4: 원문은 저장소에 두지 않는다). 읽기만 하고 복사·출력하지 않으며, 실패 메시지에도 제목 글자는 없다(파일·줄·글자 위치·길이·행 번호만).
 *    CSV의 제목은 링크 열 앞까지만 읽는다.
 *  - --strict: 분량 기준(EV5: 총 130건 이상▲, 5건 이상인 분류 10개 이상▲) 미달도 실패로 본다. 기본은 경고 — 형진 님 제공분만 있는 동안에는 기준에 못 미칠 수 있다.
 *    M6c-2(창작 보충) 완료 기준: `npm run check:motifs -- <CSV> --strict` 를 다시 돌려 통과해야 한다(R-107).
 * 문제가 있으면 목록을 찍고 종료 코드 1.
 */
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const fileFlag = args.find((a) => a.startsWith('--file='));
const motifsPath = fileFlag === undefined ? 'docs/data/story-motifs.json' : fileFlag.slice('--file='.length);

// 위치 인자: 첫 번째가 CSV 경로. `--extra` 뒤의 위치 인자는 추가 파일, `--extra=a,b`도 받는다.
let csvPath: string | undefined;
const extraFromArgs: string[] = [];
let collectingExtra = false;
for (const a of args) {
  if (a === '--extra') collectingExtra = true;
  else if (a.startsWith('--extra=')) extraFromArgs.push(...a.slice('--extra='.length).split(',').filter((s) => s !== ''));
  else if (a.startsWith('--')) collectingExtra = false;
  else if (collectingExtra) extraFromArgs.push(a);
  else if (csvPath === undefined) csvPath = a;
  else extraFromArgs.push(a);
}

function fail(lines: string[]): never {
  console.error(lines.join('\n'));
  process.exit(1);
}

if (!existsSync(motifsPath)) fail([`소재 목록 파일이 없다: ${motifsPath}`]);

let data: unknown;
try {
  data = JSON.parse(readFileSync(motifsPath, 'utf-8'));
} catch (error) {
  fail([`소재 목록을 JSON으로 읽지 못했다: ${error instanceof Error ? error.message : String(error)}`]);
}

const result = validateMotifs(data, { strictCoverage: strict });
const problems = [...result.errors];
const categories = (data as { categories?: string[] }).categories ?? [];
const motifs = ((data as { motifs?: Array<{ id: string; summary: string }> }).motifs ?? []).filter((m) => typeof m?.id === 'string' && typeof m?.summary === 'string');

if (csvPath === undefined && extraFromArgs.length > 0) fail(['--extra는 CSV 경로와 함께 쓴다: npm run check:motifs -- <CSV 경로> --extra <파일…>']);

const overlapLines: string[] = [];
if (csvPath === undefined) {
  overlapLines.push('원문 겹침 점검: 건너뜀 (CSV 경로를 인자로 주면 요약·문서·테스트·로그를 한꺼번에 점검: npm run check:motifs -- <CSV 경로>)');
} else {
  if (!existsSync(csvPath)) fail([`CSV 파일이 없다: ${csvPath}`]);
  let titles: string[];
  try {
    titles = titlesFromCsv(readFileSync(csvPath, 'utf-8'));
  } catch (error) {
    fail([`CSV를 읽지 못했다: ${error instanceof Error ? error.message : String(error)}`]);
  }
  const index = buildTitleIndex(titles);

  // 1) 소재 요약
  const summaryProblems = checkOverlapIndexed(motifs, index);
  for (const o of summaryProblems) problems.push(overlapMessage(o));
  const summaryMax = motifs.reduce((max, m) => Math.max(max, longestOverlap(normalizeForOverlap(m.summary), index)?.length ?? 0), 0);

  // 2) 기본 목록 + --extra 파일
  const listDir = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir) : []);
  const defaults = defaultExtraFiles(listDir);
  const extraMissing = extraFromArgs.filter((p) => !existsSync(p));
  if (extraMissing.length > 0) fail(extraMissing.map((p) => `--extra 파일이 없다: ${p}`));
  const files = [...new Set([...defaults, ...extraFromArgs])].map((path) => ({ path, content: readFileSync(path, 'utf-8') }));
  const reports = checkOverlapFiles(files, index);
  for (const r of reports) for (const p of r.problems) problems.push(fileOverlapMessage(p));

  const total = summaryProblems.length + reports.reduce((n, r) => n + r.problems.length, 0);
  overlapLines.push(`원문 겹침 점검: 제목 ${titles.length}건 대조 (연속 ${OVERLAP_WINDOW}자 이상 / 제목 전체 포함, 공백·구두점 무시) — 겹침 ${total}건`);
  overlapLines.push(`  - 소재 요약 ${motifs.length}건: 최대 연속 일치 ${summaryMax}자, 겹침 ${summaryProblems.length}건`);
  for (const r of reports) overlapLines.push(`  - ${r.file} (글 ${r.units}덩어리): 최대 연속 일치 ${r.maxLength}자, 겹침 ${r.problems.length}건`);
  const targetNotes = DEFAULT_EXTRA_TARGETS.map((t) => `${t.dir}/ — ${t.why}`);
  overlapLines.push(`  기본 점검 대상: ${targetNotes.join(' / ')}${extraFromArgs.length > 0 ? ` + --extra ${extraFromArgs.length}개` : ''}`);
}

console.log(formatStats(result.stats, categories).join('\n'));
console.log(overlapLines.join('\n'));
for (const w of result.warnings) console.log('경고: ' + w);
if (problems.length > 0) {
  console.error(`소재 목록 점검 실패: ${problems.length}건`);
  fail(problems.map((p) => '- ' + p));
}
console.log(`소재 목록 점검 통과${strict ? ' (분량 기준 포함)' : ' (분량 기준은 경고만)'}: ${motifsPath}`);
