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
    recommendations: ['고보습 크림·세럼 사용', '약산성 저자극 클렌저 사용', '알코올 함유 제품 피하기', '실내 가습기 사용 권장'],
  },
  oily: {
    label: '지성 피부',
    characteristics: ['피지 분비가 많고 번들거림', '모공이 크고 막히기 쉬움', '여드름·블랙헤드가 생기기 쉬움'],
    recommendations: ['가벼운 젤·로션 타입 보습제 사용', '폼 클렌저로 이중세안 권장', '논코메도제닉 제품 선택', '하루 2회 세안 유지'],
  },
  combination: {
    label: '복합성 피부',
    characteristics: ['T존은 번들거리고 U존은 건조함', '부위별 피부 상태가 다름', '계절·환경에 따라 변화가 큼'],
    recommendations: ['T존·U존을 나눠 관리', 'T존엔 가벼운 제품, U존엔 보습 집중', '수분 에센스로 전체 밸런스 유지'],
  },
  normal: {
    label: '중성 피부',
    characteristics: ['유·수분 밸런스가 잘 맞음', '트러블이 적고 피부결이 고름', '피부 상태가 안정적'],
    recommendations: ['현재 루틴 유지', '자외선 차단제 꼼꼼히 사용', '계절별 보습 강도 조절'],
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
 * 핵심 3요소: 탄력(elasticity), 수분도(moisture), 색소침착(pigmentation)
 *
 * 각 요소 score 0~4: 0=전혀없음(젊은 피부), 4=매우심함(노화)
 * 중간값(2) 기준으로 delta 계산 → 실제나이에 가감
 *
 * 탄력 가중치 2.5: 콜라겐 감소·주름이 노화에 가장 직접적
 * 수분도 가중치 1.5: 건조·잔주름에 영향
 * 색소침착 가중치 2.0: 자외선·생활습관 누적 결과
 *
 * 결과 범위: actualAge ± 12년
 */
function calcSkinAge(actualAge, s) {
  const elasticityDelta   = (s.elasticity   - 2) * 2.5;
  const moistureDelta     = (s.moisture     - 2) * 1.5;
  const pigmentationDelta = (s.pigmentation - 2) * 2.0;

  const delta = Math.round(elasticityDelta + moistureDelta + pigmentationDelta);
  return Math.max(10, Math.min(99, actualAge + delta));
}

function analyzeSkin(actualAge, answers) {
  const s = getScores(answers);
  const skinType = classifySkinType(s);
  const skinAge  = calcSkinAge(actualAge, s);
  const info     = SKIN_TYPE_INFO[skinType];

  return {
    skinType,
    skinTypeLabel: info.label,
    skinAge,
    actualAge,
    ageDiff: skinAge - actualAge,
    characteristics:  info.characteristics,
    recommendations:  info.recommendations,
  };
}

module.exports = { QUESTIONS, OPTIONS, analyzeSkin };
