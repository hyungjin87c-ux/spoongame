// 공격 #8 저장 변조 (localStorage 값 주입 → 로드). 어떤 경우에도 흰 화면·무한 로딩·오류 화면·미처리 예외가 없어야 한다.
import fs from 'node:fs';
import path from 'node:path';
import { DEV, GAME_KEY, SETTINGS_KEY, RES_DIR, launch, mkctx, runCase, shot, snap, toLife, waitScreen, readSave, readSettings, readRaw, sleep, con } from './f-compat.mjs';

const G = 'a-tamper';
const golden = JSON.parse(fs.readFileSync(path.join(RES_DIR, 'golden.json'), 'utf8'));
const LIFE = JSON.parse(golden.lifeChoice); // life + pending
const ENDING = JSON.parse(golden.ending);
const BIRTH = JSON.parse(golden.birth);
const clone = (o) => JSON.parse(JSON.stringify(o));
const mut = (base, fn) => {
  const o = clone(base);
  fn(o.data, o);
  return JSON.stringify(o);
};
const browser = await launch();
let n = 47; // A47부터
const only = process.argv[2];
const aId = () => `F-AM${String(n++).padStart(2, '0')}`;
const curId = () => `F-AM${String(n - 1).padStart(2, '0')}`;

/** 저장소를 앱이 뜨기 전에 채워서 로드. 반환: 스냅샷·예외 */
async function loadWith({ game = null, settings = null, vp = [360, 740], wait = 1100, query = '', xss = true }) {
  const ctx = await mkctx(browser, { viewport: { width: vp[0], height: vp[1] } });
  const page = await ctx.newPage();
  await page.addInitScript(([gk, g, sk, s]) => {
    if (g !== null) localStorage.setItem(gk, g);
    if (s !== null) localStorage.setItem(sk, s);
    window.__xss = 0;
    window.alert = () => { window.__xss++; };
  }, [GAME_KEY, game, SETTINGS_KEY, settings]);
  const t0 = Date.now();
  await page.goto(DEV + '/' + query);
  await page.waitForSelector('main[data-testid], #root:empty', { timeout: 8000 }).catch(() => {});
  await sleep(wait);
  const s = await snap(page);
  const xssN = await page.evaluate(() => window.__xss).catch(() => -1);
  const injected = await page.evaluate(() => document.querySelectorAll('#root img, #root svg, #root script, #root iframe, #root b, #root i').length).catch(() => -1);
  const stored = await readRaw(page).catch(() => null);
  return { ctx, page, s, xssN, injected, stored, ms: Date.now() - t0 };
}
const isNew = (s) => s.screen === 'title-screen';
const isBad = (s) => ['error-screen', 'BLANK', 'unknown', 'superseded-screen'].includes(s.screen);

/** variants: [{label, game?, settings?, expect:'reject'|'accept'|'any'}] */
async function tamperCase(title, steps, variants, expected, mkShotFor = 0) {
  return runCase(G, { id: aId(), cat: '#8 저장 변조', title, steps, expected: expected || '손상·구버전·이상값 저장은 크래시 없이 새 게임(타이틀)으로 시작. 흰 화면·오류 화면·미처리 예외 없음' }, async () => {
    const fails = [];
    const rows = [];
    let sh = null;
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const before = con.take(); // 이전 변형의 잔여 콘솔 비움(기록은 케이스 전체로 합산하려고 되돌려 넣는다)
      con.items.push(...before);
      const r = await loadWith(v);
      const ex = v.expect || 'reject';
      let f = null;
      if (isBad(r.s)) f = `${r.s.screen}`;
      else if (ex === 'stale' && (r.s.screen !== 'life-screen' || r.s.hasChoice || !r.s.name)) f = `대기만 풀고 같은 인생으로 이어가야 하는데 ${r.s.screen} 선택지=${r.s.hasChoice}`;
      else if (ex === 'reject' && !isNew(r.s)) f = `거부돼야 하는데 ${r.s.screen}로 열림 (${r.s.name || ''} ${r.s.age || ''})`;
      else if (ex === 'accept' && isNew(r.s)) f = `허용돼야 하는데 새 게임으로 시작`;
      if (r.xssN > 0) f = (f ? f + '; ' : '') + `alert 실행 ${r.xssN}회`;
      if (r.injected > 0 && v.checkInject) f = (f ? f + '; ' : '') + `DOM에 태그 주입 ${r.injected}개`;
      if (v.after) {
        const extra = await v.after(r);
        if (extra) f = (f ? f + '; ' : '') + extra;
      }
      // 앱이 다시 쓴 저장이 유효한 JSON인가
      if (r.stored !== null) {
        try { JSON.parse(r.stored); } catch { f = (f ? f + '; ' : '') + '저장소에 깨진 JSON이 남음'; }
      }
      rows.push(`${v.label}→${r.s.screen}${r.s.name ? '(' + String(r.s.name).slice(0, 14) + ')' : ''}${f ? ' ✗' + f : ''}`);
      if (f) fails.push(`${v.label}: ${f}`);
      if (i === mkShotFor || (f && !sh)) sh = await shot(r.page, curId());
      await r.ctx.close();
    }
    return { verdict: fails.length ? 'FAIL' : 'PASS', actual: (fails.length ? `실패 ${fails.join(' / ')} :: ` : '') + rows.join(' | '), shots: sh ? [sh] : [] };
  });
}

const raw = (s) => ({ game: s });

if (!only || only === '1') {
  n = 47;
  await tamperCase('깨진 JSON·빈 값·엉뚱한 타입의 저장', '게임 저장 키에 깨진 JSON / 빈 문자열 / null·배열·숫자·문자열·true / 잘림 JSON 주입 후 로드', [
    { label: '깨진JSON', ...raw('{"version":4,"data":{') },
    { label: '빈문자열', ...raw('') },
    { label: 'null', ...raw('null') },
    { label: '배열', ...raw('[]') },
    { label: '숫자', ...raw('0') },
    { label: '문자열', ...raw('"abc"') },
    { label: 'true', ...raw('true') },
    { label: '잘림', ...raw(golden.lifeChoice.slice(0, golden.lifeChoice.length - 40)) },
    { label: '쓰레기+JSON', ...raw('garbage' + golden.lifeChoice) },
    { label: 'NaN토큰', ...raw(golden.lifeChoice.replace('"age":3', '"age":NaN')) },
    { label: '널문자', ...raw(golden.lifeChoice + '\u0000') },
  ]);
  await tamperCase('구버전·미래 버전·버전 형식 오류 저장', 'version 1, 2, 3, 5, "4"(문자열), null, 없음 으로 바꾼 저장 주입', [
    { label: 'v1', ...raw(mut(LIFE, (d, o) => { o.version = 1; })) },
    { label: 'v2', ...raw(mut(LIFE, (d, o) => { o.version = 2; })) },
    { label: 'v3(M2 스키마)', ...raw(mut(BIRTH, (d, o) => { o.version = 3; })) },
    { label: 'v5', ...raw(mut(LIFE, (d, o) => { o.version = 5; })) },
    { label: 'v"4"', ...raw(mut(LIFE, (d, o) => { o.version = '4'; })) },
    { label: 'v null', ...raw(mut(LIFE, (d, o) => { o.version = null; })) },
    { label: 'v 없음', ...raw(mut(LIFE, (d, o) => { delete o.version; })) },
    { label: 'data 없음', ...raw(mut(LIFE, (d, o) => { delete o.data; })) },
  ]);
  await tamperCase('필드 누락 (최상위·중첩 필드 하나씩 삭제)', 'data의 모든 최상위 필드와 character·stats 하위 필드를 하나씩 삭제한 저장 주입', (() => {
    const v = [];
    for (const k of Object.keys(LIFE.data)) v.push({ label: `-${k}`, ...raw(mut(LIFE, (d) => { delete d[k]; })) });
    for (const k of Object.keys(LIFE.data.character)) v.push({ label: `-character.${k}`, ...raw(mut(LIFE, (d) => { delete d.character[k]; })) });
    for (const k of Object.keys(LIFE.data.stats)) v.push({ label: `-stats.${k}`, ...raw(mut(LIFE, (d) => { delete d.stats[k]; })) });
    return v;
  })());
  await tamperCase('필드 타입 오류 (숫자↔문자열↔null↔배열↔객체)', '주요 필드를 잘못된 타입으로 바꾼 저장 주입', (() => {
    const v = [];
    const wrong = [['문자열', 'x'], ['null', null], ['객체', {}], ['배열', []], ['불리언', true]];
    for (const k of ['phase', 'era', 'age', 'seed', 'rngState', 'history', 'flags', 'seen', 'stats', 'character', 'pending', 'birthStats']) {
      for (const [lbl, val] of wrong) {
        // 이 조합은 값 자체가 유효하다(빈 배열 연표·빈 플래그·대기 선택지 없음) → 허용돼야 한다. (seen={}은 대기 선택지의 seen 기록과 어긋나 거부가 맞다)
        const valid = (k === 'history' && lbl === '배열') || (k === 'flags' && lbl === '배열') || (k === 'pending' && lbl === 'null');
        v.push({ label: `${k}=${lbl}${valid ? '(유효값)' : ''}`, expect: valid ? 'accept' : 'reject', ...raw(mut(LIFE, (d) => { d[k] = val; })) });
      }
    }
    return v;
  })());
}

if (!only || only === '2') {
  n = 51;
  await tamperCase('스탯 이상값: -5·1000·1e999(Infinity)·"50"·50.5·null', '스탯 5개와 외모에 이상값 주입', (() => {
    const v = [];
    for (const k of ['wealth', 'education', 'health', 'happiness', 'relationships']) {
      for (const [lbl, val] of [['-5', -5], ['1000', 1000], ['문자열50', '50'], ['소수', 50.5], ['null', null], ['101', 101], ['-1', -1]]) {
        v.push({ label: `${k}=${lbl}`, ...raw(mut(LIFE, (d) => { d.stats[k] = val; })) });
      }
    }
    v.push({ label: 'wealth=1e999(Infinity)', ...raw(golden.lifeChoice.replace('"wealth":47', '"wealth":1e999')) });
    v.push({ label: 'health=-1e999', ...raw(golden.lifeChoice.replace('"health":74', '"health":-1e999')) });
    v.push({ label: 'looks=1000', ...raw(mut(LIFE, (d) => { d.character.looks = 1000; })) });
    v.push({ label: 'looks=-3', ...raw(mut(LIFE, (d) => { d.character.looks = -3; })) });
    v.push({ label: '유효(대조) wealth=0·100', expect: 'accept', ...raw(mut(LIFE, (d) => { d.stats.wealth = 0; d.stats.health = 100; })) });
    return v;
  })());
  await tamperCase('나이 이상값: -1·999·105.5·"30"·null·사망 나이와 불일치', '나이 필드에 이상값 주입 + 엔딩 나이 불일치', [
    { label: 'age=-1', ...raw(mut(LIFE, (d) => { d.age = -1; })) },
    { label: 'age=999', ...raw(mut(LIFE, (d) => { d.age = 999; })) },
    { label: 'age=105.5', ...raw(mut(LIFE, (d) => { d.age = 105.5; })) },
    { label: 'age="30"', ...raw(mut(LIFE, (d) => { d.age = '30'; })) },
    { label: 'age=null', ...raw(mut(LIFE, (d) => { d.age = null; })) },
    { label: 'age=1e999', ...raw(golden.lifeChoice.replace('"age":3,', '"age":1e999,')) },
    { label: 'age=200(상한 초과)', ...raw(mut(LIFE, (d) => { d.age = 200; })) },
    { label: '엔딩 death.age≠age', ...raw(mut(ENDING, (d) => { d.death.age = d.age + 3; })) },
    { label: '엔딩 death 없음', ...raw(mut(ENDING, (d) => { d.death = null; })) },
    { label: '인생인데 death 있음', ...raw(mut(LIFE, (d) => { d.death = { age: 3, cause: '병' }; })) },
    { label: '유효 대조: 엔딩 그대로', expect: 'accept', ...raw(JSON.stringify(ENDING)) },
  ]);
  await tamperCase('대기 선택지 변조: 없는 이벤트 id·없는 선택지·key/나이 불일치·중복·개수 초과', 'pending 필드를 여러 방식으로 변조', [
    { label: '없는 이벤트(콘텐츠 갱신: 대기만 풀고 이어감, R-046)', expect: 'stale', ...raw(mut(LIFE, (d) => { d.pending.eventId = 'no-such-event'; d.pending.key = 'no-such-event@3'; d.seen['no-such-event'] = 3; })) },
    { label: '이벤트는 있으나 선택지 아님(서술)(대기만 풀림)', expect: 'stale', ...raw(mut(LIFE, (d) => { d.pending.eventId = 'infant-first-word'; d.pending.key = 'infant-first-word@3'; d.seen['infant-first-word'] = 3; })) },
    { label: '없는 선택지 id(대기만 풀림)', expect: 'stale', ...raw(mut(LIFE, (d) => { d.pending.choiceIds = ['grandparents', 'ghost']; })) },
    { label: '선택지 1개', ...raw(mut(LIFE, (d) => { d.pending.choiceIds = ['grandparents']; })) },
    { label: '선택지 4개', ...raw(mut(LIFE, (d) => { d.pending.choiceIds = ['grandparents', 'daycare', 'a', 'b']; })) },
    { label: '선택지 중복', ...raw(mut(LIFE, (d) => { d.pending.choiceIds = ['daycare', 'daycare']; })) },
    { label: 'key 불일치', ...raw(mut(LIFE, (d) => { d.pending.key = 'infant-care@4'; })) },
    { label: 'pending.age 불일치', ...raw(mut(LIFE, (d) => { d.pending.age = 99; })) },
    { label: 'eventId 숫자', ...raw(mut(LIFE, (d) => { d.pending.eventId = 123; })) },
    { label: 'eventId 특수문자', ...raw(mut(LIFE, (d) => { d.pending.eventId = '<script>x</script>'; d.pending.key = '<script>x</script>@3'; })) },
    { label: 'choiceIds 문자열', ...raw(mut(LIFE, (d) => { d.pending.choiceIds = 'daycare'; })) },
    { label: 'seen 불일치', ...raw(mut(LIFE, (d) => { d.seen['infant-care'] = 1; })) },
    { label: '유효 대조: 대기 선택지 그대로', expect: 'accept', ...raw(JSON.stringify(LIFE)) },
  ]);
}

const NAMES = [
  ['이모지 👨‍👩‍👧‍👦🥄', '이모지 👨‍👩‍👧‍👦🥄'],
  ['<script>', '<script>'],
  ['<b>굵게</b><i>x</i>', '<b>굵게</b><i>x</i>'],
  ['<svg/onload=__xss=1>', '<svg/onload=__xss=1>'],
  ['<img src=x onerror=alert(1)>', '<img src=x onerror=alert(1)>'], // 28자: 거부 예상
  ['\'"; DROP TABLE--', '\'"; DROP TABLE--'],
  ['NFD 자모 분리', '김민준'.normalize('NFD')],
  ['ㄱㅏㅂㅏㅇㅎㅏㅁ', 'ㄱㅏㅂㅏㅇㅎㅏㅁ'],
  ['제로폭 공백', '김​​​민​준'],
  ['RTL 덮어쓰기', '‮김민준‬'],
  ['줄바꿈 포함', '김\n민\r\n준'],
  ['한글 20자', '가나다라마바사아자차카타파하거너더러머버'],
  ['넓은 글자 20자', 'ＷＷＷＷＷＷＷＷＷＷＷＷＷＷＷＷＷＷＷＷ'],
  ['공백만', '   '],
  ['21자(거부)', '가나다라마바사아자차카타파하거너더러머버서'],
  ['10만 자(거부)', '가'.repeat(100000)],
];
if (!only || only === '3') {
  n = 54;
  await tamperCase('캐릭터 이름 변조 (인생 화면, 대기 선택지 포함): 이모지·태그·SQL·자모·제로폭·RTL·줄바꿈·20자·초장문', 'character.name을 각 문자열로 바꾼 유효 저장 주입. 길이 ≤20은 글자 그대로 표시, >20은 거부(새 게임)', NAMES.map(([lbl, name]) => ({
    label: lbl,
    expect: name.length >= 1 && name.length <= 20 ? 'accept' : 'reject',
    checkInject: true,
    ...raw(mut(LIFE, (d) => { d.character.name = name; })),
    after: async (r) => {
      if (!(name.length >= 1 && name.length <= 20)) return null;
      if (r.s.screen !== 'life-screen') return null;
      const shown = await r.page.getByTestId('life-name').textContent();
      return shown === name ? null : `표시된 이름이 다름: ${JSON.stringify(shown)}`;
    },
  })), '길이 1~20 이름은 그대로 글자로 표시(태그로 해석·실행되지 않음), 범위 밖은 새 게임으로 거부. 흰 화면·오류 없음', 0);
  n = 55;
  await tamperCase('캐릭터 이름 변조 (엔딩 화면)', '엔딩 저장의 이름을 변조해 엔딩 화면과 그 문구에서 확인', NAMES.slice(0, 13).map(([lbl, name]) => ({
    label: lbl,
    expect: name.length >= 1 && name.length <= 20 ? 'accept' : 'reject',
    checkInject: true,
    ...raw(mut(ENDING, (d) => { d.character.name = name; })),
  })), '길이 1~20 이름은 글자 그대로 표시, 태그 주입·alert 없음', 1);
  n = 56;
  await tamperCase('연표(history) 변조: 항목 텍스트·제목·선택에 태그·이모지·초장문, 항목 수 160/161/4만개', 'history 텍스트에 <script>·이모지·1000자·10만자, 항목 수 상한 경계(160 허용/161 거부)·40000개', (() => {
    const entry = (t) => ({ age: 2, kind: 'event', text: t, title: 't', eventId: 'x' });
    const base = (fn) => raw(mut(LIFE, fn));
    return [
      { label: '텍스트 <script>', expect: 'accept', checkInject: true, ...base((d) => { d.history.push(entry('<script>__xss=1</script><img src=x onerror=__xss=1>')); }) },
      { label: '텍스트 이모지·자모', expect: 'accept', ...base((d) => { d.history.push(entry('🥄🥄🥄 ㄱㅏㅂㅏㅇ 👨‍👩‍👧‍👦')); }) },
      { label: '텍스트 1000자', expect: 'any', ...base((d) => { d.history.push(entry('긴'.repeat(1000))); }) },
      { label: '텍스트 10만자', expect: 'reject', ...base((d) => { d.history.push(entry('긴'.repeat(100000))); }) },
      { label: '제목 10만자', expect: 'reject', ...base((d) => { d.history.push({ age: 2, kind: 'event', text: 'a', title: 'T'.repeat(100000) }); }) },
      { label: 'choice 10만자', expect: 'reject', ...base((d) => { d.history.push({ age: 2, kind: 'choice', text: 'a', choice: 'C'.repeat(100000) }); }) },
      { label: '항목 160개', expect: 'any', ...base((d) => { d.history = Array.from({ length: 160 }, (_, i) => ({ age: Math.min(3, i % 4), kind: 'event', text: `사건 ${i}`, eventId: 'x' })); }) },
      { label: '항목 161개', expect: 'reject', ...base((d) => { d.history = Array.from({ length: 161 }, (_, i) => ({ age: Math.min(3, i % 4), kind: 'event', text: `사건 ${i}`, eventId: 'x' })); }) },
      { label: '항목 4만개(저장소 한도 안)', expect: 'reject', ...base((d) => { d.history = Array.from({ length: 40000 }, (_, i) => ({ age: 1, kind: 'event', text: `사건 ${i}`, eventId: 'x' })); }), wait: 1500 },
      { label: 'kind 이상', expect: 'reject', ...base((d) => { d.history.push({ age: 1, kind: 'evil', text: 'a' }); }) },
      { label: 'age 역전(미래 나이 항목)', expect: 'reject', ...base((d) => { d.history.push({ age: 50, kind: 'event', text: 'a' }); }) },
    ];
  })(), '허용 범위 안의 연표 문구는 글자 그대로(태그로 해석되지 않음), 범위 밖은 새 게임', 0);
}

if (!only || only === '4') {
  n = 57;
  await tamperCase('seen·flags·extra 필드 변조: 10만 개 키, 프로토타입 오염 시도(__proto__/constructor), 임의 추가 필드', 'seen에 10만 키, flags 10만 개, "__proto__"/"constructor" 키, 최상위 추가 필드 주입', [
    { label: 'seen 10만 키', expect: 'reject', ...raw(mut(LIFE, (d) => { d.seen = Object.fromEntries(Array.from({ length: 100000 }, (_, i) => [`e${i}`, 1])); })), wait: 1500 },
    { label: 'flags 10만개', expect: 'reject', ...raw(mut(LIFE, (d) => { d.flags = Array.from({ length: 100000 }, (_, i) => `f${i}`); })), wait: 1500 },
    { label: 'flags 특수문자', expect: 'reject', ...raw(mut(LIFE, (d) => { d.flags = ['<script>']; })) },
    { label: '__proto__ 주입(raw)', expect: 'any', ...raw(golden.lifeChoice.replace('"data":{', '"data":{"__proto__":{"phase":"ending","polluted":true},')) , after: async (r) => { const p = await r.page.evaluate(() => ({}).polluted === true); return p ? '프로토타입 오염됨' : null; } },
    { label: 'constructor 키 주입', expect: 'any', ...raw(golden.lifeChoice.replace('"data":{', '"data":{"constructor":{"prototype":{"polluted":true}},')) , after: async (r) => { const p = await r.page.evaluate(() => ({}).polluted === true); return p ? '프로토타입 오염됨' : null; } },
    { label: '최상위 추가 필드', expect: 'any', ...raw(mut(LIFE, (d, o) => { o.extra = { a: 1 }; d.extraField = '<b>x</b>'; })) },
    { label: 'seed 음수/소수', expect: 'reject', ...raw(mut(LIFE, (d) => { d.seed = -5; })) },
    { label: 'rngState 2^32', expect: 'reject', ...raw(mut(LIFE, (d) => { d.rngState = 4294967296; })) },
  ]);
  n = 58;
  // 거대한 저장 값 (저장소 한도 근처)
  await runCase(G, { id: aId(), cat: '#8 저장 변조', title: '거대한 저장 값: 유효 상태 + 4.8MB 패딩 / 깨진 JSON 4.8MB / 설정 4.8MB', steps: '저장소 한도(약 5MB) 근처 크기의 값을 심고 로드', expected: '느려지더라도 정상 로드(유효 상태는 이어하기, 깨진 값은 새 게임). 무한 로딩·흰 화면 없음' }, async () => {
    const fails = [];
    const rows = [];
    let sh = null;
    for (const [lbl, game, settings, expectScreen] of [
      ['유효+패딩', JSON.stringify({ ...JSON.parse(golden.lifeChoice), pad: 'x'.repeat(2400000) }), null, 'life-screen'],
      ['깨진 JSON 패딩', '{"version":4,"data":' + 'x'.repeat(2400000), null, 'title-screen'],
      ['설정 거대', null, '{"version":1,"data":{"speed":8,"autoMode":true},"pad":"' + 'y'.repeat(2400000) + '"}', 'title-screen'],
    ]) {
      const t0 = Date.now();
      let r;
      try {
        r = await loadWith({ game, settings, wait: 800 });
      } catch (e) {
        fails.push(`${lbl}: 로드 실패 ${e.message.slice(0, 100)}`);
        continue;
      }
      rows.push(`${lbl}→${r.s.screen} (${r.ms}ms)`);
      if (isBad(r.s)) fails.push(`${lbl}: ${r.s.screen}`);
      else if (r.s.screen !== expectScreen) fails.push(`${lbl}: ${expectScreen} 기대, ${r.s.screen}`);
      if (!sh) sh = await shot(r.page, curId());
      await r.ctx.close();
    }
    return { verdict: fails.length ? 'FAIL' : 'PASS', actual: (fails.length ? fails.join(' / ') + ' :: ' : '') + rows.join(' | '), shots: sh ? [sh] : [] };
  });
}

if (!only || only === '5') {
  n = 59;
  // 설정 변조 — 화면(UI)에서 실제 속도/자동 표시를 확인
  await runCase(G, { id: aId(), cat: '#8 저장 변조', title: '설정 키 변조: 배속 3·"빠름"·autoMode 문자열·버전 불일치·깨진 JSON·필드 누락·거대 값', steps: '설정 키를 변조하고 새 판을 시작해 인생 화면에서 속도·자동 버튼 상태를 확인', expected: '잘못된 설정은 기본값(1배·자동 꺼짐)으로 복구, 유효한 설정(8배·자동 켜짐)은 유지. 오류 없음' }, async () => {
    const S = (data, version = 1) => JSON.stringify({ version, data });
    const variants = [
      ['speed=3', S({ speed: 3, autoMode: false }), ['1', 'false']],
      ['speed="빠름"', S({ speed: '빠름', autoMode: false }), ['1', 'false']],
      ['speed="8"(문자열)', S({ speed: '8', autoMode: false }), ['1', 'false']],
      ['speed=0', S({ speed: 0, autoMode: false }), ['1', 'false']],
      ['speed=-8', S({ speed: -8, autoMode: false }), ['1', 'false']],
      ['autoMode="true"', S({ speed: 8, autoMode: 'true' }), ['1', 'false']],
      ['autoMode=1', S({ speed: 8, autoMode: 1 }), ['1', 'false']],
      ['autoMode 없음', S({ speed: 8 }), ['1', 'false']],
      ['version=2', S({ speed: 8, autoMode: true }, 2), ['1', 'false']],
      ['깨진 JSON', '{"version":1,"data":{"speed":8', ['1', 'false']],
      ['빈 문자열', '', ['1', 'false']],
      ['null', 'null', ['1', 'false']],
      ['data=배열', S([8, true]), ['1', 'false']],
      ['유효 대조 8배·자동', S({ speed: 8, autoMode: true }), ['8', 'true']],
      ['유효+추가 필드', S({ speed: 4, autoMode: false, extra: '<b>x</b>' }), ['4', 'false']],
      ['__proto__ 주입', '{"version":1,"data":{"__proto__":{"speed":8},"speed":2,"autoMode":false}}', ['2', 'false']],
    ];
    const fails = [];
    const rows = [];
    let sh = null;
    for (const [lbl, settings, want] of variants) {
      const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
      const page = await ctx.newPage();
      await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('__s')) { localStorage.setItem(k, v); sessionStorage.setItem('__s', '1'); } }, [SETTINGS_KEY, settings]);
      try {
        await page.goto(DEV + '/');
        await toLife(page, 'present');
        await sleep(600);
        const s = await snap(page);
        const stored = await readSettings(page);
        rows.push(`${lbl}→${s.speed}/${s.auto}`);
        if (s.speed !== want[0] || s.auto !== want[1]) fails.push(`${lbl}: 기대 ${want.join('/')} 실제 ${s.speed}/${s.auto}`);
        if (stored && stored.__corrupt) fails.push(`${lbl}: 저장 설정 손상`);
        if (lbl.startsWith('speed=3')) sh = await shot(page, curId());
      } catch (e) {
        fails.push(`${lbl}: 오류 ${e.message.slice(0, 100)}`);
      } finally {
        await ctx.close();
      }
    }
    return { verdict: fails.length ? 'FAIL' : 'PASS', actual: (fails.length ? fails.join(' / ') + ' :: ' : '') + rows.join(' | '), shots: sh ? [sh] : [] };
  });
  n = 60;
  await tamperCase('게임 저장은 정상인데 설정만 엉망일 때 + 반대 (게임 깨짐·설정 정상)', '(a) 설정 거대/깨짐 + 유효 게임 → 게임 이어하기, (b) 깨진 게임 + 유효 설정 → 새 게임이되 설정 유지', [
    { label: '깨진 설정+유효 게임', expect: 'accept', game: golden.lifeChoice, settings: '{{{' },
    { label: '유효 설정+깨진 게임', expect: 'reject', game: '{{{', settings: JSON.stringify({ version: 1, data: { speed: 8, autoMode: false } }), after: async (r) => { const st = await readSettings(r.page); return st && st.data && st.data.speed === 8 ? null : '설정이 사라짐'; } },
    { label: '시대 불일치(past인데 2020년생)', expect: 'reject', game: mut(LIFE, (d) => { d.era = 'past'; d.character.birthYear = 2020; }) },
    { label: '시대 불일치(future인데 1990년생)', expect: 'reject', game: mut(LIFE, (d) => { d.era = 'future'; d.character.birthYear = 1990; }) },
    { label: '출생 스냅샷 없음(life)', expect: 'reject', game: mut(LIFE, (d) => { d.birthStats = null; }) },
    { label: 'title인데 캐릭터 있음', expect: 'reject', game: mut(LIFE, (d) => { d.phase = 'title'; }) },
  ]);
}
await browser.close();
