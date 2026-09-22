# InterAula — Documento de Arquitectura, Decisiones Técnicas y Guía de Defensa Académica

> **Proyecto:** InterAula — Plataforma Universitaria de Aprendizaje Colaborativo y Hub de Proyectos  
> **Carrera:** Ingeniería en Informática — Proyecto Capstone  
> **Estado del Módulo:** Sprint 1 Refactorizado (Autenticación Robusta y Perfiles Híbridos)  
> **Fecha de actualización:** Septiembre 2026

---

## 1. Organización del Proyecto y Responsabilidades

El proyecto InterAula utiliza una arquitectura limpia por capas en el frontend, orientada a la **separación estricta de responsabilidades**:

```text
InterAula/
├── docs/                               # Documentación técnica y académica de defensa
│   └── ARQUITECTURA_Y_DEFENSA.md
├── src/
│   ├── components/                     # Elementos visuales reutilizables
│   │   ├── common/                     # Íconos SVG puros y componentes genéricos (EmptyState)
│   │   ├── layout/                     # Estructura visual permanente (Navbar, Footer, AppLayout)
│   │   └── routing/                    # Guardas de navegación (ProtectedRoute, PublicOnlyRoute)
│   ├── context/                        # Estado global de la aplicación (AuthContext)
│   ├── layouts/                        # Envoltorios de páginas (AuthLayout, AppLayout)
│   ├── lib/                            # Clientes de infraestructura externa (supabase.ts)
│   ├── pages/                          # Vistas de la aplicación asociadas a rutas
│   │   ├── auth/                       # Login, Register, ForgotPassword, UpdatePassword, AuthCallback
│   │   ├── profile/                    # Perfil privado, perfil público y edición
│   │   │   └── components/             # Subcomponentes modulares de edición de catálogos
│   │   ├── projects/                   # Hub de Proyectos
│   │   ├── resources/                  # Repositorio de apuntes y guías
│   │   ├── settings/                   # Ajustes de cuenta y preferencias
│   │   └── tutoring/                   # Explorador de materias y mis tutorías
│   ├── router/                         # Definición central de rutas con React Router (AppRouter.tsx)
│   ├── services/                       # Capa de acceso a datos y comunicación con Supabase
│   │   ├── profile.service.ts          # Perfiles, materias académicas, habilidades e intereses
│   │   └── project.service.ts          # Proyectos, vacantes y postulaciones
│   ├── styles/                         # Hojas de estilo Vanilla CSS con prefijo .ia-*
│   │   ├── auth.css
│   │   └── dashboard.css
│   ├── types/                          # Definición de modelos de dominio TypeScript
│   │   ├── profile.ts
│   │   └── project.ts
│   └── utils/                          # Funciones puras compartidas (formateo y validaciones)
│       ├── formatters.ts
│       └── validators.ts
└── supabase/
    └── migrations/                     # Migraciones SQL y esquemas de base de datos
        └── 001_profiles_and_projects.sql
```

### Responsabilidades por capa:
* **`pages/`**: Orquestan la vista, coordinan las llamadas iniciales a los servicios y distribuyen los datos a los componentes hijos. No realizan consultas SQL directas ni conocen los endpoints de la API.
* **`services/`**: Encapsulan la lógica de acceso a datos utilizando el cliente de Supabase. Controlan la autenticación requerida, aplican filtros y normalizan las respuestas.
* **`components/`**: Componentes presentacionales o de interacción específica. Reciben datos por `props` y emiten eventos mediante callbacks (`onAdd`, `onRemove`, `onToggle`).
* **`utils/`**: Funciones puras (sin efectos secundarios ni dependencias de estado React) para formateo y validación de datos.

---

## 2. Pila Tecnológica: React, Vite y TypeScript

### ¿Por qué Vite en lugar de Create React App o Next.js?
1. **Velocidad de compilación vía ES Modules nativos:** Vite aprovecha los módulos ESM nativos del navegador durante el desarrollo (`vite dev`), evitando empaquetar todo el proyecto en cada cambio. Las modificaciones en componentes se reflejan en milisegundos gracias al *Hot Module Replacement (HMR)*.
2. **Construcción para producción optimizada:** Utiliza Rollup internamente para generar bundles ligeros, con eliminación de código muerto (*tree-shaking*) y compresión eficiente.
3. **Sin sobreingeniería de Server-Side Rendering (SSR):** InterAula en este Sprint es una aplicación web interactiva de gestión privada para estudiantes con sesión iniciada. Un framework SSR como Next.js añadiría la necesidad de servidores Node.js dedicados en producción, mayor costo de infraestructura y complejidad en el ciclo de vida de autenticación que no se justifica técnicamente.

### Rol de TypeScript:
TypeScript proporciona **seguridad en tiempo de compilación** mediante contratos de tipos explícitos (`Profile`, `AcademicLevel`, `Subject`, `Project`). Evita errores de ejecución como acceder a propiedades inexistentes en respuestas asíncronas de la base de datos y garantiza consistencia entre frontend y base de datos sin recurrir a tipos inseguros (`any`).

---

## 3. Autenticación con Supabase (Email/Password y Google OAuth)

InterAula soporta dos flujos de autenticación gestionados por Supabase Auth:

### 3.1. Flujo Correo y Contraseña
1. El usuario ingresa correo y contraseña en `Login.tsx` o `Register.tsx`.
2. Se invoca `supabase.auth.signInWithPassword()` o `supabase.auth.signUp()`.
3. Supabase valida las credenciales y genera un par de tokens criptográficos:
   * **Access Token (JWT):** De corta duración (habitualmente 1 hora), contiene los claims del usuario (`sub: auth.uid()`).
   * **Refresh Token:** De larga duración, utilizado para solicitar nuevos JWT sin que el usuario deba reingresar sus credenciales.

### 3.2. Flujo Google OAuth
1. El usuario hace clic en *"Continuar con Google"*.
2. El cliente ejecuta:
   ```ts
   await supabase.auth.signInWithOAuth({
     provider: 'google',
     options: {
       redirectTo: `${window.location.origin}/auth/callback`,
     },
   });
   ```
3. El navegador es redirigido a las pantallas de consentimiento de Google.
4. Tras autorizar el acceso, Google redirige a Supabase y Supabase devuelve al usuario a `/auth/callback` con un fragmento hash o código de autorización en la URL.
5. El componente `AuthCallback.tsx` captura el evento, confirma que la sesión fue establecida y redirige a `/dashboard`.

---

## 4. Persistencia de Sesión

### ¿Cómo no se pierde la sesión al recargar la página?
1. **Almacenamiento Seguro del SDK:** El cliente de Supabase (`@supabase/supabase-js`) almacena automáticamente el token JWT y el refresh token en el `localStorage` del navegador bajo una clave prefijada por el proyecto (`sb-<project-ref>-auth-token`).
2. **Inicialización Asíncrona:** Cuando la aplicación carga en `main.tsx`, `AuthContext` ejecuta `supabase.auth.getSession()`, el cual lee el token existente del almacenamiento local y valida su expiración.
3. **Escuchador en tiempo real (`onAuthStateChange`):**
   ```ts
   const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
     setSession(session);
     setUser(session?.user ?? null);
     setLoading(false);
   });
   ```
   Si el token está próximo a expirar, el cliente solicita transparentemente un nuevo Access Token al servidor de Supabase Auth usando el Refresh Token.

---

## 5. El Rol de `AuthContext`

`AuthContext` es el corazón del estado de sesión en el frontend:
* **Centralización del estado:** Expone globalmente el objeto `user`, la `session` activa, las funciones `signOut()` y el estado booleano `loading`.
* **Sin librerías pesadas externas:** Se utiliza la API nativa `createContext` y `useContext` de React. Para una aplicación de esta escala, añadir Redux Toolkit o Zustand para manejar únicamente la sesión agregaría boilerplate innecesario, archivos redundantes y complejidad cognitiva.
* **Consumo ergonómico:** Mediante el hook personalizado `useAuth()`, cualquier componente o página accede al usuario en una sola línea:
  ```tsx
  const { user, signOut } = useAuth();
  ```

---

## 6. Funcionamiento de las Rutas Protegidas

La protección de accesos se implementa mediante componentes envoltorios en `AppRouter.tsx`:

### 6.1. `ProtectedRoute.tsx` (Rutas Privadas)
* Si `loading === true`, muestra un indicador de carga para evitar redirecciones prematuras antes de que Supabase lea el `localStorage`.
* Si `!user`, renderiza `<Navigate to="/login" replace />`, impidiendo el acceso al panel y redirigiendo al formulario de inicio de sesión.
* Si el usuario está autenticado, renderiza el componente hijo (`<AppLayout />` con su Navbar, vistas y Footer).

### 6.2. `PublicOnlyRoute.tsx` (Rutas Públicas Exclusivas)
* Protege vistas como `/login` y `/register`. Si un usuario ya posee sesión activa, no debe poder ver el formulario de login; es redirigido automáticamente a `/dashboard`.

---

## 7. Comunicación Frontend → Servicios → Supabase

InterAula desacopla completamente los componentes de las consultas a la base de datos:

```text
[ Componente React (ej. ProfileEdit.tsx) ]
                     │
                     ▼ Invoca método de dominio
[ Servicio (profile.service.ts) ]
                     │
                     ▼ Helpers de validación de sesión (getRequiredAuthUser)
                     │
                     ▼ Ejecuta consulta PostgREST
[ Cliente Supabase (lib/supabase.ts) ]
                     │  (HTTP / HTTPS con Header: Bearer <JWT>)
                     ▼
[ Supabase Backend / PostgreSQL con RLS ]
```

### Ventajas de este desacoplamiento:
1. **Mantenibilidad:** Si cambia el nombre de una columna o la estructura de una tabla, solo se modifica el servicio y su interfaz TypeScript; los componentes visuales permanecen intactos.
2. **Reutilización:** Múltiples páginas (`Dashboard`, `ProfileView`, `Navbar`) consumen el mismo método `profileService.getMyProfile()` sin duplicar consultas.
3. **Manejo uniforme de errores:** Las excepciones de red o de autenticación se gestionan centralizadamente en el servicio.

---

## 8. Guardado y Recuperación del Perfil del Usuario

### 8.1. Recuperación
Al cargar `/profile` o `/dashboard`, la aplicación realiza lecturas en paralelo utilizando `Promise.all`:
```ts
const [p, offered, needed, sk, int] = await Promise.all([
  profileService.getMyProfile(),
  profileService.getOfferedSubjects(user.id),
  profileService.getNeededSubjects(user.id),
  profileService.getProfileSkills(user.id),
  profileService.getProfileProjectInterests(user.id),
]);
```
Esto reduce la latencia total, ejecutando las 5 peticiones HTTP concurrentemente en lugar de encadenarlas de forma secuencial.

### 8.2. Guardado y Edición
* La información personal, académica y de disponibilidad se persiste mediante `profileService.updateMyProfile()`, que ejecuta un `update` sobre la tabla `profiles`.
* Las materias que enseña, materias que necesita, habilidades e intereses son listas relacionales N:M (`profile_offered_subjects`, `profile_needed_subjects`, etc.). Cada acción de adición o eliminación se ejecuta como una solicitud atómica e independiente con `upsert` o `delete`.
* **Aclaración técnica rigurosa:** La edición del perfil **no es una transacción ACID única en el cliente**. Cada subsección guarda sus cambios de manera independiente en Supabase para permitir retroalimentación visual inmediata al usuario (por ejemplo, al eliminar o agregar una materia sin necesidad de re-guardar todo el formulario principal).

---

## 9. El Concepto Fundamental de Cuenta Híbrida

En las plataformas universitarias tradicionales existe una división rígida entre "Tutor" y "Estudiante". **InterAula rompe deliberadamente con ese paradigma.**

### Justificación de Ingeniería:
1. **Realidad Académica:** Un estudiante universitario del último año de Ingeniería en Informática puede tener dominio avanzado en *Estructuras de Datos* y desear ofrecer tutorías de esa materia, pero al mismo tiempo necesitar reforzamiento urgente en *Ecuaciones Diferenciales* o *Inglés Técnico*.
2. **Modelo de Datos Unificado:** En la base de datos no existe una columna discriminatoria `role = 'tutor'` ni `role = 'student'`. Existe una única tabla `profiles` con banderas de disponibilidad (`available_for_tutoring`, `available_for_projects`) y tablas intermedias que asocian el mismo `profile_id` a:
   * Materias que enseña (`profile_offered_subjects`).
   * Materias en que necesita ayuda (`profile_needed_subjects`).
   * Habilidades que aporta a proyectos (`profile_skills`).
3. **Beneficio:** Elimina la necesidad de registrar dos cuentas, no obliga al estudiante a "cambiar de rol" en la barra de navegación y fomenta un ecosistema de aprendizaje colaborativo horizontal.

---

## 10. Políticas de Seguridad RLS (Row Level Security)

En Supabase, la seguridad no reside en el frontend ni en una API intermedia, sino en el **motor PostgreSQL** mediante *Row Level Security* (RLS).

Cada solicitud del cliente viaja acompañada del token JWT en el encabezado `Authorization: Bearer <JWT>`. PostgreSQL extrae automáticamente el identificador del usuario mediante la función interna `auth.uid()`.

### Ejemplos reales de políticas en `001_profiles_and_projects.sql`:
1. **Lectura pública de perfiles:**
   ```sql
   CREATE POLICY "Profiles are viewable by authenticated users"
     ON profiles FOR SELECT TO authenticated USING (true);
   ```
   Cualquier estudiante registrado puede consultar la carrera, institución y materias de otro estudiante para coordinar apoyo académico.
2. **Modificación restringida al propio dueño:**
   ```sql
   CREATE POLICY "Users can update their own profile"
     ON profiles FOR UPDATE TO authenticated
     USING (auth.uid() = id);
   ```
   Un usuario malintencionado no puede enviar un `update` modificando el perfil de otro usuario, ya que PostgreSQL bloqueará la operación a nivel de motor si `id != auth.uid()`.
3. **Membresías e integridad en proyectos:**
   Solo el dueño del proyecto puede asignar vacantes o integrar miembros. Un usuario no puede auto-insertarse en un proyecto ajeno sin ser aceptado.

---

## 11. Componentes y Funciones Reutilizadas en la Refactorización

Para evitar sobreingeniería y mantener el código simple para el equipo, se centralizaron únicamente los patrones recurrentes comprobados:

1. **`src/utils/formatters.ts`:**
   * `formatAcademicLevel(level)`: Unifica la traducción de `'basic' | 'intermediate' | 'advanced'` a `'Básico' | 'Intermedio' | 'Avanzado'`, eliminando la duplicación en `ProfileView` y `PublicProfile`.
   * `getUserDisplayName(profile, metadata, email)`: Resuelve en cascada el nombre a mostrar (`Nombre Apellido` $\to$ `display_name` $\to$ `metadata Google` $\to$ `prefijo de correo`).
   * `getUserInitial(name)`: Genera la letra mayúscula del avatar.
2. **`src/utils/validators.ts`:**
   * `isValidUrl(url)`: Valida sintaxis y protocolo (`http:` / `https:`) de enlaces de portafolio, GitHub y LinkedIn.
3. **`src/components/common/EmptyState.tsx`:**
   * Encapsula el contenedor `.ia-empty-box`, ícono centrado, título, texto y botones de acción. Reemplaza bloques de código repetidos en `Dashboard`, `ProfileView`, `TutoringExplore`, `MyTutoring`, `ProjectsHub` y `Resources`.
4. **Subcomponentes de Edición (`src/pages/profile/components/`):**
   * `OfferedSubjectsSection.tsx`
   * `NeededSubjectsSection.tsx`
   * `SkillsSection.tsx`
   * `InterestsSection.tsx`
   * Redujeron `ProfileEdit.tsx` de 948 a ~425 líneas, aislando los estados de formularios secundarios.

---

## 12. Decisiones de Arquitectura y Diseño

| Decisión Tomada | Alternativa Descartada | Justificación Técnica |
| :--- | :--- | :--- |
| **Vanilla CSS con prefijo `.ia-*`** | TailwindCSS / Styled Components | Control total del diseño, sin dependencias complejas de build, fácil de auditar y con identidad visual propia azul/blanca universitaria. |
| **Cliente Supabase directo** | Backend Node.js / Express intermedio | Las políticas RLS de PostgreSQL ya garantizan seguridad a nivel de datos. Un backend Express duplicaría endpoints innecesariamente para simples operaciones CRUD. |
| **API Context nativa** | Redux Toolkit / Zustand | La autenticación es el único estado compartido global. Context API es suficiente, no requiere librerías externas y es estándar en React. |
| **Subcomponentes dedicados** | Formulario monolítico de 950 líneas | Divide la complejidad cognitiva, permite reutilizar estilos y facilita el testing y la comprensión por cualquier miembro del equipo. |

---

## 13. Limitaciones Técnicas Actuales del Sistema

Para responder con honestidad técnica ante una comisión:
1. **Sin WebSockets en tiempo real activos en la UI:** Las actualizaciones de disponibilidad o nuevas materias no se reflejan automáticamente en pantallas de otros usuarios sin recargar o re-navegar.
2. **Sin almacenamiento de archivos binarios (Storage Buckets):** Los avatares provienen de Google OAuth o de iniciales SVG calculadas. Aún no se ha habilitado un bucket en Supabase Storage para subir imágenes de perfil locales desde el dispositivo.
3. **Llamadas no agrupadas en transacciones complejas:** La inserción de materias y habilidades se realiza mediante peticiones REST independientes. Si falla una solicitud de red durante la adición de una materia, las anteriores ya quedaron guardadas.
4. **Validación de correos institucionales:** Actualmente se permite registro con cualquier correo válido; el filtrado estricto por dominio universitario (`@alumnos.institucion.cl`) está proyectado para la fase de producción.

---

## 14. Roadmap y Escalabilidad para Futuros Sprints

La arquitectura refactorizada sienta las bases firmes para los módulos del Capstone:
* **Sprint 2 — Hub de Proyectos Funcional:** Las tablas `projects`, `project_positions`, `project_members` y `project_applications` ya están creadas y tipadas. El frontend consumirá `project.service.ts` para permitir postulaciones a vacantes y gestión de integrantes por el líder del proyecto.
* **Sprint 3 — Agendamiento y Sesiones de Tutoría:** Creación de salas de encuentro, calendario de disponibilidad horaria y confirmación mutua de tutorías.
* **Sprint 4 — Clustering y Algoritmos de Recomendación:** Agrupamiento de estudiantes según materias necesitadas y ofertadas mediante afinidad de perfiles para sugerir tutores o equipos de proyectos compatibles.

---

## 15. Banco de Preguntas y Respuestas para la Defensa Académica

### P1: ¿Por qué conectan directamente el frontend a Supabase en lugar de usar un backend tradicional con Node.js y Express?
> **Respuesta:**  
> "Porque aprovechamos la arquitectura BaaS (*Backend as a Service*) moderna con **Row Level Security (RLS)** directamente en PostgreSQL. Supabase no es solo una base de datos; expone una API REST segura mediante PostgREST. Al definir políticas de seguridad a nivel de fila en la base de datos, el motor de PostgreSQL verifica criptográficamente el token JWT del usuario antes de ejecutar cualquier consulta. Un backend intermedio en Express solo actuaría como un pasamanos de datos (*proxy*), aumentando la latencia, el costo de infraestructura y la superficie de ataque sin aportar valor de negocio en este módulo."

### P2: ¿Cómo evitan que un usuario modifique el perfil de otro estudiante si el cliente hace peticiones directas?
> **Respuesta:**  
> "La seguridad no depende de lo que el cliente envíe. En la base de datos configuramos la política:  
> `CREATE POLICY \"Users can update their own profile\" ON profiles FOR UPDATE USING (auth.uid() = id);`  
> Aunque un atacante intente enviar mediante la consola del navegador una solicitud `UPDATE profiles SET bio = 'hacked' WHERE id = 'otro-id'`, PostgreSQL evalúa `auth.uid() = id`. Dado que el token JWT del atacante contiene su propio ID y no el de la víctima, la base de datos rechaza la instrucción y devuelve 0 filas afectadas o error de permisos."

### P3: ¿Por qué decidieron no separar los roles de 'Tutor' y 'Estudiante'?
> **Respuesta:**  
> "Por el principio de realidad académica y flexibilidad. En la educación superior, un estudiante de informática de cursos superiores domina materias de programación y bases de datos (pudiendo actuar como tutor), pero puede necesitar apoyo en cálculo o inglés. Crear roles estáticos obligaría a los alumnos a tener dos cuentas o a cambiar constantemente de modo. Nuestro modelo de **cuenta híbrida** modela la disponibilidad mediante relaciones en tablas independientes (`profile_offered_subjects` y `profile_needed_subjects`), permitiendo que el usuario enseñe y aprenda simultáneamente con una sola identidad."

### P4: ¿Cómo manejan el ciclo de vida de la sesión si el usuario cierra el navegador?
> **Respuesta:**  
> "El cliente de Supabase almacena el JWT y el Refresh Token en el `localStorage` del navegador. Al recargar o abrir nuevamente el sitio, `AuthContext` ejecuta `supabase.auth.getSession()`. Si el Access Token expiró, el SDK utiliza el Refresh Token para solicitar uno nuevo automáticamente al servidor de autenticación mediante el escuchador `onAuthStateChange`. Si el Refresh Token también expiró o fue revocado, la sesión se limpia y el componente `ProtectedRoute` redirige al usuario a `/login`."

### P5: ¿Qué mejoras concretas aportó la refactorización técnica realizada?
> **Respuesta:**  
> "Eliminamos duplicaciones reales sin añadir sobreingeniería:
> 1. Unificamos la traducción de niveles académicos y el cálculo de nombres e iniciales en módulos utilitarios puros (`formatters.ts`).
> 2. Redujimos el componente monolítico `ProfileEdit.tsx` de casi 1.000 líneas a ~425 líneas, separando la gestión de catálogos en 4 subcomponentes modulares con responsabilidades únicas.
> 3. Creamos el componente reutilizable `EmptyState`, eliminando código JSX repetido en 6 vistas del sistema.
> 4. Limpiamos los servicios (`profile.service.ts` y `project.service.ts`), centralizando la obtención y validación del usuario autenticado en helpers internos.
> Todo el proyecto compila estrictamente en TypeScript con cero errores en `oxlint` y `tsc`."
