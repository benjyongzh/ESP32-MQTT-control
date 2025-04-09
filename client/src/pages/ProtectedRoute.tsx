import { useEffect, useState, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';

export default function ProtectedRoute(props: { children:ReactNode }) {
  const [authenticated, setAuthenticated] = useState<Boolean | null>(null);

  useEffect(() => {
    axios.get('http://localhost:4000/auth/check', { withCredentials: true })
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false));
  }, []);

  if (authenticated === null) return null;
  if (authenticated === false) return <Navigate to="/login" replace />;

  return props.children;
}