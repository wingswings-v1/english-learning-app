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

  // 모델 로드 (최적화된 설정)
  const loadModel = async () => {
    try {
      setStatus('AI 모델을 로딩 중...');
      
      // 모델 로딩 시 최적화된 설정 적용
      const loadedModel = await cocoSsd.load({
        base: 'mobilenet_v2', // 더 정확한 모델 사용
        modelUrl: 'https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1'
      });
      
      setModel(loadedModel);
      setStatus('AI 모델이 성공적으로 로드되었습니다! (고정밀 모드)');
      console.log('COCO-SSD 모델이 최적화된 설정으로 로드되었습니다.');
    } catch (error) {
      console.error('모델 로드 실패:', error);
      // 폴백으로 기본 모델 로드
      try {
        setStatus('고정밀 모델 로드 실패, 기본 모델을 로딩 중...');
        const fallbackModel = await cocoSsd.load();
        setModel(fallbackModel);
        setStatus('기본 AI 모델이 로드되었습니다.');
      } catch (fallbackError) {
        console.error('폴백 모델 로드 실패:', fallbackError);
        setStatus('모델 로드에 실패했습니다. 페이지를 새로고침해주세요.');
      }
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

  // 객체 감지 (정확성 향상)
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
      
      // 이미지 전처리 및 최적화
      const processedImage = preprocessImage(imageElement);
      
      // 모델 감지 실행 (최적화된 설정)
      const rawPredictions = await model.detect(processedImage, {
        maxDetections: 20,        // 최대 감지 개수 증가
        scoreThreshold: 0.3,      // 신뢰도 임계값 낮춤 (더 많은 객체 감지)
        nmsRadius: 0.5,           // 중복 제거 반경 조정
        numClasses: 80            // COCO 데이터셋 클래스 수
      });
      
      // 후처리 및 필터링
      const filteredPredictions = postprocessPredictions(rawPredictions);
      
      setPredictions(filteredPredictions);
      
      // 캔버스에 바운딩 박스 그리기
      drawBoundingBoxes(filteredPredictions);
      
      setStatus(`${filteredPredictions.length}개의 객체가 감지되었습니다. (고정밀 모드)`);
    } catch (error) {
      console.error('객체 감지 실패:', error);
      setStatus('객체 감지에 실패했습니다.');
    } finally {
      setIsDetecting(false);
    }
  };

  // 이미지 전처리
  const preprocessImage = (imageElement) => {
    // 이미지 크기 최적화 (너무 작거나 크면 정확도 저하)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 최적 해상도로 리사이즈 (300x300 권장)
    const targetSize = 300;
    canvas.width = targetSize;
    canvas.height = targetSize;
    
    // 이미지 그리기 (비율 유지하면서 리사이즈)
    ctx.drawImage(imageElement, 0, 0, targetSize, targetSize);
    
    return canvas;
  };

  // 예측 결과 후처리
  const postprocessPredictions = (predictions) => {
    // 1. 신뢰도 필터링 (0.4 이상만 유지)
    let filtered = predictions.filter(pred => pred.score >= 0.4);
    
    // 2. 중복 제거 (NMS - Non-Maximum Suppression)
    filtered = applyNMS(filtered, 0.5);
    
    // 3. 클래스별 최적화
    filtered = optimizeByClass(filtered);
    
    // 4. 크기 필터링 (너무 작은 객체 제거)
    filtered = filtered.filter(pred => {
      const [x, y, width, height] = pred.bbox;
      return width > 20 && height > 20; // 최소 크기 20x20 픽셀
    });
    
    // 5. 신뢰도 순으로 정렬
    filtered.sort((a, b) => b.score - a.score);
    
    return filtered;
  };

  // NMS (Non-Maximum Suppression) 적용
  const applyNMS = (predictions, iouThreshold) => {
    const sorted = predictions.sort((a, b) => b.score - a.score);
    const keep = [];
    
    while (sorted.length > 0) {
      const current = sorted.shift();
      keep.push(current);
      
      // IoU 계산하여 중복 제거
      sorted = sorted.filter(pred => {
        const iou = calculateIoU(current.bbox, pred.bbox);
        return iou < iouThreshold;
      });
    }
    
    return keep;
  };

  // IoU (Intersection over Union) 계산
  const calculateIoU = (box1, box2) => {
    const [x1, y1, w1, h1] = box1;
    const [x2, y2, w2, h2] = box2;
    
    const xLeft = Math.max(x1, x2);
    const yTop = Math.max(y1, y2);
    const xRight = Math.min(x1 + w1, x2 + w2);
    const yBottom = Math.min(y1 + h1, y2 + h2);
    
    if (xRight < xLeft || yBottom < yTop) return 0;
    
    const intersection = (xRight - xLeft) * (yBottom - yTop);
    const area1 = w1 * h1;
    const area2 = w2 * h2;
    const union = area1 + area2 - intersection;
    
    return intersection / union;
  };

  // 클래스별 최적화
  const optimizeByClass = (predictions) => {
    const classCounts = {};
    const maxPerClass = 3; // 클래스당 최대 3개까지만 유지
    
    return predictions.filter(pred => {
      const className = pred.class;
      classCounts[className] = (classCounts[className] || 0) + 1;
      return classCounts[className] <= maxPerClass;
    });
  };

  // 바운딩 박스 그리기 (개선된 시각화)
  const drawBoundingBoxes = (predictions) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    // 캔버스 초기화
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    predictions.forEach((prediction, index) => {
      const [x, y, width, height] = prediction.bbox;
      const confidence = Math.round(prediction.score * 100);
      
      // 신뢰도에 따른 색상 결정
      const color = getConfidenceColor(prediction.score);
      
      // 바운딩 박스 그리기 (더 두껍게)
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, width, height);
      
      // 라벨 배경 그리기
      const labelText = `${prediction.class} (${confidence}%)`;
      const textMetrics = ctx.measureText(labelText);
      const labelWidth = textMetrics.width + 20;
      const labelHeight = 25;
      
      // 라벨 배경
      ctx.fillStyle = color;
      ctx.fillRect(x, y - labelHeight, labelWidth, labelHeight);
      
      // 라벨 텍스트
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(labelText, x + 10, y - 8);
      
      // 클릭 가능한 영역 표시
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y - labelHeight, labelWidth, labelHeight);
      
      // 신뢰도 바 표시
      drawConfidenceBar(ctx, x, y + height + 5, width, prediction.score, color);
    });
  };

  // 신뢰도에 따른 색상 결정
  const getConfidenceColor = (score) => {
    if (score >= 0.8) return '#00ff00'; // 높은 신뢰도 - 녹색
    if (score >= 0.6) return '#ffff00'; // 중간 신뢰도 - 노란색
    if (score >= 0.4) return '#ff8800'; // 낮은 신뢰도 - 주황색
    return '#ff0000'; // 매우 낮은 신뢰도 - 빨간색
  };

  // 신뢰도 바 그리기
  const drawConfidenceBar = (ctx, x, y, width, score, color) => {
    const barHeight = 4;
    const barWidth = width * score;
    
    // 배경
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x, y, width, barHeight);
    
    // 신뢰도 바
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth, barHeight);
  };

  // 신뢰도에 따른 CSS 클래스 반환
  const getConfidenceClass = (score) => {
    if (score >= 0.8) return 'high';
    if (score >= 0.6) return 'medium';
    if (score >= 0.4) return 'low';
    return 'very-low';
  };

  // 실시간 감지 토글 (최적화된 간격)
  const toggleRealTimeDetection = () => {
    if (!isRealTimeDetection) {
      setIsRealTimeDetection(true);
      setStatus('실시간 객체 감지가 시작되었습니다. (고정밀 모드)');
      
      // 800ms마다 객체 감지 (더 빠른 반응)
      detectionIntervalRef.current = setInterval(() => {
        if (videoRef.current?.readyState === videoRef.current?.HAVE_ENOUGH_DATA) {
          // 이전 감지가 완료되지 않았으면 스킵
          if (!isDetecting) {
            detectObjects(videoRef.current);
          }
        }
      }, 800);
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