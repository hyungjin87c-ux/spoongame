import { describe, expect, it } from 'vitest';
import {
  ERAS,
  LEGACY_HAERACHE_SET,
  familyOf,
  isChoiceEvent,
  lintEvent,
  stageOfAge,
  textPartsOf,
  toneOf,
  type Condition,
  type EventDef,
} from '../src/core';
import { EVENT_FILES, EVENT_POOL } from '../src/data/events';
import { infantLives, summarizeInfant, INFANT_LAST_AGE, type InfantLife } from '../scripts/infantMetricsLib';
import { possibleEventsAt } from '../scripts/spec003BaselineLib';
import { STAGE_ENTRY_TEXT } from '../src/data/lifeTable';
import { M7A_ERA_ONLY, M7A_NEW_CHOICE_IDS, M7A_NEW_EVENT_IDS, M7A_WEALTH_GATES } from './helpers/m7a';

/**
 * SPEC-003 M7a 영유아(0~7세) 콘텐츠 (IN1~IN8, docs/data/content-M7a-infant.md 3절 · 12절 마스터 결정).
 * 문안·효과를 문서에서 옮겼는지(목록·종류·창·시대·조건), 규모·빈 해·선택지 수·마일스톤·동생 맞이·시대 전용·재력 차이를 시뮬레이션으로 본다.
 * 마일스톤 엔진 규칙은 tests/milestone.test.ts, 금지어·구어체 점검은 tests/eventLint.test.ts가 본다.
 */
const ev = (id: string): EventDef => {
  const e = EVENT_POOL.byId.get(id);
  if (e === undefined) throw new Error(`이벤트가 없다: ${id}`);
  return e;
};
const NEW = M7A_NEW_EVENT_IDS.map(ev);
const LIVES = 1000;

describe('목록: 신규 28개와 기존 3건의 변경 (docs/data/content-M7a-infant.md 2-1·2-2절, 12절 M-3)', () => {
  it('신규 28개(서술 16 + 선택 12)가 모두 있고, 모두 once:true다', () => {
    expect(M7A_NEW_EVENT_IDS).toHaveLength(28);
    expect(new Set(M7A_NEW_EVENT_IDS).size).toBe(28);
    expect(NEW.filter(isChoiceEvent)).toHaveLength(12);
    expect(NEW.filter((e) => !isChoiceEvent(e))).toHaveLength(16);
    expect(NEW.filter(isChoiceEvent).map((e) => e.id).sort()).toEqual([...M7A_NEW_CHOICE_IDS].sort());
    for (const e of NEW) expect(e.once, e.id).toBe(true);
  });

  it('7세 전용 4개는 school- id로 school.json에 있고(영유아 단계가 아니라 학창 단계, ageRange 7~7), 나머지 24개는 infant.json에 있다', () => {
    const fileOf = (id: string): string => {
      for (const [name, raw] of Object.entries(EVENT_FILES)) {
        const events = (raw as { events: Array<{ id: string }> }).events;
        if (events.some((e) => e.id === id)) return name;
      }
      throw new Error(`${id}가 어느 파일에도 없다`);
    };
    const seven = ['school-first-day', 'school-supplies', 'school-after-hours', 'school-first-walk'];
    for (const id of seven) {
      expect(fileOf(id), id).toBe('./school.json');
      expect(ev(id).stages, id).toEqual(['school']);
      expect(ev(id).ageRange, id).toEqual({ min: 7, max: 7 });
    }
    for (const id of M7A_NEW_EVENT_IDS.filter((x) => !seven.includes(x))) expect(fileOf(id), id).toBe('./infant.json');
    // 옛 id(infant-school-*)는 쓰지 않는다 (M-3)
    for (const old of ['infant-school-entrance', 'infant-school-supplies', 'infant-after-school', 'infant-school-walk']) expect(EVENT_POOL.byId.has(old), old).toBe(false);
    // 6~7세 첫 책은 영유아·학창에 걸친다
    expect(ev('infant-first-book').stages).toEqual(['infant', 'school']);
    expect(ev('infant-first-book').ageRange).toEqual({ min: 6, max: 7 });
  });

  it('기존 영유아 이벤트 11개의 id가 그대로 있다 (id 불변)', () => {
    for (const id of ['infant-first-word', 'infant-care', 'infant-fever', 'infant-stories', 'infant-screen', 'infant-new-sibling', 'infant-village', 'infant-grandparent-song', 'infant-neglect-night', 'infant-hovering', 'infant-free-play']) {
      expect(EVENT_POOL.byId.has(id), id).toBe(true);
    }
  });

  it('기존 3건의 변경: first-word는 마일스톤이고 합쇼체로 다시 써서 이행 목록에서 빠졌다(r2, 뜻 그대로), stories의 tell은 지식 +3 → +2(문구 그대로, 목록에 남음), new-sibling은 2~4세·합쇼체로 새로 써서 이행 목록에서 빠졌다', () => {
    const fw = ev('infant-first-word');
    expect(fw.milestone).toBe(true);
    expect(fw.ageRange).toEqual({ min: 1, max: 1 }); // r3(R-362): 걸음마와 같은 만 1세 해
    expect(fw.text).toBe('아이가 처음으로 낱말 하나를 말했습니다. 곁에 있던 어른들이 한참을 웃었습니다.'); // r3: 「또렷한 말」은 2세 이상의 장면이라 월령 주장 없이 낱말 하나로
    expect(LEGACY_HAERACHE_SET.has('infant-first-word')).toBe(false);
    expect(lintEvent(fw)).toEqual([]); // 합쇼체 · 새 길이 한도 — 같은 해의 다른 마일스톤 줄과 어체가 섞이지 않는다
    const tell = ev('infant-stories').choices!.find((c) => c.id === 'tell')!;
    expect(tell.effects?.stats?.education).toBe(1); // r1 3 → 2, r3 2 → 1 (20세 평균 지식 +2 이하 가드, 마스터 결정 r2-1)
    expect(tell.result).toBe('머리맡에서 지어낸 이야기가 매일 밤 이어졌습니다. 아이는 이야기 속 사람들의 이름을 외웠습니다.'); // r3: 영유아 기존 9개를 합쇼체로 다시 썼다(뜻 그대로)
    expect(LEGACY_HAERACHE_SET.has('infant-stories')).toBe(false);
    const sib = ev('infant-new-sibling');
    expect(sib.ageRange).toEqual({ min: 2, max: 4 });
    expect(sib.conditions).toEqual({ birthOrder: { max: 1 }, motherAge: { max: 45 } });
    expect(sib.choices!.map((c) => c.id)).toEqual(['help', 'sulk', 'grandma', 'notice']); // r3(R-367): 정의 4개, 보이는 것은 늘 3개 — grandma ⇄ notice가 grandparent_close로 배타
    expect(sib.weight).toBe(60); // r2: 동생 맞이를 출생 순서 통계에 맞게 자주 일어나게 한다 (IN4 시험이 비율을 지킨다)
    expect(sib.modifiers).toEqual([{ when: { motherAge: { max: 32 } }, weight: 10 }]);
    expect(LEGACY_HAERACHE_SET.has('infant-new-sibling')).toBe(false);
    expect(lintEvent(sib)).toEqual([]); // 합쇼체 · 새 길이 한도
    for (const c of sib.choices!) expect(c.effects?.setFlags, c.id).toContain('younger_sibling');
    expect(sib.choices!.find((c) => c.id === 'help')!.effects?.setFlags).toContain('sibling_close');
    expect(sib.choices!.find((c) => c.id === 'grandma')!.requires).toEqual({ flags: ['grandparent_close'] });
    expect(sib.choices!.find((c) => c.id === 'grandma')!.effects?.stats?.health).toBe(1); // 지배 쌍 해소: grandma에 건강 +1
    expect(sib.choices!.find((c) => c.id === 'grandma')!.effects?.stats?.relationships).toBe(1); // r3: 관계 +2 → +1 (help·notice와의 균형)
    const help = sib.choices!.find((c) => c.id === 'help')!;
    expect(help.effects?.stats).toEqual({ relationships: 3, happiness: -1 }); // r3(O06): 안기고 싶은 마음을 참는 대가 — 행복 +1 → −1
    expect(help.result).toContain('안기고 싶은 마음은 속으로 참았지만');
    const notice = sib.choices!.find((c) => c.id === 'notice')!;
    expect(notice.label).toBe('일부러 장난을 쳐서 눈길을 끈다');
    expect(notice.requires).toEqual({ notFlags: ['grandparent_close'] });
    expect(notice.effects).toEqual({ stats: { relationships: 2, happiness: -1, health: 1 }, setFlags: ['younger_sibling'] });
    expect(notice.result).toContain('온 집 안을 뛰어다니며'); // R-376: 건강 +1의 이유를 문장에 둔다 (O05) — 효과는 위에서 그대로임을 확인
    expect(sib.choices!.find((c) => c.id === 'sulk')!.result).toContain('서운한 마음을 말로 풀어놓는 법도 조금씩 익혔습니다'); // 지식 +1의 이유 (O05)
  });

  it('r3(R-366): 영유아 기존 9개가 합쇼체로 다시 쓰여 이행 목록에서 빠졌다 — 효과·조건·선택지 id는 그대로이고(예외: infant-care의 childcare_set, village의 「나눠 먹으며」), 7세 단계 줄도 합쇼체다', () => {
    const NINE = ['infant-care', 'infant-fever', 'infant-stories', 'infant-screen', 'infant-village', 'infant-grandparent-song', 'infant-neglect-night', 'infant-hovering', 'infant-free-play'];
    for (const id of NINE) {
      expect(LEGACY_HAERACHE_SET.has(id), id + ': 이행 목록에서 빠졌다').toBe(false);
      expect(lintEvent(ev(id)), id).toEqual([]); // 합쇼체 · 새 길이 한도 · 구어체·금지어·인용 부호 없음
    }
    expect(ev('infant-village').text).toBe('아이는 집집마다 문이 열려 있던 골목에서 이 집 저 집의 밥을 나눠 먹으며 자랐습니다.');
    expect(ev('infant-village').text).not.toContain('얻어먹'); // 가난의 낙인을 뺐다(뜻은 같다)
    expect(STAGE_ENTRY_TEXT.school).toBe('학교에 들어갈 나이가 되었습니다.');
    expect(toneOf(STAGE_ENTRY_TEXT.school)).toBe('hapsyo');
  });

  it('신규 이벤트의 시대·나이·조건·플래그가 문서 2-1절 표와 같다 (대표 항목)', () => {
    const win = (id: string, min: number, max: number) => expect(ev(id).ageRange, id).toEqual({ min, max });
    win('infant-vaccine', 0, 0);
    win('infant-hundred-days', 0, 0);
    win('infant-night-wake', 0, 1);
    win('infant-checkup', 0, 3);
    win('infant-first-steps', 1, 1); // r3: 1~2 → 1~1
    win('infant-parental-leave', 0, 0); // r3: 0~1 → 0~0 (「태어난 첫해」)
    win('infant-talking-toy', 3, 5); // r3: 2~5 → 3~5
    win('infant-first-birthday', 1, 1);
    win('infant-tantrum', 2, 3);
    win('infant-questions', 3, 5);
    win('infant-kindergarten', 3, 4);
    win('infant-sibling-toy', 3, 6);
    win('infant-early-lessons', 5, 6);
    expect(ev('infant-checkup').eras).toEqual(['present', 'future']);
    expect(ev('infant-kindergarten').eras).toEqual(['present', 'future']);
    expect(ev('infant-early-lessons').eras).toEqual(['present', 'future']);
    expect(ev('school-after-hours').eras).toEqual(['present', 'future']);
    expect(ev('infant-vaccine').eras).toBeUndefined();
    expect(ev('infant-follow-sibling').conditions).toEqual({ birthOrder: { min: 2 } });
    expect(ev('infant-sibling-toy').conditions).toEqual({ flags: ['younger_sibling'] });
    expect(ev('infant-night-wake').conditions).toEqual({ parenting: ['free', 'helicopter', 'strict'] });
    expect(ev('infant-moving').conditions).toEqual({ parentWealth: { max: 3 }, housing: ['rent', 'free'] }); // r3(T05): 자가 판에서는 일어나지 않는다
    expect(ev('infant-moving').modifiers).toEqual([{ when: { parentWealth: { max: 2 } }, weight: 1.8 }]);
    expect(ev('infant-noise').conditions).toEqual({ parentWealth: { max: 4 } });
    // 켜는 플래그: 어린이집 대기의 조부모 선택은 grandparent_close(동생 맞이의 「조부모님 품」과 이어진다)
    expect(ev('infant-daycare-wait').choices!.find((c) => c.id === 'grandparents')!.effects?.setFlags).toEqual(['grandparent_close', 'childcare_set']); // r3: 맡김을 정한 선택은 childcare_set도 켠다
    expect(ev('infant-care').conditions).toEqual({ notFlags: ['childcare_set'] });
    expect(ev('infant-daycare-wait').conditions).toEqual({ notFlags: ['childcare_set'] });
  });
});

describe('IN1 규모: 0~7세 각 나이 × 각 시대의 정적 후보 ≥ 4, 시대별 ≥ 25 (나이 기준 집계 — 마스터 결정 M-3)', () => {
  it('정적 후보 표가 문서 2-3절과 같다 (단계·ageRange·eras만 본다)', () => {
    const table = Array.from({ length: INFANT_LAST_AGE + 1 }, (_, a) => ERAS.map((e) => possibleEventsAt(a, e)));
    expect(table).toEqual([
      [4, 6, 6], // 0세
      [13, 13, 13], // r3: 걸음마·첫 말·육아휴직이 1세·0세로 모여 1~2세·3세·1세 후보가 줄었다(문서 13-3·13-11)
      [13, 14, 14],
      [17, 18, 19],
      [16, 16, 17],
      [15, 15, 16],
      [11, 12, 12],
      [4, 4, 4], // 7세
    ]);
    for (const row of table) for (const n of row) expect(n).toBeGreaterThanOrEqual(4);
  });

  it('시대별로 0~7세 어느 한 해에 일어날 수 있는 이벤트가 28 / 32 / 32개(≥ 25)이고, 나이 기준 영유아 이벤트가 총 39개(서술 22·선택 17)다', () => {
    const idsOf = (era: (typeof ERAS)[number]) => {
      const ids = new Set<string>();
      for (let a = 0; a <= INFANT_LAST_AGE; a++) {
        for (const e of EVENT_POOL.events) {
          if (!e.stages.includes(stageOfAge(a))) continue;
          if (e.ageRange?.min !== undefined && a < e.ageRange.min) continue;
          if (e.ageRange?.max !== undefined && a > e.ageRange.max) continue;
          if (e.eras && !e.eras.includes(era)) continue;
          ids.add(e.id);
        }
      }
      return ids;
    };
    expect(ERAS.map((era) => idsOf(era).size)).toEqual([28, 32, 32]);
    const all = new Set(ERAS.flatMap((era) => [...idsOf(era)]));
    expect(all.size).toBe(39);
    const evs = [...all].map(ev);
    expect(evs.filter(isChoiceEvent)).toHaveLength(17);
    expect(evs.filter((e) => !isChoiceEvent(e))).toHaveLength(22);
  });

  it('선택지 이벤트마다 조건(requires) 없는 선택지가 2개 이상이다 (재력이 낮아도 늘 고를 길이가 있다)', () => {
    for (const e of NEW.filter(isChoiceEvent)) expect(e.choices!.filter((c) => c.requires === undefined).length, e.id).toBeGreaterThanOrEqual(2);
  });
});

describe(`IN2 사건 없는 해·기록 줄·선택지 (시대별 ${LIVES}판, 0~7세 여덟 해, 1차 목표: 빈 해 평균 ≤ 1.5·최대 ≤ 4 / 줄 평균 ≥ 9 / 선택지 평균 ≥ 2.8)`, () => {
  for (const strategy of ['auto', 'random'] as const) {
    it(`${strategy}: 세 시대 모두 1차 목표를 넘는다`, () => {
      for (const era of ERAS) {
        const s = summarizeInfant(infantLives(era, LIVES, strategy));
        expect(s.emptyMean, `${era} 빈 해 평균`).toBeLessThanOrEqual(1.5);
        expect(s.emptyMax, `${era} 빈 해 최대`).toBeLessThanOrEqual(4);
        expect(s.linesMean, `${era} 기록 줄 평균(출생 줄 제외)`).toBeGreaterThanOrEqual(9);
        expect(s.choicesMean, `${era} 판당 선택지 평균(0~7세)`).toBeGreaterThanOrEqual(2.8);
        // 한 해 두 줄(마일스톤 + 일반 사건)이 실제로 생긴다
        expect(s.doubleYearsMean, `${era} 한 해 두 줄이 생기는 해`).toBeGreaterThan(1);
      }
    });
  }

  it('선택지 간격 2년 규칙은 그대로다: 0~7세의 선택지는 최대 4개이고 같은 판에서 연속한 두 해에 결정 카드가 뜨지 않는다', () => {
    for (const era of ERAS) {
      for (const l of infantLives(era, 300, 'random')) {
        expect(l.choices, `${era} seed ${l.seed}`).toBeLessThanOrEqual(4);
        const ages = l.final.history.filter((h) => h.kind === 'choice' && h.age <= INFANT_LAST_AGE).map((h) => h.age);
        for (let i = 1; i < ages.length; i++) expect(ages[i] - ages[i - 1], `${era} seed ${l.seed}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('IN4 동생 맞이 (BR6): 첫째 판에서만, 2~4세, 후속 장난감은 동생이 생긴 판에서만', () => {
  const lives = ERAS.flatMap((era) => infantLives(era, 2000, 'random'));
  const orderOf = (l: InfantLife): number => l.final.birthReport!.birthOrder;

  it('첫째 판 중 동생이 생기는 비율이 출생 순서 통계에 맞는다 (r2, 마스터 결정 2): 지금 세상 45~55% · 다가올 세상 45~55% · 지난 세상 70~85%', () => {
    // 근거: 전국 출산 순위 비중 [첫째 62.4, 둘째 31.2, 셋째 이상 6.4]%(birthStats 전국) — 첫째 중 동생이 생기는 비율 ≈ 둘째 ÷ 첫째 = 50%. 다가올 세상 [66, 28, 6]은 42%, 지난 세상 [26, 26, 48]은 100%지만
    // 동생이 2~4세에 태어나야 하는 창과 어머니 나이 상한 때문에 지난 세상은 70~85%를 목표로 둔 설계값이다(마스터가 정한 목표 범위). 구현: infant-new-sibling 가중치 60 + 어머니 32세 이하 ×10(젊은 어머니일수록 형제가 많다)
    const band: Record<string, [number, number]> = { past: [70, 85], present: [45, 55], future: [45, 55] };
    for (const era of ERAS) {
      const firsts = lives.filter((l) => l.era === era && orderOf(l) === 1 && l.deathAge === null);
      expect(firsts.length, `${era} 첫째 판 표본`).toBeGreaterThan(300);
      const pct = (100 * firsts.filter((l) => l.seen['infant-new-sibling'] !== undefined).length) / firsts.length;
      expect(pct, `${era} 첫째 판 중 동생이 생긴 비율 ${pct.toFixed(1)}%`).toBeGreaterThanOrEqual(band[era][0]);
      expect(pct, `${era} 첫째 판 중 동생이 생긴 비율 ${pct.toFixed(1)}%`).toBeLessThanOrEqual(band[era][1]);
    }
  });

  it('infant-new-sibling은 birthOrder ≥ 2인 판에서 0건이고, 첫째 판에서는 일어난다 (일어난 나이는 2~4세)', () => {
    const later = lives.filter((l) => orderOf(l) >= 2);
    const firsts = lives.filter((l) => orderOf(l) === 1);
    expect(later.length).toBeGreaterThan(1500);
    expect(firsts.length).toBeGreaterThan(1000);
    expect(later.filter((l) => l.seen['infant-new-sibling'] !== undefined).map((l) => l.seed)).toEqual([]);
    const happened = firsts.filter((l) => l.seen['infant-new-sibling'] !== undefined);
    expect(happened.length, '첫째 판에서 일어난 수').toBeGreaterThan(100);
    for (const l of happened) {
      expect(l.seen['infant-new-sibling']).toBeGreaterThanOrEqual(2);
      expect(l.seen['infant-new-sibling']).toBeLessThanOrEqual(4);
    }
  });

  it('infant-sibling-toy는 younger_sibling 플래그가 없는 판에서 0건이다 · 플래그는 동생 맞이를 겪은 판에만 있다 (둘이 늘 같다)', () => {
    let toy = 0;
    for (const l of lives) {
      const flagged = l.final.flags.includes('younger_sibling');
      expect(flagged, `${l.era} seed ${l.seed}: 플래그 ⇔ 동생 맞이`).toBe(l.seen['infant-new-sibling'] !== undefined);
      if (l.seen['infant-sibling-toy'] !== undefined) {
        toy++;
        expect(flagged, `${l.era} seed ${l.seed}: 장난감은 동생이 있는 판에서만`).toBe(true);
        expect(l.seen['infant-sibling-toy'], `${l.era} seed ${l.seed}`).toBeGreaterThan(l.seen['infant-new-sibling']); // 동생이 생긴 뒤에
      }
    }
    expect(toy, '공허 통과 방지: 장난감 이벤트가 일어난 판').toBeGreaterThan(20);
  });

  it('infant-follow-sibling(둘째 이상)은 첫째 판에서 0건이고, 둘째 이상 판에서는 일어난다', () => {
    const firstsWith = lives.filter((l) => orderOf(l) === 1 && l.seen['infant-follow-sibling'] !== undefined);
    expect(firstsWith).toEqual([]);
    expect(lives.filter((l) => orderOf(l) >= 2 && l.seen['infant-follow-sibling'] !== undefined).length).toBeGreaterThan(100);
  });

  it('가족 표시와 맞는다: 동생이 생긴 판의 가족에 아래 동생이 있고, 나이 차가 그 사건이 일어난 나이(2~4)다 — 사건이 없으면 아래 동생도 없다', () => {
    let checked = 0;
    for (const l of lives.slice(0, 1500)) {
      const fam = familyOf(l.final);
      const younger = fam.siblings.filter((s) => !s.older);
      const at = l.seen['infant-new-sibling'];
      if (at === undefined) {
        expect(younger, `${l.era} seed ${l.seed}`).toEqual([]);
      } else {
        expect(younger, `${l.era} seed ${l.seed}`).toHaveLength(1);
        expect(younger[0].gap).toBe(at);
        expect(younger[0].age).toBe(Math.max(0, l.final.age - at));
        checked++;
      }
    }
    expect(checked, '공허 통과 방지').toBeGreaterThan(30);
  });

  it('infant-new-sibling의 어머니 나이 상한(45세)은 새 나이(2~4세)에서도 지켜진다', () => {
    for (const l of lives) {
      const at = l.seen['infant-new-sibling'];
      if (at === undefined) continue;
      expect(l.final.birthReport!.mother.age + at, `${l.era} seed ${l.seed}`).toBeLessThanOrEqual(45);
    }
  });
});

describe('IN6 시대 정합: 시대 전용 이벤트 각 3개 이상, 시대에 어긋난 소재는 금지어 점검이 잡는다 (금지어 시험은 tests/eventLint.test.ts)', () => {
  it('시대 전용 신규 영유아·7세 이벤트가 지난 3 · 지금 3 · 다가올 3개이고 eras가 정확히 그 시대 하나다', () => {
    for (const era of ERAS) {
      expect(M7A_ERA_ONLY[era], era).toHaveLength(3);
      for (const id of M7A_ERA_ONLY[era]) expect(ev(id).eras, id).toEqual([era]);
    }
    // 지난 세상의 기존 시대 전용 `infant-village`를 합치면 4개
    expect(ev('infant-village').eras).toEqual(['past']);
    // 시대 전용 목록 밖의 신규 이벤트 중 eras가 하나뿐인 것은 없다
    const listed = new Set<string>(ERAS.flatMap((era) => [...M7A_ERA_ONLY[era]]));
    for (const e of NEW) if (!listed.has(e.id)) expect(e.eras === undefined || e.eras.length >= 2, e.id).toBe(true);
  });

  it('세 시대 판에서 시대 전용 이벤트는 그 시대에서만 일어난다 (1000판)', () => {
    for (const era of ERAS) {
      const lives = infantLives(era, 500, 'random');
      const happened = new Set(lives.flatMap((l) => Object.keys(l.seen)));
      for (const other of ERAS.filter((x) => x !== era)) for (const id of M7A_ERA_ONLY[other]) expect(happened.has(id), `${era}에서 ${other} 전용 ${id}`).toBe(false);
      for (const id of M7A_ERA_ONLY[era]) expect(happened.has(id), `${era}에서 자기 전용 ${id}가 한 번도 없다`).toBe(true);
    }
  });
});

describe('IN7 수저에 따른 차이: 재력 단계에 따라 보이는 선택지·결과가 다른 영유아 이벤트 ≥ 8, 재력 1~2 판과 4~5 판의 선택지 구성이 다르다', () => {
  const hasWealth = (c: Condition | undefined) => c?.parentWealth !== undefined;
  const choiceGate = (e: EventDef) => (e.choices ?? []).some((c) => hasWealth(c.requires));
  const anyDevice = (e: EventDef) =>
    hasWealth(e.conditions) ||
    (e.modifiers ?? []).some((m) => hasWealth(m.when)) ||
    (e.bonuses ?? []).some((b) => hasWealth(b.when)) ||
    (e.choices ?? []).some((c) => hasWealth(c.requires) || (c.bonuses ?? []).some((b) => hasWealth(b.when)));
  const infantAged = EVENT_POOL.events.filter((e) => (e.ageRange?.min ?? 0) <= INFANT_LAST_AGE && (e.stages.includes('infant') || e.ageRange?.min === 7));

  it('선택지가 재력으로 닫히고 열리는 영유아·7세 이벤트가 12개(신규 10 + 기존 care·stories)이고, 신규 10개의 문턱은 부모 재력 3~4 이상이다', () => {
    const gated = infantAged.filter(choiceGate).map((e) => e.id);
    expect(gated.length).toBeGreaterThanOrEqual(8);
    expect([...gated].sort()).toEqual([...M7A_WEALTH_GATES.map(([id]) => id), 'infant-care', 'infant-stories'].sort());
    for (const [id, choice] of M7A_WEALTH_GATES) {
      const min = ev(id).choices!.find((c) => c.id === choice)!.requires?.parentWealth?.min;
      expect(min, `${id}/${choice}`).toBeGreaterThanOrEqual(3);
      expect(min, `${id}/${choice}`).toBeLessThanOrEqual(4);
    }
  });

  it('재력 장치(문턱·보너스·조건·가중치)가 있는 영유아·7세 이벤트는 13개 이상이다 (신규 10 + 기존 care·stories·fever, 서사 의도 G3)', () => {
    const withDevice = infantAged.filter(anyDevice).map((e) => e.id);
    expect(withDevice.length).toBeGreaterThanOrEqual(13);
    for (const id of ['infant-care', 'infant-stories', 'infant-fever', ...M7A_WEALTH_GATES.map(([e]) => e)]) expect(withDevice, id).toContain(id);
  });

  it('시뮬레이션: 재력 4~5단계 판만 문턱 선택지(영어 유치원·독립 병실 …)를 보고, 1~2단계 판은 한 번도 보지 못한다', () => {
    const lives = ERAS.flatMap((era) => infantLives(era, 1500, 'random'));
    const low = lives.filter((l) => l.final.character!.parentWealth <= 2);
    const high = lives.filter((l) => l.final.character!.parentWealth >= 4);
    expect(low.length).toBeGreaterThan(2000);
    expect(high.length).toBeGreaterThan(400);
    const sawGate = (l: InfantLife, id: string, choice: string) => (l.shown[id] ?? []).includes(choice);
    let observed = 0;
    for (const [id, choice] of M7A_WEALTH_GATES) {
      const min = ev(id).choices!.find((c) => c.id === choice)!.requires!.parentWealth!.min!;
      const below = lives.filter((l) => l.final.character!.parentWealth < min && sawGate(l, id, choice));
      expect(below.map((l) => `${l.era}/${l.seed}`), `${id}/${choice}: 문턱 아래 판에서 보이면 안 된다`).toEqual([]);
      if (high.some((l) => sawGate(l, id, choice))) observed++;
    }
    // 4~5단계 판에서 문턱 선택지가 실제로 보인 이벤트 수 (이벤트마다 조건·나이·시대라 모든 이벤트가 한 번씩 보이지는 않는다)
    expect(observed, '4~5단계 판이 문턱 선택지를 본 이벤트 수').toBeGreaterThanOrEqual(8);
    // 선택지 구성 차이: 결정 카드 하나당 보이는 선택지 수의 평균이 높은 재력이 더 많다
    const meanShown = (ls: InfantLife[]) => {
      const counts = ls.flatMap((l) => Object.values(l.shown).map((ids) => ids.length));
      return counts.reduce((a, b) => a + b, 0) / counts.length;
    };
    expect(meanShown(high), '재력 4~5단계: 결정 카드당 보이는 선택지').toBeGreaterThan(meanShown(low) + 0.1);
  });
});

describe('IN8 규칙 계승: 합쇼체 · 3인칭 「아이」 · 담담한 어조 · 금액·통계 숫자 없음 · 수위', () => {
  it('신규 28개는 문구 점검(합쇼체·새 길이 한도·구어체·시대 금지어·3인칭)을 통과한다 (목록 밖이라 해라체는 걸린다)', () => {
    for (const e of NEW) {
      expect(LEGACY_HAERACHE_SET.has(e.id), `${e.id}: 이행 목록에 없다`).toBe(false);
      expect(lintEvent(e), e.id).toEqual([]);
    }
  });

  it('문장에 금액·통계 숫자가 없다 (숫자는 인용 박스의 몫) · 부정적인 소재(사별·이혼·학대·자해·폭력)를 쓰지 않는다 (안 할 것)', () => {
    const banned = /사별|이혼|학대|자살|자해|폭력|세상을 떠|사망|병원비|만 원|%/;
    for (const e of NEW) {
      for (const part of textPartsOf(e)) {
        expect(part.value, part.where).not.toMatch(/[0-9]/);
        expect(part.value, part.where).not.toMatch(banned);
      }
    }
  });

  it('주어는 「아이」(영유아 이벤트는 1인칭 「나·내」가 없다) · 느낌표·물음표·이모지가 없다', () => {
    for (const e of NEW) {
      for (const part of textPartsOf(e)) {
        expect(part.value, part.where).not.toMatch(/[!?！？\u{1F300}-\u{1FAFF}]/u);
        expect(part.value, part.where).not.toMatch(/(?:^|[\s,.])(?:나는|나의|나도|나를|나에게|내가|내|저는|제가)(?=[\s,.]|$)/);
      }
    }
  });

  it('핵심 문장 몇 개를 문서 3절 그대로 옮겼다 (문안 대조)', () => {
    expect(ev('infant-vaccine').text).toBe('첫 예방 주사를 맞던 날, 아이는 크게 울었습니다. 어른들은 아이를 안아 달랜 뒤 집으로 돌아왔습니다.');
    expect(ev('infant-first-steps').text).toBe('아이가 붙잡고 서더니 처음으로 혼자 몇 걸음을 걸었습니다. 모두가 숨을 죽였습니다.');
    expect(ev('school-supplies').choices!.find((c) => c.id === 'handed')!.result).toBe('이웃이나 친척이 쓰던 것을 물려받았습니다. 아이는 지워진 이름 자리를 한참 만져 보았습니다.'); // M-10: 그대로
    expect(ev('infant-sibling-toy').choices!.find((c) => c.id === 'take')!.label).toBe('동생 손의 장난감을 가져가 숨긴다'); // M-6: 「해코지」 낱말 없음
    for (const e of NEW) for (const part of textPartsOf(e)) expect(part.value, part.where).not.toContain('해코지');
  });
});

describe('선택지 효과의 방향 (E11 소극적 선택에 작은 이득): 돈을 아끼는 쪽(family +)이 있고, 큰돈이 드는 선택은 재력 문턱 뒤에 있다', () => {
  it('신규 선택지 이벤트의 family 효과 범위가 −900 ~ +300이고, 큰 지출(−600 이하)은 모두 재력 문턱이 있는 선택지이거나 같은 이벤트의 한 선택뿐이다', () => {
    for (const e of NEW.filter(isChoiceEvent)) {
      for (const c of e.choices!) {
        const family = c.effects?.family ?? 0;
        expect(family, `${e.id}/${c.id}`).toBeGreaterThanOrEqual(-900);
        expect(family, `${e.id}/${c.id}`).toBeLessThanOrEqual(300);
        if (family <= -900) expect(c.requires?.parentWealth?.min, `${e.id}/${c.id}`).toBeGreaterThanOrEqual(4);
      }
    }
  });
});

describe('r2: 영유아 콘텐츠가 스탯을 크게 올리지 않는다 (마스터 결정 1): 8세 평균 스탯이 HEAD(M7a 이전) 대비 항목마다 +2 이하, 관계만 +3 이하', () => {
  /**
   * M7a 이전(브랜치 spec-003의 HEAD 5fa0c54, M7a 변경 전)에서 같은 시드(i × 7919 + 13) 1500판을 무작위 선택으로 0~7세까지 돌려 8세가 된 순간 살아 있는 판의 스탯 평균을 잰 값 — 지식·건강·행복·관계 순서.
   * 영유아기 이후의 이벤트는 M7a에서 바뀌지 않아 20세 평균 스탯의 변화는 8세 시점의 변화와 거의 같다(측정, 3000판: 20세 변화 지난 +1.0·+1.4·+1.8·+2.7 / 지금 +1.8·+1.7·+1.7·+2.5 / 다가올 +1.5·+0.9·+1.8·+0.8, 8세 변화 1500판은 아래 시험이 지킨다).
   * 새 영유아 콘텐츠의 양수 효과가 늘면(경제 재보정이 다시 필요해진다) 이 시험이 알려 준다 — 옛 값을 고쳐 맞추지 말고 효과를 줄이거나 마스터에게 보고한다.
   */
  const HEAD_AT_8: Record<string, [number, number, number, number]> = {
    past: [15.58, 70.58, 43.68, 51.29],
    present: [16.54, 71.2, 48.14, 53.42],
    future: [16.51, 71.26, 48.8, 54.13],
  };
  const LIMIT = [2, 2, 2, 3];
  const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

  for (const era of ERAS) {
    it(`${era}: 지식·건강·행복 +2 이하, 관계 +3 이하 (1500판)`, () => {
      const alive = infantLives(era, 1500, 'random').filter((l) => l.deathAge === null);
      const now = [
        mean(alive.map((l) => l.final.stats.education)),
        mean(alive.map((l) => l.final.stats.health)),
        mean(alive.map((l) => l.final.stats.happiness)),
        mean(alive.map((l) => l.final.stats.relationships)),
      ];
      const names = ['지식', '건강', '행복', '관계'];
      now.forEach((v, i) => expect(v - HEAD_AT_8[era][i], `${era} ${names[i]} 변화 ${(v - HEAD_AT_8[era][i]).toFixed(2)}`).toBeLessThanOrEqual(LIMIT[i]));
    });
  }
});

describe('r3 T04 (QA-003-M7a): 재력 조건 없이 모든 단계에 보이는 문장에는 형편(빠듯·숨통·겨우·만만치·형편이 어려·넉넉하지) 낱말이 없다', () => {
  // 13-1: 인생 기록 첫 줄(출생)이 「아주 넉넉한 가정에서 태어났습니다」인 판에서 「살림은 빠듯해졌습니다」가 읽히는 모순을 막는다.
  // 규칙: 영유아·7세 이벤트의 본문·결과·라벨에 아래 낱말이 있으면, 그 이벤트(conditions) 또는 그 선택지(requires)가 재력 3 이하로 막혀 있어야 한다 — 재력 4·5단계 판이 볼 수 있는 문장에는 없다.
  const STATUS = /빠듯|숨통|겨우|만만치|형편이 어려|넉넉하지/;
  const infantAged = EVENT_POOL.events.filter((e) => (e.ageRange?.max ?? 99) <= 7 || e.stages.includes('infant'));
  const cap = (c: Condition | undefined): number => c?.parentWealth?.max ?? 5;

  it('영유아·7세 이벤트 전체: 형편 낱말은 재력 3 이하에게만 보이는 문장(이벤트 조건 parentWealth.max ≤ 3 또는 선택지 requires.parentWealth.max ≤ 3)에만 있다', () => {
    let checked = 0;
    for (const e of infantAged) {
      for (const part of textPartsOf(e)) {
        checked++;
        if (!STATUS.test(part.value)) continue;
        const choiceId = /choices\[\d+\]\((.+?)\)/.exec(part.where)?.[1];
        const c = choiceId === undefined ? undefined : e.choices!.find((x) => x.id === choiceId);
        const reach = Math.min(cap(e.conditions), cap(c?.requires));
        expect(reach, `${part.where}: 「${part.value}」은 재력 4·5단계에도 보인다`).toBeLessThanOrEqual(3);
      }
    }
    expect(checked, '센 문장 수(공허 통과 방지)').toBeGreaterThan(150);
  });

  it('13-1이 고친 다섯 곳의 새 문장: 육아휴직 one·back · 유치원 home · 소음 move · 이삿짐 near — 형편 낱말이 없고 벌이·돈과 품이라는 사실만 쓴다', () => {
    const result = (id: string, cid: string) => ev(id).choices!.find((c) => c.id === cid)!.result;
    expect(result('infant-parental-leave', 'one')).toBe('한 사람이 일을 쉬고 아이 곁을 지켰습니다. 아이의 하루는 일정했고 집안의 벌이는 줄었습니다.');
    expect(result('infant-parental-leave', 'back')).toBe('일터로 일찍 돌아가고 아이는 다른 이의 손에 맡겨졌습니다. 벌이는 끊기지 않았습니다.');
    expect(result('infant-kindergarten', 'home')).toBe('한 사람이 곁에서 아이와 하루를 보냈습니다. 놀이와 낮잠이 느긋하게 이어졌고 돌보는 사람의 벌이는 줄었습니다.');
    expect(result('infant-noise', 'move')).toBe('아이가 마음껏 뛸 수 있는 집을 찾아 옮겼습니다. 이사에는 돈과 품이 들었습니다.');
    expect(result('infant-moving', 'near')).toBe('근처에서 새 집을 구했습니다. 친구들과 같은 골목을 오가는 날이 이어졌습니다.');
    for (const [id, cid] of [['infant-parental-leave', 'one'], ['infant-parental-leave', 'back'], ['infant-kindergarten', 'home'], ['infant-noise', 'move']] as const) expect(result(id, cid)).not.toMatch(STATUS);
  });

  it('대조: 옛 문장(「집안 살림은 빠듯해졌습니다」)은 이 규칙에 걸린다 — 위 단언이 공허하지 않다', () => {
    expect(STATUS.test('아이의 하루는 일정했지만 집안 살림은 빠듯해졌습니다.')).toBe(true);
    expect(STATUS.test('살림은 한결 숨통이 트였습니다.')).toBe(true);
    expect(STATUS.test('근처에서 새 집을 겨우 구했습니다.')).toBe(true);
  });

  it('시뮬레이션: 재력 4·5단계 판이 본 영유아 문장 중 형편 낱말이 있는 것은 0건이다 (세 시대 × 1500판 연표)', () => {
    const lives = ERAS.flatMap((era) => infantLives(era, 1500, 'random')).filter((l) => l.final.character!.parentWealth >= 4);
    expect(lives.length, '재력 4·5단계 판').toBeGreaterThan(300);
    let lines = 0;
    for (const l of lives) {
      for (const h of l.final.history) {
        if (h.age > INFANT_LAST_AGE) continue;
        lines++;
        expect(h.text, `${l.era}/${l.seed} ${h.age}세 「${h.text}」`).not.toMatch(STATUS);
      }
    }
    expect(lines, '센 연표 줄(공허 통과 방지)').toBeGreaterThan(2000);
  });
});

describe('r3 R-362: 걸음마·첫 말은 모든 판의 만 1세 해에 일어나고, 한 해 세 줄이 연표에 순서대로 남는다', () => {
  it('세 시대 × 1000판: 사망하지 않은 모든 판에서 첫 걸음마·첫 말이 1세(100%)이고, 같은 해 연표는 걸음마 → 첫 말(id 오름차순)이다', () => {
    for (const era of ERAS) {
      const alive = infantLives(era, 1000, 'random').filter((l) => l.deathAge === null || l.deathAge >= 1);
      expect(alive.length).toBeGreaterThan(990);
      let threeLines = 0;
      for (const l of alive) {
        expect(l.seen['infant-first-steps'], `${era}/${l.seed} 걸음마 나이`).toBe(1);
        expect(l.seen['infant-first-word'], `${era}/${l.seed} 첫 말 나이`).toBe(1);
        const ids = l.final.history.filter((h) => h.age === 1 && h.eventId !== undefined).map((h) => h.eventId);
        expect(ids.indexOf('infant-first-steps'), `${era}/${l.seed}: 걸음마가 첫 말보다 먼저`).toBeLessThan(ids.indexOf('infant-first-word'));
        const rows = l.final.history.filter((h) => h.age === 1 && (h.kind === 'event' || h.kind === 'choice'));
        if (rows.length >= 3) threeLines++;
      }
      // 1세에 걸음마 + 첫 말 + 일반 사건(서술·선택 결과)이 모두 남은 판이 실제로 있다(한 해 세 줄 이상)
      expect(threeLines / alive.length, `${era}: 1세 연표가 세 줄 이상인 판의 비율`).toBeGreaterThan(0.5);
    }
  });
});

describe('r3 R-367·O06: 동생 맞이는 어떤 판에서도 선택지 3개가 보이고, 조부모 플래그가 없으면 「눈길 끌기(notice)」가 보인다', () => {
  const lives = ERAS.flatMap((era) => infantLives(era, 2000, 'random'));
  const sibCards = lives.filter((l) => l.shown['infant-new-sibling'] !== undefined);

  it('동생 맞이 카드가 뜬 모든 판에서 보인 선택지가 정확히 3개다 (플래그 있음 help·sulk·grandma / 없음 help·sulk·notice)', () => {
    expect(sibCards.length, '동생 맞이 카드가 뜬 판').toBeGreaterThan(1000);
    for (const l of sibCards) {
      const shown = l.shown['infant-new-sibling'];
      expect(shown, `${l.era}/${l.seed}`).toHaveLength(3);
      expect(shown.slice(0, 2), `${l.era}/${l.seed}`).toEqual(['help', 'sulk']);
      const hasFlagThen = shown[2] === 'grandma';
      expect(['grandma', 'notice'], `${l.era}/${l.seed}`).toContain(shown[2]);
      // 조부모 품(grandma)이 보였다면 그때 grandparent_close가 있었다 — 이 플래그는 한 번 켜지면 꺼지지 않으므로 마지막 상태에도 남아 있다
      if (hasFlagThen) expect(l.final.flags, `${l.era}/${l.seed}: grandma가 보였으면 조부모 플래그가 있었다`).toContain('grandparent_close');
    }
    const notice = sibCards.filter((l) => l.shown['infant-new-sibling'][2] === 'notice').length;
    const grandma = sibCards.length - notice;
    expect(notice / sibCards.length, '눈길 끌기가 보인 카드의 비율').toBeGreaterThan(0.5); // 조부모 플래그가 없는 판이 더 많다
    expect(grandma / sibCards.length, '조부모 품이 보인 카드의 비율').toBeGreaterThan(0.02);
  });

  it('IN4 한 반응을 정답으로 두지 않는다: 네 반응(돌보기·서운함·관심 끌기·안정 기지) 모두 실제로 골라질 수 있고, 어느 두 선택지도 한쪽이 모든 항목에서 낫지 않다', () => {
    const sib = ev('infant-new-sibling');
    expect(sib.choices!.map((c) => c.id)).toEqual(['help', 'sulk', 'grandma', 'notice']);
    const vec = (id: string) => {
      const st = sib.choices!.find((c) => c.id === id)!.effects!.stats!;
      return { rel: st.relationships ?? 0, hap: st.happiness ?? 0, hea: st.health ?? 0, edu: st.education ?? 0 };
    };
    const ids = ['help', 'sulk', 'grandma', 'notice'];
    for (const a of ids) {
      for (const b of ids) {
        if (a === b) continue;
        const x = vec(a);
        const y = vec(b);
        const dominates = (['rel', 'hap', 'hea', 'edu'] as const).every((k) => x[k] >= y[k]) && (['rel', 'hap', 'hea', 'edu'] as const).some((k) => x[k] > y[k]);
        expect(dominates, `${a}가 ${b}를 모든 항목에서 이긴다`).toBe(false);
      }
    }
  });

  it('동생 맞이 선택 뒤에는 어느 반응이든 younger_sibling이 켜져 장난감 이벤트가 열린다 (notice 포함)', () => {
    for (const c of ev('infant-new-sibling').choices!) expect(c.effects?.setFlags, c.id).toContain('younger_sibling');
  });
});
