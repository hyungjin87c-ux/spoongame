import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { startLife } from '../scripts/simulateLib';
import { DEFAULT_SETTINGS, IMPACT_KEYS, SPEEDS, advanceUntilDecision, calendarYear, educationLabel, familyOf, peersOf, previewPending, resolveChoice, stepYear, type GameState, type Settings } from '../src/core';
import { looksStanding } from '../src/core/birth';
import { reportPlaceLabel } from '../src/core/birthReport';
import { startBandOf } from '../src/core/ending';
import { formatCount, formatMan } from '../src/core/format';
import { tryVirtualPopulation } from '../src/core/population';
import { PEER_STATUS_LABEL, peersNow } from '../src/core/peerNow';
import { DASHBOARD_PEERS_SHIPPED, BIRTH_TEXT, GRADE_NAME, genderLabel, peersNoteText, yearMonthText } from '../src/data/birthReportText';
import { standingLabel } from '../src/data/birthText';
import { ASSETS_AMOUNTS_SHIPPED, DASH_TEXT, STATUS_LABEL, STATUS_ORDER, statusHelpText } from '../src/data/dashText';
import { EVENT_POOL } from '../src/data/events';
import { choiceAccessibleName } from '../src/data/impactText';
import { bandLabel } from '../src/data/endingText';
import { placeLabel } from '../src/data/regionNames';
import { LifeScreen } from '../src/screens/LifeScreen';
import { GradeLine } from '../src/ui/Grade';
import type { LifeGame } from '../src/ui/dash/Cards';
import type { YearClock } from '../src/ui/useYearClock';

/**
 * 대시보드(인생 화면) 서버 렌더 시험 (SPEC-003 DB1~DB14, VP4): 구조·순서·문구·값·접근성 속성을 본다.
 * 시간이 흐르는 동작(진행률 바, 일시정지, 로그 스크롤, 볼륨 저장, 테마 적용)은 DOM이 필요해 e2e/m4-dashboard.spec.ts(+ 색은 e2e/m4-colors.spec.ts)가 보고, 일시정지·BGM·테마의 세션 규칙은 tests/dashSession.test.ts가 본다.
 */

const CLOCK: YearClock = { get: () => 0, subscribe: () => () => undefined };
const noop = () => undefined;
const REPO = 'https://github.com/hyungjin87c-ux/spoongame';
const BUILD = 'v0.1.0 (abc1234)';
const MINUTE = 29_846_880;

const asLife = (g: GameState): LifeGame => ({ ...g, character: g.character!, era: g.era!, birthReport: g.birthReport!, peerSeed: g.peerSeed! });
const settingsOf = (o: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, speed: 1, autoMode: false, ...o });

interface Opts {
  settings?: Partial<Settings>;
  exitOpen?: boolean;
  repoUrl?: string;
}
function render(game: GameState, o: Opts = {}): string {
  return renderToStaticMarkup(
    <LifeScreen
      game={asLife(game)}
      settings={settingsOf(o.settings)}
      clock={CLOCK}
      exitOpen={o.exitOpen ?? false}
      onExitOpen={noop}
      onChoose={noop}
      onSkip={noop}
      onSpeed={noop}
      onAuto={noop}
      onPause={noop}
      onBgm={noop}
      onTheme={noop}
      onExit={noop}
      minute={MINUTE}
      repoUrl={o.repoUrl ?? REPO}
      buildLabel={BUILD}
    />,
  );
}

/** 선택지 없이 나이만 올린다(화면 시험용 — 효과는 건너뛴다) */
function ageTo(g: GameState, age: number): GameState {
  let s = g;
  for (let i = 0; i < 300 && s.phase === 'life' && s.age < age; i++) s = s.pending ? { ...s, pending: null } : stepYear(s).state;
  return s;
}
/** 선택지가 떠 있는 상태를 찾는다 */
function decisionState(): GameState {
  for (let seed = 1; seed <= 60; seed++) {
    const s = advanceUntilDecision(startLife(seed, 'present')).state;
    if (s.phase === 'life' && s.pending !== null && s.age >= 3) return s;
  }
  throw new Error('선택지 상태를 찾지 못했다');
}

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
/** 공백을 모두 없앤 글자: 줄바꿈 묶음(Glue)·쌍(FitPair)이 낱말 사이에 요소를 끼워도 글자가 같은지 본다 */
const flat = (html: string) => text(html).replace(/\s/g, '');
const nospace = (s: string) => s.replace(/\s/g, '');
/** 수저 이름. 5단계는 「다이아몬드<wbr>수저」로 갈라 그리므로 앞부분만 본다 */
const gradeStem = (w: 1 | 2 | 3 | 4 | 5) => (w === 5 ? '다이아몬드' : GRADE_NAME[w]);
const posOf = (html: string, needle: string) => {
  const i = html.indexOf(needle);
  expect(i, needle).toBeGreaterThan(-1);
  return i;
};
/** `data-testid`가 id인 요소를 담은 <section> 전체 */
function sectionOf(html: string, id: string): string {
  const at = posOf(html, `data-testid="${id}"`);
  const start = html.lastIndexOf('<section', at);
  const end = html.indexOf('</section>', at);
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, end + '</section>'.length);
}
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
const openTag = (html: string, testid: string) => {
  const at = posOf(html, `data-testid="${testid}"`);
  return html.slice(html.lastIndexOf('<', at), html.indexOf('>', at) + 1);
};
function buttonsIn(html: string): Array<{ tag: string; label: string }> {
  return [...html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)].map((m) => ({ tag: `<${m[1]}${m[2]}>`, label: text(m[3]) }));
}

const infant = startLife(11, 'present', { looks: 97 });
const adult = ageTo(startLife(11, 'present', { looks: 97 }), 31);
const decision = decisionState();
const character = infant.character!;

describe('구조와 순서 (DB1)', () => {
  const html = render(decision);

  it('DOM 순서: 헤더 → 진행·도구 줄 → 알림 영역 → 왼쪽(프로필·상태·자산) → 가운데(중대 결정·인생 기록) → 오른쪽(식구·또래)', () => {
    const order = ['dash-head', 'controls', 'tools', 'choice-announce', 'profile-card', 'stats', 'assets-card', 'choice-panel', 'log', 'family-card', 'peers-now-card'].map((id) => posOf(html, `data-testid="${id}"`));
    for (let i = 1; i < order.length; i++) expect(order[i], `${i}번째`).toBeGreaterThan(order[i - 1]);
  });

  it('제목 단계: h1은 하나(이름)이고 옛 화면의 「수저 게임」 h1·옛 클래스가 없다', () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(text(sectionOfHead(html))).toContain(decision.character!.name);
    expect(html).not.toContain('<h1>수저 게임</h1>');
    for (const old of ['class="life"', 'class="stats"', 'class="ending"', 'class="screen"', 'class="controls"', 'class="bar"']) expect(html, old).not.toContain(old);
  });

  it('선택지가 없으면 중대 결정 카드가 없고, 기록이 가운데 영역의 처음이다', () => {
    const quiet = render(infant);
    expect(quiet).not.toContain('data-testid="choice-panel"');
    expect(quiet).toContain('data-testid="log"');
  });

  it('중대 결정 카드: 기존 동작(제목·본문·선택지 개수·접근 가능한 이름)을 새 틀에 담았고 기록보다 앞이다', () => {
    const panel = sectionOf(html, 'choice-panel');
    expect(panel).toContain(DASH_TEXT.choiceKind);
    expect(panel).toContain('aria-labelledby="choice-title"');
    expect(buttonsIn(panel), '선택지 버튼 수').toHaveLength(decision.pending!.choiceIds.length);
    expect(posOf(html, 'data-testid="choice-panel"')).toBeLessThan(posOf(html, 'data-testid="log"'));
    expect(panel).not.toContain('data-testid="auto-note"');
    expect(render(decision, { settings: { autoMode: true } })).toContain(DASH_TEXT.autoNote);
  });

  it('금지 낱말: 「접속자」·느낌표·이모지가 화면 문구에 없다', () => {
    const t = text(render(adult));
    expect(t).not.toContain('접속자');
    expect(t).not.toMatch(/[!！]|\p{Extended_Pictographic}/u);
  });
});

/** 헤더 부분만 */
function sectionOfHead(html: string): string {
  const at = posOf(html, 'data-testid="dash-head"');
  return html.slice(html.lastIndexOf('<header', at), html.indexOf('</header>', at) + '</header>'.length);
}

describe('헤더: 로고 · 이름 · 나이 · 올해 진행률 (DB2)', () => {
  it('같은 로고(심볼+워드마크, 이름 있는 이미지), 이름, 「N세」, 「{연도}년」', () => {
    const head = sectionOfHead(render(adult));
    expect(head).toContain('data-testid="header-logo"');
    expect(head).toMatch(/role="img" aria-label="수저 게임 로고/);
    expect(text(head)).toContain(adult.character!.name);
    expect(flat(openTagBlock(head, 'life-age'))).toBe(`${adult.age}${DASH_TEXT.ageSuffix}`);
    expect(flat(openTagBlock(head, 'life-year'))).toBe(`${calendarYear(adult.character!.birthYear, adult.age)}${DASH_TEXT.yearSuffix}`);
  });

  it('올해 진행률 바: progressbar, 이름, 0~100 범위, 값은 시계에서 (정수 %)', () => {
    const head = sectionOfHead(render(infant));
    const bar = openTag(head, 'year-progress');
    expect(attr(bar, 'role')).toBe('progressbar');
    expect(attr(bar, 'aria-label')).toBe(DASH_TEXT.yearProgressLabel);
    expect(attr(bar, 'aria-valuemin')).toBe('0');
    expect(attr(bar, 'aria-valuemax')).toBe('100');
    expect(attr(bar, 'aria-valuenow')).toBe('0');
    expect(text(openTagBlock(head, 'year-pct'))).toBe('0%');
  });

  it('일시정지 상태가 바와 버튼에 함께 드러난다', () => {
    const paused = render({ ...infant, paused: true });
    expect(attr(openTag(paused, 'year-progress'), 'data-paused')).toBe('true');
    expect(attr(openTag(paused, 'pause'), 'data-paused')).toBe('true');
    expect(text(openTagBlock(paused, 'pause'))).toBe(DASH_TEXT.play);
    const running = render(infant);
    expect(attr(openTag(running, 'year-progress'), 'data-paused')).toBe('false');
    expect(text(openTagBlock(running, 'pause'))).toBe(DASH_TEXT.pause);
  });
});

/** `data-testid`로 찾은 요소의 안쪽까지(같은 이름의 닫는 태그까지) */
function openTagBlock(html: string, testid: string): string {
  const at = posOf(html, `data-testid="${testid}"`);
  const start = html.lastIndexOf('<', at);
  const name = /^<([a-z0-9]+)/.exec(html.slice(start))![1];
  let depth = 0;
  const re = new RegExp(`<(/?)${name}\\b[^>]*>`, 'g');
  re.lastIndex = start;
  for (let m = re.exec(html); m !== null; m = re.exec(html)) {
    depth += m[1] === '/' ? -1 : 1;
    if (depth === 0) return html.slice(start, re.lastIndex);
  }
  return html.slice(start);
}

describe('진행 줄 (DB3)', () => {
  const html = render(infant);
  const controls = html.slice(posOf(html, 'data-testid="controls"'), posOf(html, 'data-testid="tools"'));

  it('7개: 일시정지 · 1 · 2 · 4 · 8배 · 다음 결정으로 · 자동 모드, 이 순서', () => {
    const labels = buttonsIn(controls).map((b) => b.label);
    expect(labels).toEqual([DASH_TEXT.pause, ...SPEEDS.map((s) => `${s}${DASH_TEXT.speedUnit}`), DASH_TEXT.skip, DASH_TEXT.autoOff]);
    expect(SPEEDS).toEqual([1, 2, 4, 8]);
  });

  it('설정의 배속만 눌림(aria-pressed=true)으로 보인다', () => {
    for (const speed of SPEEDS) {
      const h = render(infant, { settings: { speed } });
      const pressed = [...h.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]).filter((t) => attr(t, 'data-speed') !== null && attr(t, 'aria-pressed') === 'true');
      expect(pressed.map((t) => Number(attr(t, 'data-speed'))), `${speed}배`).toEqual([speed]);
    }
  });

  it('자동 모드: 이름이 「켜짐」으로 바뀌고 눌림이 보이며 「다음 결정으로」는 막힌다', () => {
    const h = render(infant, { settings: { autoMode: true } });
    const auto = openTag(h, 'auto');
    expect(attr(auto, 'aria-pressed')).toBe('true');
    expect(text(openTagBlock(h, 'auto'))).toBe(DASH_TEXT.autoOn);
    expect(attr(openTag(h, 'skip'), 'aria-disabled')).toBe('true');
  });
});

describe('도구 줄 (DB3·DB4·DB6·DB7·DB8)', () => {
  const html = render(infant);
  const tools = openTagBlock(html, 'tools');

  it('5개: BGM · 생각 남기기 · 다크 모드 · 의견 보내기 · 나가기, 이 순서', () => {
    const labels = buttonsIn(tools).map((b) => b.label.replace(DASH_TEXT.feedbackNewTab, '').replace(/\s+/g, ' ').trim());
    // 생각 남기기의 접근 가능한 이름에는 눈에 보이는 「준비 중」이 든다 (R-326)
    expect(labels).toEqual([DASH_TEXT.toolBgm, `${DASH_TEXT.toolNote} ${DASH_TEXT.toolSoon}`, DASH_TEXT.toolDark, DASH_TEXT.toolFeedback, DASH_TEXT.toolExit]);
  });

  it('BGM: 처음엔 꺼짐(눌림 아님, 볼륨 조절 없음). 켜면 눌림 + 읽기 전용 「켜짐」 + 볼륨 조절이 나타난다', () => {
    expect(DEFAULT_SETTINGS.bgm.on).toBe(false);
    expect(attr(openTag(html, 'tool-bgm'), 'aria-pressed')).toBe('false');
    expect(html).not.toContain('data-testid="bgm-volume"');
    const on = render(infant, { settings: { bgm: { on: true, volume: 45 } } });
    expect(attr(openTag(on, 'tool-bgm'), 'aria-pressed')).toBe('true');
    expect(text(openTagBlock(on, 'tool-bgm'))).toContain(DASH_TEXT.toolOn);
    const slider = openTag(on, 'bgm-volume-input');
    expect(attr(slider, 'type')).toBe('range');
    expect(attr(slider, 'min')).toBe('0');
    expect(attr(slider, 'max')).toBe('100');
    expect(attr(slider, 'value')).toBe('45');
    expect(attr(slider, 'aria-valuetext')).toBe('45%');
    expect(text(openTagBlock(on, 'bgm-volume'))).toContain(DASH_TEXT.bgmVolume);
  });

  it('다크 모드: 켜짐은 「지금 다크가 적용돼 있나」다 — 수동 다크는 켜짐, 수동 라이트는 꺼짐 (켜짐은 눌림 + 읽기 전용 글자)', () => {
    const dark = render(infant, { settings: { theme: 'dark' } });
    expect(attr(openTag(dark, 'tool-dark'), 'aria-pressed')).toBe('true');
    expect(text(openTagBlock(dark, 'tool-dark'))).toContain(DASH_TEXT.toolOn);
    const light = render(infant, { settings: { theme: 'light' } });
    expect(attr(openTag(light, 'tool-dark'), 'aria-pressed')).toBe('false');
    expect(text(openTagBlock(light, 'tool-dark'))).not.toContain(DASH_TEXT.toolOn);
  });

  it('생각 남기기 (R-326): M7c까지 버튼 자리만 — 선택할 수 없고(aria-disabled) 지속 비활성 모양(data-unavailable)이며, 눈에 보이는 「준비 중」이 접근 가능한 이름에 든다. 누르면 나오던 안내는 없다', () => {
    const tag = openTag(html, 'tool-note');
    expect(attr(tag, 'aria-disabled')).toBe('true');
    // 입력 가드(첫 렌더는 모든 도구가 닫힌다)가 아니라 호출자의 지속 비활성이다 — 가드만 닫힌 다른 도구에는 이 표식이 없다 (R-337)
    expect(attr(tag, 'data-unavailable')).toBe('true');
    expect(attr(openTag(html, 'tool-bgm'), 'aria-disabled')).toBe('true');
    expect(attr(openTag(html, 'tool-bgm'), 'data-unavailable')).toBeNull();
    // 이유(준비 중)는 눈에 보이는 글자이고 버튼 이름 안에 있다 — 라디오 카드 「약 1시간」의 「준비 중」과 같은 방식
    const block = openTagBlock(html, 'tool-note');
    expect(block).toContain('class="tool-soon"');
    expect(text(block)).toBe(`${DASH_TEXT.toolNote} ${DASH_TEXT.toolSoon}`);
    expect(DASH_TEXT.toolSoon).toBe('준비 중');
    // 눌러서 안내를 띄우던 예전 방식은 없다: 안내 요소·describedby가 없고 안내 문구 상수도 없다
    expect(html).not.toContain('note-soon');
    expect(attr(tag, 'aria-describedby')).toBeNull();
    expect(Object.keys(DASH_TEXT)).not.toContain('noteSoon');
  });

  it('의견 보내기: 새 탭 링크, 이슈 양식 주소, 허용 목록 값만 (이름·나이·기록 없음)', () => {
    const a = openTag(html, 'tool-feedback');
    expect(a.startsWith('<a ')).toBe(true);
    expect(attr(a, 'target')).toBe('_blank');
    expect(attr(a, 'rel')).toBe('noopener noreferrer');
    const href = attr(a, 'href')!.replace(/&amp;/g, '&');
    expect(href.startsWith(`${REPO}/issues/new?template=feedback.yml&screen=`)).toBe(true);
    const screen = decodeURIComponent(href.split('&screen=')[1]);
    expect(screen).toContain('인생 진행 중');
    expect(screen).toContain(BUILD);
    expect(screen).not.toContain(character.name);
    expect(screen).not.toMatch(/\d+세/);
    expect(text(openTagBlock(html, 'tool-feedback'))).toContain(DASH_TEXT.feedbackNewTab);
  });

  it('저장소 주소가 없으면 의견 보내기 링크를 그리지 않는다 (엉뚱한 곳으로 보내지 않는다)', () => {
    expect(render(infant, { repoUrl: '' })).not.toContain('data-testid="tool-feedback"');
  });

  it('외부로 나가는 것은 의견 보내기 링크 하나뿐이다: 다른 링크·외부 주소의 src·href가 없다', () => {
    const h = render(adult);
    const hrefs = [...h.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((m) => m[1]).filter((v) => /^(?:https?:)?\/\//.test(v));
    expect(hrefs).toHaveLength(1);
    expect(hrefs[0].startsWith(REPO)).toBe(true);
    expect([...h.matchAll(/<a\b/g)]).toHaveLength(1);
  });

  it('나가기 확인 단계는 열렸을 때만 나오고, 확정 버튼 이름은 방금 누른 도구 이름과 다르다 (QM2-6)', () => {
    expect(html).not.toContain('data-testid="exit-ask"');
    const open = render(infant, { exitOpen: true });
    const ask = openTagBlock(open, 'exit-ask');
    expect(ask).toContain('role="alert"');
    expect(text(ask)).toContain(DASH_TEXT.exitAsk);
    expect(text(openTagBlock(open, 'exit-yes'))).toBe(DASH_TEXT.exitYes);
    expect(text(openTagBlock(open, 'exit-no'))).toBe(DASH_TEXT.exitNo);
    expect(DASH_TEXT.exitYes).not.toBe(DASH_TEXT.toolExit);
  });
});

describe('프로필 카드 (DB9)', () => {
  it('얼굴 + 이름 + 성별 + 출생 + 거주 + 출신 가정(수저 칩과 구간) + 학력 + 외모(순위)', () => {
    const c = infant.character!;
    const card = sectionOf(render(infant), 'profile-card');
    expect(card).toContain('data-testid="face"');
    expect(card).toContain('data-age-group="infant"');
    // 시안 `face--lg`(96px): 72px에서는 50세 중년이 청년과 거의 구별되지 않았다 (R-329 — 실제 크기는 e2e/m4-faces.spec.ts)
    expect(card).toMatch(/<div class="face face--lg" data-testid="face"/);
    expect(flat(openTagBlock(card, 'profile-name'))).toBe(nospace(c.name));
    expect(flat(openTagBlock(card, 'profile-gender'))).toBe(nospace(genderLabel(c.gender)));
    expect(flat(openTagBlock(card, 'profile-born'))).toBe(nospace(yearMonthText(c.birthYear, infant.birthReport!.month)));
    expect(flat(openTagBlock(card, 'profile-place'))).toBe(nospace(reportPlaceLabel(infant.birthReport!, infant.era!)));
    const home = openTagBlock(card, 'profile-home');
    expect(home).toContain(`data-grade="${c.parentWealth}"`);
    expect(home).toContain(gradeStem(c.parentWealth));
    expect(flat(openTagBlock(home, 'grade-range'))).toBe(nospace(`(${bandLabel(startBandOf(infant.era!, c.parentWealth))})`));
    expect(flat(openTagBlock(card, 'profile-edu'))).toBe(nospace(educationLabel(infant.age, infant.flags)));
    expect(flat(openTagBlock(card, 'profile-looks'))).toBe(nospace(`${standingLabel(looksStanding(c.looks))} ${BIRTH_TEXT.looksSub}`));
  });

  it('얼굴은 나이에 맞는 연령대로 바뀐다 (0세 영아 → 31세 청년)', () => {
    expect(sectionOf(render(infant), 'profile-card')).toContain('data-age-group="infant"');
    expect(sectionOf(render(adult), 'profile-card')).toContain('data-age-group="young"');
    expect(flat(openTagBlock(sectionOf(render(adult), 'profile-card'), 'profile-edu'))).toBe(nospace(educationLabel(adult.age, adult.flags)));
  });

  it('외모는 점수가 아니라 「상위/하위 약 N%」 한 가지뿐이다: 원점수(97)·「점」이 어느 화면 글자에도 없다 (R-135)', () => {
    for (const g of [infant, adult, decision]) {
      const t = text(render(g.character!.looks === 97 ? g : { ...g, character: { ...g.character!, looks: 97 } }));
      expect(t).not.toMatch(/(?<!\d)97(?!\d)/);
      expect(t).not.toMatch(/외모\s*\d/);
    }
    expect(text(openTagBlock(sectionOf(render(infant), 'profile-card'), 'profile-looks'))).toMatch(/^(상위|하위)/);
  });
});

describe('상태 카드 (DB10)', () => {
  it('네 가지(건강·행복·지식·관계)가 이 순서로, 값은 게임 상태 그대로이고 meter 역할·이름·범위를 갖는다. 재산은 없다', () => {
    const card = sectionOf(render(adult), 'stats');
    expect(STATUS_ORDER.map((s) => s.key)).toEqual(['health', 'happiness', 'education', 'relationships']);
    const keys = [...card.matchAll(/data-stat="([a-z]+)"/g)].map((m) => m[1]);
    expect(keys).toEqual(['health', 'happiness', 'education', 'relationships']);
    for (const { key } of STATUS_ORDER) {
      expect(text(openTagBlock(card, `stat-${key}`))).toBe(String(adult.stats[key]));
      expect(card).toContain(STATUS_LABEL[key]);
    }
    const meters = [...card.matchAll(/role="meter"[^>]*>/g)].map((m) => m[0]);
    expect(meters).toHaveLength(4);
    meters.forEach((m, i) => {
      expect(attr(m, 'aria-valuemin')).toBe('0');
      expect(attr(m, 'aria-valuemax')).toBe('100');
      expect(attr(m, 'aria-valuenow')).toBe(String(adult.stats[STATUS_ORDER[i].key]));
      expect(attr(m, 'aria-label')).toBe(STATUS_LABEL[STATUS_ORDER[i].key]);
    });
    expect(text(card)).not.toContain('재산');
    expect(card).toContain(DASH_TEXT.statusHelpSummary);
  });

  it('상태 도움말: 자산 금액이 화면에 있으므로 시대별 단위 문장과 가구 기준 한 문장이 있다 — 지금 세상은 「올해 가치 기준」, 지난·다가올 세상은 「지금 가치로 환산」 (M5 2b, copy.md 4-5절)', () => {
    const present = text(sectionOf(render(adult), 'stats'));
    expect(present).toContain('0에서 100 사이의 값입니다.');
    expect(present).toContain('관계는 가족·친구와의 유대입니다.');
    expect(present).toContain(DASH_TEXT.statusHelpSummary);
    expect(present).toContain(statusHelpText(ASSETS_AMOUNTS_SHIPPED, 'present'));
    expect(present).toContain('자산은 올해 가치 기준의 원 단위입니다.');
    expect(present).toContain('순자산, 연 소득, 부채는 내 가구 기준이며 결혼한 뒤에는 배우자와 자녀의 몫까지 합한 값입니다.');
    for (const era of ['past', 'future'] as const) {
      const other = text(sectionOf(render(ageTo(startLife(11, era), 31)), 'stats'));
      expect(other, era).toContain('자산은 지금 가치로 환산한 원 단위입니다.');
      expect(other, era).not.toContain('올해 가치 기준');
    }
  });
});

describe('자산 현황 (DB11, M5 2b)', () => {
  const amounts = (html: string) => ['assets-net', 'assets-income', 'assets-debt'].map((id) => new RegExp(`data-testid="${id}">([^<]*)<`).exec(html)![1]);

  it('스무 살 전: 안내만 (수저 칩 없음, 금액 없음)', () => {
    const young = sectionOf(render(infant), 'assets-card');
    expect(text(openTagBlock(young, 'assets-note'))).toBe(DASH_TEXT.assetsYoung);
    expect(young).not.toContain('class="grade');
    expect(young).not.toContain('data-testid="assets-net"');
    expect(young).not.toContain('class="tag"');
  });

  it('스무 살부터 지금 세상: 순자산·연 소득·부채가 formatWon 그대로(「약」 없음)이고 태그가 없다 — dl은 aria-describedby가 없다. 이름에 「(가구)」가 없다', () => {
    const asset = adult.assets!;
    const html = sectionOf(render(adult), 'assets-card');
    expect(html).toContain('class="card card--assets"');
    expect(html).toContain('aria-labelledby="assets-title"');
    expect(html).toContain(`>${DASH_TEXT.assetsTitle}</h2>`);
    expect(html).not.toContain('class="tag"');
    expect(html).not.toContain('aria-describedby');
    expect(html).not.toContain('class="neg"');
    expect(html).not.toMatch(/dd class="[^"]*neg/);
    const t = text(html);
    expect(t).toContain(`${DASH_TEXT.assetsNet} ${formatMan(asset.net)}`);
    expect(t).toContain(`${DASH_TEXT.assetsIncome} ${formatMan(asset.income)}`);
    expect(t).toContain(`${DASH_TEXT.assetsDebt} ${formatMan(asset.debt)}`);
    expect(t).toContain(DASH_TEXT.assetsNote);
    expect(t).not.toContain('(가구)');
    expect(t).not.toContain('약 ');
    expect(t).not.toContain('빚');
    expect(t).not.toContain('아직 준비 중');
    // 금액은 줄바꿈 없는 한 덩어리(.nowrap)다
    for (const id of ['assets-net', 'assets-income', 'assets-debt']) expect(openTag(html, id)).toContain('class="nowrap"');
    expect(amounts(html)).toEqual([formatMan(asset.net), formatMan(asset.income), formatMan(asset.debt)]);
  });

  it('지난·다가올 세상: 카드 머리에 「지금 가치로 환산」 태그가 항상 있고 금액 묶음(dl)이 aria-describedby로 그 태그를 가리킨다', () => {
    for (const era of ['past', 'future'] as const) {
      const g = ageTo(startLife(11, era), 31);
      const html = sectionOf(render(g), 'assets-card');
      const tag = openTag(html, 'assets-basis');
      expect(tag, era).toContain('class="tag"');
      const id = attr(tag, 'id');
      expect(id, era).toBe('assets-basis');
      expect(attr(openTag(html, 'assets'), 'aria-describedby'), era).toBe(id);
      expect(text(html), era).toContain(DASH_TEXT.assetsBasis);
      expect((html.match(/지금 가치로 환산/g) ?? []).length, `${era}: 금액마다 되풀이하지 않는다`).toBe(1);
    }
  });

  it('경계: 0은 「0원」, 음수는 U+2212 「−」로 시작하고 「빚」·「▼」로 바꿔 쓰지 않는다 (순자산 −1,200만 원 · 부채 4,800만 원 · 0)', () => {
    const base = adult;
    const g: GameState = { ...base, assets: { ...base.assets!, net: -1200, income: 0, debt: 4800 } };
    const html = sectionOf(render(g), 'assets-card');
    expect(amounts(html)).toEqual(['−1,200만 원', '0원', '4,800만 원']);
    expect(amounts(html)[0].startsWith('\u2212')).toBe(true);
    expect(text(html)).not.toContain('▼');
    expect(text(html)).not.toContain('빚');
    // 아주 큰 수도 단위가 이어진다 (가장 긴 값 −19억 9,999만 원)
    const big: GameState = { ...base, assets: { ...base.assets!, net: -199_999, debt: 199_999 } };
    expect(amounts(sectionOf(render(big), 'assets-card'))[0]).toBe('−19억 9,999만 원');
  });
});

describe('선택지 영향 줄 (M5 2b, copy.md 4-3·4-4)', () => {
  /** aria-hidden 요소를 빼고 남은 글자 = 접근 가능한 이름(정적 마크업 근사). 블록 경계는 공백으로 센다 */
  function accessibleText(html: string): string {
    let out = '';
    let hiddenDepth = 0;
    for (const m of html.matchAll(/<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/g)) {
      if (m[4] !== undefined) {
        if (hiddenDepth === 0) out += m[4];
        continue;
      }
      const closing = m[1] === '/';
      const attrs = m[3] ?? '';
      if (hiddenDepth > 0) {
        hiddenDepth += closing ? -1 : attrs.endsWith('/') ? 0 : 1;
        continue;
      }
      if (!closing && /aria-hidden="true"/.test(attrs)) hiddenDepth = 1;
      else out += ' ';
    }
    return out.replace(/\s+/g, ' ').trim();
  }
  const impactItemsOf = (html: string) => [...html.matchAll(/data-key="([a-z]+)" data-direction="(up|down)" data-steps="([123])"/g)].map((m) => ({ key: m[1], direction: m[2], steps: Number(m[3]) }));
  /** 선택지가 뜬 상태 하나(minAge 이상) */
  function decisionFrom(minAge: number, maxAge = 120): GameState {
    for (let seed = 1; seed <= 60; seed++) {
      let s: GameState = startLife(seed, 'present');
      for (let guard = 0; guard < 60 && s.phase === 'life'; guard++) {
        s = advanceUntilDecision(s).state;
        if (s.phase !== 'life' || s.pending === null) break;
        if (s.age >= minAge && s.age <= maxAge && previewPending(s, EVENT_POOL)!.some((p) => p.impact.items.length > 0)) return s;
        s = resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
      }
    }
    throw new Error('선택지 상태를 찾지 못했다');
  }
  const adultDecision = decisionFrom(25);
  const youngDecision = decisionFrom(8, 18);

  it('선택지마다 영향 줄이 있고, 항목·방향·칸 수가 previewChoice(= 인생 진행이 선택을 적용하는 계산)와 같다', () => {
    for (const g of [adultDecision, youngDecision]) {
      const panel = sectionOf(render(g), 'choice-panel');
      const pool = EVENT_POOL;
      const previews = previewPending(g, pool)!;
      const buttons = [...panel.matchAll(/<button\b[\s\S]*?<\/button>/g)].map((m) => m[0]);
      expect(buttons).toHaveLength(previews.length);
      let withImpact = 0;
      buttons.forEach((b, i) => {
        const want = previews[i].impact.items.map((it) => ({ key: it.key, direction: it.direction, steps: it.steps }));
        expect(impactItemsOf(b), `${g.age}세 ${previews[i].choiceId}`).toEqual(want);
        if (want.length > 0) {
          withImpact++;
          expect(b).toContain('data-testid="impact"');
        } else expect(b).not.toContain('data-testid="impact"'); // 변화가 없으면 요소 자체가 없다
      });
      expect(withImpact, '영향이 있는 선택지가 하나는 있다').toBeGreaterThan(0);
    }
  });

  it('선택지 버튼의 접근 가능한 이름 = 「{선택지 이름} {영향 문장들}」 — 번호와 눈에 보이는 기호(aria-hidden)는 이름에 들지 않는다', () => {
    for (const g of [adultDecision, youngDecision]) {
      const ev = EVENT_POOL.byId.get(g.pending!.eventId)!;
      const previews = previewPending(g, EVENT_POOL)!;
      const panel = sectionOf(render(g), 'choice-panel');
      const buttons = [...panel.matchAll(/<button\b[\s\S]*?<\/button>/g)].map((m) => m[0]);
      buttons.forEach((b, i) => {
        const choice = ev.choices!.find((c) => c.id === previews[i].choiceId)!;
        expect(accessibleText(b), choice.id).toBe(choiceAccessibleName(choice.label, previews[i].impact.items));
        expect(accessibleText(b)).not.toMatch(/[▲▼]/);
        expect(accessibleText(b).startsWith(String(i + 1))).toBe(false);
      });
    }
  });

  it('20세 미만은 첫 항목이 「집안 살림」이고 「자산」·「부채」는 없다, 20세 이후는 「집안 살림」이 없다 (한 선택지에 둘이 함께 나오지 않는다)', () => {
    const young = previewPending(youngDecision, EVENT_POOL)!.flatMap((p) => p.impact.items.map((it) => it.key));
    expect(young).not.toContain('assets');
    expect(young).not.toContain('debt');
    const adult = previewPending(adultDecision, EVENT_POOL)!.flatMap((p) => p.impact.items.map((it) => it.key));
    expect(adult).not.toContain('family');
    for (const p of previewPending(adultDecision, EVENT_POOL)!) {
      const keys = p.impact.items.map((it) => it.key);
      expect(keys, `${p.choiceId}`).toEqual(IMPACT_KEYS.filter((k) => keys.includes(k))); // 순서 = IMPACT_KEYS
    }
  });

  it('안내 한 줄: 선택지 묶음 바로 아래, 자동 모드 안내보다 앞이다 — 「지금 {이름}에게」 + 기호 설명(aria-hidden)과 스크린리더 대체 글자. 영향 줄이 하나도 없으면 안내도 없다', () => {
    const g = adultDecision;
    const html = render(g, { settings: { autoMode: true } });
    const panel = sectionOf(html, 'choice-panel');
    const list = panel.indexOf('role="group"');
    const hint = panel.indexOf('data-testid="choice-hint"');
    const auto = panel.indexOf('data-testid="auto-note"');
    expect(list).toBeGreaterThan(-1);
    expect(hint).toBeGreaterThan(list);
    expect(auto).toBeGreaterThan(hint);
    const hintHtml = panel.slice(panel.lastIndexOf('<p', hint), panel.indexOf('</p>', hint) + 4);
    expect(text(hintHtml)).toContain(`선택지 아래 글씨는 지금 ${g.character!.name}에게 일어날 변화입니다.`);
    expect(hintHtml).toContain('aria-hidden="true">▲는 늘어남, ▼는 줄어듦이며 표시가 많을수록 변화가 큽니다.</span>');
    expect(hintHtml).toContain('위쪽 세모는 늘어남, 아래쪽 세모는 줄어듦이며 표시가 많을수록 변화가 큽니다.');
    // 영향이 하나도 없는 선택지 묶음에는 안내를 두지 않는다 (없는 것을 설명하지 않는다)
    const ev = EVENT_POOL.byId.get(g.pending!.eventId)!;
    const quietPool = { ...EVENT_POOL, byId: new Map(EVENT_POOL.byId).set(ev.id, { ...ev, choices: ev.choices!.map((c) => ({ ...c, effects: undefined, bonuses: undefined })) }) };
    const quiet = renderToStaticMarkup(
      <LifeScreen game={asLife(g)} settings={settingsOf()} clock={CLOCK} exitOpen={false} onExitOpen={noop} onChoose={noop} onSkip={noop} onSpeed={noop} onAuto={noop} onPause={noop} onBgm={noop} onTheme={noop} onExit={noop} minute={MINUTE} repoUrl={REPO} buildLabel={BUILD} pool={quietPool} />,
    );
    expect(quiet).not.toContain('data-testid="impact"');
    expect(quiet).not.toContain('data-testid="choice-hint"');
  });

  it('지속 비활성 선택지는 M5에 없다 (r2 마스터 결정 4): 선택지 버튼에 data-unavailable이 없다 — 자금이 모자라면 선택지를 숨기고(EC4) 비활성으로 두지 않는다', () => {
    for (const g of [adultDecision, youngDecision]) expect(sectionOf(render(g), 'choice-panel')).not.toContain('data-unavailable');
  });

  it('금액과 퍼센트가 영향 줄에 없다: 선택지 아래에는 기호와 이름뿐이다 (SPEC EC5 — 문장에 금액 없음)', () => {
    for (const g of [adultDecision, youngDecision]) {
      const impactTexts = [...sectionOf(render(g), 'choice-panel').matchAll(/data-testid="impact"[\s\S]*?<\/span><\/span><\/span>/g)].map((m) => text(m[0]));
      for (const t of impactTexts) expect(t).not.toMatch(/\d|원|%|만/);
    }
  });
});

describe('인생 기록 (DB12·DB14)', () => {
  it('줄은 연표와 같은 개수·순서이고 「N세」 + 문장이며, 마지막 줄이 가장 최근이다', () => {
    const log = sectionOf(render(adult), 'log');
    const rows = [...log.matchAll(/<li class="([^"]*)" data-kind="([^"]*)" data-testid="log-row">([\s\S]*?)<\/li>/g)];
    expect(rows).toHaveLength(adult.history.length);
    rows.forEach((m, i) => {
      expect(m[2]).toBe(adult.history[i].kind);
      expect(text(m[3]).startsWith(`${adult.history[i].age}${DASH_TEXT.ageSuffix}`)).toBe(true);
      expect(m[1].includes('log__row--latest'), `${i}번째 줄`).toBe(i === rows.length - 1);
      expect(m[1].includes('log__row--stage')).toBe(adult.history[i].kind === 'stage');
    });
    expect(adult.history.length).toBeGreaterThan(5);
  });

  it('맨 위 고정 줄: 「이 세상의 가상 인구 {N}명」 + 「{이름}도 그중 한 사람」, 쌓이는 기록보다 앞이다', () => {
    const html = render(adult);
    const pin = flat(openTagBlock(html, 'log-pin'));
    const pop = tryVirtualPopulation(MINUTE);
    expect(pop).not.toBeNull();
    expect(nospace(pin)).toContain(nospace(DASH_TEXT.logPinA(formatCount(pop!))));
    expect(nospace(pin)).toContain(nospace(DASH_TEXT.logPinB(adult.character!.name)));
    expect(posOf(html, 'data-testid="log-pin"')).toBeLessThan(posOf(html, 'data-testid="log-list"'));
  });

  it('스크롤 영역: 키보드로 닿고(tabindex 0) 이름이 있는 region. 새 기록 안내 버튼은 처음엔 없다', () => {
    const html = render(adult);
    const list = openTag(html, 'log-list');
    expect(attr(list, 'tabindex')).toBe('0');
    expect(attr(list, 'role')).toBe('region');
    expect(attr(list, 'aria-label')).toBe(DASH_TEXT.logTitle);
    expect(html).not.toContain('data-testid="log-jump"');
  });

  it('새 줄 알림(aria-live)은 빠른 진행(4배 이상)·자동 모드에서는 끈다 — 읽을 수 없는 속도로 낭독이 쌓이지 않게', () => {
    const live = (h: string) => /<ol aria-live="(polite|off)"/.exec(sectionOf(h, 'log'))![1];
    expect(live(render(adult, { settings: { speed: 1 } }))).toBe('polite');
    expect(live(render(adult, { settings: { speed: 2 } }))).toBe('polite');
    expect(live(render(adult, { settings: { speed: 4 } }))).toBe('off');
    expect(live(render(adult, { settings: { speed: 8 } }))).toBe('off');
    expect(live(render(adult, { settings: { autoMode: true } }))).toBe('off');
  });
});

describe('식구 (DB13)', () => {
  it('어머니·아버지·형제자매 줄이 있고, 배우자·자녀는 있을 때만 나온다 (여러 판 전수)', () => {
    let withSpouse = 0;
    let withChild = 0;
    for (const era of ['past', 'present', 'future'] as const) {
      for (let seed = 1; seed <= 12; seed++) {
        const g = ageTo(startLife(seed, era), 20 + (seed % 25));
        if (g.phase !== 'life') continue;
        const card = sectionOf(render(g), 'family-card');
        const f = familyOf(g);
        expect(card).toContain('data-testid="family-mother"');
        expect(card).toContain('data-testid="family-father"');
        expect(card).toContain('data-testid="family-sibling"');
        expect(card.includes('data-testid="family-spouse"'), `${era} ${seed} ${g.age}세 배우자`).toBe(f.spouse !== null);
        expect(card.includes('data-testid="family-child"'), `${era} ${seed} ${g.age}세 자녀`).toBe(f.child !== null);
        if (f.spouse !== null) withSpouse++;
        if (f.child !== null) withChild++;
      }
    }
    expect(withSpouse, '배우자가 보이는 판이 있어야 공허 통과가 아니다').toBeGreaterThan(0);
    expect(withChild).toBeGreaterThan(0);
  });
});

describe('같은 해 태어난 사람들 (VP4)', () => {
  it('출생신고와 같은 4명(이름·성별·장소·수저 칩)에 「요즘 모습」 라벨, 끝에 설계값 안내', () => {
    const card = sectionOf(render(adult), 'peers-now-card');
    const born = peersOf(adult.peerSeed!, adult.character!.birthYear, adult.birthReport!.month, adult.character!.name);
    const now = peersNow(adult);
    expect(now.map((p) => p.name)).toEqual(born.map((p) => p.name));
    const items = [...card.matchAll(/<li data-testid="peer-now">([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    expect(items).toHaveLength(4);
    items.forEach((li, i) => {
      expect(li).toContain(`data-grade="${now[i].wealth}"`);
      expect(li).toContain(gradeStem(now[i].wealth));
      expect(flat(li)).toContain(nospace(now[i].name));
      expect(flat(li)).toContain(nospace(genderLabel(now[i].gender)));
      expect(flat(li)).toContain(nospace(placeLabel(now[i], adult.era!)));
      expect(flat(openTagBlock(li, 'peer-now-label'))).toBe(nospace(PEER_STATUS_LABEL[now[i].status]));
    });
    expect(text(card)).toContain(DASH_TEXT.peersTitle);
    expect(text(card)).toContain(DASH_TEXT.peersSub);
    expect(text(card)).toContain(DASH_TEXT.peersNote);
    expect(DASH_TEXT.peersNote).toMatch(/설계값/);
  });

  it('나이가 들면 라벨이 나이에 맞게 바뀐다 (0세 「어린 시절」 → 31세 어른의 모습)', () => {
    const labels = (g: GameState) => peersNow(g).map((p) => p.label);
    expect(labels(infant).every((l) => l === PEER_STATUS_LABEL.child)).toBe(true);
    expect(labels(adult).some((l) => l === PEER_STATUS_LABEL.child || l === PEER_STATUS_LABEL.school)).toBe(false);
  });

  it('카드가 실제로 나왔으니(DASHBOARD_PEERS_SHIPPED) 출생신고 또래 안내의 둘째 문장이 이 카드의 제목을 가리키고, 「나중에」류 약속 문구는 없다 (R-331 ③ — 예전 제목은 단언과 달랐다)', () => {
    expect(DASHBOARD_PEERS_SHIPPED).toBe(true);
    const note = peersNoteText(DASHBOARD_PEERS_SHIPPED);
    expect(note).toContain(`「${DASH_TEXT.peersTitle}」`);
    expect(note).not.toMatch(/나중에|추가돼요|곧 |준비/);
    // 카드가 없던 때(false)의 안내는 첫 문장뿐이다 — 없는 칸을 가리키지 않는다(QM3-3)
    expect(peersNoteText(false)).not.toContain(DASH_TEXT.peersTitle);
  });
});

describe('출신 가정 구간 글자: 괄호째 한 묶음 (REV-003-M3-5, M4 착수 때 함께)', () => {
  it('GradeLine의 구간 「(상위 3% 안쪽)」은 괄호째 .keep-phrase로 감싸여 좁은 폭에서 갈라지지 않는다 — 출생신고 「집안 형편」·프로필 「출신 가정」 같은 부품', () => {
    const html = renderToStaticMarkup(<GradeLine grade={5} range="(상위 3% 안쪽)" size="lg" />);
    const range = /data-testid="grade-range">([\s\S]*?)<\/span>\s*<\/span>$/.exec(html)?.[1] ?? html.slice(html.indexOf('data-testid="grade-range"'));
    expect(range).toMatch(/<span class="keep-phrase">\(상위 <span class="nowrap">3%<\/span> 안쪽\)<\/span>/);
    // 글자는 그대로다(묶음은 표시일 뿐)
    expect(flat(html.slice(html.indexOf('data-testid="grade-range"')))).toContain('(상위3%안쪽)');
  });

  it('여러 구간 꼴도 한 묶음이다: 「(하위 25%와 상위 45% 사이)」「(상위 17~45% 사이)」', () => {
    for (const label of ['(하위 25%와 상위 45% 사이)', '(상위 17~45% 사이)', '(하위 25% 안쪽)']) {
      const html = renderToStaticMarkup(<GradeLine grade={3} range={label} />);
      expect(html, label).toContain('class="keep-phrase"');
      expect((html.match(/class="keep-phrase"/g) ?? []).length, `${label}: 구간 하나는 묶음 하나`).toBe(1);
    }
  });

  it('프로필 카드의 출신 가정 칸은 같은 GradeLine을 쓴다(구간이 묶음으로 나온다)', () => {
    const card = sectionOf(render(infant), 'profile-card');
    expect(openTagBlock(card, 'profile-home')).toContain('class="keep-phrase"');
  });
});
