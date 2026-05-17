import {
  ACTIVITY_FACTORS,
  FAT_PCT_OF_KCAL,
  GOAL_KCAL_DELTA,
  PROTEIN_PER_KG,
  type Goal,
  type NutritionTargets,
  type Sex,
  type UserProfile,
} from '../types/userProfile';

export function getEffectiveProteinPerKg(p: Pick<UserProfile, 'goal' | 'proteinPerKgOverride'>): {
  value: number;
  isOverride: boolean;
} {
  const defaultValue = p.goal ? PROTEIN_PER_KG[p.goal] : PROTEIN_PER_KG.maintain;
  if (p.proteinPerKgOverride != null && p.proteinPerKgOverride > 0) {
    return { value: p.proteinPerKgOverride, isOverride: true };
  }
  return { value: defaultValue, isOverride: false };
}

export function getEffectiveFatPct(p: Pick<UserProfile, 'goal' | 'fatPctOverride'>): {
  value: number;
  isOverride: boolean;
} {
  const defaultValue = p.goal ? FAT_PCT_OF_KCAL[p.goal] : FAT_PCT_OF_KCAL.maintain;
  if (p.fatPctOverride != null && p.fatPctOverride > 0) {
    return { value: p.fatPctOverride, isOverride: true };
  }
  return { value: defaultValue, isOverride: false };
}

export function getDefaultProteinPerKg(goal: Goal): number {
  return PROTEIN_PER_KG[goal];
}

export function getDefaultFatPct(goal: Goal): number {
  return FAT_PCT_OF_KCAL[goal];
}

interface CompleteProfile {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: NonNullable<UserProfile['sex']>;
  activity: NonNullable<UserProfile['activity']>;
  goal: NonNullable<UserProfile['goal']>;
}

export function isProfileComplete(p: UserProfile | null): p is UserProfile & CompleteProfile {
  if (!p) return false;
  return (
    p.weightKg != null &&
    p.heightCm != null &&
    p.ageYears != null &&
    p.sex != null &&
    p.activity != null &&
    p.goal != null
  );
}

export function computeBMR(p: {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
}): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.ageYears;
  return p.sex === 'male' ? base + 5 : base - 161;
}

export function computeTargets(p: UserProfile | null): NutritionTargets | null {
  if (!isProfileComplete(p)) return null;
  if (p.weightKg <= 0 || p.heightCm <= 0 || p.ageYears <= 0) return null;

  const bmr = computeBMR(p);
  const tdee = bmr * ACTIVITY_FACTORS[p.activity];
  const calories = Math.round(tdee * (1 + GOAL_KCAL_DELTA[p.goal]));

  const proteinPerKg = getEffectiveProteinPerKg(p).value;
  const fatPct = getEffectiveFatPct(p).value;

  const protein = Math.round(p.weightKg * proteinPerKg);
  const fatKcal = calories * fatPct;
  const fat = Math.round(fatKcal / 9);

  const remainingKcal = calories - protein * 4 - fat * 9;
  const carbs = Math.max(0, Math.round(remainingKcal / 4));

  return {
    calories,
    protein,
    carbs,
    fat,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
  };
}
