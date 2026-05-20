import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Copy, Check, Bot, MessageSquare } from 'lucide-react-native';
import { useState } from 'react';
import { GlassCard } from '@/src/components/GlassCard';
import { OrialColors } from '@/src/utils/colors';
import { OrialTypography } from '@/src/utils/typography';
import { nutritionService } from '@/src/services/nutritionService';

export default function OpenclawConfigScreen() {
  const [copied, setCopied] = useState(false);

  const instructions = `
# Configuración de Hermes Agent para Orial

## Instrucciones para el Agente

Cuando el usuario te pida registrar su nutrición del día (por texto o foto), sigue estos pasos:

1. **Analiza las comidas** descritas por el usuario o visibles en la foto
2. **Calcula los totales**:
   - Calorías totales
   - Proteínas (g)
   - Carbohidratos (g) 
   - Grasas (g)
   - Sodio (mg) - IMPORTANTE para hidratación
   - Fibra (g) - opcional

3. **Responde normalmente** con el análisis nutricional

4. **AL FINAL** de tu mensaje, incluye EXACTAMENTE este bloque JSON:

###ORIAL_NUTRITION###
{
  "date": "YYYY-MM-DD",
  "totalCalories": 0,
  "proteinG": 0,
  "carbsG": 0,
  "fatG": 0,
  "sodiumMg": 0,
  "fiberG": 0,
  "meals": [
    {
      "name": "Nombre de la comida",
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0,
      "sodium": 0
    }
  ]
}
###END_ORIAL###

## Reglas Importantes

- La fecha debe ser YYYY-MM-DD (ej: 2024-01-15)
- El sodio es CRÍTICO - afecta directamente el cálculo de hidratación
- Incluye TODAS las comidas del día en el array meals
- Los valores deben ser números, no strings
- No modifiques los nombres de las claves
- El bloque debe estar exactamente entre ###ORIAL_NUTRITION### y ###END_ORIAL###

## Ejemplo Completo

"Hoy desayuné huevos con tocino (400 kcal, 25g protein, 5g carbs, 30g fat, 800mg sodium) y cené pollo con arroz (600 kcal, 40g protein, 60g carbs, 20g fat, 500mg sodium)."

Tu respuesta:
"Total del día: 1000 kcal
- Proteína: 65g
- Carbs: 65g  
- Grasas: 50g
- Sodio: 1300mg

Resumen: Buen balance proteico, sodio moderado. Considera aumentar hidratación en +0.56L por el sodio."

###ORIAL_NUTRITION###
{
  "date": "2024-01-15",
  "totalCalories": 1000,
  "proteinG": 65,
  "carbsG": 65,
  "fatG": 50,
  "sodiumMg": 1300,
  "fiberG": 0,
  "meals": [
    {
      "name": "Huevos con tocino",
      "calories": 400,
      "protein": 25,
      "carbs": 5,
      "fat": 30,
      "sodium": 800
    },
    {
      "name": "Pollo con arroz",
      "calories": 600,
      "protein": 40,
      "carbs": 60,
      "fat": 20,
      "sodium": 500
    }
  ]
}
###END_ORIAL###
`;

  const handleCopy = () => {
    // In a real app, you'd use Clipboard.setString(instructions)
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={OrialTypography.headingLarge}>Hermes Agent Setup</Text>
          <Text style={OrialTypography.caption}>Configure your AI agent to sync with Orial</Text>
        </View>

        <GlassCard style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Bot size={24} color={OrialColors.violetLight} />
            <Text style={[OrialTypography.headingSmall, styles.infoTitle]}>How it works</Text>
          </View>
          <Text style={[OrialTypography.bodyMedium, styles.infoText]}>
            Your Hermes Agent can automatically send nutrition data to Orial by including a special JSON block at the end of messages. The app will parse this data and update your nutrition logs, hydration targets, and weight predictions.
          </Text>
        </GlassCard>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MessageSquare size={20} color={OrialColors.cyan} />
            <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Agent Instructions</Text>
          </View>

          <Pressable style={styles.copyButton} onPress={handleCopy}>
            {copied ? (
              <>
                <Check size={16} color={OrialColors.success} />
                <Text style={[styles.copyText, { color: OrialColors.success }]}>Copied!</Text>
              </>
            ) : (
              <>
                <Copy size={16} color={OrialColors.cyan} />
                <Text style={styles.copyText}>Copy Instructions</Text>
              </>
            )}
          </Pressable>

          <GlassCard style={styles.codeCard}>
            <Text style={styles.codeText}>{instructions}</Text>
          </GlassCard>
        </View>

        <GlassCard style={styles.tipCard}>
          <Text style={[OrialTypography.headingSmall, styles.tipTitle]}>Pro Tips</Text>
          
          <View style={styles.tipItem}>
            <Text style={[OrialTypography.caption, styles.tipBullet]}>1.</Text>
            <Text style={OrialTypography.caption}> Always include sodium - it affects hydration targets</Text>
          </View>
          
          <View style={styles.tipItem}>
            <Text style={[OrialTypography.caption, styles.tipBullet]}>2.</Text>
            <Text style={OrialTypography.caption}> Use the exact format - the parser is strict</Text>
          </View>
          
          <View style={styles.tipItem}>
            <Text style={[OrialTypography.caption, styles.tipBullet]}>3.</Text>
            <Text style={OrialTypography.caption}> Meals array helps track individual food items</Text>
          </View>
          
          <View style={styles.tipItem}>
            <Text style={[OrialTypography.caption, styles.tipBullet]}>4.</Text>
            <Text style={OrialTypography.caption}> The app automatically updates weight predictions based on nutrition</Text>
          </View>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OrialColors.deepNavy,
  },
  header: {
    padding: 20,
    paddingBottom: 8,
  },
  infoCard: {
    margin: 16,
    padding: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  infoTitle: {
    color: OrialColors.textPrimary,
  },
  infoText: {
    color: OrialColors.textSecondary,
    lineHeight: 22,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: OrialColors.textPrimary,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: OrialColors.cyan + '20',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
  },
  copyText: {
    color: OrialColors.cyan,
    fontWeight: '600',
  },
  codeCard: {
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: '#0D1117',
  },
  codeText: {
    color: '#E6EDF3',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 20,
  },
  tipCard: {
    margin: 16,
    padding: 16,
    marginBottom: 32,
  },
  tipTitle: {
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tipBullet: {
    color: OrialColors.cyan,
    fontWeight: '700',
  },
});
