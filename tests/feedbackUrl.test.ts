import { describe, expect, it } from 'vitest';
import configRaw from '../.github/ISSUE_TEMPLATE/config.yml?raw';
import templateRaw from '../.github/ISSUE_TEMPLATE/feedback.yml?raw';
import pkgRaw from '../package.json?raw';
import { resolveRepoUrl } from '../scripts/buildInfo';
import { startLife } from '../scripts/simulateLib';
import { ERA_CONFIG } from '../src/data/birthTable';
import { LIFE_LENGTH_TEXT } from '../src/data/titleText';
import { ERAS, LIFE_LENGTHS, PHASES, FEEDBACK_SCREEN_FIELD, FEEDBACK_SCREEN_LABEL, FEEDBACK_TEMPLATE, buildFeedbackUrl, feedbackFieldsOf, notesOf, writeNote, type FeedbackFields } from '../src/core';

/**
 * 의견 보내기 링크 (SPEC-003 DB7): GitHub 이슈 작성 화면으로 새 탭에서 열린다. 주소에 담기는 것은 허용 목록(빌드 버전·화면·세상·인생 길이)뿐이고,
 * 이름·나이·인생 기록·자유 기록·저장 데이터는 들어갈 자리가 없다. 저장소 주소는 빌드 설정(package.json repository)에서 읽는다.
 */
const REPO = 'https://github.com/owner/spoongame';
const BUILD = 'v0.1.0 (abc1234)';
const base: FeedbackFields = { repoUrl: REPO, screen: 'life', era: 'present', lifeLength: 'short30', buildLabel: BUILD };

describe('resolveRepoUrl: package.json repository → 저장소 https 주소', () => {
  it('npm이 허용하는 여러 모양을 같은 주소로 읽는다', () => {
    const want = 'https://github.com/owner/spoongame';
    for (const input of [
      'https://github.com/owner/spoongame',
      'https://github.com/owner/spoongame.git',
      'https://github.com/owner/spoongame/',
      'git+https://github.com/owner/spoongame.git',
      'git@github.com:owner/spoongame.git',
      'github:owner/spoongame',
      { type: 'git', url: 'git+https://github.com/owner/spoongame.git' },
    ]) {
      expect(resolveRepoUrl(input), JSON.stringify(input)).toBe(want);
    }
  });

  it('GitHub 저장소가 아니거나 모양이 어긋나면 빈 글자다 (엉뚱한 주소로 보내지 않는다)', () => {
    for (const input of [
      undefined,
      null,
      42,
      '',
      'not a url',
      'https://gitlab.com/owner/spoongame',
      'http://github.com/owner/spoongame',
      'https://github.com.evil.example/owner/spoongame',
      'https://evil.example/https://github.com/owner/spoongame',
      'https://github.com/owner',
      'https://github.com/owner/spoongame/issues',
      'https://github.com/-owner/spoongame',
      'https://github.com/owner/spoon game',
      'https://github.com/owner/spoongame?x=1',
      'https://github.com/owner/spoongame#frag',
      'javascript:alert(1)',
      { url: 7 },
      { type: 'git' },
    ]) {
      expect(resolveRepoUrl(input), JSON.stringify(input)).toBe('');
    }
  });

  it('실제 package.json의 repository가 올바른 주소로 읽힌다 (빌드 설정과 같은 경로)', () => {
    const pkg = JSON.parse(pkgRaw) as { repository?: unknown };
    expect(resolveRepoUrl(pkg.repository)).toMatch(/^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/);
  });
});

describe('buildFeedbackUrl: 허용 목록 필드만', () => {
  it('이슈 작성 주소 모양: 저장소/issues/new, 쿼리는 template·screen 둘뿐', () => {
    const url = buildFeedbackUrl(base)!;
    const u = new URL(url);
    expect(u.origin).toBe('https://github.com');
    expect(u.pathname).toBe('/owner/spoongame/issues/new');
    expect([...u.searchParams.keys()].sort()).toEqual([FEEDBACK_SCREEN_FIELD, 'template'].sort());
    expect(u.searchParams.get('template')).toBe(FEEDBACK_TEMPLATE);
    expect(u.hash).toBe('');
  });

  it('화면 칸은 「화면, 세상, 인생 길이, 빌드」 쉼표 나열이다 (가운뎃점·줄바꿈 없음)', () => {
    const screen = new URL(buildFeedbackUrl(base)!).searchParams.get(FEEDBACK_SCREEN_FIELD)!;
    expect(screen).toBe(`${FEEDBACK_SCREEN_LABEL.life}, ${ERA_CONFIG.present.label}, ${LIFE_LENGTH_TEXT.short30.title}, ${BUILD}`);
    expect(screen).not.toMatch(/[·\n\r]/);
  });

  it('모든 화면 단계 × 세상 × 인생 길이 조합이 주소로 만들어지고, 판이 없으면(첫 화면) 세상·인생 길이가 빠진다', () => {
    let n = 0;
    for (const screen of PHASES) {
      for (const era of [null, ...ERAS]) {
        for (const lifeLength of [null, ...LIFE_LENGTHS]) {
          const url = buildFeedbackUrl({ ...base, screen, era, lifeLength });
          expect(url, `${screen} ${era} ${lifeLength}`).not.toBeNull();
          const text = new URL(url!).searchParams.get(FEEDBACK_SCREEN_FIELD)!;
          expect(text.startsWith(FEEDBACK_SCREEN_LABEL[screen])).toBe(true);
          expect(text.includes(ERA_CONFIG.past.label) || text.includes(ERA_CONFIG.present.label) || text.includes(ERA_CONFIG.future.label)).toBe(era !== null);
          n++;
        }
      }
    }
    expect(n).toBe(PHASES.length * (ERAS.length + 1) * (LIFE_LENGTHS.length + 1));
    expect(new URL(buildFeedbackUrl({ ...base, screen: 'title', era: null, lifeLength: null })!).searchParams.get(FEEDBACK_SCREEN_FIELD)).toBe(`${FEEDBACK_SCREEN_LABEL.title}, ${BUILD}`);
  });

  it('저장소 주소가 어긋나면 링크를 만들지 않는다 (null)', () => {
    for (const repoUrl of ['', 'https://evil.example/owner/spoongame', 'https://github.com/owner/spoongame/issues/new', 'http://github.com/owner/spoongame', 'javascript:alert(1)', `${REPO}?a=b`, `${REPO}\n`]) {
      expect(buildFeedbackUrl({ ...base, repoUrl }), JSON.stringify(repoUrl)).toBeNull();
    }
  });

  it('빌드 표기가 어긋나면(이름·기록 같은 자유 글이 끼어든 경우 포함) 빌드 부분만 빠지고 나머지는 그대로다', () => {
    const clean = new URL(buildFeedbackUrl({ ...base, buildLabel: '' })!).searchParams.get(FEEDBACK_SCREEN_FIELD)!;
    expect(clean).toBe(`${FEEDBACK_SCREEN_LABEL.life}, ${ERA_CONFIG.present.label}, ${LIFE_LENGTH_TEXT.short30.title}`);
    for (const buildLabel of ['홍길동', 'v0.1.0 (홍길동)', 'v0.1.0 (abc1234) 홍길동', 'v0.1.0 (ABC1234)', 'v0.1.0', 'v0.1.0 (abc123)', 'v0.1.0 (abc1234)\n본문', `v${'9'.repeat(40)} (abc1234)`, 'v1 (개발 빌드) 이름=김']) {
      expect(new URL(buildFeedbackUrl({ ...base, buildLabel })!).searchParams.get(FEEDBACK_SCREEN_FIELD), JSON.stringify(buildLabel)).toBe(clean);
    }
    // 허용 모양
    for (const buildLabel of ['v0.1.0 (abc1234)', 'v0.1.0 (abc1234+)', 'v0.1.0 (개발 빌드)', 'v1.2.3-rc.1 (0123abc)']) {
      expect(new URL(buildFeedbackUrl({ ...base, buildLabel })!).searchParams.get(FEEDBACK_SCREEN_FIELD), buildLabel).toContain(buildLabel);
    }
  });

  it('주소 한 줄이 쿼리를 깨뜨리는 글자(& = ? # 공백 한글)를 안전하게 인코딩한다', () => {
    const url = buildFeedbackUrl(base)!;
    expect(url).not.toMatch(/\s/);
    expect(url.split('?')).toHaveLength(2);
    expect(url.split('#')).toHaveLength(1);
    expect(url.split('&')).toHaveLength(2); // template과 screen 사이의 하나뿐
    expect(url).toMatch(/^[\x21-\x7e]+$/); // ASCII만(한글은 %인코딩)
  });
});

describe('feedbackFieldsOf: 게임 상태에서 네 가지만', () => {
  const hostile = '홍길동<script>alert(1)</script>&screen=악성#해시?x=1';
  const game = startLife(77, 'present');
  const named = { ...game, character: { ...game.character!, name: hostile } };

  it('결과는 정해진 다섯 키뿐이다 — 이름·나이·기록·저장 데이터는 읽지도 않는다', () => {
    const fields = feedbackFieldsOf(named, REPO, BUILD);
    expect(Object.keys(fields).sort()).toEqual(['buildLabel', 'era', 'lifeLength', 'repoUrl', 'screen'].sort());
    expect(fields).toEqual({ repoUrl: REPO, screen: named.phase, era: named.era, lifeLength: named.lifeLength, buildLabel: BUILD });
    expect(JSON.stringify(fields)).not.toContain('홍길동');
  });

  it('입력 객체가 이름·나이·기록·메모를 잔뜩 가져도 주소에는 한 글자도 새지 않는다', () => {
    const spy = {
      ...named,
      age: 37,
      history: [{ age: 5, text: '비밀 기록 문장' }],
      notes: ['자유 기록 비밀'],
      profile: { name: hostile },
    };
    const url = buildFeedbackUrl(feedbackFieldsOf(spy, REPO, BUILD))!;
    const decoded = decodeURIComponent(url);
    for (const secret of ['홍길동', 'script', '악성', '비밀 기록 문장', '자유 기록 비밀', '37', hostile]) expect(decoded, secret).not.toContain(secret);
    expect(url).not.toContain(encodeURIComponent('홍길동'));
  });

  it('M7c P2: 연표에 기록(note) 줄이 있어도(특수문자·긴 글·그림 문자·여러 줄) 주소에 글의 어떤 조각도 없고, 기록이 없는 같은 판의 주소와 글자까지 같다', () => {
    const secrets = ['비밀 기록 한 줄', '<script>alert(1)</script>', '& screen=악성 #해시 ?x=1', 'DROP TABLE', '가족을 향한 마음', String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467), '긴글'.repeat(30)];
    let written = game;
    secrets.forEach((text, i) => {
      written = writeNote(written, { cardId: null, text });
      expect(notesOf(written), `기록 ${i}`).toHaveLength(i + 1); // 공허 통과 방지: 실제로 note 줄이 쌓였다
    });
    expect(written.history.filter((h) => h.kind === 'note')).toHaveLength(secrets.length);
    for (const state of [written, { ...written, phase: 'ending' as const }]) {
      const url = buildFeedbackUrl(feedbackFieldsOf(state, REPO, BUILD))!;
      const decoded = decodeURIComponent(url);
      for (const secret of secrets) {
        const chars = Array.from(secret);
        for (const piece of [secret, chars.slice(0, 4).join(''), chars.slice(-3).join('')]) {
          expect(decoded, piece).not.toContain(piece);
          expect(url, piece).not.toContain(encodeURIComponent(piece));
        }
      }
      const clean = buildFeedbackUrl(feedbackFieldsOf({ ...game, phase: state.phase }, REPO, BUILD))!;
      expect(url, '기록이 있든 없든 같은 주소').toBe(clean);
    }
    // 입력 타입이 글을 담을 자리가 없다: 결과 키는 여전히 다섯 개뿐이다
    expect(Object.keys(feedbackFieldsOf(written, REPO, BUILD)).sort()).toEqual(['buildLabel', 'era', 'lifeLength', 'repoUrl', 'screen']);
  });

  it('M8 LD-11: 플레이 시간(play)은 주소에 싣지 않는다 — 시간이 많이 쌓인 판(엔딩)이어도 기록이 없는 같은 판의 주소와 글자까지 같고, 결과 키는 여전히 다섯 개뿐이다 (형진 님이 엔딩 숫자를 직접 알려 준다)', () => {
    const played = { ...game, phase: 'ending' as const, play: { hold: 910_900, decide: 756_900, fold: 12_345, note: 23_456, idle: 34_567, offSpeed: 7_777, auto: 8_888, skips: 3, resumes: 4 } };
    const url = buildFeedbackUrl(feedbackFieldsOf(played, REPO, BUILD))!;
    const decoded = decodeURIComponent(url);
    for (const piece of ['910900', '756900', '12345', '23456', '34567', '7777', '8888', '27:46', 'PT', '1666', 'play', 'hold', 'decide']) expect(decoded, piece).not.toContain(piece);
    expect(url, '플레이 시간이 있든 없든 같은 주소').toBe(buildFeedbackUrl(feedbackFieldsOf({ ...game, phase: 'ending' as const }, REPO, BUILD))!);
    expect(Object.keys(feedbackFieldsOf(played, REPO, BUILD)).sort()).toEqual(['buildLabel', 'era', 'lifeLength', 'repoUrl', 'screen']);
  });

  it('첫 화면처럼 판이 없는 상태도 읽는다', () => {
    const fields = feedbackFieldsOf({ phase: 'title', era: null, lifeLength: null }, REPO, BUILD);
    expect(fields).toEqual({ repoUrl: REPO, screen: 'title', era: null, lifeLength: null, buildLabel: BUILD });
  });
});

describe('이슈 양식 파일과의 대응 (.github/ISSUE_TEMPLATE/feedback.yml)', () => {
  it('주소가 가리키는 양식 파일이 실제로 있고, 미리 채우는 칸의 id(screen)가 양식에 있다', () => {
    expect(FEEDBACK_TEMPLATE).toBe('feedback.yml');
    expect(templateRaw.length).toBeGreaterThan(100);
    // `- type: input` 다음에 `id: screen` 이 이어진다(양식의 한 칸)
    expect(templateRaw).toMatch(new RegExp(`- type: input\\s*\\n\\s*id: ${FEEDBACK_SCREEN_FIELD}\\s*\\n`));
  });

  it('미리 채우는 칸의 이름표가 「어떤 화면에서」이고 필수 칸이다', () => {
    const block = templateRaw.split(/\n  - type:/).find((b) => new RegExp(`\\bid: ${FEEDBACK_SCREEN_FIELD}\\b`).test(b))!;
    expect(block).toMatch(/label: 어떤 화면에서/);
    expect(block).toMatch(/required: true/);
  });

  it('개인정보를 적지 말라는 안내가 양식 머리에 있고, 빈 이슈는 막혀 있다', () => {
    expect(templateRaw).toMatch(/개인정보/);
    expect(configRaw).toMatch(/blank_issues_enabled: false/);
  });

  it('화면 이름 표는 모든 화면 단계를 덮는다 (누락 없음)', () => {
    expect(Object.keys(FEEDBACK_SCREEN_LABEL).sort()).toEqual([...PHASES].sort());
    for (const label of Object.values(FEEDBACK_SCREEN_LABEL)) expect(label.length).toBeGreaterThan(1);
  });
});
