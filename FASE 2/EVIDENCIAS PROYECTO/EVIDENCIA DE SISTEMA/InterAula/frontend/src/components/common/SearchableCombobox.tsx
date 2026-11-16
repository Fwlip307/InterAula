import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SearchIcon, ChevronDownIcon, XIcon, CheckIcon } from './Icons';

export interface ComboboxOption {
  value: string;
  label: string;
  subLabel?: string;
  group?: string;
}

interface SearchableComboboxProps {
  id?: string;
  options: ComboboxOption[] | string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  allowCustom?: boolean;
  emptyMessage?: string;
  maxDisplay?: number;
}

// Normalizar texto para búsqueda sin tildes ni mayúsculas (ej: "vina" encuentra "Viña del Mar")
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export default function SearchableCombobox({
  id,
  options,
  value,
  onChange,
  placeholder = 'Buscar o seleccionar...',
  disabled = false,
  required = false,
  allowCustom = true,
  emptyMessage = 'No se encontraron resultados coincidentes.',
  maxDisplay = 60,
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Normalizar opciones a estructura ComboboxOption
  const normalizedOptions: ComboboxOption[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  // Encontrar opción actual seleccionada
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => opt.value === value || opt.label === value);
  }, [normalizedOptions, value]);

  // Sincronizar texto visible del input cuando cambia el value externamente
  useEffect(() => {
    if (!isOpen) {
      if (selectedOption) {
        setSearchTerm(selectedOption.label);
      } else {
        setSearchTerm(value || '');
      }
    }
  }, [value, selectedOption, isOpen]);

  // Filtrado reactivo en tiempo real
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) {
      return normalizedOptions.slice(0, maxDisplay);
    }
    const normQuery = normalizeText(searchTerm);
    const matches = normalizedOptions.filter((opt) => {
      const matchLabel = normalizeText(opt.label).includes(normQuery);
      const matchSub = opt.subLabel ? normalizeText(opt.subLabel).includes(normQuery) : false;
      const matchGroup = opt.group ? normalizeText(opt.group).includes(normQuery) : false;
      return matchLabel || matchSub || matchGroup;
    });
    return matches.slice(0, maxDisplay);
  }, [normalizedOptions, searchTerm, maxDisplay]);

  // Cerrar al hacer clic fuera del componente
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Al salir, restablecer texto con el valor actual o confirmar custom si aplica
        if (selectedOption) {
          setSearchTerm(selectedOption.label);
        } else if (allowCustom && searchTerm.trim()) {
          onChange(searchTerm.trim());
        } else {
          setSearchTerm(value || '');
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption, allowCustom, searchTerm, value, onChange]);

  const handleSelectOption = (option: ComboboxOption) => {
    onChange(option.value);
    setSearchTerm(option.label);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleSelectCustom = () => {
    if (searchTerm.trim()) {
      onChange(searchTerm.trim());
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setIsOpen(true);
    inputRef.current?.focus();
  };

  // Manejo de teclado (flechas arriba/abajo, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelectOption(filteredOptions[highlightedIndex]);
      } else if (allowCustom && searchTerm.trim()) {
        handleSelectCustom();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const isExactMatch = useMemo(() => {
    const norm = normalizeText(searchTerm);
    return normalizedOptions.some((opt) => normalizeText(opt.label) === norm);
  }, [normalizedOptions, searchTerm]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%' }}
      className="ia-combobox-container"
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '12px',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <SearchIcon size={16} />
        </div>

        <input
          ref={inputRef}
          id={id}
          type="text"
          className="ia-input"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required && !value}
          autoComplete="off"
          style={{
            paddingLeft: '36px',
            paddingRight: '64px',
            width: '100%',
            backgroundColor: disabled ? '#f1f5f9' : '#ffffff',
            cursor: disabled ? 'not-allowed' : 'text',
            fontWeight: selectedOption ? 600 : 400,
            color: '#0f172a',
          }}
        />

        <div
          style={{
            position: 'absolute',
            right: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {searchTerm && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              title="Borrar texto"
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#94a3b8',
                borderRadius: '4px',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#475569')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#94a3b8')}
            >
              <XIcon size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={() => !disabled && setIsOpen((prev) => !prev)}
            tabIndex={-1}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: '#64748b',
              transition: 'transform 0.2s ease',
              transform: isOpen ? 'rotate(180deg)' : 'none',
            }}
          >
            <ChevronDownIcon size={16} />
          </button>
        </div>
      </div>

      {/* Menú Desplegable Flotante */}
      {isOpen && !disabled && (
        <div
          ref={listRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: '270px',
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
            zIndex: 999,
            padding: '6px 0',
          }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, index) => {
              const isSelected = opt.value === value || opt.label === value;
              const isHighlighted = index === highlightedIndex;

              return (
                <div
                  key={`${opt.value}-${index}`}
                  onClick={() => handleSelectOption(opt)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  style={{
                    padding: '9px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    backgroundColor: isHighlighted ? '#eff6ff' : isSelected ? '#f8fafc' : 'transparent',
                    color: isHighlighted ? '#1e40af' : '#0f172a',
                    fontSize: '0.86rem',
                    transition: 'background-color 0.12s ease',
                  }}
                >
                  <div style={{ flex: 1, paddingRight: '8px' }}>
                    <div style={{ fontWeight: isSelected ? 700 : 500, lineHeight: 1.35 }}>
                      {opt.label}
                    </div>
                    {(opt.subLabel || opt.group) && (
                      <div style={{ fontSize: '0.74rem', color: isHighlighted ? '#3b82f6' : '#64748b', marginTop: '2px' }}>
                        {opt.subLabel || opt.group}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <div style={{ color: '#2563eb', display: 'flex', alignItems: 'center' }}>
                      <CheckIcon size={16} />
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ padding: '14px 16px', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
              {emptyMessage}
            </div>
          )}

          {/* Opción para usar texto personalizado si allowCustom y no hay match exacto */}
          {allowCustom && searchTerm.trim() && !isExactMatch && (
            <div
              onClick={handleSelectCustom}
              style={{
                borderTop: '1px solid #f1f5f9',
                marginTop: '4px',
                padding: '10px 14px',
                fontSize: '0.84rem',
                color: '#2563eb',
                cursor: 'pointer',
                backgroundColor: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#eff6ff')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#f8fafc')}
            >
              <span>Usar texto: <strong>&ldquo;{searchTerm.trim()}&rdquo;</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
