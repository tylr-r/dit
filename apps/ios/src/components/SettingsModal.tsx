import type { ComponentProps } from 'react'
import { ModalShell } from './ModalShell'
import { SettingsPanel } from './SettingsPanel'

type SettingsModalProps = ComponentProps<typeof SettingsPanel>;

/** Settings panel wrapped in the shared modal shell. */
export function SettingsModal(props: SettingsModalProps) {
  return (
    <ModalShell onClose={props.onClose} cardPressable>
      <SettingsPanel {...props} />
    </ModalShell>
  )
}
