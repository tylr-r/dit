import {
  computeHero,
  STREAK_DAILY_GOAL,
  todayStreakContribution,
  type Progress,
} from '@dit/core'

import { ensureBrandIconUri, getBrandIconUri } from './brandIcon'
import {
  DitProgressWidget,
  type DitProgressWidgetProps,
} from './DitProgress'
import {
  ensureWidgetBgMediumUri,
  ensureWidgetBgSmallUri,
  getWidgetBgMediumUri,
  getWidgetBgSmallUri,
} from './widgetBackground'

export const deriveWidgetProps = (
  progress: Progress,
  now: Date = new Date(),
  iconUri: string | null = getBrandIconUri(),
  bgSmallUri: string | null = getWidgetBgSmallUri(),
  bgMediumUri: string | null = getWidgetBgMediumUri(),
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
    bestWpm: progress.bestWpm ?? 0,
    iconUri: iconUri ?? '',
    bgSmallUri: bgSmallUri ?? '',
    bgMediumUri: bgMediumUri ?? '',
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
  const push = (
    iconUri: string | null,
    bgSmallUri: string | null,
    bgMediumUri: string | null,
  ) => {
    try {
      DitProgressWidget.updateSnapshot(
        deriveWidgetProps(progress, now, iconUri, bgSmallUri, bgMediumUri),
      )
    } catch {
      // Widget extension may not be installed (dev build without widget);
      // swallow so we don't crash the app.
    }
  }

  const cachedIcon = getBrandIconUri()
  const cachedBgSmall = getWidgetBgSmallUri()
  const cachedBgMedium = getWidgetBgMediumUri()
  if (cachedIcon && cachedBgSmall && cachedBgMedium) {
    push(cachedIcon, cachedBgSmall, cachedBgMedium)
    return
  }

  push(cachedIcon, cachedBgSmall, cachedBgMedium)
  Promise.all([
    ensureBrandIconUri(),
    ensureWidgetBgSmallUri(),
    ensureWidgetBgMediumUri(),
  ]).then(([icon, bgSmall, bgMedium]) => {
    if (icon || bgSmall || bgMedium) push(icon, bgSmall, bgMedium)
  })
}
