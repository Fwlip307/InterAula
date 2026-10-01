# InterAula — Análisis Técnico y Plan de Implementación de la Nueva Etapa

> **Proyecto:** InterAula — Plataforma Universitaria de Aprendizaje Colaborativo y Hub de Proyectos  
> **Carrera:** Ingeniería en Informática — Proyecto Capstone  
> **Fecha:** Octubre 2026  
> **Objetivo del documento:** Análisis previo exhaustivo de la arquitectura actual y diseño técnico del nuevo alcance (Tutores Comunitarios vs. Verificados, Proceso de Evaluación Práctica, Validación Docente, Preferencias de Aprendizaje y Preparación para el Piloto de Asignaturas de Duoc UC).

---

## A. Lo que ya funciona

Actualmente, InterAula cuenta con una base sólida, funcional y libre de errores de compilación o linting, respaldada por dos migraciones en Supabase (`001_profiles_and_projects.sql` y `002_tutoring_and_badges.sql`):

1. **Autenticación Robusta:**
   - Registro e inicio de sesión con correo y contraseña.
   - Autenticación con Google OAuth mediante redirect callback.
   - Recuperación de contraseña (`/forgot-password` y `/update-password`).
   - Persistencia de sesión mediante JWT y Refresh Token en `localStorage` coordinado por `AuthContext`.
   - Cierre de sesión y protección de rutas con `ProtectedRoute` y `PublicOnlyRoute`.

2. **Perfil Híbrido Universitario:**
   - Una única identidad por usuario (sin roles globales excluyentes).
   - Gestión de información personal, carrera, institución, bio y redes profesionales.
   - Materias ofrecidas con nivel de dominio (`profile_offered_subjects`).
   - Materias necesitadas con notas explicativas (`profile_needed_subjects`).
   - Habilidades técnicas (`profile_skills`) e intereses en proyectos (`profile_project_interests`).
   - Disponibilidad diferenciada para tutorías y para proyectos.
   - Visualización de perfil privado (`ProfileView.tsx`) y público (`PublicProfile.tsx`).

3. **Flujo Funcional de Tutorías:**
   - Exploración real de tutores disponibles en `TutoringExplore.tsx`, con filtros por catálogo de materias (`subjects`) y búsqueda de texto.
   - Solicitud de sesión mediante `RequestTutoringModal.tsx` (con selección de materia del tutor, fecha futura, hora, duración, modalidad online/presencial, enlace o sala y notas temáticas).
   - Gestión centralizada en `MyTutoring.tsx` con dos pestañas ("Como estudiante" y "Como tutor") utilizando una tarjeta reutilizable única (`SessionCard.tsx`).
   - Ciclo de vida completo: el tutor acepta o rechaza solicitudes pendientes; el estudiante o tutor cancelan; el estudiante confirma la tutoría como completada una vez alcanzada la fecha y hora programada.
   - Evaluación docente entre pares en `ReviewModal.tsx` con calificaciones de 1 a 10 en Comunicación, Dominio del Tema y Puntualidad, con comentario opcional y promedio calculado automáticamente por la base de datos.
   - Prevención estricta de evaluaciones duplicadas (`UNIQUE(session_id)` y triggers de integridad).

4. **Reputación e Insignias:**
   - Cálculo en tiempo real de estadísticas de tutoría sin duplicación cartesiana mediante `tutor_statistics_view`, visible a través de `TutorStats.tsx`.
   - Sistema de insignias académicas automáticas por hitos de tutorías completadas (1, 10, 25 y 50 tutorías) mediante trigger en `user_badges`, visualizado con `BadgeList.tsx`.

5. **Hub de Proyectos Académicos:**
   - Modelado de proyectos colaborativos, vacantes/posiciones, integrantes y postulaciones (`project.service.ts` y `ProjectsHub.tsx`).

6. **Identidad Visual y Cero Emojis:**
   - Logo oficial de InterAula integrado en Navbar y pantallas de autenticación (`assets/branding/interaula-logo.png`).
   - Estilo CSS tradicional universitario limpio y responsive con prefijo `.ia-*`.
   - Prohibición absoluta de emojis cumplida al 100% mediante componentes SVG puros en `Icons.tsx`.

---

## B. Lo que debe mantenerse

* **Filosofía de Cuenta Híbrida:** Todo estudiante puede enseñar materias en las que destaca y solicitar apoyo en aquellas donde presenta dificultades. La verificación académica es una acreditación **por asignatura**, no un rol global que encasille al usuario.
* **Arquitectura de 3 Capas:**
  - Capa 1 (Presentación): Componentes y páginas React sin SQL embebido.
  - Capa 2 (Negocio): Servicios TypeScript que coordinan validaciones, transformaciones y llamadas API.
  - Capa 3 (Datos / Infraestructura): PostgreSQL en Supabase con RLS, triggers y vistas.
* **El Flujo de Tutorías Comunitarias:** Las tutorías actuales siguen plenamente operativas; cualquier estudiante disponible puede seguir brindando apoyo y construyendo su reputación.
* **El Hub de Proyectos:** Debe conservarse intacto.
* **Regla de Cero Emojis:** Exclusivamente componentes SVG de `Icons.tsx`.
* **Identidad Visual:** Fondos claros, azul principal, tipografía universitaria y tarjetas limpias sin Tailwind ni dependencias externas innecesarias.
* **Integridad de Migraciones:** No modificar destructivamente las migraciones `001` y `002` ya ejecutadas.

---

## C. Lo que debe modificarse

1. **Catálogo de Materias (`subjects`):**
   - Debe prepararse para destacar las **dos asignaturas piloto prioritarias** de Duoc UC (Ingeniería en Informática), **sin hardcodear sus nombres** en el código fuente. Se incorporará un flag configurable a nivel de datos.
2. **Exploración de Tutores (`TutoringExplore.tsx`):**
   - Incorporar distinción visual clara y filtro de búsqueda entre **Tutor Comunitario** y **Tutor Verificado**.
   - Priorizar en la interfaz las asignaturas del piloto institucional.
3. **Perfil del Tutor (`PublicProfile.tsx` y `ProfileView.tsx`):**
   - Mostrar el sello/badge de verificación en las asignaturas en las que el tutor haya sido certificado por la institución.
   - Reflejar las preferencias de aprendizaje y metodología de apoyo.
4. **Edición del Perfil (`ProfileEdit.tsx`):**
   - Integrar un subcomponente modular para configurar las **Preferencias de Aprendizaje** del estudiante.
   - Permitir al estudiante ver el estado de verificación de sus asignaturas ofrecidas y postular a la verificación académica.
5. **Solicitud de Tutoría (`RequestTutoringModal.tsx` y `SessionCard.tsx`):**
   - Permitir al estudiante adjuntar o compartir sus preferencias de aprendizaje al agendar la sesión para que el tutor prepare el encuentro según sus necesidades pedagógicas.
6. **Navegación (`Navbar.tsx` y `AppRouter.tsx`):**
   - Incorporar acceso al módulo de validación académica para docentes y revisión de solicitudes de verificación.

---

## D. Lo nuevo que debe agregarse

1. **Diferenciación Conceptual de Tutores:**
   - **Tutor Comunitario:** Estudiante activo que enseña según su propia experiencia y cuya confianza se fundamenta en su historial de tutorías, evaluaciones y calificaciones recibidas.
   - **Tutor Verificado:** Estudiante que ha superado una validación formal de conocimientos y comprensión pedagógica en una asignatura específica.
2. **Modelo de Solicitud de Verificación (`tutor_verification_requests`):**
   - Registro formal de la postulación vinculando estudiante y asignatura.
   - Trazabilidad de estados: `pending` (solicitada), `practical_evaluation` (en resolución práctica), `under_review` (entregada para revisión docente), `approved` (aprobada), `rejected` (rechazada) y `requires_reevaluation` (requiere ajustes o nueva evaluación).
   - Enlace/código de entrega de solución práctica y justificación/defensa de la solución.
   - Historial de retroalimentación y observaciones del docente.
3. **Evaluación Práctica y Comprensión Conceptual:**
   - En lugar de pruebas teóricas automatizadas vulnerables al uso no reflexivo de IA, el sistema contempla la entrega de un problema práctico y la explicación razonada del enfoque adoptado.
4. **Módulo de Validación Docente (`AcademicValidationView.tsx`):**
   - Interfaz sencilla y sin sobreingeniería para el responsable académico.
   - Permite consultar postulaciones pendientes, revisar antecedentes del estudiante (tutorías realizadas, evaluaciones, comentarios de compañeros), analizar la entrega práctica y decidir con retroalimentación fundada.
5. **Módulo de Preferencias de Aprendizaje:**
   - Enfoque pedagógico e inclusivo, **estrictamente desprovisto de etiquetas médicas o diagnósticos clínicos**.
   - Opciones declaradas voluntariamente por el estudiante:
     - Explicaciones paso a paso.
     - Ejemplos prácticos y aplicados.
     - Material resumido y esquemas conceptuales.
     - Apoyo visual y diagramas.
     - Sesiones estructuradas con pauta previa.
     - Ritmo pausado / más tiempo para procesar contenidos.

---

## E. Cambios necesarios en base de datos (Migración `003_tutor_verification_and_preferences.sql`)

La nueva migración no alterará de forma destructiva ninguna tabla previa:

```sql
-- 1. Soporte para asignaturas prioritarias / piloto en Duoc UC
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS is_pilot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pilot_priority integer DEFAULT 0;

-- 2. Preferencias de aprendizaje inclusivas en el perfil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS learning_preferences text[] DEFAULT '{}'::text[];

-- 3. Estado de verificación en las asignaturas que el tutor ofrece
ALTER TABLE public.profile_offered_subjects
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- 4. Tabla de Solicitudes y Trazabilidad de Verificación de Tutores
CREATE TABLE IF NOT EXISTS public.tutor_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'practical_evaluation', 'under_review', 'approved', 'rejected', 'requires_reevaluation')),
  practical_submission text, -- Repositorio, solución o desarrollo del ejercicio práctico
  defense_notes text,        -- Explicación razonada o defensa de la solución
  reviewer_feedback text,   -- Observaciones y retroalimentación del docente validador
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT unique_active_verification_per_subject UNIQUE (tutor_id, subject_id, status)
);

-- 5. Trigger para actualizar automáticamente profile_offered_subjects al aprobar
CREATE OR REPLACE FUNCTION public.sync_tutor_verification_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    UPDATE public.profile_offered_subjects
    SET is_verified = true, verified_at = now()
    WHERE profile_id = NEW.tutor_id AND subject_id = NEW.subject_id;
  ELSIF NEW.status IN ('rejected', 'requires_reevaluation') AND OLD.status = 'approved' THEN
    UPDATE public.profile_offered_subjects
    SET is_verified = false, verified_at = NULL
    WHERE profile_id = NEW.tutor_id AND subject_id = NEW.subject_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Políticas de Seguridad RLS
-- El estudiante solo puede crear y ver sus propias solicitudes.
-- Solo un usuario con rol/permiso académico o validador puede modificar status y reviewed_by.
```

---

## F. Cambios necesarios en frontend

1. **Nuevo componente `LearningPreferencesSection.tsx`:** Subcomponente para `ProfileEdit.tsx` que permite marcar y guardar las preferencias metodológicas con casillas interactivas limpias.
2. **Nuevo modal `RequestVerificationModal.tsx`:** Permite al tutor postular a verificación en una materia que enseña, describiendo su entrega práctica y defensa del problema planteado.
3. **Nueva página `AcademicValidationView.tsx`:** Vista para que el docente visualice la lista de solicitudes, revise la solución práctica, antecedentes del tutor y emita su dictamen (**Aprobar**, **Rechazar** o **Solicitar nueva evaluación**).
4. **Mejora en `TutoringExplore.tsx`:**
   - Filtro de nivel de tutor: *"Todos"*, *"Tutores Verificados"*, *"Tutores Comunitarios"*.
   - Badge visual SVG (ej: escudo o birrete con check) destacando claramente al tutor verificado.
   - Destacado visual de las materias marcadas como piloto (`is_pilot = true`).
5. **Mejora en `SessionCard.tsx` y `RequestTutoringModal.tsx`:**
   - Incorporar preferencias de aprendizaje en la solicitud para enriquecer la preparación del tutor.

---

## G. Cambios necesarios en servicios

1. **Nuevo servicio `src/services/verification.service.ts`:**
   - `getMyVerificationRequests()`: Consulta el estado de las solicitudes del usuario autenticado.
   - `submitVerificationRequest(dto)`: Registra una nueva solicitud con entrega práctica y defensa.
   - `getPendingVerificationRequests()`: Consulta las solicitudes pendientes para revisión docente.
   - `reviewVerificationRequest(dto)`: Emite la resolución académica (**Aprobar**, **Rechazar**, **Reevaluar**).
2. **Extensión en `profile.service.ts`:**
   - Soporte para actualizar y leer `learning_preferences` en el perfil.
3. **Extensión en `tutoring.service.ts`:**
   - Enriquecer `AvailableTutor` con el estado `is_verified` de cada materia ofrecida.
   - Soporte para filtrar tutores verificados.

---

## H. Posibles riesgos de romper funcionalidades existentes y mitigación

| Riesgo Identificado | Impacto Potencial | Estrategia de Mitigación |
| :--- | :--- | :--- |
| **Incompatibilidad con el flujo de tutorías comunitarias** | Alto | El flujo comunitario se mantiene como el estándar universal. La verificación es un distintivo cualitativo adicional, no un requisito excluyente para realizar tutorías. |
| **Ruptura de la cuenta híbrida por crear roles de docente rígidos** | Medio | No crear tablas de usuarios separadas. La validación se modela mediante permisos o perfiles autorizados manteniendo la misma tabla `profiles`. |
| **Estigmatización por preferencias de aprendizaje** | Alto | Uso exclusivo de categorías pedagógicas y metodológicas voluntarias. Queda estrictamente prohibido registrar condiciones médicas o clínicas. |
| **Acoplamiento rígido con asignaturas de Duoc UC** | Medio | Se usa un flag `is_pilot` en la tabla `subjects`. Si las dos asignaturas cambian, solo se actualiza una fila en la base de datos sin tocar una sola línea de código React. |
| **Fallas en compilación por tipos desalineados** | Bajo | Tipado estricto en `src/types/verification.ts` y ejecución continua de `npm run lint` y `npm run build`. |

---

## I. Orden recomendado de implementación

```text
Paso 1: Generación de la migración SQL 003_tutor_verification_and_preferences.sql
   ↓
Paso 2: Definición de contratos y modelos en src/types/verification.ts y extensión de profile.ts
   ↓
Paso 3: Creación de src/services/verification.service.ts y extensión de profile.service.ts
   ↓
Paso 4: Implementación de Preferencias de Aprendizaje en ProfileEdit, ProfileView y PublicProfile
   ↓
Paso 5: Implementación del flujo de solicitud de verificación por el estudiante (modal y trazabilidad)
   ↓
Paso 6: Implementación de la vista de validación académica docente (revisión, feedback y aprobación)
   ↓
Paso 7: Actualización de TutoringExplore (distinción visual Comunitario/Verificado y filtro piloto)
   ↓
Paso 8: Integración de preferencias de aprendizaje en la solicitud de tutorías
   ↓
Paso 9: Validación cruzada: npm run lint, npm run build y pruebas manuales de todos los flujos
   ↓
Paso 10: Actualización del documento docs/ARQUITECTURA_Y_DEFENSA.md
```
