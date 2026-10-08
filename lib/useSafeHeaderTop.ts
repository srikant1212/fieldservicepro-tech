import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Top padding for a screen header: clears the status bar, notch or Dynamic Island on every iPhone and Android device */
export function useSafeHeaderTop(extra = 12): number {
  return Math.max(useSafeAreaInsets().top, 20) + extra;
}
