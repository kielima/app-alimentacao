import { createFirestoreDocStore } from '../utils/createFirestoreDocStore';
import type { DayOfWeek, PlanType } from '../types/mealPlan';

// Leitura (somente) da escolha de treino por dia que o app de Ritual guarda em
// `users/{uid}/dados/tiposTreino` (mesmo projeto/uid). Serve para o plano de
// comida acompanhar automaticamente o dia: TREINO → training_day (pré/pós-treino);
// FOLGA/sem treino → rest_day (lanche da tarde).

export type TipoTreino = 'natacao' | 'academia' | 'folga';
export type DiaSemana = 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab';
type TiposTreino = Record<string, TipoTreino>; // chave = DiaSemana

// Índice = Date.getDay() (0=dom). Mesmo array do ritual (Home.tsx `DIAS`).
const DIAS: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

// Default por dia, espelhado de TIPO_TREINO_PADRAO (ritual-app/src/lib/rotinaDados.ts).
// Domingo ausente = sem treino (descanso).
const TIPO_TREINO_PADRAO: Partial<Record<DiaSemana, TipoTreino>> = {
  seg: 'academia',
  ter: 'natacao',
  qua: 'academia',
  qui: 'natacao',
  sex: 'academia',
  sab: 'academia',
};

const store = createFirestoreDocStore<TiposTreino>({
  storageKey: 'app-alimentacao:tiposTreino',
  collection: 'dados',
  docId: 'tiposTreino',
  pick: (raw) => {
    if (!raw || typeof raw.json !== 'string') return null;
    try {
      const parsed = JSON.parse(raw.json);
      return parsed && typeof parsed === 'object' ? (parsed as TiposTreino) : null;
    } catch {
      return null;
    }
  },
  // Somente leitura aqui — o ritual é quem escreve. merge() existe só para
  // satisfazer a API do store.
  merge: (value) => ({ json: JSON.stringify(value) }),
});

export function useTiposTreino(): TiposTreino | null {
  return store.useValue();
}

// DayOfWeek do plano (Seg=0…Dom=6) → DiaSemana ('dom'…'sab', Date.getDay()).
export function diaSemanaDoDayOfWeek(day: DayOfWeek): DiaSemana {
  return DIAS[(day + 1) % 7];
}

// Variante do plano para um dia, combinando a escolha do ritual com o default.
export function planTypeForDay(
  day: DayOfWeek,
  tipos: TiposTreino | null,
): PlanType {
  const dia = diaSemanaDoDayOfWeek(day);
  const tipo = tipos?.[dia] ?? TIPO_TREINO_PADRAO[dia];
  return tipo && tipo !== 'folga' ? 'training_day' : 'rest_day';
}
