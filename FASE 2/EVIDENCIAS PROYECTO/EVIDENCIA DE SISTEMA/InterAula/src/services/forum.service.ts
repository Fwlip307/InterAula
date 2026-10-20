import { supabase } from '../lib/supabase';

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

export const INITIAL_FORUM_QUESTIONS: ForumQuestion[] = [
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

export const forumService = {
  /**
   * Obtiene la lista de publicaciones del foro desde Supabase.
   * Si la tabla no está creada aún o falla la red, retorna la lista inicial como respaldo.
   */
  async getPosts(): Promise<ForumQuestion[]> {
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
        return INITIAL_FORUM_QUESTIONS;
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
      return INITIAL_FORUM_QUESTIONS;
    }
  },

  /**
   * Crea una nueva consulta en el foro persistida en Supabase.
   */
  async createPost(params: {
    title: string;
    description: string;
    category: string;
    tags: string[];
  }): Promise<{ success: boolean; post?: ForumQuestion; error?: string }> {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        return { success: false, error: 'Debes iniciar sesión para publicar una consulta en el foro.' };
      }

      const { data, error } = await supabase
        .from('forum_posts')
        .insert({
          author_id: user.id,
          title: params.title.trim(),
          description: params.description.trim(),
          category: params.category,
          tags: params.tags,
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
        return {
          success: false,
          error: error?.message || 'Error al persistir consulta en el foro',
        };
      }

      const authorProfile = data.author as any;
      const authorName = authorProfile
        ? authorProfile.display_name || `${authorProfile.first_name || ''} ${authorProfile.last_name || ''}`.trim() || 'Tú'
        : 'Tú';

      const post: ForumQuestion = {
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

      return { success: true, post };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error inesperado' };
    }
  },

  /**
   * Registra un voto para una pregunta
   */
  async upvotePost(postId: string, currentVotes: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('forum_posts')
        .update({ votes_count: currentVotes + 1 })
        .eq('id', postId);

      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Marca una pregunta como resuelta por el autor
   */
  async toggleSolved(postId: string, isSolved: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('forum_posts')
        .update({ is_solved: !isSolved })
        .eq('id', postId);

      return !error;
    } catch {
      return false;
    }
  },
};
