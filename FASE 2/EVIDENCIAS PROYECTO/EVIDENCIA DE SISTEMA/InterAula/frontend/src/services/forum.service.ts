import { apiClient } from '../lib/apiClient';
import { API_ENDPOINTS } from '../constants/apiEndpoints';

export type ForumPostType = 'pregunta' | 'discusion' | 'duda' | 'recurso';

export interface ForumQuestion {
  id: string;
  title: string;
  description: string;
  author: string;
  authorInstitution: string;
  category: string;
  postType?: ForumPostType;
  subjectId?: string | null;
  tags: string[];
  repliesCount: number;
  votesCount: number;
  timeAgo: string;
  isSolved: boolean;
  acceptedReplyId?: string | null;
  authorId?: string;
  createdAt?: string;
  updatedAt?: string;
  hasVoted?: boolean;
  replies?: ForumReply[];
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
  updatedAt?: string;
  timeAgo?: string;
}

export interface ForumFilterParams {
  category?: string;
  search?: string;
  post_type?: string;
  status?: 'all' | 'open' | 'solved';
  subject_id?: string;
  sort?: 'recent' | 'popular' | 'activity';
}

export const forumService = {
  /**
   * Obtiene la lista de publicaciones del foro a través del backend propio.
   */
  async getPosts(filters?: ForumFilterParams): Promise<ForumQuestion[]> {
    return apiClient.get(API_ENDPOINTS.FORUM.POSTS, {params: filters});
  },

  async getPostById(id: string): Promise<ForumQuestion | null> {
    return apiClient.get(API_ENDPOINTS.FORUM.POST_BY_ID(id));
  },

  /**
   * Crea una nueva consulta en el foro persistida a través del backend propio.
   */
  async createPost(params: {
    title: string;
    description: string;
    category: string;
    post_type?: ForumPostType;
    subject_id?: string | null;
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
   * Edita una publicación propia a través del backend.
   */
  async updatePost(
    postId: string,
    params: {
      title?: string;
      description?: string;
      category?: string;
      post_type?: ForumPostType;
      subject_id?: string | null;
      tags?: string[];
    }
  ): Promise<{ success: boolean; post?: ForumQuestion; error?: string }> {
    try {
      const post = await apiClient.put<ForumQuestion>(API_ENDPOINTS.FORUM.POST_BY_ID(postId), params);
      return { success: true, post };
    } catch (apiErr: any) {
      console.error('[forumService] Error en updatePost:', apiErr);
      return {
        success: false,
        error: apiErr?.message || 'Error al actualizar la publicación',
      };
    }
  },

  /**
   * Elimina una publicación propia a través del backend.
   */
  async deletePost(postId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.delete(API_ENDPOINTS.FORUM.POST_BY_ID(postId));
      return { success: true };
    } catch (apiErr: any) {
      console.error('[forumService] Error en deletePost:', apiErr);
      return {
        success: false,
        error: apiErr?.message || 'Error al eliminar la publicación',
      };
    }
  },

  /**
   * Registra o alterna un voto para una pregunta a través del backend propio.
   */
  async upvotePost(postId: string, _currentVotes?: number): Promise<{
    success: boolean;
    votesCount?: number;
    hasVoted?: boolean;
  }> {
    try {
      const res = await apiClient.post<{
        success: boolean;
        votesCount: number;
        hasVoted?: boolean;
      }>(API_ENDPOINTS.FORUM.UPVOTE(postId));
      return {
        success: Boolean(res?.success),
        votesCount: res?.votesCount,
        hasVoted: res?.hasVoted,
      };
    } catch (apiErr) {
      console.error('[forumService] Error en upvotePost:', apiErr);
      return { success: false };
    }
  },

  /**
   * Marca una pregunta como resuelta o abierta por el autor a través del backend propio.
   */
  async toggleSolved(postId: string, isSolved: boolean): Promise<boolean> {
    try {
      const res = await apiClient.patch<{ success: boolean; isSolved: boolean }>(
        API_ENDPOINTS.FORUM.SOLVED(postId),
        { is_solved: !isSolved }
      );
      return Boolean(res?.success);
    } catch (apiErr) {
      console.error('[forumService] Error en toggleSolved:', apiErr);
      return false;
    }
  },

  /**
   * Obtiene respuestas de una publicación.
   */
  async getReplies(id: string): Promise<ForumReply[]> {
    return apiClient.get(API_ENDPOINTS.FORUM.REPLIES(id));
  },

  /**
   * Publica una respuesta en una publicación.
   */
  async createReply(postId: string, content: string): Promise<{
    success: boolean;
    reply?: ForumReply;
    error?: string;
  }> {
    try {
      const reply = await apiClient.post<ForumReply>(API_ENDPOINTS.FORUM.REPLIES(postId), { content });
      return { success: true, reply };
    } catch (apiErr: any) {
      return {
        success: false,
        error: apiErr?.message || 'Error al publicar respuesta',
      };
    }
  },

  /**
   * Edita una respuesta propia.
   */
  async updateReply(replyId: string, content: string): Promise<{
    success: boolean;
    reply?: ForumReply;
    error?: string;
  }> {
    try {
      const reply = await apiClient.put<ForumReply>(API_ENDPOINTS.FORUM.REPLY_BY_ID(replyId), { content });
      return { success: true, reply };
    } catch (apiErr: any) {
      return {
        success: false,
        error: apiErr?.message || 'Error al actualizar respuesta',
      };
    }
  },

  /**
   * Elimina una respuesta propia.
   */
  async deleteReply(replyId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.delete(API_ENDPOINTS.FORUM.REPLY_BY_ID(replyId));
      return { success: true };
    } catch (apiErr: any) {
      return {
        success: false,
        error: apiErr?.message || 'Error al eliminar respuesta',
      };
    }
  },

  /**
   * Marca una respuesta como solución aceptada (solo autor de la consulta).
   */
  async markReplyAsSolution(postId: string, replyId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await apiClient.patch(API_ENDPOINTS.FORUM.ACCEPT_REPLY(postId, replyId));
      return { success: true };
    } catch (apiErr: any) {
      return {
        success: false,
        error: apiErr?.message || 'Error al marcar respuesta como solución',
      };
    }
  },
};
