const QUESTIONS = [
  {
    id: 'dryness',
    question: '세안을 하고 아무것도\n바르지 않으면 건조하다.',
  },
  {
    id: 'oiliness',
    question: '시간이 지나면\n얼굴이 번들거린다.',
  },
  {
    id: 'acne',
    question: '여드름이나 트러블이\n자주 생긴다.',
  },
  {
    id: 'tzone',
    question: '코나 이마만\n번들거린다.',
  },
  {
    id: 'sensitivity',
    question: '새 화장품을 사용하면\n피부가 쉽게 붉어진다.',
  },
];

// 모든 문항 공통 선택지
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
    dryness:     SCORE_MAP[answers.dryness]     ?? 2,
    oiliness:    SCORE_MAP[answers.oiliness]    ?? 2,
    acne:        SCORE_MAP[answers.acne]        ?? 2,
    tzone:       SCORE_MAP[answers.tzone]       ?? 2,
    sensitivity: SCORE_MAP[answers.sensitivity] ?? 2,
  };
}

function classifySkinType(s) {
  // T존만 번들 → 복합성
  if (s.tzone >= 3 && s.oiliness <= 2) return 'combination';
  // 전체 번들 → 지성
  if (s.oiliness >= 3 && s.dryness <= 1) return 'oily';
  // 건조 → 건성
  if (s.dryness >= 3 && s.oiliness <= 1) return 'dry';
  // 번들 + 건조 동시 → 복합성
  if (s.oiliness >= 2 && s.dryness >= 2) return 'combination';
  return 'normal';
}

function calcSkinAge(actualAge, s) {
  // 피부 컨디션 이슈 점수 (0~12)
  const issueScore = s.dryness + s.acne + s.sensitivity;
  let delta;
  if (issueScore >= 9)      delta = 5;
  else if (issueScore >= 6) delta = 3;
  else if (issueScore >= 3) delta = 1;
  else if (issueScore <= 1) delta = -3;
  else                      delta = 0;

  return Math.max(10, Math.min(99, actualAge + delta));
}

function analyzeSkin(actualAge, answers) {
  const s = getScores(answers);
  const skinType = classifySkinType(s);
  const skinAge = calcSkinAge(actualAge, s);
  const info = SKIN_TYPE_INFO[skinType];

  return {
    skinType,
    skinTypeLabel: info.label,
    skinAge,
    actualAge,
    ageDiff: skinAge - actualAge,
    characteristics: info.characteristics,
    recommendations: info.recommendations,
  };
}

module.exports = { QUESTIONS, OPTIONS, analyzeSkin };
