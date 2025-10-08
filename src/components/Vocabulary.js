import React, { useState } from 'react';

const Vocabulary = ({ vocabulary, onRemove, onWordSelect }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="vocabulary-section">
      <div className="vocabulary-header">
        <h2>📚 내 단어장 ({vocabulary.length}개)</h2>
        <button 
          onClick={toggleExpanded}
          style={{
            background: 'rgba(255,255,255,0.2)',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          {isExpanded ? '접기 ▲' : '펼치기 ▼'}
        </button>
      </div>
      
      {isExpanded && (
        <div className="vocabulary-content">
          {vocabulary.length === 0 ? (
            <div className="empty-vocabulary">
              아직 저장된 단어가 없습니다.<br/>
              객체를 감지하고 단어를 저장해보세요!
            </div>
          ) : (
            vocabulary.map((item) => (
              <div key={item.id} className="vocabulary-item">
                <div>
                  <div 
                    className="vocabulary-word"
                    onClick={() => onWordSelect(item.word)}
                  >
                    {item.word}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#666', 
                    marginTop: '5px' 
                  }}>
                    저장일: {formatDate(item.addedAt)}
                  </div>
                </div>
                <div className="vocabulary-actions">
                  <button 
                    className="remove-button"
                    onClick={() => onRemove(item.id)}
                  >
                    🗑️ 삭제
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Vocabulary;