import {
  STREAK_DAILY_GOAL,
  todayStreakContribution,
  type Progress,
  type ReminderSettings,
} from '@dit/core'
import * as Notifications from 'expo-notifications'

const REMINDER_IDENTIFIER = 'dit-daily-reminder'

export type ReminderCopy = { title: string; body: string }

export const reminderCopyForProgress = (progress: Progress): ReminderCopy => {
  const streak = progress.streak?.current ?? 0
  if (streak >= 1) {
    return {
      title: 'Dit',
      body: `Keep your ${streak}-day streak.`,
    }
  }
  return {
    title: 'Dit',
    body: 'Ready for a quick Morse session?',
  }
}

const parseReminderTime = (time: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match) {
    return null
  }
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }
  return { hour, minute }
}

/** Prompts for permission if not yet determined. Returns true if authorized. */
export const ensureNotificationPermission = async (): Promise<boolean> => {
  const existing = await Notifications.getPermissionsAsync()
  if (existing.granted) {
    return true
  }
  if (!existing.canAskAgain) {
    return false
  }
  const request = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  })
  return request.granted
}

const cancelExisting = async () => {
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_IDENTIFIER)
  } catch {
    // no-op: identifier may not exist
  }
}

/**
 * Cancels any scheduled Dit reminder and, if the user has one enabled and
 * hasn't hit today's goal, schedules the next occurrence of their chosen time.
 * Safe to call on any progress change or app foreground.
 */
export const rescheduleReminder = async (
  progress: Progress,
  now: Date = new Date(),
): Promise<void> => {
  await cancelExisting()

  const reminder: ReminderSettings | undefined = progress.reminder
  if (!reminder || !reminder.enabled) {
    return
  }
  const parsed = parseReminderTime(reminder.time)
  if (!parsed) {
    return
  }

  const permission = await Notifications.getPermissionsAsync()
  if (!permission.granted) {
    return
  }

  const todayProgress = todayStreakContribution(progress, now)
  const hitGoal = todayProgress.correct >= STREAK_DAILY_GOAL

  const target = new Date(now)
  target.setHours(parsed.hour, parsed.minute, 0, 0)
  const shouldDeferToTomorrow = hitGoal || target.getTime() <= now.getTime()
  if (shouldDeferToTomorrow) {
    target.setDate(target.getDate() + 1)
  }

  const secondsFromNow = Math.max(
    1,
    Math.round((target.getTime() - now.getTime()) / 1000),
  )
  const copy = reminderCopyForProgress(progress)

  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_IDENTIFIER,
    content: {
      title: copy.title,
      body: copy.body,
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsFromNow,
      repeats: false,
    },
  })
}

export const cancelReminder = async (): Promise<void> => {
  await cancelExisting()
}
