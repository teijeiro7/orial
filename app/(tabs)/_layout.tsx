import { Tabs } from 'expo-router';
import { Home, Calendar, Settings, Flame, BarChart3 } from 'lucide-react-native';
import { OrialColors } from '../../src/utils/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: OrialColors.surface,
          borderTopColor: OrialColors.border,
          borderTopWidth: 1,
          paddingTop: 6,
        },
        tabBarActiveTintColor: OrialColors.violetLight,
        tabBarInactiveTintColor: OrialColors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'Inter-Medium',
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Home size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Daily',
          tabBarIcon: ({ color, size }) => <Calendar size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="forge"
        options={{
          href: null,
          title: 'Forge',
          tabBarIcon: ({ color, size }) => <Flame size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="macros"
        options={{
          href: null,
          title: 'Macros',
          tabBarIcon: ({ color, size }) => <BarChart3 size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="jarvis"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size - 2} color={color} />,
        }}
      />
    </Tabs>
  );
}
