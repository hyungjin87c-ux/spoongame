import { expect, test, type Page } from '@playwright/test';
import {
  GAME_KEY,
  KNOWN_SEED,
  birthState,
  injectSave,
  lifeSnapshot,
  lifeState,
  readSave,
  readSettings,
  recordClicks,
  recordedClicks,
  replaceSaveAndReload,
  settle,
  startPageHidden,
  type LifeSnapshot,
} from './helpers';

/**
 * R-035: "살아가기"·"이 탭에서 이어하기"를 더블탭하면 둘째 입력이 같은 좌표에 새로 뜬 인생 화면 컨트롤(속도 4개·다음 결정으로·자동 모드)에
 * 떨어질 수 있다. 화면이 뜬 직후 INPUT_GUARD_MS 동안 컨트롤도 입력을 무시해야 하고, 그 가드는 화면 진입 때만 걸려야 한다.
 *
 * R-050: 어느 뷰포트에서 겹치는지는 표로 적지 않고 **그 뷰포트에서 실제로 잰다** — 시작 화면 버튼의 영역과 인생 화면 컨트롤 버튼들의 영역이 겹치는 곳(교집합)을 구하고,
 * 그 교집합의 한가운데를 더블클릭한다(글꼴·줄바꿈이 달라 레이아웃이 몇 px 움직여도 측정이 따라간다).
 *  - 겹치면: 가드가 있을 때 상태가 하나도 바뀌지 않고 둘째 입력이 닫힌 컨트롤에 닿았으며, 가드를 끈 대조군(?__guard=0, 개발 서버 전용 탐침)에서는 같은 조작이 실제로 상태를 바꾼다.
 *  - 겹치지 않으면: 짧게만 본다(가드가 있을 때 상태가 안 바뀌고 컨트롤에 닿지 않는다).
 *  - 공허 통과 방지(스위트 수준): 모든 뷰포트를 다시 재서 "겹침이 관측된 뷰포트가 N개 이상", "그중 대조군(가드 없음)에서 실제로 변화가 관측된 뷰포트가 N개 이상"을 단언하는
 *    테스트가 따로 있다. 측정이 모두 "안 겹침"으로 나오거나 대조군이 아무것도 못 바꿔도 통과하지 못한다. (뷰포트별 테스트는 서로 독립이라 병렬로 돈다.)
 * 앱 타이머는 멈춰 둔다(startPageHidden): 나이는 "다음 결정으로"를 눌렀을 때만 바뀐다. 고정 대기 없음.
 */

const SETTINGS = { speed: 1, autoMode: false } as const;
const SWEEP_TIMEOUT_MS = 120_000;
/** 교집합이 이 값(px)보다 얇으면 "닿는다"고 단정하지 않는다(서브픽셀·경계). 이 값 이상이면 교집합 한가운데의 클릭은 반드시 두 버튼 모두에 떨어진다. */
const MIN_OVERLAP_PX = 4;
/** 겹치는 곳을 더블클릭할 때, 버튼 폭의 이 비율 지점도 함께 누른다(R-035: 좌·우 1/4 지점). 겹치지 않는 뷰포트는 이 지점들만 짧게 본다. */
const FRACTIONS = [1 / 4, 1 / 2, 3 / 4];
const INITIAL: LifeSnapshot = { speed: '1', auto: 'false', age: '0세', hasChoice: false };
/** 눌러도 상태가 안 바뀌는 컨트롤(이미 1배속이다): 가드가 막았는지는 landed로 보고, 대조군의 변화 기대에서는 뺀다. */
const NO_EFFECT_CONTROLS = ['speed-1'];
/** 뷰포트당 확인할 컨트롤 교집합(너무 오래 걸리지 않게 속도 2·8배, 다음 결정으로, 자동 모드). 속도 4배는 2·8배와 같은 경로라 생략한다. */
const PROBED_CONTROLS = ['speed-2', 'speed-8', 'skip', 'auto'];

/**
 * 겹침이 관측돼야 하는 하한(스위트 수준). 이 개발 환경에서 측정한 현재 값(R-087에서 다시 쟀다)은 살아가기 9곳(11곳 중 360x667·360x740만 안 겹친다), 이어하기 3곳(360x320·320x360·480x320)이다.
 * M5에서 낮은 화면의 하단 컨트롤 바를 얇게 줄였다(QA 사용감 1: 가로 모드 117px → 약 49px). 그 결과 "이 탭에서 이어하기" 버튼이 컨트롤과 겹치던 가로 모드(667x375·740x360·568x320)의
 * 겹침은 사라졌다 — 겹침 자체가 줄어든 개선이다. 하한이 의미를 잃지 않도록 더 낮은 뷰포트(360x320·320x360·480x320: 200% 확대한 작은 창에 해당)를 목록에 더했다.
 * 글꼴이 달라 몇 px 움직여도 이 하한은 유지되도록 교집합이 큰(14px 이상) 뷰포트만 골랐다.
 */
const MIN_OVERLAPPED_BIRTH_VIEWPORTS = 5;
const MIN_OVERLAPPED_TAKEOVER_VIEWPORTS = 2;

const VIEWPORTS = [
  { width: 360, height: 480 }, // 낮은 폰: 다음 결정으로/자동 모드 줄
  { width: 360, height: 568 }, // 속도 줄
  { width: 320, height: 568 }, // 더 좁은 폰
  { width: 360, height: 667 }, // 겹치지 않음(여유 26px)
  { width: 360, height: 740 }, // 겹치지 않음
  { width: 667, height: 375 }, // 가로
  { width: 740, height: 360 }, // 가로
  { width: 568, height: 320 }, // 가로
  { width: 360, height: 320 }, // 작은 창(M5: 컨트롤 바를 얇게 한 뒤에도 이어하기와 겹친다)
  { width: 320, height: 360 },
  { width: 480, height: 320 },
] as const;

interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
interface NamedRect extends Rect {
  id: string;
}
interface Point {
  x: number;
  y: number;
  /** 어느 컨트롤의 교집합 한가운데인가(분수 지점이면 null) */
  control: string | null;
}

async function controlRects(page: Page): Promise<NamedRect[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-testid="controls"] button')].map((b) => {
      const r = b.getBoundingClientRect();
      return { id: b.dataset.testid ?? `speed-${b.dataset.speed}`, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }),
  );
}

async function targetRect(page: Page, testId: string): Promise<Rect & { width: number }> {
  const target = page.getByTestId(testId);
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  expect(box, `${testId} 버튼이 화면에 있어야 한다`).not.toBeNull();
  return { left: box!.x, right: box!.x + box!.width, top: box!.y, bottom: box!.y + box!.height, width: box!.width };
}

/** 시작 화면 버튼과 각 컨트롤의 교집합 (너비·높이가 모두 MIN_OVERLAP_PX 이상인 것만) */
function overlapsWith(button: Rect, controls: NamedRect[]): Array<{ id: string; w: number; h: number; center: { x: number; y: number } }> {
  const out: Array<{ id: string; w: number; h: number; center: { x: number; y: number } }> = [];
  for (const c of controls) {
    const left = Math.max(button.left, c.left);
    const right = Math.min(button.right, c.right);
    const top = Math.max(button.top, c.top);
    const bottom = Math.min(button.bottom, c.bottom);
    if (right - left >= MIN_OVERLAP_PX && bottom - top >= MIN_OVERLAP_PX) out.push({ id: c.id, w: right - left, h: bottom - top, center: { x: (left + right) / 2, y: (top + bottom) / 2 } });
  }
  return out;
}

interface Trial {
  point: Point;
  snapshot: LifeSnapshot;
  /** 더블탭의 둘째 이후 입력이 떨어진 곳 ("(가드)"는 그 버튼이 닫혀 있었다는 뜻) */
  landed: string[];
  savedSpeed: number;
  savedAuto: boolean;
  savedAge: number;
  savedPending: string | null;
}

async function readTrial(page: Page, point: Point): Promise<Trial> {
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await settle(page);
  const save = (await readSave(page)).data;
  const settings = await readSettings(page);
  return {
    point,
    snapshot: await lifeSnapshot(page),
    landed: (await recordedClicks(page)).slice(1), // 첫 입력(시작 화면의 버튼)을 뺀 나머지
    savedSpeed: settings.speed,
    savedAuto: settings.autoMode,
    savedAge: save.age,
    savedPending: save.pending?.key ?? null,
  };
}

const isChanged = (t: Trial) =>
  t.snapshot.speed !== INITIAL.speed ||
  t.snapshot.auto !== INITIAL.auto ||
  t.snapshot.age !== INITIAL.age ||
  t.snapshot.hasChoice ||
  t.savedSpeed !== SETTINGS.speed ||
  t.savedAuto !== SETTINGS.autoMode ||
  t.savedAge !== 0 ||
  t.savedPending !== null;

const wasIntercepted = (t: Trial) => t.landed.some((c) => c.endsWith('(가드)'));
const describeTrial = (t: Trial) => `x=${Math.round(t.point.x)} y=${Math.round(t.point.y)} (${t.point.control ?? '분수 지점'}): 둘째 입력(${t.landed.join(', ')}) 뒤 ${JSON.stringify(t.snapshot)}`;

/** 시작 화면의 종류: 어떤 화면에서 어떤 버튼을 더블탭하는가 */
interface Entry {
  kind: 'birth' | 'takeOver';
  label: string;
  buttonId: 'next-life' | 'take-over';
  /** 이 화면을 새로 띄우고 버튼이 눌릴 때까지 기다린다 (기록된 클릭도 비운다) */
  setup: (page: Page) => Promise<void>;
}

const BIRTH_SAVE = birthState(KNOWN_SEED, 'present', 3, 50);
const LIFE_SAVE = lifeState(KNOWN_SEED);

const ENTRIES: Entry[] = [
  {
    kind: 'birth',
    label: '"살아가기"',
    buttonId: 'next-life',
    setup: async (page) => {
      await replaceSaveAndReload(page, BIRTH_SAVE, SETTINGS);
      await expect(page.getByTestId('next-life')).toBeEnabled(); // 시작 화면 버튼의 가드가 풀릴 때까지(대조군은 곧바로)
    },
  },
  {
    kind: 'takeOver',
    label: '"이 탭에서 이어하기"',
    buttonId: 'take-over',
    setup: async (page) => {
      await replaceSaveAndReload(page, LIFE_SAVE, SETTINGS);
      await expect(page.getByTestId('life-screen')).toBeVisible();
      // 다른 탭이 저장을 바꿨다 → 이 탭은 "이 탭에서 이어하기" 화면
      await page.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), GAME_KEY);
      await expect(page.getByTestId('take-over')).toBeEnabled();
      await page.evaluate(() => ((window as unknown as { __clicks: string[] }).__clicks.length = 0)); // 이 더블클릭의 입력만 기록
    },
  },
];

/** 이 뷰포트에서 인생 화면 컨트롤이 놓이는 자리(뷰포트 기준)를 인생 화면에서 잰다 */
async function measureControls(page: Page): Promise<NamedRect[]> {
  await replaceSaveAndReload(page, LIFE_SAVE, SETTINGS);
  await expect(page.getByTestId('life-screen')).toBeVisible();
  const rects = await controlRects(page);
  expect(rects.map((r) => r.id)).toEqual(['speed-1', 'speed-2', 'speed-4', 'speed-8', 'skip', 'auto']);
  return rects;
}

interface Measured {
  /** 더블클릭할 점들: 겹치는 컨트롤의 교집합 한가운데 + 버튼 폭의 1/4·1/2·3/4 */
  points: Point[];
  /** 겹치는 컨트롤 전부 (확인 대상이 아닌 것 포함) */
  overlapIds: string[];
  /** 겹치는 컨트롤 중 누르면 상태가 바뀌는 것이 있는가 */
  changing: boolean;
  /** 겹침이 가장 큰 곳의 두께(px) — 로그용 */
  deepest: number;
}

/** 시작 화면에서 버튼의 영역을 재고, 인생 화면 컨트롤과의 교집합을 구해 더블클릭할 점들을 정한다 */
async function measureEntry(page: Page, entry: Entry, controls: NamedRect[]): Promise<Measured> {
  await entry.setup(page);
  const r = await targetRect(page, entry.buttonId);
  const rowY = (r.top + r.bottom) / 2;
  const overlaps = overlapsWith(r, controls);
  const probed = overlaps.filter((o) => PROBED_CONTROLS.includes(o.id));
  const points: Point[] = [
    ...FRACTIONS.map((f) => ({ x: r.left + r.width * f, y: rowY, control: null })),
    ...probed.map((o) => ({ x: o.center.x, y: o.center.y, control: o.id })),
  ];
  return {
    points,
    overlapIds: overlaps.map((o) => o.id),
    changing: overlaps.some((o) => !NO_EFFECT_CONTROLS.includes(o.id)),
    deepest: Math.max(0, ...overlaps.map((o) => Math.min(o.w, o.h))),
  };
}

/** 점마다: 화면을 새로 띄우고, 버튼이 눌릴 수 있게 되면 그 점을 더블클릭한 결과를 읽는다. guardOn=false면 ?__guard=0(대조군). */
async function sweep(page: Page, entry: Entry, points: Point[], guardOn: boolean): Promise<Trial[]> {
  await page.goto(guardOn ? '/' : '/?__guard=0');
  const trials: Trial[] = [];
  for (const point of points) {
    await entry.setup(page);
    await targetRect(page, entry.buttonId); // 점을 잰 때와 같은 스크롤 위치로 맞춘다
    await page.mouse.dblclick(point.x, point.y);
    trials.push(await readTrial(page, point));
  }
  return trials;
}

/** 뷰포트 하나의 측정만 한다(더블클릭 없음): 컨트롤 영역은 뷰포트마다 한 번 재고, 시작 화면 버튼마다 교집합을 구한다. */
async function prepareViewport(page: Page, vp: { width: number; height: number }, kind: Entry['kind']): Promise<void> {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await startPageHidden(page);
  await recordClicks(page);
  await injectSave(page, kind === 'birth' ? BIRTH_SAVE : LIFE_SAVE, '/', SETTINGS);
}

test.describe('시작 화면 더블탭이 인생 화면 컨트롤에 떨어지는가 (R-035, R-050)', () => {
  for (const vp of VIEWPORTS) {
    for (const entry of ENTRIES) {
      test(`${vp.width}x${vp.height}: ${entry.label} 더블클릭의 둘째 입력이 겹친 인생 화면 컨트롤에 떨어져도 배속·자동 모드·나이·선택지는 그대로다. 겹침은 측정으로 정하고, 가드를 끈 대조군에서는 실제로 바뀐다 (R-035, R-050)`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(SWEEP_TIMEOUT_MS);
        await prepareViewport(page, vp, entry.kind);

        const controls = await measureControls(page);
        const measured = await measureEntry(page, entry, controls);
        const overlapped = measured.overlapIds.length > 0;
        const where = `${vp.width}x${vp.height} ${entry.label}: 겹침 ${overlapped ? measured.overlapIds.join('·') + ` (가장 두꺼운 곳 ${Math.round(measured.deepest)}px)` : '없음'}`;
        testInfo.annotations.push({ type: '측정', description: where });

        if (!overlapped) {
          // 겹치지 않는 뷰포트: 가드가 있을 때 상태가 바뀌지 않고, 둘째 입력이 어떤 컨트롤에도 닿지 않는다(짧게만)
          const trials = await sweep(page, entry, measured.points, true);
          expect(trials.length, where).toBe(FRACTIONS.length);
          for (const t of trials) {
            expect(isChanged(t), `${where} — ${describeTrial(t)}`).toBe(false);
            expect(wasIntercepted(t), `${where} — 겹치지 않는데 컨트롤에 닿았다: ${describeTrial(t)}`).toBe(false);
          }
          return;
        }

        // 가드 있음(기본): 어디를 눌러도 상태가 바뀌지 않는다. 교집합 한가운데의 둘째 입력은 닫힌 컨트롤에 닿는다.
        const guarded = await sweep(page, entry, measured.points, true);
        for (const t of guarded) expect(isChanged(t), `${where} — ${describeTrial(t)}`).toBe(false);
        const directed = guarded.filter((t) => t.point.control !== null);
        expect(directed.length, `${where}: 확인할 컨트롤 교집합이 있어야 한다`).toBeGreaterThan(0);
        expect(guarded.filter(wasIntercepted).length, `${where}: 겹치는 곳을 눌렀는데 둘째 입력이 닫힌 컨트롤에 닿은 적이 없다`).toBeGreaterThan(0);

        // 대조군: 가드를 끄면(?__guard=0) 같은 조작이 실제로 상태를 바꾼다 — 위 단언이 가드를 가른다는 증거
        const unguarded = await sweep(page, entry, measured.points, false);
        if (measured.changing && directed.some((t) => !NO_EFFECT_CONTROLS.includes(t.point.control ?? ''))) {
          expect(unguarded.filter(isChanged).length, `${where}: 대조군(가드 없음)에서 더블클릭이 컨트롤을 눌러 상태가 바뀌어야 한다`).toBeGreaterThan(0);
        }
      });
    }
  }

  test('공허 통과 방지: 모든 뷰포트를 다시 재어, 겹침이 관측된 뷰포트가 충분히 많고 그중 대조군(가드 없음)에서 실제 변화가 관측된다 (R-050)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    test.setTimeout(SWEEP_TIMEOUT_MS);
    const rows: Array<{ viewport: string; kind: Entry['kind']; overlapped: boolean; changingChanged: boolean | null }> = [];
    for (const vp of VIEWPORTS) {
      await prepareViewport(page, vp, 'birth');
      const controls = await measureControls(page);
      for (const entry of ENTRIES) {
        const measured = await measureEntry(page, entry, controls);
        const overlapped = measured.overlapIds.length > 0;
        let changingChanged: boolean | null = null;
        // 겹치고 누르면 바뀌는 컨트롤이 있으면, 가드를 끈 채 그 한 곳만 더블클릭해 실제 변화를 직접 관측한다
        const target = measured.points.find((p) => p.control !== null && !NO_EFFECT_CONTROLS.includes(p.control));
        if (overlapped && measured.changing && target !== undefined) changingChanged = (await sweep(page, entry, [target], false)).some(isChanged);
        rows.push({ viewport: `${vp.width}x${vp.height}`, kind: entry.kind, overlapped, changingChanged });
      }
    }
    const summary = (kind: Entry['kind']) =>
      rows
        .filter((r) => r.kind === kind)
        .map((r) => `${r.viewport}:${r.overlapped ? `겹침(대조군 변화 ${r.changingChanged})` : '안 겹침'}`)
        .join(', ');
    testInfo.annotations.push({ type: '측정', description: `살아가기 [${summary('birth')}] / 이어하기 [${summary('takeOver')}]` });

    const birth = rows.filter((r) => r.kind === 'birth');
    const takeOver = rows.filter((r) => r.kind === 'takeOver');
    expect(birth.filter((r) => r.overlapped).length, `"살아가기"와 컨트롤이 겹친 뷰포트: ${summary('birth')}`).toBeGreaterThanOrEqual(MIN_OVERLAPPED_BIRTH_VIEWPORTS);
    expect(birth.filter((r) => r.changingChanged === true).length, `그중 대조군에서 상태가 실제로 바뀐 뷰포트: ${summary('birth')}`).toBeGreaterThanOrEqual(MIN_OVERLAPPED_BIRTH_VIEWPORTS);
    expect(takeOver.filter((r) => r.overlapped).length, `"이 탭에서 이어하기"와 컨트롤이 겹친 뷰포트: ${summary('takeOver')}`).toBeGreaterThanOrEqual(MIN_OVERLAPPED_TAKEOVER_VIEWPORTS);
    expect(takeOver.filter((r) => r.changingChanged === true).length, `그중 대조군에서 상태가 실제로 바뀐 뷰포트: ${summary('takeOver')}`).toBeGreaterThanOrEqual(MIN_OVERLAPPED_TAKEOVER_VIEWPORTS);
    // 겹치지 않는 뷰포트도 있어야 측정이 무언가를 가른다(모든 곳이 겹친다고 나오면 측정이 의미 없다).
    // M3: 출생신고의 「살아가기」가 하단 고정 띠로 옮겨 가(화면 아래 가운데) 인생 화면의 컨트롤 줄과 11개 뷰포트 모두에서 겹친다 — 예전에는 360x667·360x740에서 안 겹쳤다.
    // 그래서 이 확인은 두 시작 화면(「살아가기」·「이 탭에서 이어하기」)을 함께 본다: 「이 탭에서 이어하기」는 대부분의 뷰포트에서 겹치지 않는다. 가르는 힘의 핵심은 아래 대조군(겹친 곳은 가드를 끄면 실제로 상태가 바뀐다)이다.
    expect(rows.some((r) => !r.overlapped), `컨트롤과 겹치지 않는 (뷰포트, 시작 화면): 살아가기 [${summary('birth')}] / 이어하기 [${summary('takeOver')}]`).toBe(true);
    // 대조군에서 변화가 없어야 하는 곳은 없다: 겹치고 바뀌는 컨트롤이 있는 곳은 전부 바뀌었다
    expect(rows.filter((r) => r.changingChanged === false).map((r) => `${r.viewport} ${r.kind}`), '겹치는데 대조군에서도 안 바뀐 곳').toEqual([]);
  });
});

test('데스크톱: 하단 고정 「살아가기」 자리와 인생 화면 컨트롤이 겹치는 곳을 재고, 어느 지점을 더블클릭해도 인생 화면 상태는 그대로다 — 둘째 입력은 닫힌 컨트롤에 닿고, 가드를 끄면 실제로 바뀐다 (R-035, M3)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '기본 뷰포트(1280x800)를 쓰므로 desktop에서만 실행');
  await startPageHidden(page);
  await recordClicks(page);
  await injectSave(page, BIRTH_SAVE, '/', SETTINGS);
  const controls = await measureControls(page);
  const measured = await measureEntry(page, ENTRIES[0], controls);
  // M3 이전에는 출생 화면의 「살아가기」가 본문 안에 있어 데스크톱에서 컨트롤과 겹치지 않았다. 이제 화면 아래 고정 띠라 인생 화면의 컨트롤 줄과 겹친다 — 그래서 가드가 막아야 하는 경우로 바뀌었다.
  expect(measured.overlapIds.length, '데스크톱에서도 하단 고정 「살아가기」가 인생 화면 컨트롤과 겹친다(측정)').toBeGreaterThan(0);

  const trials = await sweep(page, ENTRIES[0], measured.points, true);
  expect(trials.length).toBeGreaterThan(FRACTIONS.length); // 분수 지점 + 겹침 한가운데 지점들
  for (const t of trials) expect(isChanged(t), describeTrial(t)).toBe(false);
  expect(trials.filter(wasIntercepted).length, '겹치는 곳을 눌렀는데 둘째 입력이 닫힌 컨트롤에 닿은 적이 없다').toBeGreaterThan(0);
  // 대조군: 가드를 끄면 같은 조작이 실제로 상태를 바꾼다 — 위 단언이 가드를 가른다는 증거
  const unguarded = await sweep(page, ENTRIES[0], measured.points, false);
  expect(unguarded.filter(isChanged).length, '대조군(가드 없음)에서 더블클릭이 컨트롤을 눌러 상태가 바뀌어야 한다').toBeGreaterThan(0);
});

test('가드는 화면이 뜰 때 한 번만 걸린다: 플레이 중 배속 버튼 연타·나이가 오를 때·자동 모드 해제에서 컨트롤이 다시 닫히지 않는다 (R-035)', async ({ page }) => {
  test.setTimeout(60_000);
  // 페이지 안에서: 컨트롤이 모두 열린 뒤에 어느 하나라도 다시 aria-disabled=true가 되면 센다.
  // 이 테스트는 자동 모드(선택지에서 멈추지 않고 계속 흐름)에서 도는데, 자동 모드에서는 "다음 결정으로"가 호출자 비활성(aria-disabled, R-036)이라
  // 가드와 구별되지 않는다 → 가드만 보려고 "다음 결정으로"를 뺀 나머지 5개를 본다. ("다음 결정으로"도 같은 상수 키를 쓰는지는 tests/guard.test.tsx가 본다.)
  await page.addInitScript(() => {
    const w = window as unknown as { __opened: boolean; __reclosed: number };
    w.__opened = false;
    w.__reclosed = 0;
    new MutationObserver(() => {
      const buttons = [...document.querySelectorAll<HTMLElement>('[data-testid="controls"] button')].filter((b) => b.dataset.testid !== 'skip');
      if (buttons.length === 0) return;
      const anyClosed = buttons.some((b) => b.getAttribute('aria-disabled') === 'true');
      if (!anyClosed) w.__opened = true;
      else if (w.__opened) w.__reclosed++;
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-disabled'] });
  });
  // 자동 모드라 선택지에서 멈추지 않고 계속 흐른다. 한 해 약 0.2초(1배속, 시간 배율 20) → 몇 초 안에 여러 해가 지난다.
  await injectSave(page, lifeState(KNOWN_SEED), '/?__timescale=20', { speed: 1, autoMode: true });
  await expect(page.getByTestId('life-screen')).toBeVisible();
  const probe = () =>
    page.evaluate(() => ({ opened: (window as unknown as { __opened: boolean }).__opened, reclosed: (window as unknown as { __reclosed: number }).__reclosed }));
  await expect.poll(async () => (await probe()).opened).toBe(true);

  // 배속 버튼 연타: 중간에 닫히면 일부 입력이 무시돼 마지막 값이 되지 않는다
  const centers = new Map<number, { x: number; y: number }>();
  for (const s of [1, 2, 4, 8]) {
    const box = (await page.locator(`[data-speed="${s}"]`).boundingBox())!;
    centers.set(s, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  }
  for (const s of [8, 4, 1, 8, 4, 2]) await page.mouse.click(centers.get(s)!.x, centers.get(s)!.y);
  await expect(page.locator('[data-speed="2"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await readSettings(page)).speed).toBe(2);

  // 나이가 계속 오르는 동안(여러 해 진행) 컨트롤은 한 번도 다시 닫히지 않는다
  const age = async () => Number((await lifeSnapshot(page)).age.split('세')[0]);
  const ageBefore = await age();
  await expect.poll(age, { timeout: 20_000 }).toBeGreaterThanOrEqual(ageBefore + 3);
  expect((await probe()).reclosed, '컨트롤이 다시 닫힌 횟수').toBe(0);

  // 자동 모드는 즉시 해제된다: 켜고 끄기를 빠르게 세 번 (가드가 다시 닫혔다면 일부가 무시돼 짝이 어긋난다)
  const auto = page.getByTestId('auto');
  const box = (await auto.boundingBox())!;
  for (let i = 0; i < 3; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(auto).toHaveAttribute('aria-pressed', 'false'); // 켜짐(시작) → 꺼짐 → 켜짐 → 꺼짐
  await expect.poll(async () => (await readSettings(page)).autoMode).toBe(false);
  expect((await probe()).reclosed, '컨트롤이 다시 닫힌 횟수').toBe(0);
});
