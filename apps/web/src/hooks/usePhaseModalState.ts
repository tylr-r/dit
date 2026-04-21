import { useCallback, useRef, useState } from 'react'
import type { PhaseModalContent } from '@dit/core'

/** Stores the current phase modal content and optional dismiss continuation. */
export const usePhaseModalState = () => {
  const [phaseModal, setPhaseModal] = useState<PhaseModalContent | null>(null)
  const phaseModalOnDismissRef = useRef<(() => void) | null>(null)

  const showPhaseModal = useCallback(
    (content: PhaseModalContent, onDismiss?: () => void) => {
      phaseModalOnDismissRef.current = onDismiss ?? null
      setPhaseModal(content)
    },
    [],
  )

  const handlePhaseModalDismiss = useCallback(() => {
    setPhaseModal(null)
    const pending = phaseModalOnDismissRef.current
    phaseModalOnDismissRef.current = null
    pending?.()
  }, [])

  return {
    phaseModal,
    showPhaseModal,
    handlePhaseModalDismiss,
  }
}
