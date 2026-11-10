import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  advanceUntilDecision,
  beginBirth,
  createInitialState,
  createSession,
  enterBirth,
  parseGame,
  serializeGame,
  sessionReducer,
  type GameState,
  type Session,
  type SessionAction,
} from '../src/core';
import { startLife } from '../scripts/simulateLib';
import { ERROR_HEAD_NAME } from '../src/screens/ErrorBoundary';
import { HeaderLogo, LOGO_HOME_LABEL, SiteHead, TitleWordmark } from '../src/ui/Brand';
import { autoChooseArmed } from '../src/ui/decisionFold';

/**
 * 헤더 로고 → 첫 화면 (SPEC-016 H1). 서버 렌더로 마크업(접근 이름·버튼·눌림 영역 클래스)을 읽고, 눌렀을 때 일어나는 일은 reducer(`openTitle` → `resume`)로 읽는다.
 * 실제 클릭·초점·연타·겹창·저장 열기는 e2e/logo-home.spec.ts. App의 연결(어느 화면이 `onHome`을 받는가)은 소스 글로 지킨다(렌더 시험이 App을 못 띄우므로).
 */

const send = (s: Session, a: SessionAction): Session => sessionReducer(s, a);
const SETTINGS = { speed: 1, autoMode: false } as const;
const inRoulette = (): Session => createSession(beginBirth(createInitialState(7), 'industrial', 'short30'), SETTINGS);
const inBirth = (): Session => createSession(enterBirth(beginBirth(createInitialState(7), 'industrial', 'short30')), SETTINGS);
const inLife = (): Session => createSession(startLife(7, 'alpha'), SETTINGS);
const bytes = (g: GameState): string => serializeGame(g);
/** 저장 글에서 일시정지 표시 한 필드만 뺀 것 */
const withoutPaused = (g: GameState): unknown => {
  const j = JSON.parse(serializeGame(g)) as { version: number; data: Record<string, unknown> };
  delete j.data.paused;
  return j;
};

async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}

describe('로고 컨트롤: 접근 이름·구조 (완료 기준 1)', () => {
  const noop = () => undefined;
  const html = renderToStaticMarkup(<SiteHead name="룰렛" onHome={noop} />);

  it('onHome이 있으면 로고는 버튼이고, 접근 이름에 「수저 게임」과 「첫 화면으로」가 모두 있다', () => {
    expect(LOGO_HOME_LABEL).toBe('수저 게임, 첫 화면으로');
    expect(LOGO_HOME_LABEL).toContain('수저 게임');
    expect(LOGO_HOME_LABEL).toContain('첫 화면으로');
    expect(html).toMatch(/<button type="button" class="logo-link" aria-label="수저 게임, 첫 화면으로" data-testid="logo-home">/);
  });

  it('안쪽 그림은 aria-hidden이라 로고 SVG의 role="img" 이름과 겹쳐 읽히지 않는다 (바깥 버튼 이름 하나) — data-testid="header-logo"는 그림 칸에 그대로 있다', () => {
    expect(html).toMatch(/<span class="logo-wrap logo--header" data-testid="header-logo" aria-hidden="true">/);
    // 버튼 밖에는 이름을 가진 로고 그림이 없다: role="img"는 aria-hidden 칸 안에만 있다
    const outside = html.replace(/<button[^]*?<\/button>/, '');
    expect(outside).not.toContain('role="img"');
    expect(outside).not.toContain('수저 게임');
  });

  it('onHome이 없으면 예전 그대로다: 버튼이 아니라 이름을 가진 그림이다 (모든 화면이 잇는다 — 엔딩은 확인 단계를 거쳐, SPEC-016 Q1)', () => {
    const plain = renderToStaticMarkup(<SiteHead name="엔딩" />);
    expect(plain).not.toContain('<button');
    expect(plain).not.toContain('logo-link');
    expect(plain).toContain('data-testid="header-logo"');
    expect(plain).not.toContain('aria-hidden="true" data-testid="header-logo"');
    expect(plain).toContain('role="img"');
    expect(plain).toContain('<span class="site-head__name">엔딩</span>');
  });

  it('화면 이름 자리는 그대로이고(로고 뒤), 버튼은 로고 하나뿐이다', () => {
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html.indexOf('logo-link')).toBeLessThan(html.indexOf('site-head__name'));
  });

  it('눌림 영역: .logo-link가 --hit(44px) 이상을 줘도 헤더 높이는 그대로다 (위아래 -2px)', async () => {
    const css = await readText('../src/styles/title.css');
    const doc = await readText('../src/styles/doc.css'); // `.logo-link` 규칙은 머리글(`.site-head`)이 있는 doc.css에 있다 — title.css의 강제 색상 계약(tests/barRelease.test.ts) 때문에 옮겼다
    const rule = /\.logo-link \{([^}]*)\}/.exec(doc);
    expect(rule, '.logo-link 규칙').not.toBeNull();
    expect(rule![1]).toMatch(/min-height: var\(--hit\)/);
    expect(rule![1]).toMatch(/min-width: var\(--hit\)/);
    expect(rule![1]).toMatch(/margin: -2px 0/);
    expect(await readText('../src/styles/tokens.css')).toMatch(/--hit: 44px/);
    expect(css, '로고 그림 높이 토큰은 그대로(40px)').toContain('.logo-wrap > svg { height: var(--logo-h, var(--logo-h-header));');
  });

  it('누르면(onClick) 호출하는 쪽이 준 onHome을 부른다 — HeaderLogo·SiteHead 모두', () => {
    let n = 0;
    const logo = HeaderLogo({ onHome: () => n++ }) as ReactElement<{ onClick: () => void }>;
    expect(logo.type).toBe('button');
    logo.props.onClick();
    logo.props.onClick();
    expect(n).toBe(2);
    // SiteHead의 첫 자식이 같은 로고다
    const head = SiteHead({ name: '출생 신고', onHome: () => n++ }) as ReactElement<{ children: ReactElement<{ onHome: () => void }>[] }>;
    head.props.children[0].props.onHome();
    expect(n).toBe(3);
  });

  it('첫 화면의 로고(가로 결합 로고, H2 안 B)는 컨트롤이 아니다: 장식(aria-hidden)이고 버튼·링크가 아니다 (Q4)', () => {
    const word = renderToStaticMarkup(<TitleWordmark />);
    expect(word).toContain('aria-hidden="true"');
    expect(word).not.toMatch(/<(button|a)[\s>]/);
    expect(word).toContain('data-testid="title-logo-word"');
    expect(word).toContain('logo--row'); // 가로 결합 로고(정식 심볼 + 워드마크)
    expect(word).toContain('viewBox="0 0 443.8 128"');
  });
});

describe('로고 → 첫 화면 → 이어서 살기: 기존 「나가기」와 같은 길 (완료 기준 2·3, Q3 표)', () => {
  it('룰렛 연출 중: 판(저장 글)은 바이트까지 그대로이고, 첫 화면에서 연출(spin)만 꺼진다 — 이어서 살기는 연출 없이 결과가 확정된 룰렛이다', () => {
    const s = inRoulette();
    expect(s.spin).toBe(false); // createSession은 연출 중이 아니다 — 아래는 「태어나기」 직후와 같은 세션을 만든다
    const rolling: Session = { ...s, spin: true };
    const opened = send(rolling, { type: 'openTitle' });
    expect(opened.showTitle).toBe(true);
    expect(opened.spin).toBe(false);
    expect(opened.tick).toBeNull();
    expect(opened.game).toBe(rolling.game); // 같은 객체
    expect(bytes(opened.game)).toBe(bytes(rolling.game));
    const back = send(opened, { type: 'resume' });
    expect(back.showTitle).toBe(false);
    expect(back.game.phase).toBe('roulette');
    expect(back.spin).toBe(false);
    expect(bytes(back.game)).toBe(bytes(rolling.game));
  });

  it('출생신고: 저장 글 불변, 이어서 살기는 같은 출생신고(birth 단계)다', () => {
    const s = inBirth();
    const opened = send(s, { type: 'openTitle' });
    expect(opened.showTitle).toBe(true);
    expect(opened.game).toBe(s.game);
    expect(bytes(opened.game)).toBe(bytes(s.game));
    const back = send(opened, { type: 'resume' });
    expect(back.game.phase).toBe('birth');
    expect(bytes(back.game)).toBe(bytes(s.game));
  });

  it('인생: 일시정지(paused) 한 필드만 켜진다 — 스탯·자산·rngState·연표·pending·버전은 그대로, 이어서 살기는 멈춘 채 같은 해다', () => {
    const s = send(inLife(), { type: 'advance', fromAge: 0 });
    const opened = send(s, { type: 'openTitle' });
    expect(opened.game.paused).toBe(true);
    expect(withoutPaused(opened.game)).toEqual(withoutPaused({ ...s.game, paused: false }));
    expect(JSON.parse(bytes(opened.game)).version).toBe(SCHEMA_VERSION);
    const back = send(opened, { type: 'resume' });
    expect(back.game.age).toBe(s.game.age);
    expect(back.game.paused).toBe(true);
    expect(bytes(back.game)).toBe(bytes(opened.game)); // 이어서 살기는 저장을 더 바꾸지 않는다
    // 저장을 다시 읽어도(새로고침) 같다
    expect(parseGame(bytes(opened.game))).toEqual(opened.game);
  });

  it('로고 경로 = 「나가기」 경로: 같은 액션(`openTitle`) 하나라 로고가 더하는 저장 변화는 0이다 (같은 입력에서 같은 저장 글)', () => {
    for (const make of [inRoulette, inBirth, inLife]) {
      const a = send(make(), { type: 'openTitle' });
      const b = send(make(), { type: 'openTitle' });
      expect(bytes(a.game)).toBe(bytes(b.game));
    }
  });

  it('엔딩은 `openTitle`이 아무 일도 안 한다(hasProgress 밖) — 그래서 엔딩 로고는 `openTitle`이 아니라 확인 단계 → 기존 `rebirth`로 간다(아래 「엔딩 로고」)', () => {
    const ending = createSession({ ...startLife(3, 'alpha'), phase: 'ending', death: { age: 70, cause: '노환' }, age: 70 }, SETTINGS);
    expect(send(ending, { type: 'openTitle' })).toBe(ending);
  });
});

describe('빠른 연속 클릭 (완료 기준 5): 첫 화면은 한 번 열리고 판은 하나뿐', () => {
  for (const [name, make] of [['룰렛', inRoulette], ['출생신고', inBirth], ['인생', inLife]] as const) {
    it(`${name}: 로고 20회 연타 → 첫 번째만 일하고 나머지는 같은 세션이다`, () => {
      const first = send(make(), { type: 'openTitle' });
      let s = first;
      for (let i = 0; i < 19; i++) s = send(s, { type: 'openTitle' });
      expect(s).toBe(first);
    });

    it(`${name}: 로고 후 「이어서 살기」 20회 연타 → 판은 하나, 첫 번째 resume만 일한다 / 그 직후 로고 20회 연타 → 다시 한 번만 열린다`, () => {
      const start = make();
      let s = send(send(start, { type: 'openTitle' }), { type: 'resume' });
      const resumed = s;
      for (let i = 0; i < 19; i++) s = send(s, { type: 'resume' });
      expect(s).toBe(resumed);
      expect(s.showTitle).toBe(false);
      const reopened = send(s, { type: 'openTitle' });
      expect(reopened.showTitle).toBe(true);
      for (let i = 0; i < 19; i++) expect(send(reopened, { type: 'openTitle' })).toBe(reopened);
      // 판은 내내 하나다(새 판이 시작되지 않았다)
      expect(reopened.game.seed).toBe(start.game.seed);
      expect(reopened.game.phase).toBe(start.game.phase);
    });
  }

  it('열려 있는 동안 늦게 온 진행 입력(룰렛 건너뛰기·살아가기·시계)은 판을 건드리지 않는다 — 로고 직후 눌린 버튼이 판을 두 번 진행하지 못한다', () => {
    const rolling: Session = { ...inRoulette(), spin: true };
    const r = send(rolling, { type: 'openTitle' });
    expect(send(r, { type: 'finishSpin' })).toBe(r);
    expect(send(r, { type: 'enterBirth' })).toBe(r);
    const b = send(inBirth(), { type: 'openTitle' });
    expect(send(b, { type: 'enterLife' })).toBe(b);
    const l = send(inLife(), { type: 'openTitle' });
    expect(send(l, { type: 'advance', fromAge: l.game.age })).toBe(l);
    expect(send(l, { type: 'skip' })).toBe(l);
  });
});

describe('상태별 눌림 (완료 기준 4): 결정 카드·자동 모드·한 해 도중', () => {
  /** 선택지가 떠 있는 인생 세션 */
  function pendingSession(autoMode: boolean): Session {
    for (let seed = 1000; seed < 1400; seed++) {
      const s = advanceUntilDecision(startLife(seed, 'alpha')).state;
      if (s.phase === 'life' && s.pending !== null && s.pending.choiceIds.length >= 2) return createSession(s, { speed: 1, autoMode });
    }
    throw new Error('선택지가 있는 시드를 찾지 못했다');
  }

  it('결정 카드가 열린 채 로고: 선택(pending)·기록(history)은 그대로 남고 이어서 살기 뒤에도 같은 카드다 — 기록 줄이 두 번 쌓이지 않는다', () => {
    const s = pendingSession(false);
    const opened = send(s, { type: 'openTitle' });
    expect(opened.game.pending).toEqual(s.game.pending);
    expect(opened.game.history).toBe(s.game.history);
    // 열려 있는 동안 고르기·자동 선택은 무시된다
    const key = s.game.pending!.key;
    expect(send(opened, { type: 'choose', key, choiceId: s.game.pending!.choiceIds[0] })).toBe(opened);
    expect(send(opened, { type: 'autoChoose', key })).toBe(opened);
    const back = send(opened, { type: 'resume' });
    expect(back.game.pending).toEqual(s.game.pending);
    expect(back.game.history.length).toBe(s.game.history.length);
  });

  it('자동 모드 켜짐 + 결정 카드: 첫 화면이 열린 동안 자동 선택이 돌지 않고(autoChooseArmed=false, reducer도 무시), 이어서 살기 뒤에도 「다시 진행」을 누를 때까지 멈춘다 — 누르면 이어진다', () => {
    const s = pendingSession(true);
    const armedOf = (x: Session, showTitle: boolean): boolean =>
      autoChooseArmed({ autoMode: x.settings.autoMode, hasPending: x.game.pending !== null, superseded: false, visible: true, showTitle, paused: x.game.paused, exitAsk: false, folded: false });
    expect(armedOf(s, false), '대조: 로고를 누르기 전에는 자동 선택이 돈다').toBe(true);
    const opened = send(s, { type: 'openTitle' });
    expect(armedOf(opened, opened.showTitle), '첫 화면이 열린 동안').toBe(false);
    expect(send(opened, { type: 'autoChoose', key: s.game.pending!.key })).toBe(opened);
    const back = send(opened, { type: 'resume' });
    expect(back.game.paused, '기존 나가기와 같다 — 멈춘 채 돌아온다').toBe(true);
    expect(armedOf(back, back.showTitle)).toBe(false);
    const go = send(back, { type: 'setPaused', paused: false });
    expect(go.game.paused).toBe(false);
    expect(armedOf(go, go.showTitle), '「다시 진행」 뒤에는 자동 선택이 이어진다').toBe(true);
    expect(go.game.pending).toEqual(s.game.pending);
  });

  it('한 해가 흐르는 도중(시계가 막 돌던 때)·배속 변경 직후: 로고를 누르면 해가 멈춘 채 저장되고 같은 나이로 돌아온다 — 늦게 울린 시계(advance)는 무시', () => {
    const s = send(inLife(), { type: 'setSpeed', speed: 4 });
    const age = s.game.age;
    const opened = send(s, { type: 'openTitle' });
    expect(opened.tick).toBeNull();
    expect(send(opened, { type: 'advance', fromAge: age })).toBe(opened);
    const back = send(opened, { type: 'resume' });
    expect(back.game.age).toBe(age);
    expect(back.settings.speed).toBe(4); // 배속(설정)은 그대로
  });
});

describe('App 연결 (소스 글): 어느 화면의 로고가 첫 화면으로 가는가', () => {
  it('룰렛·출생신고·인생은 onHome을 받고(openTitle), 엔딩은 받지 않는다(엔딩 화면이 확인 단계를 가진다) — 새 액션·reducer 변경 없음', async () => {
    const app = await readText('../src/App.tsx');
    expect(app).toMatch(/const goHome = useCallback\(\(\) => dispatch\(\{ type: 'openTitle' \}\), \[dispatch\]\);/);
    expect(app).toMatch(/<RouletteScreen[^]*?onHome=\{goHome\}[^]*?\/>/);
    expect(app).toMatch(/<BirthScreen[^\n]*onHome=\{goHome\}/);
    expect(app).toMatch(/<LifeScreen[^]*?onHome=\{\(\) => \{[^]*?goHome\(\);/);
    expect(/<EndingScreen[^]*?\/>/.exec(app)![0]).not.toContain('onHome');
    expect(app.match(/type: 'openTitle'/g)).toHaveLength(2); // 나가기 + goHome — 새 액션 이름이 없다
    expect(app).toMatch(/<EndingScreen[^]*?onRebirth=\{\(\) => dispatch\(\{ type: 'rebirth', seed: newSeed\(\) \}\)\}/); // 확정은 「다시 태어나기」와 같은 한 콜백
    expect(app.match(/type: 'rebirth'/g)).toHaveLength(1); // 새 길을 만들지 않았다
  });

  it('오류 화면은 세션 바깥이라 페이지를 다시 연다(저장은 지우지 않는다): onHome이 있고 clearGame을 부르지 않는 길이다', async () => {
    const src = await readText('../src/screens/ErrorBoundary.tsx');
    expect(ERROR_HEAD_NAME).toBe('오류');
    expect(src).toMatch(/<SiteHead name=\{ERROR_HEAD_NAME\} onHome=\{this\.home\} \/>/);
    const home = /private home = \(\) => \{([^}]*)\}/.exec(src);
    expect(home, 'home 핸들러').not.toBeNull();
    expect(home![1]).toContain('window.location.assign(window.location.pathname)');
    expect(home![1]).not.toContain('clearGame');
  });
});

describe('엔딩 로고: 한 번 묻고 첫 화면 (SPEC-016 Q1 — 형진 님 2026-11-10)', () => {
  const ending = { ...startLife(3, 'alpha'), phase: 'ending' as const, death: { age: 70, cause: '노환' }, age: 70 };

  it('엔딩 머리 로고는 「수저 게임, 첫 화면으로」 버튼이고, 확인 단계는 처음에는 닫혀 있다 (열린 모습은 e2e)', async () => {
    const { EndingScreen } = await import('../src/screens/EndingScreen');
    const html = renderToStaticMarkup(<EndingScreen game={ending as never} onRebirth={() => undefined} />);
    expect(html).toContain(`aria-label="${LOGO_HOME_LABEL}"`);
    expect(html).toContain('data-testid="logo-home"');
    expect(html).not.toContain('data-testid="ending-home-ask"');
    expect(html).toContain('data-testid="rebirth"'); // 「다시 태어나기」는 그대로
  });

  it('확인 단계 문구는 상수 한 곳(ENDING_HOME_ASK)이고, 확정은 「다시 태어나기」와 같은 onRebirth·취소는 닫기 — 소스 글', async () => {
    const { ENDING_HOME_ASK } = await import('../src/data/endingText');
    expect(ENDING_HOME_ASK).toEqual({
      title: '엔딩을 닫고 첫 화면으로 나갈까요?',
      sub: '첫 화면의 세대 선택으로 돌아갑니다. 이 인생의 기록은 다시 볼 수 없습니다.',
      yes: '첫 화면으로 나가기',
      no: '계속 보기',
    }); // designer 확정 문구(title-ci.md 3-6 · copy.md 2절) — rebirth의 결과를 숨기지 않는다
    const src = await readText('../src/screens/EndingScreen.tsx');
    expect(src).toMatch(/data-testid="ending-home-yes" onClick=\{onRebirth\}/);
    expect(src).toMatch(/data-testid="ending-home-no" onClick=\{closeHomeAsk\}/);
    expect(src).not.toMatch(/ENDING_HOME_ASK\.(title|sub|yes|no)\s*=/);
    expect(src).not.toContain('나갈까요'); // 문구가 화면 파일에 흩어지지 않았다
  });

  it('reducer: 확정(rebirth)은 ending에서만 새 판을 만들고 연타해도 판은 하나다', () => {
    const s = createSession(ending as never, SETTINGS);
    const first = send(s, { type: 'rebirth', seed: 11 });
    expect(first.game.phase).not.toBe('ending');
    let t = first;
    for (let i = 0; i < 10; i++) t = send(t, { type: 'rebirth', seed: 100 + i });
    expect(t).toBe(first); // 늦은 입력은 같은 세션
  });
});
