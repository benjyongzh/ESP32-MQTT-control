import { useEffect, useState, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';

export default function ProtectedRoute(props: { children:ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_BACKEND_URL}/auth/check`, { withCredentials: true })
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false));
  }, []);

  if (authenticated === null) return null;
  if (authenticated === false) return <Navigate to="/login" replace />;

  return props.children;
}