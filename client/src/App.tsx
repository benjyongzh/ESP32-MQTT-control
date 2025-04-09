import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css'
import Login from './pages/Login';
import Control from './pages/Control';

function App() {

  return (

    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/control" element={<Control />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
