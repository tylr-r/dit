import { spacing } from '../design/tokens'
import { DitButton, type ButtonProps } from './DitButton'

/** Native Listen actions with a readable label and a 44-point touch target. */
export function ListenActionButton(props: ButtonProps) {
  return <DitButton {...props}
    paddingHorizontal={props.paddingHorizontal ?? spacing.lg}
    paddingVertical={props.paddingVertical ?? spacing.md}
    textStyle={{ fontSize: 14, ...props.textStyle }}
    style={{ minHeight: 44, ...props.style }} />
}
