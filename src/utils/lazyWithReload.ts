// Após um novo deploy, os nomes dos chunks mudam. Uma aba antiga que ainda tem o
// index.js velho em cache tenta buscar um chunk que não existe mais e quebra com
// "Failed to fetch dynamically imported module". Nesse caso, recarregamos a página
// uma única vez (flag em sessionStorage) para pegar o build novo.
export function lazyRetry<T>(factory: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      return await factory();
    } catch (err) {
      const KEY = "chunk-reload";
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, "1");
        window.location.reload();
        // Evita que o React renderize o erro antes do reload acontecer.
        return await new Promise<T>(() => {});
      }
      throw err;
    }
  };
}

// Limpa a flag quando o app carrega com sucesso.
export function clearChunkReloadFlag() {
  try {
    sessionStorage.removeItem("chunk-reload");
  } catch {
    /* noop */
  }
}
