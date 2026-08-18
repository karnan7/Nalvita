import { Tabs } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';

import { TabBarIcon, type TabIconName } from '@/components/tab-bar-icon';
import { useTheme } from '@/lib/theme';

/**
 * The app's five destinations, matching the web app's primary navigation.
 *
 * `design/BottomNav.dc.html` referenced in KAR-49 does not exist in the repo,
 * so the bar is built from the token layer directly: surface background,
 * subtle top border, interactive colour for the active tab and muted for the
 * rest — the same relationships the web nav uses.
 */
export const TABS: { name: string; title: string; icon: TabIconName }[] = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'documents', title: 'Documents', icon: 'documents' },
  { name: 'medicines', title: 'Medicines', icon: 'medicines' },
  { name: 'vitals', title: 'Vitals', icon: 'vitals' },
  { name: 'profile', title: 'Profile', icon: 'profile' },
];

export function TabsLayout() {
  const theme = useTheme();

  /**
   * Every screen behind these tabs shows health data, so screen capture is
   * blocked for the whole signed-in area rather than screen by screen — one
   * place to be right, and a new screen is covered by default.
   *
   * Android honours this outright (FLAG_SECURE): screenshots and screen
   * recording both fail. iOS has no API to prevent a screenshot at all, so
   * there it covers screen recording and mirroring only. Worth being plain
   * about: this raises the cost of leaking a record, it does not make it
   * impossible.
   */
  usePreventScreenCapture();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.bgSurface },
        headerTintColor: theme.colors.textPrimary,
        tabBarStyle: {
          backgroundColor: theme.colors.bgSurface,
          borderTopColor: theme.colors.borderSubtle,
        },
        tabBarActiveTintColor: theme.colors.interactiveDefault,
        tabBarInactiveTintColor: theme.colors.textMuted,
        // Elderly users are a stated audience; the default 10pt label is small.
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color }) => <TabBarIcon name={tab.icon} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
