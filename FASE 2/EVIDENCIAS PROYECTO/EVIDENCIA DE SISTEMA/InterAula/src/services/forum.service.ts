import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/apiClient';
import { API_ENDPOINTS } from '../constants/apiEndpoints';

export interface ForumQuestion {
  id: string;
  title: string;
  description: string;
  author: string;
  authorInstitution: string;
  category: string;
  tags: string[];
  repliesCount: number;
  votesCount: number;
  timeAgo: string;
  isSolved: boolean;
  authorId?: string;
  createdAt?: string;
}

export interface ForumReply {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorInstitution: string;
  content: string;
  votesCount: number;
  isAccepted: boolean;
  createdAt: string;
}


function formatTimeAgo(dateString?: string): string {
  if (!dateString) return 'Reciente';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 2) return 'Recién publicado';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays} d`;
}

export const forumService = {
  /**
   * Obtiene la lista de publicaciones del foro a través del backend propio con respaldo seguro.
   */
  async getPosts(): Promise<ForumQuestion[]> {
    try {
      const posts = await apiClient.get<ForumQuestion[]>(API_ENDPOINTS.FORUM.POSTS);
      if (Array.isArray(posts) && posts.length > 0) {
        return posts;
      }
    } catch (apiErr) {
      console.warn('[forumService] Backend API fallback para getPosts:', apiErr);
    }

    try {
      const { data, error } = await supabase
        .from('forum_posts')
        .select(`
          id,
          title,
          description,
          category,
          tags,
          votes_count,
          replies_count,
          is_solved,
          created_at,
          author_id,
          author:profiles(id, display_name, first_name, last_name, institution)
        `)
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        return [];
      }

      return data.map((item: any) => {
        const authorProfile = item.author;
        const authorName = authorProfile
          ? authorProfile.display_name || `${authorProfile.first_name || ''} ${authorProfile.last_name || ''}`.trim() || 'Estudiante'
          : 'Estudiante';
        const institution = authorProfile?.institution || 'Duoc UC';

        return {
          id: item.id,
          title: item.title,
          description: item.description,
          author: authorName,
          authorInstitution: institution,
          category: item.category || 'General',
          tags: Array.isArray(item.tags) ? item.tags : [],
          repliesCount: item.replies_count ?? 0,
          votesCount: item.votes_count ?? 0,
          timeAgo: formatTimeAgo(item.created_at),
          isSolved: Boolean(item.is_solved),
          authorId: item.author_id,
          createdAt: item.created_at,
        };
      });
    } catch {
      return [];
    }
  },

  /**
   * Crea una nueva consulta en el foro persistida a través del backend propio.
   */
  async createPost(params: {
    title: string;
    description: string;
    category: string;
    tags: string[];
  }): Promise<{ success: boolean; post?: ForumQuestion; error?: string }> {
    try {
      const post = await apiClient.post<ForumQuestion>(API_ENDPOINTS.FORUM.POSTS, params);
      return { success: true, post };
    } catch (apiErr: any) {
      console.error('[forumService] Error en createPost:', apiErr);
      return {
        success: false,
        error: apiErr?.message || 'Error al publicar consulta en el foro',
      };
    }
  },

  /**
   * Registra un voto para una pregunta a través del backend propio
   */
  async upvotePost(postId: string, _currentVotes?: number): Promise<boolean> {
    try {
      const res = await apiClient.post<{ success: boolean; votesCount: number }>(API_ENDPOINTS.FORUM.UPVOTE(postId));
      return Boolean(res?.success);
    } catch (apiErr) {
      console.error('[forumService] Error en upvotePost:', apiErr);
      return false;
    }
  },

  /**
   * Marca una pregunta como resuelta por el autor a través del backend propio
   */
  async toggleSolved(postId: string, isSolved: boolean): Promise<boolean> {
    try {
      const res = await apiClient.patch<{ success: boolean; isSolved: boolean }>(API_ENDPOINTS.FORUM.SOLVED(postId), {
        is_solved: !isSolved,
      });
      return Boolean(res?.success);
    } catch (apiErr) {
      console.error('[forumService] Error en toggleSolved:', apiErr);
      return false;
    }
  },
};
