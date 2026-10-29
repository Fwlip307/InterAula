import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCalmMode } from '../../context/CalmModeContext';
import {
  forumService,
  type ForumQuestion,
  type ForumReply,
  type ForumPostType,
} from '../../services/forum.service';
import { BUSINESS_RULES } from '../../constants/businessRules';
import {
  SearchIcon,
  PlusIcon,
  CheckIcon,
  BookOpenIcon,
  AwardIcon,
  EditIcon,
  TrashIcon,
  ArrowLeftIcon,
  AlertCircleIcon,
} from '../../components/common/Icons';

const CATEGORIES = [
  'Todas',
  'Programación',
  'Bases de Datos',
  'Matemáticas',
  'Arquitectura',
  'Redes y Seguridad',
  'General',
];

const POST_TYPE_LABELS: Record<ForumPostType, { label: string; bg: string; color: string; border: string }> = {
  pregunta: { label: 'Pregunta', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  duda: { label: 'Duda puntual', bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  discusion: { label: 'Debate académico', bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' },
  recurso: { label: 'Aporte / Recurso', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
};

export default function Forum() {
  const { user } = useAuth();
  const { isCalmMode } = useCalmMode();

  const [questions, setQuestions] = useState<ForumQuestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedPostType, setSelectedPostType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'open' | 'solved'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'activity'>('recent');
  const [visibleCount, setVisibleCount] = useState<number>(BUSINESS_RULES.FORUM.PAGE_SIZE);

  // Mensajes de feedback
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Modal de creación / edición de publicación
  const [showPostModal, setShowPostModal] = useState(false);
  const [editingPost, setEditingPost] = useState<ForumQuestion | null>(null);
  const [postTitle, setPostTitle] = useState('');
  const [postCategory, setPostCategory] = useState('Programación');
  const [postType, setPostType] = useState<ForumPostType>('pregunta');
  const [postDescription, setPostDescription] = useState('');
  const [postTags, setPostTags] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);

  // Confirmación de eliminación de publicación
  const [postToDelete, setPostToDelete] = useState<ForumQuestion | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);

  // Vista detallada de conversación y respuestas
  const [selectedPost, setSelectedPost] = useState<ForumQuestion | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [newReplyContent, setNewReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Edición y eliminación de respuestas
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyContent, setEditingReplyContent] = useState('');
  const [replyToDeleteId, setReplyToDeleteId] = useState<string | null>(null);

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 5000);
    } else {
      setFeedbackMsg(msg);
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
  };

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await forumService.getPosts({
        category: selectedCategory,
        search: searchTerm,
        post_type: selectedPostType,
        status: selectedStatus,
        sort: sortBy,
      });
      setQuestions(data);
    } catch (err) {
      console.error('[Forum] Error cargando publicaciones:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchTerm, selectedPostType, selectedStatus, sortBy]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const openThread = async (post: ForumQuestion) => {
    setSelectedPost(post);
    setLoadingThread(true);
    setEditingReplyId(null);
    try {
      const detail = await forumService.getPostById(post.id);
      if (detail) {
        setSelectedPost(detail);
        setReplies(detail.replies || []);
      } else {
        const fetchedReplies = await forumService.getReplies(post.id);
        setReplies(fetchedReplies);
      }
    } finally {
      setLoadingThread(false);
    }
  };

  const openCreateModal = () => {
    setEditingPost(null);
    setPostTitle('');
    setPostCategory('Programación');
    setPostType('pregunta');
    setPostDescription('');
    setPostTags('');
    setShowPostModal(true);
  };

  const openEditModal = (post: ForumQuestion, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingPost(post);
    setPostTitle(post.title);
    setPostCategory(post.category || 'General');
    setPostType(post.postType || 'pregunta');
    setPostDescription(post.description);
    setPostTags((post.tags || []).join(', '));
    setShowPostModal(true);
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postDescription.trim() || submittingPost) return;

    setSubmittingPost(true);
    setErrorMsg('');

    const parsedTags = postTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingPost) {
      const res = await forumService.updatePost(editingPost.id, {
        title: postTitle.trim(),
        description: postDescription.trim(),
        category: postCategory,
        post_type: postType,
        tags: parsedTags.length > 0 ? parsedTags : [postCategory],
      });

      setSubmittingPost(false);
      if (res.success && res.post) {
        setQuestions((prev) => prev.map((q) => (q.id === editingPost.id ? { ...q, ...res.post } : q)));
        if (selectedPost?.id === editingPost.id) {
          setSelectedPost((prev) => (prev ? { ...prev, ...res.post } : prev));
        }
        setShowPostModal(false);
        showToast('Publicación actualizada correctamente.');
      } else {
        showToast(res.error || 'No se pudo actualizar la publicación.', true);
      }
      return;
    }

    const res = await forumService.createPost({
      title: postTitle.trim(),
      description: postDescription.trim(),
      category: postCategory,
      post_type: postType,
      tags: parsedTags.length > 0 ? parsedTags : [postCategory],
    });

    setSubmittingPost(false);
    if (res.success && res.post) {
      setQuestions((prev) => [res.post!, ...prev]);
      setShowPostModal(false);
      showToast('Consulta publicada exitosamente en el foro.');
    } else {
      showToast(res.error || 'No fue posible publicar tu consulta.', true);
    }
  };

  const handleConfirmDeletePost = async () => {
    if (!postToDelete || deletingPost) return;
    setDeletingPost(true);
    const res = await forumService.deletePost(postToDelete.id);
    setDeletingPost(false);

    if (res.success) {
      setQuestions((prev) => prev.filter((q) => q.id !== postToDelete.id));
      if (selectedPost?.id === postToDelete.id) {
        setSelectedPost(null);
      }
      setPostToDelete(null);
      showToast('Publicación eliminada correctamente.');
    } else {
      showToast(res.error || 'No se pudo eliminar la publicación.', true);
    }
  };

  const handleVote = async (question: ForumQuestion, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const res = await forumService.upvotePost(question.id, question.votesCount);
    if (res.success) {
      const nextVotes = res.votesCount ?? question.votesCount + 1;
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === question.id
            ? { ...q, votesCount: nextVotes, hasVoted: res.hasVoted ?? !q.hasVoted }
            : q
        )
      );
      if (selectedPost?.id === question.id) {
        setSelectedPost((prev) =>
          prev
            ? { ...prev, votesCount: nextVotes, hasVoted: res.hasVoted ?? !prev.hasVoted }
            : prev
        );
      }
    }
  };

  const handleToggleSolved = async (post: ForumQuestion, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const ok = await forumService.toggleSolved(post.id, post.isSolved);
    if (ok) {
      const nextSolved = !post.isSolved;
      setQuestions((prev) =>
        prev.map((q) => (q.id === post.id ? { ...q, isSolved: nextSolved } : q))
      );
      if (selectedPost?.id === post.id) {
        setSelectedPost((prev) => (prev ? { ...prev, isSolved: nextSolved } : prev));
      }
      showToast(nextSolved ? 'Consulta marcada como resuelta.' : 'Consulta reabierta.');
    }
  };

  const handleCreateReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPost || !newReplyContent.trim() || submittingReply) return;

    setSubmittingReply(true);
    const res = await forumService.createReply(selectedPost.id, newReplyContent.trim());
    setSubmittingReply(false);

    if (res.success && res.reply) {
      setReplies((prev) => [...prev, res.reply!]);
      setNewReplyContent('');
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === selectedPost.id ? { ...q, repliesCount: (q.repliesCount || 0) + 1 } : q
        )
      );
      setSelectedPost((prev) =>
        prev ? { ...prev, repliesCount: (prev.repliesCount || 0) + 1 } : prev
      );
      showToast('Respuesta publicada.');
    } else {
      showToast(res.error || 'Error al publicar respuesta.', true);
    }
  };

  const handleSaveEditReply = async (replyId: string) => {
    if (!editingReplyContent.trim()) return;
    const res = await forumService.updateReply(replyId, editingReplyContent.trim());
    if (res.success && res.reply) {
      setReplies((prev) => prev.map((r) => (r.id === replyId ? { ...r, ...res.reply } : r)));
      setEditingReplyId(null);
      setEditingReplyContent('');
      showToast('Respuesta actualizada.');
    } else {
      showToast(res.error || 'No se pudo editar la respuesta.', true);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!selectedPost) return;
    const res = await forumService.deleteReply(replyId);
    if (res.success) {
      setReplies((prev) => prev.filter((r) => r.id !== replyId));
      setReplyToDeleteId(null);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === selectedPost.id
            ? { ...q, repliesCount: Math.max(0, (q.repliesCount || 1) - 1) }
            : q
        )
      );
      setSelectedPost((prev) =>
        prev ? { ...prev, repliesCount: Math.max(0, (prev.repliesCount || 1) - 1) } : prev
      );
      showToast('Respuesta eliminada.');
    } else {
      showToast(res.error || 'No se pudo eliminar la respuesta.', true);
    }
  };

  const handleMarkSolution = async (replyId: string) => {
    if (!selectedPost) return;
    const res = await forumService.markReplyAsSolution(selectedPost.id, replyId);
    if (res.success) {
      setReplies((prev) =>
        prev.map((r) => ({
          ...r,
          isAccepted: r.id === replyId,
        }))
      );
      setSelectedPost((prev) =>
        prev ? { ...prev, isSolved: true, acceptedReplyId: replyId } : prev
      );
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === selectedPost.id ? { ...q, isSolved: true, acceptedReplyId: replyId } : q
        )
      );
      showToast('Respuesta marcada como solución aceptada.');
    } else {
      showToast(res.error || 'No se pudo marcar como solución.', true);
    }
  };

  const visibleQuestions = questions.slice(0, visibleCount);

  return (
    <div>
      {/* Cabecera del Foro */}
      <div className="ia-page-header">
        <div>
          <h1 className="ia-page-title">Foro Estudiantil de Consultas</h1>
          <p className="ia-page-subtitle">
            Resuelve dudas puntuales de tus asignaturas, comparte soluciones verificadas y colabora con tutores y compañeros.
          </p>
        </div>
        <div className="ia-page-actions">
          {selectedPost && (
            <button
              type="button"
              className="ia-btn-secondary"
              onClick={() => setSelectedPost(null)}
            >
              <ArrowLeftIcon size={16} />
              <span>Volver al listado</span>
            </button>
          )}
          <button
            type="button"
            className="ia-btn-primary"
            onClick={openCreateModal}
          >
            <PlusIcon size={16} color="#ffffff" />
            <span>Nueva Consulta</span>
          </button>
        </div>
      </div>

      {/* Mensajes de estado */}
      {feedbackMsg && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '10px',
            background: 'var(--ia-success-bg)',
            border: '1px solid var(--ia-success-border)',
            color: 'var(--ia-success)',
            fontSize: '0.86rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckIcon size={16} color="currentColor" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '16px',
            borderRadius: '10px',
            background: 'var(--ia-danger-bg)',
            border: '1px solid var(--ia-danger-border)',
            color: 'var(--ia-danger)',
            fontSize: '0.86rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircleIcon size={16} color="currentColor" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Modal Crear / Editar Publicación */}
      {showPostModal && (
        <div className="ia-card" style={{ marginBottom: '22px', border: '1px solid var(--ia-primary-border)' }}>
          <div className="ia-card-header">
            <h2 className="ia-card-title">
              {editingPost ? 'Editar Publicación' : 'Publicar Nueva Consulta Académica'}
            </h2>
            <button
              type="button"
              className="ia-btn-secondary"
              onClick={() => setShowPostModal(false)}
              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
            >
              Cancelar
            </button>
          </div>
          <form onSubmit={handleSavePost}>
            <div className="ia-form-grid">
              <div className="ia-form-group full">
                <label className="ia-label" htmlFor="forum-post-title">
                  Título de tu consulta *
                </label>
                <input
                  id="forum-post-title"
                  type="text"
                  className="ia-input"
                  placeholder="Ej: ¿Cómo optimizar una consulta con múltiples JOINs en PostgreSQL?"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  minLength={BUSINESS_RULES.FORUM.MIN_TITLE_LENGTH}
                  maxLength={BUSINESS_RULES.FORUM.MAX_TITLE_LENGTH}
                  required
                />
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="forum-post-type">
                  Tipo de publicación
                </label>
                <select
                  id="forum-post-type"
                  className="ia-select"
                  value={postType}
                  onChange={(e) => setPostType(e.target.value as ForumPostType)}
                >
                  <option value="pregunta">Pregunta técnica</option>
                  <option value="duda">Duda puntual de ramo</option>
                  <option value="discusion">Debate / Discusión académica</option>
                  <option value="recurso">Aporte / Tip de estudio</option>
                </select>
              </div>

              <div className="ia-form-group">
                <label className="ia-label" htmlFor="forum-post-category">
                  Categoría / Área
                </label>
                <select
                  id="forum-post-category"
                  className="ia-select"
                  value={postCategory}
                  onChange={(e) => setPostCategory(e.target.value)}
                >
                  {CATEGORIES.filter((c) => c !== 'Todas').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ia-form-group full">
                <label className="ia-label" htmlFor="forum-post-tags">
                  Etiquetas (separadas por coma)
                </label>
                <input
                  id="forum-post-tags"
                  type="text"
                  className="ia-input"
                  placeholder="Ej: SQL, Índices, Base de Datos, Certamen 2"
                  value={postTags}
                  onChange={(e) => setPostTags(e.target.value)}
                />
              </div>

              <div className="ia-form-group full">
                <label className="ia-label" htmlFor="forum-post-desc">
                  Detalle de tu duda o planteamiento *
                </label>
                <textarea
                  id="forum-post-desc"
                  className="ia-textarea"
                  rows={5}
                  placeholder="Describe qué intentaste hacer, qué error obtienes o qué concepto necesitas comprender..."
                  value={postDescription}
                  onChange={(e) => setPostDescription(e.target.value)}
                  minLength={BUSINESS_RULES.FORUM.MIN_DESCRIPTION_LENGTH}
                  maxLength={BUSINESS_RULES.FORUM.MAX_DESCRIPTION_LENGTH}
                  required
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
              <button type="button" className="ia-btn-secondary" onClick={() => setShowPostModal(false)}>
                Cancelar
              </button>
              <button type="submit" className="ia-btn-primary" disabled={submittingPost}>
                {submittingPost
                  ? 'Guardando...'
                  : editingPost
                  ? 'Guardar Cambios'
                  : 'Publicar en el Foro'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmación para eliminar publicación */}
      {postToDelete && (
        <div
          className="ia-card"
          style={{
            marginBottom: '20px',
            border: '1px solid var(--ia-danger-border)',
            background: 'var(--ia-danger-bg)',
          }}
        >
          <h3 style={{ margin: '0 0 6px 0', fontSize: '0.98rem', color: 'var(--ia-danger)' }}>
            ¿Eliminar esta publicación del foro?
          </h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.86rem', color: 'var(--ia-text-body)' }}>
            Se eliminará permanentemente <strong>"{postToDelete.title}"</strong> y todas sus respuestas asociadas.
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="ia-btn-primary"
              style={{ background: 'var(--ia-danger)' }}
              onClick={handleConfirmDeletePost}
              disabled={deletingPost}
            >
              {deletingPost ? 'Eliminando...' : 'Sí, eliminar publicación'}
            </button>
            <button
              type="button"
              className="ia-btn-secondary"
              onClick={() => setPostToDelete(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* VISTA DETALLADA DE CONVERSACIÓN */}
      {selectedPost ? (
        <div>
          <div className="ia-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {selectedPost.postType && POST_TYPE_LABELS[selectedPost.postType] && (
                  <span
                    className="ia-badge"
                    style={{
                      background: isCalmMode ? 'var(--ia-bg-subtle)' : POST_TYPE_LABELS[selectedPost.postType].bg,
                      color: isCalmMode ? 'var(--ia-text-body)' : POST_TYPE_LABELS[selectedPost.postType].color,
                      border: `1px solid ${isCalmMode ? 'var(--ia-border)' : POST_TYPE_LABELS[selectedPost.postType].border}`,
                    }}
                  >
                    {POST_TYPE_LABELS[selectedPost.postType].label}
                  </span>
                )}
                <span className="ia-badge ia-badge-blue">{selectedPost.category}</span>
                {selectedPost.isSolved ? (
                  <span className="ia-badge ia-badge-success">
                    <CheckIcon size={12} /> Resuelta
                  </span>
                ) : (
                  <span className="ia-badge ia-badge-amber">Abierta a respuestas</span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={selectedPost.hasVoted ? 'ia-btn-primary' : 'ia-btn-secondary'}
                  onClick={() => handleVote(selectedPost)}
                  style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                >
                  ▲ Útil ({selectedPost.votesCount})
                </button>

                {user?.id && selectedPost.authorId === user.id && (
                  <>
                    <button
                      type="button"
                      className="ia-btn-secondary"
                      onClick={() => handleToggleSolved(selectedPost)}
                      style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                    >
                      {selectedPost.isSolved ? 'Reabrir consulta' : 'Marcar como resuelta'}
                    </button>
                    <button
                      type="button"
                      className="ia-btn-secondary"
                      onClick={(e) => openEditModal(selectedPost, e)}
                      style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                    >
                      <EditIcon size={14} /> Editar
                    </button>
                    <button
                      type="button"
                      className="ia-btn-icon-danger"
                      onClick={() => setPostToDelete(selectedPost)}
                      title="Eliminar publicación"
                    >
                      <TrashIcon size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>

            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--ia-text-main)', margin: '14px 0 10px 0' }}>
              {selectedPost.title}
            </h2>

            <p style={{ fontSize: '0.94rem', color: 'var(--ia-text-body)', lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: '0 0 16px 0' }}>
              {selectedPost.description}
            </p>

            {selectedPost.tags && selectedPost.tags.length > 0 && (
              <div className="ia-tags-cloud" style={{ marginBottom: '16px' }}>
                {selectedPost.tags.map((tag) => (
                  <span key={tag} className="ia-tag" style={{ cursor: 'default' }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div
              style={{
                borderTop: '1px solid var(--ia-border)',
                paddingTop: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                fontSize: '0.82rem',
                color: 'var(--ia-text-muted)',
              }}
            >
              <div>
                Publicado por{' '}
                {selectedPost.authorId ? (
                  <Link
                    to={`/profile/${selectedPost.authorId}`}
                    style={{ color: 'var(--ia-primary)', fontWeight: 600, textDecoration: 'none' }}
                  >
                    {selectedPost.author}
                  </Link>
                ) : (
                  <strong style={{ color: 'var(--ia-text-body)' }}>{selectedPost.author}</strong>
                )}{' '}
                · {selectedPost.authorInstitution}
              </div>
              <span>{selectedPost.timeAgo}</span>
            </div>
          </div>

          {/* Lista de respuestas */}
          <div className="ia-card">
            <div className="ia-card-header">
              <h3 className="ia-card-title">
                Respuestas de la Comunidad ({replies.length})
              </h3>
            </div>

            {loadingThread ? (
              <p style={{ fontSize: '0.88rem', color: 'var(--ia-text-muted)' }}>Cargando respuestas...</p>
            ) : replies.length === 0 ? (
              <div className="ia-empty-box" style={{ padding: '24px' }}>
                <p className="ia-empty-title">Aún no hay respuestas en esta consulta</p>
                <p className="ia-empty-desc">
                  Sé el primero en aportar una explicación, código de ejemplo o referencia académica.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {replies.map((reply) => {
                  const isReplyOwner = Boolean(user?.id && reply.authorId === user.id);
                  const isPostOwner = Boolean(user?.id && selectedPost.authorId === user.id);

                  return (
                    <div
                      key={reply.id}
                      style={{
                        padding: '16px',
                        borderRadius: '10px',
                        border: reply.isAccepted
                          ? '2px solid var(--ia-success)'
                          : '1px solid var(--ia-border)',
                        background: reply.isAccepted ? 'var(--ia-success-bg)' : 'var(--ia-bg-body)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {reply.authorId ? (
                            <Link
                              to={`/profile/${reply.authorId}`}
                              style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--ia-primary)', textDecoration: 'none' }}
                            >
                              {reply.authorName}
                            </Link>
                          ) : (
                            <strong style={{ fontSize: '0.88rem' }}>{reply.authorName}</strong>
                          )}
                          <span style={{ fontSize: '0.78rem', color: 'var(--ia-text-muted)' }}>
                            · {reply.authorInstitution} · {reply.timeAgo || 'Reciente'}
                          </span>
                          {reply.isAccepted && (
                            <span className="ia-badge ia-badge-success">
                              <CheckIcon size={12} /> Solución Aceptada
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isPostOwner && !reply.isAccepted && (
                            <button
                              type="button"
                              className="ia-btn-secondary"
                              onClick={() => handleMarkSolution(reply.id)}
                              style={{ padding: '4px 10px', fontSize: '0.76rem' }}
                            >
                              <CheckIcon size={12} /> Marcar como solución
                            </button>
                          )}
                          {isReplyOwner && editingReplyId !== reply.id && (
                            <>
                              <button
                                type="button"
                                className="ia-btn-secondary"
                                onClick={() => {
                                  setEditingReplyId(reply.id);
                                  setEditingReplyContent(reply.content);
                                }}
                                style={{ padding: '4px 8px', fontSize: '0.76rem' }}
                              >
                                <EditIcon size={13} /> Editar
                              </button>
                              <button
                                type="button"
                                className="ia-btn-icon-danger"
                                onClick={() => setReplyToDeleteId(reply.id)}
                                title="Eliminar respuesta"
                              >
                                <TrashIcon size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {editingReplyId === reply.id ? (
                        <div style={{ marginTop: '8px' }}>
                          <textarea
                            className="ia-textarea"
                            rows={3}
                            value={editingReplyContent}
                            onChange={(e) => setEditingReplyContent(e.target.value)}
                          />
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button
                              type="button"
                              className="ia-btn-primary"
                              onClick={() => handleSaveEditReply(reply.id)}
                              style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                            >
                              Guardar respuesta
                            </button>
                            <button
                              type="button"
                              className="ia-btn-secondary"
                              onClick={() => setEditingReplyId(null)}
                              style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ia-text-main)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                          {reply.content}
                        </p>
                      )}

                      {replyToDeleteId === reply.id && (
                        <div style={{ marginTop: '10px', padding: '10px', borderRadius: '8px', background: 'var(--ia-danger-bg)', border: '1px solid var(--ia-danger-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--ia-danger)', fontWeight: 600 }}>
                            ¿Confirmas eliminar tu respuesta?
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="ia-btn-primary"
                              style={{ background: 'var(--ia-danger)', padding: '4px 10px', fontSize: '0.76rem' }}
                              onClick={() => handleDeleteReply(reply.id)}
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              className="ia-btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '0.76rem' }}
                              onClick={() => setReplyToDeleteId(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Formulario para publicar nueva respuesta */}
            <form onSubmit={handleCreateReply} style={{ marginTop: '20px', borderTop: '1px solid var(--ia-border)', paddingTop: '16px' }}>
              <label className="ia-label" htmlFor="forum-new-reply">
                Tu respuesta o aporte académico
              </label>
              <textarea
                id="forum-new-reply"
                className="ia-textarea"
                rows={4}
                placeholder="Escribe una respuesta clara, paso a paso o comparte un ejemplo..."
                value={newReplyContent}
                onChange={(e) => setNewReplyContent(e.target.value)}
                minLength={BUSINESS_RULES.FORUM.MIN_REPLY_LENGTH}
                maxLength={BUSINESS_RULES.FORUM.MAX_REPLY_LENGTH}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="submit" className="ia-btn-primary" disabled={submittingReply}>
                  {submittingReply ? 'Publicando...' : 'Responder Consulta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* VISTA LISTADO Y FILTROS */
        <>
          <div className="ia-card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
              <div style={{ position: 'relative', flex: '1 1 260px' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                  <SearchIcon size={16} />
                </span>
                <input
                  type="text"
                  className="ia-input"
                  style={{ paddingLeft: '36px' }}
                  placeholder="Buscar por tema, lenguaje, error o etiqueta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                aria-label="Filtrar por tipo de publicación"
                className="ia-select"
                style={{ width: 'auto', minWidth: '150px' }}
                value={selectedPostType}
                onChange={(e) => setSelectedPostType(e.target.value)}
              >
                <option value="all">Todos los tipos</option>
                <option value="pregunta">Preguntas</option>
                <option value="duda">Dudas puntuales</option>
                <option value="discusion">Debates</option>
                <option value="recurso">Recursos / Aportes</option>
              </select>

              <select
                aria-label="Filtrar por estado"
                className="ia-select"
                style={{ width: 'auto', minWidth: '145px' }}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as 'all' | 'open' | 'solved')}
              >
                <option value="all">Estado: Todas</option>
                <option value="open">Abiertas</option>
                <option value="solved">Resueltas</option>
              </select>

              <select
                aria-label="Ordenar publicaciones"
                className="ia-select"
                style={{ width: 'auto', minWidth: '165px' }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'popular' | 'activity')}
              >
                <option value="recent">Más recientes</option>
                <option value="activity">Actividad reciente</option>
                <option value="popular">Más votadas</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={selectedCategory === cat ? 'ia-btn-primary' : 'ia-btn-secondary'}
                  style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="ia-content-grid">
            <section>
              {loading ? (
                <div className="ia-card" style={{ textAlign: 'center', padding: '32px' }}>
                  <p style={{ color: 'var(--ia-text-muted)', margin: 0 }}>Cargando publicaciones del foro...</p>
                </div>
              ) : visibleQuestions.length === 0 ? (
                <div className="ia-empty-box">
                  <div className="ia-empty-icon">
                    <BookOpenIcon size={20} />
                  </div>
                  <p className="ia-empty-title">No hay consultas que coincidan con tu búsqueda</p>
                  <p className="ia-empty-desc">
                    Publica la primera pregunta o ajusta los filtros para explorar otras categorías académicas.
                  </p>
                  <button type="button" className="ia-btn-primary" onClick={openCreateModal}>
                    <PlusIcon size={15} color="#ffffff" /> Crear consulta ahora
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {visibleQuestions.map((q) => {
                    const isOwner = Boolean(user?.id && q.authorId === user.id);
                    const typeMeta = q.postType ? POST_TYPE_LABELS[q.postType] : null;

                    return (
                      <article
                        key={q.id}
                        className="ia-card"
                        style={{ marginBottom: 0, cursor: 'pointer', transition: 'border-color 0.15s ease' }}
                        onClick={() => openThread(q)}
                      >
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                          {/* Columna de votos */}
                          <button
                            type="button"
                            onClick={(e) => handleVote(q, e)}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '54px',
                              padding: '8px 6px',
                              borderRadius: '10px',
                              border: q.hasVoted
                                ? '1px solid var(--ia-primary)'
                                : '1px solid var(--ia-border)',
                              background: q.hasVoted
                                ? 'var(--ia-primary-subtle)'
                                : 'var(--ia-bg-subtle)',
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                            title="Votar consulta útil"
                          >
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ia-primary)' }}>▲</span>
                            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--ia-text-main)' }}>
                              {q.votesCount}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--ia-text-muted)' }}>votos</span>
                          </button>

                          {/* Contenido principal */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {typeMeta && (
                                  <span
                                    className="ia-badge"
                                    style={{
                                      background: isCalmMode ? 'var(--ia-bg-subtle)' : typeMeta.bg,
                                      color: isCalmMode ? 'var(--ia-text-body)' : typeMeta.color,
                                      border: `1px solid ${isCalmMode ? 'var(--ia-border)' : typeMeta.border}`,
                                    }}
                                  >
                                    {typeMeta.label}
                                  </span>
                                )}
                                <span className="ia-badge ia-badge-blue">{q.category}</span>
                                {q.isSolved ? (
                                  <span className="ia-badge ia-badge-success">
                                    <CheckIcon size={12} /> Resuelta
                                  </span>
                                ) : (
                                  <span className="ia-badge ia-badge-amber">Abierta</span>
                                )}
                                <span style={{ fontSize: '0.76rem', color: 'var(--ia-text-muted)' }}>
                                  {q.timeAgo}
                                </span>
                              </div>

                              {isOwner && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="ia-btn-secondary"
                                    style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                    onClick={(e) => openEditModal(q, e)}
                                  >
                                    <EditIcon size={13} /> Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="ia-btn-icon-danger"
                                    onClick={() => setPostToDelete(q)}
                                    title="Eliminar publicación"
                                  >
                                    <TrashIcon size={14} />
                                  </button>
                                </div>
                              )}
                            </div>

                            <h2 style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--ia-text-main)', margin: '0 0 6px 0' }}>
                              {q.title}
                            </h2>
                            <p style={{ fontSize: '0.86rem', color: 'var(--ia-text-body)', margin: '0 0 10px 0', lineHeight: 1.45 }}>
                              {q.description.length > 240 ? `${q.description.slice(0, 240)}...` : q.description}
                            </p>

                            <div className="ia-tags-cloud" style={{ marginBottom: '10px' }}>
                              {q.tags.map((tag) => (
                                <span key={tag} className="ia-tag" style={{ fontSize: '0.74rem', padding: '2px 8px' }}>
                                  #{tag}
                                </span>
                              ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid var(--ia-border)', paddingTop: '10px' }}>
                              <span style={{ fontSize: '0.78rem', color: 'var(--ia-text-muted)' }} onClick={(e) => e.stopPropagation()}>
                                Por{' '}
                                {q.authorId ? (
                                  <Link
                                    to={`/profile/${q.authorId}`}
                                    style={{ color: 'var(--ia-primary)', fontWeight: 600, textDecoration: 'none' }}
                                  >
                                    {q.author}
                                  </Link>
                                ) : (
                                  <strong style={{ color: 'var(--ia-text-body)' }}>{q.author}</strong>
                                )}{' '}
                                · {q.authorInstitution}
                              </span>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ia-primary)' }}>
                                💬 {q.repliesCount} {q.repliesCount === 1 ? 'respuesta' : 'respuestas'} · Ver hilo →
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  {questions.length > visibleCount && (
                    <div style={{ textAlign: 'center', marginTop: '8px' }}>
                      <button
                        type="button"
                        className="ia-btn-secondary"
                        onClick={() => setVisibleCount((prev) => prev + BUSINESS_RULES.FORUM.PAGE_SIZE)}
                      >
                        Cargar más publicaciones ({questions.length - visibleCount} restantes)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Columna derecha: Guía y accesos */}
            <aside>
              <div className="ia-card">
                <div className="ia-card-header">
                  <h2 className="ia-card-title">
                    <AwardIcon size={18} color="#15803d" />
                    Normas de la Comunidad
                  </h2>
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.83rem', color: 'var(--ia-text-body)', lineHeight: 1.65 }}>
                  <li>Comparte el contexto de tu problema y lo que ya intentaste resolver.</li>
                  <li>Usa etiquetas precisas del ramo o tecnología para recibir ayuda rápida.</li>
                  <li>Si una respuesta soluciona tu duda, márcala como <strong>Solución Aceptada</strong>.</li>
                  <li>Respeta la autoría académica y fomenta el aprendizaje paso a paso.</li>
                </ul>
              </div>

              <div className="ia-card">
                <div className="ia-card-header">
                  <h2 className="ia-card-title"> ¿Necesitas apoyo en vivo?</h2>
                </div>
                <p style={{ fontSize: '0.83rem', color: 'var(--ia-text-muted)', margin: '0 0 12px 0', lineHeight: 1.45 }}>
                  Si tu consulta requiere revisar código en conjunto o preparar un certamen completo, solicita una mentoría 1 a 1 o revisa los apuntes de la comunidad.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Link to="/tutoring" className="ia-btn-primary" style={{ width: '100%' }}>
                    Buscar Tutor Certificado
                  </Link>
                  <Link to="/resources" className="ia-btn-secondary" style={{ width: '100%' }}>
                    Explorar Biblioteca de Apuntes
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
