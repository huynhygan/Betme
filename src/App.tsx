import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Onboarding from './pages/Onboarding';
import BetDetail from './pages/BetDetail';
import NewBet from './pages/NewBet';
import { ProtectedRoute } from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/bet/:id" element={<BetDetail />} />
      <Route
        path="/new"
        element={
          <ProtectedRoute>
            <NewBet />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
