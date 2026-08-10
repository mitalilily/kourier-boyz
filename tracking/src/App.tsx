import { BrowserRouter, Route, Routes } from 'react-router-dom'
import TrackOrder from './pages/TrackOrder'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:identifier" element={<TrackOrder />} />
        <Route path="/" element={<TrackOrder />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

