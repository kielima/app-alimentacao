import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import NavMenu from './components/NavMenu';
import HeaderActions from './components/HeaderActions';
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
import Refeicoes from './pages/Refeicoes';
import RefeicaoForm from './pages/RefeicaoForm';
import RefeicaoDetalhe from './pages/RefeicaoDetalhe';
import { useTheme } from './hooks/useTheme';
import { usePinAuth } from './hooks/usePinAuth';
import { PlanoProvider, usePlano } from './contexts/PlanoContext';
import { DAYS_OF_WEEK, todayDayOfWeek, type DayOfWeek } from './types/mealPlan';

function PlanoHeaderStrip() {
  const { day, setDay } = usePlano();
  return (
    <div className="flex flex-1 items-center gap-1 mx-2">
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

export default function App() {
  useTheme();
  const { loading, authenticated, hasPin, setPin, verifyPin, signOut } = usePinAuth();
  const location = useLocation();
  const isPlano = location.pathname === '/plano';

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
        <header className="flex items-center px-4 pt-3 gap-2">
          <NavMenu onSignOut={signOut} />
          {isPlano && <PlanoHeaderStrip />}
          <HeaderActions />
        </header>
        <main className="flex-1 overflow-y-auto pb-4">
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
            <Route path="/ingredientes/:id" element={<IngredienteDetalhe />} />
            <Route path="*" element={<Navigate to="/receitas" replace />} />
          </Routes>
        </main>
      </div>
    </PlanoProvider>
  );
}
