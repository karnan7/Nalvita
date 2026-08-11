import { Text, type ColorValue } from 'react-native';

/**
 * Tab icons.
 *
 * Deliberately typographic for now rather than pulling in an icon set: the web
 * app uses lucide, and the React Native equivalent is a decision that belongs
 * with the screens in KAR-57, where the rest of the iconography gets chosen at
 * once. This keeps the shell honest — real, themed, and sized — without
 * committing the app to a library it has not evaluated.
 */
export type TabIconName = 'home' | 'documents' | 'medicines' | 'vitals' | 'profile';

const GLYPHS: Record<TabIconName, string> = {
  home: '⌂',
  documents: '▤',
  medicines: '◐',
  vitals: '♡',
  profile: '☺',
};

interface TabBarIconProps {
  name: TabIconName;
  /** Supplied by the navigator, already resolved for the active/inactive state. */
  color: ColorValue;
}

export function TabBarIcon({ name, color }: Readonly<TabBarIconProps>) {
  return (
    <Text accessible={false} style={{ color, fontSize: 20, lineHeight: 24 }}>
      {GLYPHS[name]}
    </Text>
  );
}
