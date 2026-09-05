export type ListenContent = 'characters' | 'phrases'

type ListenContentSwitcherProps = {
  value: ListenContent
  phrasesDisabled: boolean
  onChange: (next: ListenContent) => void
}

/** Switches the standard Listen exercise between characters and CW words. */
export function ListenContentSwitcher({
  value,
  phrasesDisabled,
  onChange,
}: ListenContentSwitcherProps) {
  return (
    <div className="listen-content-switcher" role="group" aria-label="Listen content">
      <button
        type="button"
        className={value === 'characters' ? 'is-active' : ''}
        aria-pressed={value === 'characters'}
        onClick={() => onChange('characters')}
      >
        Characters
      </button>
      <button
        type="button"
        className={value === 'phrases' ? 'is-active' : ''}
        aria-pressed={value === 'phrases'}
        disabled={phrasesDisabled}
        title={
          phrasesDisabled
            ? 'Unlock enough characters to make four word choices available.'
            : undefined
        }
        onClick={() => onChange('phrases')}
      >
        Words
      </button>
    </div>
  )
}
