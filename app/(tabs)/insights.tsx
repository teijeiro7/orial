import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, RefreshCw } from 'lucide-react-native';
import { GlassCard } from '@/src/components/GlassCard';
import {
  insightService,
  applyDismiss,
  type Insight,
  type InsightCategory,
  type InsightSeverity,
} from '@/src/services/insightService';
import { OrialColors } from '@/src/utils/colors';
import { OrialTypography } from '@/src/utils/typography';

const CATEGORY_EMOJI: Record<InsightCategory, string> = {
  sleep: '😴',
  gym: '🏋️',
  nutrition: '🥗',
  caffeine: '☕',
  finance: '💰',
  mixed: '🔀',
};

const SEVERITY_SECTIONS: { severity: InsightSeverity; emoji: string; label: string; color: string }[] = [
  { severity: 'critical', emoji: '🔴', label: 'Crítico', color: OrialColors.error },
  { severity: 'warning', emoji: '🟡', label: 'Atención', color: OrialColors.warning },
  { severity: 'info', emoji: '🟢', label: 'Logro', color: OrialColors.success },
];

function todayLabel(): string {
  return new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function InsightsScreen() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInsights = useCallback(async () => {
    const data = await insightService.getInsights();
    setInsights(data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadInsights();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadInsights]);

  async function handleDismiss(id: string) {
    // Optimistic update so the card disappears immediately.
    setInsights((current) => applyDismiss(current, id).filter((insight) => !insight.dismissed));
    try {
      await insightService.dismissInsight(id);
    } catch {
      Alert.alert('Error', 'No se pudo descartar el insight. Inténtalo de nuevo.');
      await loadInsights();
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await insightService.requestManualRefresh();
      await loadInsights();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      Alert.alert('No se pudo actualizar', message);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={OrialTypography.headingMedium}>🧠 Insights</Text>
        <Text style={[OrialTypography.caption, styles.todayLabel]}>{todayLabel()}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={OrialColors.violetLight} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {insights.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Text style={[OrialTypography.bodyMedium, styles.emptyText]}>
                Sin insights por ahora. Jarvis analiza tus datos cada pocas horas — vuelve más tarde o pulsa
                "Actualizar insights".
              </Text>
            </GlassCard>
          ) : (
            SEVERITY_SECTIONS.map(({ severity, emoji, label, color }) => {
              const items = insights.filter((insight) => insight.severity === severity);
              if (items.length === 0) return null;

              return (
                <View key={severity} style={styles.section}>
                  <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>
                    {emoji} {label}
                  </Text>
                  <View style={styles.cardsList}>
                    {items.map((insight) => (
                      <GlassCard key={insight.id} style={styles.card} accentColor={color}>
                        <View style={styles.cardHeader}>
                          <Text style={[OrialTypography.bodyLarge, styles.cardTitle]}>
                            {CATEGORY_EMOJI[insight.category]} {insight.title}
                          </Text>
                          <Pressable
                            onPress={() => handleDismiss(insight.id)}
                            style={styles.dismissButton}
                            hitSlop={8}
                          >
                            <X size={18} color={OrialColors.textMuted} />
                          </Pressable>
                        </View>
                        <Text style={OrialTypography.bodyMedium}>{insight.body}</Text>
                      </GlassCard>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <Pressable style={styles.refreshButton} onPress={handleRefresh} disabled={refreshing}>
        {refreshing ? (
          <ActivityIndicator color={OrialColors.textPrimary} size="small" />
        ) : (
          <RefreshCw size={18} color={OrialColors.textPrimary} />
        )}
        <Text style={[OrialTypography.button, styles.refreshButtonText]}>Actualizar insights</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OrialColors.deepNavy,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  todayLabel: {
    textTransform: 'capitalize',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  cardsList: {
    gap: 12,
  },
  card: {
    borderLeftWidth: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    color: OrialColors.textPrimary,
  },
  dismissButton: {
    padding: 4,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    textAlign: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: OrialColors.violet,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 12,
  },
  refreshButtonText: {
    color: OrialColors.textPrimary,
  },
});
