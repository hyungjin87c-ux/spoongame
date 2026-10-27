import { expect, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { findImpactState } from './m5States';
import { GAME_KEY, KNOWN_SEED, evalCore, injectSave, lifeState, oracleAuto, oracleLife, startPageHidden } from './helpers';

/**
 * M4 새 화면(대시보드·엔딩·밀린 화면·오류 화면)의 상태 (SPEC-003 CM10·CM11·QM2-10·QM3-1, M3의 `m3States.ts`와 같은 역할).
 *  - dash-infant    인생 0세(영아, 선택지 없음): 얼굴 영아, 학력 「취학 전」, 자산 현황은 스무 살 전 안내, 기록은 출생 한 줄
 *  - dash-decision  선택지 3개 이상이 떠 있는 대시보드(중대 결정 카드가 맨 위): 카드·선택지가 고정 머리·진행 줄과 겹치는 대표 상태. M5부터 **영향 줄이 가장 긴 성인 결정**(선택지 중 하나가 5항목)이라 영향 줄·안내 한 줄까지 모든 M4 감사(고정 요소·포커스·낱말 끊김·색)가 함께 잰다
 *  - dash-adult     50세(성인, 선택지 없음): 얼굴 중년, 기록이 길고 식구(배우자·자녀)·또래 라벨이 다양
 *  - dash-exit-ask  50세 대시보드에 **나가기 확인 단계**가 열려 있다(R-322): 긴 안내문 + 버튼 둘(「첫 화면으로 나가기」·「돌아가기」, 포커스는 「돌아가기」) — 프로그램 포커스·낱말 줄바꿈·넘침(R-336)·대비 감사의 대상
 *  - dash-tools-open 50세 대시보드에 **도구 줄이 모두 열려 있다**(R-322): BGM 켜짐(볼륨 슬라이더·읽기 전용 「켜짐」) — 슬라이더 가림·넘침·대비 감사의 대상
 *  - ending         사망 후 엔딩: 긴 연표, 「다시 태어나기」 버튼
 *  - superseded     「저장 안내」(밀린 화면): 「이 탭에서 이어하기」
 *  - error          「오류」(ErrorBoundary): 「저장 지우고 새로 시작」
 * 대시보드·엔딩은 가려진 탭처럼 시간을 멈춰(startPageHidden) 연 뒤 입력 가드가 풀릴 때까지 기다려 돌려준다 — 측정 중에 나이가 오르거나 선택지가 뜨지 않는다.
 */
export type M4Screen = 'dash-infant' | 'dash-decision' | 'dash-adult' | 'dash-exit-ask' | 'dash-tools-open' | 'ending' | 'superseded' | 'error';

/**
 * 감사 목록(`M4_SCREENS`)에는 없고 특정 시험만 쓰는 상태:
 *  - dash-diamond  50세 대시보드인데 출신 가정이 **다이아몬드수저**(5단계)로 고정돼 프로필 칩에 「다이아몬드<wbr>수저」가 반드시 있다(R-332 — 시드 777의 판은 다이아몬드수저가 하나도 없어 `<wbr>` 대조가 공허하게 통과했다)
 */
export type M4ExtraScreen = 'dash-diamond';

export const DASH_SCREENS = ['dash-infant', 'dash-decision', 'dash-adult', 'dash-exit-ask', 'dash-tools-open'] as const;
export const M4_SCREENS: readonly M4Screen[] = [...DASH_SCREENS, 'ending', 'superseded', 'error'];

export function isDash(screen: M4Screen): boolean {
  return (DASH_SCREENS as readonly string[]).includes(screen);
}

/** 화면이 뜬 뒤 포커스가 가는 제목(h1)의 data-testid. 오류 화면은 제목에 id가 없다 → null */
export function headingOf(screen: M4Screen): string | null {
  switch (screen) {
    case 'ending':
      return 'ending-name';
    case 'superseded':
      return 'superseded-text';
    case 'error':
      return null;
    default:
      return 'life-name';
  }
}

/** 화면의 기본 버튼(입력 가드가 풀리면 활성) — 화면이 준비됐는지 확인하는 데 쓴다 */
export function readyButton(page: Page, screen: M4Screen | M4ExtraScreen) {
  switch (screen) {
    case 'dash-exit-ask':
      return page.getByTestId('exit-no');
    case 'ending':
      return page.getByTestId('rebirth');
    case 'superseded':
      return page.getByTestId('take-over');
    case 'error':
      return page.getByRole('button', { name: '저장 지우고 새로 시작' });
    default:
      return page.getByTestId('auto');
  }
}

/** 50세(선택지 없음) 성인 상태: 시드 777의 인생을 자동 진행해 만든다 */
export async function adultState(page: Page): Promise<GameState> {
  return evalCore<GameState>(
    page,
    `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(777), 'alpha')));
     while (s.phase === 'life' && (s.age < 50 || s.pending !== null)) s = s.pending ? core.autoResolveStep(s, s.pending.key).state : core.stepYear(s).state;
     return s;`,
  );
}

/** 상태에 맞는 화면을 연다. 입력 가드가 풀린 뒤에 돌려준다. */
export async function openM4Screen(page: Page, screen: M4Screen | M4ExtraScreen, seed = KNOWN_SEED): Promise<void> {
  if (screen === 'error') {
    await page.goto('/?__crash=1');
    await expect(page.getByTestId('error-screen')).toBeVisible();
    await expect(readyButton(page, screen)).toBeEnabled();
    return;
  }
  await startPageHidden(page);
  await page.goto('/');
  if (screen === 'dash-infant') {
    await injectSave(page, lifeState(seed), '/', { speed: 1, autoMode: false });
  } else if (screen === 'dash-decision') {
    // 자동 모드 켜짐 = 비모달 인라인 카드(M7b): M4 대시보드 시험이 보던 「결정 카드가 가운데 열에 놓이고 진행 줄·도구 줄에 그대로 닿는」 상태다(가려진 탭이라 자동 선택은 일어나지 않는다).
    // 수동 모드의 모달 시트·접힌 띠는 e2e/m7b-*가 잰다
    await injectSave(page, await findImpactState(page, 'adult'), '/', { speed: 1, autoMode: true });
    await expect(page.getByTestId('choice-panel')).toBeVisible();
  } else if (screen === 'dash-adult' || screen === 'dash-exit-ask' || screen === 'dash-tools-open' || screen === 'dash-diamond') {
    const base = await adultState(page);
    const adult: GameState = screen === 'dash-diamond' ? { ...base, character: { ...base.character!, parentWealth: 5 } } : base;
    expect(adult.history.length, '긴 인생 기록').toBeGreaterThan(20);
    // 도구 줄이 열린 상태는 BGM 「켜짐」을 설정으로 건다 — 새로고침 직후라 소리 장치는 만들지 않고(활성화 입력 전) 볼륨 슬라이더만 나타난다
    await injectSave(page, adult, '/', screen === 'dash-tools-open' ? { speed: 1, autoMode: false, bgm: { on: true, volume: 30 } } : { speed: 1, autoMode: false });
  } else if (screen === 'ending') {
    const ended = await oracleAuto(page, await oracleLife(page, seed, 'alpha'));
    expect(ended.phase).toBe('ending');
    await injectSave(page, ended, '/', { speed: 1, autoMode: false });
  } else {
    // superseded: 저장이 이 화면 밖에서 바뀌었다는 storage 이벤트를 받는다
    await injectSave(page, lifeState(seed), '/', { speed: 1, autoMode: false });
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await page.evaluate((key) => window.dispatchEvent(new StorageEvent('storage', { key })), GAME_KEY);
  }
  await expect(page.getByTestId(screen === 'ending' ? 'ending-screen' : screen === 'superseded' ? 'superseded-screen' : 'life-screen')).toBeVisible();
  if (screen === 'dash-exit-ask') {
    // 도구 줄의 「나가기」를 눌러 확인 단계를 연다(진입 입력 가드가 풀린 뒤). 열리면 안전한 쪽(돌아가기)에 포커스가 간다
    await expect(page.getByTestId('tool-exit')).toBeEnabled();
    await page.getByTestId('tool-exit').click();
    await expect(page.getByTestId('exit-ask')).toBeVisible();
    await expect(page.getByTestId('exit-no')).toBeFocused();
  }
  if (screen === 'dash-tools-open') {
    await expect(page.getByTestId('bgm-volume-input')).toBeVisible();
    await expect(page.getByTestId('tool-note')).not.toContainText('준비 중'); // M7c: 생각 남기기는 보통 버튼 (D-75)
  }
  await expect(readyButton(page, screen)).toBeEnabled();
}
