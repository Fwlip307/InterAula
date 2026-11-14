import { useCallback, useEffect, useState } from 'react';
import { learningSpaceService } from '../../services/learningSpace.service';
import type { QuickIdea } from '../../types/learningSpace';
import VoiceDictationButton from './VoiceDictationButton';

interface QuickIdeasDrawerProps {
  contextType: QuickIdea['context_type'];
  contextId?: string | null;
  defaultSubjectName?: string;
  compact?: boolean;
  onIdeaConverted?: () => void;
}

export function QuickIdeasDrawer({
  contextType,
  contextId = null,
  defaultSubjectName = 'General',
  compact = false,
  onIdeaConverted,
}: QuickIdeasDrawerProps) {
  const [open, setOpen] = useState(!compact);
  const [ideas, setIdeas] = useState<QuickIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const loadIdeas = useCallback(async () => {
    setLoading(true);
    try {
      const list = await learningSpaceService.listQuickIdeas({
        context_type: contextType,
        ...(contextId ? { context_id: contextId } : {}),
      });
      setIdeas(list);
    } catch {
      // Silencioso si aún no hay sesión o tabla pendiente
    } finally {
      setLoading(false);
    }
  }, [contextType, contextId]);

  useEffect(() => {
    if (open) {
      void loadIdeas();
    }
  }, [open, loadIdeas]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.trim().length < 2) return;
    setSaving(true);
    setFeedback(null);
    try {
      const created = await learningSpaceService.createQuickIdea({
        context_type: contextType,
        context_id: contextId,
        content: draft.trim(),
      });
      setIdeas((prev) => [created, ...prev]);
      setDraft('');
      setFeedback('Guardado en tu bandeja para después.');
    } catch (err: any) {
      setFeedback(err?.message || 'No se pudo guardar la idea.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleResolved = async (idea: QuickIdea) => {
    try {
      const updated = await learningSpaceService.updateQuickIdea(idea.id, {
        resolved: !idea.resolved,
      });
      setIdeas((prev) => prev.map((item) => (item.id === idea.id ? updated : item)));
    } catch (err: any) {
      setFeedback(err?.message || 'No se pudo actualizar.');
    }
  };

  const handleConvertToTask = async (idea: QuickIdea) => {
    try {
      const result = await learningSpaceService.convertIdeaToTask(idea.id, {
        subject_name: defaultSubjectName,
      });
      setIdeas((prev) => prev.map((item) => (item.id === idea.id ? result.idea : item)));
      setFeedback('Convertida en tarea en Mi espacio de aprendizaje.');
      onIdeaConverted?.();
    } catch (err: any) {
      setFeedback(err?.message || 'No se pudo convertir en tarea.');
    }
  };

  const handleDelete = async (ideaId: string) => {
    try {
      await learningSpaceService.deleteQuickIdea(ideaId);
      setIdeas((prev) => prev.filter((item) => item.id !== ideaId));
    } catch (err: any) {
      setFeedback(err?.message || 'No se pudo eliminar.');
    }
  };

  const visibleIdeas = ideas.filter((item) => (showResolved ? true : !item.resolved));
  const pendingCount = ideas.filter((item) => !item.resolved).length;

  return (
    <div className="ia-card p-4" style={{ borderLeft: '4px solid var(--ia-primary)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--ia-text)' }}>
            <span>Ideas y dudas para después</span>
            {pendingCount > 0 && (
              <span className="ia-badge ia-badge-primary text-xs">{pendingCount} pendientes</span>
            )}
          </h4>
          <p className="text-xs" style={{ color: 'var(--ia-text-muted)' }}>
            Anota algo rápido para no perder el foco ahora y revísalo cuando termines.
          </p>
        </div>
        {compact && (
          <button
            type="button"
            className="ia-btn ia-btn-ghost ia-btn-sm"
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? 'Ocultar bandeja' : 'Abrir bandeja'}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          <form onSubmit={handleAdd} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                className="ia-input flex-1 text-sm"
                placeholder="Ej: Preguntar por el ejercicio 3 o buscar ejemplo de recursión..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={1000}
              />
              <button
                type="submit"
                className="ia-btn ia-btn-primary ia-btn-sm"
                disabled={saving || draft.trim().length < 2}
              >
                {saving ? 'Guardando...' : 'Anotar'}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <VoiceDictationButton
                buttonLabel="Dictar idea"
                onInsertText={(text: string) =>
                  setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
                }
              />
              <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--ia-text-muted)' }}>
                <input
                  type="checkbox"
                  checked={showResolved}
                  onChange={(e) => setShowResolved(e.target.checked)}
                />
                Mostrar resueltas
              </label>
            </div>
          </form>

          {feedback && (
            <p className="text-xs px-2 py-1 rounded" style={{ background: 'var(--ia-surface-alt)', color: 'var(--ia-text-secondary)' }}>
              {feedback}
            </p>
          )}

          {loading ? (
            <p className="text-xs" style={{ color: 'var(--ia-text-muted)' }}>Cargando bandeja...</p>
          ) : visibleIdeas.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--ia-text-muted)' }}>
              No hay notas pendientes en esta bandeja.
            </p>
          ) : (
            <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {visibleIdeas.map((idea) => (
                <li
                  key={idea.id}
                  className="p-2.5 rounded-lg border text-xs flex flex-col gap-2"
                  style={{
                    background: 'var(--ia-surface-alt)',
                    borderColor: 'var(--ia-border)',
                    opacity: idea.resolved ? 0.72 : 1,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={idea.resolved ? 'line-through' : ''} style={{ color: 'var(--ia-text)' }}>
                      {idea.content}
                    </span>
                    <button
                      type="button"
                      className="text-xs px-1.5 py-0.5 rounded hover:opacity-80"
                      style={{ color: 'var(--ia-text-muted)' }}
                      onClick={() => handleDelete(idea.id)}
                      title="Eliminar nota"
                    >
                      Eliminar
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="ia-btn ia-btn-ghost ia-btn-sm text-xs"
                      onClick={() => handleToggleResolved(idea)}
                    >
                      {idea.resolved ? 'Reabrir' : 'Marcar resuelta'}
                    </button>
                    {!idea.converted_task_id ? (
                      <button
                        type="button"
                        className="ia-btn ia-btn-secondary ia-btn-sm text-xs"
                        onClick={() => handleConvertToTask(idea)}
                      >
                        Convertir en tarea
                      </button>
                    ) : (
                      <span className="ia-badge ia-badge-success text-[11px]">Convertida en tarea</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
