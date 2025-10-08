import React, { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import WordDetail from './components/WordDetail';
import Vocabulary from './components/Vocabulary';

function App() {
  const [model, setModel] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isRealTimeDetection, setIsRealTimeDetection] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [selectedWord, setSelectedWord] = useState(null);
  const [status, setStatus] = useState('카메라를 시작하려면 "Start Camera" 버튼을 클릭하세요.');
  const [vocabulary, setVocabulary] = useState([]);
  const [isBackCamera, setIsBackCamera] = useState(true); // 후면 카메라 상태

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  // 컴포넌트 마운트 시 모델 로드 및 단어장 로드
  useEffect(() => {
    loadModel();
    loadVocabulary();
  }, []);

  // 모델 로드 (기본 설정으로 복원)
  const loadModel = async () => {
    try {
      setStatus('AI 모델을 로딩 중...');
      console.log('TensorFlow.js 백엔드:', tf.getBackend());
      
      // 가장 기본적인 설정으로 모델 로드
      const loadedModel = await cocoSsd.load();
      
      setModel(loadedModel);
      setStatus('AI 모델이 성공적으로 로드되었습니다!');
      console.log('COCO-SSD 모델이 로드되었습니다.');
      
    } catch (error) {
      console.error('모델 로드 실패:', error);
      setStatus(`모델 로드 실패: ${error.message}. 페이지를 새로고침해주세요.`);
    }
  };

  // 단어장 로드
  const loadVocabulary = () => {
    const saved = localStorage.getItem('english-vocabulary');
    if (saved) {
      setVocabulary(JSON.parse(saved));
    }
  };

  // 단어장 저장
  const saveVocabulary = (newVocabulary) => {
    setVocabulary(newVocabulary);
    localStorage.setItem('english-vocabulary', JSON.stringify(newVocabulary));
  };

  // 카메라 시작 (후면 카메라 우선)
  const startCamera = async () => {
    try {
      const facingMode = isBackCamera ? 'environment' : 'user';
      const cameraType = isBackCamera ? '후면' : '전면';
      
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: { ideal: facingMode }
          } 
        });
        setStatus(`${cameraType} 카메라가 시작되었습니다. 실시간 감지를 시작하거나 "Capture & Detect" 버튼을 클릭하세요.`);
      } catch (primaryCameraError) {
        console.log(`${cameraType} 카메라 접근 실패, 반대 카메라로 시도:`, primaryCameraError);
        
        // 반대 카메라로 폴백
        const fallbackFacingMode = isBackCamera ? 'user' : 'environment';
        const fallbackCameraType = isBackCamera ? '전면' : '후면';
        
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: { ideal: fallbackFacingMode }
          } 
        });
        setStatus(`${fallbackCameraType} 카메라가 시작되었습니다. 실시간 감지를 시작하거나 "Capture & Detect" 버튼을 클릭하세요.`);
        
        // 폴백 시 카메라 상태 업데이트
        setIsBackCamera(!isBackCamera);
      }
      
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play();
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      };

    } catch (error) {
      console.error('카메라 접근 실패:', error);
      setStatus('카메라에 접근할 수 없습니다. 브라우저 권한을 확인해주세요.');
    }
  };

  // 카메라 전환
  const switchCamera = async () => {
    if (!videoRef.current?.srcObject) {
      setStatus('먼저 카메라를 시작해주세요.');
      return;
    }

    try {
      // 현재 스트림 중지
      const currentStream = videoRef.current.srcObject;
      const tracks = currentStream.getTracks();
      tracks.forEach(track => track.stop());

      // 카메라 방향 전환
      setIsBackCamera(!isBackCamera);
      
      // 새로운 카메라로 재시작
      await startCamera();
    } catch (error) {
      console.error('카메라 전환 실패:', error);
      setStatus('카메라 전환에 실패했습니다.');
    }
  };

  // 카메라 중지
  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) {
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    setIsRealTimeDetection(false);
    setStatus('카메라가 중지되었습니다.');
    
    // 캔버스와 결과 초기화
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setPredictions([]);
  };

  // 객체 감지 (기본 설정으로 복원)
  const detectObjects = async (imageElement) => {
    if (!model) {
      setStatus('모델이 로드되지 않았습니다.');
      return;
    }

    if (isDetecting) {
      return; // 이미 감지 중이면 스킵
    }

    try {
      setIsDetecting(true);
      setStatus('객체를 감지하는 중...');
      
      console.log('객체 감지 시작...');
      console.log('이미지 요소:', imageElement);
      console.log('이미지 크기:', imageElement?.videoWidth, 'x', imageElement?.videoHeight);
      
      // 기본 설정으로 모델 감지 실행
      const predictions = await model.detect(imageElement);
      console.log('예측 결과:', predictions);
      
      setPredictions(predictions);
      
      // 캔버스에 바운딩 박스 그리기
      drawBoundingBoxes(predictions);
      
      setStatus(`${predictions.length}개의 객체가 감지되었습니다.`);
    } catch (error) {
      console.error('객체 감지 실패:', error);
      setStatus(`객체 감지 실패: ${error.message}`);
    } finally {
      setIsDetecting(false);
    }
  };



  // 바운딩 박스 그리기 (기본 설정)
  const drawBoundingBoxes = (predictions) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    // 캔버스 초기화
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    predictions.forEach((prediction, index) => {
      const [x, y, width, height] = prediction.bbox;
      const confidence = Math.round(prediction.score * 100);
      
      // 바운딩 박스 그리기
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);
      
      // 라벨 그리기
      ctx.fillStyle = '#00ff00';
      ctx.font = '16px Arial';
      ctx.fillText(`${prediction.class} (${confidence}%)`, x, y - 10);
      
      // 클릭 가능한 영역 표시를 위한 사각형
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y - 25, ctx.measureText(`${prediction.class} (${confidence}%)`).width, 20);
    });
  };

  // 신뢰도에 따른 CSS 클래스 반환
  const getConfidenceClass = (score) => {
    if (score >= 0.8) return 'high';
    if (score >= 0.6) return 'medium';
    if (score >= 0.4) return 'low';
    return 'very-low';
  };

  // 실시간 감지 토글 (기본 설정)
  const toggleRealTimeDetection = () => {
    if (!isRealTimeDetection) {
      setIsRealTimeDetection(true);
      setStatus('실시간 객체 감지가 시작되었습니다.');
      
      // 1초마다 객체 감지
      detectionIntervalRef.current = setInterval(() => {
        if (videoRef.current?.readyState === videoRef.current?.HAVE_ENOUGH_DATA) {
          // 이전 감지가 완료되지 않았으면 스킵
          if (!isDetecting) {
            detectObjects(videoRef.current);
          }
        }
      }, 1000);
    } else {
      setIsRealTimeDetection(false);
      setStatus('실시간 객체 감지가 중지되었습니다.');
      
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      
      // 캔버스 초기화
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      setPredictions([]);
    }
  };

  // 단어 선택
  const handleWordSelect = (word) => {
    setSelectedWord(word);
  };

  // 단어장에 추가
  const addToVocabulary = (word) => {
    if (!vocabulary.find(item => item.word === word)) {
      const newItem = {
        word,
        addedAt: new Date().toISOString(),
        id: Date.now()
      };
      saveVocabulary([...vocabulary, newItem]);
    }
  };

  // 단어장에서 제거
  const removeFromVocabulary = (id) => {
    const newVocabulary = vocabulary.filter(item => item.id !== id);
    saveVocabulary(newVocabulary);
  };

  // 캔버스 클릭 이벤트
  const handleCanvasClick = (event) => {
    if (predictions.length === 0) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 클릭된 객체 찾기
    predictions.forEach(prediction => {
      const [bx, by, bwidth, bheight] = prediction.bbox;
      const labelHeight = 25;
      const labelY = by - labelHeight;
      
      // 라벨 영역 클릭 확인
      if (x >= bx && x <= bx + bwidth && y >= labelY && y <= by) {
        handleWordSelect(prediction.class);
      }
    });
  };

  return (
    <div className="container">
      <h1 className="header">🎯 English Learning with AI</h1>
      
      <div className="video-container">
        <video ref={videoRef} id="video" autoPlay muted playsInline></video>
        <canvas 
          ref={canvasRef} 
          id="canvas"
          onClick={handleCanvasClick}
          style={{ pointerEvents: 'auto' }}
        ></canvas>
      </div>

      <div className="controls">
        <button onClick={startCamera}>📹 Start Camera</button>
        <button 
          onClick={switchCamera}
          disabled={!videoRef.current?.srcObject}
          style={{
            background: 'linear-gradient(45deg, #9b59b6, #8e44ad)',
            opacity: videoRef.current?.srcObject ? 1 : 0.5
          }}
        >
          {isBackCamera ? '🔄 전면 카메라로 전환' : '🔄 후면 카메라로 전환'}
        </button>
        <button 
          onClick={toggleRealTimeDetection}
          style={{
            background: isRealTimeDetection 
              ? 'linear-gradient(45deg, #ff6b6b, #ee5a24)' 
              : 'linear-gradient(45deg, #667eea, #764ba2)'
          }}
        >
          {isRealTimeDetection ? '🟢 Stop Real-time Detection' : '🔴 Start Real-time Detection'}
        </button>
        <button onClick={() => detectObjects(videoRef.current)}>📸 Capture & Detect</button>
        <button onClick={stopCamera}>⏹️ Stop Camera</button>
      </div>

      <div className="status">{status}</div>
      
      {/* 디버깅 정보 */}
      <div style={{ 
        background: '#f0f0f0', 
        padding: '10px', 
        margin: '10px 0', 
        borderRadius: '5px',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}>
        <strong>디버깅 정보:</strong><br/>
        User Agent: {navigator.userAgent}<br/>
        TensorFlow 백엔드: {tf.getBackend()}<br/>
        모델 상태: {model ? '로드됨' : '로드 안됨'}<br/>
        감지 중: {isDetecting ? '예' : '아니오'}<br/>
        실시간 감지: {isRealTimeDetection ? '활성' : '비활성'}<br/>
        예측 결과: {predictions.length}개<br/>
        비디오 상태: {videoRef.current?.readyState || '없음'}
      </div>

      <div className="detection-results">
        <h3>🔍 Detected Objects:</h3>
        {predictions.length === 0 ? (
          <div className="detection-item">감지된 객체가 없습니다.</div>
        ) : (
          predictions.map((prediction, index) => {
            const confidence = Math.round(prediction.score * 100);
            const confidenceClass = getConfidenceClass(prediction.score);
            
            return (
              <div key={index} className="detection-item">
                <span 
                  className="object-name" 
                  onClick={() => handleWordSelect(prediction.class)}
                >
                  {prediction.class}
                </span>
                <div>
                  <span className={`confidence ${confidenceClass}`}>
                    {confidence}%
                  </span>
                  <button 
                    className="save-button"
                    onClick={() => addToVocabulary(prediction.class)}
                    disabled={vocabulary.find(item => item.word === prediction.class)}
                  >
                    {vocabulary.find(item => item.word === prediction.class) ? '✓ 저장됨' : '💾 저장'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedWord && (
        <WordDetail 
          word={selectedWord} 
          onClose={() => setSelectedWord(null)}
          onSave={() => addToVocabulary(selectedWord)}
          isSaved={vocabulary.find(item => item.word === selectedWord)}
        />
      )}

      <Vocabulary 
        vocabulary={vocabulary}
        onRemove={removeFromVocabulary}
        onWordSelect={handleWordSelect}
      />
    </div>
  );
}

export default App;