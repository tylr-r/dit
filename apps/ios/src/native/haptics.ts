import * as Haptics from 'expo-haptics';

export const triggerDotHaptic = async () => {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export const triggerDashHaptic = async () => {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

export const triggerSuccessHaptic = async () => {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};
