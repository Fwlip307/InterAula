export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = 'HttpError';
  }
}
export function requireDatabaseResult<T>(
  result: { data: T; error: any },
  message = 'No fue posible completar la operación. Intenta nuevamente.'
): T {
  if (result.error) {
    const code = String(result.error.code || '');
    const status = code === '42501' ? 403
      : code === '23505' || code === '23P01' || code === '40001' ? 409
      : code === 'PGRST116' || code === 'P0002' ? 404
      : code === '23514' ? 400 : 503;
    // Keep database details in server logs, never in the HTTP response.
    console.error('[Database]', code, result.error.message);
    throw new HttpError(status, message);
  }
  return result.data;
}
