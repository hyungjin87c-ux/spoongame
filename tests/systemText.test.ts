import { describe, expect, it } from 'vitest';
import {
  ERAS,
  PARENT_WEALTHS,
  bandFromRange,
  finalWealthStanding,
  splitSentences,
  standingOf,
  startBandOf,
  toneOf,
  type Era,
  type Standing,
  type WealthJourney,
} from '../src/core';
import { PARENTING_STYLES } from '../src/core/types';
import { parentingDocText } from '../src/data/birthReportText';
import { FINAL_NET_TEXT, JOURNEY_NOTE, MOVEMENT_TEXT, bandLabel, choiceCountText, deathLineText, journeyBarLabel, journeyText } from '../src/data/endingText';
import { INHERIT_NOTE_TEXT, STAGE_ENTRY_TEXT } from '../src/data/lifeTable';
import { deathCauseCandidates, deathEntryText } from '../src/data/lifeText';
import { DASH_TEXT, statusHelpText } from '../src/data/dashText';
import { IMPACT_HINT } from '../src/data/impactText';
import { standingLabel } from '../src/data/birthText';
import endingTextSrc from '../src/data/endingText.ts?raw';
import lifeTextSrc from '../src/data/lifeText.ts?raw';
import lifeTableSrc from '../src/data/lifeTable.ts?raw';
import impactTextSrc from '../src/data/impactText.ts?raw';
import dashTextSrc from '../src/data/dashText.ts?raw';
import birthTextSrc from '../src/data/birthText.ts?raw';
import birthReportTextSrc from '../src/data/birthReportText.ts?raw';
import familyTextSrc from '../src/data/familyText.ts?raw';
import birthCompareSrc from '../src/data/birthCompare.ts?raw';
import birthReportSrc from '../src/core/birthReport.ts?raw';

/**
 * 시스템 문구의 어체 점검 (SPEC-003 M7e-3, 마스터 결정: 해라체 이행 장치를 걷어내는 대신 시스템 문구 파일에도 합쇼체 점검을 건다).
 *
 * 이벤트 JSON은 `eventLint`가 본문·결과를 문장마다 합쇼체로 점검한다. 같은 규칙(`splitSentences`·`toneOf`)을 **화면에 나오는 서술 문장**에도 건다:
 * 사망 줄·선택 수·출발선 문장·방향 문장·단계 진입 줄·상속 한 줄·도움말·자산 주석·출생 서술문 같은 문장이 해라체(「~했다.」)로 남지 않게 한다.
 * 제외(마스터 결정 R2): 버튼·선택지 라벨·제목·시스템 안내(저장 안내·오류·「준비 중」·룰렛 해요체 안내·자동 모드 안내 등)는 현행 어체다 — 라벨은 「~다」, 안내는 합쇼체·해요체가 섞여 있어 이 점검의 대상이 아니다.
 *
 * 두 갈래다. (1) 함수·상수가 **실제로 만드는 문장**을 모아 문장마다 합쇼체인지 본다(원인 낱말·자리·구간의 모든 갈래). (2) 문구 파일의 **소스**에서 해라체 문장 끝(「~했다.」)을 찾는다 —
 * 새 문장을 더하면서 해라체로 쓰면 (1)의 목록에 안 들어 있어도 걸린다.
 */

const tonesOf = (text: string): string[] => splitSentences(text).sentences.map((s) => toneOf(s.core));

/** 소스에서 주석(블록·줄)을 뺀 글: 코드와 문자열 리터럴만 남는다 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/.*$/, ''))
    .join('\n');
}

/** 해라체 문장 끝 「~했다.」(「니다.」 제외) — 문자열 리터럴 안에서만 센다 */
const HAERA_IN_STRING = /['"`][^'"`\n]*[가-힣](?<!니)다\.(?=\s|['"`]|\$\{|$)[^'"`\n]*['"`]/;

describe('시스템 문구 어체 (1): 함수·상수가 실제로 만드는 서술 문장은 문장마다 합쇼체다', () => {
  const STANDINGS: Standing[] = [
    { kind: 'top', percent: 23, within: false },
    { kind: 'top', percent: 1, within: true },
    { kind: 'bottom', percent: 38, within: false },
    { kind: 'bottom', percent: 1, within: true },
    { kind: 'middle' },
  ];
  const sentencesOfSystem = (): Array<{ where: string; text: string }> => {
    const out: Array<{ where: string; text: string }> = [];
    const add = (where: string, text: string) => out.push({ where, text });
    // 사망 줄·연표 사망 줄: 원인 후보 8개(받침 있는 낱말·없는 낱말 모두)와 여러 나이
    for (const age of [5, 30, 59, 84]) for (const health of [10, 80]) for (const cause of deathCauseCandidates(age, health)) {
      add(`deathLineText(${age}세·${cause})`, deathLineText({ age, cause }));
      add(`deathEntryText(${cause})`, deathEntryText(cause));
    }
    for (const n of [0, 1, 27]) add(`choiceCountText(${n})`, choiceCountText(n));
    // 출발선 문장: 모든 시대 × 재력 5단계 × 도착 자리 갈래, 스무 살 전
    for (const era of ERAS) for (const wealth of PARENT_WEALTHS) {
      const start = startBandOf(era as Era, wealth);
      add(`journeyText(early·${era}·${wealth})`, journeyText({ kind: 'early', start }));
      for (const end of STANDINGS) {
        const j: WealthJourney = { kind: 'compared', start, end, movement: 'same' };
        add(`journeyText(${era}·${wealth}·${standingLabel(end)})`, journeyText(j));
        // (막대의 aria-label — 「출발선 하위 25% 안쪽, 마지막 상위 약 48%.」 — 은 읽기용 **이름**이라 R2의 라벨 쪽이다. M7e-4부터 방향 문장은 aria-label에 없다. 예전에는 끝 문장(방향)만 MOVEMENT_TEXT로 본다)
        expect(journeyBarLabel(j)).toBe(`출발선 ${bandLabel(start)}, 마지막 ${standingLabel(end)}.`); // M7e-4: 방향 문장은 aria-label에 없다
      }
    }
    for (const [k, v] of Object.entries(MOVEMENT_TEXT)) add(`MOVEMENT_TEXT.${k}`, v);
    add('JOURNEY_NOTE', JOURNEY_NOTE);
    add('FINAL_NET_TEXT.early', FINAL_NET_TEXT.early);
    for (const [k, v] of Object.entries(STAGE_ENTRY_TEXT)) add(`STAGE_ENTRY_TEXT.${k}`, v);
    add('INHERIT_NOTE_TEXT', INHERIT_NOTE_TEXT);
    // 도움말·주석·안내 줄의 설명 문장
    for (const era of ERAS) add(`statusHelpText(${era})`, statusHelpText(true, era as Era));
    add('statusHelpText(자산 없음)', statusHelpText(false, 'present'));
    add('DASH_TEXT.assetsYoung', DASH_TEXT.assetsYoung);
    add('DASH_TEXT.assetsNote', DASH_TEXT.assetsNote);
    add('IMPACT_HINT.lead', IMPACT_HINT.lead('이서연'));
    add('IMPACT_HINT.symbols', IMPACT_HINT.symbols);
    // 출생 서술(교육방식 설명)
    for (const style of PARENTING_STYLES) for (const wealth of PARENT_WEALTHS) add(`parentingDocText(${style}·${wealth})`, parentingDocText(style, wealth));
    return out;
  };

  it('모아 둔 문장이 공허하지 않다: 100개 이상, 사망 원인 8갈래 모두 포함', () => {
    const all = sentencesOfSystem();
    expect(all.length).toBeGreaterThan(100);
    const causes = new Set<string>();
    for (const age of [5, 30, 59, 84]) for (const health of [10, 80]) for (const c of deathCauseCandidates(age, health)) causes.add(c);
    expect(causes.size).toBe(8);
  });

  it('모든 문장이 문장마다 합쇼체(「~습니다./~ㅂ니다.」)다 — 해라체·반말·명사 조각 종결이 없다', () => {
    const wrong: string[] = [];
    let n = 0;
    for (const { where, text } of sentencesOfSystem()) {
      const tones = tonesOf(text);
      n += tones.length;
      if (tones.length === 0) wrong.push(`${where}: 문장을 못 읽었다 — ${text}`);
      tones.forEach((t, i) => {
        if (t !== 'hapsyo') wrong.push(`${where}: ${i + 1}번째 문장이 ${t} — ${text}`);
      });
    }
    expect(n, '점검한 문장 수').toBeGreaterThan(150);
    expect(wrong).toEqual([]);
  });

  it('원인 낱말의 받침에 따라 「이었습니다」·「였습니다」가 갈린다 (copy.md 5-3): 노환이었 · 사고였 · 갑작스러운 병이었 · 조용한 잠이었 · 병세 악화였', () => {
    expect(deathLineText({ age: 84, cause: '노환' })).toBe('84세에 세상을 떠났습니다. 원인은 노환이었습니다.');
    expect(deathLineText({ age: 17, cause: '사고' })).toBe('17세에 세상을 떠났습니다. 원인은 사고였습니다.');
    expect(deathEntryText('갑작스러운 병')).toBe('세상을 떠났습니다. 원인은 갑작스러운 병이었습니다.');
    expect(deathEntryText('조용한 잠')).toBe('세상을 떠났습니다. 원인은 조용한 잠이었습니다.');
    expect(deathEntryText('병세 악화')).toBe('세상을 떠났습니다. 원인은 병세 악화였습니다.');
    // 후보 8개 모두 합쇼체 한 쌍이다
    for (const age of [5, 30, 59, 84]) for (const health of [10, 80]) for (const cause of deathCauseCandidates(age, health)) {
      expect(deathEntryText(cause), cause).toMatch(/^세상을 떠났습니다\. 원인은 .+(이었|였)습니다\.$/);
    }
  });

  it('copy.md 5-3의 새 문안과 글자까지 같다: 단계 진입·선택 수·출발선·방향', () => {
    expect(STAGE_ENTRY_TEXT.youth).toBe('스무 살이 되었습니다. 이제부터는 집안 형편이 아니라 내가 가진 것으로 살아갑니다.');
    expect(STAGE_ENTRY_TEXT.middle).toBe('어느덧 마흔이 되었습니다.');
    expect(STAGE_ENTRY_TEXT.senior).toBe('예순다섯이 되었습니다. 일에서 한 걸음 물러설 나이입니다.');
    expect(choiceCountText(27)).toBe('살아오며 27번의 선택을 했습니다.');
    expect(choiceCountText(0)).toBe('선택을 내려야 하는 순간이 오기 전이었습니다.');
    const start = bandFromRange(0, 25);
    expect(journeyText({ kind: 'early', start })).toBe('하위 25% 안쪽의 집에서 태어났습니다.');
    expect(journeyText({ kind: 'compared', start, end: standingOf(40, 60), movement: 'up' })).toBe('하위 25% 안쪽의 집에서 태어나, 상위 약 40%의 형편으로 생을 마쳤습니다.');
    expect(MOVEMENT_TEXT).toEqual({ up: '출발선보다 앞선 자리입니다.', same: '출발선과 비슷한 자리입니다.', down: '출발선보다 뒤쪽 자리입니다.' });
    expect(bandLabel(bandFromRange(25, 55))).toBe('하위 25% 선과 상위 45% 선 사이');
  });
});

describe('시스템 문구 어체 (2): 문구 파일의 소스에는 해라체 문장 끝(「~했다.」)이 없다', () => {
  const FILES: Record<string, string> = {
    'endingText.ts': endingTextSrc,
    'lifeText.ts': lifeTextSrc,
    'lifeTable.ts': lifeTableSrc,
    'impactText.ts': impactTextSrc,
    'dashText.ts': dashTextSrc,
    'birthText.ts': birthTextSrc,
    'birthReportText.ts': birthReportTextSrc,
    'familyText.ts': familyTextSrc,
    // M7e-4(REV-003-M7e-1 관찰 6): 목록 밖에 있던 화면 서술 출처 — 출생 비교 표의 한 줄(`lifeGapLine`)과 출생신고 한 줄 서술문(`birthSentence`)
    'birthCompare.ts': birthCompareSrc,
    'birthReport.ts': birthReportSrc,
  };

  it('정규식이 실제로 잡는다(공허 통과 방지): 해라체 문자열은 걸리고 합쇼체·라벨·주석은 안 걸린다', () => {
    expect(HAERA_IN_STRING.test("const a = '세상을 떠났다. 원인: 노환.';")).toBe(true);
    expect(HAERA_IN_STRING.test('const a = `${n}번의 선택을 했다.`;')).toBe(true);
    expect(HAERA_IN_STRING.test("const a = '세상을 떠났습니다. 원인은 노환이었습니다.';")).toBe(false);
    expect(HAERA_IN_STRING.test("const a = '다시 태어나기';")).toBe(false);
    expect(HAERA_IN_STRING.test(stripComments("// 「스무 살이 되었다.」는 예전 문장\nconst a = 1;"))).toBe(false);
  });

  it('문구 파일 10개의 문자열 리터럴에 해라체 문장 끝이 하나도 없다 (주석 제외)', () => {
    const wrong: string[] = [];
    for (const [name, src] of Object.entries(FILES)) {
      stripComments(src)
        .split('\n')
        .forEach((line, i) => {
          if (HAERA_IN_STRING.test(line)) wrong.push(`${name}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(wrong).toEqual([]);
  });

  it('제외 대상은 점검하지 않는다 — 라벨 「~다」·「다시 태어나기」 같은 버튼·제목은 해라체 판정 밖이다 (R2)', () => {
    // 라벨(선택지 이름)은 「~다」로 끝나는 것이 규칙이다. 이 점검은 마침표가 붙는 **문장**만 본다.
    expect(HAERA_IN_STRING.test("label: '창문을 연다',")).toBe(false);
  });
});

describe('0원·동률 규칙 (M7e-3, 마스터 결정 C: 동률 불리)', () => {
  it('하위는 「미만」 비율이라 같은 금액으로 마친 인생을 내 아래로 세지 않는다 — 0원이 현행(≤)보다 낮은 하위 자리(또는 가운데쯤이 아닌 하위)로 읽힌다', () => {
    for (const era of ERAS) {
      const zero = finalWealthStanding(era as Era, 0);
      // 0원은 어느 시대에서도 「앞선 위쪽」이 아니라 하위로 읽힌다(빚으로 마친 사람보다 낫지만 같은 0원끼리 위아래가 없다)
      expect(zero.kind, `${era}: 0원`).toBe('bottom');
    }
  });
});
