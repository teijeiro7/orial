import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { View, ActivityIndicator } from 'react-native';
import { useDatabaseMigrations } from '../src/services/database';
import { OrialColors } from '../src/utils/colors';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  const { success, error } = useDatabaseMigrations();

  useEffect(() => {
    if (fontsLoaded && (success || error)) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, success, error]);

  if (!fontsLoaded || (!success && !error)) {
    return (
      <View style={{ flex: 1, backgroundColor: OrialColors.deepNavy, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={OrialColors.violetLight} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: OrialColors.deepNavy,
          },
          headerTintColor: OrialColors.textPrimary,
          contentStyle: {
            backgroundColor: OrialColors.deepNavy,
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="habit/[id]" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
