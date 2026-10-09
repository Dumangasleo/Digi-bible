import { Alert, Platform, ToastAndroid } from 'react-native';

/**
 * Shows a short, non-blocking confirmation that an action succeeded.
 *
 * @param message - One line, e.g. `John 5:1 added to "Pagtuo"`.
 * @remarks Android gets a native toast: it needs no dependency, needs no tap to
 *          dismiss, and — because the OS draws it, not the React tree — it stays
 *          visible even after the sheet that triggered it has closed. iOS has no
 *          toast primitive, so it falls back to a plain alert there.
 */
export function notify(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert(message);
}
