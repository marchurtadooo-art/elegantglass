#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  GLASSWORK — gestión de obras de aluminio y vidrio. Esta sesión: añadir botón QR
  flotante global, cambiar imagen de login, arreglar bugs (onboarding "Siguiente"
  bloqueado, CameraView con children, Zonas QR sin auth en <Image>).

backend:
  - task: "Endpoint /api/warehouse/zones/{zid}/qr-base64 (nuevo)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Añadido endpoint que retorna QR de zona como JSON {filename, mime, base64} con auth, para que <Image> en RN pueda mostrarlo via data URI."
        -working: true
        -agent: "testing"
        -comment: "Validado vía /app/backend_test.py contra https://site-glass-preview.preview.emergentagent.com/api. (1) Login admin jefe@elegantglass.es OK → access_token recibido. (2) GET /api/warehouse/zones devuelve 4 zonas; primera id=4b95255f-201b-48b1-b1cc-94b6170aa2bf (Zona A — Perfilería). (3) GET /api/warehouse/zones/{valid_zid}/qr-base64 con Bearer → 200 con JSON {filename:'zone-Zona_A_—_Perfilería.png', mime:'image/png', base64:non-empty, qr_code:'ZONE-...'}; el base64 decodifica a bytes que comienzan con la firma PNG (89 50 4E 47). (4) Mismo endpoint sin token → 401 Unauthorized (correcto). (5) GET /api/warehouse/zones/non-existent-id/qr-base64 con token → 404 'Zona no encontrada' (correcto). Endpoint funciona como se espera; ningún otro endpoint retesteado por instrucción explícita."
  - task: "Endpoints existentes Warehouse"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "No se modificaron endpoints existentes en esta sesión, solo se agregó uno nuevo."

frontend:
  - task: "Onboarding Siguiente bug fix (P0)"
    implemented: true
    working: true
    file: "frontend/app/onboarding.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: false
        -agent: "main"
        -comment: "FlatList con scrollToOffset+Dimensions.get('window').width fallaba en web tras 3 clicks porque la anchura real del FlatList no coincidía con la del window."
        -working: true
        -agent: "main"
        -comment: "Reescrito sin FlatList: render de slide única basada en estado index, animación fade con Animated.View, botones atrás/saltar/siguiente, dots clickeables. Verificado en web: 5 clicks consecutivos sin atascarse."
  - task: "Floating QR FAB global"
    implemented: true
    working: true
    file: "frontend/src/QrFab.tsx, (worker)/_layout.tsx, (manager)/_layout.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "FAB circular negro con QR siempre visible (excepto en /warehouse/scan), navega a /warehouse/scan con haptics. Verificado por screenshot."
  - task: "Login background image change"
    implemented: true
    working: true
    file: "frontend/app/login.tsx"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Cambiada imagen a customer-assets URL provista por el usuario (interior con grandes ventanales y vista al mar). Overlay reducido al 35% para dejar lucir la imagen."
  - task: "CameraView children warning fix"
    implemented: true
    working: true
    file: "frontend/app/warehouse/scan.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Movido el overlay (frame + hint) fuera de CameraView usando StyleSheet.absoluteFill y pointerEvents='none'. Elimina el warning."
  - task: "Zones QR image auth fix"
    implemented: true
    working: "NA"
    file: "frontend/app/warehouse/zones.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Antes: <Image source={{ uri: BACKEND/api/.../qr.png }}> sin Authorization → fallaba en mobile. Ahora se hace api.get('/warehouse/zones/{id}/qr-base64') con auth y se renderiza data URI."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 5
  run_ui: false

test_plan:
  current_focus:
    - "Endpoint /api/warehouse/zones/{zid}/qr-base64 (nuevo)"
    - "Zones QR image auth fix"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Cambios de esta sesión: (1) FAB QR global añadido en ambos roles. (2) Imagen del login actualizada al asset que envió el usuario. (3) Bug del onboarding 'Siguiente' arreglado reemplazando FlatList por render condicional + Animated fade. (4) CameraView ya no tiene children. (5) Nuevo endpoint /api/warehouse/zones/{zid}/qr-base64 para obtener QR de zona con auth. Por favor testea SOLO el nuevo endpoint con admin (jefe@elegantglass.es / Admin1234!) y verifica que (a) responde 200 con {filename,mime,base64,qr_code}, (b) responde 401 sin token, (c) responde 404 con zid inválido. NO testear endpoints ya verificados."
    -agent: "testing"
    -message: "Endpoint GET /api/warehouse/zones/{zid}/qr-base64 verificado con backend_test.py. Resultados: login admin OK, list zones devuelve 4 zonas, GET con token válido → 200 con {filename, mime:'image/png', base64 (PNG válido — magic 89 50 4E 47), qr_code}, GET sin token → 401, GET con id inexistente → 404. Todos los criterios del review request pasan. No se testearon otros endpoints según instrucción explícita."
