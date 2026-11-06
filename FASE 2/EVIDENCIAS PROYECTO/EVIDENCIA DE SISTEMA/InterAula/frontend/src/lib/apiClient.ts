/**
 * apiClient.ts
 * Cliente HTTP centralizado para comunicación entre el Frontend de InterAula
 * y su Backend propio Node/Express, inyectando de forma segura el Bearer token
 * obtenido de Supabase Auth.
 */

import { supabase } from './supabase';
import { frontendEnv } from '../config/env';

const API_BASE_URL = frontendEnv.apiUrl;

export class ApiError extends Error {
  public status: number;
  public details?: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  params?: Record<string, any>;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

async function getAuthToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch (err) {
    console.warn('[apiClient] No fue posible obtener la sesión activa de Supabase:', err);
    return null;
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: any,
  options: RequestOptions = {}
): Promise<T> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  let url = `${API_BASE_URL}${cleanPath}`;

  if (options.params) {
    const query = new URLSearchParams();
    for (const [key, val] of Object.entries(options.params)) {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, String(val));
      }
    }
    const queryString = query.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (!options.skipAuth) {
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err: any) {
    throw new ApiError(
      `No se pudo conectar con el servidor backend (${url}). Verifique que el servicio esté ejecutándose en el puerto 3001.`,
      0,
      err
    );
  }

  let json: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      json = await response.json();
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    const errorMessage =
      json?.error ||
      json?.message ||
      (json?.details && JSON.stringify(json.details)) ||
      `Error HTTP ${response.status}: ${response.statusText}`;
    throw new ApiError(errorMessage, response.status, json?.details);
  }

  // Si la respuesta del backend sigue el estándar { success: true, data: ... }, desempaquetar data
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T;
  }

  return (json ?? ({} as any)) as T;
}

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>('GET', path, undefined, options);
  },

  post<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return request<T>('POST', path, body, options);
  },

  put<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return request<T>('PUT', path, body, options);
  },

  patch<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
    return request<T>('PATCH', path, body, options);
  },

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>('DELETE', path, undefined, options);
  },
};
