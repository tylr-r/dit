import * as Haptics from 'expo-haptics';
import { DitNative } from './ditNative';

export const triggerDotHaptic = async () => {
  if (DitNative?.triggerHaptic) {
    await DitNative.triggerHaptic('dot');
    return;
  }
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export const triggerDashHaptic = async () => {
  if (DitNative?.triggerHaptic) {
    await DitNative.triggerHaptic('dash');
    return;
  }
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

export const triggerSuccessHaptic = async () => {
  if (DitNative?.triggerHaptic) {
    await DitNative.triggerHaptic('success');
    return;
  }
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};
