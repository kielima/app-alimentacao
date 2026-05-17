export type Sex = 'male' | 'female';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'intense' | 'extreme';

export type Goal = 'lose' | 'maintain' | 'gain';

export interface UserProfile {
  weightKg: number | null;
  heightCm: number | null;
  ageYears: number | null;
  sex: Sex | null;
  activity: ActivityLevel | null;
  goal: Goal | null;
  updatedAt?: string;
}

export interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  bmr: number;
  tdee: number;
}

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Feminino' },
];

export const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; hint: string }[] = [
  { value: 'sedentary', label: 'Sedentário', hint: 'Pouco ou nenhum exercício' },
  { value: 'light', label: 'Leve', hint: '1-3x por semana' },
  { value: 'moderate', label: 'Moderado', hint: '3-5x por semana' },
  { value: 'intense', label: 'Intenso', hint: '6-7x por semana' },
  { value: 'extreme', label: 'Extremo', hint: 'Atleta ou trabalho físico pesado' },
];

export const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'lose', label: 'Perder peso' },
  { value: 'maintain', label: 'Manter peso' },
  { value: 'gain', label: 'Ganhar massa' },
];

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  intense: 1.725,
  extreme: 1.9,
};

export const GOAL_KCAL_DELTA: Record<Goal, number> = {
  lose: -0.15,
  maintain: 0,
  gain: 0.10,
};

export const PROTEIN_PER_KG: Record<Goal, number> = {
  lose: 2.2,
  maintain: 1.8,
  gain: 2.0,
};

export const FAT_PCT_OF_KCAL: Record<Goal, number> = {
  lose: 0.25,
  maintain: 0.28,
  gain: 0.25,
};

export const EMPTY_USER_PROFILE: UserProfile = {
  weightKg: null,
  heightCm: null,
  ageYears: null,
  sex: null,
  activity: null,
  goal: null,
};
