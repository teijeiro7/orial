import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { AppState, View, ActivityIndicator, Text } from 'react-native';
import { useDatabaseMigrations } from '@/src/services/database';
import { notificationService } from '@/src/services/notificationService';
import { widgetService } from '@/src/services/widgetService';
import { startSyncScheduler } from '@/src/services/syncScheduler';
import { useNfcWaterQueueDrain } from '@/src/hooks/useNfcWaterQueueDrain';
import { OrialColors } from '@/src/utils/colors';
import { useAppStore } from '@/src/stores/appStore';
import { AuthProvider, useAuth } from '@/src/context/AuthContext';

SplashScreen.preventAutoHideAsync();

function AppLayout() {
  const router = useRouter();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  const onboardingCompleted = useAppStore(state => state.onboardingCompleted);
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  const { success, error } = useDatabaseMigrations();

  useEffect(() => {
    if (fontsLoaded && (success || error) && !authLoading) {
      setIsReady(true);
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, success, error, authLoading]);

  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isReady && !hasRedirected.current) {
      hasRedirected.current = true;
      if (!onboardingCompleted) {
        router.replace('/onboarding');
      } else if (!isAuthenticated) {
        router.replace('/login');
      }
    }
  }, [isReady, onboardingCompleted, isAuthenticated]);

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
      // Handle notification tap navigation for other notification types here.
      void data;
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  // Start automatic Supabase sync (initial poll + foreground interval +
  // sync-on-foreground). No-op while Supabase credentials are absent.
  useEffect(() => {
    const stopSync = startSyncScheduler();
    return stopSync;
  }, []);

  // Update widgets when the app goes to background AND when it becomes
  // active again — a freshly-added widget has no data until the app has
  // been backgrounded once, so also sync on activation to cover that case.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'active') {
        widgetService.updateWidgetData();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Drain any NFC water queue entries into the DB on cold start and every time
  // the app returns to the foreground.
  useNfcWaterQueueDrain();

  if (!fontsLoaded || (!success && !error) || authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: OrialColors.deepNavy, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={OrialColors.violetLight} />
      </View>
    );
  }

  if (error) {
    console.error('[_layout] Database migration failed:', error);
    return (
      <View style={{ flex: 1, backgroundColor: OrialColors.deepNavy, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#ff4444', textAlign: 'center' }}>Database error. Please restart the app.</Text>
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
        <Stack.Screen name="login" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="whoop/callback" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppLayout />
    </AuthProvider>
  );
}
