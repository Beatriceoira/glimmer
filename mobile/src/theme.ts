import { useColorScheme } from 'react-native';
export function useTheme() {
  const dark = useColorScheme() === 'dark';
  return dark
    ? { bg: '#15122a', panel: '#1e1a38', ink: '#ece7fb', mute: '#a79fc4', line: '#37305c', accent: '#f2c66d', accentInk: '#15122a', teal: '#6fd3c4', err: '#ff8a80' }
    : { bg: '#efeaf7', panel: '#fbf9ff', ink: '#1d1833', mute: '#63597d', line: '#d3cae8', accent: '#1d1833', accentInk: '#fbf9ff', teal: '#0f7f78', err: '#b3261e' };
}
