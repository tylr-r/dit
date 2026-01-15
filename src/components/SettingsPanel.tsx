import type { ChangeEvent } from 'react'

type SettingsPanelProps = {
  freestyleWordMode: boolean
  isFreestyle: boolean
  isListen: boolean
  levels: readonly number[]
  listenWpm: number
  listenWpmMax: number
  listenWpmMin: number
  maxLevel: number
  onListenWpmChange: (event: ChangeEvent<HTMLSelectElement>) => void
  onMaxLevelChange: (event: ChangeEvent<HTMLSelectElement>) => void
  onShowHintChange: (event: ChangeEvent<HTMLInputElement>) => void
  onShowReference: () => void
  onSoundCheck: () => void
  onWordModeChange: (event: ChangeEvent<HTMLInputElement>) => void
  showHint: boolean
  soundCheckStatus: 'idle' | 'playing'
}

/** Settings dropdown content and mode-specific controls. */
export function SettingsPanel({
  freestyleWordMode,
  isFreestyle,
  isListen,
  levels,
  listenWpm,
  listenWpmMax,
  listenWpmMin,
  maxLevel,
  onListenWpmChange,
  onMaxLevelChange,
  onShowHintChange,
  onShowReference,
  onSoundCheck,
  onWordModeChange,
  showHint,
  soundCheckStatus,
}: SettingsPanelProps) {
  return (
    <div
      className="settings-panel"
      role="group"
      aria-label="Settings"
      id="settings-panel"
    >
      <label className="toggle">
        <span className="toggle-label">Show hints</span>
        <input
          className="toggle-input"
          type="checkbox"
          checked={showHint}
          onChange={onShowHintChange}
          disabled={isFreestyle || isListen}
        />
      </label>
      {!isFreestyle ? (
        <div className="panel-group">
          <label className="toggle">
            <span className="toggle-label">Max level</span>
            <select
              className="panel-select"
              value={maxLevel}
              onChange={onMaxLevelChange}
            >
              {levels.map((level) => (
                <option key={level} value={level}>
                  Level {level}
                </option>
              ))}
            </select>
          </label>
          {isListen ? (
            <label className="toggle">
              <span className="toggle-label">Listen speed</span>
              <select
                className="panel-select"
                value={listenWpm}
                onChange={onListenWpmChange}
              >
                {Array.from(
                  { length: listenWpmMax - listenWpmMin + 1 },
                  (_, index) => listenWpmMin + index,
                ).map((wpm) => (
                  <option key={wpm} value={wpm}>
                    {wpm} WPM
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            className="panel-button"
            onClick={onShowReference}
          >
            Reference
          </button>
        </div>
      ) : null}
      {isFreestyle ? (
        <label className="toggle">
          <span className="toggle-label">Word mode</span>
          <input
            className="toggle-input"
            type="checkbox"
            checked={freestyleWordMode}
            onChange={onWordModeChange}
          />
        </label>
      ) : null}
      {isListen ? (
        <div className="panel-group">
          <button
            type="button"
            className="panel-button"
            onClick={onSoundCheck}
            disabled={soundCheckStatus !== 'idle'}
          >
            Sound check
          </button>
          <span className="panel-hint">
            No sound? Turn off Silent Mode.
          </span>
        </div>
      ) : null}
    </div>
  )
}
