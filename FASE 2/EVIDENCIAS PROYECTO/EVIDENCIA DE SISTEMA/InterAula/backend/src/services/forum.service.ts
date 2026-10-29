import { getAuthenticatedSupabase, supabasePublic } from '../lib/supabase.js';
import {
  persistentStore,
  isSchemaMissingError,
  resolveProfileSummary,
  type StoredForumPost,
  type StoredForumReply,
} from '../lib/persistentStore.js';
import type { AuthenticatedUser } from '../types/index.js';

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

function mapPostToDto(item: any, currentUserId?: string, votedPostIds?: Set<string>) {
  const authorProfile = item.author;
  const authorName =
    item.author_name ||
    (authorProfile
      ? authorProfile.display_name || `${authorProfile.first_name || ''} ${authorProfile.last_name || ''}`.trim() || 'Estudiante'
      : 'Estudiante');
  const institution = item.author_institution || authorProfile?.institution || 'Duoc UC';

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    author: authorName,
    authorInstitution: institution,
    category: item.category || 'General',
    postType: item.post_type || 'pregunta',
    subjectId: item.subject_id || null,
    tags: Array.isArray(item.tags) ? item.tags : [],
    repliesCount: item.replies_count ?? 0,
    votesCount: item.votes_count ?? 0,
    timeAgo: formatTimeAgo(item.created_at),
    isSolved: Boolean(item.is_solved),
    acceptedReplyId: item.accepted_reply_id || null,
    authorId: item.author_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at || item.created_at,
    hasVoted: currentUserId && votedPostIds ? votedPostIds.has(item.id) : false,
  };
}

function mapReplyToDto(item: any) {
  const authorProfile = item.author;
  const authorName =
    item.author_name ||
    (authorProfile
      ? authorProfile.display_name || `${authorProfile.first_name || ''} ${authorProfile.last_name || ''}`.trim() || 'Estudiante'
      : 'Estudiante');
  const institution = item.author_institution || authorProfile?.institution || 'Duoc UC';

  return {
    id: item.id,
    postId: item.post_id,
    authorId: item.author_id,
    authorName,
    authorInstitution: institution,
    content: item.content,
    votesCount: item.votes_count ?? 0,
    isAccepted: Boolean(item.is_accepted),
    createdAt: item.created_at,
    updatedAt: item.updated_at || item.created_at,
    timeAgo: formatTimeAgo(item.created_at),
  };
}

export interface ForumQueryOptions {
  category?: string;
  search?: string;
  postType?: string;
  status?: 'all' | 'open' | 'solved';
  subjectId?: string;
  sort?: 'recent' | 'popular' | 'activity';
  currentUserId?: string;
}

export const forumBackendService = {
  /**
   * Obtener lista de publicaciones en el foro con filtros y ordenamiento
   */
  async getPosts(options: ForumQueryOptions = {}) {
    const {
      category,
      search,
      postType,
      status = 'all',
      subjectId,
      sort = 'recent',
      currentUserId,
    } = options;

    let remotePosts: any[] = [];
    try {
      let query = supabasePublic
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
          updated_at,
          author_id,
          author:profiles(id, display_name, first_name, last_name, institution)
        `)
        .order('created_at', { ascending: false });

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        remotePosts = data;
      }
    } catch {
      // Fallback a persistentStore si la tabla remota no está disponible
    }

    const store = persistentStore.read();
    const votedPostIds = new Set<string>(
      currentUserId
        ? store.forum_post_votes.filter((v) => v.user_id === currentUserId).map((v) => v.post_id)
        : []
    );

    const combinedMap = new Map<string, any>();
    for (const p of remotePosts) {
      combinedMap.set(p.id, mapPostToDto(p, currentUserId, votedPostIds));
    }
    for (const sp of store.forum_posts) {
      combinedMap.set(sp.id, mapPostToDto(sp, currentUserId, votedPostIds));
    }

    let results = Array.from(combinedMap.values());

    if (category && category !== 'all') {
      results = results.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }
    if (postType && postType !== 'all') {
      results = results.filter((p) => p.postType === postType);
    }
    if (subjectId && subjectId !== 'all') {
      results = results.filter((p) => p.subjectId === subjectId);
    }
    if (status === 'open') {
      results = results.filter((p) => !p.isSolved);
    } else if (status === 'solved') {
      results = results.filter((p) => p.isSolved);
    }
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      results = results.filter(
        (p) =>
          p.title.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term) ||
          p.category.toLowerCase().includes(term) ||
          p.tags.some((t: string) => t.toLowerCase().includes(term))
      );
    }

    if (sort === 'popular') {
      results.sort((a, b) => b.votesCount - a.votesCount || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sort === 'activity') {
      results.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    } else {
      results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return results;
  },

  /**
   * Obtener detalle de una publicación junto con sus respuestas
   */
  async getPostById(postId: string, currentUserId?: string) {
    const store = persistentStore.read();
    const votedPostIds = new Set<string>(
      currentUserId
        ? store.forum_post_votes.filter((v) => v.user_id === currentUserId).map((v) => v.post_id)
        : []
    );

    const localPost = store.forum_posts.find((p) => p.id === postId);
    if (localPost) {
      const replies = store.forum_replies
        .filter((r) => r.post_id === postId)
        .sort((a, b) => {
          if (a.is_accepted !== b.is_accepted) return a.is_accepted ? -1 : 1;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        })
        .map(mapReplyToDto);
      return {
        ...mapPostToDto(localPost, currentUserId, votedPostIds),
        replies,
      };
    }

    const { data: post, error } = await supabasePublic
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
        updated_at,
        author_id,
        author:profiles(id, display_name, first_name, last_name, institution)
      `)
      .eq('id', postId)
      .maybeSingle();

    if (error || !post) {
      return null;
    }

    const { data: repliesData } = await supabasePublic
      .from('forum_replies')
      .select(`
        id,
        post_id,
        author_id,
        content,
        votes_count,
        is_accepted,
        created_at,
        updated_at,
        author:profiles(id, display_name, first_name, last_name, institution)
      `)
      .eq('post_id', postId)
      .order('is_accepted', { ascending: false })
      .order('created_at', { ascending: true });

    const remoteReplies = (repliesData || []).map(mapReplyToDto);
    const localReplies = store.forum_replies
      .filter((r) => r.post_id === postId)
      .map(mapReplyToDto);

    const replyMap = new Map<string, any>();
    for (const r of remoteReplies) replyMap.set(r.id, r);
    for (const r of localReplies) replyMap.set(r.id, r);

    return {
      ...mapPostToDto(post, currentUserId, votedPostIds),
      replies: Array.from(replyMap.values()),
    };
  },

  /**
   * Crear nueva publicación en el foro con autor verificado
   */
  async createPost(
    user: AuthenticatedUser,
    token: string,
    body: {
      title: string;
      description: string;
      category?: string;
      post_type?: 'pregunta' | 'discusion' | 'duda' | 'recurso';
      subject_id?: string | null;
      tags?: string[];
    }
  ) {
    const client = getAuthenticatedSupabase(token);
    const authorSummary = await resolveProfileSummary(user.id, user.email);
    const now = new Date().toISOString();

    const { data, error } = await client
      .from('forum_posts')
      .insert({
        author_id: user.id,
        title: body.title.trim(),
        description: body.description.trim(),
        category: body.category || 'General',
        tags: body.tags || [],
        votes_count: 1,
      })
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
        updated_at,
        author_id,
        author:profiles(id, display_name, first_name, last_name, institution)
      `)
      .single();

    if (!error && data) {
      // Guardar metadatos extendidos (post_type, subject_id, voto inicial) en el store del servidor si la migración 013 aún no está aplicada
      const storedPost: StoredForumPost = {
        id: data.id,
        author_id: user.id,
        author_name: authorSummary.name,
        author_institution: authorSummary.institution,
        title: data.title,
        description: data.description,
        category: data.category || 'General',
        post_type: body.post_type || 'pregunta',
        subject_id: body.subject_id || null,
        tags: Array.isArray(data.tags) ? data.tags : [],
        votes_count: data.votes_count ?? 1,
        replies_count: data.replies_count ?? 0,
        is_solved: Boolean(data.is_solved),
        accepted_reply_id: null,
        created_at: data.created_at || now,
        updated_at: data.updated_at || now,
      };
      persistentStore.write((db) => {
        const idx = db.forum_posts.findIndex((p) => p.id === storedPost.id);
        if (idx >= 0) db.forum_posts[idx] = storedPost;
        else db.forum_posts.unshift(storedPost);
        if (!db.forum_post_votes.some((v) => v.post_id === storedPost.id && v.user_id === user.id)) {
          db.forum_post_votes.push({ post_id: storedPost.id, user_id: user.id, created_at: now });
        }
      });

      return mapPostToDto(storedPost, user.id, new Set([storedPost.id]));
    }

    if (error && !isSchemaMissingError(error)) {
      throw new Error(error.message || 'Error al crear publicación en el foro');
    }

    // Respaldo de servidor si la tabla forum_posts aún no existe en Supabase remoto
    const fallbackPost: StoredForumPost = {
      id: persistentStore.newId(),
      author_id: user.id,
      author_name: authorSummary.name,
      author_institution: authorSummary.institution,
      title: body.title.trim(),
      description: body.description.trim(),
      category: body.category || 'General',
      post_type: body.post_type || 'pregunta',
      subject_id: body.subject_id || null,
      tags: body.tags || [],
      votes_count: 1,
      replies_count: 0,
      is_solved: false,
      accepted_reply_id: null,
      created_at: now,
      updated_at: now,
    };

    persistentStore.write((db) => {
      db.forum_posts.unshift(fallbackPost);
      db.forum_post_votes.push({ post_id: fallbackPost.id, user_id: user.id, created_at: now });
    });

    return mapPostToDto(fallbackPost, user.id, new Set([fallbackPost.id]));
  },

  /**
   * Editar publicación propia (solo autor o admin)
   */
  async updatePost(
    user: AuthenticatedUser,
    token: string,
    postId: string,
    body: {
      title?: string;
      description?: string;
      category?: string;
      post_type?: 'pregunta' | 'discusion' | 'duda' | 'recurso';
      subject_id?: string | null;
      tags?: string[];
    }
  ) {
    const store = persistentStore.read();
    const localPost = store.forum_posts.find((p) => p.id === postId);
    const client = getAuthenticatedSupabase(token);

    let ownerId = localPost?.author_id;
    if (!ownerId) {
      const { data: remotePost } = await client
        .from('forum_posts')
        .select('author_id')
        .eq('id', postId)
        .maybeSingle();
      if (!remotePost) {
        throw new Error('Publicación no encontrada');
      }
      ownerId = remotePost.author_id;
    }

    if (ownerId !== user.id && user.role !== 'admin') {
      throw new Error('Acceso denegado: Solo el autor puede editar esta publicación');
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = { updated_at: now };
    if (body.title !== undefined) updatePayload.title = body.title.trim();
    if (body.description !== undefined) updatePayload.description = body.description.trim();
    if (body.category !== undefined) updatePayload.category = body.category.trim();
    if (body.tags !== undefined) updatePayload.tags = body.tags;

    await client
      .from('forum_posts')
      .update(updatePayload)
      .eq('id', postId)
      .eq('author_id', ownerId);

    let updatedRecord: StoredForumPost | null = null;
    persistentStore.write((db) => {
      const existing = db.forum_posts.find((p) => p.id === postId);
      if (existing) {
        if (body.title !== undefined) existing.title = body.title.trim();
        if (body.description !== undefined) existing.description = body.description.trim();
        if (body.category !== undefined) existing.category = body.category.trim();
        if (body.post_type !== undefined) existing.post_type = body.post_type;
        if (body.subject_id !== undefined) existing.subject_id = body.subject_id;
        if (body.tags !== undefined) existing.tags = body.tags;
        existing.updated_at = now;
        updatedRecord = existing;
      }
    });

    if (updatedRecord) {
      return mapPostToDto(updatedRecord, user.id);
    }

    const refreshed = await this.getPostById(postId, user.id);
    if (!refreshed) throw new Error('Error al obtener la publicación actualizada');
    return refreshed;
  },

  /**
   * Eliminar publicación propia (solo autor o admin)
   */
  async deletePost(user: AuthenticatedUser, token: string, postId: string) {
    const store = persistentStore.read();
    const localPost = store.forum_posts.find((p) => p.id === postId);
    const client = getAuthenticatedSupabase(token);

    let ownerId = localPost?.author_id;
    if (!ownerId) {
      const { data: remotePost } = await client
        .from('forum_posts')
        .select('author_id')
        .eq('id', postId)
        .maybeSingle();
      if (!remotePost) {
        throw new Error('Publicación no encontrada');
      }
      ownerId = remotePost.author_id;
    }

    if (ownerId !== user.id && user.role !== 'admin') {
      throw new Error('Acceso denegado: Solo el autor puede eliminar esta publicación');
    }

    await client.from('forum_posts').delete().eq('id', postId);

    persistentStore.write((db) => {
      db.forum_posts = db.forum_posts.filter((p) => p.id !== postId);
      db.forum_replies = db.forum_replies.filter((r) => r.post_id !== postId);
      db.forum_post_votes = db.forum_post_votes.filter((v) => v.post_id !== postId);
    });

    return { success: true, id: postId };
  },

  /**
   * Votar o quitar voto de una publicación (sin votos duplicados por usuario)
   */
  async upvotePost(postId: string, user?: AuthenticatedUser) {
    const store = persistentStore.read();
    const localPost = store.forum_posts.find((p) => p.id === postId);

    if (user?.id) {
      const existingVoteIdx = store.forum_post_votes.findIndex(
        (v) => v.post_id === postId && v.user_id === user.id
      );
      const alreadyVoted = existingVoteIdx >= 0;
      const delta = alreadyVoted ? -1 : 1;

      let currentVotes = localPost?.votes_count;
      if (currentVotes === undefined) {
        const { data: current } = await supabasePublic
          .from('forum_posts')
          .select('votes_count')
          .eq('id', postId)
          .maybeSingle();
        currentVotes = current?.votes_count ?? 0;
      }

      const nextVotes = Math.max(0, (currentVotes ?? 0) + delta);

      await supabasePublic
        .from('forum_posts')
        .update({ votes_count: nextVotes })
        .eq('id', postId);

      persistentStore.write((db) => {
        if (alreadyVoted) {
          db.forum_post_votes.splice(existingVoteIdx, 1);
        } else {
          db.forum_post_votes.push({
            post_id: postId,
            user_id: user.id,
            created_at: new Date().toISOString(),
          });
        }
        const p = db.forum_posts.find((item) => item.id === postId);
        if (p) p.votes_count = nextVotes;
      });

      return {
        success: true,
        votesCount: nextVotes,
        hasVoted: !alreadyVoted,
      };
    }

    // En caso de llamada sin sesión autenticada (compatibilidad), incrementa 1 vez
    const { data: current } = await supabasePublic
      .from('forum_posts')
      .select('votes_count')
      .eq('id', postId)
      .maybeSingle();

    const currentVotes = localPost?.votes_count ?? current?.votes_count ?? 0;
    const nextVotes = currentVotes + 1;

    await supabasePublic
      .from('forum_posts')
      .update({ votes_count: nextVotes })
      .eq('id', postId);

    persistentStore.write((db) => {
      const p = db.forum_posts.find((item) => item.id === postId);
      if (p) p.votes_count = nextVotes;
    });

    return { success: true, votesCount: nextVotes, hasVoted: true };
  },

  /**
   * Marcar pregunta como resuelta (solo autor o admin)
   */
  async toggleSolved(user: AuthenticatedUser, token: string, postId: string, isSolved?: boolean) {
    const client = getAuthenticatedSupabase(token);
    const store = persistentStore.read();
    const localPost = store.forum_posts.find((p) => p.id === postId);

    let ownerId = localPost?.author_id;
    let currentSolved = localPost?.is_solved ?? false;

    if (!localPost) {
      const { data: post, error: fetchErr } = await client
        .from('forum_posts')
        .select('author_id, is_solved')
        .eq('id', postId)
        .maybeSingle();

      if (fetchErr || !post) {
        throw new Error('Publicación no encontrada');
      }
      ownerId = post.author_id;
      currentSolved = Boolean(post.is_solved);
    }

    if (ownerId !== user.id && user.role !== 'admin') {
      throw new Error('Solo el autor de la pregunta o un moderador puede marcarla como resuelta');
    }

    const targetStatus = typeof isSolved === 'boolean' ? isSolved : !currentSolved;

    await client
      .from('forum_posts')
      .update({ is_solved: targetStatus, updated_at: new Date().toISOString() })
      .eq('id', postId);

    persistentStore.write((db) => {
      const p = db.forum_posts.find((item) => item.id === postId);
      if (p) {
        p.is_solved = targetStatus;
        p.updated_at = new Date().toISOString();
      }
    });

    return { success: true, isSolved: targetStatus };
  },

  /**
   * Obtener respuestas de una publicación
   */
  async getReplies(postId: string) {
    const detail = await this.getPostById(postId);
    return detail?.replies || [];
  },

  /**
   * Crear respuesta en una publicación
   */
  async createReply(
    user: AuthenticatedUser,
    token: string,
    postId: string,
    content: string
  ) {
    const client = getAuthenticatedSupabase(token);
    const authorSummary = await resolveProfileSummary(user.id, user.email);
    const now = new Date().toISOString();

    const { data, error } = await client
      .from('forum_replies')
      .insert({
        post_id: postId,
        author_id: user.id,
        content: content.trim(),
      })
      .select(`
        id,
        post_id,
        author_id,
        content,
        votes_count,
        is_accepted,
        created_at,
        updated_at,
        author:profiles(id, display_name, first_name, last_name, institution)
      `)
      .single();

    const storedReply: StoredForumReply = {
      id: data?.id || persistentStore.newId(),
      post_id: postId,
      author_id: user.id,
      author_name: authorSummary.name,
      author_institution: authorSummary.institution,
      content: content.trim(),
      votes_count: data?.votes_count ?? 0,
      is_accepted: Boolean(data?.is_accepted),
      created_at: data?.created_at || now,
      updated_at: data?.updated_at || now,
    };

    if (error && !isSchemaMissingError(error)) {
      throw new Error(error.message || 'Error al publicar respuesta');
    }

    persistentStore.write((db) => {
      db.forum_replies.push(storedReply);
      const post = db.forum_posts.find((p) => p.id === postId);
      if (post) {
        post.replies_count = (post.replies_count || 0) + 1;
        post.updated_at = now;
      }
    });

    return mapReplyToDto(storedReply);
  },

  /**
   * Editar respuesta propia (solo autor o admin)
   */
  async updateReply(
    user: AuthenticatedUser,
    token: string,
    replyId: string,
    content: string
  ) {
    const client = getAuthenticatedSupabase(token);
    const store = persistentStore.read();
    const localReply = store.forum_replies.find((r) => r.id === replyId);

    let ownerId = localReply?.author_id;
    if (!ownerId) {
      const { data: remoteReply } = await client
        .from('forum_replies')
        .select('author_id')
        .eq('id', replyId)
        .maybeSingle();
      if (!remoteReply) {
        throw new Error('Respuesta no encontrada');
      }
      ownerId = remoteReply.author_id;
    }

    if (ownerId !== user.id && user.role !== 'admin') {
      throw new Error('Acceso denegado: Solo el autor puede editar esta respuesta');
    }

    const now = new Date().toISOString();
    const { data } = await client
      .from('forum_replies')
      .update({ content: content.trim(), updated_at: now })
      .eq('id', replyId)
      .select('*')
      .maybeSingle();

    let updated: StoredForumReply | null = null;
    persistentStore.write((db) => {
      const r = db.forum_replies.find((item) => item.id === replyId);
      if (r) {
        r.content = content.trim();
        r.updated_at = now;
        updated = r;
      }
    });

    if (updated) return mapReplyToDto(updated);
    return mapReplyToDto(
      data || {
        id: replyId,
        author_id: user.id,
        content: content.trim(),
        created_at: now,
        updated_at: now,
      }
    );
  },

  /**
   * Eliminar respuesta propia (solo autor o admin)
   */
  async deleteReply(user: AuthenticatedUser, token: string, replyId: string) {
    const client = getAuthenticatedSupabase(token);
    const store = persistentStore.read();
    const localReply = store.forum_replies.find((r) => r.id === replyId);

    let ownerId = localReply?.author_id;
    let postId = localReply?.post_id;
    if (!ownerId) {
      const { data: remoteReply } = await client
        .from('forum_replies')
        .select('author_id, post_id')
        .eq('id', replyId)
        .maybeSingle();
      if (!remoteReply) {
        throw new Error('Respuesta no encontrada');
      }
      ownerId = remoteReply.author_id;
      postId = remoteReply.post_id;
    }

    if (ownerId !== user.id && user.role !== 'admin') {
      throw new Error('Acceso denegado: Solo el autor puede eliminar esta respuesta');
    }

    await client.from('forum_replies').delete().eq('id', replyId);

    persistentStore.write((db) => {
      db.forum_replies = db.forum_replies.filter((r) => r.id !== replyId);
      if (postId) {
        const post = db.forum_posts.find((p) => p.id === postId);
        if (post) {
          post.replies_count = Math.max(0, (post.replies_count || 1) - 1);
          if (post.accepted_reply_id === replyId) {
            post.accepted_reply_id = null;
          }
        }
      }
    });

    return { success: true, id: replyId };
  },

  /**
   * Marcar respuesta como solución aceptada (solo autor del post o admin)
   */
  async markReplyAsSolution(
    user: AuthenticatedUser,
    token: string,
    postId: string,
    replyId: string
  ) {
    const client = getAuthenticatedSupabase(token);
    const store = persistentStore.read();
    const localPost = store.forum_posts.find((p) => p.id === postId);

    let postAuthorId = localPost?.author_id;
    if (!postAuthorId) {
      const { data: remotePost } = await client
        .from('forum_posts')
        .select('author_id')
        .eq('id', postId)
        .maybeSingle();
      if (!remotePost) {
        throw new Error('Publicación no encontrada');
      }
      postAuthorId = remotePost.author_id;
    }

    if (postAuthorId !== user.id && user.role !== 'admin') {
      throw new Error('Solo el autor de la consulta puede marcar una respuesta como solución aceptada');
    }

    // Desmarcar anteriores y marcar la elegida en Supabase si existe
    await client
      .from('forum_replies')
      .update({ is_accepted: false })
      .eq('post_id', postId);

    await client
      .from('forum_replies')
      .update({ is_accepted: true })
      .eq('id', replyId)
      .eq('post_id', postId);

    await client
      .from('forum_posts')
      .update({ is_solved: true, updated_at: new Date().toISOString() })
      .eq('id', postId);

    persistentStore.write((db) => {
      for (const r of db.forum_replies) {
        if (r.post_id === postId) {
          r.is_accepted = r.id === replyId;
        }
      }
      const p = db.forum_posts.find((item) => item.id === postId);
      if (p) {
        p.is_solved = true;
        p.accepted_reply_id = replyId;
        p.updated_at = new Date().toISOString();
      }
    });

    return {
      success: true,
      postId,
      acceptedReplyId: replyId,
      isSolved: true,
    };
  },
};
