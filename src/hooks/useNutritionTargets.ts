import { useMemo } from 'react';
import { useUserProfile } from '../data/userProfile';
import { computeTargets } from '../utils/profileTargets';
import type { NutritionTargets } from '../types/userProfile';

export function useNutritionTargets(): NutritionTargets | null {
  const profile = useUserProfile();
  return useMemo(() => computeTargets(profile), [profile]);
}
