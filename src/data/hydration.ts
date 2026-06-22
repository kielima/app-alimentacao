import { createFirestoreDocStore } from '../utils/createFirestoreDocStore';

// Controle de água compartilhado com o app de Ritual (ritual-app).
//
// O ritual já tem o controle de hidratação completo e o espelha no Firestore em
// `users/{uid}/dados/aguaIngerida` (mapa data→ml) e `users/{uid}/dados/metaAgua`
// (número), ambos no formato envelope `{ json: "<JSON>" }`. Como os dois apps
// usam o MESMO projeto/uid, aqui lemos/escrevemos exatamente esses docs — assim
// um copo registrado aqui aparece na barra de água do ritual ao vivo, e
// vice-versa. NÃO usamos o createFirestoreStore (que grava coleções
// estruturadas): precisamos do mesmo envelope `{ json }` do ritual.

export type AguaIngerida = Record<string, number>; // 'YYYY-MM-DD' → ml

export const ML_COPO = 200; // botão padrão (copo)
export const ML_GARRAFA = 500; // botão grande (garrafa/caneca)
export const META_PADRAO_ML = 2000;

// Chave de data IDÊNTICA à do ritual (lib/progresso.ts: dataISO) — data LOCAL
// no formato YYYY-MM-DD —, para que o mesmo dia some no mesmo lugar nos dois
// apps. Não usar toISOString() (que é UTC e viraria o dia à noite).
export function dataISO(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const aguaStore = createFirestoreDocStore<AguaIngerida>({
  storageKey: 'app-alimentacao:agua',
  collection: 'dados',
  docId: 'aguaIngerida',
  pick: (raw) => {
    if (!raw || typeof raw.json !== 'string') return null;
    try {
      const parsed = JSON.parse(raw.json);
      return parsed && typeof parsed === 'object' ? (parsed as AguaIngerida) : null;
    } catch {
      return null;
    }
  },
  merge: (value) => ({ json: JSON.stringify(value) }),
});

const metaStore = createFirestoreDocStore<number>({
  storageKey: 'app-alimentacao:metaAgua',
  collection: 'dados',
  docId: 'metaAgua',
  pick: (raw) => {
    if (!raw || typeof raw.json !== 'string') return null;
    try {
      const parsed = JSON.parse(raw.json);
      return typeof parsed === 'number' ? parsed : null;
    } catch {
      return null;
    }
  },
  merge: (value) => ({ json: JSON.stringify(value) }),
});

export function aguaDoDia(map: AguaIngerida | null, hoje: Date = new Date()): number {
  return map?.[dataISO(hoje)] ?? 0;
}

// Soma `ml` ao total de hoje (preservando os demais dias). Valores resultantes
// negativos viram zero (permite corrigir com -200).
export function registrarAgua(ml: number, hoje: Date = new Date()): void {
  const map = aguaStore.get() ?? {};
  const iso = dataISO(hoje);
  const total = Math.max(0, (map[iso] ?? 0) + ml);
  aguaStore.set({ ...map, [iso]: total });
}

// Sobrescreve o total de hoje (ex.: zerar/corrigir manualmente).
export function definirAguaDoDia(ml: number, hoje: Date = new Date()): void {
  const map = aguaStore.get() ?? {};
  aguaStore.set({ ...map, [dataISO(hoje)]: Math.max(0, ml) });
}

export function definirMeta(ml: number): void {
  metaStore.set(Math.max(0, ml));
}

// Hooks reativos (re-renderizam quando a nuvem ou um registro local mudam).
export function useAgua(): AguaIngerida | null {
  return aguaStore.useValue();
}

export function useMeta(): number {
  return metaStore.useValue() ?? META_PADRAO_ML;
}
