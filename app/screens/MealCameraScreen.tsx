import { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { GlassCard } from '@/src/components/GlassCard';
import { OrialColors } from '@/src/utils/colors';
import { agentService, type OCRFoodItem, type OCRResult } from '@/src/services/openclawService';
import { nutritionService } from '@/src/services/nutritionService';

type Step = 'camera' | 'analyzing' | 'result' | 'saving';

/** Recomputes a food item's macros after the user edits its estimated grams. */
function rescaleFood(food: OCRFoodItem, newGrams: number): OCRFoodItem {
  if (food.estimatedGrams <= 0) return { ...food, estimatedGrams: newGrams };
  const ratio = newGrams / food.estimatedGrams;
  return {
    ...food,
    estimatedGrams: newGrams,
    calories: Math.round(food.calories * ratio),
    protein: Math.round(food.protein * ratio * 10) / 10,
    carbs: Math.round(food.carbs * ratio * 10) / 10,
    fat: Math.round(food.fat * ratio * 10) / 10,
  };
}

function recomputeTotals(foods: OCRFoodItem[], result: OCRResult): OCRResult {
  return {
    ...result,
    foods,
    totalCalories: Math.round(foods.reduce((sum, f) => sum + f.calories, 0)),
    totalProteinG: Math.round(foods.reduce((sum, f) => sum + f.protein, 0) * 10) / 10,
    totalCarbsG: Math.round(foods.reduce((sum, f) => sum + f.carbs, 0) * 10) / 10,
    totalFatG: Math.round(foods.reduce((sum, f) => sum + f.fat, 0) * 10) / 10,
  };
}

export default function MealCameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>('camera');
  const [result, setResult] = useState<OCRResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTakePhoto = async () => {
    if (!cameraRef.current) return;
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!photo?.uri) throw new Error('No se pudo capturar la foto');
      setStep('analyzing');
      const analyzed = await agentService.sendImageForAnalysis(photo.uri);
      setResult(analyzed);
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo analizar la foto');
      setStep('camera');
    }
  };

  const handleGramsChange = (index: number, grams: string) => {
    if (!result) return;
    const parsed = Number.parseFloat(grams);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const foods = result.foods.map((food, i) => (i === index ? rescaleFood(food, parsed) : food));
    setResult(recomputeTotals(foods, result));
  };

  const handleSave = async () => {
    if (!result) return;
    setStep('saving');
    try {
      await nutritionService.logMeal(result);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la comida');
      setStep('result');
    }
  };

  const handleRetake = () => {
    setResult(null);
    setError(null);
    setStep('camera');
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={OrialColors.violetLight} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionBox}>
          <Text style={styles.title}>Analizar Comida</Text>
          <Text style={styles.permissionText}>
            Necesitamos acceso a la cámara para fotografiar tu plato y estimar las macros.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>Permitir cámara</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Analizar Comida</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {step === 'camera' && (
        <View style={styles.cameraWrap}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          <Pressable style={styles.captureBtn} onPress={handleTakePhoto} testID="take-photo-button">
            <Text style={styles.captureBtnText}>📷 Tomar Foto</Text>
          </Pressable>
        </View>
      )}

      {step === 'analyzing' && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={OrialColors.violetLight} />
          <Text style={styles.loadingText}>Analizando comida con Jarvis…</Text>
        </View>
      )}

      {(step === 'result' || step === 'saving') && result && (
        <ScrollView contentContainerStyle={styles.resultScroll}>
          <Text style={styles.sectionTitle}>Resultado</Text>

          {result.foods.map((food, index) => (
            <GlassCard key={`${food.name}-${index}`} style={styles.foodCard}>
              <View style={styles.foodRow}>
                <Text style={styles.foodName}>{food.name}</Text>
                {editing ? (
                  <TextInput
                    style={styles.gramsInput}
                    keyboardType="numeric"
                    defaultValue={String(food.estimatedGrams)}
                    onChangeText={(text) => handleGramsChange(index, text)}
                  />
                ) : (
                  <Text style={styles.foodGrams}>{food.estimatedGrams}g</Text>
                )}
              </View>
              <Text style={styles.foodMacros}>
                {food.calories} kcal · P{food.protein}g · C{food.carbs}g · G{food.fat}g
              </Text>
            </GlassCard>
          ))}

          <GlassCard style={styles.totalsCard}>
            <Text style={styles.totalsText}>
              Total: {result.totalCalories}kcal | P:{result.totalProteinG}g C:{result.totalCarbsG}g G:
              {result.totalFatG}g
            </Text>
            <Text style={styles.disclaimer}>{result.disclaimer}</Text>
          </GlassCard>

          <Pressable style={styles.secondaryBtn} onPress={() => setEditing((v) => !v)}>
            <Text style={styles.secondaryBtnText}>{editing ? 'Listo' : 'Editar cantidades'}</Text>
          </Pressable>

          <Pressable
            style={[styles.primaryBtn, step === 'saving' && styles.disabledBtn]}
            onPress={handleSave}
            disabled={step === 'saving'}
          >
            {step === 'saving' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>✅ Guardar en nutrición</Text>
            )}
          </Pressable>

          <Pressable style={styles.retakeBtn} onPress={handleRetake} disabled={step === 'saving'}>
            <Text style={styles.retakeBtnText}>Repetir foto</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OrialColors.deepNavy },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: OrialColors.textPrimary, fontFamily: 'Inter-Bold' },
  permissionBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, gap: 16 },
  permissionText: { color: OrialColors.textSecondary, textAlign: 'center', fontFamily: 'Inter-Regular' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: OrialColors.textSecondary, fontFamily: 'Inter-Regular' },
  cameraWrap: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
  camera: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  captureBtn: {
    marginTop: 16,
    backgroundColor: OrialColors.violet,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  captureBtnText: { color: '#fff', fontSize: 15, fontWeight: '600', fontFamily: 'Inter-SemiBold' },
  errorBox: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.12)' },
  errorText: { color: OrialColors.error, fontFamily: 'Inter-Regular', fontSize: 13 },
  resultScroll: { paddingHorizontal: 16, paddingBottom: 32 },
  sectionTitle: { color: OrialColors.textMuted, fontSize: 11, letterSpacing: 1.2, marginBottom: 10, fontFamily: 'Inter-Medium' },
  foodCard: { marginBottom: 8, padding: 14 },
  foodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  foodName: { color: OrialColors.textPrimary, fontSize: 14, fontFamily: 'Inter-SemiBold', flex: 1 },
  foodGrams: { color: OrialColors.textSecondary, fontSize: 13, fontFamily: 'Inter-Regular' },
  gramsInput: {
    color: OrialColors.textPrimary,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    borderWidth: 1,
    borderColor: OrialColors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 60,
    textAlign: 'right',
  },
  foodMacros: { color: OrialColors.textMuted, fontSize: 12, marginTop: 4, fontFamily: 'Inter-Regular' },
  totalsCard: { marginTop: 8, marginBottom: 16, padding: 16 },
  totalsText: { color: OrialColors.textPrimary, fontSize: 15, fontFamily: 'Inter-SemiBold', marginBottom: 6 },
  disclaimer: { color: OrialColors.textMuted, fontSize: 11, fontFamily: 'Inter-Regular', fontStyle: 'italic' },
  primaryBtn: { backgroundColor: OrialColors.violet, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600', fontFamily: 'Inter-SemiBold' },
  disabledBtn: { opacity: 0.6 },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: OrialColors.border,
  },
  secondaryBtnText: { color: OrialColors.violetLight, fontSize: 13, fontFamily: 'Inter-Medium' },
  retakeBtn: { alignItems: 'center', paddingVertical: 8 },
  retakeBtnText: { color: OrialColors.textMuted, fontSize: 12, fontFamily: 'Inter-Regular' },
});
