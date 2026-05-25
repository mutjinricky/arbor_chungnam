// 충남 15개 시군의 대표 PNU 코드 매핑
//
// 농진청 토양도 V2 API는 PNU(지번코드, 19자리)로만 토양 단면정보를 조회한다.
// 우리 데이터는 위경도만 있고 PNU는 없으므로, 각 시군마다 시청·군청 소재 법정동의
// 대표 지번 1건을 샘플링해 그 시군 전체의 평균 토양 조건 proxy로 사용한다.
// 정밀 산출은 VWorld 지오코딩 API 또는 행정구역별 PNU 일괄 변환이 필요 (Tier 3 작업).
//
// PNU 19자리 구성:
//   법정동코드(10) + 산/일반(1: 1=일반·2=산) + 본번(4) + 부번(4)
//   예: 4413010500 + 1 + 0001 + 0000 = 4413010500100010000
//
// 본번 0001(1번지)은 대부분 시군 중심부에 데이터가 존재할 가능성이 높음.
// 만약 API가 "데이터 없음(코드 301)"을 반환하면 본번을 10, 100, 1000 식으로 늘려가며 재시도.

export const REPRESENTATIVE_PNU = {
  // ───── 시(8개) ─────
  천안시: {
    pnu: '4413134021100010000',
    bjdong: '4413134021', // 천안시 동남구 광덕면 광덕리
    name: '천안시 동남구 광덕면 광덕리 1-0',
    note: '도심(사직동)은 농진청 토양도 미수록 → 외곽 산림 인접지로 대체'
  },
  공주시: {
    pnu: '4415010800100010000',
    bjdong: '4415010800',
    name: '공주시 봉황동 1-0',
    note: '시청 소재지'
  },
  보령시: {
    pnu: '4418010800100010000',
    bjdong: '4418010800',
    name: '보령시 동대동 1-0',
    note: '시청 소재지'
  },
  아산시: {
    pnu: '4420010700100010000',
    bjdong: '4420010700',
    name: '아산시 온양1동 1-0',
    note: '시청 소재지'
  },
  서산시: {
    pnu: '4421010300100010000',
    bjdong: '4421010300',
    name: '서산시 동문1동 1-0',
    note: '시청 소재지'
  },
  논산시: {
    pnu: '4423010500100010000',
    bjdong: '4423010500',
    name: '논산시 화지동 1-0',
    note: '시청 소재지'
  },
  계룡시: {
    pnu: '4425010100100010000',
    bjdong: '4425010100',
    name: '계룡시 금암동 1-0',
    note: '시청 소재지'
  },
  당진시: {
    pnu: '4427010600100010000',
    bjdong: '4427010600',
    name: '당진시 당진1동 1-0',
    note: '시청 소재지'
  },

  // ───── 군(7개) ─────
  금산군: {
    pnu: '4471025025100010000',
    bjdong: '4471025025',
    name: '금산군 금산읍 상리 1-0',
    note: '군청 소재지'
  },
  부여군: {
    pnu: '4476025025100010000',
    bjdong: '4476025025',
    name: '부여군 부여읍 동남리 1-0',
    note: '군청 소재지'
  },
  서천군: {
    pnu: '4477025026100010000',
    bjdong: '4477025026',
    name: '서천군 서천읍 군사리 1-0',
    note: '군청 소재지'
  },
  청양군: {
    pnu: '4479025025100010000',
    bjdong: '4479025025',
    name: '청양군 청양읍 읍내리 1-0',
    note: '군청 소재지'
  },
  홍성군: {
    pnu: '4480025025100010000',
    bjdong: '4480025025',
    name: '홍성군 홍성읍 오관리 1-0',
    note: '군청 소재지'
  },
  예산군: {
    pnu: '4481025025100010000',
    bjdong: '4481025025',
    name: '예산군 예산읍 예산리 1-0',
    note: '군청 소재지'
  },
  태안군: {
    pnu: '4482525025100010000',
    bjdong: '4482525025',
    name: '태안군 태안읍 동문리 1-0',
    note: '군청 소재지'
  }
}

/**
 * 시군 코드 리스트(또는 시군명 리스트)를 입력받아 {시군: PNU} 매핑을 반환한다.
 * 외부 호출 없이 정적 테이블만 사용.
 *
 * @param {string[]} cities - ['천안시', '공주시', ...] 형태
 * @returns {Object<string, string>} {시군: PNU_19자리}
 */
export function buildPnuLookup(cities) {
  const result = {}
  for (const city of cities) {
    const entry = REPRESENTATIVE_PNU[city]
    if (entry) {
      result[city] = entry.pnu
    }
  }
  return result
}

/**
 * 충남 15개 시군 전체 매핑을 반환 (편의 함수)
 */
export function allChungnamPnu() {
  const result = {}
  for (const [city, entry] of Object.entries(REPRESENTATIVE_PNU)) {
    result[city] = entry.pnu
  }
  return result
}

/**
 * PNU 19자리 유효성 검증
 */
export function validatePnu(pnu) {
  if (typeof pnu !== 'string') return false
  if (!/^\d{19}$/.test(pnu)) return false
  const sanIlban = pnu[10]
  if (sanIlban !== '1' && sanIlban !== '2') return false
  return true
}
