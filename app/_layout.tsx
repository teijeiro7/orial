import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { AppState, View, ActivityIndicator } from 'react-native';
import { useDatabaseMigrations } from '../src/services/database';
import { notificationService } from '../src/services/notificationService';
import { widgetService } from '../src/services/widgetService';
import { OrialColors } from '../src/utils/colors';
import { useAppStore } from '../src/stores/appStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();
  const [isReady, setIsReady] = useState(false);

  const onboardingCompleted = useAppStore(state => state.onboardingCompleted);

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  const { success, error } = useDatabaseMigrations();

  useEffect(() => {
    if (fontsLoaded && (success || error)) {
      setIsReady(true);
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, success, error]);

  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isReady && !onboardingCompleted && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/onboarding');
    }
  }, [isReady, onboardingCompleted]);

  // Setup notifications
  useEffect(() => {
    // Request permissions on app start
    notificationService.requestPermissions();

    // Listen for incoming notifications
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // Listen for notification responses (when user taps notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      if (data?.habitId) {
        // Navigate to habit detail
        router.push(`/habit/${data.habitId}`);
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // Update widgets when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        // Update widget data when app goes to background
        widgetService.updateWidgetData();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

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
