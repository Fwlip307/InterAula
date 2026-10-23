import { getAuthenticatedSupabase, supabasePublic } from '../lib/supabase.js';
import type { AuthenticatedUser } from '../types/index.js';

export const INITIAL_FORUM_QUESTIONS = [
  {
    id: 'f-1',
    title: '¿Cómo implementar correctamente la herencia y polimorfismo en Java sin acoplamiento?',
    description: 'Estoy preparando el certamen de Programación Orientada a Objetos y tengo dudas sobre cuándo conviene usar una clase abstracta en vez de una interfaz al diseñar modelos de dominio.',
    author: 'Matías González',
    authorInstitution: 'Duoc UC · San Joaquín',
    category: 'Programación',
    tags: ['Java', 'POO', 'Herencia', 'Interfaces'],
    repliesCount: 4,
    votesCount: 12,
    timeAgo: 'Hace 2 horas',
    isSolved: true,
  },
  {
    id: 'f-2',
    title: 'Duda con subconsultas correlacionadas vs JOINs en PostgreSQL',
    description: 'En el ramo de Consultas de Bases de Datos, el profesor pide optimizar una query de reportes mensuales. ¿En qué casos una subconsulta correlated rinde peor que un LEFT JOIN con GROUP BY?',
    author: 'Camila Soto',
    authorInstitution: 'Duoc UC · Plaza Vespucio',
    category: 'Bases de Datos',
    tags: ['PostgreSQL', 'SQL', 'JOIN', 'Optimización'],
    repliesCount: 6,
    votesCount: 18,
    timeAgo: 'Hace 5 horas',
    isSolved: true,
  },
  {
    id: 'f-3',
    title: 'Ayuda con demostración de límites indeterminados 0/0 con factorización',
    description: 'En Nivelación Matemática y Cálculo nos pasaron ejercicios con raíces cuadradas en el denominador. ¿Cuál es el paso a paso recomendado para racionalizar antes de evaluar el límite?',
    author: 'Lucas Ramírez',
    authorInstitution: 'Duoc UC · Viña del Mar',
    category: 'Matemáticas',
    tags: ['Cálculo', 'Límites', 'Álgebra'],
    repliesCount: 2,
    votesCount: 8,
    timeAgo: 'Hace 1 día',
    isSolved: false,
  },
  {
    id: 'f-4',
    title: '¿Qué patrón de arquitectura recomiendan para una API REST modular en Node/TypeScript?',
    description: 'Estamos armando el proyecto semestral de Arquitectura de Software y queremos estructurar por capas (Controller - Service - Repository). ¿Algún tutor con apuntes o ejemplo de referencia?',
    author: 'Nicolás Tapia',
    authorInstitution: 'Duoc UC · Antonio Varas',
    category: 'Arquitectura',
    tags: ['TypeScript', 'Node.js', 'Clean Architecture', 'API REST'],
    repliesCount: 5,
    votesCount: 15,
    timeAgo: 'Hace 1 día',
    isSolved: false,
  },
  {
    id: 'f-5',
    title: 'Recomendaciones y tips para el examen transversal de Algoritmos',
    description: '¿Qué temas suelen tener mayor ponderación en el examen transversal? ¿Arreglos multidimensionales o recursión?',
    author: 'Valentina Muñoz',
    authorInstitution: 'Duoc UC · Maipú',
    category: 'General',
    tags: ['Algoritmos', 'Examen', 'Estudio'],
    repliesCount: 7,
    votesCount: 21,
    timeAgo: 'Hace 2 días',
    isSolved: true,
  },
];

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

export const forumBackendService = {
  /**
   * Obtener lista de publicaciones en el foro
   */
  async getPosts(category?: string, search?: string) {
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
   * Crear nueva publicación en el foro con autor verificado
   */
  async createPost(user: AuthenticatedUser, token: string, body: {
    title: string;
    description: string;
    category?: string;
    tags?: string[];
  }) {
    const client = getAuthenticatedSupabase(token);

    const { data, error } = await client
      .from('forum_posts')
      .insert({
        author_id: user.id, // Forzado desde la sesión del token
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
        author_id,
        author:profiles(id, display_name, first_name, last_name, institution)
      `)
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Error al crear publicación en el foro');
    }

    const authorProfile = data.author as any;
    const authorName = authorProfile
      ? authorProfile.display_name || `${authorProfile.first_name || ''} ${authorProfile.last_name || ''}`.trim() || 'Tú'
      : 'Tú';

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      author: authorName,
      authorInstitution: authorProfile?.institution || 'Duoc UC',
      category: data.category,
      tags: Array.isArray(data.tags) ? data.tags : [],
      repliesCount: 0,
      votesCount: 1,
      timeAgo: 'Recién publicado',
      isSolved: false,
      authorId: data.author_id,
      createdAt: data.created_at,
    };
  },

  /**
   * Incrementar votos de una publicación
   */
  async upvotePost(postId: string) {
    const { data: current } = await supabasePublic
      .from('forum_posts')
      .select('votes_count')
      .eq('id', postId)
      .single();

    const currentVotes = current?.votes_count ?? 0;

    const { data, error } = await supabasePublic
      .from('forum_posts')
      .update({ votes_count: currentVotes + 1 })
      .eq('id', postId)
      .select('votes_count')
      .single();

    if (error) {
      throw new Error(error.message || 'Error al registrar voto');
    }

    return { success: true, votesCount: data?.votes_count ?? currentVotes + 1 };
  },

  /**
   * Marcar pregunta como resuelta (solo autor o admin)
   */
  async toggleSolved(user: AuthenticatedUser, token: string, postId: string, isSolved?: boolean) {
    const client = getAuthenticatedSupabase(token);

    const { data: post, error: fetchErr } = await client
      .from('forum_posts')
      .select('author_id, is_solved')
      .eq('id', postId)
      .single();

    if (fetchErr || !post) {
      throw new Error('Publicación no encontrada');
    }

    if (post.author_id !== user.id && user.role !== 'admin') {
      throw new Error('Solo el autor de la pregunta o un moderador puede marcarla como resuelta');
    }

    const targetStatus = typeof isSolved === 'boolean' ? isSolved : !post.is_solved;

    const { data, error } = await client
      .from('forum_posts')
      .update({ is_solved: targetStatus })
      .eq('id', postId)
      .select('id, is_solved')
      .single();

    if (error) {
      throw new Error(error.message || 'Error al actualizar estado de la pregunta');
    }

    return { success: true, isSolved: data.is_solved };
  },
};
