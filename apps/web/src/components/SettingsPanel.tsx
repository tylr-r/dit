import type { SettingsPanelProps } from './componentProps'

/** Settings dropdown content and mode-specific controls. */
export function SettingsPanel({
  freestyleWordMode,
  guidedCourseActive,
  isFreestyle,
  isListen,
  listenWpm,
  listenWpmMax,
  listenWpmMin,
  practiceAutoPlay,
  practiceIfrMode,
  practiceLearnMode,
  practiceReviewMisses,
  practiceWordMode,
  toneFrequency,
  toneFrequencyMin,
  toneFrequencyMax,
  toneFrequencyStep,
  onToneFrequencyChange,
  onListenWpmChange,
  onPracticeAutoPlayChange,
  onPracticeIfrModeChange,
  onPracticeLearnModeChange,
  onPracticeReviewMissesChange,
  onPracticeWordModeChange,
  onUseRecommended,
  onShowLearning,
  onReplayNux,
  onShowAbout,
  onShowHintChange,
  onShowMnemonicChange,
  onSoundCheck,
  onWordModeChange,
  showHint,
  showMnemonic,
  soundCheckStatus,
  user,
  userLabel,
  userInitial,
  authReady,
  onSignIn,
  onSignOut,
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
      <label className="toggle">
        <span className="toggle-label">Show mnemonics</span>
        <input
          className="toggle-input"
          type="checkbox"
          checked={showMnemonic}
          onChange={onShowMnemonicChange}
          disabled={isFreestyle || isListen}
        />
      </label>
      {!isFreestyle ? (
        <div className="panel-group">
          <button
            type="button"
            className="panel-button panel-button-row"
            onClick={onShowLearning}
          >
            <span className="panel-button-label">Learning</span>
            <span className="panel-button-value">
              {guidedCourseActive ? 'Course' : 'Open practice'}
              <span className="panel-button-chevron"> ›</span>
            </span>
          </button>
          {!isListen ? (
            <label className="toggle">
              <span className="toggle-label">Words</span>
              <input
                className="toggle-input"
                type="checkbox"
                checked={practiceWordMode}
                onChange={onPracticeWordModeChange}
              />
            </label>
          ) : null}
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
        </div>
      ) : null}
      {!isFreestyle && !isListen ? (
        <div className="panel-group">
          <label className="toggle">
            <span className="toggle-label">Auto-play sound</span>
            <input
              className="toggle-input"
              type="checkbox"
              checked={practiceAutoPlay}
              onChange={onPracticeAutoPlayChange}
            />
          </label>
          {!guidedCourseActive ? (
            <label className="toggle">
              <span className="toggle-label">Sequential order</span>
              <input
                className="toggle-input"
                type="checkbox"
                checked={practiceLearnMode}
                onChange={onPracticeLearnModeChange}
                disabled={practiceWordMode}
              />
            </label>
          ) : null}
          <label className="toggle">
            <span className="toggle-label">Immediate flow recovery</span>
            <input
              className="toggle-input"
              type="checkbox"
              checked={practiceIfrMode}
              onChange={onPracticeIfrModeChange}
            />
          </label>
          <label className="toggle">
            <span className="toggle-label">Review misses later</span>
            <input
              className="toggle-input"
              type="checkbox"
              checked={practiceReviewMisses}
              onChange={onPracticeReviewMissesChange}
              disabled={!practiceIfrMode}
            />
          </label>
        </div>
      ) : null}
      <div className="panel-group">
        <label className="toggle">
          <span className="toggle-label">Tone pitch</span>
          <select
            className="panel-select"
            value={toneFrequency}
            onChange={onToneFrequencyChange}
          >
            {Array.from(
              {
                length:
                  Math.round(
                    (toneFrequencyMax - toneFrequencyMin) / toneFrequencyStep,
                  ) + 1,
              },
              (_, index) => toneFrequencyMin + index * toneFrequencyStep,
            ).map((freq) => (
              <option key={freq} value={freq}>
                {freq} Hz
              </option>
            ))}
          </select>
        </label>
      </div>
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
      <div className="panel-group">
        <button
          type="button"
          className="panel-button"
          onClick={onShowAbout}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v.01"></path>
              <path d="M12 8a2 2 0 0 1 2 2c0 1.5-2 2.25-2 4"></path>
            </svg>
            About
          </span>
        </button>
      </div>
      {isListen ? (
        <div className="panel-group">
          <button
            type="button"
            className="panel-button"
            onClick={onSoundCheck}
            disabled={soundCheckStatus !== 'idle'}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
              </svg>
              Sound check
            </span>
          </button>
          <span className="panel-hint">
            No sound? Turn off Silent Mode.
          </span>
        </div>
      ) : null}
      <div className="panel-group">
        <button
          type="button"
          className="panel-button"
          onClick={onUseRecommended}
        >
          Use recommended settings
        </button>
        {onReplayNux ? (
          <button
            type="button"
            className="panel-button"
            onClick={onReplayNux}
          >
            Replay onboarding
          </button>
        ) : null}
      </div>
      <div className="auth">
        {user ? (
          <>
            {user.photoURL ? (
              <img
                className="auth-avatar"
                src={user.photoURL}
                alt={userLabel}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="auth-avatar auth-avatar-fallback">
                {userInitial}
              </div>
            )}
            <span className="auth-name">{userLabel}</span>
            <button
              type="button"
              className="auth-button"
              onClick={onSignOut}
              disabled={!authReady}
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            type="button"
            className="auth-button"
            onClick={onSignIn}
            disabled={!authReady}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
