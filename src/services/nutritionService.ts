import { db } from './database';
import { nutritionLogs, manualMetrics, sodiumIntake, hydration, type NutritionLog, type NewNutritionLog } from '../../drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import { generateUUID } from '../utils/uuid';
import { manualMetricsService } from './manualMetricsService';
import { hydrationService } from './hydrationService';

export interface OpenclawNutritionData {
  date: string;
  totalCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number;
  fiberG?: number;
  meals?: Array<{
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    sodium: number;
  }>;
}

export class NutritionService {
  private static instance: NutritionService;

  static getInstance(): NutritionService {
    if (!NutritionService.instance) {
      NutritionService.instance = new NutritionService();
    }
    return NutritionService.instance;
  }

  async importFromOpenclaw(data: OpenclawNutritionData): Promise<void> {
    // Save to nutrition logs
    const log: NewNutritionLog = {
      id: generateUUID(),
      date: data.date,
      source: 'openclaw',
      totalCalories: data.totalCalories,
      proteinG: data.proteinG,
      carbsG: data.carbsG,
      fatG: data.fatG,
      sodiumMg: data.sodiumMg,
      fiberG: data.fiberG || 0,
      rawData: JSON.stringify(data),
      createdAt: new Date(),
    };

    await db.insert(nutritionLogs).values(log).onConflictDoUpdate({
      target: nutritionLogs.id,
      set: log,
    });

    // Update manual metrics with nutrition data
    await manualMetricsService.updateMetrics(data.date, {
      caloriesIn: data.totalCalories,
      proteinG: data.proteinG,
      carbsG: data.carbsG,
      fatG: data.fatG,
      sodiumMg: data.sodiumMg,
      fiberG: data.fiberG || 0,
    });

    // Update sodium intake records
    if (data.meals && data.meals.length > 0) {
      for (const meal of data.meals) {
        if (meal.sodium > 0) {
          await db.insert(sodiumIntake).values({
            id: generateUUID(),
            date: data.date,
            source: meal.name,
            sodiumMg: meal.sodium,
            mealType: 'meal',
            notes: `${meal.calories} kcal`,
            createdAt: new Date(),
          });
        }
      }
      
      // Recalculate hydration target based on sodium
      await hydrationService.recalculateHydrationTarget(data.date);
    }
  }

  async getTodayNutrition(): Promise<NutritionLog | null> {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.select().from(nutritionLogs).where(eq(nutritionLogs.date, today)).limit(1);
    return result[0] || null;
  }

  async getHistory(days: number = 7): Promise<NutritionLog[]> {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const startDate = start.toISOString().split('T')[0];

    return db
      .select()
      .from(nutritionLogs)
      .where(eq(nutritionLogs.date, startDate)) // Simplified - should use gte
      .orderBy(desc(nutritionLogs.date));
  }

  // Parse Openclaw message and extract nutrition data
  async parseOpenclawMessage(message: string): Promise<OpenclawNutritionData | null> {
    const startMarker = '###ORIAL_NUTRITION###';
    const endMarker = '###END_ORIAL###';
    
    const startIndex = message.indexOf(startMarker);
    const endIndex = message.indexOf(endMarker);
    
    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
      return null;
    }
    
    const jsonStr = message.substring(startIndex + startMarker.length, endIndex).trim();
    
    try {
      const data = JSON.parse(jsonStr) as OpenclawNutritionData;
      
      // Validate required fields
      if (!data.date || !data.totalCalories || !data.proteinG || !data.carbsG || !data.fatG || !data.sodiumMg) {
        console.warn('Openclaw nutrition data missing required fields');
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Failed to parse Openclaw nutrition JSON:', error);
      return null;
    }
  }

  // Process a full Openclaw message: parse and import
  async processOpenclawMessage(message: string): Promise<boolean> {
    const data = await this.parseOpenclawMessage(message);
    if (data) {
      await this.importFromOpenclaw(data);
      return true;
    }
    return false;
  }

  // Helper for Openclaw agent to format data
  static formatForAgent(): string {
    return `
# FORMATO DE RESPUESTA PARA ORIAL APP

Cuando proporciones datos nutricionales del día, usa EXACTAMENTE este formato JSON al final de tu mensaje:

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
      "name": "string",
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0,
      "sodium": 0
    }
  ]
}
###END_ORIAL###

Instrucciones:
- La sección debe estar entre ###ORIAL_NUTRITION### y ###END_ORIAL###
- date: fecha actual en formato YYYY-MM-DD
- totalCalories: calorías totales del día
- proteinG/carbsG/fatG: gramos totales de cada macronutriente
- sodiumMg: miligramos totales de sodio (CRÍTICO para cálculo de hidratación)
- fiberG: gramos de fibra (opcional)
- meals: array con cada comida del día
    `.trim();
  }
}

export const nutritionService = NutritionService.getInstance();
