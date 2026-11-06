import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Componente reutilizable para presentar estados vacíos de listas o secciones.
 * Respeta la clase `.ia-empty-box` y la estética universitaria azul/gris de InterAula.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  style,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`ia-empty-box ${className}`.trim()} style={style}>
      {icon && <div className="ia-empty-icon">{icon}</div>}
      {title && <h4 className="ia-empty-title">{title}</h4>}
      {description && <p className="ia-empty-desc">{description}</p>}
      {action && <div style={{ marginTop: '16px' }}>{action}</div>}
    </div>
  );
}
