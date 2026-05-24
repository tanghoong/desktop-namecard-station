import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage       from './pages/HomePage'
import CapturePage    from './pages/CapturePage'
import CardsPage      from './pages/CardsPage'
import CardDetailPage from './pages/CardDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"             element={<HomePage />} />
        <Route path="/capture"      element={<CapturePage />} />
        <Route path="/cards"        element={<CardsPage />} />
        <Route path="/cards/:cardId" element={<CardDetailPage />} />
      </Routes>
    </BrowserRouter>
  )
}
