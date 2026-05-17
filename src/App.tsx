import { useEffect, useLayoutEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import NavMenu from './components/NavMenu';
import BackButton from './components/BackButton';
import { HEADER_SLOT_ID } from './components/HeaderSlot';
import PinScreen from './components/PinScreen';
import LoadingSplash from './components/LoadingSplash';
import Receitas from './pages/Receitas';
import Dispensa from './pages/Dispensa';
import Compras from './pages/Compras';
import Plano from './pages/Plano';
import ReceitaDetalhe from './pages/ReceitaDetalhe';
import ReceitaForm from './pages/ReceitaForm';
import DispensaForm from './pages/DispensaForm';
import ComprasItemForm from './pages/ComprasItemForm';
import Ingredientes from './pages/Ingredientes';
import IngredienteDetalhe from './pages/IngredienteDetalhe';
import IngredienteForm from './pages/IngredienteForm';
import OffContribuicoes from './pages/OffContribuicoes';
import Refeicoes from './pages/Refeicoes';
import RefeicaoForm from './pages/RefeicaoForm';
import RefeicaoDetalhe from './pages/RefeicaoDetalhe';
import Mercados from './pages/Mercados';
import MercadoForm from './pages/MercadoForm';
import Perfil from './pages/Perfil';
import { useTheme } from './hooks/useTheme';
import { usePinAuth } from './hooks/usePinAuth';
import { PlanoProvider, usePlano } from './contexts/PlanoContext';
import { DAYS_OF_WEEK, todayDayOfWeek, type DayOfWeek } from './types/mealPlan';

function PlanoHeaderStrip() {
  const { day, setDay } = usePlano();
  return (
    <div className="flex flex-1 items-center gap-1">
      <button
        type="button"
        onClick={() => setDay((d) => ((d + 6) % 7) as DayOfWeek)}
        className="rounded-full bg-zinc-200/60 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200"
        aria-label="Dia anterior"
      >
        ◀
      </button>
      <select
        value={day}
        onChange={(e) => setDay(Number(e.target.value) as DayOfWeek)}
        className="flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900"
      >
        {DAYS_OF_WEEK.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
            {d.value === todayDayOfWeek() ? ' (hoje)' : ''}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setDay((d) => ((d + 1) % 7) as DayOfWeek)}
        className="rounded-full bg-zinc-200/60 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200"
        aria-label="Próximo dia"
      >
        ▶
      </button>
    </div>
  );
}

function PlanTypeToggleButton() {
  const { planType, setPlanType } = usePlano();
  const isTraining = planType === 'training_day';
  return (
    <button
      type="button"
      onClick={() => setPlanType(isTraining ? 'rest_day' : 'training_day')}
      className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-zinc-200/60 px-3 text-sm text-zinc-700 hover:bg-zinc-300/60 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-700/60"
      aria-label={`${isTraining ? 'Dia de Treino' : 'Dia de Descanso'}. Clique para alternar.`}
      title={isTraining ? 'Dia de Treino' : 'Dia de Descanso'}
    >
      <span aria-hidden>{isTraining ? '🏋️' : '😴'}</span>
    </button>
  );
}

const SCROLL_KEY_PREFIX = 'scroll:';

function useScrollRestoration(scrollEl: HTMLElement | null) {
  const location = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (!scrollEl) return;
    if (navigationType === 'POP') {
      const saved = sessionStorage.getItem(`${SCROLL_KEY_PREFIX}${location.key}`);
      if (saved != null) {
        scrollEl.scrollTop = Number(saved);
        return;
      }
    }
    scrollEl.scrollTop = 0;
  }, [scrollEl, location.key, navigationType]);

  useEffect(() => {
    if (!scrollEl) return;
    const key = `${SCROLL_KEY_PREFIX}${location.key}`;
    const handler = () => {
      sessionStorage.setItem(key, String(scrollEl.scrollTop));
    };
    scrollEl.addEventListener('scroll', handler, { passive: true });
    return () => {
      scrollEl.removeEventListener('scroll', handler);
    };
  }, [scrollEl, location.key]);
}

const BACK_ROUTE_PATTERN = /^\/(ingredientes|receitas|refeicoes)\/[^/]+/;

export default function App() {
  useTheme();
  const { loading, authenticated, hasPin, setPin, verifyPin, signOut } = usePinAuth();
  const location = useLocation();
  const isPlano = location.pathname === '/plano';
  const showBack = BACK_ROUTE_PATTERN.test(location.pathname);
  const [mainEl, setMainEl] = useState<HTMLElement | null>(null);
  useScrollRestoration(mainEl);

  if (loading) {
    return <LoadingSplash />;
  }

  if (!authenticated) {
    return (
      <PinScreen
        mode={hasPin ? 'verify' : 'create'}
        onSubmit={hasPin ? verifyPin : setPin}
      />
    );
  }

  return (
    <PlanoProvider>
      <div className="flex h-full flex-col">
        <header className="mx-auto flex w-full max-w-md items-center px-4 pt-1.5 pb-1.5 gap-2">
          {showBack ? <BackButton /> : <NavMenu onSignOut={signOut} />}
          {isPlano ? (
            <>
              <PlanoHeaderStrip />
              <PlanTypeToggleButton />
            </>
          ) : (
            <div id={HEADER_SLOT_ID} className="flex min-w-0 flex-1 items-center gap-2" />
          )}
        </header>
        <main ref={setMainEl} className="flex-1 overflow-y-auto pb-4">
          <Routes>
            <Route path="/" element={<Navigate to="/receitas" replace />} />
            <Route path="/receitas" element={<Receitas />} />
            <Route path="/receitas/nova" element={<ReceitaForm />} />
            <Route path="/receitas/:id/editar" element={<ReceitaForm />} />
            <Route path="/receitas/:id" element={<ReceitaDetalhe />} />
            <Route path="/dispensa" element={<Dispensa />} />
            <Route path="/dispensa/novo" element={<DispensaForm />} />
            <Route path="/dispensa/:id/editar" element={<DispensaForm />} />
            <Route path="/compras" element={<Compras />} />
            <Route path="/compras/:id" element={<ComprasItemForm />} />
            <Route path="/plano" element={<Plano />} />
            <Route path="/refeicoes" element={<Refeicoes />} />
            <Route path="/refeicoes/nova" element={<RefeicaoForm />} />
            <Route path="/refeicoes/:id/editar" element={<RefeicaoForm />} />
            <Route path="/refeicoes/:id" element={<RefeicaoDetalhe />} />
            <Route path="/ingredientes" element={<Ingredientes />} />
            <Route path="/ingredientes/novo" element={<IngredienteForm />} />
            <Route path="/ingredientes/:id/editar" element={<IngredienteForm />} />
            <Route path="/ingredientes/:id" element={<IngredienteDetalhe />} />
            <Route path="/contribuicoes-off" element={<OffContribuicoes />} />
            <Route path="/mercados" element={<Mercados />} />
            <Route path="/mercados/novo" element={<MercadoForm />} />
            <Route path="/mercados/:id/editar" element={<MercadoForm />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="*" element={<Navigate to="/receitas" replace />} />
          </Routes>
        </main>
      </div>
    </PlanoProvider>
  );
}
