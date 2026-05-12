import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { WelcomeStep } from './steps/WelcomeStep';
import { HabitsStep } from './steps/HabitsStep';
import { NotificationsStep } from './steps/NotificationsStep';
import { NotionStep } from './steps/NotionStep';
import { CalendarStep } from './steps/CalendarStep';
import { OpenclawStep } from './steps/OpenclawStep';
import { useAppStore } from '../../src/stores/appStore';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';

const STEPS = [
  { id: 'welcome', component: WelcomeStep, title: 'Welcome' },
  { id: 'habits', component: HabitsStep, title: 'Habits' },
  { id: 'notifications', component: NotificationsStep, title: 'Reminders' },
  { id: 'notion', component: NotionStep, title: 'Notion' },
  { id: 'calendar', component: CalendarStep, title: 'Calendar' },
  { id: 'openclaw', component: OpenclawStep, title: 'Openclaw' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const setOnboardingCompleted = useAppStore(state => state.setOnboardingCompleted);

  const step = STEPS[currentStep];
  const StepComponent = step.component;

  function handleNext() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      finishOnboarding();
    }
  }

  function handleSkip() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      finishOnboarding();
    }
  }

  function finishOnboarding() {
    setOnboardingCompleted(true);
    router.replace('/login');
  }

  function handleClose() {
    finishOnboarding();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.progressContainer}>
          {STEPS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index <= currentStep && styles.progressDotActive,
              ]}
            />
          ))}
        </View>
        <Pressable style={styles.closeButton} onPress={handleClose}>
          <X size={20} color={OrialColors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.stepContainer}>
        <StepComponent onNext={handleNext} onSkip={handleSkip} />
      </View>
    </SafeAreaView>
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
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: OrialColors.surface,
  },
  progressDotActive: {
    backgroundColor: OrialColors.violet,
  },
  closeButton: {
    padding: 8,
    backgroundColor: OrialColors.surface,
    borderRadius: 12,
  },
  stepContainer: {
    flex: 1,
  },
});