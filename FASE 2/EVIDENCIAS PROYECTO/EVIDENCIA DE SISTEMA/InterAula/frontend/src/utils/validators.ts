/**
 * Valida si un string corresponde a una URL sintácticamente válida con protocolo http o https.
 * Si el string está vacío o contiene solo espacios en blanco, retorna true para campos opcionales.
 */
export function isValidUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
