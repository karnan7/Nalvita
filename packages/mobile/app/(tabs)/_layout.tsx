import { Tabs } from 'expo-router';

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
const TABS: { name: string; title: string; icon: TabIconName }[] = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'documents', title: 'Documents', icon: 'documents' },
  { name: 'medicines', title: 'Medicines', icon: 'medicines' },
  { name: 'vitals', title: 'Vitals', icon: 'vitals' },
  { name: 'profile', title: 'Profile', icon: 'profile' },
];

export default function TabsLayout() {
  const theme = useTheme();

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
