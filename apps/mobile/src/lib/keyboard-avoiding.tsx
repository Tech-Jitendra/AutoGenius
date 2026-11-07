import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle } from 'react-native';

/**
 * iOS keeps the window where it is and expects a view to react to the keyboard,
 * so a form is wrapped in a KeyboardAvoidingView that pads its bottom by the
 * keyboard's height. Android with Expo's default `softwareKeyboardLayoutMode`
 * resizes the window itself, so it gets no behavior and no extra padding.
 */
export function KeyboardAvoiding({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
