import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';

export function useApi(load) {
  const { logout } = useAuth();
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false; 

    load()
      .then((data) => {
        if (!cancelled) setState({ data, error: '', loading: false });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) {
          logout();
          return;
        }
        setState({ data: null, error: err.message, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [load, logout, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { ...state, reload };
}