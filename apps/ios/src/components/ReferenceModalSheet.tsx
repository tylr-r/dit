import type { ComponentProps } from 'react'
import { ModalShell } from './ModalShell'
import { ReferenceModal } from './ReferenceModal'

type ReferenceModalSheetProps = ComponentProps<typeof ReferenceModal>;

/** Reference modal wrapped in the shared modal shell. */
export function ReferenceModalSheet(props: ReferenceModalSheetProps) {
  return (
    <ModalShell onClose={props.onClose}>
      <ReferenceModal {...props} />
    </ModalShell>
  )
}
