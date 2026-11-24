import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { HttpError } from '../lib/httpError.js';
import { getAdminSupabase } from '../lib/supabase.js';
import { attachProfiles, clientFor } from './remote/database.js';
import type { AuthenticatedUser } from '../types/index.js';

export interface DirectMessageDTO {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface DirectConversationParticipantDTO {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  career?: string | null;
  institution?: string | null;
}

export interface DirectConversationDTO {
  id: string;
  context_type: 'general' | 'tutoring' | 'project';
  context_id: string | null;
  context_label: string | null;
  last_message_at: string;
  last_message_preview: string;
  unread_count: number;
  other_participant: DirectConversationParticipantDTO;
  created_at: string;
  updated_at: string;
}

function buildParticipantKey(userA: string, userB: string, contextType = 'general', contextId?: string | null): string {
  const [first, second] = [userA, userB].sort();
  return contextId ? `${first}:${second}:${contextType}:${contextId}` : `${first}:${second}:${contextType}`;
}

function isPermissionError(error: any): boolean {
  return String(error?.code || '') === '42501';
}

function isMissingRpcError(error: any): boolean {
  const code = String(error?.code || '');
  return code === 'PGRST202' || code === '42883';
}

function canUseAdminFallback(): boolean {
  return Boolean(env.supabaseServiceRoleKey);
}

function mapSchemaError(error: any, fallback: string): never {
  const code = String(error?.code || '');
  if (code) {
    console.warn(`[messagingService] Error Supabase (${code}): ${String(error?.message || fallback).slice(0, 180)}`);
  }
  if (['PGRST205', 'PGRST202', '42P01'].includes(code)) {
    throw new HttpError(
      503,
      'La mensajería directa aún no está activada en la base de datos. Aplica la migración 031 y 032 para habilitarla.',
      'MESSAGING_NOT_READY'
    );
  }
  if (code === '42501') {
    throw new HttpError(403, 'No tienes permisos para acceder a esta conversación.');
  }
  throw new HttpError(500, fallback);
}

async function runWithPermissionFallback<T extends { error?: any }>(
  token: string,
  operation: (db: SupabaseClient) => PromiseLike<T>
): Promise<T> {
  const primary = await operation(clientFor(token));
  if (primary.error && isPermissionError(primary.error) && canUseAdminFallback()) {
    return await operation(getAdminSupabase());
  }
  return primary;
}

// Almacén en memoria aislado estrictamente para pruebas automatizadas (NODE_ENV=test)
interface LocalStoreState {
  conversations: Map<
    string,
    {
      id: string;
      participant_key: string;
      context_type: 'general' | 'tutoring' | 'project';
      context_id: string | null;
      context_label: string | null;
      last_message_at: string;
      last_message_preview: string;
      created_at: string;
      updated_at: string;
      participants: string[];
    }
  >;
  messages: Map<string, DirectMessageDTO[]>;
  profiles: Map<string, DirectConversationParticipantDTO>;
}

const localState: LocalStoreState = {
  conversations: new Map(),
  messages: new Map(),
  profiles: new Map(),
};

export function __resetLocalMessagingForTests() {
  localState.conversations.clear();
  localState.messages.clear();
  localState.profiles.clear();
}

export function __seedLocalMessagingProfileForTests(profile: DirectConversationParticipantDTO) {
  localState.profiles.set(profile.id, profile);
}

function profileLabel(profile: any): DirectConversationParticipantDTO {
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
  return {
    id: profile?.id || '',
    display_name: profile?.display_name || fullName || 'Estudiante de InterAula',
    avatar_url: profile?.avatar_url || null,
    career: profile?.career || null,
    institution: profile?.institution || null,
  };
}

export const messagingService = {
  async listConversations(user: AuthenticatedUser, token: string): Promise<DirectConversationDTO[]> {
    if (env.persistenceMode === 'local') {
      const items: DirectConversationDTO[] = [];
      for (const conv of localState.conversations.values()) {
        if (!conv.participants.includes(user.id)) continue;
        const otherId = conv.participants.find((p) => p !== user.id) || user.id;
        const msgs = localState.messages.get(conv.id) || [];
        const unread = msgs.filter((m) => m.sender_id !== user.id && !m.read_at).length;
        items.push({
          id: conv.id,
          context_type: conv.context_type,
          context_id: conv.context_id,
          context_label: conv.context_label,
          last_message_at: conv.last_message_at,
          last_message_preview: conv.last_message_preview,
          unread_count: unread,
          other_participant:
            localState.profiles.get(otherId) || { id: otherId, display_name: 'Estudiante de InterAula' },
          created_at: conv.created_at,
          updated_at: conv.updated_at,
        });
      }
      return items.sort((a, b) => Date.parse(b.last_message_at) - Date.parse(a.last_message_at));
    }

    const myRes = await runWithPermissionFallback(token, async (db) =>
      db
        .from('direct_conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id)
    );

    if (myRes.error) mapSchemaError(myRes.error, 'No pudimos cargar tus conversaciones.');
    const ids = (myRes.data || []).map((row: any) => row.conversation_id);
    if (!ids.length) return [];

    const [convRes, partRes, unreadRes] = await Promise.all([
      runWithPermissionFallback(token, async (db) =>
        db
          .from('direct_conversations')
          .select('*')
          .in('id', ids)
          .order('last_message_at', { ascending: false })
      ),
      runWithPermissionFallback(token, async (db) =>
        db
          .from('direct_conversation_participants')
          .select('conversation_id, user_id')
          .in('conversation_id', ids)
      ),
      runWithPermissionFallback(token, async (db) =>
        db
          .from('direct_messages')
          .select('id, conversation_id, sender_id, read_at')
          .in('conversation_id', ids)
          .neq('sender_id', user.id)
          .is('read_at', null)
      ),
    ]);

    if (convRes.error) mapSchemaError(convRes.error, 'No pudimos cargar tus conversaciones.');
    if (partRes.error) mapSchemaError(partRes.error, 'No pudimos cargar los participantes.');
    if (unreadRes.error) mapSchemaError(unreadRes.error, 'No pudimos consultar mensajes no leídos.');

    const otherMap = new Map<string, string>();
    for (const row of partRes.data || []) {
      if (row.user_id !== user.id) otherMap.set(row.conversation_id, row.user_id);
    }

    const unreadCountMap = new Map<string, number>();
    for (const msg of unreadRes.data || []) {
      unreadCountMap.set(msg.conversation_id, (unreadCountMap.get(msg.conversation_id) || 0) + 1);
    }

    const rowsWithOther = (convRes.data || []).map((c: any) => ({
      ...c,
      other_user_id: otherMap.get(c.id) || user.id,
    }));
    const decorated = await attachProfiles(rowsWithOther, 'other_user_id', 'other_profile', token);

    return decorated.map((c: any) => ({
      id: c.id,
      context_type: c.context_type || 'general',
      context_id: c.context_id || null,
      context_label: c.context_label || null,
      last_message_at: c.last_message_at,
      last_message_preview: c.last_message_preview || '',
      unread_count: unreadCountMap.get(c.id) || 0,
      other_participant: profileLabel({ id: c.other_user_id, ...c.other_profile }),
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));
  },

  async createOrOpenConversation(
    user: AuthenticatedUser,
    token: string,
    dto: {
      recipient_id: string;
      context_type?: 'general' | 'tutoring' | 'project';
      context_id?: string | null;
      context_label?: string | null;
      initial_message?: string;
    }
  ): Promise<DirectConversationDTO> {
    if (dto.recipient_id === user.id) {
      throw new HttpError(400, 'No puedes iniciar una conversación contigo mismo.');
    }

    const contextType = dto.context_type || 'general';
    const contextId = dto.context_id || null;
    const key = buildParticipantKey(user.id, dto.recipient_id, contextType, contextId);

    if (env.persistenceMode === 'local') {
      let existing = [...localState.conversations.values()].find((c) => c.participant_key === key);
      if (!existing) {
        const now = new Date().toISOString();
        existing = {
          id: crypto.randomUUID(),
          participant_key: key,
          context_type: contextType,
          context_id: contextId,
          context_label: dto.context_label || null,
          last_message_at: now,
          last_message_preview: '',
          created_at: now,
          updated_at: now,
          participants: [user.id, dto.recipient_id],
        };
        localState.conversations.set(existing.id, existing);
        localState.messages.set(existing.id, []);
      }
      if (dto.initial_message) {
        await this.sendMessage(user, token, existing.id, dto.initial_message);
      }
      const list = await this.listConversations(user, token);
      return list.find((c) => c.id === existing!.id)!;
    }

    const client = clientFor(token);
    let { data: targetProfile, error: profileErr } = await client
      .from('public_profiles')
      .select('id, display_name, first_name, last_name, avatar_url, career, institution')
      .eq('id', dto.recipient_id)
      .maybeSingle();

    if ((!targetProfile || profileErr) && canUseAdminFallback()) {
      const fallbackProfile = await getAdminSupabase()
        .from('profiles')
        .select('id, display_name, first_name, last_name, avatar_url, career, institution')
        .eq('id', dto.recipient_id)
        .maybeSingle();
      if (!fallbackProfile.error && fallbackProfile.data) {
        targetProfile = fallbackProfile.data;
        profileErr = null;
      }
    }

    if (profileErr && !['PGRST205', '42P01'].includes(String(profileErr.code))) {
      throw new HttpError(500, 'No pudimos verificar el perfil del destinatario.');
    }
    if (!targetProfile) {
      throw new HttpError(404, 'No encontramos a la persona seleccionada en la comunidad.');
    }

    let conversationId: string | undefined;

    // 1. Ruta principal: RPC atómica con SECURITY DEFINER que valida auth.uid() y agrega a ambos participantes
    const { data: rpcId, error: rpcErr } = await client.rpc('create_or_open_direct_conversation', {
      p_recipient_id: dto.recipient_id,
      p_context_type: contextType,
      p_context_id: contextId,
      p_context_label: dto.context_label || null,
    });

    if (!rpcErr && typeof rpcId === 'string' && rpcId) {
      conversationId = rpcId;
    } else if (rpcErr?.code === 'P0002') {
      throw new HttpError(404, 'No encontramos a la persona seleccionada en la comunidad.');
    } else if (rpcErr?.code === '22023') {
      throw new HttpError(400, 'Los datos de la conversación no son válidos.');
    } else if (rpcErr && (isMissingRpcError(rpcErr) || isPermissionError(rpcErr)) && canUseAdminFallback()) {
      // 2. Respaldo seguro en servidor (cuando 032 aún no se aplicó): valida user.id del JWT y crea atómicamente con service_role
      const admin = getAdminSupabase();
      const { data: existingConv, error: findErr } = await admin
        .from('direct_conversations')
        .select('id')
        .eq('participant_key', key)
        .maybeSingle();

      if (findErr) mapSchemaError(findErr, 'No pudimos buscar la conversación.');
      conversationId = existingConv?.id;

      if (!conversationId) {
        const { data: created, error: createErr } = await admin
          .from('direct_conversations')
          .insert({
            participant_key: key,
            context_type: contextType,
            context_id: contextId,
            context_label: dto.context_label || null,
          })
          .select('id')
          .single();

        if (createErr) {
          if (createErr.code === '23505') {
            const { data: retryFound } = await admin
              .from('direct_conversations')
              .select('id')
              .eq('participant_key', key)
              .maybeSingle();
            conversationId = retryFound?.id;
          } else {
            mapSchemaError(createErr, 'No pudimos iniciar la conversación.');
          }
        } else {
          conversationId = created.id;
        }
      }

      if (!conversationId) {
        throw new HttpError(500, 'No pudimos confirmar el identificador de la conversación.');
      }

      const { error: partErr } = await admin.from('direct_conversation_participants').upsert(
        [
          { conversation_id: conversationId, user_id: user.id },
          { conversation_id: conversationId, user_id: dto.recipient_id },
        ],
        { onConflict: 'conversation_id,user_id', ignoreDuplicates: true }
      );
      if (partErr) {
        mapSchemaError(partErr, 'No pudimos registrar a los participantes de la conversación.');
      }
    } else if (rpcErr) {
      mapSchemaError(rpcErr, 'No pudimos iniciar la conversación.');
    }

    if (!conversationId) {
      throw new HttpError(500, 'No pudimos confirmar el identificador de la conversación.');
    }

    if (dto.initial_message) {
      await this.sendMessage(user, token, conversationId, dto.initial_message);
    }

    const all = await this.listConversations(user, token);
    const resolved = all.find((c) => c.id === conversationId);
    if (resolved) return resolved;

    const now = new Date().toISOString();
    return {
      id: conversationId,
      context_type: contextType,
      context_id: contextId,
      context_label: dto.context_label || null,
      last_message_at: now,
      last_message_preview: dto.initial_message?.slice(0, 160) || '',
      unread_count: 0,
      other_participant: profileLabel(targetProfile),
      created_at: now,
      updated_at: now,
    };
  },

  async getMessages(user: AuthenticatedUser, token: string, conversationId: string): Promise<DirectMessageDTO[]> {
    if (env.persistenceMode === 'local') {
      const conv = localState.conversations.get(conversationId);
      if (!conv) throw new HttpError(404, 'Conversación no encontrada.');
      if (!conv.participants.includes(user.id)) {
        throw new HttpError(403, 'No tienes acceso a esta conversación privada.');
      }
      return [...(localState.messages.get(conversationId) || [])];
    }

    const partRes = await runWithPermissionFallback(token, async (db) =>
      db
        .from('direct_conversation_participants')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle()
    );

    if (partRes.error) mapSchemaError(partRes.error, 'No pudimos validar tu acceso a la conversación.');
    if (!partRes.data) throw new HttpError(403, 'No tienes acceso a esta conversación privada.');

    const msgRes = await runWithPermissionFallback(token, async (db) =>
      db
        .from('direct_messages')
        .select('id, conversation_id, sender_id, body, read_at, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(200)
    );

    if (msgRes.error) mapSchemaError(msgRes.error, 'No pudimos cargar el historial de mensajes.');
    return (msgRes.data || []) as DirectMessageDTO[];
  },

  async sendMessage(
    user: AuthenticatedUser,
    token: string,
    conversationId: string,
    body: string
  ): Promise<DirectMessageDTO> {
    const trimmed = body.trim();
    if (!trimmed) throw new HttpError(400, 'Escribe un mensaje antes de enviar.');

    if (env.persistenceMode === 'local') {
      const conv = localState.conversations.get(conversationId);
      if (!conv) throw new HttpError(404, 'Conversación no encontrada.');
      if (!conv.participants.includes(user.id)) {
        throw new HttpError(403, 'No puedes enviar mensajes en una conversación ajena.');
      }
      const msg: DirectMessageDTO = {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        sender_id: user.id,
        body: trimmed,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      const list = localState.messages.get(conversationId) || [];
      list.push(msg);
      localState.messages.set(conversationId, list);
      conv.last_message_at = msg.created_at;
      conv.last_message_preview = trimmed.slice(0, 160);
      conv.updated_at = msg.created_at;
      return msg;
    }

    const partRes = await runWithPermissionFallback(token, async (db) =>
      db
        .from('direct_conversation_participants')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle()
    );

    if (partRes.error) mapSchemaError(partRes.error, 'No pudimos validar tu participación en la conversación.');
    if (!partRes.data) throw new HttpError(403, 'No puedes enviar mensajes en esta conversación.');

    const insertRes = await runWithPermissionFallback(token, async (db) =>
      db
        .from('direct_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          body: trimmed,
        })
        .select('id, conversation_id, sender_id, body, read_at, created_at')
        .single()
    );

    if (insertRes.error) mapSchemaError(insertRes.error, 'No pudimos enviar el mensaje. Reintenta.');
    return insertRes.data as DirectMessageDTO;
  },

  async markAsRead(user: AuthenticatedUser, token: string, conversationId: string): Promise<{ updated: number }> {
    const now = new Date().toISOString();
    if (env.persistenceMode === 'local') {
      const conv = localState.conversations.get(conversationId);
      if (!conv) throw new HttpError(404, 'Conversación no encontrada.');
      if (!conv.participants.includes(user.id)) {
        throw new HttpError(403, 'No tienes acceso a esta conversación privada.');
      }
      let updated = 0;
      for (const msg of localState.messages.get(conversationId) || []) {
        if (msg.sender_id !== user.id && !msg.read_at) {
          msg.read_at = now;
          updated++;
        }
      }
      return { updated };
    }

    const partRes = await runWithPermissionFallback(token, async (db) =>
      db
        .from('direct_conversation_participants')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle()
    );

    if (partRes.error) mapSchemaError(partRes.error, 'No pudimos validar tu participación.');
    if (!partRes.data) throw new HttpError(403, 'No tienes acceso a esta conversación.');

    const msgRes = await runWithPermissionFallback(token, async (db) =>
      db
        .from('direct_messages')
        .update({ read_at: now })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .is('read_at', null)
        .select('id')
    );

    if (msgRes.error) mapSchemaError(msgRes.error, 'No pudimos actualizar el estado de lectura.');

    await runWithPermissionFallback(token, async (db) =>
      db
        .from('direct_conversation_participants')
        .update({ last_read_at: now })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
    );

    return { updated: (msgRes.data || []).length };
  },

  async getUnreadCount(user: AuthenticatedUser, token: string): Promise<{ unreadCount: number }> {
    const conversations = await this.listConversations(user, token);
    const unreadCount = conversations.reduce((sum, conv) => sum + conv.unread_count, 0);
    return { unreadCount };
  },

  async searchContacts(
    user: AuthenticatedUser,
    token: string,
    query?: string
  ): Promise<DirectConversationParticipantDTO[]> {
    const q = (query || '').trim().toLowerCase();
    if (env.persistenceMode === 'local') {
      return [...localState.profiles.values()]
        .filter((p) => p.id !== user.id)
        .filter((p) => !q || p.display_name.toLowerCase().includes(q) || (p.career || '').toLowerCase().includes(q))
        .slice(0, 30);
    }

    const client = clientFor(token);
    const { data, error } = await client
      .from('public_profiles')
      .select('id, display_name, first_name, last_name, avatar_url, career, institution')
      .neq('id', user.id)
      .limit(60);

    if (error) return [];
    const mapped = (data || []).map(profileLabel);
    if (!q) return mapped.slice(0, 25);
    return mapped
      .filter(
        (p) =>
          p.display_name.toLowerCase().includes(q) ||
          (p.career || '').toLowerCase().includes(q) ||
          (p.institution || '').toLowerCase().includes(q)
      )
      .slice(0, 25);
  },
};
