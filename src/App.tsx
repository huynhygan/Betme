import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import BetDetail from './pages/BetDetail';
import NewBet from './pages/NewBet';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/bet/:id" element={<BetDetail />} />
      <Route path="/new" element={<NewBet />} />
    </Routes>
  );
}
