import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  messagingService,
  type DirectConversation,
  type DirectMessage,
  type DirectParticipant,
} from '../../services/messaging.service';
import {
  AlertCircleIcon,
  CheckIcon,
  MessageSquareIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from '../../components/common/Icons';
import '../../styles/messages.css';

const CONTEXT_LABELS: Record<'general' | 'tutoring' | 'project', string> = {
  general: 'Académico',
  tutoring: 'Tutoría',
  project: 'Proyecto',
};

function formatMessageTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  return sameDay
    ? date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Messages() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [realtimeLive, setRealtimeLive] = useState(false);
  const [error, setError] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');

  // Modal de nueva conversación
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState('');
  const [contacts, setContacts] = useState<DirectParticipant[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [newContext, setNewContext] = useState<'general' | 'tutoring' | 'project'>('general');

  const feedEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    setError('');
    try {
      const data = await messagingService.listConversations();
      setConversations(data);
      const requestedConv = searchParams.get('conversation');
      if (requestedConv && data.some((c) => c.id === requestedConv)) {
        setActiveId(requestedConv);
        setMobileView('thread');
      } else if (!activeId && data.length > 0) {
        setActiveId(data[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'No pudimos cargar tus conversaciones. Intenta actualizar.');
    } finally {
      setLoadingList(false);
    }
  }, [activeId, searchParams]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // Deep link /messages?to=<userId>&context=tutoring|project
  useEffect(() => {
    const to = searchParams.get('to');
    if (!to || !user || to === user.id) return;
    const ctxParam = searchParams.get('context');
    const contextType = ctxParam === 'tutoring' || ctxParam === 'project' ? ctxParam : 'general';
    const label = searchParams.get('label') || undefined;
    let active = true;
    messagingService
      .createOrOpenConversation({ recipient_id: to, context_type: contextType, context_label: label })
      .then((conv) => {
        if (!active) return;
        setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
        setActiveId(conv.id);
        setMobileView('thread');
        setSearchParams({ conversation: conv.id }, { replace: true });
      })
      .catch((err: any) => {
        if (active) setError(err?.message || 'No pudimos abrir la conversación solicitada.');
      });
    return () => {
      active = false;
    };
  }, [searchParams, user, setSearchParams]);

  // Cargar mensajes + suscripción Realtime de la conversación activa
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setRealtimeLive(false);
      return;
    }
    let live = true;
    setLoadingThread(true);
    setError('');

    messagingService
      .getMessages(activeId)
      .then((rows) => {
        if (!live) return;
        setMessages(rows);
        void messagingService
          .markAsRead(activeId)
          .then(() => {
            if (!live) return;
            setConversations((prev) => prev.map((c) => (c.id === activeId ? { ...c, unread_count: 0 } : c)));
            window.dispatchEvent(new Event('interaula:inbox-change'));
          })
          .catch(() => {});
      })
      .catch((err: any) => {
        if (live) setError(err?.message || 'No pudimos cargar los mensajes de esta conversación.');
      })
      .finally(() => {
        if (live) setLoadingThread(false);
      });

    const unsubscribe = messagingService.subscribeToConversation(
      activeId,
      (incoming) => {
        setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        setConversations((prev) =>
          prev
            .map((c) =>
              c.id === activeId
                ? {
                    ...c,
                    last_message_at: incoming.created_at,
                    last_message_preview: incoming.body.slice(0, 160),
                    unread_count: incoming.sender_id === user?.id ? c.unread_count : 0,
                  }
                : c
            )
            .sort((a, b) => Date.parse(b.last_message_at) - Date.parse(a.last_message_at))
        );
        if (incoming.sender_id !== user?.id) {
          void messagingService.markAsRead(activeId).catch(() => {});
        }
      },
      (updated) => {
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      },
      (status) => {
        setRealtimeLive(status === 'SUBSCRIBED');
      }
    );

    return () => {
      live = false;
      unsubscribe();
    };
  }, [activeId, user?.id]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (!newChatOpen) return;
    let active = true;
    setLoadingContacts(true);
    messagingService
      .searchContacts(contactQuery)
      .then((rows) => {
        if (active) setContacts(rows);
      })
      .catch(() => {
        if (active) setContacts([]);
      })
      .finally(() => {
        if (active) setLoadingContacts(false);
      });
    return () => {
      active = false;
    };
  }, [newChatOpen, contactQuery]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.other_participant.display_name.toLowerCase().includes(q) ||
        c.last_message_preview.toLowerCase().includes(q) ||
        (c.context_label || '').toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const activeConversation = conversations.find((c) => c.id === activeId) || null;
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!activeId || !draft.trim() || sending) return;
    setSending(true);
    setError('');
    const body = draft.trim();
    try {
      const sent = await messagingService.sendMessage(activeId, body);
      setDraft('');
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setConversations((prev) =>
        prev
          .map((c) =>
            c.id === activeId
              ? { ...c, last_message_at: sent.created_at, last_message_preview: sent.body.slice(0, 160) }
              : c
          )
          .sort((a, b) => Date.parse(b.last_message_at) - Date.parse(a.last_message_at))
      );
    } catch (err: any) {
      setError(err?.message || 'No pudimos enviar el mensaje. Tu texto se conservó para reintentar.');
    } finally {
      setSending(false);
    }
  }

  async function handleStartWithContact(contact: DirectParticipant) {
    setError('');
    try {
      const conv = await messagingService.createOrOpenConversation({
        recipient_id: contact.id,
        context_type: newContext,
      });
      setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
      setActiveId(conv.id);
      setMobileView('thread');
      setNewChatOpen(false);
      setContactQuery('');
    } catch (err: any) {
      setError(err?.message || 'No pudimos iniciar la conversación.');
    }
  }

  return (
    <div className="ia-messages-page">
      <header className="ia-messages-header">
        <div>
          <h1>Mensajería</h1>
          <p>
            Coordina tutorías, dudas académicas y equipos de proyectos en tiempo real.
            {totalUnread > 0 ? ` · ${totalUnread} sin leer` : ''}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/support" className="ia-btn-secondary">
            Avisos y notificaciones
          </Link>
          <button type="button" className="ia-btn-primary" onClick={() => setNewChatOpen(true)}>
            <PlusIcon size={16} />
            <span>Nueva conversación</span>
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="ia-assess-alert ia-assess-alert--error">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircleIcon size={18} />
            <span>{error}</span>
          </div>
          <button type="button" className="ia-btn-secondary" onClick={() => void loadConversations()}>
            Reintentar
          </button>
        </div>
      )}

      <div className="ia-messages-shell" data-mobile-view={mobileView}>
        {/* Lista de conversaciones */}
        <aside className="ia-messages-sidebar" aria-label="Lista de conversaciones">
          <div className="ia-messages-search">
            <SearchIcon size={16} color="var(--ia-text-muted)" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar conversación o tema..."
              aria-label="Buscar conversaciones"
            />
          </div>

          {loadingList ? (
            <div className="ia-messages-empty">
              <p>Cargando conversaciones...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="ia-messages-empty">
              <MessageSquareIcon size={28} />
              <h3>Sin conversaciones aún</h3>
              <p>Inicia un chat con un tutor, estudiante o integrante de proyecto.</p>
            </div>
          ) : (
            <ul className="ia-messages-list">
              {filteredConversations.map((conv) => (
                <li key={conv.id}>
                  <button
                    type="button"
                    className="ia-messages-conv-btn"
                    data-active={conv.id === activeId}
                    onClick={() => {
                      setActiveId(conv.id);
                      setMobileView('thread');
                    }}
                  >
                    <span className="ia-messages-avatar" aria-hidden="true">
                      {conv.other_participant.avatar_url ? (
                        <img src={conv.other_participant.avatar_url} alt="" />
                      ) : (
                        conv.other_participant.display_name.charAt(0).toUpperCase()
                      )}
                    </span>

                    <div className="ia-messages-conv-info">
                      <div className="ia-messages-conv-top">
                        <span className="ia-messages-conv-name">{conv.other_participant.display_name}</span>
                        <time className="ia-messages-conv-time" dateTime={conv.last_message_at}>
                          {formatMessageTime(conv.last_message_at)}
                        </time>
                      </div>
                      <div className="ia-messages-conv-bottom">
                        <span className="ia-messages-conv-preview">
                          {conv.last_message_preview || 'Conversación iniciada'}
                        </span>
                        {conv.unread_count > 0 && (
                          <span className="ia-messages-unread-badge" aria-label={`${conv.unread_count} sin leer`}>
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <span className="ia-messages-context-tag">
                        {conv.context_label || CONTEXT_LABELS[conv.context_type]}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Conversación activa */}
        <section className="ia-messages-thread" aria-label="Mensajes de la conversación">
          {!activeConversation ? (
            <div className="ia-messages-empty">
              <MessageSquareIcon size={34} />
              <h3>Selecciona una conversación</h3>
              <p>
                Elige un chat de la columna izquierda o crea uno nuevo para coordinar tus tutorías y actividades
                académicas.
              </p>
              <button type="button" className="ia-btn-primary" onClick={() => setNewChatOpen(true)}>
                Iniciar conversación
              </button>
            </div>
          ) : (
            <>
              <header className="ia-messages-thread-header">
                <div className="ia-messages-thread-peer">
                  <button
                    type="button"
                    className="ia-btn-secondary ia-messages-mobile-back"
                    onClick={() => setMobileView('list')}
                  >
                    Conversaciones
                  </button>
                  <span className="ia-messages-avatar" aria-hidden="true">
                    {activeConversation.other_participant.avatar_url ? (
                      <img src={activeConversation.other_participant.avatar_url} alt="" />
                    ) : (
                      activeConversation.other_participant.display_name.charAt(0).toUpperCase()
                    )}
                  </span>
                  <div>
                    <h2>
                      <Link
                        to={`/profile/${activeConversation.other_participant.id}`}
                        style={{ color: 'inherit', textDecoration: 'none' }}
                      >
                        {activeConversation.other_participant.display_name}
                      </Link>
                    </h2>
                    <small>
                      {activeConversation.context_label || CONTEXT_LABELS[activeConversation.context_type]}
                      {activeConversation.other_participant.career
                        ? ` · ${activeConversation.other_participant.career}`
                        : ''}
                    </small>
                  </div>
                </div>

                <span className="ia-messages-realtime-pill" data-live={realtimeLive}>
                  {realtimeLive ? 'En tiempo real' : 'Sincronizado'}
                </span>
              </header>

              <div className="ia-messages-feed">
                {loadingThread ? (
                  <div className="ia-messages-empty">
                    <p>Cargando historial...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="ia-messages-empty">
                    <p>Todavía no hay mensajes en esta conversación. Escribe el primero abajo.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className="ia-msg-row" data-mine={isMine}>
                        <div className="ia-msg-bubble">{msg.body}</div>
                        <span className="ia-msg-meta">
                          <time dateTime={msg.created_at}>{formatMessageTime(msg.created_at)}</time>
                          {isMine && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <CheckIcon size={12} />
                              {msg.read_at ? 'Leído' : 'Enviado'}
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={feedEndRef} />
              </div>

              <form className="ia-messages-composer" onSubmit={handleSend}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend(e);
                    }
                  }}
                  placeholder="Escribe tu mensaje... (Enter para enviar)"
                  maxLength={2000}
                  rows={1}
                  aria-label="Escribir mensaje"
                  disabled={sending}
                />
                <button type="submit" className="ia-btn-primary" disabled={sending || !draft.trim()}>
                  {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      {/* Modal nueva conversación */}
      {newChatOpen && (
        <div className="ia-messages-modal-backdrop" role="dialog" aria-modal="true" aria-label="Nueva conversación">
          <div className="ia-messages-modal">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Nueva conversación</h2>
              <button
                type="button"
                className="ia-assess-close-btn"
                aria-label="Cerrar"
                onClick={() => setNewChatOpen(false)}
              >
                <XIcon size={16} />
              </button>
            </div>

            <div>
              <label className="ia-label" htmlFor="msg-context">
                Motivo del chat
              </label>
              <select
                id="msg-context"
                className="ia-input"
                value={newContext}
                onChange={(e) => setNewContext(e.target.value as 'general' | 'tutoring' | 'project')}
              >
                <option value="general">Coordinación académica</option>
                <option value="tutoring">Tutorías y apoyo</option>
                <option value="project">Proyectos y equipos</option>
              </select>
            </div>

            <div>
              <label className="ia-label" htmlFor="msg-contact-search">
                Buscar integrante de la comunidad
              </label>
              <input
                id="msg-contact-search"
                type="search"
                className="ia-input"
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Nombre, carrera o institución..."
              />
            </div>

            <div className="ia-messages-contact-list">
              {loadingContacts ? (
                <p style={{ margin: '8px 0', color: 'var(--ia-text-muted)', fontSize: '0.86rem' }}>
                  Buscando personas...
                </p>
              ) : contacts.length === 0 ? (
                <p style={{ margin: '8px 0', color: 'var(--ia-text-muted)', fontSize: '0.86rem' }}>
                  No encontramos coincidencias. Prueba con otro nombre o carrera.
                </p>
              ) : (
                contacts.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    className="ia-messages-contact-item"
                    onClick={() => void handleStartWithContact(person)}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{person.display_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--ia-text-muted)' }}>
                        {[person.career, person.institution].filter(Boolean).join(' · ') || 'Comunidad InterAula'}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ia-primary)' }}>Abrir chat</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
