import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check, Calendar, AlertCircle } from 'lucide-react-native';
import { GlassCard } from '../../src/components/GlassCard';
import { calendarService, type DeviceCalendar } from '../../src/services/calendarService';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';

interface CalendarSettingsScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function CalendarSettingsScreen({ visible, onClose }: CalendarSettingsScreenProps) {
  const [hasPermission, setHasPermission] = useState(false);
  const [calendars, setCalendars] = useState<DeviceCalendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);

  useEffect(() => {
    if (visible) {
      checkPermissionAndLoad();
    }
  }, [visible]);

  async function checkPermissionAndLoad() {
    const permitted = await calendarService.getPermissionsStatus();
    setHasPermission(permitted);

    if (permitted) {
      await loadCalendars();
    }
  }

  async function loadCalendars() {
    setIsLoading(true);
    try {
      const availableCalendars = await calendarService.getCalendars();
      setCalendars(availableCalendars);
      
      // Check if we have a selected calendar
      const currentSelected = calendarService.getSelectedCalendar();
      if (currentSelected) {
        setSelectedCalendarId(currentSelected);
        setSyncEnabled(true);
      }
    } catch (error) {
      console.error('Error loading calendars:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function requestPermission() {
    const granted = await calendarService.requestPermissions();
    setHasPermission(granted);
    
    if (granted) {
      await loadCalendars();
    } else {
      Alert.alert(
        'Permission Required',
        'Calendar access is needed to sync your habit reminders. Please enable it in Settings.',
        [{ text: 'OK' }]
      );
    }
  }

  function selectCalendar(calendarId: string) {
    calendarService.setSelectedCalendar(calendarId);
    setSelectedCalendarId(calendarId);
    setSyncEnabled(true);
  }

  function toggleSync(enabled: boolean) {
    if (enabled && !selectedCalendarId && calendars.length > 0) {
      // Auto-select first calendar if none selected
      selectCalendar(calendars[0].id);
    } else if (!enabled) {
      calendarService.setSelectedCalendar('');
      setSelectedCalendarId(null);
    }
    setSyncEnabled(enabled);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={OrialTypography.headingMedium}>Calendar Settings</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={24} color={OrialColors.textPrimary} />
          </Pressable>
        </View>

        {!hasPermission ? (
          <View style={styles.permissionContainer}>
            <GlassCard style={styles.permissionCard}>
              <AlertCircle size={48} color={OrialColors.warning} style={styles.permissionIcon} />
              <Text style={[OrialTypography.headingSmall, styles.permissionTitle]}>
                Calendar Access Needed
              </Text>
              <Text style={[OrialTypography.bodyMedium, styles.permissionDescription]}>
                Allow Orial to access your calendar to sync habit reminders as events.
              </Text>
              
              <Pressable 
                style={styles.permissionButton}
                onPress={requestPermission}
              >
                <Text style={[OrialTypography.button, styles.permissionButtonText]}>
                  Allow Access
                </Text>
              </Pressable>
            </GlassCard>
          </View>
        ) : (
          <View style={styles.content}>
            <GlassCard style={styles.syncCard}>
              <View style={styles.syncRow}>
                <View style={styles.syncInfo}>
                  <Text style={OrialTypography.headingSmall}>Sync to Calendar</Text>
                  <Text style={OrialTypography.caption}>
                    Create calendar events for habit reminders
                  </Text>
                </View>
                <Switch
                  value={syncEnabled}
                  onValueChange={toggleSync}
                  trackColor={{ false: OrialColors.surface, true: OrialColors.violet }}
                  thumbColor={OrialColors.textPrimary}
                />
              </View>
            </GlassCard>

            {syncEnabled && (
              <View style={styles.calendarsSection}>
                <Text style={[OrialTypography.caption, styles.sectionLabel]}>
                  Select Calendar
                </Text>
                
                {calendars.length === 0 ? (
                  <GlassCard style={styles.emptyCard}>
                    <Text style={OrialTypography.bodyMedium}>
                      No calendars found
                    </Text>
                  </GlassCard>
                ) : (
                  <View style={styles.calendarsList}>
                    {calendars.map(calendar => (
                      <Pressable
                        key={calendar.id}
                        style={[
                          styles.calendarItem,
                          selectedCalendarId === calendar.id && styles.selectedCalendar
                        ]}
                        onPress={() => selectCalendar(calendar.id)}
                      >
                        <View style={styles.calendarRow}>
                          <View 
                            style={[
                              styles.calendarColor,
                              { backgroundColor: calendar.color }
                            ]} 
                          />
                          <View style={styles.calendarInfo}>
                            <Text style={OrialTypography.bodyMedium}>
                              {calendar.title}
                            </Text>
                          </View>
                          
                          {selectedCalendarId === calendar.id && (
                            <Check size={20} color={OrialColors.success} />
                          )}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}

            <GlassCard style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Calendar size={20} color={OrialColors.violetLight} />
                <View style={styles.infoText}>
                  <Text style={OrialTypography.bodyMedium}>What gets synced?</Text>
                  <Text style={OrialTypography.caption}>
                    When you create a reminder, a recurring calendar event will be created for your habit.
                  </Text>
                </View>
              </View>
            </GlassCard>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OrialColors.deepNavy,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: OrialColors.glassBorder,
  },
  closeButton: {
    padding: 8,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  permissionCard: {
    padding: 32,
    alignItems: 'center',
  },
  permissionIcon: {
    marginBottom: 16,
  },
  permissionTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  permissionDescription: {
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: OrialColors.violet,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: OrialColors.textPrimary,
  },
  content: {
    padding: 16,
  },
  syncCard: {
    marginBottom: 16,
  },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncInfo: {
    flex: 1,
  },
  calendarsSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  calendarsList: {
    gap: 8,
  },
  calendarItem: {
    backgroundColor: OrialColors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  selectedCalendar: {
    borderColor: OrialColors.violet,
    backgroundColor: OrialColors.violet + '10',
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calendarColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  calendarInfo: {
    flex: 1,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 24,
  },
  infoCard: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoText: {
    flex: 1,
  },
});
