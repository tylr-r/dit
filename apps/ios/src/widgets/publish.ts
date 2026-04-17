import {
  computeHero,
  STREAK_DAILY_GOAL,
  todayStreakContribution,
  type Progress,
} from '@dit/core'

import {
  DitProgressWidget,
  type DitProgressWidgetProps,
} from './DitProgress'

export const deriveWidgetProps = (
  progress: Progress,
  now: Date = new Date(),
): DitProgressWidgetProps => {
  const hero = computeHero(progress)
  const today = todayStreakContribution(progress, now)
  return {
    streak: progress.streak?.current ?? 0,
    todayCorrect: today.correct,
    goal: STREAK_DAILY_GOAL,
    heroKind: hero.kind,
    heroValue: hero.kind === 'wpm' ? hero.value : hero.count,
    heroTotal: hero.kind === 'wpm' ? 0 : hero.total,
  }
}

/**
 * Pushes the latest progress snapshot to the home-screen widget. Safe to call
 * on any progress mutation or app foreground — updateSnapshot is idempotent.
 */
export const publishProgressToWidget = (
  progress: Progress,
  now: Date = new Date(),
): void => {
  try {
    DitProgressWidget.updateSnapshot(deriveWidgetProps(progress, now))
  } catch {
    // Widget extension may not be installed (dev build without widget);
    // swallow so we don't crash the app.
  }
}
