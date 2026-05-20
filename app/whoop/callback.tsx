import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { whoopService } from '../../src/services/whoopService';
import { OrialColors } from '../../src/utils/colors';

export default function WhoopCallback() {
  const { code, error } = useLocalSearchParams<{ code?: string; error?: string }>();
  const router = useRouter();

  useEffect(() => {
    if (error) {
      router.replace('/(tabs)/forge');
      return;
    }
    if (!code) return;

    whoopService
      .handleCallback(code as string)
      .then(() => router.replace('/(tabs)/forge'))
      .catch(() => router.replace('/(tabs)/forge'));
  }, [code, error]);

  return (
    <View style={{ flex: 1, backgroundColor: OrialColors.deepNavy, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={OrialColors.violetLight} />
      <Text style={{ color: OrialColors.textSecondary, marginTop: 12 }}>Connecting WHOOP...</Text>
    </View>
  );
}
