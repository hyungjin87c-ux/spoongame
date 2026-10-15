# 이름 데이터 출처 기록 - 대법원 "상위 출생신고 이름 현황"

- 작성: developer (SPEC-001 M2 후속, 이름 원자료 수집)
- 수집 일시: 2026-10-13 (UTC 2026-10-13T10:57:59.623Z ~ 2026-10-13T10:58:47.140Z, 한국시간 19:57~19:58)
- 산출물: `src/data/sources/scourt-birth-names.json` (원자료. 게임에서의 사용 방식은 10절 "게임 데이터로의 통합 방식")

## 1. 출처

| 항목 | 내용 |
|---|---|
| 기관/서비스 | 대한민국 법원 전자가족관계등록시스템 > 통계서비스 > 상위 출생신고 이름 현황 |
| 페이지 | https://stfamily.scourt.go.kr/st/StFrrStatcsView.do?pgmId=090000000025 (형진 님이 지정) |
| 데이터 요청 | `POST https://stfamily.scourt.go.kr/ds/report/query.do` (화면 표가 쓰는 요청과 동일) |
| 성격 | 등록일 기준 일단위 통계 잠정치 |
| 안내문(원문) | "가족관계의 등록 등에 관한 법률 시행(2008. 1. 1.) 이후 조회일 현재까지 해당 지역의 가족관계등록관서를 통하여 출생사건이 접수된 후 가족관계등록부에 기록된 정보를 이름 순위로 집계한 일단위 통계 잠정치임(등록일 기준)" |
| 조회 제한 안내(원문) | "조회유형의 일자는 30일 이내, 년월은 6개월 이내, 년도는 2년 이내에서 조회 가능합니다." |
| 이용 조건 | 사이트 "저작권 보호 정책"(`/sm/SmBottomCopyProtecPolic.do`, 2026-10-13 확인): 법원이 저작재산권 전부를 보유한 자료는 저작권법 제24조의2(공공저작물의 자유이용)에 따라 별도 이용허락 없이 자유이용 가능, 단 **출처를 구체적으로 표시**해야 함 |
| 권장 출처 표기 | 출처: 대한민국 법원 전자가족관계등록시스템 통계서비스 "상위 출생신고 이름 현황"(등록일 기준 잠정치), https://stfamily.scourt.go.kr/st/StFrrStatcsView.do?pgmId=090000000025, 2026-10-13 조회 |

## 2. 서비스 구조 (직접 확인한 것)

1. 바깥 페이지(`StFrrStatcsView.do`)가 폼(`frmForm`, hidden `pid=1811`)을 `/ds/report/view.do`로 POST해서 iframe(`name=iframForm`)에 리포트 화면을 띄운다. 같은 origin이라 바깥 페이지에서 iframe 내부를 읽을 수 있다.
2. iframe 안에 조회 조건 콤보(IBMultiCombo)가 있다: 조회유형(년도 `YY` / 년월 `YM` / 일자 `DT`), 시작·종료 연도, *시도(필수, **다중 선택 체크박스**), 시군구, 읍면, 성별(전체 / 남자 `1` / 여자 `2`).
3. 시도 콤보 항목은 25개이며 **"전체" 항목은 없고**, 25개를 모두 체크하면 한 번의 조회로 전국 합산이 된다. 항목: 서울특별시 11, 전남광주통합특별시 12, 부산 26, 대구 27, 인천 28, 대전 30, 울산 31, 세종 36, 경기 41, 충북 43, 충남 44, 경북 47, 경남 48, 제주 50, 강원특별자치도 51, 전북특별자치도 52, 그리고 구 행정구역 코드인 부산직할시(구) 21, 대구직할시(구) 22, 인천직할시(구) 23, 광주직할시(구) 24, 대전직할시(구) 25, 광주광역시(구) 29, 강원도(구) 42, 전라북도(구) 45, 전라남도(구) 46.
4. 시작/종료 연도 드롭다운은 **2008~2026**만 보여준다.
5. 조회 버튼(`#btn_query`)을 누르면 iframe이 `/ds/report/query.do`로 2번 POST한다: `sqlid=1811-0`(표)와 `sqlid=1811-1`(차트). 표는 `1811-0` 응답을 쓴다. 로그인·CAPTCHA는 없다.

### 요청 형식

```
POST /ds/report/query.do
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
X-Requested-With: XMLHttpRequest

pid=1811&uid=999999&dsid=1261&dstype=DS&mapid=<임의 UUID>&sqlid=1811-0&params=<JSON, URL 인코딩>
```

`params` JSON (연도 2024, 남자, 시도 25개 전체 선택의 예):

```json
{"@MultiCandType":{"value":["YY"],"type":"STRING","defaultValue":""},
 "@MultiCandStDt":{"value":["2024"],"type":"STRING","defaultValue":""},
 "@MultiCandEdDt":{"value":["2024"],"type":"STRING","defaultValue":""},
 "@SidoCd":{"value":["11","12","26","27","28","30","31","36","41","43","44","47","48","50","51","52","21","22","23","24","25","29","42","45","46"],"type":"STRING","defaultValue":"[All]","whereClause":"C.SIDO_CD"},
 "@CggCd":{"value":["_EMPTY_VALUE_"],"type":"STRING","defaultValue":"[All]","whereClause":"D.CGG_CD"},
 "@UmdCd":{"value":["_EMPTY_VALUE_"],"type":"STRING","defaultValue":"[All]","whereClause":"E.UMD_CD"},
 "@GenderCd":{"value":["1"],"type":"STRING","defaultValue":"[All]","whereClause":"F.GENDER_CD"}}
```

응답: `{"mapid":"...","data":[{"순위":1,"전체비율":"이준(6.66%)","건수":1872,"이름":"이준","정렬":1}, ... ,{"순위":21,"전체비율":"기타(77.95%)","건수":99389,"이름":"기타","정렬":21}]}` - **상위 20개 이름 + "기타" 1행(총 21행)**. 세션은 `/ds/report/view.do`(pid=1811)를 한 번 POST해서 받은 `JSESSIONID` 쿠키만 있으면 된다. 코드로 만든 요청 본문이 브라우저가 보낸 요청 본문과 글자 단위로 같음을 확인했다(821자 동일).

## 3. 화면에서 한 조작 (조회 방식 파악)

1. 내장 브라우저에서 위 페이지를 연다. 조회유형을 "일자"에서 "년도"로 바꾼다.
2. 시작연도를 2024로 바꾸고 종료연도를 2026으로 두자 안내창 **"년조회는 2년까지만 가능합니다."** 가 떴다(확인을 눌러 닫음). 즉 년도 조회는 범위 2년 이내(연도별 1년 조회는 허용)이며, 이 때문에 연도별 1회씩 조회한다. 이 제한을 넘는 요청(3년 이상 범위)은 보내지 않았다.
3. 시도 드롭다운을 마우스로 열어 체크박스 25개를 확인했다. 선택값은 화면 클릭 대신 콤보 컴포넌트의 `SetSelectCode`로 지정했다(시도 25개 전부, 성별 남자 `1`). 컴포넌트가 선택 후 화면 상태와 같은 값(선택 코드 25개, "남자")을 보여주는 것을 확인했고, 조회 버튼(`#btn_query`)의 클릭 이벤트로 조회했다. 이때 iframe의 `XMLHttpRequest`를 가로채 위 요청 본문을 기록했다.
4. 이후 같은 조건을 코드(Node.js `fetch`)로 보내 응답이 화면과 같은 것을 확인하고, 연도·성별만 바꿔 36회 반복했다.

## 4. 수집 절차 (재현)

- 도구: Node.js v24 단독 스크립트(아래 9절). 요청은 **순차**로 보내고 요청 사이 **0.5~1.0초 무작위 대기**, 실패 시 최대 3회 시도(2초, 4초 대기), 401/403/429 또는 차단·로그인 징후가 보이면 즉시 중단하도록 했다. 이번 실행에서는 36건 모두 1회 만에 성공했고 차단·CAPTCHA·로그인 화면은 나오지 않았다.
- 조건: 조회유형 년도(YY), 시작=종료 연도(2008~2025 각각), 시도 25개 코드 전부, 시군구·읍면 미지정, 성별 1(M)/2(F).
- 이름·건수는 응답 JSON에서 스크립트(`parseRows`)로 추출했다. 사람이 옮겨 적은 값은 없다. 원본 응답은 작업용 폴더에 `<연도>_<성별>.json`으로 보관했다(저장소에는 넣지 않음).
- 요청 규모: 수집 36회 + 검증·탐색용(시도별 대조 78회, 연도 범위 시험 4회, 화면 재조회 3건, 조회 방식 파악 몇 회, 정책 페이지 GET 2회) 등 총 약 130회를 모두 순차로 보냈다. 병렬 호출은 없었다.
- 2026년은 진행 중인 해라 수집하지 않았다.

## 5. 수집 결과 (연도·성별별 확보 순위 수)

연도·성별 36칸 **모두 성공, 칸마다 20행**(상위 20개). 비어 있는 칸 없음. 합계 = 상위 20개 + "기타"의 건수(화면 표의 "합계" 행과 같은 값).

| 등록 연도 | 남(M) 행 수 | 여(F) 행 수 | 남 1위 | 여 1위 | 남 합계(건) | 여 합계(건) |
|---|---|---|---|---|---|---|
| 2008 | 20 | 20 | 민준 2,619 | 서연 3,288 | 240,090 | 226,485 |
| 2009 | 20 | 20 | 민준 3,095 | 서연 3,522 | 232,241 | 219,420 |
| 2010 | 20 | 20 | 민준 3,593 | 서연 3,540 | 245,054 | 230,287 |
| 2011 | 20 | 20 | 민준 4,020 | 서연 3,175 | 246,370 | 233,291 |
| 2012 | 20 | 20 | 민준 3,695 | 서연 3,272 | 251,016 | 238,072 |
| 2013 | 20 | 20 | 서준 3,262 | 서연 3,145 | 231,428 | 220,043 |
| 2014 | 20 | 20 | 서준 4,181 | 서윤 3,534 | 227,427 | 216,118 |
| 2015 | 20 | 20 | 민준 3,832 | 서윤 3,121 | 229,953 | 218,267 |
| 2016 | 20 | 20 | 민준 2,952 | 서윤 2,798 | 212,096 | 201,877 |
| 2017 | 20 | 20 | 하준 2,670 | 하윤 2,424 | 186,300 | 174,968 |
| 2018 | 20 | 20 | 서준 2,908 | 지안 2,627 | 172,597 | 162,863 |
| 2019 | 20 | 20 | 서준 2,555 | 지안 2,162 | 159,665 | 150,477 |
| 2020 | 20 | 20 | 도윤 2,393 | 서아 2,099 | 142,275 | 134,742 |
| 2021 | 20 | 20 | 이준 2,753 | 서아 2,277 | 137,850 | 130,514 |
| 2022 | 20 | 20 | 이준 2,652 | 이서 2,303 | 132,644 | 126,183 |
| 2023 | 20 | 20 | 이준 2,076 | 서아 2,060 | 122,777 | 115,879 |
| 2024 | 20 | 20 | 이준 1,872 | 서아 1,927 | 127,505 | 120,860 |
| 2025 | 20 | 20 | 도윤 2,336 | 서아 2,016 | 136,381 | 128,439 |

## 6. 서비스 제공 범위 시험

| 시험 | 결과 |
|---|---|
| 연도 선택지 | 2008~2026 (최소 2008) |
| 2008년 조회 | 정상 (남 1위 민준 2,619건 등 21행) |
| 2007년, 2000년을 직접 요청 | `{"data":[]}` - 빈 응답 (화면 선택지에도 없음) |
| 결론 | **2008년 이전 자료는 이 서비스에 없다.** 근거: 안내문 "가족관계의 등록 등에 관한 법률 시행(2008. 1. 1.) 이후", 연도 선택지 최소값 2008, 2007·2000 요청의 빈 응답 |
| 한 번에 보이는 순위 | 상위 20개 + 기타 (21행). 상위 30개는 서비스가 주지 않음 |

## 7. 검산 결과

### 7-1. 화면 재조회 vs 저장값 (무작위 3건)

무작위로 뽑은 3건(2024 남, 2025 여, 2008 남)을 브라우저 화면에서 다시 조회(연도·성별을 콤보 컴포넌트로 지정한 뒤 조회 버튼 클릭 이벤트 실행, 시도는 25개 전부 선택 상태)해 화면 결과 표(IBSheet)의 셀 값을 읽어 저장값과 대조했다. 저장값은 Node.js 요청으로 받은 것이고 화면 값은 페이지 자체의 요청으로 받은 것이라 서로 독립이다. 1~5위 이름·건수와 "기타", "합계"까지 전부 **일치**.

| 케이스 | 순위 | 화면 이름 | 화면 건수 | 저장 이름 | 저장 건수 | 판정 |
|---|---|---|---|---|---|---|
| 2024 M | 1 | 이준 | 1,872 | 이준 | 1,872 | 일치 |
| 2024 M | 2 | 하준 | 1,780 | 하준 | 1,780 | 일치 |
| 2024 M | 3 | 도윤 | 1,759 | 도윤 | 1,759 | 일치 |
| 2024 M | 4 | 은우 | 1,614 | 은우 | 1,614 | 일치 |
| 2024 M | 5 | 시우 | 1,597 | 시우 | 1,597 | 일치 |
| 2024 M | 기타 | (화면) | 99,389 | (저장) | 99,389 | 일치 |
| 2024 M | 합계 | (화면) | 127,505 | (저장 totalCount) | 127,505 | 일치 |
| 2025 F | 1 | 서아 | 2,016 | 서아 | 2,016 | 일치 |
| 2025 F | 2 | 서윤 | 1,877 | 서윤 | 1,877 | 일치 |
| 2025 F | 3 | 하린 | 1,830 | 하린 | 1,830 | 일치 |
| 2025 F | 4 | 이서 | 1,785 | 이서 | 1,785 | 일치 |
| 2025 F | 5 | 하윤 | 1,721 | 하윤 | 1,721 | 일치 |
| 2025 F | 기타 | (화면) | 100,346 | (저장) | 100,346 | 일치 |
| 2025 F | 합계 | (화면) | 128,439 | (저장 totalCount) | 128,439 | 일치 |
| 2008 M | 1 | 민준 | 2,619 | 민준 | 2,619 | 일치 |
| 2008 M | 2 | 지훈 | 2,170 | 지훈 | 2,170 | 일치 |
| 2008 M | 3 | 현우 | 1,931 | 현우 | 1,931 | 일치 |
| 2008 M | 4 | 준서 | 1,885 | 준서 | 1,885 | 일치 |
| 2008 M | 5 | 우진 | 1,808 | 우진 | 1,808 | 일치 |
| 2008 M | 기타 | (화면) | 208,072 | (저장) | 208,072 | 일치 |
| 2008 M | 합계 | (화면) | 240,090 | (저장 totalCount) | 240,090 | 일치 |

### 7-2. 전국 단일 조회가 정말 전국 합계인가 (시도별 대조)

3건에 대해 시도 코드 25개를 하나씩 따로 조회해 건수 합계(상위 20 + 기타)를 더한 값이 25개 동시 선택 단일 조회의 합계와 같은지 확인했다. 3건 모두 **정확히 일치**한다(시도 합산이 아니라 서비스가 직접 합산한 전국값임을 확인).

| 시도 코드 | 이름 | 2024 M | 2010 F | 2008 M |
|---|---|---|---|---|
| 11 | 서울 | 28,310 | 46,714 | 48,854 |
| 12 | 전남광주통합 | 0 | 0 | 0 |
| 21 | 부산직할시(구) | 0 | 0 | 0 |
| 22 | 대구직할시(구) | 0 | 0 | 0 |
| 23 | 인천직할시(구) | 0 | 0 | 0 |
| 24 | 광주직할시(구) | 0 | 0 | 0 |
| 25 | 대전직할시(구) | 0 | 0 | 0 |
| 26 | 부산 | 6,744 | 13,591 | 13,950 |
| 27 | 대구 | 5,266 | 10,119 | 10,824 |
| 28 | 인천 | 7,935 | 12,605 | 12,903 |
| 29 | 광주광역시(구) | 3,108 | 6,933 | 7,087 |
| 30 | 대전 | 3,794 | 7,069 | 7,641 |
| 31 | 울산 | 2,723 | 5,595 | 5,890 |
| 36 | 세종 | 1,476 | 0 | 0 |
| 41 | 경기 | 34,186 | 56,284 | 58,212 |
| 42 | 강원도(구) | 0 | 6,142 | 6,433 |
| 43 | 충북 | 3,974 | 7,243 | 7,491 |
| 44 | 충남 | 5,178 | 10,190 | 10,365 |
| 45 | 전라북도(구) | 225 | 8,042 | 8,521 |
| 46 | 전라남도(구) | 4,158 | 8,285 | 8,854 |
| 47 | 경북 | 5,355 | 12,041 | 12,982 |
| 48 | 경남 | 6,842 | 16,273 | 16,770 |
| 50 | 제주 | 1,605 | 3,161 | 3,313 |
| 51 | 강원특별자치 | 3,325 | 0 | 0 |
| 52 | 전북특별자치 | 3,301 | 0 | 0 |
| 합 | 시도별 합계 | 127,505 | 230,287 | 240,090 |
| 전국 | 25개 동시 선택 단일 조회 | 127,505 | 230,287 | 240,090 |
| 판정 | | 일치 | 일치 | 일치 |

시사점: 현행 시도 코드만으로는 전국이 안 된다. 예컨대 2024년 남은 광주광역시(구) 3,108건, 전라남도(구) 4,158건, 전라북도(구) 225건이 구 코드에 들어 있다. 그래서 25개 코드를 전부 선택했다.

### 7-3. 응답 내부 일관성 (36건 전부)

- 이름 행의 `ratio` = `count / (상위 20개 합계)` x 100 (모든 칸에서 오차 0.005 이내 = 반올림 오차). 즉 **전체 출생 대비 비율이 아니다.** "기타" 행의 비율만 `기타건수 / 합계`.
- 건수는 순위 순으로 비증가. 동점이면 같은 순위가 붙는다(예: 2011 남 15위 건우·민재 1,755건, 2016 남 2위 서준·하준 2,878건, 2019 여 17위 채원·소율 1,114건, 2020 남 1위 도윤·서준 2,393건과 16위 선우·이안 1,167건, 2024 여 5위 지안·하윤 1,398건).

## 8. 한계와 주의

1. **등록일 기준**이라 연도는 출생연도가 아니라 등록(신고 접수) 연도다. 12월 출생이 이듬해 1월에 등록되거나 늦게 신고된 건, 해외 출생 신고 등이 섞여 출생연도와 어긋날 수 있다.
2. **잠정치**라고 서비스가 명시했다. 시간이 지나 값이 바뀔 수 있다.
3. 연도·성별당 **상위 20개까지만** 제공. 목표였던 최소 30개는 서비스 한계로 확보하지 못했다. 21위 이하는 "기타"로 묶여 이름별 건수를 알 수 없다. (시도별로 쪼개 조회하면 21~30위 이름을 부분 추정할 수는 있으나, 시도 상위 20에 못 든 건수가 빠지는 하한값이라 이번에는 하지 않았다. 필요하면 별도 지시.)
4. 20위 경계의 동점이 21위 이하를 잘랐는지는 관측할 수 없다.
5. 2008년 이전 자료 없음. 1950~2007년생 이름은 이 서비스로 얻을 수 없다.
6. 건수는 등록 건수이며 통계청 출생아 수와 대조하지 않았다.
7. 이름은 한글 표기 그대로이고 한자 구분 여부는 알 수 없다.
8. 이용 조건은 1절에 적은 대로 출처 표시가 필요하다.

## 9. 사용한 스크립트 (그대로 재현 가능)

실행 순서: `node collect.mjs <임시경로> <raw폴더>` 후 `node sido-check.mjs <raw폴더>` 후 `node build.mjs <raw폴더> src/data/sources/scourt-birth-names.json`. 수집 대상 연도·성별은 `collect.mjs` 상단 상수로 지정한다. (세 스크립트 모두 이번에 실행한 그대로의 내용이다.)

<details><summary>collect.mjs - 연도별·성별별 전국 조회 (36회)</summary>

```js
// 대법원 전자가족관계등록시스템 통계서비스 "상위 출생신고 이름 현황" (pid=1811) 수집기
// 순차 호출, 요청 간 0.5~1.0초 간격, 실패 시 최대 3회 시도. 차단/로그인/CAPTCHA 징후가 보이면 즉시 중단.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = process.argv[2];          // 최종 JSON 경로
const RAW = process.argv[3];          // 원본 응답 저장 폴더
const YEARS = Array.from({ length: 2025 - 2008 + 1 }, (_, i) => 2008 + i);
const GENDERS = [['M', '1'], ['F', '2']];
const BASE = 'https://stfamily.scourt.go.kr';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
const SIDO = ['11','12','26','27','28','30','31','36','41','43','44','47','48','50','51','52','21','22','23','24','25','29','42','45','46'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => 500 + Math.floor(Math.random() * 500);

const jar = new Map();
const absorb = (res) => { for (const c of (res.headers.getSetCookie?.() ?? [])) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i).trim(), kv.slice(i + 1)); } };
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

async function openSession() {
  const res = await fetch(`${BASE}/ds/report/view.do`, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Referer: `${BASE}/st/StFrrStatcsView.do?pgmId=090000000025` }, body: 'pid=1811', redirect: 'manual' });
  absorb(res); await res.text();
  if (res.status !== 200 || !jar.has('JSESSIONID')) throw new Error('세션 확보 실패 status=' + res.status);
}

function buildBody(year, genderCode, sidos) {
  const params = {
    '@MultiCandType': { value: ['YY'], type: 'STRING', defaultValue: '' },
    '@MultiCandStDt': { value: [String(year)], type: 'STRING', defaultValue: '' },
    '@MultiCandEdDt': { value: [String(year)], type: 'STRING', defaultValue: '' },
    '@SidoCd': { value: sidos, type: 'STRING', defaultValue: '[All]', whereClause: 'C.SIDO_CD' },
    '@CggCd': { value: ['_EMPTY_VALUE_'], type: 'STRING', defaultValue: '[All]', whereClause: 'D.CGG_CD' },
    '@UmdCd': { value: ['_EMPTY_VALUE_'], type: 'STRING', defaultValue: '[All]', whereClause: 'E.UMD_CD' },
    '@GenderCd': { value: [genderCode], type: 'STRING', defaultValue: '[All]', whereClause: 'F.GENDER_CD' },
  };
  return 'pid=1811&uid=999999&dsid=1261&dstype=DS&mapid=' + encodeURIComponent(crypto.randomUUID()) + '&sqlid=1811-0&params=' + encodeURIComponent(JSON.stringify(params));
}

class StopError extends Error {}

async function queryOnce(year, genderCode, sidos) {
  const res = await fetch(`${BASE}/ds/report/query.do`, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', Accept: '*/*', Cookie: cookie(), Referer: `${BASE}/ds/report/view.do` }, body: buildBody(year, genderCode, sidos) });
  absorb(res);
  const text = await res.text();
  if ([401, 403, 429].includes(res.status) || /captcha|로그인|차단|접근이 제한/i.test(text.slice(0, 2000)) && !text.startsWith('{')) throw new StopError(`차단/로그인 징후 status=${res.status} body=${text.slice(0, 200)}`);
  if (res.status !== 200) throw new Error('HTTP ' + res.status);
  let json; try { json = JSON.parse(text); } catch { throw new Error('JSON 아님: ' + text.slice(0, 120)); }
  return { text, json };
}

export async function query(year, genderCode, sidos, tag) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await queryOnce(year, genderCode, sidos);
      if (tag) writeFileSync(`${RAW}/${tag}.json`, r.text);
      return { ok: true, attempts: attempt, json: r.json, text: r.text };
    } catch (e) {
      if (e instanceof StopError) throw e;
      last = e; await sleep(2000 * attempt);
    }
  }
  return { ok: false, attempts: 3, error: String(last) };
}

export function parseRows(json) {
  const rows = json.data ?? [];
  const named = [], others = [];
  for (const d of rows) {
    const m = /\(([\d.]+)%\)/.exec(d['전체비율'] ?? '');
    const rec = { rank: d['순위'], name: d['이름'], count: d['건수'], ratio: m ? Number(m[1]) : null };
    (d['이름'] === '기타' ? others : named).push(rec);
  }
  return { named, others };
}

if (process.argv[1].endsWith('collect.mjs')) {
  mkdirSync(RAW, { recursive: true }); mkdirSync(dirname(OUT), { recursive: true });
  await openSession();
  const years = {}, failures = [], aux = {};
  const startedAt = new Date().toISOString();
  let nReq = 0;
  for (const y of YEARS) {
    years[y] = {};
    for (const [g, code] of GENDERS) {
      const r = await query(y, code, SIDO, `${y}_${g}`); nReq++;
      if (!r.ok) { failures.push({ year: y, gender: g, reason: r.error }); await sleep(jitter()); continue; }
      const { named, others } = parseRows(r.json);
      if (named.length === 0) { failures.push({ year: y, gender: g, reason: '응답 데이터 0건' }); await sleep(jitter()); continue; }
      years[y][g] = named;
      const top = named.reduce((a, b) => a + b.count, 0);
      const oth = others[0] ?? null;
      (aux[y] ??= {})[g] = { topNCount: named.length, topSum: top, othersCount: oth?.count ?? null, othersRatio: oth?.ratio ?? null, totalCount: oth ? top + oth.count : null, attempts: r.attempts };
      console.log(y, g, named.length, named[0].name, named[0].count, 'attempts=' + r.attempts);
      await sleep(jitter());
    }
  }
  const finishedAt = new Date().toISOString();
  writeFileSync(`${RAW}/_summary.json`, JSON.stringify({ startedAt, finishedAt, nReq, failures, aux }, null, 1));
  writeFileSync(`${RAW}/_years_aux.json`, JSON.stringify({ years, aux, failures, startedAt, finishedAt, nReq }));
  console.log('done', { nReq, failures });
}
```
</details>

<details><summary>sido-check.mjs - 시도별 대조 검증 (78회)</summary>

```js
// 검증용: 시도 코드를 하나씩 조회해, 건수 합계(상위20+기타)가 "25개 코드 동시 선택" 단일 조회의 합계와 일치하는지 확인.
import { writeFileSync, mkdirSync } from 'node:fs';
const RAW = process.argv[2]; mkdirSync(RAW, { recursive: true });
const BASE = 'https://stfamily.scourt.go.kr';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
const SIDO = ['11','12','26','27','28','30','31','36','41','43','44','47','48','50','51','52','21','22','23','24','25','29','42','45','46'];
const CASES = [[2024, '1', 'M'], [2010, '2', 'F'], [2008, '1', 'M']];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jar = new Map();
const absorb = (res) => { for (const c of (res.headers.getSetCookie?.() ?? [])) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i).trim(), kv.slice(i + 1)); } };
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
const res0 = await fetch(`${BASE}/ds/report/view.do`, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'pid=1811', redirect: 'manual' });
absorb(res0); await res0.text();
function body(year, g, sidos) {
  const params = {
    '@MultiCandType': { value: ['YY'], type: 'STRING', defaultValue: '' },
    '@MultiCandStDt': { value: [String(year)], type: 'STRING', defaultValue: '' },
    '@MultiCandEdDt': { value: [String(year)], type: 'STRING', defaultValue: '' },
    '@SidoCd': { value: sidos, type: 'STRING', defaultValue: '[All]', whereClause: 'C.SIDO_CD' },
    '@CggCd': { value: ['_EMPTY_VALUE_'], type: 'STRING', defaultValue: '[All]', whereClause: 'D.CGG_CD' },
    '@UmdCd': { value: ['_EMPTY_VALUE_'], type: 'STRING', defaultValue: '[All]', whereClause: 'E.UMD_CD' },
    '@GenderCd': { value: [g], type: 'STRING', defaultValue: '[All]', whereClause: 'F.GENDER_CD' },
  };
  return 'pid=1811&uid=999999&dsid=1261&dstype=DS&mapid=' + encodeURIComponent(crypto.randomUUID()) + '&sqlid=1811-0&params=' + encodeURIComponent(JSON.stringify(params));
}
async function q(year, g, sidos) {
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(`${BASE}/ds/report/query.do`, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', Accept: '*/*', Cookie: cookie(), Referer: `${BASE}/ds/report/view.do` }, body: body(year, g, sidos) });
      if ([401, 403, 429].includes(r.status)) throw Object.assign(new Error('blocked ' + r.status), { stop: true });
      const t = await r.text(); return JSON.parse(t).data ?? [];
    } catch (e) { if (e.stop) throw e; await sleep(2000 * a); }
  }
  return null;
}
const sum = (rows) => rows.reduce((a, b) => a + b['건수'], 0);
const report = [];
for (const [year, g, gl] of CASES) {
  const nat = await q(year, g, SIDO); await sleep(700);
  const natTotal = sum(nat);
  let acc = 0; const per = [];
  for (const s of SIDO) {
    const rows = await q(year, g, [s]); await sleep(500 + Math.random() * 500);
    const tot = rows ? sum(rows) : null; acc += tot ?? 0;
    per.push({ sido: s, total: tot, top1: rows?.[0] ? rows[0]['이름'] + ':' + rows[0]['건수'] : null });
  }
  report.push({ year, gender: gl, nationalTotal: natTotal, sidoSum: acc, equal: natTotal === acc, per });
  console.log(year, gl, 'national', natTotal, 'sidoSum', acc, natTotal === acc ? 'EQUAL' : 'DIFF ' + (natTotal - acc));
}
writeFileSync(`${RAW}/_sido_check.json`, JSON.stringify(report, null, 1));
```
</details>

<details><summary>build.mjs - 원본 응답을 최종 JSON으로 변환 (요청 없음)</summary>

```js
// 원본 응답(raw/_years_aux.json) -> src/data/sources/scourt-birth-names.json  (값은 모두 응답에서 기계적으로 가져옴)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const RAWDIR = process.argv[2], OUT = process.argv[3];
const src = JSON.parse(readFileSync(`${RAWDIR}/_years_aux.json`, 'utf8'));
const sidoCheck = JSON.parse(readFileSync(`${RAWDIR}/_sido_check.json`, 'utf8'));

const totals = {};
for (const [y, byG] of Object.entries(src.aux)) for (const [g, a] of Object.entries(byG)) {
  (totals[y] ??= {})[g] = { top20Sum: a.topSum, othersCount: a.othersCount, othersRatio: a.othersRatio, totalCount: a.totalCount };
}
const failures = src.failures;
const meta = {
  source: '대한민국 법원 전자가족관계등록시스템 > 통계서비스 > 상위 출생신고 이름 현황 (대법원)',
  url: 'https://stfamily.scourt.go.kr/st/StFrrStatcsView.do?pgmId=090000000025',
  dataEndpoint: 'POST https://stfamily.scourt.go.kr/ds/report/query.do (pid=1811, dsid=1261, sqlid=1811-0; 화면 표와 같은 요청)',
  retrievedAt: '2026-10-13',
  retrievedAtRange: { start: src.startedAt, end: src.finishedAt },
  basis: '등록일 기준 잠정치 (서비스 안내문: "가족관계의 등록 등에 관한 법률 시행(2008. 1. 1.) 이후 조회일 현재까지 해당 지역의 가족관계등록관서를 통하여 출생사건이 접수된 후 가족관계등록부에 기록된 정보를 이름 순위로 집계한 일단위 통계 잠정치임(등록일 기준)")',
  queryConditions: {
    조회유형: '년도 (YY) — 시작 연도 = 종료 연도 (연도별 1회씩 조회)',
    연도: '2008~2025 (2026은 진행 중이라 수집하지 않음)',
    시도: '25개 코드 전부 선택: ' + '11,12,26,27,28,30,31,36,41,43,44,47,48,50,51,52,21,22,23,24,25,29,42,45,46' + ' (현행 시도 + 구 행정구역 코드. 검증한 3건(2024 M, 2010 F, 2008 M)에서 광주광역시(구)·강원도(구)·전라북도(구)·전라남도(구) 코드에 실제 건수가 있었고 부산·대구·인천·광주·대전 직할시(구) 코드와 전남광주통합특별시 코드는 0건이었음. 어느 연도에 어느 코드가 쓰이는지 모르므로 전부 선택)',
    시군구: '미선택 (_EMPTY_VALUE_)',
    읍면: '미선택 (_EMPTY_VALUE_)',
    성별: 'M = 1(남자), F = 2(여자)',
  },
  aggregation: '전국 단일 조회 (시도 25개 코드를 동시에 선택한 1회 조회로 서비스가 이름별 합산·순위 산출). 시도별 건수를 우리가 합산한 값이 아님.',
  aggregationCheck: {
    method: '3건(2024 M, 2010 F, 2008 M)에 대해 시도 코드 25개를 하나씩 따로 조회한 건수 합계(상위20+기타)가 단일 조회 합계와 같은지 대조',
    results: sidoCheck.map((c) => ({ year: c.year, gender: c.gender, singleQueryTotal: c.nationalTotal, sumOfPerSidoTotals: c.sidoSum, equal: c.equal })),
  },
  topN: 20,
  rowFields: {
    rank: '서비스가 준 순위 (동점이면 같은 순위, 다음 순위는 건너뜀)',
    name: '이름 (서비스 표기 그대로)',
    count: '건수 (해당 연도에 등록된 출생신고 건수)',
    ratio: '서비스 "전체비율" 열의 퍼센트 값. 이름 행은 "상위 20개 건수 합계(top20Sum) 대비 %"이며 전체 출생 대비가 아님(전 36건에서 count/top20Sum과 ±0.005 이내로 일치 확인). 전체 대비 비율은 count/totals.totalCount로 계산할 것',
  },
  totalsNote: 'totals[연도][성별]: top20Sum = 상위 20개 건수 합, othersCount = 서비스의 "기타"(21위 이하 전부) 건수, othersRatio = "기타"의 전체비율 값(= othersCount/totalCount %), totalCount = top20Sum + othersCount (응답 21개 행 합계로 계산. 화면 표 맨 아래 "합계" 행과 일치함을 3건에서 확인)',
  suggestedAttribution: '출처: 대한민국 법원 전자가족관계등록시스템 통계서비스 "상위 출생신고 이름 현황"(등록일 기준 잠정치), https://stfamily.scourt.go.kr/st/StFrrStatcsView.do?pgmId=090000000025, 2026-10-13 조회',
  verificationDoc: 'docs/data/names-source.md',
  failures: failures.length ? failures : '없음 (2008~2025 × 남/여 36건 모두 조회 성공, 각 20행)',
  serviceLimits: {
    minYear: 2008,
    preMinYear: '2008년 이전 자료는 서비스에 없음. 조회 화면 연도 선택지가 2008~2026뿐이며, 요청을 직접 보내 확인한 2007년·2000년은 data가 빈 배열([]).',
    rangeLimit: '조회유형 "년도"는 2년 이내 범위만 허용(3년 범위 선택 시 "년조회는 2년까지만 가능합니다." 안내창) → 연도별 1년 단위로 조회',
    rowsPerQuery: '상위 20개 이름 + "기타" 1행. 21위 이하 이름은 서비스가 제공하지 않음',
  },
  caveats: [
    '연도는 "출생연도"가 아니라 "등록(신고 접수) 연도"다. 12월 출생이 이듬해 1월에 등록되거나 늦게 신고된 건은 등록 연도로 잡혀 출생연도와 어긋날 수 있다.',
    '서비스가 "잠정치"라고 명시한 통계다. 이후 정정·추가 등록으로 값이 바뀔 수 있다.',
    '연도·성별당 상위 20개만 제공된다(서비스 최대치). 21위 이하는 "기타"로 묶여 이름별 건수를 알 수 없다. 최소 목표였던 상위 30개는 서비스 한계로 확보하지 못했다.',
    '공동 순위가 있다(예: 2016 남 2위 서준·하준 2878건, 2020 남 1위 도윤·서준 2393건). 20위 경계에서 동점으로 21위 이하 이름이 잘렸는지는 관측할 수 없다.',
    'ratio는 상위 20개 합계 기준 비율이라 "전체 출생 중 비중"으로 읽으면 안 된다. 게임 가중치로 쓸 때는 count를 쓰고, 전체 대비 비중이 필요하면 count/totals.totalCount를 쓴다.',
    '건수는 등록 건수이며 통계청 출생아 수와 대조하지 않았다. 해외 출생 신고·늦은 신고가 섞여 있을 수 있다.',
    '이름은 한글 표기 기준 집계로 보이며 한자 표기는 확인되지 않는다(동명이한자 구분 여부는 알 수 없음).',
    '이용 조건: 사이트 "저작권 보호 정책"(/sm/SmBottomCopyProtecPolic.do, 2026-10-13 확인)에 따르면 법원이 저작재산권 전부를 보유한 자료는 저작권법 제24조의2(공공저작물의 자유이용)에 따라 별도 허락 없이 자유이용이 가능하나 출처를 구체적으로 표시해야 한다. 게임에 쓸 때 출처 표기를 넣을 것.',
  ],
};

// 사람이 읽기 쉽게: 이름 행은 한 줄에 하나
function fmt(obj, indent = 0) {
  const pad = '  '.repeat(indent), pad1 = '  '.repeat(indent + 1);
  if (Array.isArray(obj)) {
    if (obj.every((x) => x && typeof x === 'object' && !Array.isArray(x) && Object.values(x).every((v) => v === null || typeof v !== 'object'))) {
      return '[\n' + obj.map((x) => pad1 + JSON.stringify(x)).join(',\n') + '\n' + pad + ']';
    }
    return '[\n' + obj.map((x) => pad1 + fmt(x, indent + 1)).join(',\n') + '\n' + pad + ']';
  }
  if (obj && typeof obj === 'object') {
    const ent = Object.entries(obj);
    if (ent.every(([, v]) => v === null || typeof v !== 'object')) return JSON.stringify(obj);
    return '{\n' + ent.map(([k, v]) => pad1 + JSON.stringify(k) + ': ' + fmt(v, indent + 1)).join(',\n') + '\n' + pad + '}';
  }
  return JSON.stringify(obj);
}
const out = { meta, years: src.years, totals };
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, fmt(out) + '\n', 'utf8');
console.log('written', OUT);
```
</details>

## 10. 게임 데이터로의 통합 방식 (2026-10-13, REV-001-M2-1 R-012 반영)

형진 님 결정(SPEC-001 "추가 결정 기록")에 따라, 원자료를 **옮겨 적지 않고 실행 시점에 그대로 읽는다.** 이름 풀의 출처는 시대마다 다르다.

| 시대 | 출생 연도 | 이름 풀 | 출처·성격 |
|---|---|---|---|
| 지금 세상 | 2008~2025 | 출생 연도 N년생의 남/녀 풀 = 원자료 `years[N]`의 M/F 이름 전부 (**실제 행 수 기준**, 현재는 36칸 모두 20행) | 법원 통계서비스 직접 조회, 공식 통계(등록일 기준 잠정치). 비공식 이름 0개 |
| 다가올 세상 | 2030~2060 | 성별마다 **2021~2025년 5개 연도 풀의 합집합**(중복 제거, 처음 나온 순서). 현재 남 27개 / 여 30개 | 미래 통계는 존재하지 않아 최근 연도 풀을 사용(`names.json` meta에 명시) |
| 지난 세상 | 1950~1989 | 기존 연대(1950·1960·1970·1980년대)별 남/녀 풀 = verified + estimated, 각 20~22개 | verified = 언론이 인용한 대법원 자료로 확인한 이름(상위 10 + 연대 상위 3), estimated = **통계가 아닌 추정 보충**. 데이터에서 따로 적어 구분 |

- **연도 → 풀 매핑**: `src/core/birth.ts#namePoolIdOf`가 출생 연도를 시대 표(`src/data/birthTable.ts#ERA_CONFIG.birthYears`)로 시대에 배정한 뒤 풀을 고른다(`{kind:'past', decade}` / `{kind:'present', year}` / `{kind:'future'}`). 시대 범위 밖(1949 이하, 1990~2007, 2026~2029, 2061 이상)과 정수가 아닌 연도, 풀이 없는 연도는 **throw**한다. 다른 풀로 조용히 돌려보내지 않는다.
- **원자료 읽기**: `src/data/names.ts`가 `scourt-birth-names.json`을 import해 연도·성별 풀(`officialPool`)과 다가올 세상 합집합(`futurePool`)을 모듈 로드 때 한 번 만든다. 행이 비어 있으면 로드 시점에 throw한다. 원자료를 갱신(예: 2026년 추가)해도 `names.json`의 `meta.eras.future.sourceYears`는 **직접 고치기 전까지 바뀌지 않는다**(시대 설정과 함께 바뀌어야 하므로). 시대 범위를 바꾸면 `birthTable.ts`와 `names.json`의 `meta.eras.*.birthYears`를 같이 고치고, 두 값이 같은지는 `tests/names.test.ts`가 확인한다.
- **`names.json`에 남은 것**: 지난 세상 연대 풀(1950~1980년대), 성씨(2015 인구주택총조사 상위 10, 가중치), 출처·검증 수준·주의사항 meta, 타이틀 출처 표기 문구(`meta.attribution`). 언론·집계 사이트 기반이던 1990~2020년대 연대 풀과 그 출처 설명은 도달할 수 없어 제거했다.
- **추첨**: 풀 안에서 균등. 시드 RNG만 사용한다(`Math.random` 없음).
- **출처 표기**: 이용 조건(1절)에 따라 타이틀 화면 하단에 `meta.attribution`을 작게 표시하고 원자료의 `meta.url`로 링크한다(`src/screens/TitleScreen.tsx`). 표기는 공식 통계를 쓰는 **지금 세상·다가올 세상**의 이름 출처로 한정했다 — 지난 세상 이름은 통계가 아닌 추정이 섞여 있어 법원 통계 출처로 표기하지 않는다. 문구가 원자료의 `meta.suggestedAttribution` 요소(기관·서비스명·기준·조회일)를 담는지는 `tests/names.test.ts`·`e2e/title.spec.ts`가 대조한다.
- **동명 금지 필터**(R-023): 성+이름이 `src/data/forbiddenNames.json`(전·현직 대통령과 배우자, 북한 최고지도자 29개)에 걸리면 같은 풀에서 이름만 다시 뽑는다. 현재 성씨 표 × 모든 풀에서 실제 만들어질 수 있는 조합은 지난 세상 여자 풀의 `박정희`·`김정숙`·`이순자`뿐이다(필터가 없으면 지난 세상 출생의 약 1%).
- **검증(독립 대조)**: 시대별 1000판 시뮬레이션이 `scourt-birth-names.json`·`names.json`을 테스트가 직접 읽어 만든 허용 목록과 이름을 100% 대조한다(구현의 풀 함수를 거치지 않음). `tests/names.test.ts` "이름이 출생 연도·성별 풀과 100% 일치 (1000판 시뮬레이션, 원자료 직접 대조)".

