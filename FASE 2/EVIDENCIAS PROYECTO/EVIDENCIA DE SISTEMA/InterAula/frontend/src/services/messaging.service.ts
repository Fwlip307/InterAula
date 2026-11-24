import { apiClient } from '../lib/apiClient';
import { supabase } from '../lib/supabase';
import { API_ENDPOINTS } from '../constants/apiEndpoints';

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface DirectParticipant {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  career?: string | null;
  institution?: string | null;
}

export interface DirectConversation {
  id: string;
  context_type: 'general' | 'tutoring' | 'project';
  context_id: string | null;
  context_label: string | null;
  last_message_at: string;
  last_message_preview: string;
  unread_count: number;
  other_participant: DirectParticipant;
  created_at: string;
  updated_at: string;
}

export const messagingService = {
  listConversations(): Promise<DirectConversation[]> {
    return apiClient.get<DirectConversation[]>(API_ENDPOINTS.MESSAGES.CONVERSATIONS);
  },

  createOrOpenConversation(payload: {
    recipient_id: string;
    context_type?: 'general' | 'tutoring' | 'project';
    context_id?: string | null;
    context_label?: string | null;
    initial_message?: string;
  }): Promise<DirectConversation> {
    return apiClient.post<DirectConversation>(API_ENDPOINTS.MESSAGES.CONVERSATIONS, payload);
  },

  getMessages(conversationId: string): Promise<DirectMessage[]> {
    return apiClient.get<DirectMessage[]>(API_ENDPOINTS.MESSAGES.CONVERSATION_MESSAGES(conversationId));
  },

  sendMessage(conversationId: string, body: string): Promise<DirectMessage> {
    return apiClient.post<DirectMessage>(API_ENDPOINTS.MESSAGES.CONVERSATION_MESSAGES(conversationId), { body });
  },

  markAsRead(conversationId: string): Promise<{ updated: number }> {
    return apiClient.post<{ updated: number }>(API_ENDPOINTS.MESSAGES.MARK_READ(conversationId));
  },

  getUnreadCount(): Promise<{ unreadCount: number }> {
    return apiClient.get<{ unreadCount: number }>(API_ENDPOINTS.MESSAGES.UNREAD_COUNT);
  },

  searchContacts(query?: string): Promise<DirectParticipant[]> {
    const suffix = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    return apiClient.get<DirectParticipant[]>(`${API_ENDPOINTS.MESSAGES.CONTACTS}${suffix}`);
  },

  subscribeToConversation(
    conversationId: string,
    onInsert: (msg: DirectMessage) => void,
    onUpdate?: (msg: DirectMessage) => void,
    onStatus?: (status: string) => void
  ): () => void {
    const channel = supabase
      .channel(`ia_direct_chat_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.new) onInsert(payload.new as DirectMessage);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.new && onUpdate) onUpdate(payload.new as DirectMessage);
        }
      )
      .subscribe((status) => {
        if (onStatus) onStatus(status);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  },
};
