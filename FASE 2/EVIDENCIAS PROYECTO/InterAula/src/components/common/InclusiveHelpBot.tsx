import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SparklesIcon,
  XIcon,
  SendIcon,
  ExternalLinkIcon,
} from './Icons';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  steps?: string[];
  actionLink?: {
    label: string;
    path: string;
  };
  timestamp: string;
}

interface QuickOption {
  id: string;
  label: string;
  query: string;
}

const QUICK_OPTIONS: QuickOption[] = [
  {
    id: 'opt_find_tutor',
    label: '¿Cómo busco una tutoría?',
    query: 'como busco una tutoria',
  },
  {
    id: 'opt_certify',
    label: '¿Cómo me certifico como tutor?',
    query: 'como me certifico',
  },
  {
    id: 'opt_virtual_room',
    label: '¿Cómo entrar al aula virtual?',
    query: 'como entrar al aula virtual',
  },
  {
    id: 'opt_calm_mode',
    label: 'Modo Calma y Estudio sin Estrés',
    query: 'modo calma estudio',
  },
  {
    id: 'opt_edit_profile',
    label: '¿Dónde configuro mis preferencias?',
    query: 'donde configuro mis preferencias',
  },
];

// Base de conocimiento estructurada y accesible para orientación y accesibilidad cognitiva
function getBotAnswer(query: string): {
  text: string;
  steps?: string[];
  actionLink?: { label: string; path: string };
} {
  const q = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (q.includes('busc') || q.includes('encontrar') || q.includes('tutoria') || q.includes('ramo') || q.includes('materia')) {
    return {
      text: 'Para buscar y solicitar una tutoría académica, sigue estos sencillos pasos:',
      steps: [
        'Paso 1: Dirígete a la sección "Explorar Tutorías" en la barra superior.',
        'Paso 2: Usa la barra de búsqueda o los filtros para elegir tu asignatura (ej: Algoritmos o Bases de Datos).',
        'Paso 3: Revisa el perfil del tutor (puedes ver si cuenta con sello oficial Duoc UC o habilitación comunitaria).',
        'Paso 4: Haz clic en "Solicitar Tutoría" o inscríbete en uno de sus talleres programados.',
      ],
      actionLink: {
        label: 'Ir a Explorar Tutorías',
        path: '/tutoring',
      },
    };
  }

  if (q.includes('certif') || q.includes('acredit') || q.includes('oficial') || q.includes('comunitario') || q.includes('evaluacion') || q.includes('test')) {
    return {
      text: 'En InterAula existen dos vías de acreditación claramente separadas para garantizar la calidad docente:',
      steps: [
        'Vía 1 (Tutor Comunitario): Ingresa a tu Perfil y haz clic en "Rendir Evaluación de Tutor". Consiste en una prueba interactiva de 10 preguntas (15 segundos en alternativas y 45 segundos en desarrollo) con nuestro Asistente Evaluador para demostrar tus conocimientos de forma inmediata.',
        'Vía 2 (Tutor Certificado Duoc UC): Sube tu Concentración de Notas oficial emitida por Duoc UC (nota final 5.5 o superior) o solicita validación directa a tu docente titular para recibir el sello institucional oficial.',
      ],
      actionLink: {
        label: 'Ir a Mi Perfil y Certificaciones',
        path: '/profile',
      },
    };
  }

  if (q.includes('aula') || q.includes('sala') || q.includes('video') || q.includes('camara') || q.includes('reunion') || q.includes('jitsi')) {
    return {
      text: 'Para unirte y participar en la sala virtual de tutoría:',
      steps: [
        'Paso 1: Ve a la pestaña "Mis Tutorías" en el menú de navegación.',
        'Paso 2: En la lista de sesiones agendadas, busca tu sesión actual y pulsa el botón "Ingresar a la Sala".',
        'Paso 3: Se abrirá el Aula Virtual con videollamada segura, pizarra interactiva y chat en tiempo real.',
        'Nota de tranquilidad: Si la cámara te resulta cansadora, puedes apagarla en cualquier momento y participar solo por voz o mediante el chat de texto.',
      ],
      actionLink: {
        label: 'Ir a Mis Tutorías',
        path: '/my-tutoring',
      },
    };
  }

  if (q.includes('calma') || q.includes('estres') || q.includes('nervios') || q.includes('abrumad') || q.includes('ansied') || q.includes('paciencia') || q.includes('paso a paso') || q.includes('sensorial') || q.includes('ruido')) {
    return {
      text: 'Comprendo perfectamente cómo te sientes. En la universidad es normal sentirse sobreestimulado o necesitar que las cosas se expliquen con mayor calma. En InterAula hemos preparado estas opciones para ti:',
      steps: [
        '1. Preferencias de Aprendizaje: Puedes activar en tu perfil el "Modo Calma y Baja Estimulación" y la opción de "Explicaciones Paso a Paso con Estructura Clara".',
        '2. Los tutores verán tus preferencias antes de la sesión para preparar explicaciones visuales, tranquilas y sin prisas.',
        '3. En la sala de tutoría puedes acordar pausas breves de 5 minutos cuando sientas fatiga o sobrecarga mental.',
        'Recuerda: Avanza a tu propio ritmo. Cada paso cuenta.',
      ],
      actionLink: {
        label: 'Configurar Preferencias de Calma en Mi Perfil',
        path: '/profile?tab=learning',
      },
    };
  }

  if (q.includes('preferenc') || q.includes('estilo') || q.includes('configur') || q.includes('perfil') || q.includes('editar')) {
    return {
      text: 'Para personalizar cómo aprendes y qué tipo de explicaciones prefieres:',
      steps: [
        'Paso 1: Entra a tu perfil y dirígete al apartado "Mi Aprendizaje y Necesidades".',
        'Paso 2: En la sección "Preferencia de Aprendizaje y Estilo de Estudio", selecciona las opciones que te acomoden.',
        'Paso 3: Activa etiquetas como "Modo Calma y Baja Estimulación", "Explicaciones Paso a Paso" o "Apoyo Textual y Esquemas Visuales".',
        'Paso 4: Los cambios se guardan automáticamente para que tus tutores conozcan tu estilo.',
      ],
      actionLink: {
        label: 'Ver Preferencias en Mi Perfil',
        path: '/profile?tab=learning',
      },
    };
  }

  // Respuesta general guiada
  return {
    text: `He recibido tu consulta sobre "${query}". Aquí tienes los accesos directos principales de InterAula para ayudarte:`,
    steps: [
      '1. Explorar Tutorías: para buscar compañeros que enseñen las materias que necesitas.',
      '2. Mis Tutorías: para ver tus clases programadas e ingresar a la sala virtual.',
      '3. Mi Perfil: para gestionar tus asignaturas, rendir la evaluación técnica de tutor o subir tu concentración de notas de Duoc UC.',
      '4. Puedes hacer clic en cualquiera de las sugerencias rápidas abajo para recibir instrucciones paso a paso.',
    ],
    actionLink: {
      label: 'Ir a Mi Panel Principal',
      path: '/dashboard',
    },
  };
}

export default function InclusiveHelpBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const [isCalmFontMode, setIsCalmFontMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: '¡Hola! Soy tu Asistente Guía de InterAula. Mi función es orientarte con calma, paso a paso y de manera clara para que sepas dónde encontrar cada función y cómo usar la plataforma sin complicaciones.',
      steps: [
        '¿Tienes dudas sobre cómo pedir una tutoría?',
        '¿Quieres saber cómo certificarte o rendir la evaluación técnica?',
        '¿Deseas activar el modo de estudio tranquilo y con explicaciones paso a paso?',
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Manejo de lectura en voz alta (Web Speech API para accesibilidad auditiva)
  const handleToggleSpeak = (textToRead: string) => {
    if (!('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = 'es-CL';
    utterance.rate = 0.95; // Velocidad ligeramente pausada para comprensión óptima
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || inputQuery.trim();
    if (!query) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const answer = getBotAnswer(query);

    const botMsg: Message = {
      id: `bot_${Date.now()}`,
      sender: 'bot',
      text: answer.text,
      steps: answer.steps,
      actionLink: answer.actionLink,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInputQuery('');
  };

  return (
    <>
      {/* BOTÓN FLOTANTE INFERIOR DERECHO */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9900,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            border: '2px solid #2563eb',
            borderRadius: '30px',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.4), 0 8px 10px -6px rgba(37, 99, 235, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 15px 30px -5px rgba(37, 99, 235, 0.45)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(15, 23, 42, 0.4), 0 8px 10px -6px rgba(37, 99, 235, 0.3)';
          }}
          title="Abrir Asistente Guía de Orientación Paso a Paso"
        >
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SparklesIcon size={15} color="#ffffff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: '0.88rem', letterSpacing: '0.2px' }}>
            Guía y Ayuda Paso a Paso
          </span>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              display: 'inline-block',
            }}
            title="Asistente activo"
          />
        </button>
      )}

      {/* VENTANA CHATBOT FLOTANTE */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '92vw',
            maxWidth: '430px',
            height: '600px',
            maxHeight: '85vh',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
            border: '1.5px solid #cbd5e1',
            zIndex: 9901,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* ENCABEZADO */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #1e293b',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SparklesIcon size={18} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Asistente Guía InterAula</span>
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      display: 'inline-block',
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  Orientación amigable y apoyo paso a paso
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Botón Modo Calma / Fuente legible */}
              <button
                type="button"
                onClick={() => setIsCalmFontMode(!isCalmFontMode)}
                style={{
                  backgroundColor: isCalmFontMode ? '#1e293b' : 'transparent',
                  border: `1px solid ${isCalmFontMode ? '#38bdf8' : '#334155'}`,
                  color: isCalmFontMode ? '#38bdf8' : '#94a3b8',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Alternar modo lectura pausada y accesible"
              >
                {isCalmFontMode ? 'Modo Calma: Activo' : 'Modo Calma'}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isSpeaking) window.speechSynthesis.cancel();
                  setIsSpeaking(false);
                  setIsOpen(false);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Cerrar asistente"
              >
                <XIcon size={18} />
              </button>
            </div>
          </div>

          {/* CUERPO DEL CHAT */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              backgroundColor: isCalmFontMode ? '#fdfbf7' : '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              fontSize: isCalmFontMode ? '0.94rem' : '0.86rem',
              lineHeight: isCalmFontMode ? 1.65 : 1.45,
            }}
          >
            {messages.map((m) => {
              if (m.sender === 'bot') {
                const fullTextToRead = `${m.text} ${m.steps ? m.steps.join('. ') : ''}`;
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      maxWidth: '92%',
                      gap: '4px',
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '14px',
                        borderTopLeftRadius: '4px',
                        padding: '12px 14px',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)',
                        color: '#0f172a',
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: m.steps ? '6px' : 0 }}>
                        {m.text}
                      </div>

                      {m.steps && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                          {m.steps.map((st, sIdx) => (
                            <div
                              key={sIdx}
                              style={{
                                padding: '6px 10px',
                                backgroundColor: isCalmFontMode ? '#f8fafc' : '#f1f5f9',
                                borderRadius: '8px',
                                borderLeft: '3px solid #2563eb',
                                fontSize: '0.82rem',
                                color: '#334155',
                              }}
                            >
                              {st}
                            </div>
                          ))}
                        </div>
                      )}

                      {m.actionLink && (
                        <div style={{ marginTop: '10px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              navigate(m.actionLink!.path);
                              setIsOpen(false);
                            }}
                            className="ia-btn-primary"
                            style={{
                              padding: '6px 14px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span>{m.actionLink.label}</span>
                            <ExternalLinkIcon size={12} color="#ffffff" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '4px' }}>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{m.timestamp}</span>
                      {'speechSynthesis' in window && (
                        <button
                          type="button"
                          onClick={() => handleToggleSpeak(fullTextToRead)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: isSpeaking ? '#2563eb' : '#64748b',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0,
                            textDecoration: 'underline',
                          }}
                          title="Escuchar explicación en voz pausada"
                        >
                          {isSpeaking ? 'Detener lectura' : 'Escuchar en voz alta'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              } else {
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        padding: '10px 14px',
                        borderRadius: '14px',
                        borderTopRightRadius: '4px',
                        maxWidth: '85%',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                      }}
                    >
                      {m.text}
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px', paddingRight: '4px' }}>
                      {m.timestamp}
                    </span>
                  </div>
                );
              }
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* CHIPS DE ACCESO RÁPIDO */}
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {QUICK_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSendMessage(opt.query)}
                style={{
                  padding: '5px 10px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '20px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.backgroundColor = '#eff6ff';
                  e.currentTarget.style.color = '#1d4ed8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#334155';
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* CAJA DE ENTRADA */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{
              padding: '12px 14px',
              backgroundColor: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Escribe tu consulta o duda aquí..."
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.84rem',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#2563eb';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            />
            <button
              type="submit"
              disabled={!inputQuery.trim()}
              className="ia-btn-primary"
              style={{
                padding: '9px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                opacity: inputQuery.trim() ? 1 : 0.5,
              }}
              title="Enviar consulta"
            >
              <SendIcon size={16} color="#ffffff" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
