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
  const [detectionMode, setDetectionMode] = useState('normal'); // normal, enhanced

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  // 컴포넌트 마운트 시 모델 로드 및 단어장 로드
  useEffect(() => {
    loadModel();
    loadVocabulary();
  }, []);

  // 모델 로드 (향상된 모델 사용)
  const loadModel = async () => {
    try {
      setStatus('AI 모델을 로딩 중...');
      console.log('TensorFlow.js 백엔드:', tf.getBackend());
      
      // 더 정확한 모델 로드 시도
      let loadedModel;
      try {
        // MobileNet v2 기반 모델 시도 (더 정확함)
        loadedModel = await cocoSsd.load({
          base: 'mobilenet_v2'
        });
        setStatus('고정밀 AI 모델이 로드되었습니다!');
        console.log('MobileNet v2 기반 COCO-SSD 모델이 로드되었습니다.');
      } catch (v2Error) {
        console.log('v2 모델 실패, v1으로 폴백:', v2Error);
        // 폴백으로 기본 모델 사용
        loadedModel = await cocoSsd.load();
        setStatus('기본 AI 모델이 로드되었습니다.');
        console.log('기본 COCO-SSD 모델이 로드되었습니다.');
      }
      
      setModel(loadedModel);
      
      // 인식 가능한 클래스 목록 표시
      displayAvailableClasses();
      
    } catch (error) {
      console.error('모델 로드 실패:', error);
      setStatus(`모델 로드 실패: ${error.message}. 페이지를 새로고침해주세요.`);
    }
  };

  // 인식 가능한 클래스 목록 표시
  const displayAvailableClasses = () => {
    const cocoClasses = [
      'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
      'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
      'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
      'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
      'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
      'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
      'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
      'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop',
      'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
      'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
    ];
    
    console.log('COCO-SSD 인식 가능한 클래스들:', cocoClasses);
    console.log('총', cocoClasses.length, '개 클래스');
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

  // 객체 감지 (향상된 인식)
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
      console.log('이미지 크기:', imageElement?.videoWidth, 'x', imageElement?.videoHeight);
      
      // 이미지 전처리 (성능 최적화)
      const processedImage = preprocessImageForDetection(imageElement);
      
      // 감지 모드에 따른 설정
      const detectionConfig = detectionMode === 'enhanced' ? {
        maxDetections: 20,        // 향상 모드: 더 많은 감지
        scoreThreshold: 0.25,     // 향상 모드: 더 낮은 임계값
        nmsRadius: 0.3,           // 향상 모드: 더 엄격한 중복 제거
        numClasses: 80
      } : {
        maxDetections: 10,        // 일반 모드: 기본 감지
        scoreThreshold: 0.4,      // 일반 모드: 기본 임계값
        nmsRadius: 0.4,           // 일반 모드: 기본 중복 제거
        numClasses: 80
      };
      
      const predictions = await model.detect(processedImage, detectionConfig);
      
      console.log('원시 예측 결과:', predictions);
      
      // 결과 필터링 및 클래스 매핑
      const filteredPredictions = predictions
        .filter(pred => pred.score >= 0.4)
        .map(pred => enhanceObjectRecognition(pred));
      
      console.log('향상된 예측 결과:', filteredPredictions);
      
      setPredictions(filteredPredictions);
      
      // 캔버스에 바운딩 박스 그리기
      drawBoundingBoxes(filteredPredictions);
      
      setStatus(`${filteredPredictions.length}개의 객체가 감지되었습니다.`);
    } catch (error) {
      console.error('객체 감지 실패:', error);
      setStatus(`객체 감지 실패: ${error.message}`);
    } finally {
      setIsDetecting(false);
    }
  };

  // 객체 인식 향상 (클래스 매핑 및 확장)
  const enhanceObjectRecognition = (prediction) => {
    const { class: originalClass, score, bbox } = prediction;
    
    // 클래스 매핑 및 확장
    const classMappings = {
      // 가구 관련
      'chair': ['chair', 'stool', 'seat', '행거', 'hanger'],
      'dining table': ['table', 'desk', 'dining table', '책상'],
      'bed': ['bed', 'mattress', '침대'],
      
      // 생활용품
      'scissors': ['scissors', '빨래집게', 'clothespin', 'clip'],
      'handbag': ['bag', 'handbag', 'purse', '가방'],
      'book': ['book', 'magazine', '책'],
      'bottle': ['bottle', 'container', '병'],
      'cup': ['cup', 'mug', 'glass', '컵'],
      'bowl': ['bowl', 'dish', 'plate', '그릇'],
      
      // 의류 관련
      'tie': ['tie', 'necktie', '넥타이'],
      'handbag': ['handbag', 'purse', 'bag', '손가방'],
      
      // 전자제품
      'cell phone': ['phone', 'smartphone', 'cell phone', '휴대폰'],
      'laptop': ['laptop', 'computer', 'notebook', '노트북'],
      'tv': ['tv', 'television', 'monitor', '텔레비전'],
      
      // 기타
      'clock': ['clock', 'watch', '시계'],
      'vase': ['vase', 'pot', '화분'],
      'teddy bear': ['toy', 'doll', 'teddy bear', '인형']
    };
    
    // 원본 클래스가 매핑에 있으면 확장된 클래스들 추가
    if (classMappings[originalClass]) {
      const enhancedClasses = classMappings[originalClass];
      // 가장 적절한 클래스 선택 (첫 번째가 가장 일반적)
      const enhancedClass = enhancedClasses[0];
      
      return {
        ...prediction,
        class: enhancedClass,
        originalClass: originalClass,
        possibleClasses: enhancedClasses,
        confidence: score
      };
    }
    
    return {
      ...prediction,
      confidence: score
    };
  };

  // 이미지 전처리 (성능 최적화)
  const preprocessImageForDetection = (imageElement) => {
    try {
      // 최적 해상도로 리사이즈 (성능과 정확도의 균형)
      const targetSize = 300;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('Canvas context를 가져올 수 없습니다.');
        return imageElement;
      }
      
      canvas.width = targetSize;
      canvas.height = targetSize;
      
      // 고품질 이미지 그리기
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imageElement, 0, 0, targetSize, targetSize);
      
      return canvas;
    } catch (error) {
      console.error('이미지 전처리 실패:', error);
      return imageElement;
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

  // 실시간 감지 토글 (성능 최적화)
  const toggleRealTimeDetection = () => {
    if (!isRealTimeDetection) {
      setIsRealTimeDetection(true);
      setStatus('실시간 객체 감지가 시작되었습니다. (최적화 모드)');
      
      // 1.5초마다 객체 감지 (성능과 반응성의 균형)
      detectionIntervalRef.current = setInterval(() => {
        if (videoRef.current?.readyState === videoRef.current?.HAVE_ENOUGH_DATA) {
          // 이전 감지가 완료되지 않았으면 스킵
          if (!isDetecting) {
            detectObjects(videoRef.current);
          }
        }
      }, 1500);
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
          onClick={() => setDetectionMode(detectionMode === 'normal' ? 'enhanced' : 'normal')}
          style={{
            background: detectionMode === 'enhanced' 
              ? 'linear-gradient(45deg, #00b894, #00a085)' 
              : 'linear-gradient(45deg, #fdcb6e, #e17055)'
          }}
        >
          {detectionMode === 'enhanced' ? '🎯 향상 모드' : '🔍 일반 모드'}
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
        감지 모드: {detectionMode === 'enhanced' ? '향상 모드' : '일반 모드'}<br/>
        감지 중: {isDetecting ? '예' : '아니오'}<br/>
        실시간 감지: {isRealTimeDetection ? '활성' : '비활성'}<br/>
        예측 결과: {predictions.length}개<br/>
        비디오 상태: {videoRef.current?.readyState || '없음'}
      </div>

      {/* 인식 팁 */}
      <div style={{ 
        background: '#e8f4fd', 
        padding: '15px', 
        margin: '10px 0', 
        borderRadius: '10px',
        border: '2px solid #667eea'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#2c5aa0' }}>💡 인식 팁</h4>
        <p style={{ margin: '5px 0', fontSize: '14px' }}>
          <strong>빨래집게, 손수건, 행거</strong> 같은 세부 물건들을 인식하려면:
        </p>
        <ul style={{ margin: '5px 0', paddingLeft: '20px', fontSize: '14px' }}>
          <li>객체를 화면 중앙에 배치하세요</li>
          <li>충분한 조명을 확보하세요</li>
          <li>객체가 화면의 1/4 이상을 차지하도록 하세요</li>
          <li>배경과 구분되는 색상의 물건을 사용하세요</li>
          <li>여러 각도에서 시도해보세요</li>
        </ul>
        <p style={{ margin: '5px 0', fontSize: '12px', color: '#666' }}>
          현재 모델은 80가지 일반적인 객체를 인식합니다. 
          세부 물건들은 유사한 카테고리로 매핑됩니다.
        </p>
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