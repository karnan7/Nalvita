import Activity from 'lucide-react-native/icons/activity';
import FileText from 'lucide-react-native/icons/file-text';
import LayoutDashboard from 'lucide-react-native/icons/layout-dashboard';
import Pill from 'lucide-react-native/icons/pill';
import User from 'lucide-react-native/icons/user';
import type { ColorValue } from 'react-native';

/**
 * Tab icons.
 *
 * Same lucide set the web app draws with, so a document, a medicine, or a vital
 * is the same symbol on both — one design system, not two that happen to agree.
 *
 * Imported one icon at a time rather than from the package root: the root
 * barrel pulls in every icon lucide ships, which bloats the bundle and made the
 * test suite take over a minute on its own.
 */
export type TabIconName = 'home' | 'documents' | 'medicines' | 'vitals' | 'profile';

const ICONS = {
  home: LayoutDashboard,
  documents: FileText,
  medicines: Pill,
  vitals: Activity,
  profile: User,
} as const satisfies Record<TabIconName, unknown>;

interface TabBarIconProps {
  name: TabIconName;
  /** Supplied by the navigator, already resolved for the active/inactive state. */
  color: ColorValue;
  size?: number;
}

export function TabBarIcon({ name, color, size = 22 }: Readonly<TabBarIconProps>) {
  const Icon = ICONS[name];
  // Decorative: the tab's own label already names it, so it must not be
  // announced twice.
  return <Icon color={color as string} size={size} accessibilityElementsHidden />;
}
