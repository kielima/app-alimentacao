import { Navigate, Route, Routes } from 'react-router-dom';
import TabBar from './components/TabBar';
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
import { useTheme } from './hooks/useTheme';
import { usePinAuth } from './hooks/usePinAuth';

export default function App() {
  useTheme();
  const { loading, authenticated, hasPin, setPin, verifyPin, signOut } = usePinAuth();

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
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-end px-4 pt-3">
        <HeaderActions onSignOut={signOut} />
      </header>
      <main className="flex-1 overflow-y-auto pb-20">
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
          <Route path="/ingredientes" element={<Ingredientes />} />
          <Route path="/ingredientes/novo" element={<IngredienteForm />} />
          <Route path="/ingredientes/:id" element={<IngredienteDetalhe />} />
          <Route path="*" element={<Navigate to="/receitas" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  );
}
