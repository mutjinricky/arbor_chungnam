# 충남 공공데이터 원본 CSV

ETL 재현성을 위해 저장소에 커밋한 **원본 공공데이터** 파일들. `src/data/sites_real.json` (1,602개 사이트)은 이 파일들로부터 자동 생성됩니다.

## 데이터 출처

| 파일 | 데이터셋 | 제공기관 | 다운로드 |
|---|---|---|---|
| `pine_forest_chungnam.csv` | 충청남도 아름다운 100대 소나무숲 정보 | 산림청 | [data.go.kr/15032216](https://www.data.go.kr/data/15032216/fileData.do) |
| `충청남도 가로수길정보표준데이터.csv` | 충남 가로수길 (시점·종점 좌표·수종·식재년도) | 충청남도 (alldam) | [alldam.chungnam.go.kr PUB0000000000052](https://alldam.chungnam.go.kr/index.chungnam?menuCd=DOM_000000201001001001&publicdatapk=PUB0000000000052) |
| `충청남도_도시공원정보_20220330_*.csv` (통합본) | 전국도시공원정보표준데이터 (충남 시도 통합) | 행정안전부 표준 | [data.go.kr/15012890](https://www.data.go.kr/data/15012890/standard.do) |
| `충청남도_{시군명}_도시공원정보_*.csv` (15개 시군) | 위 표준의 시군별 개별 파일 | 각 시군청 | 위 페이지에서 시군별 다운로드 |

## 인코딩

- 소나무숲: **EUC-KR**
- 가로수길: **EUC-KR**
- 도시공원: **UTF-8 with BOM**

ETL이 자동 감지·디코딩 (`scripts/etl.mjs`의 `decodeBuffer` 함수).

## 라이선스

모든 데이터는 **공공데이터포털 이용표준 약관** (data.go.kr) / **충청남도 데이터포털 이용약관** (alldam.chungnam.go.kr) 에 따라 자유 이용·재배포 가능.

> 본 공공데이터는 공공데이터 이용표준 약관에 따라 자유롭게 활용할 수 있습니다. (출처 표시 권장)

## 재실행 방법

```bash
# data/source-csv/ + data/raw/ 모두 자동 스캔
node scripts/etl.mjs
```

`src/data/sites_real.json` 갱신됨.

## 사용자가 새 CSV 추가하려면

- **임시 추가** (gitignored): `data/raw/`에 두기
- **저장소 커밋** (재현성 위해): `data/source-csv/`에 두기

ETL은 두 폴더 모두 스캔하며, 같은 파일명이 양쪽에 있으면 `data/raw/`의 사용자 최신본을 우선합니다.
