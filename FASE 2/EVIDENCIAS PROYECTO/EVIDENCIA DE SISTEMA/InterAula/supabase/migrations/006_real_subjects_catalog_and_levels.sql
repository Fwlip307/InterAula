-- ==============================================================================
-- InterAula: Sprint 3 - Migración 006
-- Catálogo Real de Asignaturas Duoc UC (Extraído de Certificado Oficial)
-- y Campo de Nivel Académico Calculado para Verificación de Tutores
-- ==============================================================================

-- 1. CAMPO DE NIVEL CALCULADO EN TUTOR_VERIFICATION_REQUESTS
-- Permite almacenar de forma estructurada el nivel académico determinado por la nota:
-- 5.5 a 5.9 -> 'basic' (Básico)
-- 6.0 a 6.4 -> 'intermediate' (Intermedio)
-- 6.5 a 7.0 -> 'advanced' (Avanzado)
-- < 5.5      -> NULL (Sin nivel asignado por ahora)
ALTER TABLE public.tutor_verification_requests
  ADD COLUMN IF NOT EXISTS calculated_level text DEFAULT NULL
  CHECK (calculated_level IS NULL OR calculated_level IN ('basic', 'intermediate', 'advanced'));

CREATE INDEX IF NOT EXISTS idx_verification_requests_calculated_level
  ON public.tutor_verification_requests(calculated_level);

-- 2. CATÁLOGO REAL DE ASIGNATURAS DE DUOC UC
-- Reemplaza/amplía las materias para coincidir exactamente con el Certificado Académico de Concentración de Notas.
INSERT INTO public.subjects (name, category, is_pilot, pilot_priority)
VALUES
  -- Asignaturas Piloto Prioritarias de Informática
  ('Programación Web', 'Tecnología e Informática', true, 1),
  ('Programación de Algoritmos', 'Tecnología e Informática', true, 2),
  ('Modelamiento de Base de Datos', 'Tecnología e Informática', true, 3),
  ('Consultas de Bases de Datos', 'Tecnología e Informática', true, 4),
  ('Programación de Base de Datos', 'Tecnología e Informática', true, 5),
  ('Programación de Aplicaciones Móviles', 'Tecnología e Informática', true, 6),
  ('Ingeniería de Software', 'Tecnología e Informática', true, 7),
  ('Arquitectura', 'Tecnología e Informática', true, 8),
  ('Nivelación Matemática', 'Ciencias Básicas', true, 9),

  -- Área de Tecnología e Informática
  ('Diseño y Gestión de Requisitos', 'Tecnología e Informática', false, 0),
  ('Desarrollo de Software de Escritorio', 'Tecnología e Informática', false, 0),
  ('Diseño de Prototipos', 'Tecnología e Informática', false, 0),
  ('Calidad de Software', 'Tecnología e Informática', false, 0),
  ('Integración de Plataformas', 'Tecnología e Informática', false, 0),
  ('Gestión de Proyectos Informáticos', 'Tecnología e Informática', false, 0),
  ('Seguridad en Sistemas Computacionales', 'Tecnología e Informática', false, 0),
  ('Proceso de Portafolio Final', 'Tecnología e Informática', false, 0),
  ('Big Data', 'Tecnología e Informática', false, 0),
  ('Minería de Datos', 'Tecnología e Informática', false, 0),
  ('Inteligencia de Negocios', 'Tecnología e Informática', false, 0),

  -- Área de Ciencias Básicas
  ('Matemática Aplicada', 'Ciencias Básicas', false, 0),
  ('Estadística Descriptiva', 'Ciencias Básicas', false, 0),

  -- Área de Idiomas
  ('Inglés Básico I', 'Idiomas', false, 0),
  ('Inglés Básico II', 'Idiomas', false, 0),
  ('Inglés Elemental', 'Idiomas', false, 0),
  ('Inglés Intermedio', 'Idiomas', false, 0),
  ('Inglés Intermedio Alto', 'Idiomas', false, 0),
  ('Integrated English Practice', 'Idiomas', false, 0),

  -- Área de Formación General y Habilidades
  ('Habilidades Básicas de Comunicación', 'Formación General', false, 0),
  ('Habilidades de Comunicación Efectiva', 'Formación General', false, 0),
  ('Fundamentos de Antropología', 'Formación General', false, 0),
  ('Doctrina Social de la Iglesia', 'Formación General', false, 0),
  ('Ética para el Trabajo', 'Formación General', false, 0),
  ('Ética Profesional', 'Formación General', false, 0),
  ('Taller de Estrategias de Estudio Avanzado', 'Formación General', false, 0),

  -- Área de Gestión y Negocios
  ('Mentalidad Emprendedora', 'Gestión y Negocios', false, 0),
  ('Gestión Ágil de Proyectos', 'Gestión y Negocios', false, 0),
  ('Evaluación de Proyectos', 'Gestión y Negocios', false, 0),
  ('BPM', 'Gestión y Negocios', false, 0),
  ('Gestión de Personas', 'Gestión y Negocios', false, 0),
  ('Herramientas para el Emprendimiento', 'Gestión y Negocios', false, 0),
  ('Liderazgo y Negociación', 'Gestión y Negocios', false, 0),
  ('Gestión de Riesgos', 'Gestión y Negocios', false, 0)
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  is_pilot = EXCLUDED.is_pilot,
  pilot_priority = EXCLUDED.pilot_priority;
