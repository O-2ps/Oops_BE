require('@tensorflow/tfjs-node');
const { createCanvas, loadImage } = require('canvas');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const faceapi = require('face-api.js');
const { extractAvgSkinColor, classifyPersonalColor } = require('../utils/colorAnalyzer');

const MODEL_PATH = path.join(__dirname, '../../models');

let modelsLoaded = false;

async function loadModels() {
  if (modelsLoaded) return;

  // face-api.js를 Node.js canvas 환경에 맞게 패치
  const { Canvas, Image, ImageData } = require('canvas');
  faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH),
      faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH),
    ]);
    modelsLoaded = true;
    console.log('Face detection models loaded');
  } catch (err) {
    throw new Error(`모델 로드 실패: ${err.message}. models/ 디렉토리에 face-api.js 모델을 다운로드하세요.`);
  }
}

/**
 * 68개 랜드마크에서 양쪽 볼 영역 좌표 추출
 * 참고 레포와 동일한 방식 (cheek landmarks: 1-4, 12-15)
 */
function getCheekRegions(landmarks, imgWidth, imgHeight) {
  const positions = landmarks.positions;

  // 왼쪽 볼: 랜드마크 1~5 (하관 좌측)
  const leftCheekPoints = [1, 2, 3, 4, 5].map(i => positions[i]);
  // 오른쪽 볼: 랜드마크 11~15 (하관 우측)
  const rightCheekPoints = [11, 12, 13, 14, 15].map(i => positions[i]);

  function getBoundingBox(points, padding = 10) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return {
      x: Math.max(0, Math.min(...xs) - padding),
      y: Math.max(0, Math.min(...ys) - padding),
      w: Math.min(imgWidth, Math.max(...xs) + padding) - Math.max(0, Math.min(...xs) - padding),
      h: Math.min(imgHeight, Math.max(...ys) + padding) - Math.max(0, Math.min(...ys) - padding),
    };
  }

  return {
    left: getBoundingBox(leftCheekPoints),
    right: getBoundingBox(rightCheekPoints),
  };
}

/**
 * Canvas에서 특정 영역의 픽셀 데이터 추출
 */
function getRegionPixels(canvas, region) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(region.x, region.y, region.w, region.h);
  return imageData.data;
}

/**
 * 이미지 버퍼를 받아 퍼스널 컬러 분석 수행
 */
async function analyzePersonalColor(imageBuffer) {
  await loadModels();

  // sharp로 이미지 정규화 (최대 1024px)
  const normalizedBuffer = await sharp(imageBuffer)
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .toFormat('png')
    .toBuffer();

  const img = await loadImage(normalizedBuffer);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // 얼굴 감지 + 68개 랜드마크 추출
  const detections = await faceapi
    .detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks();

  if (!detections || detections.length === 0) {
    throw new Error('얼굴을 감지할 수 없습니다. 정면 얼굴이 잘 보이는 이미지를 사용해주세요.');
  }

  // 가장 큰 얼굴 선택
  const detection = detections.reduce((a, b) =>
    a.detection.box.area > b.detection.box.area ? a : b
  );

  const { landmarks, detection: faceDetection } = detection;
  const cheeks = getCheekRegions(landmarks, img.width, img.height);

  // 양쪽 볼 픽셀 추출 및 평균 색상 계산
  const leftPixels = getRegionPixels(canvas, cheeks.left);
  const rightPixels = getRegionPixels(canvas, cheeks.right);

  // 두 볼 픽셀을 합산하여 평균
  const combinedPixels = new Uint8ClampedArray(leftPixels.length + rightPixels.length);
  combinedPixels.set(leftPixels, 0);
  combinedPixels.set(rightPixels, leftPixels.length);

  const avgColor = extractAvgSkinColor(combinedPixels, cheeks.left.w + cheeks.right.w, Math.max(cheeks.left.h, cheeks.right.h));
  const result = classifyPersonalColor(avgColor);

  return {
    ...result,
    face: {
      x: Math.round(faceDetection.box.x),
      y: Math.round(faceDetection.box.y),
      width: Math.round(faceDetection.box.width),
      height: Math.round(faceDetection.box.height),
      confidence: parseFloat(faceDetection.score.toFixed(3)),
    },
    cheekRegions: {
      left: cheeks.left,
      right: cheeks.right,
    },
  };
}

module.exports = { analyzePersonalColor, loadModels };
