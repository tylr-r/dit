import type { ComponentProps } from 'react';
import { AboutPanel } from './AboutPanel';
import { ModalShell } from './ModalShell';

type AboutModalProps = ComponentProps<typeof AboutPanel>;

/** About panel wrapped in the shared modal shell. */
export function AboutModal({ onClose }: AboutModalProps) {
  return (
    <ModalShell onClose={onClose} cardPressable>
      <AboutPanel onClose={onClose} />
    </ModalShell>
  );
}
