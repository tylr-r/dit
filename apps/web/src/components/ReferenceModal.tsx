import type { CSSProperties } from 'react';
import type { Letter } from '@dit/core';
import type { ReferenceModalProps } from './componentProps';

const SCORE_INTENSITY_MAX = 15;

const formatScore = (value: number) => (value > 0 ? `+${value}` : `${value}`);

const getScoreStyle = (
  scoreValue: number,
): CSSProperties | undefined => {
  if (scoreValue === 0) {
    return;
  }
  const normalized = Math.abs(scoreValue) / SCORE_INTENSITY_MAX;
  const intensity = Math.min(Math.max(normalized, 0.2), 1);
  const alpha = 0.35 * intensity;
  const tint = scoreValue > 0 ? '56, 242, 162' : '255, 90, 96';
  return {
    '--score-tint': tint,
    '--score-alpha': String(alpha),
  } as CSSProperties;
};

/** Modal overlay with the Morse reference grid and scores. */
export function ReferenceModal({
  letters,
  morseData,
  numbers,
  onClose,
  onResetScores,
  scores,
}: ReferenceModalProps) {
  const renderReferenceCard = (char: Letter) => {
    const scoreValue = scores[char];
    const scoreClass =
      scoreValue > 0
        ? 'score-positive'
        : scoreValue < 0
          ? 'score-negative'
          : 'score-neutral';
    const code = morseData[char].code;
    return (
      <div
        key={char}
        className="reference-card"
        style={getScoreStyle(scoreValue)}
      >
        <div className="reference-head">
          <div className="reference-letter">{char}</div>
          <div className={`reference-score ${scoreClass}`}>
            {formatScore(scoreValue)}
          </div>
        </div>
        <div className="reference-code" aria-label={code}>
          {code.split('').map((symbol, index) => (
            <span key={`${char}-${index}`} className="reference-symbol">
              {symbol === '.'
                ? '•'
                : symbol === '-'
                  ? '—'
                  : symbol}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Morse reference"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">Reference</div>
          <div className="modal-actions">
            <button
              type="button"
              className="modal-close modal-reset"
              onClick={onResetScores}
            >
              Reset scores
            </button>
            <button type="button" className="modal-close" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="reference-grid">
          {letters.map(renderReferenceCard)}
          <div className="reference-row">
            {numbers.map(renderReferenceCard)}
          </div>
        </div>
      </div>
    </div>
  );
}
