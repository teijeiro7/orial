import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold } from '@expo-google-fonts/manrope';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { AppState, View, ActivityIndicator, Text } from 'react-native';
import { useDatabaseMigrations } from '../src/services/database';
import { notificationService } from '../src/services/notificationService';
import { widgetService } from '../src/services/widgetService';
import { hermesInboxService } from '../src/services/hermesInboxService';
import { registerBackgroundSync } from '../src/services/backgroundSync';
import { OrialColors } from '../src/utils/colors';
import { useAppStore } from '../src/stores/appStore';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

SplashScreen.preventAutoHideAsync();

/**
 * One-shot bootstrap that runs the inbox pull + widget queue consumption
 * + widget republish. Safe to call multiple times; the inbox service
 * internally debounces overlapping polls.
 */
async function refreshFromBackground(): Promise<void> {
  try {
    await widgetService.consumeQueues();
  } catch (e) {
    console.warn('[_layout] consumeQueues failed', e);
  }
  try {
    await hermesInboxService.pullAndProcess({ silent: true });
  } catch (e) {
    console.warn('[_layout] hermesInbox pull failed', e);
  }
  try {
    await widgetService.updateWidgetData();
  } catch (e) {
    console.warn('[_layout] updateWidgetData failed', e);
  }
}

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
    'BarlowCondensed-SemiBold': BarlowCondensed_600SemiBold,
    'BarlowCondensed-Bold': BarlowCondensed_700Bold,
    'Manrope-Regular': Manrope_400Regular,
    'Manrope-Medium': Manrope_500Medium,
    'Manrope-SemiBold': Manrope_600SemiBold,
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
    notificationService.requestPermissions();

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;

      if (data?.habitId) {
        router.push(`/habit/${data.habitId}`);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  // Register the background-fetch task once. The task is defined in
  // src/services/backgroundSync.ts and registered via TaskManager.defineTask
  // at module-load time so iOS / Android can wake the app periodically.
  useEffect(() => {
    registerBackgroundSync().catch((e) => {
      console.warn('[_layout] registerBackgroundSync failed', e);
    });
  }, []);

  // Pull inbox + consume widget queues + republish snapshot on:
  //   - app cold start (initial mount)
  //   - app returning to foreground (active state)
  //   - app going to background (so the next widget refresh is fresh)
  useEffect(() => {
    refreshFromBackground();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' || nextAppState === 'background') {
        refreshFromBackground();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

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
        <Stack.Screen name="habit/[id]" options={{ headerShown: false }} />
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
