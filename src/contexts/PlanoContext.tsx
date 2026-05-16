import { createContext, useContext, useState } from 'react';
import { todayDayOfWeek, type DayOfWeek, type PlanType } from '../types/mealPlan';

interface PlanoContextValue {
  day: DayOfWeek;
  setDay: React.Dispatch<React.SetStateAction<DayOfWeek>>;
  planType: PlanType;
  setPlanType: React.Dispatch<React.SetStateAction<PlanType>>;
}

const PlanoContext = createContext<PlanoContextValue | null>(null);

export function PlanoProvider({ children }: { children: React.ReactNode }) {
  const [day, setDay] = useState<DayOfWeek>(todayDayOfWeek);
  const [planType, setPlanType] = useState<PlanType>('training_day');
  return (
    <PlanoContext.Provider value={{ day, setDay, planType, setPlanType }}>
      {children}
    </PlanoContext.Provider>
  );
}

export function usePlano() {
  const ctx = useContext(PlanoContext);
  if (!ctx) throw new Error('usePlano must be used within PlanoProvider');
  return ctx;
}
