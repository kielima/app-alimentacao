import { Navigate, Route, Routes } from 'react-router-dom';
import TabBar from './components/TabBar';
import ThemeToggle from './components/ThemeToggle';
import PinScreen from './components/PinScreen';
import Receitas from './pages/Receitas';
import Dispensa from './pages/Dispensa';
import Compras from './pages/Compras';
import Plano from './pages/Plano';
import Ingredientes from './pages/Ingredientes';
import IngredienteDetalhe from './pages/IngredienteDetalhe';
import { useTheme } from './hooks/useTheme';
import { usePinAuth } from './hooks/usePinAuth';

export default function App() {
  useTheme();
  const { authenticated, hasPin, setPin, verifyPin } = usePinAuth();

  if (!authenticated) {
    return (
      <PinScreen
        mode={hasPin ? 'verify' : 'create'}
        onSubmit={hasPin ? verifyPin : setPin}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-end px-4 pt-3">
        <ThemeToggle />
      </header>
      <main className="flex-1 overflow-y-auto pb-20">
        <Routes>
          <Route path="/" element={<Navigate to="/receitas" replace />} />
          <Route path="/receitas" element={<Receitas />} />
          <Route path="/dispensa" element={<Dispensa />} />
          <Route path="/compras" element={<Compras />} />
          <Route path="/plano" element={<Plano />} />
          <Route path="/ingredientes" element={<Ingredientes />} />
          <Route path="/ingredientes/:id" element={<IngredienteDetalhe />} />
          <Route path="*" element={<Navigate to="/receitas" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  );
}
