import { describe, expect, it } from 'vitest';
import { longestWordLength } from '../src/data/birthReportText';
import { NAMES, futurePool, officialPool, pastPool } from '../src/data/names';
import { ASSETS_AMOUNTS_SHIPPED, DASH_TEXT, SYSTEM_TITLE, SYSTEM_TITLE_CHARS, statusHelpText, titleCharsFor } from '../src/data/dashText';

/**
 * 대시보드 문구 상수 (SPEC-003 M4, REV-003-M4-1 r2): 제목 글자 크기 상한의 칸 수(R-321)와 자산 설명 문장을 숨기는 상수(R-333).
 * 렌더 구조는 tests/dashboard.test.tsx·tests/endingScreen.test.tsx·tests/titleCapDash.test.tsx, 실제 폭·글자 크기 조합의 측정은 e2e/m4-titles.spec.ts가 본다.
 */

describe('제목 글자 크기 상한의 칸 수 (R-321, QM3-2)', () => {
  it('titleCharsFor = 제목 문구의 가장 긴 낱말 글자 수 + 여유 1글자 (룰렛 제목과 같은 규칙)', () => {
    expect(titleCharsFor('윤유준의 인생')).toBe(longestWordLength(['윤유준의 인생']) + 1);
    expect(titleCharsFor('윤유준의 인생')).toBe(5); // 「윤유준의」 4글자
    expect(titleCharsFor('가나 다라마바사')).toBe(6); // 문구 전체(8글자)가 아니라 가장 긴 낱말(「다라마바사」 5글자) + 1
    expect(titleCharsFor('가', '다라마')).toBe(4); // 문구가 여럿이면 그중 가장 긴 낱말
    expect(titleCharsFor('👍👍 a')).toBe(3); // 이모지도 한 글자
  });

  it('밀린 화면·오류 화면 메시지: 칸 수는 두 메시지의 가장 긴 낱말(「바뀌었습니다.」 7글자) + 1이고, 메시지 글자는 현행 그대로다 (docs/design/copy.md)', () => {
    expect(SYSTEM_TITLE.superseded).toBe('저장된 게임이 이 화면 밖에서 바뀌었습니다.');
    expect(SYSTEM_TITLE.error).toBe('저장된 내용을 불러오는 중 문제가 생겼습니다.');
    expect(longestWordLength([SYSTEM_TITLE.superseded, SYSTEM_TITLE.error])).toBe(7);
    expect(SYSTEM_TITLE_CHARS).toBe(8);
    // 다른 메시지 문구가 더 긴 낱말을 가지면 상수가 따라간다
    expect(titleCharsFor(SYSTEM_TITLE.superseded)).toBe(8);
    expect(titleCharsFor(SYSTEM_TITLE.error)).toBe(7); // 「생겼습니다.」 6글자
  });
});

describe('대시보드 이름(h1)은 줄일 상한 없이 가장 좁은 조합에도 한 줄에 들어간다 (R-321)', () => {
  it('이름 = 성씨 한 글자 + 풀의 이름이다: 모든 시대·성별 풀을 훑어 가장 긴 이름이 4글자 이하이고, 그 길이가 폭 320 · 글자 200%의 한 줄(헤더 내용 폭 288px ÷ 글자 32px = 9글자)에 여유 있게 든다', () => {
    const surnameMax = Math.max(...NAMES.surnames.items.map((x) => [...x.name].length));
    const pools: string[] = [];
    for (const gender of ['male', 'female'] as const) {
      pools.push(...(officialPool(2025, gender) ?? []), ...futurePool(gender));
      for (const decade of [1950, 1960, 1970, 1980]) pools.push(...(pastPool(decade, gender) ?? []));
    }
    expect(pools.length, '공허 통과 방지: 풀을 실제로 훑었다').toBeGreaterThan(200);
    const givenMax = Math.max(...pools.map((n) => [...n].length));
    expect(surnameMax).toBe(1);
    expect(surnameMax + givenMax, '가장 긴 이름(성 + 이름) 글자 수').toBeLessThanOrEqual(4);
    const lineChars = Math.floor((320 - 2 * 16) / (16 * 2)); // 폭 320 − 좌우 여백 16px씩, 글자 200%의 한글 한 글자 32px
    expect(lineChars).toBe(9);
    expect(surnameMax + givenMax).toBeLessThan(lineChars);
  });
});

describe('상태 도움말과 자산 (R-333 → M5 2b)', () => {
  it('자산 금액이 화면에 있으므로(M5 2b) ASSETS_AMOUNTS_SHIPPED가 켜졌고, 도움말은 시대별 단위 문장 + 가구 기준 한 문장을 싣는다 (copy.md 4-5절)', () => {
    expect(ASSETS_AMOUNTS_SHIPPED).toBe(true);
    const base = statusHelpText(false, 'present');
    expect(base).not.toMatch(/자산|원 단위/);
    for (const era of ['past', 'future'] as const) expect(statusHelpText(false, era)).toBe(base); // 자산 문장을 켜지 않으면 시대와 무관하다
    const household = '순자산, 연 소득, 부채는 내 가구 기준이며 결혼한 뒤에는 배우자와 자녀의 몫까지 합한 값입니다.';
    expect(statusHelpText(true, 'present')).toBe(`${base} 자산은 올해 가치 기준의 원 단위입니다. ${household}`);
    expect(statusHelpText(true, 'past')).toBe(`${base} 자산은 지금 가치로 환산한 원 단위입니다. ${household}`);
    expect(statusHelpText(true, 'future')).toBe(statusHelpText(true, 'past'));
    // 건강·행복·지식·관계 네 가지 설명은 두 경우 모두 있다
    for (const word of ['건강은', '행복은', '지식은', '관계는']) {
      expect(statusHelpText(false, 'present')).toContain(word);
      expect(statusHelpText(true, 'present')).toContain(word);
    }
  });

  it('접이식 제목은 「상태와 자산의 뜻 보기」(r2 마스터 결정 1, D-36)이고, 옛 제목 「상태 네 가지의 뜻 보기」는 없다', () => {
    expect(DASH_TEXT.statusHelpSummary).toBe('상태와 자산의 뜻 보기');
    expect(JSON.stringify(DASH_TEXT)).not.toContain('상태 네 가지의 뜻 보기');
  });

  it('자산 현황 문구 (copy.md 4-5절): 이름 셋에 「(가구)」를 붙이지 않고, 지난·다가올 세상의 태그는 「지금 가치로 환산」, 주석은 「빚」 대신 「부채」로 말한다. 20세 전 안내는 그대로, 준비 중 자리표시는 사라졌다', () => {
    expect([DASH_TEXT.assetsNet, DASH_TEXT.assetsIncome, DASH_TEXT.assetsDebt]).toEqual(['순자산', '연 소득', '부채']);
    expect(DASH_TEXT.assetsBasis).toBe('지금 가치로 환산');
    expect(DASH_TEXT.assetsNote).toBe('순자산은 가진 것에서 부채를 뺀 값입니다. 0보다 작으면 부채가 가진 것보다 많다는 뜻입니다.');
    expect(DASH_TEXT.assetsNote).not.toContain('빚');
    expect(DASH_TEXT.assetsYoung).toBe('자산은 스무 살부터 셉니다. 지금은 집안 형편을 따릅니다.');
    expect(Object.keys(DASH_TEXT)).not.toContain('assetsSoon');
    expect(JSON.stringify(DASH_TEXT)).not.toContain('아직 준비 중입니다');
  });
});

describe('생각 남기기 자리 (R-326)', () => {
  it('눌러서 안내를 띄우던 문구는 없고, 눈에 보이는 표식은 「준비 중」이다 (첫 화면 카드 「약 1시간」과 같은 낱말)', () => {
    expect(DASH_TEXT.toolSoon).toBe('준비 중');
    expect(Object.keys(DASH_TEXT)).not.toContain('noteSoon');
  });
});
