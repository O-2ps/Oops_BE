const app = require('./src/app');
const { loadModels } = require('./src/services/faceAnalysisService');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    console.log('Face detection 모델 로딩 중...');
    await loadModels();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('서버 시작 실패:', err.message);
    console.error('models/ 디렉토리에 face-api.js 모델 파일이 필요합니다.');
    console.error('아래 명령어로 다운로드하세요:');
    console.error('  node scripts/downloadModels.js');
    process.exit(1);
  }
}

start();
