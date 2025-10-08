import React, { useState, useEffect } from 'react';

const WordDetail = ({ word, onClose, onSave, isSaved }) => {
  const [wordData, setWordData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (word) {
      loadWordDetails(word);
    }
  }, [word]);

  const loadWordDetails = async (word) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      
      if (!response.ok) {
        throw new Error('단어를 찾을 수 없습니다.');
      }

      const data = await response.json();
      setWordData(data[0]);
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const playAudio = (audioUrl) => {
    const audio = new Audio(audioUrl);
    audio.play().catch(error => {
      console.error('Audio play failed:', error);
      alert('오디오를 재생할 수 없습니다.');
    });
  };

  const scrollToWordDetail = () => {
    const element = document.querySelector('.word-detail-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (wordData) {
      scrollToWordDetail();
    }
  }, [wordData]);

  if (loading) {
    return (
      <div className="word-detail-section">
        <div className="word-detail-header">
          <h2>{word}</h2>
          <button className="close-word-detail" onClick={onClose}>✕</button>
        </div>
        <div className="word-detail-content">
          <div className="loading">
            <div className="loading-spinner"></div>
            단어 정보를 불러오는 중...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="word-detail-section">
        <div className="word-detail-header">
          <h2>{word}</h2>
          <button className="close-word-detail" onClick={onClose}>✕</button>
        </div>
        <div className="word-detail-content">
          <div className="error-message">
            <h3>오류</h3>
            <p>단어 정보를 불러올 수 없습니다: {error}</p>
            <p>다른 단어를 시도해보세요.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!wordData) return null;

  // 발음 정보
  const pronunciation = wordData.phonetics?.find(p => p.text) || wordData.phonetics?.[0];
  
  // 품사 정보
  const partsOfSpeech = wordData.meanings ? 
    [...new Set(wordData.meanings.map(m => m.partOfSpeech))] : [];

  return (
    <div className="word-detail-section">
      <div className="word-detail-header">
        <h2>{word}</h2>
        <div>
          <button 
            className="save-button"
            onClick={onSave}
            disabled={isSaved}
            style={{ marginRight: '10px' }}
          >
            {isSaved ? '✓ 저장됨' : '💾 단어장에 저장'}
          </button>
          <button className="close-word-detail" onClick={onClose}>✕</button>
        </div>
      </div>
      
      <div className="word-detail-content">
        {/* 발음 정보 */}
        {pronunciation?.text && (
          <div className="word-pronunciation">
            <div className="ipa-pronunciation">/{pronunciation.text}/</div>
            {pronunciation.audio && (
              <button 
                className="audio-button" 
                onClick={() => playAudio(pronunciation.audio)}
              >
                🔊 발음 듣기
              </button>
            )}
          </div>
        )}

        {/* 품사 태그 */}
        {partsOfSpeech.length > 0 && (
          <div className="word-info-tags">
            {partsOfSpeech.map((pos, index) => (
              <span key={index} className="info-tag">{pos}</span>
            ))}
          </div>
        )}

        {/* 어원 정보 */}
        {wordData.etymology && (
          <div className="etymology">{wordData.etymology}</div>
        )}

        {/* 정의와 예문 */}
        {wordData.meanings?.map((meaning, index) => (
          <div key={index} className="definition-section">
            <h3 className="definition-title">
              {meaning.partOfSpeech || 'Definition'}
            </h3>
            
            {meaning.definitions?.map((def, defIndex) => (
              <div key={defIndex} className="definition-item">
                <div className="definition-text">
                  <strong>{defIndex + 1}.</strong> {def.definition}
                </div>
                
                {def.example && (
                  <div className="example">{def.example}</div>
                )}
                
                {def.synonyms && def.synonyms.length > 0 && (
                  <div className="synonyms">
                    {def.synonyms.slice(0, 5).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WordDetail;