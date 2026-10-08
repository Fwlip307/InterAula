import { useState } from 'react';
import {
  SearchIcon,
  CheckIcon,
  XIcon,
  BookOpenIcon,
  PlusIcon,
} from '../../components/common/Icons';

interface ForumQuestion {
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
}

const INITIAL_QUESTIONS: ForumQuestion[] = [
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

const CATEGORIES = ['Todas', 'Programación', 'Bases de Datos', 'Matemáticas', 'Arquitectura', 'General'];

export default function Forum() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [questions, setQuestions] = useState<ForumQuestion[]>(INITIAL_QUESTIONS);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  // Formulario de nueva consulta
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Programación');
  const [newDescription, setNewDescription] = useState('');
  const [newTags, setNewTags] = useState('');

  const filteredQuestions = questions.filter((q) => {
    const matchesCategory = selectedCategory === 'Todas' || q.category === selectedCategory;
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      term === '' ||
      q.title.toLowerCase().includes(term) ||
      q.description.toLowerCase().includes(term) ||
      q.tags.some((t) => t.toLowerCase().includes(term));
    return matchesCategory && matchesSearch;
  });

  const handleCreateQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;

    const newQ: ForumQuestion = {
      id: `f-${Date.now()}`,
      title: newTitle.trim(),
      description: newDescription.trim(),
      author: 'Tú (Estudiante)',
      authorInstitution: 'Mi Institución Académica',
      category: newCategory,
      tags: newTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      repliesCount: 0,
      votesCount: 1,
      timeAgo: 'Recién publicado',
      isSolved: false,
    };

    setQuestions([newQ, ...questions]);
    setIsNewModalOpen(false);
    setNewTitle('');
    setNewDescription('');
    setNewTags('');
    setSuccessToast('¡Tu consulta ha sido publicada en el foro!');
    setTimeout(() => setSuccessToast(''), 4500);
  };

  return (
    <div>
      {/* Cabecera del Foro */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#2563eb',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                background: '#eff6ff',
                padding: '3px 10px',
                borderRadius: '9999px',
              }}
            >
              Comunidad Académica
            </span>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>· Preguntas y Respuestas</span>
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0' }}>
            Foro Universitario
          </h1>
          <p style={{ fontSize: '0.92rem', color: '#64748b', margin: 0, maxWidth: '640px' }}>
            Resuelve dudas puntuales, comparte soluciones de ejercicios y debate con tutores y compañeros de tu carrera.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsNewModalOpen(true)}
          className="ia-btn-primary"
          style={{
            padding: '10px 20px',
            fontSize: '0.9rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <PlusIcon size={18} color="#ffffff" />
          <span>+ Nueva Consulta</span>
        </button>
      </div>

      {/* Toast de Éxito */}
      {successToast && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#15803d',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          <CheckIcon size={18} color="#15803d" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Barra de Filtros y Búsqueda */}
      <div
        className="ia-card"
        style={{
          padding: '16px 20px',
          marginBottom: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div
            style={{
              flex: 1,
              minWidth: '260px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <SearchIcon
              size={18}
              color="#94a3b8"
              style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por pregunta, concepto o tecnología (ej: SQL, Herencia, Límites)..."
              style={{
                width: '100%',
                padding: '9px 12px 9px 38px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '9999px',
                  border: selectedCategory === cat ? '1px solid #2563eb' : '1px solid #e2e8f0',
                  background: selectedCategory === cat ? '#eff6ff' : '#ffffff',
                  color: selectedCategory === cat ? '#2563eb' : '#475569',
                  fontSize: '0.84rem',
                  fontWeight: selectedCategory === cat ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Listado de Consultas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredQuestions.length > 0 ? (
          filteredQuestions.map((q) => (
            <div
              key={q.id}
              className="ia-card"
              style={{
                padding: '20px 24px',
                transition: 'all 0.15s ease',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: '#f1f5f9',
                        color: '#334155',
                      }}
                    >
                      {q.category}
                    </span>
                    {q.isSolved ? (
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: '#f0fdf4',
                          color: '#15803d',
                          border: '1px solid #bbf7d0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <CheckIcon size={12} /> Resuelta
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: '#fffbeb',
                          color: '#b45309',
                          border: '1px solid #fde68a',
                        }}
                      >
                        Abierta
                      </span>
                    )}
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>· {q.timeAgo}</span>
                  </div>

                  <h3
                    style={{
                      fontSize: '1.08rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      margin: '0 0 6px 0',
                      lineHeight: 1.35,
                    }}
                  >
                    {q.title}
                  </h3>

                  <p
                    style={{
                      fontSize: '0.88rem',
                      color: '#64748b',
                      margin: '0 0 12px 0',
                      lineHeight: 1.5,
                    }}
                  >
                    {q.description}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {q.tags.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: '0.74rem',
                          color: '#2563eb',
                          background: '#eff6ff',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Métricas y Autor */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '8px',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                        {q.votesCount}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>
                        Votos
                      </div>
                    </div>
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '4px 10px',
                        background: q.repliesCount > 0 ? '#eff6ff' : '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '1.05rem',
                          fontWeight: 800,
                          color: q.repliesCount > 0 ? '#2563eb' : '#64748b',
                        }}
                      >
                        {q.repliesCount}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>
                        Respuestas
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#475569', textAlign: 'right', marginTop: '6px' }}>
                    Por <strong>{q.author}</strong>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{q.authorInstitution}</div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="ia-card" style={{ padding: '48px 20px', textAlign: 'center' }}>
            <BookOpenIcon size={32} color="#94a3b8" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '12px 0 6px 0' }}>
              No se encontraron consultas
            </h3>
            <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
              Prueba buscando con otros términos o crea una nueva pregunta para la comunidad.
            </p>
          </div>
        )}
      </div>

      {/* Modal de Nueva Consulta */}
      {isNewModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            className="ia-card"
            style={{
              maxWidth: '560px',
              width: '100%',
              padding: '28px',
              borderRadius: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Hacer una pregunta en el foro
              </h2>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Título de la consulta *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Sé específico, ej: ¿Cómo resolver consultas JOIN con GROUP BY en SQL?"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Área / Categoría *
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    outline: 'none',
                    background: '#ffffff',
                  }}
                >
                  {CATEGORIES.filter((c) => c !== 'Todas').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Detalle y contexto de tu duda *
                </label>
                <textarea
                  required
                  rows={4}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Explica qué intentaste, qué materia estás cursando y qué dudas te quedan..."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Etiquetas (separadas por coma)
                </label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="ej: Python, Recursión, Certamen 1"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="ia-btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.86rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="ia-btn-primary"
                  style={{ padding: '8px 20px', fontSize: '0.86rem', fontWeight: 700 }}
                >
                  Publicar en el Foro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
