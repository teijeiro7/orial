import { startOfDay, differenceInDays, subDays, isSameDay } from 'date-fns';
import type { HabitEntry } from '../../drizzle/schema';

export interface StreakResult {
  currentStreak: number;
  bestStreak: number;
  completionRate: number;
  totalCompleted: number;
  totalTargetDays: number;
}

export function calculateStreak(
  entries: HabitEntry[],
  targetDays: number[], // [1,2,3,4,5] = Mon-Fri
  since: Date = new Date()
): StreakResult {
  if (entries.length === 0) {
    return { currentStreak: 0, bestStreak: 0, completionRate: 0, totalCompleted: 0, totalTargetDays: 0 };
  }

  // Sort entries by date (newest first)
  const sortedEntries = [...entries].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Get today and check if it's a target day
  const today = startOfDay(since);
  const todayWeekday = today.getDay() || 7; // Convert Sunday (0) to 7
  
  // Calculate current streak
  let currentStreak = 0;
  let checkDate = today;
  let entryIndex = 0;

  // Check if today is completed
  const todayEntry = sortedEntries.find(e => isSameDay(new Date(e.date), today));
  const isTodayTargetDay = targetDays.includes(todayWeekday);
  
  if (todayEntry?.completed) {
    currentStreak = 1;
    checkDate = subDays(checkDate, 1);
  } else if (isTodayTargetDay && !todayEntry) {
    // Today is a target day but not completed - streak is 0
    currentStreak = 0;
  }

  // Walk backwards through days
  while (true) {
    const weekday = checkDate.getDay() || 7;
    const isTargetDay = targetDays.includes(weekday);
    
    if (!isTargetDay) {
      // Non-target day doesn't affect streak
      checkDate = subDays(checkDate, 1);
      continue;
    }

    const entry = sortedEntries.find(e => isSameDay(new Date(e.date), checkDate));
    
    if (entry?.completed) {
      currentStreak++;
      checkDate = subDays(checkDate, 1);
    } else {
      break;
    }
  }

  // Calculate best streak
  let bestStreak = 0;
  let tempStreak = 0;
  
  // Get all unique dates that were target days
  const allDates = new Map<string, boolean>();
  sortedEntries.forEach(entry => {
    const date = startOfDay(new Date(entry.date));
    const weekday = date.getDay() || 7;
    if (targetDays.includes(weekday)) {
      allDates.set(date.toISOString(), entry.completed);
    }
  });

  // Sort dates
  const sortedDates = Array.from(allDates.entries())
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());

  for (const [, completed] of sortedDates) {
    if (completed) {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  // Calculate completion rate (last 30 days)
  const thirtyDaysAgo = subDays(today, 30);
  let completedInRange = 0;
  let targetDaysInRange = 0;

  for (let i = 0; i <= 30; i++) {
    const checkDate = subDays(today, i);
    const weekday = checkDate.getDay() || 7;
    
    if (targetDays.includes(weekday)) {
      targetDaysInRange++;
      const entry = sortedEntries.find(e => isSameDay(new Date(e.date), checkDate));
      if (entry?.completed) {
        completedInRange++;
      }
    }
  }

  const completionRate = targetDaysInRange > 0 
    ? Math.round((completedInRange / targetDaysInRange) * 100) 
    : 0;

  const totalCompleted = sortedEntries.filter(e => e.completed).length;

  return {
    currentStreak,
    bestStreak,
    completionRate,
    totalCompleted,
    totalTargetDays: targetDaysInRange,
  };
}

export function getWeekDaysArray(): string[] {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
}

export function getWeekDayNumber(dayName: string): number {
  const days = getWeekDaysArray();
  return days.indexOf(dayName) + 1;
}
