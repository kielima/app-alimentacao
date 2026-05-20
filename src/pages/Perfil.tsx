import { useEffect, useRef, useState, type FormEvent } from 'react';
import HeaderSlot from '../components/HeaderSlot';
import { setUserProfile, useUserProfile } from '../data/userProfile';
import { useAuth } from '../hooks/useAuth';
import {
  approveUser,
  rejectUser,
  subscribePendingUsers,
  type UserRecord,
} from '../lib/auth';
import {
  buildExportPayload,
  downloadExport,
  exportSummary,
  type ExportPayload,
} from '../utils/dataExport';
import {
  importData,
  importSummary,
  parseImportFile,
  type ImportResult,
  type ImportStrategy,
} from '../utils/dataImport';
import {
  computeTargets,
  getDefaultFatPct,
  getDefaultProteinPerKg,
  getEffectiveFatPct,
  getEffectiveProteinPerKg,
} from '../utils/profileTargets';
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

function formatNumberInput(value: number | null | undefined): string {
  if (value == null) return '';
  return String(value);
}

function formatPctInput(decimal: number | null | undefined): string {
  if (decimal == null) return '';
  return String(Math.round(decimal * 1000) / 10);
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
  const [proteinPerKgStr, setProteinPerKgStr] = useState(() =>
    formatNumberInput(current.proteinPerKgOverride),
  );
  const [fatPctStr, setFatPctStr] = useState(() => formatPctInput(current.fatPctOverride));
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
    setProteinPerKgStr(formatNumberInput(stored.proteinPerKgOverride));
    setFatPctStr(formatPctInput(stored.fatPctOverride));
  }, [stored]);

  const proteinOverride = parseNumber(proteinPerKgStr);
  const fatPctParsed = parseNumber(fatPctStr);
  const fatPctOverride = fatPctParsed != null ? fatPctParsed / 100 : null;

  const draft: UserProfile = {
    weightKg: parseNumber(weightStr),
    heightCm: parseNumber(heightStr),
    ageYears: parseNumber(ageStr),
    sex: sex || null,
    activity: activity || null,
    goal: goal || null,
    proteinPerKgOverride: proteinOverride,
    fatPctOverride,
  };

  const previewTargets = computeTargets(draft);
  const effectiveProtein = getEffectiveProteinPerKg(draft);
  const effectiveFat = getEffectiveFatPct(draft);

  function validate(): string | null {
    for (const key of ['weightKg', 'heightCm', 'ageYears'] as const) {
      const v = draft[key];
      if (v == null) continue;
      const range = RANGES[key];
      if (v < range.min || v > range.max) {
        return `Valor de ${range.label} fora do intervalo (${range.min}–${range.max}).`;
      }
    }
    if (proteinOverride != null && (proteinOverride <= 0 || proteinOverride > 5)) {
      return 'Proteína por kg fora do intervalo (0–5).';
    }
    if (fatPctParsed != null && (fatPctParsed <= 0 || fatPctParsed >= 100)) {
      return 'Percentual de gordura fora do intervalo (0–100).';
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
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">Dados pessoais</h1>
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

      <section className="mb-6">
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
      </section>

      <section className="mb-6">
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
      </section>

      <Section title="Metas diárias calculadas">
        {previewTargets ? (
          <div className="rounded-xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
            <div className="text-2xl font-semibold">
              {previewTargets.calories.toLocaleString('pt-BR')}{' '}
              <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">kcal/dia</span>
            </div>

            <ul className="mt-3 space-y-2 text-sm">
              <MacroRow
                label="Proteína"
                value={previewTargets.protein}
                formula={
                  <>
                    <FormulaInput
                      value={proteinPerKgStr}
                      onChange={setProteinPerKgStr}
                      placeholder={String(
                        goal ? getDefaultProteinPerKg(goal) : effectiveProtein.value,
                      )}
                      suffix="g/kg"
                      ariaLabel="Proteína por kg de peso corporal"
                    />
                    <span className="text-zinc-500 dark:text-zinc-400">
                      × {draft.weightKg ?? '—'} kg
                    </span>
                    {effectiveProtein.isOverride && goal && (
                      <ResetButton
                        onClick={() => setProteinPerKgStr('')}
                        title={`Restaurar padrão (${getDefaultProteinPerKg(goal)} g/kg)`}
                      />
                    )}
                  </>
                }
              />

              <MacroRow
                label="Gordura"
                value={previewTargets.fat}
                formula={
                  <>
                    <FormulaInput
                      value={fatPctStr}
                      onChange={setFatPctStr}
                      placeholder={String(
                        Math.round(
                          (goal ? getDefaultFatPct(goal) : effectiveFat.value) * 1000,
                        ) / 10,
                      )}
                      suffix="% das kcal"
                      ariaLabel="Percentual de gordura sobre as kcal"
                    />
                    <span className="text-zinc-500 dark:text-zinc-400">÷ 9</span>
                    {effectiveFat.isOverride && goal && (
                      <ResetButton
                        onClick={() => setFatPctStr('')}
                        title={`Restaurar padrão (${
                          Math.round(getDefaultFatPct(goal) * 1000) / 10
                        }%)`}
                      />
                    )}
                  </>
                }
              />

              <MacroRow
                label="Carbos"
                value={previewTargets.carbs}
                formula={
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Restante das kcal ÷ 4
                  </span>
                }
              />
            </ul>

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

      <AdminSection />

      <BackupSection />
    </form>
  );
}

function AdminSection() {
  const { state } = useAuth();
  const [pending, setPending] = useState<UserRecord[] | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = state.phase === 'approved' && state.isAdmin;
  const adminUid = state.phase === 'approved' ? state.user.uid : null;

  useEffect(() => {
    if (!isAdmin) {
      setPending(null);
      return;
    }
    const unsub = subscribePendingUsers((list) => setPending(list));
    return () => unsub();
  }, [isAdmin]);

  if (!isAdmin || !adminUid) return null;

  async function handleApprove(uid: string) {
    if (!adminUid) return;
    setBusyUid(uid);
    setError(null);
    try {
      await approveUser(uid, adminUid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao aprovar.');
    } finally {
      setBusyUid(null);
    }
  }

  async function handleReject(uid: string) {
    if (!adminUid) return;
    if (!confirm('Rejeitar este usuário?')) return;
    setBusyUid(uid);
    setError(null);
    try {
      await rejectUser(uid, adminUid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao rejeitar.');
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <Section title="Aprovações pendentes (admin)">
      <div className="rounded-xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
        {pending === null ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Carregando…</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum usuário aguardando aprovação.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((u) => (
              <li
                key={u.uid}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm dark:bg-zinc-900"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-zinc-800 dark:text-zinc-100">
                    {u.displayName || u.email}
                  </div>
                  {u.displayName && (
                    <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {u.email}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busyUid === u.uid}
                    onClick={() => handleApprove(u.uid)}
                    className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    disabled={busyUid === u.uid}
                    onClick={() => handleReject(u.uid)}
                    className="rounded-full border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-900/20"
                  >
                    Rejeitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
    </Section>
  );
}

function BackupSection() {
  const [lastExport, setLastExport] = useState<{
    at: number;
    summary: Record<string, number>;
  } | null>(null);

  const [pendingImport, setPendingImport] = useState<{
    payload: ExportPayload;
    summary: Record<string, number>;
    filename: string;
  } | null>(null);
  const [strategy, setStrategy] = useState<ImportStrategy>('upsert');
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleExport() {
    const payload = buildExportPayload();
    downloadExport(payload);
    setLastExport({ at: Date.now(), summary: exportSummary(payload) });
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError(null);
    setImportResult(null);
    try {
      const payload = await parseImportFile(file);
      setPendingImport({
        payload,
        summary: importSummary(payload),
        filename: file.name,
      });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Falha ao ler o arquivo.');
      setPendingImport(null);
    }
  }

  function handleConfirmImport() {
    if (!pendingImport) return;
    const result = importData(pendingImport.payload, strategy);
    setImportResult(result);
    setPendingImport(null);
  }

  function handleCancelImport() {
    setPendingImport(null);
    setImportError(null);
  }

  const totalItems = lastExport
    ? Object.values(lastExport.summary).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <Section title="Backup">
      <div className="space-y-4 rounded-xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
        <div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Baixe um arquivo JSON com todos os seus dados (receitas, refeições,
            ingredientes, dispensa, mercados, plano, compras e perfil).
          </p>
          <button
            type="button"
            onClick={handleExport}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            Exportar dados
          </button>
          {lastExport && (
            <div className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              <div className="mb-1 font-medium text-zinc-800 dark:text-zinc-100">
                Exportado: {totalItems} item(ns)
              </div>
              <ul className="space-y-0.5">
                {Object.entries(lastExport.summary)
                  .filter(([, n]) => n > 0)
                  .map(([k, n]) => (
                    <li key={k} className="flex justify-between gap-2">
                      <span className="text-zinc-500 dark:text-zinc-400">{k}</span>
                      <span className="tabular-nums">{n}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 pt-3 dark:border-zinc-700">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Restaure dados a partir de um arquivo de backup exportado anteriormente.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileSelected}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-brand-500 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-400 dark:text-brand-300 dark:hover:bg-brand-900/20"
          >
            Importar dados
          </button>

          {importError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              {importError}
            </div>
          )}

          {pendingImport && (
            <ImportConfirmation
              filename={pendingImport.filename}
              summary={pendingImport.summary}
              exportedAt={pendingImport.payload.exportedAt}
              strategy={strategy}
              onStrategyChange={setStrategy}
              onConfirm={handleConfirmImport}
              onCancel={handleCancelImport}
            />
          )}

          {importResult && <ImportResultPanel result={importResult} />}
        </div>
      </div>
    </Section>
  );
}

const STRATEGY_LABELS: Record<ImportStrategy, { label: string; hint: string }> = {
  upsert: {
    label: 'Mesclar (atualizar existentes)',
    hint: 'Itens com mesmo ID são sobrescritos pelo backup; novos são adicionados; itens só seus permanecem.',
  },
  'skip-existing': {
    label: 'Só adicionar novos',
    hint: 'Não sobrescreve nada que já existe; só importa itens cujo ID não está no app.',
  },
  replace: {
    label: 'Substituir tudo',
    hint: 'Apaga tudo das coleções afetadas e restaura exatamente o conteúdo do backup. Itens não presentes no backup serão perdidos.',
  },
};

function ImportConfirmation({
  filename,
  summary,
  exportedAt,
  strategy,
  onStrategyChange,
  onConfirm,
  onCancel,
}: {
  filename: string;
  summary: Record<string, number>;
  exportedAt: string;
  strategy: ImportStrategy;
  onStrategyChange: (s: ImportStrategy) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const total = Object.values(summary).reduce((a, b) => a + b, 0);
  const exportedDate = new Date(exportedAt);
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-zinc-300 bg-white px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div>
        <div className="text-xs font-medium text-zinc-800 dark:text-zinc-100">
          {filename}
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Exportado em {exportedDate.toLocaleString('pt-BR')} · {total} item(ns)
        </div>
        <ul className="mt-2 space-y-0.5 text-xs text-zinc-600 dark:text-zinc-300">
          {Object.entries(summary)
            .filter(([, n]) => n > 0)
            .map(([k, n]) => (
              <li key={k} className="flex justify-between gap-2">
                <span className="text-zinc-500 dark:text-zinc-400">{k}</span>
                <span className="tabular-nums">{n}</span>
              </li>
            ))}
        </ul>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Estratégia
        </legend>
        {(Object.keys(STRATEGY_LABELS) as ImportStrategy[]).map((s) => (
          <label
            key={s}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
              strategy === s
                ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/20'
                : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50'
            }`}
          >
            <input
              type="radio"
              name="import-strategy"
              value={s}
              checked={strategy === s}
              onChange={() => onStrategyChange(s)}
              className="mt-0.5"
            />
            <span>
              <span className="block font-medium text-zinc-800 dark:text-zinc-100">
                {STRATEGY_LABELS[s].label}
              </span>
              <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                {STRATEGY_LABELS[s].hint}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {strategy === 'replace' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          ⚠️ Esta opção apaga dados não presentes no backup. Recomendado exportar antes.
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          Confirmar import
        </button>
      </div>
    </div>
  );
}

function ImportResultPanel({ result }: { result: ImportResult }) {
  const totalAdded = Object.values(result.added).reduce((a, b) => a + b, 0);
  const totalSkipped = Object.values(result.skipped).reduce((a, b) => a + b, 0);
  const totalRemoved = Object.values(result.removed).reduce((a, b) => a + b, 0);
  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200">
      <div className="font-medium">Import concluído.</div>
      <ul className="mt-1 space-y-0.5">
        <li>{totalAdded} item(ns) adicionado(s)/atualizado(s)</li>
        {totalSkipped > 0 && <li>{totalSkipped} ignorado(s) (já existiam)</li>}
        {totalRemoved > 0 && <li>{totalRemoved} removido(s) (não estavam no backup)</li>}
        {result.profileImported && <li>Perfil pessoal restaurado</li>}
      </ul>
    </div>
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

function MacroRow({
  label,
  value,
  formula,
}: {
  label: string;
  value: number;
  formula: React.ReactNode;
}) {
  return (
    <li className="rounded-lg bg-white px-3 py-2 dark:bg-zinc-900">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="text-base font-semibold">
          {value}
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">g</span>
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1 text-sm">{formula}</div>
    </li>
  );
}

function FormulaInput({
  value,
  onChange,
  placeholder,
  suffix,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suffix: string;
  ariaLabel: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-16 rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-center text-sm focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
      />
      <span className="text-zinc-500 dark:text-zinc-400">{suffix}</span>
    </span>
  );
}

function ResetButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="ml-1 rounded px-1 text-sm text-brand-600 hover:underline dark:text-brand-400"
    >
      ↺ padrão
    </button>
  );
}

const inputClass =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900';
