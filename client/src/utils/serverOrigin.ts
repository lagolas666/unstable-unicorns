/**
 * Адрес socket-сервера.
 * Берём origin из того же env, что и REST (VITE_API_URL без хвоста /api),
 * чтобы клиент не ходил на захардкоженный localhost при деплое.
 */
export function getServerOrigin(): string {
  const apiUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (apiUrl) {
    try {
      const u = new URL(apiUrl, window.location.href);
      return `${u.protocol}//${u.host}`;
    } catch {
      // некорректный env — падаем на дефолт ниже
    }
  }
  return 'http://localhost:3001';
}
