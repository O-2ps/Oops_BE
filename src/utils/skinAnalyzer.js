const QUESTIONS = [
  {
    id: 'elasticity',
    question: '피부가 처지거나\n잔주름이 느껴진다.',
  },
  {
    id: 'moisture',
    question: '세안 후 아무것도\n바르지 않으면 건조하고 푸석하다.',
  },
  {
    id: 'pigmentation',
    question: '잡티나 칙칙한\n피부톤이 신경 쓰인다.',
  },
  {
    id: 'oiliness',
    question: '시간이 지나면\n얼굴이 번들거린다.',
  },
  {
    id: 'sensitivity',
    question: '새 화장품을 사용하면\n피부가 쉽게 붉어진다.',
  },
];

const OPTIONS = [
  { value: 'strongly_agree',    label: '매우 그렇다',    score: 4 },
  { value: 'agree',             label: '그렇다',         score: 3 },
  { value: 'neutral',           label: '보통이다',       score: 2 },
  { value: 'disagree',          label: '그렇지 않다',    score: 1 },
  { value: 'strongly_disagree', label: '전혀 아니다',    score: 0 },
];

const SCORE_MAP = Object.fromEntries(OPTIONS.map(o => [o.value, o.score]));

const SKIN_TYPE_INFO = {
  dry: {
    label: '건성 피부',
    characteristics: ['세안 후 당기고 건조함', '각질이 생기기 쉬움', '유분·수분이 모두 부족'],
    recommendations: [
      '히알루론산·세라마이드 함유 고보습 크림·세럼 사용',
      '약산성(pH 5.5) 저자극 클렌저 사용',
      '알코올·SLS(황산염) 함유 제품 피하기',
      '세안 후 3분 이내 수분 공급',
      '실내 가습기로 40~60% 습도 유지',
    ],
  },
  oily: {
    label: '지성 피부',
    characteristics: ['피지 분비가 많고 번들거림', '모공이 크고 막히기 쉬움', '여드름·블랙헤드가 생기기 쉬움'],
    recommendations: [
      '나이아신아마이드·살리실산 함유 제품으로 피지 조절',
      '가벼운 수분 젤·워터 타입 보습제 사용',
      '폼 클렌저로 이중세안 권장',
      '논코메도제닉(non-comedogenic) 제품 선택',
      '과도한 세안은 피지 과분비를 유발할 수 있으니 하루 2회로 제한',
    ],
  },
  combination: {
    label: '복합성 피부',
    characteristics: ['T존은 번들거리고 U존은 건조함', '부위별 피부 상태가 다름', '계절·환경에 따라 변화가 큼'],
    recommendations: [
      'T존엔 가벼운 젤 타입, U존엔 크림 타입 보습제 구분 사용',
      '수분 에센스로 전체 밸런스 유지',
      '주 1~2회 T존 집중 모공 케어',
      '포어 미니마이저 세럼 활용',
    ],
  },
  normal: {
    label: '중성 피부',
    characteristics: ['유·수분 밸런스가 잘 맞음', '트러블이 적고 피부결이 고름', '피부 상태가 안정적'],
    recommendations: [
      '현재 루틴 유지',
      '자외선 차단제(SPF 30+) 매일 꼼꼼히 사용',
      '비타민 C 세럼으로 광채 유지',
      '계절별 보습 강도 조절',
    ],
  },
};

function getScores(answers) {
  return {
    elasticity:   SCORE_MAP[answers.elasticity]   ?? 2,
    moisture:     SCORE_MAP[answers.moisture]     ?? 2,
    pigmentation: SCORE_MAP[answers.pigmentation] ?? 2,
    oiliness:     SCORE_MAP[answers.oiliness]     ?? 2,
    sensitivity:  SCORE_MAP[answers.sensitivity]  ?? 2,
  };
}

function classifySkinType(s) {
  const isDry  = s.moisture  >= 3;
  const isOily = s.oiliness  >= 3;

  if (isDry && isOily)  return 'combination';
  if (isDry && !isOily) return 'dry';
  if (!isDry && isOily) return 'oily';
  return 'normal';
}

/**
 * 피부나이 = 실제나이와 무관한 피부 노화 상태 지표
 *
 * 탄력(×2.5): 콜라겐 감소·주름이 노화에 가장 직접적
 * 수분도(×1.5): 건조·잔주름에 영향
 * 색소침착(×2.0): 자외선·생활습관 누적 결과
 * 지성도(×-0.8): 피지막이 외부 자극 차단 → 지성 피부는 노화 지연 경향
 *
 * 결과 범위: actualAge ± 15년
 */
function calcSkinAge(actualAge, s) {
  const elasticityDelta   = (s.elasticity   - 2) * 2.5;
  const moistureDelta     = (s.moisture     - 2) * 1.5;
  const pigmentationDelta = (s.pigmentation - 2) * 2.0;
  const oilinessDelta     = (s.oiliness     - 2) * (-0.8);

  const delta = Math.round(elasticityDelta + moistureDelta + pigmentationDelta + oilinessDelta);
  return Math.max(10, Math.min(99, actualAge + delta));
}

function analyzeSkin(actualAge, answers) {
  const s = getScores(answers);
  const skinType    = classifySkinType(s);
  const skinAge     = calcSkinAge(actualAge, s);
  const info        = SKIN_TYPE_INFO[skinType];
  const isSensitive = s.sensitivity >= 3;

  const characteristics = [...info.characteristics];
  const recommendations = [...info.recommendations];

  if (isSensitive) {
    characteristics.push('새 화장품에 피부가 민감하게 반응함');
    recommendations.push(
      '향료·알코올 무첨가(fragrance-free) 제품 사용',
      '새 제품은 48시간 패치 테스트 후 사용',
    );
  }

  return {
    skinType,
    skinTypeLabel: info.label,
    skinAge,
    actualAge,
    ageDiff: skinAge - actualAge,
    isSensitive,
    characteristics,
    recommendations,
  };
}

module.exports = { QUESTIONS, OPTIONS, SKIN_TYPE_INFO, analyzeSkin };
