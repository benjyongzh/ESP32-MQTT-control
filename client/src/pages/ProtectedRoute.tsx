import { useEffect, useState, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { USE_MOCK_IRRIGATION_DATA } from '@/constants';

export default function ProtectedRoute(props: { children:ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    if (USE_MOCK_IRRIGATION_DATA) {
      setAuthenticated(true);
      return;
    }
    axios.get(`${import.meta.env.VITE_BACKEND_URL}/auth/check`, { withCredentials: true })
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false));
  }, []);

  if (authenticated === null) return null;
  if (!authenticated) return <Navigate to="/login" replace />;

  return props.children;
}
