import React, { useState, useEffect, useMemo } from 'react';
import { type AdaptiveExplanation, type ExplanationMode } from '../../types/learningSpace';
import {
  CheckCircleIcon,
  LightbulbIcon,
  LayersIcon,
  PlayIcon,
  RotateCcwIcon,
  SparklesIcon,
  TargetIcon,
  ArrowRightIcon,
} from '../common/Icons';

interface InteractiveVisualExplainLabProps {
  explanationData: AdaptiveExplanation;
  activeMode: ExplanationMode;
  onModeSwitch: (mode: ExplanationMode) => void;
  onMasteryVerified?: () => void;
}

interface DraggableBlockItem {
  id: string;
  label: string;
  detail: string;
  correctSlotId: 'input' | 'process' | 'validation' | 'output';
  categoryTag: string;
}

interface BlueprintSlot {
  id: 'input' | 'process' | 'validation' | 'output';
  stepNumber: number;
  title: string;
  subtitle: string;
  accentColor: string;
  bgSoft: string;
  hint: string;
}

const BLUEPRINT_SLOTS: BlueprintSlot[] = [
  {
    id: 'input',
    stepNumber: 1,
    title: 'Bloque de Entrada',
    subtitle: 'Datos iniciales, contexto y supuestos',
    accentColor: '#2563eb',
    bgSoft: 'rgba(37, 99, 235, 0.08)',
    hint: 'Aquí va lo que recibimos o identificamos antes de aplicar la regla principal.',
  },
  {
    id: 'process',
    stepNumber: 2,
    title: 'Motor de Transformación',
    subtitle: 'Regla central, operación o estructura',
    accentColor: '#7c3aed',
    bgSoft: 'rgba(124, 58, 237, 0.08)',
    hint: 'Aquí actúa el núcleo del concepto que procesa o transforma la entrada.',
  },
  {
    id: 'validation',
    stepNumber: 3,
    title: 'Control y Caso Borde',
    subtitle: 'Condición de verificación y prevención de errores',
    accentColor: '#d97706',
    bgSoft: 'rgba(217, 119, 6, 0.08)',
    hint: 'Aquí comprobamos si se cumple la condición o si debemos retroceder a ajustar.',
  },
  {
    id: 'output',
    stepNumber: 4,
    title: 'Bloque de Salida',
    subtitle: 'Resultado estructurado y verificable',
    accentColor: '#059669',
    bgSoft: 'rgba(5, 150, 105, 0.08)',
    hint: 'Aquí obtenemos la solución lista para aplicar, probar o entregar.',
  },
];

function cleanBracketSyntax(raw: string): string {
  return raw
    .replace(/^\[+--->?\s*\[*/g, '')
    .replace(/^\[+/g, '')
    .replace(/\]+$/g, '')
    .replace(/--->/g, '→')
    .replace(/->/g, '→')
    .trim();
}

export const InteractiveVisualExplainLab: React.FC<InteractiveVisualExplainLabProps> = ({
  explanationData,
  activeMode,
  onModeSwitch,
  onMasteryVerified,
}) => {
  // Estado para el simulador interactivo de flujo de nodos
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number>(0);
  const [simulationFlow, setSimulationFlow] = useState<'idle' | 'normal' | 'feedback_loop'>('normal');
  const [activePulseStep, setActivePulseStep] = useState<number>(0);

  // Estado para el constructor arrastrable de bloques (Drag & Drop + Click)
  const [placedBlocks, setPlacedBlocks] = useState<Record<string, DraggableBlockItem | null>>({
    input: null,
    process: null,
    validation: null,
    output: null,
  });
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);
  const [selectedBankBlockId, setSelectedBankBlockId] = useState<string | null>(null);
  const [verificationState, setVerificationState] = useState<'none' | 'partial' | 'success'>('none');
  const [showSlotHints, setShowSlotHints] = useState<boolean>(false);
  const [shuffleSeed, setShuffleSeed] = useState<number>(1);

  // Construir nodos visuales limpios a partir de explanationData
  const visualNodes = useMemo(() => {
    const { topic, subject_name } = explanationData;
    return [
      {
        id: 'node-input',
        badge: 'Fase 1 · Entrada',
        title: 'Datos y Requisitos Iniciales',
        color: '#2563eb',
        summary: `Identificamos las variables, datos de origen y restricciones del problema en ${subject_name}.`,
        whatGoesHere: [
          `Datos sin procesar relacionados con "${topic}"`,
          'Supuestos iniciales y formato esperado',
          'Objetivo concreto que buscamos resolver',
        ],
      },
      {
        id: 'node-process',
        badge: 'Fase 2 · Transformación',
        title: `Núcleo: ${topic}`,
        color: '#7c3aed',
        summary: `Aplicamos la estructura o regla principal de "${topic}" paso a paso sobre los datos de entrada.`,
        whatGoesHere: [
          `Secuencia lógica o regla operativa de ${topic}`,
          'Descomposición en subproblemas simples',
          'Transformación de datos crudos en estructura',
        ],
      },
      {
        id: 'node-check',
        badge: 'Fase 3 · Control',
        title: ' Compuerta de Validación',
        color: '#d97706',
        summary: 'Verificamos casos borde y condiciones antes de dar por buena la salida.',
        whatGoesHere: [
          '¿Cumple la condición de término o integridad?',
          'Si hay error → retroalimentar a Fase 1',
          'Prueba rápida con un caso límite o vacío',
        ],
      },
      {
        id: 'node-output',
        badge: 'Fase 4 · Salida',
        title: 'Resultado Verificable',
        color: '#059669',
        summary: `Solución estructurada y comprobada en ${subject_name}, lista para usar o entregar.`,
        whatGoesHere: [
          'Salida validada y trazable',
          'Respuesta coherente con el objetivo inicial',
          'Lista para conectarse con el siguiente tema',
        ],
      },
    ];
  }, [explanationData]);

  // Generar los bloques arrastrables adaptados al tema actual (provenientes de IA o variantes dinámicas)
  const bankBlocks = useMemo(() => {
    const { topic, subject_name, draggable_blocks } = explanationData;

    const variantPools: DraggableBlockItem[][] = [
      [
        {
          id: 'blk-input-v1',
          label: `Definir entradas y variables iniciales en ${subject_name}`,
          detail: `Identificar qué datos recibe "${topic}" y qué formato tienen antes de procesarlos.`,
          correctSlotId: 'input',
          categoryTag: 'Contexto / Input',
        },
        {
          id: 'blk-process-v1',
          label: `Aplicar la regla central de ${topic}`,
          detail: `Ejecutar la transformación paso a paso que convierte los datos iniciales en una solución estructurada.`,
          correctSlotId: 'process',
          categoryTag: 'Regla / Motor',
        },
        {
          id: 'blk-validation-v1',
          label: `Evaluar condición de control y casos borde`,
          detail: `Comprobar si el resultado intermedio cumple las restricciones o si debe volver al bloque de entrada.`,
          correctSlotId: 'validation',
          categoryTag: 'Validación / Control',
        },
        {
          id: 'blk-output-v1',
          label: `Entregar salida verificada de ${topic}`,
          detail: `Consolidar el resultado final validado para el problema de ${subject_name}.`,
          correctSlotId: 'output',
          categoryTag: 'Resultado / Output',
        },
      ],
      [
        {
          id: 'blk-input-v2',
          label: `Separar precondiciones y datos de origen de "${topic}"`,
          detail: `Reunir los parámetros conocidos del problema en ${subject_name} sin omitir restricciones.`,
          correctSlotId: 'input',
          categoryTag: 'Contexto / Input',
        },
        {
          id: 'blk-process-v2',
          label: `Descomponer y ejecutar flujo operativo de ${topic}`,
          detail: `Procesar cada elemento aplicando las propiedades técnicas de ${subject_name}.`,
          correctSlotId: 'process',
          categoryTag: 'Regla / Motor',
        },
        {
          id: 'blk-validation-v2',
          label: `Probar con caso pequeño y detectar excepciones`,
          detail: `Auditar que no existan valores nulos o fuera de rango antes de dar por bueno el cálculo.`,
          correctSlotId: 'validation',
          categoryTag: 'Validación / Control',
        },
        {
          id: 'blk-output-v2',
          label: `Obtener solución trazable lista para entrega`,
          detail: `Presentar la respuesta final verificable que cumple el objetivo en ${subject_name}.`,
          correctSlotId: 'output',
          categoryTag: 'Resultado / Output',
        },
      ],
    ];

    const baseBlocks: DraggableBlockItem[] =
      shuffleSeed === 1 && Array.isArray(draggable_blocks) && draggable_blocks.length === 4
        ? draggable_blocks
        : variantPools[shuffleSeed % variantPools.length];

    // Barajar aleatoriamente garantizando que no queden ya ordenados 1-2-3-4
    const copy = [...baseBlocks];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = (i * 11 + shuffleSeed * 7 + topic.length) % (i + 1);
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }, [explanationData, shuffleSeed]);

  // Reiniciar tablero cuando cambia el tema
  useEffect(() => {
    setPlacedBlocks({
      input: null,
      process: null,
      validation: null,
      output: null,
    });
    setVerificationState('none');
    setSelectedBankBlockId(null);
  }, [explanationData.topic, explanationData.subject_name]);

  // Animación suave del pulso de simulación entre nodos
  useEffect(() => {
    if (simulationFlow === 'idle') return;
    const timer = setInterval(() => {
      setActivePulseStep((prev) => {
        if (simulationFlow === 'feedback_loop') {
          // Va de 0 -> 1 -> 2 (falla validación) -> regresa a 0
          return prev >= 2 ? 0 : prev + 1;
        }
        return (prev + 1) % 4;
      });
    }, 1600);
    return () => clearInterval(timer);
  }, [simulationFlow]);

  // Bloques que aún están disponibles en el banco (no colocados en ninguna ranura)
  const availableBankBlocks = useMemo(() => {
    const placedIds = new Set(
      Object.values(placedBlocks)
        .filter((b): b is DraggableBlockItem => b !== null)
        .map((b) => b.id)
    );
    return bankBlocks.filter((b) => !placedIds.has(b.id));
  }, [bankBlocks, placedBlocks]);

  // Colocar un bloque en una ranura (por Drag & Drop o por clic accesible)
  const assignBlockToSlot = (blockId: string, slotId: 'input' | 'process' | 'validation' | 'output') => {
    const blockObj = bankBlocks.find((b) => b.id === blockId);
    if (!blockObj) return;

    setPlacedBlocks((prev) => {
      const next = { ...prev };
      // Si el bloque ya estaba en otra ranura, liberarla
      for (const key of Object.keys(next)) {
        if (next[key]?.id === blockId) {
          next[key] = null;
        }
      }
      next[slotId] = blockObj;
      return next;
    });
    setSelectedBankBlockId(null);
    setVerificationState('none');
  };

  const handleRemoveFromSlot = (slotId: 'input' | 'process' | 'validation' | 'output') => {
    setPlacedBlocks((prev) => ({
      ...prev,
      [slotId]: null,
    }));
    setVerificationState('none');
  };

  const handleVerifyBlueprint = () => {
    const allPlaced = BLUEPRINT_SLOTS.every((s) => placedBlocks[s.id] !== null);
    if (!allPlaced) {
      setVerificationState('partial');
      return;
    }
    const allCorrect = BLUEPRINT_SLOTS.every(
      (s) => placedBlocks[s.id]?.correctSlotId === s.id
    );
    if (allCorrect) {
      setVerificationState('success');
      if (onMasteryVerified) {
        onMasteryVerified();
      }
    } else {
      setVerificationState('partial');
    }
  };

  const handleAutoSolveBlueprint = () => {
    const solved: Record<string, DraggableBlockItem | null> = {
      input: bankBlocks.find((b) => b.correctSlotId === 'input') || null,
      process: bankBlocks.find((b) => b.correctSlotId === 'process') || null,
      validation: bankBlocks.find((b) => b.correctSlotId === 'validation') || null,
      output: bankBlocks.find((b) => b.correctSlotId === 'output') || null,
    };
    setPlacedBlocks(solved);
    setVerificationState('success');
  };

  const handleResetBlueprint = () => {
    setPlacedBlocks({
      input: null,
      process: null,
      validation: null,
      output: null,
    });
    setVerificationState('none');
    setSelectedBankBlockId(null);
    setShuffleSeed((s) => s + 1);
  };

  const placedCount = Object.values(placedBlocks).filter(Boolean).length;
  const correctPlacedCount = BLUEPRINT_SLOTS.filter(
    (s) => placedBlocks[s.id]?.correctSlotId === s.id
  ).length;

  return (
    <div className="visual-lab-container">
      {/* =====================================================================
          SECCIÓN A: ARQUITECTURA DE BLOQUES INTERACTIVA (SIMULADOR DE FLUJO)
         ===================================================================== */}
      <div className="visual-lab-canvas-card">
        <div className="visual-lab-canvas-header">
          <div>
            <span className="visual-lab-eyebrow">
              <LayersIcon size={14} /> Mapa interactivo de bloques
            </span>
            <h4 className="visual-lab-title">
              Arquitectura visual de «{explanationData.topic}»
            </h4>
            <p className="visual-lab-subtitle">
              Haz clic en cualquier bloque del diagrama para inspeccionar qué elementos van en cada
              etapa o simula cómo fluye la información.
            </p>
          </div>

          <div className="visual-lab-sim-controls" role="group" aria-label="Simulador de flujo">
            <button
              type="button"
              className={`btn btn-sm ${simulationFlow === 'normal' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setSimulationFlow('normal')}
            >
              <PlayIcon size={13} /> Flujo directo
            </button>
            <button
              type="button"
              className={`btn btn-sm ${
                simulationFlow === 'feedback_loop' ? 'btn-primary' : 'btn-outline'
              }`}
              onClick={() => setSimulationFlow('feedback_loop')}
            >
              <RotateCcwIcon size={13} /> Simular caso borde / corrección
            </button>
            {activeMode !== 'visual' && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => onModeSwitch('visual')}
              >
                <SparklesIcon size={13} /> Enfocar modo Visual
              </button>
            )}
          </div>
        </div>

        {/* Diagrama de 4 Nodos Conectados */}
        <div className="visual-nodes-pipeline">
          {visualNodes.map((node, idx) => {
            const isSelected = selectedNodeIndex === idx;
            const isPulsing = activePulseStep === idx;

            return (
              <React.Fragment key={node.id}>
                <button
                  type="button"
                  onClick={() => setSelectedNodeIndex(idx)}
                  className={`visual-node-card ${isSelected ? 'selected' : ''} ${
                    isPulsing ? 'pulsing' : ''
                  }`}
                  style={
                    {
                      '--node-accent': node.color,
                    } as React.CSSProperties
                  }
                >
                  <div className="visual-node-card__top">
                    <span className="visual-node-card__badge">{node.badge}</span>
                    {isPulsing && (
                      <span className="visual-node-card__live-dot" title="Flujo activo en este bloque" />
                    )}
                  </div>
                  <strong className="visual-node-card__title">{node.title}</strong>
                  <p className="visual-node-card__summary">{node.summary}</p>
                  <span className="visual-node-card__inspect">
                    {isSelected ? 'Inspeccionando detalles ↓' : 'Ver qué va aquí →'}
                  </span>
                </button>

                {idx < visualNodes.length - 1 && (
                  <div
                    className={`visual-node-connector ${
                      simulationFlow === 'feedback_loop' && idx === 2 ? 'connector-blocked' : ''
                    }`}
                    aria-hidden="true"
                  >
                    <ArrowRightIcon size={18} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Banner de bucle de retroalimentación cuando se simula fallo/caso borde */}
        {simulationFlow === 'feedback_loop' && (
          <div className="visual-feedback-loop-banner">
            <RotateCcwIcon size={16} />
            <span>
              <strong>Bucle de retroalimentación activo:</strong> Cuando en la{' '}
              <strong>Fase 3 (Control)</strong> detectamos un dato incompleto o un caso borde no
              cumplido, el flujo regresa automáticamente a la <strong>Fase 1 (Entrada)</strong> para
              ajustar los supuestos antes de generar la salida.
            </span>
          </div>
        )}

        {/* Inspector interactivo del nodo seleccionado: "¿Qué va en esta parte?" */}
        <div className="visual-node-inspector">
          <div className="visual-node-inspector__col">
            <h5>
              <TargetIcon size={15} /> ¿Qué va exactamente en «{visualNodes[selectedNodeIndex].title}»?
            </h5>
            <div className="visual-node-pills">
              {visualNodes[selectedNodeIndex].whatGoesHere.map((item, i) => (
                <div key={i} className="visual-node-pill">
                  <CheckCircleIcon size={14} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="visual-node-inspector__col">
            <h5>
              <LightbulbIcon size={15} /> Puntos clave del tema en modo «{explanationData.mode_label}»
            </h5>
            <div className="visual-node-pills">
              {explanationData.key_points.map((pt, idx) => (
                <div key={idx} className="visual-node-pill visual-node-pill--neutral">
                  <span className="visual-node-pill__num">{idx + 1}</span>
                  <span>{cleanBracketSyntax(pt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SECCIÓN B: CONSTRUCTOR INTERACTIVO DE BLOQUES ARRASTRABLES (DRAG & DROP)
         ===================================================================== */}
      <div className="visual-dnd-builder-card">
        <div className="visual-dnd-header">
          <div>
            <span className="visual-lab-eyebrow">
              <SparklesIcon size={14} /> Actividad interactiva · Arrastrar y soltar
            </span>
            <h4 className="visual-lab-title">
              Arma el esquema de bloques de «{explanationData.topic}»
            </h4>
            <p className="visual-lab-subtitle">
              Arrastra cada bloque de diseño hacia la etapa que le corresponde (o haz clic en un
              bloque y luego en su casilla) para construir el flujo completo del concepto.
            </p>
          </div>

          <div className="visual-dnd-header__actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setShowSlotHints((prev) => !prev)}
            >
              <LightbulbIcon size={14} /> {showSlotHints ? 'Ocultar pistas' : 'Ver pistas de cada bloque'}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleAutoSolveBlueprint}
            >
              Ver esquema resuelto
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleResetBlueprint}
            >
              <RotateCcwIcon size={14} /> Reiniciar bloques
            </button>
          </div>
        </div>

        {/* Banco de bloques arrastrables */}
        <div className="visual-dnd-bank">
          <div className="visual-dnd-bank__title">
            <span>
              Piezas disponibles ({availableBankBlocks.length} por ubicar)
            </span>
            {selectedBankBlockId && (
              <span className="visual-dnd-selection-hint">
                Pieza seleccionada: haz clic en una de las 4 casillas de abajo para colocarla
              </span>
            )}
          </div>

          {availableBankBlocks.length === 0 ? (
            <div className="visual-dnd-bank__empty">
              <CheckCircleIcon size={16} /> Todas las piezas están ubicadas en el tablero. ¡Haz clic en
              «Comprobar mi esquema de bloques» abajo!
            </div>
          ) : (
            <div className="visual-dnd-bank__grid">
              {availableBankBlocks.map((block) => {
                const isSelectedForClick = selectedBankBlockId === block.id;
                const isBeingDragged = draggedBlockId === block.id;

                return (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedBlockId(block.id);
                      e.dataTransfer.setData('text/plain', block.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      setDraggedBlockId(null);
                      setDragOverSlotId(null);
                    }}
                    onClick={() =>
                      setSelectedBankBlockId((prev) => (prev === block.id ? null : block.id))
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedBankBlockId((prev) => (prev === block.id ? null : block.id));
                      }
                    }}
                    className={`visual-draggable-block ${
                      isSelectedForClick ? 'selected-for-place' : ''
                    } ${isBeingDragged ? 'dragging' : ''}`}
                  >
                    <div className="visual-draggable-block__grip" aria-hidden="true">
                      ⋮⋮
                    </div>
                    <div className="visual-draggable-block__body">
                      <span className="visual-draggable-block__tag">{block.categoryTag}</span>
                      <strong>{block.label}</strong>
                      <p>{block.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ranuras de destino (Drop Zones) conectadas como bloques de diseño */}
        <div className="visual-dnd-slots-grid">
          {BLUEPRINT_SLOTS.map((slot) => {
            const placed = placedBlocks[slot.id];
            const isDragOver = dragOverSlotId === slot.id;
            const isCheckedAndCorrect =
              verificationState !== 'none' && placed && placed.correctSlotId === slot.id;
            const isCheckedAndWrong =
              verificationState !== 'none' && placed && placed.correctSlotId !== slot.id;

            return (
              <div
                key={slot.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverSlotId !== slot.id) {
                    setDragOverSlotId(slot.id);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverSlotId === slot.id) {
                    setDragOverSlotId(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverSlotId(null);
                  const droppedId = e.dataTransfer.getData('text/plain') || draggedBlockId;
                  if (droppedId) {
                    assignBlockToSlot(droppedId, slot.id);
                  }
                }}
                onClick={() => {
                  if (selectedBankBlockId) {
                    assignBlockToSlot(selectedBankBlockId, slot.id);
                  }
                }}
                className={`visual-drop-slot ${isDragOver ? 'drag-over' : ''} ${
                  placed ? 'has-block' : ''
                } ${selectedBankBlockId ? 'awaiting-click-place' : ''} ${
                  isCheckedAndCorrect ? 'slot-correct' : ''
                } ${isCheckedAndWrong ? 'slot-wrong' : ''}`}
                style={
                  {
                    '--slot-accent': slot.accentColor,
                    '--slot-bg-soft': slot.bgSoft,
                  } as React.CSSProperties
                }
              >
                <div className="visual-drop-slot__header">
                  <span className="visual-drop-slot__step">Etapa {slot.stepNumber}</span>
                  <div>
                    <strong>{slot.title}</strong>
                    <span>{slot.subtitle}</span>
                  </div>
                </div>

                {showSlotHints && (
                  <div className="visual-drop-slot__hint">
                    <LightbulbIcon size={13} /> {slot.hint}
                  </div>
                )}

                {placed ? (
                  <div
                    className="visual-placed-block"
                    draggable
                    onDragStart={(e) => {
                      setDraggedBlockId(placed.id);
                      e.dataTransfer.setData('text/plain', placed.id);
                    }}
                    onDragEnd={() => {
                      setDraggedBlockId(null);
                      setDragOverSlotId(null);
                    }}
                  >
                    <div className="visual-placed-block__top">
                      <span className="visual-draggable-block__tag">{placed.categoryTag}</span>
                      <button
                        type="button"
                        className="visual-placed-block__remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromSlot(slot.id);
                        }}
                        title="Devolver bloque al banco"
                      >
                        Cambiar ×
                      </button>
                    </div>
                    <strong>{placed.label}</strong>
                    <p>{placed.detail}</p>

                    {isCheckedAndCorrect && (
                      <div className="visual-slot-feedback visual-slot-feedback--ok">
                        <CheckCircleIcon size={14} /> Ubicación correcta en {slot.title}
                      </div>
                    )}
                    {isCheckedAndWrong && (
                      <div className="visual-slot-feedback visual-slot-feedback--warn">
                        Esta pieza corresponde a otra fase del flujo. ¡Intenta moverla a otra casilla!
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="visual-drop-slot__placeholder">
                    <span>
                      {selectedBankBlockId
                        ? 'Haz clic aquí para colocar el bloque seleccionado'
                        : 'Arrastra un bloque aquí o selecciónalo arriba'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Barra inferior de verificación del esquema */}
        <div className="visual-dnd-footer">
          <div className="visual-dnd-progress">
            <span>
              Bloques ubicados: <strong>{placedCount}/4</strong>
            </span>
            {verificationState !== 'none' && (
              <span className="visual-dnd-score-pill">
                Aciertos: <strong>{correctPlacedCount}/4</strong>
              </span>
            )}
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleVerifyBlueprint}
            disabled={placedCount === 0}
          >
            <CheckCircleIcon size={15} /> Comprobar mi esquema de bloques
          </button>
        </div>

        {verificationState === 'success' && (
          <div className="alert alert-success" style={{ marginTop: '0.85rem' }}>
            <CheckCircleIcon size={16} />
            <span>
              <strong>¡Esquema visual completado correctamente!</strong> Has conectado la Entrada, el
              Motor de Transformación, el Control de Casos Borde y la Salida Verificable de «
              {explanationData.topic}». Este avance se ha registrado en tu dominio del tema.
            </span>
          </div>
        )}

        {verificationState === 'partial' && (
          <div className="alert alert-error" style={{ marginTop: '0.85rem' }}>
            <span>
              {placedCount < 4
                ? `Aún faltan ${4 - placedCount} bloques por ubicar en el esquema. Arrástralos desde el banco superior.`
                : `Tienes ${correctPlacedCount} de 4 bloques en su posición ideal. Revisa las tarjetas marcadas en ámbar e intercámbialas sin prisa.`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
