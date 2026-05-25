# DRYAD 충남 AI 수목관리 의사결정 대시보드

> 충남 1,602개 수목관리 대상의 위험도를 6개 공공데이터로 자동 산출하여,
> 지자체 공원녹지·산림녹지 담당자의 "어디를 먼저 관리할지" 의사결정을 지원하는 웹 SaaS.

**제14회 충남 공공데이터·AI활용 창업경진대회** 출품작 · 드라이어드(전 나무잇)

---

## 핵심 성과 (요약)

| 지표 | 값 |
|---|---|
| 충남 사이트 수 | **1,602개** (도시공원 1,235 + 가로수길 271 + 소나무숲 96) |
| 충남 시군 커버리지 | **15/15개 (100%)** |
| 공공데이터 출처 | **5개 API + 2개 표준데이터셋** |
| 6요인 실데이터 적용 사이트 | **1,313개 (82%)** |
| 연간 탄소 흡수량 추정 | **약 19.4만 tCO₂/년** (≈ 승용차 8만대 배출량) |

## 활용 공공데이터

- [산림청 산불위험예보 OpenAPI](https://www.data.go.kr/data/15084817/openapi.do) — 실시간 산불위험지수
- [기상청 단기예보 OpenAPI](https://www.data.go.kr/data/15084084/openapi.do) — 시군 격자별 48h 기상
- [농진청 토양도 V2 OpenAPI](https://www.data.go.kr/data/15144105/openapi.do) — 토성·자갈·경사
- [KOSIS 산림청 산불통계](https://kosis.kr/statHtml/statHtml.do?orgId=136&tblId=DT_136N_010002) — 시도 단위 10년 평균
- [전국도시공원정보표준데이터](https://www.data.go.kr/data/15012890/standard.do) — 충남 15개 시군 도시공원
- [충청남도 가로수길정보표준데이터](https://alldam.chungnam.go.kr/) — 가로수길 271개
- [충청남도 100대 소나무숲 정보](https://www.data.go.kr/data/15032216/fileData.do) — 소나무숲 96개

---

## 빠른 실행

```bash
# 의존성 설치
npm install

# 개발 서버
npm run dev       # http://localhost:5173

# 정적 빌드
npm run build
```

> 1,602개 사이트의 ETL 결과(`src/data/sites_real.json`)와 외부 API 캐시(`data/external/*.json`)가
> 저장소에 포함되어 있어, **API 키 없이도 즉시 시연 가능**합니다.

## 데이터 갱신 (선택)

최신 산림청·기상청·농진청 데이터로 새로 갱신하려면 [data.go.kr](https://www.data.go.kr/) 서비스키 발급 후:

```bash
# 1. .env 파일에 키 저장
echo "DATA_GO_KR_KEY=your_service_key_here" > .env

# 2. 외부 API 자동 수집 (산불·기상·토양·산불통계)
node --env-file=.env scripts/fetchExternal.mjs

# 3. ETL 재실행 (CSV + 외부 API 통합)
node scripts/etl.mjs

# 4. PDF 보고서 재생성 (선택)
node scripts/md-to-pdf.mjs
```

원본 공공데이터 CSV를 추가하려면 `data/raw/`에 두면 ETL이 자동 인식.

---

## 주요 기능

### 데이터 통합
- 충남 7개 공공데이터셋 자동 통합 (CSV 인코딩 EUC-KR/UTF-8 자동 감지)
- 시군별 위경도 보정, 충남 경계 밖 이상치 자동 처리
- 좌표·도로명·관리기관명 다중 매칭

### 6요인 위험도 산정
- 기상 스트레스 (실시간) · 산불 위험 (실시간) · 식생·수종 취약성 · 토양·지형 · 관리공백·노후도 · 피해 이력
- 가중평균 + 등급 분류 (A~D)
- 각 요인의 데이터 출처를 인앱 모달과 [SCORING.md](SCORING.md)에 100% 공개

### 시각화
- Leaflet 지도 + 클러스터링 마커
- 시군별 6요인 히트맵 (15개 시군 × 6요인 = 90셀)
- 우선순위 테이블 (위험도·산불·관리공백·민원 다중 정렬)

### 워크플로우
- 검색 (대상명·주소·수종·관리기관)
- 사이트별 PDF 보고서 1클릭 다운로드 (jsPDF + html2canvas)
- 관리이력 입력 모달 (전정·방제·관수·토양개량·제거·보식·현장점검)
- 새올·신문고 형식 민원 CSV 업로드 → 좌표 기반 자동 매칭 + 위험도 가산점

### 정직성
- 모든 산식·임계값·가중치 공개 (SCORING.md, 인앱 모달)
- 데이터 출처별 `실데이터` / `추정` / `시뮬레이션` 배지
- 좌표 근사 사이트 별도 표시
- 데이터 신선도 (마지막 갱신 시각) 인앱 표시

---

## 기술 스택

- React 18 + Vite 5
- Leaflet · react-leaflet · react-leaflet-cluster
- Tailwind CSS · Pretendard
- jsPDF + html2canvas (PDF 보고서)
- Node.js ETL (csv-parse + iconv-lite)
- md-to-pdf + Puppeteer (문서 PDF 변환)

## 디렉토리

```
dryad-mvp/
├── data/
│   ├── raw/                  # 원본 공공데이터 CSV (gitignored)
│   └── external/             # OpenAPI 응답 캐시 (커밋 포함, 키 없이 시연 가능)
├── scripts/
│   ├── fetchExternal.mjs     # 산림청·기상청·농진청 API 자동 수집
│   ├── etl.mjs               # CSV + 외부 API → sites_real.json
│   └── md-to-pdf.mjs         # 문서 PDF 변환
├── src/
│   ├── App.jsx               # 메인 레이아웃
│   ├── components/           # Header, MapView, HeatmapView, SiteDetail, …
│   ├── lib/                  # risk · recommend · speciesMatrix · carbon · csvIngest
│   └── data/                 # 사이트·시군 데이터 + 통합 로더
├── PRODUCT.md / .pdf         # 제품 설명서
├── SCORING.md / .pdf         # 6요인 산식 명세
└── README.md
```

---

## 문서

- [PRODUCT.md](PRODUCT.md) — 제품 설명서 (사업제안서 보조 자료)
- [SCORING.md](SCORING.md) — 6요인 위험도 산정 산식 명세 (정직성 분류 포함)

## 한계 및 향후 계획

- AI 분석은 현재 규칙 기반. IR덱의 처방적 AI (Poisson 산불 예측·CEI·SDR·WSI·CSM) 은 운영 데이터 누적 후 학습 단계
- 사이트 단위 (단목 단위 아님). 수목 EMR은 2027 로드맵
- 민원·관리이력은 브라우저 메모리 기반. 운영 시 Supabase·자체 DB 연계 예정
- 본 시스템의 추천·점수는 **행정 판단 보조용**이며, 수목 질병의 확정 진단이 아닙니다.

## 라이선스 / 데이터 출처

- 소스코드: 출품작 (라이선스 별도 협의)
- 활용 공공데이터: data.go.kr 공공데이터 이용표준 약관 / alldam.chungnam.go.kr / KOSIS 이용약관 준수

---

*드라이어드 · 충남 공공데이터·AI 창업경진대회 출품 MVP · 2026*
