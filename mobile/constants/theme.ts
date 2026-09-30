/**
 * Jetons de couleur clair/sombre de l'app. Text et View (components/themed/)
 * s'appuient dessus automatiquement — la plupart des écrans n'ont rien à
 * faire de spécial pour être compatibles mode sombre.
 */

import { Platform } from 'react-native';
import { BRAND } from '../src/lib/colors';

export const Colors = {
  light: {
    text: '#1C1730',
    background: '#FFFFFF',
    surface: '#F6F4FB',
    border: 'rgba(0,0,0,0.15)',
    tint: BRAND,
    icon: '#6B6580',
    tabIconDefault: '#9B93B0',
    tabIconSelected: BRAND,
  },
  dark: {
    text: '#F1EEFA',
    background: '#141019',
    surface: '#211B2C',
    border: 'rgba(255,255,255,0.18)',
    tint: BRAND,
    icon: '#B8B0CC',
    tabIconDefault: '#8A8299',
    tabIconSelected: BRAND,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
