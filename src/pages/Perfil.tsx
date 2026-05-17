import { useEffect, useState, type FormEvent } from 'react';
import HeaderSlot from '../components/HeaderSlot';
import { setUserProfile, useUserProfile } from '../data/userProfile';
import { computeTargets } from '../utils/profileTargets';
import {
  ACTIVITY_OPTIONS,
  EMPTY_USER_PROFILE,
  GOAL_OPTIONS,
  SEX_OPTIONS,
  type ActivityLevel,
  type Goal,
  type Sex,
  type UserProfile,
} from '../types/userProfile';

function parseNumber(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatNumberInput(value: number | null): string {
  if (value == null) return '';
  return String(value);
}

const RANGES = {
  weightKg: { min: 30, max: 300, label: 'peso' },
  heightCm: { min: 100, max: 250, label: 'altura' },
  ageYears: { min: 10, max: 100, label: 'idade' },
};

export default function Perfil() {
  const stored = useUserProfile();
  const current = stored ?? EMPTY_USER_PROFILE;

  const [weightStr, setWeightStr] = useState(() => formatNumberInput(current.weightKg));
  const [heightStr, setHeightStr] = useState(() => formatNumberInput(current.heightCm));
  const [ageStr, setAgeStr] = useState(() => formatNumberInput(current.ageYears));
  const [sex, setSex] = useState<Sex | ''>(current.sex ?? '');
  const [activity, setActivity] = useState<ActivityLevel | ''>(current.activity ?? '');
  const [goal, setGoal] = useState<Goal | ''>(current.goal ?? '');
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!stored) return;
    setWeightStr(formatNumberInput(stored.weightKg));
    setHeightStr(formatNumberInput(stored.heightCm));
    setAgeStr(formatNumberInput(stored.ageYears));
    setSex(stored.sex ?? '');
    setActivity(stored.activity ?? '');
    setGoal(stored.goal ?? '');
  }, [stored]);

  const draft: UserProfile = {
    weightKg: parseNumber(weightStr),
    heightCm: parseNumber(heightStr),
    ageYears: parseNumber(ageStr),
    sex: sex || null,
    activity: activity || null,
    goal: goal || null,
  };

  const previewTargets = computeTargets(draft);

  function validate(): string | null {
    for (const key of ['weightKg', 'heightCm', 'ageYears'] as const) {
      const v = draft[key];
      if (v == null) continue;
      const range = RANGES[key];
      if (v < range.min || v > range.max) {
        return `Valor de ${range.label} fora do intervalo (${range.min}–${range.max}).`;
      }
    }
    return null;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setUserProfile(draft);
    setSavedAt(Date.now());
  }

  const showSaved = savedAt !== null && Date.now() - savedAt < 3000;

  return (
    <form id="perfil-form" onSubmit={handleSubmit} className="mx-auto max-w-md px-4 pt-2 pb-28">
      <HeaderSlot>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">Perfil</h1>
        <button
          type="submit"
          form="perfil-form"
          className="shrink-0 rounded-full bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          Salvar
        </button>
      </HeaderSlot>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {showSaved && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
          Perfil salvo.
        </div>
      )}

      <Section title="Dados pessoais">
        <Field label="Peso (kg)">
          <input
            type="text"
            inputMode="decimal"
            value={weightStr}
            onChange={(e) => setWeightStr(e.target.value)}
            className={inputClass}
            placeholder="Ex.: 75"
          />
        </Field>
        <Field label="Altura (cm)">
          <input
            type="text"
            inputMode="numeric"
            value={heightStr}
            onChange={(e) => setHeightStr(e.target.value)}
            className={inputClass}
            placeholder="Ex.: 175"
          />
        </Field>
        <Field label="Idade (anos)">
          <input
            type="text"
            inputMode="numeric"
            value={ageStr}
            onChange={(e) => setAgeStr(e.target.value)}
            className={inputClass}
            placeholder="Ex.: 30"
          />
        </Field>
        <Field label="Sexo biológico (para cálculo metabólico)">
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value as Sex | '')}
            className={inputClass}
          >
            <option value="">Selecione</option>
            {SEX_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Atividade e objetivo">
        <Field label="Nível de atividade">
          <select
            value={activity}
            onChange={(e) => setActivity(e.target.value as ActivityLevel | '')}
            className={inputClass}
          >
            <option value="">Selecione</option>
            {ACTIVITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} — {o.hint}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Objetivo">
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as Goal | '')}
            className={inputClass}
          >
            <option value="">Selecione</option>
            {GOAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Metas diárias calculadas">
        {previewTargets ? (
          <div className="rounded-xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
            <div className="text-2xl font-semibold">
              {previewTargets.calories.toLocaleString('pt-BR')}{' '}
              <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">kcal/dia</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <Macro label="Proteína" value={previewTargets.protein} />
              <Macro label="Carbos" value={previewTargets.carbs} />
              <Macro label="Gordura" value={previewTargets.fat} />
            </div>
            <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
              TMB {previewTargets.bmr.toLocaleString('pt-BR')} kcal · Gasto total{' '}
              {previewTargets.tdee.toLocaleString('pt-BR')} kcal (Mifflin-St Jeor).
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Preencha todos os campos acima para ver suas metas diárias.
          </div>
        )}
      </Section>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white px-2 py-2 text-center dark:bg-zinc-900">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="text-base font-semibold">
        {value}
        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">g</span>
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900';
