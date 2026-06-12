import { colors } from '../design/tokens'

export type PracticeFeedbackStatus = 'idle' | 'success' | 'error'

export const resolvePracticeFeedbackColor = (status: PracticeFeedbackStatus) => {
  if (status === 'success') {
    return colors.feedback.success
  }
  if (status === 'error') {
    return colors.feedback.error
  }
  return null
}
