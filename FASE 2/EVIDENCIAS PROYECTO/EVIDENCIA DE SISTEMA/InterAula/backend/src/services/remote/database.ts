import { getAuthenticatedSupabase, supabasePublic } from '../../lib/supabase.js';
import { requireDatabaseResult, HttpError } from '../../lib/httpError.js';
export const clientFor = (token?: string) => token ? getAuthenticatedSupabase(token) : supabasePublic;
export async function result(query: PromiseLike<any>, message?: string): Promise<any> {
  return requireDatabaseResult(await query, message);
}
export async function existing(query: PromiseLike<any>, message: string): Promise<any> {
  const data = await result(query);
  if (!data) throw new HttpError(404, message);
  return data;
}
export async function attachProfiles(rows: any[], idField: string, alias: string, token?: string): Promise<any[]> {
  if (!rows.length) return [];
  const ids = [...new Set(rows.map(row => row[idField]).filter(Boolean))];
  const profiles = ids.length ? await result(clientFor(token).from('public_profiles')
    .select('id,display_name,first_name,last_name,institution,career,avatar_url').in('id', ids)) : [];
  const byId = new Map(profiles.map((profile: any) => [profile.id, profile]));
  return rows.map(row => ({ ...row, [alias]: byId.get(row[idField]) || null }));
}
