import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/auth/login`, { token }, { withCredentials: true });
      navigate('/control');
    } catch (err) {
      setError('Invalid token');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl mb-4">Enter Shared Token</h1>
      <input
        className="p-2 border rounded mb-2"
        type="password"
        placeholder="Family Token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={handleLogin}>
        Login
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
}