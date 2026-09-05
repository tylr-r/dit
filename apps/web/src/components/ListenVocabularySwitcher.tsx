import type { ListenVocabulary } from '@dit/core'

type ListenVocabularySwitcherProps = {
  value: ListenVocabulary
  onChange: (value: ListenVocabulary) => void
}

/** Quiet, always-available vocabulary choice within Listen Words. */
export function ListenVocabularySwitcher({ value, onChange }: ListenVocabularySwitcherProps) {
  return (
    <div className="listen-vocabulary-switcher" role="group" aria-label="Word vocabulary">
      <button type="button" aria-pressed={value === 'common'} onClick={() => onChange('common')}>
        Common words
      </button>
      <button type="button" aria-pressed={value === 'q-codes'} onClick={() => onChange('q-codes')}>
        Q codes
      </button>
    </div>
  )
}
