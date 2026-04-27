# GLASSWORK — PRD

## Producto
GLASSWORK es una app móvil full-stack para empresas de carpintería de aluminio y vidrio. Gestiona obras desde el campo (operarios) y desde la oficina (jefes/admins).

## Stack
- **Backend**: FastAPI + MongoDB (Motor async) + JWT (bcrypt + PyJWT, access 15min, refresh 7d).
- **Frontend**: React Native Expo SDK 54 + Expo Router, axios + interceptor con auto-refresh, expo-secure-store (tokens), expo-camera/picker/manipulator, expo-local-authentication, expo-haptics.
- **Storage**: Imágenes guardadas como base64 en MongoDB (sin servicios externos).
- **Diseño**: Monocromo industrial (#0A0A0A / #F5F5F2) + colores semánticos solo para estado.

## Roles
- **WORKER (operario)**: NO ve costes (€) en ningún sitio — backend strip-cost + frontend role-aware.
- **MANAGER / ADMIN (jefe)**: ve presupuesto, gasto, balance, equipo, reportes.

## Funcionalidades implementadas (MVP)
- Auth: login, registro de empresa, refresh, biometría (FaceID/huella).
- **WORKER**: Inicio (obras de hoy + acciones rápidas), Mis obras, Parte diario (form completo con horas stepper, descripción, clima, % avance, incidentes, foto), Historial, Perfil.
- **MANAGER/ADMIN**: Dashboard (6 KPIs + gasto por obra + feed fotos + alertas), Obras (filtros + FAB), Detalle de obra (Resumen/Partes/Fotos/Material/Balance/Equipo + aprobación de partes), Crear/editar obra (wizard 4 pasos), Equipo (invitar, rol, stats), Reportes semanales (generar resumen JSON), Alertas, Ajustes, Catálogo de materiales (50 ítems sembrados con marcas reales).
- Foto capture con compresión a max 1280px JPEG y conversión base64.
- Material register con catálogo y tipos PURCHASE/USAGE/RETURN.
- Alertas auto-generadas cuando se reporta incidente en parte.
- Reportes semanales con métricas agregadas (gasto, partes, fotos, incidentes).

## Seed
- 1 empresa "Aluminios Elegant Glass" (Calvià, Mallorca).
- 4 usuarios: 1 admin + 3 operarios con nombres españoles.
- 4 obras (active/active/pending/paused).
- 50 materiales reales (Cortizo, Schüco, Reynaers, Saint-Gobain, Roto, Bostik, Sika...).
- 20 partes diarios, 30 fotos placeholder, 40 entradas de material, 3 alertas, 2 reportes semanales.

## Configuración EAS / Build
- `app.json` con bundleId `com.elegantglass.glasswork`, permisos iOS/Android (CAMERA, READ_MEDIA_IMAGES, ACCESS_FINE_LOCATION, NSFaceIDUsageDescription, etc.), splash y plugins de cámara/picker/biometría.

## Pendiente / fuera del alcance MVP
- Generación real de PDF/Excel (actualmente devuelve JSON summary; UI con botones Ver PDF/Excel placeholders).
- Modo offline con cola persistente (MMKV) — actualmente solo network-first.
- Push notifications (configurado en app.json pero requiere build EAS para activar).
- Importar materiales desde CSV (UI no expuesta).
- OTP/email de password reset (no hay servicio email — endpoint omitido).

## Idea de monetización (B2B SaaS)
Plan **GLASSWORK Pro**: €19/operario/mes con límite de obras activas en plan free (3). Upsell para reportes PDF/Excel, integración con software ERP, multi-empresa para grupos, y firma digital del cliente sobre el parte (gancho ya identificado en backend al ser PENDING/APPROVED).
