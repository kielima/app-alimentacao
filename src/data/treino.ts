import { createFirestoreDocStore } from '../utils/createFirestoreDocStore';
import type { DayOfWeek, PlanType } from '../types/mealPlan';

// Leitura E ESCRITA da escolha de treino por dia, guardada em
// `users/{uid}/dados/tiposTreino` (mesmo projeto/uid do app de Ritual). Serve
// para o plano de comida acompanhar automaticamente o dia: TREINO → training_day
// (pré/pós-treino); FOLGA/sem treino → rest_day (lanche da tarde).
//
// A sincronização é BIDIRECIONAL: o ritual escreve aqui ao escolher o treino do
// dia, e este app também escreve de volta ao alternar Treino/Descanso (ver
// `setPlanTypeForDay`). O ritual escuta este doc na nuvem e, ao virar 'folga',
// limpa os blocos de academia/natação e reescalona o despertador.

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
  // Envelope `{ json }` idêntico ao que o ritual grava (espelharNuvem), para que
  // os dois apps leiam/escrevam exatamente o mesmo doc.
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

// Escreve de volta a escolha de treino/descanso do dia no doc compartilhado
// `users/{uid}/dados/tiposTreino`, para o ritual reagir (limpar execução no dia
// de descanso e reescalonar o despertador).
//
// DESCANSO → 'folga'. TREINO → como o mapa não guarda se o dia era academia ou
// natação, restauramos o PADRÃO daquele dia da semana (TIPO_TREINO_PADRAO);
// domingo, que não tem padrão, cai em 'academia'. O usuário refina o tipo/horário
// exatos no app de ritual depois, se quiser.
export function setPlanTypeForDay(
  day: DayOfWeek,
  plan: PlanType,
  tipos: TiposTreino | null,
): void {
  const dia = diaSemanaDoDayOfWeek(day);
  const next: TiposTreino = { ...(tipos ?? {}) };
  next[dia] = plan === 'rest_day' ? 'folga' : TIPO_TREINO_PADRAO[dia] ?? 'academia';
  store.set(next);
}
