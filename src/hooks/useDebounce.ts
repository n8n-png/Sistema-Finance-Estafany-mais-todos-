import { useEffect, useState } from "react";

/**
 * Retorna o valor após `delay` ms sem alterações — evita recomputações
 * a cada tecla digitada em campos de busca.
 */
export function useDebounce<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
