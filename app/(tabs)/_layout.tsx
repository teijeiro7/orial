import { Tabs } from 'expo-router';
import { Home, Dumbbell, Wallet, Utensils } from 'lucide-react-native';
import { OrialColors } from '@/src/utils/colors';

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
        name="gym"
        options={{
          title: 'Gym',
          tabBarIcon: ({ color, size }) => <Dumbbell size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finance',
          tabBarIcon: ({ color, size }) => <Wallet size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="intake"
        options={{
          title: 'Intake',
          tabBarIcon: ({ color, size }) => <Utensils size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen name="caffeine" options={{ href: null }} />
      <Tabs.Screen name="insights" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="forge" options={{ href: null }} />
      <Tabs.Screen name="macros" options={{ href: null }} />
      <Tabs.Screen name="jarvis" options={{ href: null }} />
    </Tabs>
  );
}
