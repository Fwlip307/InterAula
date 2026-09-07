# Guía Rápida de Configuración de Supabase para InterAula

Esta guía detalla los pasos manuales para conectar y dejar 100% operativo el sistema de autenticación de **InterAula** con tu nuevo proyecto de Supabase.

---

## 1. Crear el Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com/) e inicia sesión.
2. Haz clic en **New project**.
3. Selecciona tu organización, asigna un nombre al proyecto (ej. `InterAula`), define una contraseña segura para la base de datos y elige la región más cercana (ej. `sa-east-1` - São Paulo).
4. Espera 1-2 minutos a que el aprovisionamiento finalice.

---

## 2. Obtener las Credenciales (Project URL y Publishable Key)

1. En el panel lateral izquierdo de tu proyecto Supabase, entra en **Project Settings** (ícono de engranaje ⚙️ en la parte inferior).
2. Selecciona la pestaña **API**.
3. En la sección **Project API keys** y **Project URL**:
   - **Project URL:** Copia la URL (ej. `https://xyzcompany.supabase.co`).
   - **Project API Keys:** Copia la clave llamada **`anon` / `public`** (o **Publishable Key** si tu proyecto usa el nuevo formato).

> ⚠️ **IMPORTANTE:** Nunca uses la clave `service_role` en el frontend, ya que tiene privilegios de superadministrador.

---

## 3. Crear el archivo `.env.local` en InterAula

En la raíz de este proyecto (`InterAula/FASE 2/EVIDENCIAS PROYECTO/InterAula/`):

1. Crea un archivo llamado `.env.local`.
2. Pega tus credenciales obtenidas en el paso 2:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu-anon-key-o-publishable-key-aqui
```

*(El archivo `.env.local` ya se encuentra protegido e ignorado en `.gitignore` para no filtrarse en Git).*

---

## 4. Configurar las URLs de Redirección en Supabase

Para que la confirmación de correo y la recuperación de contraseñas redirijan correctamente a la aplicación local:

1. En el menú lateral de Supabase, dirígete a **Authentication** > **URL Configuration**.
2. En el campo **Site URL**, ingresa:
   ```text
   http://localhost:5173
   ```
3. En la sección **Redirect URLs**, haz clic en **Add URL** y agrega las siguientes dos rutas:
   - `http://localhost:5173/auth/callback`
   - `http://localhost:5173/update-password`
4. Haz clic en **Save changes**.

---

## 5. Configuración del Proveedor de Correo (Auth)

1. Ve a **Authentication** > **Providers** > **Email**.
2. Asegúrate de que el proveedor **Email** esté activado (**Enabled**).
3. **Confirm email (Recomendado para pruebas o producción):**
   - Si está activado: Al registrarse, Supabase enviará un email con el enlace a `http://localhost:5173/auth/callback`. El usuario no podrá iniciar sesión hasta hacer clic en él.
   - Si lo desactivas temporalmente: El usuario quedará autenticado de inmediato tras el formulario de registro (muy útil para pruebas locales rápidas sin configurar SMTP).

---

## 6. Probar el Flujo Completo

Una vez configurado `.env.local`:

1. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
2. Abre `http://localhost:5173`.
3. Prueba:
   - **Registro:** Crea una cuenta en `/register`.
   - **Login:** Inicia sesión en `/login` (serás redirigido a `/dashboard`).
   - **Sesión persistente:** Recarga la página y comprueba que sigues en `/dashboard`.
   - **Cierre de sesión:** Presiona el botón "Cerrar sesión" en `/dashboard`.
   - **Recuperación:** Solicita un enlace en `/forgot-password` y cámbialo en `/update-password`.
