# GLASSWORK — PRD

## Producto
GLASSWORK es una app móvil full-stack para empresas de carpintería de aluminio y vidrio. Gestiona obras desde el campo (operarios) y desde la oficina (jefes/admins).

## Stack
- **Backend**: FastAPI + MongoDB (Motor async) + JWT (bcrypt + PyJWT, access 15min, refresh 7d auto-refresh).
- **Frontend**: React Native Expo SDK 54 + Expo Router, axios + interceptor, expo-secure-store (tokens), expo-camera/picker/manipulator, expo-local-authentication, expo-haptics, expo-file-system + expo-sharing (descargas), Image base64.
- **Reportes**: reportlab (PDF) + openpyxl (Excel) — generación real, sin APIs externas.
- **Storage**: Imágenes guardadas como base64 en MongoDB (sin servicios externos).
- **Diseño**: Monocromo industrial (#0A0A0A / #F5F5F2) + colores semánticos solo para estado.

## Roles
- **WORKER (operario)**: NO ve costes (€) en ningún sitio — backend strip-cost + frontend role-aware.
- **MANAGER / ADMIN (jefe)**: ve presupuesto, gasto, balance, equipo, reportes.

## Funcionalidades implementadas (todas funcionales)

**Auth**: login, registro de empresa, biometría (FaceID/huella), recuperar contraseña (formulario que registra solicitud — sin email externo).

**Operario**: Inicio (obras de hoy + acciones rápidas), Mis obras, Parte diario (form completo), Historial, Perfil con edición (nombre/teléfono) y exportación GDPR.

**Manager/Admin**: 
- Dashboard con KPIs reales, gráfica de gasto por obra, **feed fotográfico real** (Image base64), alertas.
- Obras con filtros y FAB para crear.
- Detalle con tabs Resumen/Partes/Fotos/Material/Balance/Equipo. **Visor fullscreen de fotos** con caption + autor.
- Crear/editar obra (wizard 4 pasos).
- Equipo con invitar/cambiar rol.
- **Reportes semanales**: PDF real (reportlab, con resumen ejecutivo + tablas de obras/partes/categorías) y Excel real (openpyxl, hojas Resumen/Obras/Partes/Materiales).
- Catálogo de materiales con FAB para añadir nuevo material (nombre, unidad, categoría, precio, proveedor).
- Alertas con marcar como leído.
- Ajustes con edición de empresa (nombre, dirección, teléfono, email), edición de perfil propio, exportación GDPR funcional, toggles de notificaciones.

## Descargas (PDF/Excel/GDPR)
- Backend devuelve `{ filename, mime, base64 }`.
- Frontend (`src/files.ts`):
  - **Web**: convierte base64 → Blob → click en `<a download>` para descarga directa.
  - **Móvil**: `FileSystem.writeAsStringAsync` + `Sharing.shareAsync` → menú nativo de compartir (Save to Files, AirDrop, Mail, etc.).

## Seed
- 1 empresa "Aluminios Elegant Glass" (Calvià, Mallorca).
- 4 usuarios: 1 admin + 3 operarios.
- 4 obras (active/active/pending/paused).
- 50 materiales reales (Cortizo, Schüco, Reynaers, Saint-Gobain, Roto, Bostik, Sika...).
- 20 partes diarios, 30 fotos, 40 entradas de material, 3 alertas, 2 reportes semanales.

## Configuración EAS / Build
- `app.json` con bundleId `com.elegantglass.glasswork`, permisos iOS/Android (CAMERA, READ_MEDIA_IMAGES, ACCESS_FINE_LOCATION, NSFaceIDUsageDescription, etc.).

## Pendiente (iteraciones futuras)
- Modo offline real con MMKV / queue persistente.
- Push notifications activas (configuradas en app.json, pero requieren build EAS).
- Email automático para reset de contraseña (requiere SendGrid/Resend + API key).

## Idea de monetización (B2B SaaS)
Plan **GLASSWORK Pro**: €19/operario/mes con límite de 3 obras activas en plan free. Upsell para reportes PDF/Excel ilimitados, multi-empresa para grupos, y firma digital del cliente sobre el parte (gancho ya disponible al ser PENDING/APPROVED).
