// ════════════════════════════════════════════════════════════════
// POLICALC v2 — Frontend completo con matriz mensual
// ════════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://uhdglwjpghdfjjmzwtub.supabase.co'
const SUPABASE_KEY = 'sb_publishable_WgbN4yhsgSQwReeRiPgFbw_gGb205J7'

const { createClient } = supabase
const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

const INDICES_META = {
  'IPC':    {label:'IPC General (INDEC)',        color:'tag-green'},
  'IPCNQN': {label:'IPC Neuquén',                color:'tag-green'},
  'IPIM':   {label:'IPIM General (INDEC)',        color:'tag-amber'},
  'CCT':    {label:'CCT 644/12 Petroleros',       color:'tag-blue'},
  'UTHGRA': {label:'UTHGRA Gastronomía/Hotelería',color:'tag-blue'},
  'FADEEAC':{label:'FADEEAC Transporte Cargas',   color:'tag-amber'},
  'CAC':    {label:'CAC Construcción',            color:'tag-purple'},
  'USD':    {label:'Dólar Oficial BNA',           color:'tag-red'},
  'GR3':    {label:'GR3 Gasoil YPF',             color:'tag-purple'},
}

let currentUser = null
let currentOrg = null
let formulas = []
let contratos = []
let contratoActual = null
let indicesValores = {}

window.onload = async () => {
  const hashParams = new URLSearchParams(window.location.hash.substring(1))
  if (hashParams.get('access_token')) {
    const { data } = await sb.auth.getSession()
    if (data.session) { await loadUserData(); showApp(); window.history.replaceState(null, '', window.location.pathname); return }
  }
  const { data: { session } } = await sb.auth.getSession()
  if (!session) { showLogin() } else { await loadUserData(); showApp() }
  setInterval(checkAlertas, 30000)
  setInterval(updateClock, 1000)
  updateClock()
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex'
  document.getElementById('app-shell').style.display = 'none'
  document.getElementById('login-content').innerHTML = `
    <button class="btn btn-accent" style="width:100%;margin-bottom:16px;padding:12px" onclick="loginWithGitHub()">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      Continuar con GitHub
    </button>
    <div style="position:relative;margin:20px 0">
      <div style="position:absolute;top:50%;left:0;right:0;height:1px;background:var(--border)"></div>
      <div style="position:relative;text-align:center;background:var(--surface);display:inline-block;padding:0 12px;color:var(--text3);font-size:11px;left:50%;transform:translateX(-50%)">O con email</div>
    </div>
    <input type="email" id="email-input" placeholder="Email"/>
    <input type="password" id="pw-input" placeholder="Contraseña" onkeydown="if(event.key==='Enter')doLogin()"/>
    <button class="btn btn-ghost" style="width:100%;margin-top:6px" onclick="doLogin()">Ingresar con email</button>
    <div class="login-msg" id="login-msg"></div>
    <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px" onclick="showSignup()">Crear cuenta nueva</button>
    <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:6px;color:var(--text3)" onclick="showRecuperar()">¿Olvidaste tu contraseña?</button>
  `
}

function showRecuperar() {
  document.getElementById('login-content').innerHTML = `
    <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;color:var(--text)">Recuperar contraseña</h3>
    <p style="font-size:12px;color:var(--text3);margin-bottom:16px;line-height:1.5">
      Ingresá tu email y te enviamos un link para restablecer tu contraseña.
    </p>
    <input type="email" id="email-recuperar" placeholder="Tu email" autofocus/>
    <button class="btn btn-accent" style="width:100%;margin-top:6px" onclick="enviarRecuperar()">Enviar link</button>
    <div class="login-msg" id="login-msg"></div>
    <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:12px" onclick="showLogin()">← Volver al login</button>
  `
}

async function enviarRecuperar() {
  const email = document.getElementById('email-recuperar').value.trim()
  const msg = document.getElementById('login-msg')
  if (!email) { msg.textContent = 'Ingresá tu email'; msg.className = 'login-msg err'; return }
  
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  })
  
  if (error) {
    msg.textContent = error.message
    msg.className = 'login-msg err'
  } else {
    msg.textContent = '✓ Email enviado — revisá tu bandeja de entrada'
    msg.className = 'login-msg'
    msg.style.color = 'var(--green)'
  }
}

function showSignup() {
  document.getElementById('login-content').innerHTML = `
    <input type="text" id="nombre-input" placeholder="Nombre completo" autofocus/>
    <input type="email" id="email-input" placeholder="Email"/>
    <input type="password" id="pw-input" placeholder="Contraseña (min 6 caracteres)"/>
    <input type="password" id="pw2-input" placeholder="Confirmar contraseña"/>
    <button class="btn btn-accent" style="width:100%;margin-top:6px" onclick="doSignup()">Crear cuenta</button>
    <div class="login-msg" id="login-msg"></div>
    <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:12px" onclick="showLogin()">Ya tengo cuenta</button>
  `
}

async function loginWithGitHub() {
  const { error } = await sb.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin } })
  if (error) toast('Error: ' + error.message, 'error')
}

async function doLogin() {
  const email = document.getElementById('email-input').value
  const pw = document.getElementById('pw-input').value
  const msg = document.getElementById('login-msg')
  if (!email || !pw) { msg.textContent = 'Completá todos los campos'; msg.className = 'login-msg err'; return }
  const { error } = await sb.auth.signInWithPassword({ email, password: pw })
  if (error) { msg.textContent = error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message; msg.className = 'login-msg err' }
  else { await loadUserData(); showApp() }
}

async function doSignup() {
  const nombre = document.getElementById('nombre-input').value
  const email = document.getElementById('email-input').value
  const pw = document.getElementById('pw-input').value
  const pw2 = document.getElementById('pw2-input').value
  const msg = document.getElementById('login-msg')
  if (!nombre || !email || !pw) { msg.textContent = 'Completá todos los campos'; msg.className = 'login-msg err'; return }
  if (pw.length < 6) { msg.textContent = 'La contraseña debe tener mínimo 6 caracteres'; msg.className = 'login-msg err'; return }
  if (pw !== pw2) { msg.textContent = 'Las contraseñas no coinciden'; msg.className = 'login-msg err'; return }
  const { error } = await sb.auth.signUp({ email, password: pw, options: { data: { nombre } } })
  if (error) { msg.textContent = error.message; msg.className = 'login-msg err' }
  else { msg.textContent = 'Cuenta creada — verificá tu email'; msg.className = 'login-msg' }
}

async function logout() { await sb.auth.signOut(); location.reload() }

async function loadUserData() {
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return
  const { data: userData } = await sb.from('usuarios').select('*, org:organizaciones(*)').eq('id', user.id).single()
  if (!userData || !userData.org) { toast('Usuario sin organización asignada', 'error'); await sb.auth.signOut(); return }
  currentUser = userData
  currentOrg = userData.org
  document.getElementById('org-name-display').textContent = currentOrg.nombre
  document.getElementById('user-info-display').textContent = `${userData.nombre || userData.email} (${userData.rol})`
  await Promise.all([loadFormulas(), loadContratos(), loadIndicesValores()])
  await checkAlertas()
}

async function loadFormulas() {
  const { data } = await sb.from('formulas').select('*').eq('org_id', currentOrg.id)
  formulas = data || []
}

async function loadContratos() {
  const { data } = await sb.from('contratos').select('*').eq('org_id', currentOrg.id).order('created_at', { ascending: false })
  contratos = data || []
}

async function loadIndicesValores() {
  const { data } = await sb.from('indices_valores').select('*').or(`org_id.is.null,org_id.eq.${currentOrg.id}`)
  indicesValores = {}
  data?.forEach(row => {
    if (!indicesValores[row.codigo]) indicesValores[row.codigo] = {}
    indicesValores[row.codigo][row.periodo] = { valor: parseFloat(row.valor), source: row.org_id ? 'manual' : 'auto' }
  })
}

// ════ AUDITORÍA — Registrar eventos ════
async function registrarAuditoria(accion, entidad, entidad_id, entidad_nombre, detalle = {}) {
  try {
    await sb.from('auditoria').insert({
      org_id: currentOrg.id,
      usuario_id: currentUser.id,
      usuario_nombre: currentUser.nombre || currentUser.email,
      accion,
      entidad,
      entidad_id: entidad_id || null,
      entidad_nombre: entidad_nombre || null,
      detalle
    })
  } catch (e) {
    console.error('Error registrando auditoría:', e)
  }
}

async function checkAlertas() {
  const { count } = await sb.from('alertas').select('*', { count: 'exact', head: true }).eq('org_id', currentOrg.id).eq('leida', false)
  const badge = document.getElementById('alertas-badge')
  if (count > 0) { badge.textContent = count; badge.style.display = 'inline-block' } else { badge.style.display = 'none' }
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none'
  document.getElementById('app-shell').style.display = 'grid'

  // Mostrar item Admin solo para superadmin
  if (currentUser?.rol === 'superadmin') {
    const navAdmin = document.getElementById('nav-admin-container')
    if (navAdmin) {
      navAdmin.innerHTML = `
        <div style="height:1px;background:var(--border);margin:8px 0"></div>
        <div class="nav-item" onclick="goPage('admin')">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="8" cy="5" r="2.5"/>
            <path d="M2,13 C2,10.2 4.7,8 8,8 C11.3,8 14,10.2 14,13"/>
            <circle cx="13" cy="4" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
          Admin
        </div>
        <div class="nav-item" onclick="goPage('timeline')">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="2" y1="4" x2="14" y2="4"/>
            <line x1="2" y1="8" x2="14" y2="8"/>
            <line x1="2" y1="12" x2="10" y2="12"/>
            <circle cx="5" cy="4" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="9" cy="8" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="7" cy="12" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
          Timeline
        </div>
        <div class="nav-item" onclick="goPage('crm')">
          <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="6" cy="5" r="2.5"/>
            <path d="M1,13 C1,10.5 3.2,8.5 6,8.5 C8.8,8.5 11,10.5 11,13"/>
            <line x1="13" y1="5" x2="13" y2="9"/>
            <line x1="11" y1="7" x2="15" y2="7"/>
          </svg>
          CRM
        </div>`
    }
  }

  goPage('matriz')
}

function updateClock() {
  const el = document.getElementById('footer-clock')
  if (el) el.textContent = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function goPage(page) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'))
  const idx = { 'matriz': 0, 'contratos': 1, 'hist': 2, 'form': 3, 'indices': 4, 'alertas': 5, 'admin': 6, 'timeline': 7, 'crm': 8 }[page]
  document.querySelectorAll('.nav-item')[idx]?.classList.add('active')
  if (page === 'matriz') renderMatriz()
  else if (page === 'contratos') renderContratos()
  else if (page === 'hist') renderHistorial()
  else if (page === 'form') renderFormulas()
  else if (page === 'indices') renderIndices()
  else if (page === 'alertas') renderAlertas()
  else if (page === 'admin') renderAdmin()
  else if (page === 'timeline') renderTimeline()
  else if (page === 'crm') renderCRM()
}

// ════ HELPER CENTRAL — parsea componentes sin importar el formato ════
function parseComponentes(c) {
  if (Array.isArray(c)) return c
  if (typeof c === 'string') { try { return JSON.parse(c) } catch(e) { return [] } }
  if (c && typeof c === 'object') return Object.values(c)
  return []
}

function renderMatriz() {
  let html = `
    <div class="page-head">
      <div>
        <div class="page-title">Matriz de actualización</div>
        <div class="page-sub">Cálculo mensual con fórmula polinómica</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="generarInforme()">📄 PDF</button>
        <button class="btn btn-ghost btn-sm" onclick="exportarExcel()">↓ Excel</button>
        <button class="btn btn-accent btn-sm" onclick="guardarCalculo()">💾 Guardar</button>
      </div>
    </div>

    <!-- Panel de configuración colapsable -->
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="toggleConfigMatriz()">
        <div class="card-title" style="margin:0">⚙️ Configuración del cálculo</div>
        <span id="config-toggle-icon" style="color:var(--text3);font-size:12px">▼</span>
      </div>
      <div id="config-matriz" style="margin-top:14px">
        <div class="grid-4" style="margin-bottom:12px">
          <div class="input-group" style="margin:0">
            <label>Contrato guardado</label>
            <select id="contrato-select" onchange="cargarContrato(this.value)">
              <option value="" disabled selected>Seleccioná un contrato guardado...</option>
            <option value="">➕ Nuevo cálculo sin guardar</option>
              ${contratos.map(c => `<option value="${c.id}" ${contratoActual?.id === c.id ? 'selected' : ''}>${c.nombre}</option>`).join('')}
            </select>
          </div>
          <div class="input-group" style="margin:0">
            <label>Nombre del cálculo</label>
            <input type="text" id="contrato-nombre" placeholder="Ej: Chevron 2024-2026" value="${contratoActual?.nombre || ''}"/>
          </div>
          <div class="input-group" style="margin:0">
            <label>Fórmula polinómica</label>
            <select id="contrato-formula">
              ${formulas.map(f => `<option value="${f.id}" ${contratoActual?.formula_id === f.id ? 'selected' : ''}>${f.nombre}</option>`).join('')}
            </select>
          </div>
          <div class="input-group" style="margin:0">
            <label>Monto base ($)</label>
            <input type="number" id="contrato-monto" value="${contratoActual?.monto_base || 1000000}" step="0.01"/>
          </div>
        </div>
        <div class="grid-2">
          <div class="input-group" style="margin:0">
            <label>Período desde</label>
            <div style="display:flex;gap:6px">
              <select id="mes-desde" style="flex:1"></select>
              <input type="number" id="anio-desde" value="2024" min="2020" max="2030" style="width:80px"/>
            </div>
          </div>
          <div class="input-group" style="margin:0">
            <label>Período hasta</label>
            <div style="display:flex;gap:6px">
              <select id="mes-hasta" style="flex:1"></select>
              <input type="number" id="anio-hasta" value="2026" min="2020" max="2030" style="width:80px"/>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
          <button class="btn btn-accent" onclick="calcularMatriz()">📊 Calcular matriz</button>
          <button class="btn btn-ghost btn-sm" onclick="guardarContrato()">💾 Guardar contrato</button>
        </div>
      </div>
    </div>

    <!-- Resumen ejecutivo — se llena al calcular -->
    <div id="resumen-ejecutivo" style="display:none;margin-bottom:16px">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
        <div class="card" style="padding:16px;border-color:rgba(232,255,71,0.2)">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">Monto base</div>
          <div id="kpi-monto-base" style="font-size:20px;font-weight:800;color:var(--text)">—</div>
        </div>
        <div class="card" style="padding:16px;border-color:rgba(74,222,128,0.2)">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">Monto actualizado</div>
          <div id="kpi-monto-act" style="font-size:20px;font-weight:800;color:#4ade80">—</div>
        </div>
        <div class="card" style="padding:16px">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">Variación acumulada</div>
          <div id="kpi-var-acum" style="font-size:24px;font-weight:800">—</div>
        </div>
        <div class="card" style="padding:16px">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">Período</div>
          <div id="kpi-periodo" style="font-size:13px;font-weight:600;color:var(--text2);margin-top:4px">—</div>
          <div id="kpi-meses" style="font-size:11px;color:var(--text3);margin-top:2px">—</div>
        </div>
      </div>
    </div>

    <!-- Tabla de índices con estado -->
    <div id="indices-estado-matriz" style="display:none;margin-bottom:16px"></div>

    <!-- Estado vacío con guía -->
    <div id="matriz-vacio" style="display:block">
      <div class="card" style="text-align:center;padding:48px 32px;border:1px dashed var(--border2)">
        <div style="font-size:40px;margin-bottom:16px">📊</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:8px">Calculá tu primera matriz</div>
        <div style="color:var(--text3);font-size:13px;margin-bottom:28px;max-width:400px;margin-left:auto;margin-right:auto;line-height:1.6">
          Completá la configuración y hacé click en <strong style="color:var(--accent)">Calcular matriz</strong> para ver los resultados
        </div>
        <div style="display:flex;justify-content:center;gap:32px;flex-wrap:wrap;margin-bottom:28px">
          <div style="text-align:center">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--accent);color:#0a0a0a;font-weight:800;font-size:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 8px">1</div>
            <div style="font-size:12px;color:var(--text2)">Elegí la fórmula</div>
          </div>
          <div style="width:1px;background:var(--border);align-self:stretch;margin:0 8px"></div>
          <div style="text-align:center">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--surface3);color:var(--text2);font-weight:800;font-size:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 8px">2</div>
            <div style="font-size:12px;color:var(--text2)">Ingresá el monto base</div>
          </div>
          <div style="width:1px;background:var(--border);align-self:stretch;margin:0 8px"></div>
          <div style="text-align:center">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--surface3);color:var(--text2);font-weight:800;font-size:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 8px">3</div>
            <div style="font-size:12px;color:var(--text2)">Definí el período</div>
          </div>
          <div style="width:1px;background:var(--border);align-self:stretch;margin:0 8px"></div>
          <div style="text-align:center">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--surface3);color:var(--text2);font-weight:800;font-size:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 8px">4</div>
            <div style="font-size:12px;color:var(--text2)">Calculá</div>
          </div>
        </div>
        ${formulas.length === 0 ? `
        <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:14px 20px;display:inline-block;margin-bottom:16px">
          <div style="font-size:13px;color:#f59e0b;font-weight:500;margin-bottom:4px">⚠ No tenés fórmulas creadas</div>
          <div style="font-size:12px;color:var(--text3)">Antes de calcular necesitás crear una fórmula polinómica</div>
        </div>
        <br/>
        <button class="btn btn-accent" onclick="goPage('form')">→ Ir a Fórmulas</button>` : 
        `<button class="btn btn-accent" onclick="document.getElementById('config-matriz').style.display='block';document.getElementById('config-toggle-icon').textContent='▼';document.getElementById('matriz-vacio').style.display='none'">
          📊 Comenzar cálculo
        </button>`}
      </div>
    </div>

    <!-- Resultado de la tabla -->
    <div id="matriz-resultado"></div>
  `
  document.getElementById('page-content').innerHTML = html
  ;['mes-desde', 'mes-hasta'].forEach(id => {
    const s = document.getElementById(id)
    s.innerHTML = MESES_LARGO.map((m, i) => `<option value="${i}">${m}</option>`).join('')
  })
  document.getElementById('mes-desde').value = 8
  document.getElementById('mes-hasta').value = 2
  if (contratoActual) { calcularMatriz() } else {
    // Sin contrato: mostrar config expandida
    const vacioEl = document.getElementById('matriz-vacio')
    if (vacioEl) vacioEl.style.display = 'block'
  }
}

function toggleConfigMatriz() {
  const el = document.getElementById('config-matriz')
  const icon = document.getElementById('config-toggle-icon')
  const visible = el.style.display !== 'none'
  el.style.display = visible ? 'none' : 'block'
  icon.textContent = visible ? '▶' : '▼'
}

async function cargarContrato(id) {
  if (!id) { contratoActual = null; renderMatriz(); return }
  const { data } = await sb.from('contratos').select('*').eq('id', id).single()
  contratoActual = data; renderMatriz()
}

function calcularMatriz() {
  const formulaId = document.getElementById('contrato-formula').value
  const formula = formulas.find(f => f.id === formulaId)
  if (!formula) { toast('Seleccioná una fórmula', 'error'); return }
  const monto = parseFloat(document.getElementById('contrato-monto').value) || 0
  const mesDesde = parseInt(document.getElementById('mes-desde').value)
  const anioDesde = parseInt(document.getElementById('anio-desde').value)
  const mesHasta = parseInt(document.getElementById('mes-hasta').value)
  const anioHasta = parseInt(document.getElementById('anio-hasta').value)
  const periodos = []
  let y = anioDesde, m = mesDesde
  for (let i = 0; i < 200; i++) {
    periodos.push({ y, m, key: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${MESES_CORTO[m]}-${String(y).slice(2)}` })
    if (y === anioHasta && m === mesHasta) break
    m++; if (m > 11) { m = 0; y++ }
  }
  renderMatrizTabla(formula, periodos, monto)
}

function renderMatrizTabla(formula, periodos, montoBase) {
  const componentes = parseComponentes(formula.componentes)
  const valoresPorIndice = {}
  const pkPrev = getPeriodoPrevio(periodos[0])
  componentes.forEach(comp => { valoresPorIndice[comp.codigo] = periodos.map(p => getValue(comp.codigo, p.key)) })

  const totalesMensuales = periodos.map((p, i) => {
    let total = 0, tieneDatos = false, faltanDatos = []
    componentes.forEach(comp => {
      const v0 = i === 0 ? getValue(comp.codigo, pkPrev) : valoresPorIndice[comp.codigo][i - 1]
      const v1 = valoresPorIndice[comp.codigo][i]
      if (!v0 || !v1 || v0 === 0) { faltanDatos.push(comp.codigo); return }
      total += ((v1 - v0) / v0) * 100 * (comp.coef / 100)
      tieneDatos = true
    })
    return { val: total, valid: tieneDatos, faltanDatos }
  })

  let monto = montoBase
  const montos = [monto]
  totalesMensuales.forEach(t => { if (t.valid) monto = monto * (1 + t.val / 100); montos.push(monto) })

  // Calcular acumulado final
  let acumFinal = 0
  totalesMensuales.forEach(t => { if (t.valid) acumFinal = ((1 + acumFinal/100)*(1 + t.val/100)-1)*100 })
  const montoFinal = montos[montos.length - 1]
  const positivo = acumFinal >= 0

  // ── Actualizar KPIs del resumen ejecutivo ──
  const resumen = document.getElementById('resumen-ejecutivo')
  if (resumen) {
    resumen.style.display = 'block'
    document.getElementById('kpi-monto-base').textContent = '$' + montoBase.toLocaleString('es-AR',{maximumFractionDigits:0})
    document.getElementById('kpi-monto-act').textContent = '$' + montoFinal.toLocaleString('es-AR',{maximumFractionDigits:0})
    document.getElementById('kpi-monto-act').style.color = positivo ? '#4ade80' : '#ef4444'
    const kpiVar = document.getElementById('kpi-var-acum')
    kpiVar.textContent = (positivo?'+':'') + acumFinal.toFixed(2) + '%'
    kpiVar.style.color = positivo ? '#4ade80' : '#ef4444'
    document.getElementById('kpi-periodo').textContent = periodos[0].label + ' → ' + periodos[periodos.length-1].label
    document.getElementById('kpi-meses').textContent = periodos.length + ' meses analizados'
  }

  // ── Estado de índices ──
  const indicesEl = document.getElementById('indices-estado-matriz')
  if (indicesEl) {
    indicesEl.style.display = 'block'
    const chips = componentes.map(comp => {
      const tieneActual = getValue(comp.codigo, periodos[periodos.length-1].key)
      const color = tieneActual ? '#4ade80' : '#f59e0b'
      const estado = tieneActual ? '● OK' : '⚠ Sin dato'
      return `<div style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--surface2);border:1px solid ${color}33;border-radius:99px;font-size:12px">
        <span class="tag ${INDICES_META[comp.codigo]?.color||'tag-blue'}" style="font-size:10px">${comp.codigo}</span>
        <span style="color:var(--text2)">${comp.coef}%</span>
        <span style="color:${color};font-size:11px">${estado}</span>
      </div>`
    }).join('')
    indicesEl.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap;padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius)">${chips}</div>`
  }

  // ── Tabla principal ──
  let html = `
    <div class="card" style="margin-top:4px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div class="card-title" style="margin:0">📋 Matriz mensual — ${formula.nombre}</div>
        <div style="font-size:12px;color:var(--text3)">${periodos.length} períodos · ${componentes.length} índices</div>
      </div>
      <div class="matrix-wrap">
        <table class="matrix">
          <thead><tr>
            <th class="idx-col">Componente</th>
            ${periodos.map(p => {
              const mesConDatos = componentes.every(c => getValue(c.codigo, p.key) !== null)
              return `<th style="${mesConDatos?'':'color:var(--amber)'}">${p.label}${mesConDatos?'':' ⚠'}</th>`
            }).join('')}
            <th class="col-total">Total</th>
          </tr></thead>
          <tbody>
  `

  componentes.forEach(comp => {
    const meta = INDICES_META[comp.codigo] || { label: comp.codigo, color: 'tag-blue' }
    html += `<tr class="row-idx">
      <td class="idx-col">
        <span class="tag ${meta.color}">${comp.codigo}</span>
        <span style="color:var(--text3);font-size:10px;margin-left:6px">${comp.coef}%</span>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">${meta.label}</div>
      </td>`
    let sumVar = 0
    periodos.forEach((p, i) => {
      const v0 = i === 0 ? getValue(comp.codigo, pkPrev) : valoresPorIndice[comp.codigo][i - 1]
      const v1 = valoresPorIndice[comp.codigo][i]
      let varPct = null
      if (v0 && v1 && v0 !== 0) { varPct = ((v1 - v0) / v0) * 100; sumVar += varPct }
      const cls = varPct !== null ? (varPct >= 0 ? 'pct-pos' : 'pct-neg') : ''
      html += `<td title="${v1 ? 'Valor: '+v1.toFixed(2) : 'Sin dato'}">
        ${varPct != null
          ? `<span class="${cls}">${varPct >= 0 ? '+' : ''}${varPct.toFixed(2)}%</span>`
          : '<span style="color:var(--text4)">—</span>'}
      </td>`
    })
    html += `<td class="col-total">${sumVar !== 0 ? (sumVar>=0?'+':'')+sumVar.toFixed(2)+'%' : '—'}</td></tr>`

    html += `<tr class="row-afec"><td class="idx-col" style="padding-left:24px;font-size:11px;color:var(--text3)">↳ Afección ponderada</td>`
    let sumAfec = 0
    periodos.forEach((p, i) => {
      const v0 = i === 0 ? getValue(comp.codigo, pkPrev) : valoresPorIndice[comp.codigo][i - 1]
      const v1 = valoresPorIndice[comp.codigo][i]
      let afec = null
      if (v0 && v1 && v0 !== 0) afec = ((v1 - v0) / v0) * 100 * (comp.coef / 100)
      if (afec != null) sumAfec += afec
      html += `<td>${afec != null ? (afec >= 0 ? '+' : '') + afec.toFixed(3) + '%' : '—'}</td>`
    })
    html += `<td class="col-total">${sumAfec.toFixed(3)}%</td></tr>`
  })

  // Fila total
  html += `<tr class="row-total"><td class="idx-col" style="font-weight:700">TOTAL AJUSTE MENSUAL</td>`
  let acumPct = 0
  totalesMensuales.forEach(t => {
    const hayDatos = t.valid
    html += `<td style="${!hayDatos?'color:var(--amber)':''}">${hayDatos ? (t.val >= 0 ? '+' : '') + t.val.toFixed(3) + '%' : '⚠'}</td>`
    if (hayDatos) acumPct = ((1 + acumPct / 100) * (1 + t.val / 100) - 1) * 100
  })
  html += `<td class="col-total">${acumPct.toFixed(2)}%</td></tr>`

  // Fila diferencia $
  html += `<tr class="row-afec"><td class="idx-col" style="padding-left:24px;font-size:11px">↳ Diferencia mensual ($)</td>`
  periodos.forEach((p, i) => {
    const diff = montos[i+1] - montos[i]
    const color = diff >= 0 ? 'var(--green)' : 'var(--red)'
    html += `<td style="color:${color};font-size:11px">${diff >= 0 ? '+' : ''}${diff.toLocaleString('es-AR',{maximumFractionDigits:0})}</td>`
  })
  html += `<td class="col-total" style="font-size:11px">+${(montoFinal-montoBase).toLocaleString('es-AR',{maximumFractionDigits:0})}</td></tr>`

  // Fila monto
  html += `<tr class="row-monto"><td class="idx-col" style="font-weight:700">MONTO CONTRATO ($)</td>`
  totalesMensuales.forEach((t, i) => {
    html += `<td style="font-weight:${i===totalesMensuales.length-1?'700':'400'}">${montos[i + 1].toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td>`
  })
  html += `<td class="col-total">${montoFinal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td></tr>`

  html += `</tbody></table></div>

    <!-- Nota de pie -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;flex-wrap:wrap;gap:8px">
      <div style="font-size:11px;color:var(--text3)">
        ⚠ = mes sin datos completos &nbsp;·&nbsp; Hover sobre celdas para ver valor del índice
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="generarInforme()">📄 Informe PDF</button>
        <button class="btn btn-ghost btn-sm" onclick="exportarExcel()">↓ Excel</button>
        <button class="btn btn-accent btn-sm" onclick="guardarCalculo()">💾 Guardar historial</button>
      </div>
    </div>
  </div>`

  document.getElementById('matriz-resultado').innerHTML = html
  window._matrizActual = { formula, periodos, montoBase, totalesMensuales, montos, componentes, valoresPorIndice }
  const vacioEl = document.getElementById('matriz-vacio')
  if (vacioEl) vacioEl.style.display = 'none'

  // Colapsar config después de calcular
  const configEl = document.getElementById('config-matriz')
  const iconEl = document.getElementById('config-toggle-icon')
  if (configEl) { configEl.style.display = 'none'; }
  if (iconEl) iconEl.textContent = '▶'
}

function getPeriodoPrevio(periodo) {
  let m = periodo.m - 1, y = periodo.y
  if (m < 0) { m = 11; y-- }
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

function getValue(codigo, periodo) {
  const val = indicesValores[codigo]?.[periodo]
  return val ? val.valor : null
}

function exportMatrizCSV() {
  if (!window._matrizActual) { toast('Calculá la matriz primero', 'warn'); return }
  const { periodos, componentes, valoresPorIndice, totalesMensuales, montos } = window._matrizActual
  const pkPrev = getPeriodoPrevio(periodos[0])
  const lines = [['Componente', 'Coef', ...periodos.map(p => p.label), 'Total'].join(';')]
  componentes.forEach(comp => {
    const fila = [comp.codigo + ' Var%', comp.coef + '%']
    let sumVar = 0
    periodos.forEach((p, i) => {
      const v0 = i === 0 ? getValue(comp.codigo, pkPrev) : valoresPorIndice[comp.codigo][i - 1]
      const v1 = valoresPorIndice[comp.codigo][i]
      let varPct = null
      if (v0 && v1 && v0 !== 0) { varPct = ((v1 - v0) / v0) * 100; sumVar += varPct }
      fila.push(varPct != null ? varPct.toFixed(2).replace('.', ',') : '')
    })
    fila.push(sumVar.toFixed(2).replace('.', ',')); lines.push(fila.join(';'))
    const filaA = [comp.codigo + ' Afección', '']; let sumA = 0
    periodos.forEach((p, i) => {
      const v0 = i === 0 ? getValue(comp.codigo, pkPrev) : valoresPorIndice[comp.codigo][i - 1]
      const v1 = valoresPorIndice[comp.codigo][i]
      let afec = null
      if (v0 && v1 && v0 !== 0) afec = ((v1 - v0) / v0) * 100 * (comp.coef / 100)
      if (afec != null) sumA += afec
      filaA.push(afec != null ? afec.toFixed(2).replace('.', ',') : '')
    })
    filaA.push(sumA.toFixed(2).replace('.', ',')); lines.push(filaA.join(';'))
  })
  const filaT = ['TOTAL AJUSTE', '']; let acum = 0
  totalesMensuales.forEach(t => { filaT.push(t.valid ? t.val.toFixed(3).replace('.', ',') : ''); if (t.valid) acum = ((1 + acum / 100) * (1 + t.val / 100) - 1) * 100 })
  filaT.push(acum.toFixed(2).replace('.', ',')); lines.push(filaT.join(';'))
  const filaM = ['Monto ($)', montos[0].toString().replace('.', ',')]
  totalesMensuales.forEach((t, i) => { filaM.push(montos[i + 1].toFixed(2).replace('.', ',')) })
  filaM.push(montos[montos.length - 1].toFixed(2).replace('.', ',')); lines.push(filaM.join(';'))
  const blob = new Blob([new TextEncoder().encode('\ufeff' + lines.join('\n'))], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const nombre = document.getElementById('contrato-nombre').value || 'matriz'
  a.href = url; a.download = `${nombre.replace(/\s+/g, '_')}.csv`; a.click()
  URL.revokeObjectURL(url); toast('CSV exportado ✓', 'success')
}

async function guardarCalculo() {
  if (!window._matrizActual) { toast('Calculá la matriz primero', 'warn'); return }
  const { formula, montoBase, montos, totalesMensuales, periodos } = window._matrizActual
  const montoFinal = montos[montos.length - 1]; let acum = 0
  totalesMensuales.filter(t => t.valid).forEach(t => { acum = ((1 + acum / 100) * (1 + t.val / 100) - 1) * 100 })
  const { error } = await sb.from('calculos_mensuales').insert({
    org_id: currentOrg.id, contrato_id: contratoActual?.id || null,
    formula_snapshot: formula, periodos_data: { periodos, totalesMensuales, montos },
    ajuste_acumulado: acum, monto_inicial: montoBase, monto_final: montoFinal, created_by: currentUser.id
  })
  if (error) { toast('Error al guardar: ' + error.message, 'error') } else { toast('Guardado en historial ✓', 'success') }
}

async function renderHistorial() {
  const { data } = await sb.from('calculos_mensuales').select('*').eq('org_id', currentOrg.id).order('created_at', { ascending: false })
  
  let html = `
    <div class="page-head">
      <div><div class="page-title">Historial</div><div class="page-sub">Cálculos guardados</div></div>
    </div>
    <div class="card">
  `

  if (!data || data.length === 0) {
    html += `<div style="text-align:center;padding:32px;color:var(--text3)">Sin cálculos guardados — calculá y guardá desde Matriz o Contratos</div>`
  } else {
    data.forEach(c => {
      const fecha = new Date(c.created_at).toLocaleDateString('es-AR', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
      const formula = c.formula_snapshot || {}
      const componentes = formula.componentes ? parseComponentes(formula.componentes) : []
      const periodos = c.periodos_data?.periodos || []
      const periodoDesde = periodos[0]?.label || '—'
      const periodoHasta = periodos[periodos.length-1]?.label || '—'
      const color = c.ajuste_acumulado >= 0 ? '#4ade80' : '#f87171'

      const tags = componentes.map(comp =>
        `<span class="tag ${INDICES_META[comp.codigo]?.color || 'tag-blue'}" style="font-size:10px">${comp.codigo} ${comp.coef}%</span>`
      ).join('')

      html += `
        <div class="hist-card" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
                <span style="font-size:15px;font-weight:600">${formula.nombre || '—'}</span>
                ${formula.empresa ? `<span style="font-size:11px;color:var(--text3)">${formula.empresa}</span>` : ''}
              </div>
              <div style="font-size:12px;color:var(--text3);margin-bottom:8px">
                📅 ${periodoDesde} → ${periodoHasta} &nbsp;·&nbsp; ${fecha}
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
                ${tags}
              </div>
              <div style="font-size:13px">
                <span style="color:var(--text3)">$${Number(c.monto_inicial).toLocaleString('es-AR',{maximumFractionDigits:2})}</span>
                <span style="color:var(--text3);margin:0 6px">→</span>
                <strong style="color:${color}">$${Number(c.monto_final).toLocaleString('es-AR',{maximumFractionDigits:2})}</strong>
                <span style="color:${color};font-size:12px;margin-left:6px">(${c.ajuste_acumulado >= 0 ? '+' : ''}${Number(c.ajuste_acumulado).toFixed(2)}%)</span>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
              <div style="font-size:32px;font-weight:800;color:${color}">${c.ajuste_acumulado >= 0 ? '+' : ''}${Number(c.ajuste_acumulado).toFixed(2)}%</div>
              <button onclick="borrarHistorial('${c.id}')" class="btn btn-ghost btn-sm" style="color:#ef4444;font-size:11px">🗑 Borrar</button>
            </div>
          </div>
        </div>`
    })
  }

  html += `</div>`
  document.getElementById('page-content').innerHTML = html
}

async function borrarHistorial(id) {
  if (!confirm('¿Borrar este cálculo del historial?')) return
  const { error } = await sb.from('calculos_mensuales').delete().eq('id', id)
  if (error) { toast('Error: ' + error.message, 'error'); return }
  toast('Eliminado del historial', 'success')
  renderHistorial()
}

async function renderFormulas() {
  let html = `
    <div class="page-head">
      <div><div class="page-title">Fórmulas</div><div class="page-sub">Polinómicas de tu organización</div></div>
      <button class="btn btn-accent" onclick="mostrarFormNuevaFormula()">+ Nueva fórmula</button>
    </div>

    <div id="form-nueva-formula" style="display:none" class="card" style="margin-bottom:16px">
      <div class="card-title">Nueva fórmula polinómica</div>
      <div class="grid-2" style="margin-bottom:12px">
        <div class="input-group" style="margin:0">
          <label>Nombre de la fórmula</label>
          <input type="text" id="f-nombre" placeholder="Ej: Fórmula Chevron 2025"/>
        </div>
        <div class="input-group" style="margin:0">
          <label>Empresa / Cliente</label>
          <input type="text" id="f-empresa" placeholder="Ej: Chevron Argentina"/>
        </div>
      </div>

      <div class="card-title" style="margin-top:8px">Componentes <span id="f-suma-label" style="font-size:11px;color:var(--text3);font-weight:400">(suma: 0%)</span></div>
      <div id="f-componentes">
        <div class="f-comp-row" style="display:grid;grid-template-columns:1fr 120px 36px;gap:8px;margin-bottom:8px">
          <select class="f-codigo">
            <option value="IPC">IPC — General INDEC</option>
            <option value="IPIM">IPIM — INDEC</option>
            <option value="USD">USD — Dólar BNA</option>
            <option value="GR3">GR3 — Gasoil YPF</option>
            <option value="CCT">CCT — Salario Petrolero</option>
          </select>
          <input type="number" class="f-coef" placeholder="%" min="1" max="100" oninput="actualizarSuma()"/>
          <button onclick="this.closest('.f-comp-row').remove();actualizarSuma()" style="background:var(--red-dim,#3a1a1a);color:#ef4444;border:none;border-radius:6px;cursor:pointer;font-size:16px">×</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="agregarComponente()">+ Agregar índice</button>
        <button class="btn btn-accent btn-sm" onclick="guardarFormula()">Guardar fórmula</button>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('form-nueva-formula').style.display='none'">Cancelar</button>
      </div>
    </div>

    <div class="card">
  `

  if (formulas.length === 0) {
    html += `<div style="text-align:center;padding:32px;color:var(--text3)">Sin fórmulas — creá la primera</div>`
  } else {
    formulas.forEach(f => {
      const comps = parseComponentes(f.componentes)
      const suma = comps.reduce((s, c) => s + Number(c.coef), 0)
      html += `
        <div class="hist-card">
          <div class="hist-head">
            <div style="flex:1">
              <div style="font-size:14px;font-weight:500;margin-bottom:4px">${f.nombre}</div>
              ${f.empresa ? `<div style="font-size:11px;color:var(--text3);margin-bottom:8px">${f.empresa}</div>` : ''}
              <div style="display:flex;flex-wrap:wrap;gap:5px">
                ${comps.map(c => `<span class="tag ${INDICES_META[c.codigo]?.color || 'tag-blue'}">${c.codigo} ${c.coef}%</span>`).join('')}
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
              <span style="font-size:12px;color:${suma === 100 ? 'var(--green)' : '#ef4444'}">${suma}%</span>
              <button class="btn btn-ghost btn-sm" style="color:#ef4444;font-size:11px" onclick="eliminarFormula('${f.id}')">Eliminar</button>
            </div>
          </div>
        </div>`
    })
  }

  html += `</div>`
  document.getElementById('page-content').innerHTML = html
}

function mostrarFormNuevaFormula() {
  const form = document.getElementById('form-nueva-formula')
  form.style.display = form.style.display === 'none' ? 'block' : 'none'
}

function agregarComponente() {
  const cont = document.getElementById('f-componentes')
  const div = document.createElement('div')
  div.className = 'f-comp-row'
  div.style.cssText = 'display:grid;grid-template-columns:1fr 120px 36px;gap:8px;margin-bottom:8px'
  div.innerHTML = `
    <select class="f-codigo">
      <option value="IPC">IPC — IPC General INDEC</option>
      <option value="IPCNQN">IPCNQN — IPC Neuquén</option>
      <option value="IPIM">IPIM — IPIM General INDEC</option>
      <option value="USD">USD — Dólar Oficial BNA</option>
      <option value="GR3">GR3 — Gasoil YPF</option>
      <option value="CCT">CCT — CCT 644/12 Petroleros</option>
      <option value="UTHGRA">UTHGRA — Gastronomía/Hotelería</option>
      <option value="FADEEAC">FADEEAC — Transporte Cargas</option>
      <option value="CAC">CAC — Construcción</option>
    </select>
    <input type="number" class="f-coef" placeholder="%" min="1" max="100" oninput="actualizarSuma()"/>
    <button onclick="this.closest('.f-comp-row').remove();actualizarSuma()" style="background:var(--red-dim,#3a1a1a);color:#ef4444;border:none;border-radius:6px;cursor:pointer;font-size:16px">×</button>
  `
  cont.appendChild(div)
}

function actualizarSuma() {
  const coefs = Array.from(document.querySelectorAll('.f-coef')).map(i => parseFloat(i.value) || 0)
  const suma = coefs.reduce((s, v) => s + v, 0)
  const label = document.getElementById('f-suma-label')
  if (label) {
    label.textContent = `(suma: ${suma}%)`
    label.style.color = suma === 100 ? 'var(--green)' : suma > 100 ? '#ef4444' : 'var(--text3)'
  }
}

async function guardarFormula() {
  const nombre = document.getElementById('f-nombre').value.trim()
  const empresa = document.getElementById('f-empresa').value.trim()

  if (!nombre) { toast('Poné un nombre a la fórmula', 'warn'); return }

  const filas = document.querySelectorAll('.f-comp-row')
  const componentes = []
  let suma = 0

  filas.forEach(fila => {
    const codigo = fila.querySelector('.f-codigo').value
    const coef = parseFloat(fila.querySelector('.f-coef').value)
    if (!isNaN(coef) && coef > 0) { componentes.push({ codigo, coef }); suma += coef }
  })

  if (componentes.length === 0) { toast('Agregá al menos un componente', 'warn'); return }
  if (suma !== 100) { toast(`La suma debe ser 100% — ahora es ${suma}%`, 'warn'); return }

  const { error } = await sb.from('formulas').insert({
    org_id: currentOrg.id,
    nombre, empresa,
    componentes: componentes
  })

  if (error) { toast('Error: ' + error.message, 'error'); return }

  await registrarAuditoria('creó', 'formula', null, nombre, { componentes })
  toast('Fórmula guardada ✓', 'success')
  await loadFormulas()
  renderFormulas()
}

async function eliminarFormula(id) {
  if (!confirm('¿Eliminar esta fórmula? No se puede deshacer.')) return
  const { error } = await sb.from('formulas').delete().eq('id', id)
  if (error) { toast('Error: ' + error.message, 'error'); return }
  toast('Fórmula eliminada', 'success')
  await loadFormulas()
  renderFormulas()
}

async function renderIndices() {
  const hoy = new Date()
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`

  // Todos los índices disponibles
  const TODOS_INDICES = [
    { codigo:'IPC',     label:'IPC General (INDEC)',         auto:true  },
    { codigo:'IPCNQN',  label:'IPC Neuquén',                 auto:false },
    { codigo:'IPIM',    label:'IPIM General (INDEC)',         auto:true  },
    { codigo:'USD',     label:'Dólar Oficial BNA',           auto:true  },
    { codigo:'GR3',     label:'GR3 Gasoil YPF',             auto:true  },
    { codigo:'CCT',     label:'CCT 644/12 Petroleros',       auto:false },
    { codigo:'UTHGRA',  label:'UTHGRA Gastronomía/Hotelería',auto:false },
    { codigo:'FADEEAC', label:'FADEEAC Transporte Cargas',   auto:false },
    { codigo:'CAC',     label:'CAC Construcción',            auto:false },
  ]

  const optsIndices = TODOS_INDICES.map(i =>
    `<option value="${i.codigo}">${i.codigo} — ${i.label}</option>`
  ).join('')

  let html = `
    <div class="page-head">
      <div><div class="page-title">Índices</div><div class="page-sub">Estado de fuentes, variaciones y carga manual</div></div>
      <button class="btn btn-ghost" onclick="sincronizarIndices()">↻ Sincronizar API</button>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-title">Cargar valor manual</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:flex-end">
        <div class="input-group" style="margin:0">
          <label>Índice</label>
          <select id="m-codigo">${optsIndices}</select>
        </div>
        <div class="input-group" style="margin:0">
          <label>Período</label>
          <input type="month" id="m-periodo" value="${mesActual}"/>
        </div>
        <div class="input-group" style="margin:0">
          <label>Valor del índice <span style="color:var(--text3);font-size:10px">(número acumulado, no %)</span></label>
          <input type="number" id="m-valor" placeholder="Ej: 505.5" step="0.01"/>
        </div>
        <button class="btn btn-accent" onclick="guardarIndiceManual()">Guardar</button>
      </div>
      <p style="font-size:11px;color:var(--text3);margin-top:10px">
        💡 Para índices salariales (CCT, UTHGRA, FADEEAC) cargá el valor del salario básico o el índice acumulado publicado. La variación % se calcula automáticamente comparando mes a mes.
      </p>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div class="card-title" style="margin:0">Estado de índices</div>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-size:12px;color:var(--text3)">Ver en:</span>
          <button class="btn btn-ghost btn-sm" id="btn-ver-valor" onclick="setModoIndices('valor')" style="opacity:0.5">Valor</button>
          <button class="btn btn-accent btn-sm" id="btn-ver-pct" onclick="setModoIndices('pct')">% Variación</button>
        </div>
      </div>
      <div id="indices-lista">
  `

  // Todos los códigos conocidos + los que hay en la base
  const codigosEnBase = Object.keys(indicesValores)
  const todosLosCodigos = [...new Set([...TODOS_INDICES.map(i=>i.codigo), ...codigosEnBase])]

  todosLosCodigos.forEach(codigo => {
    const meta = TODOS_INDICES.find(i => i.codigo === codigo)
    const valores = indicesValores[codigo] || {}
    const periodos = Object.keys(valores).sort().reverse()
    const ultimo = periodos[0]
    const valorUltimo = ultimo ? valores[ultimo].valor : null
    const ultimosMeses = periodos.slice(0, 8)

    // Calcular variaciones % para los últimos meses
    const variaciones = []
    for (let i = 0; i < ultimosMeses.length; i++) {
      const p = ultimosMeses[i]
      const pPrev = periodos[i+1]
      if (pPrev && valores[p] && valores[pPrev]) {
        const v1 = valores[p].valor
        const v0 = valores[pPrev].valor
        const pct = ((v1 - v0) / v0) * 100
        variaciones.push({ periodo: p, pct, valor: v1 })
      } else {
        variaciones.push({ periodo: p, pct: null, valor: valores[p]?.valor || null })
      }
    }

    const ultimaVar = variaciones[0]?.pct
    const tagColor = INDICES_META[codigo]?.color || 'tag-green'

    html += `
      <div class="hist-card" style="margin-bottom:12px">
        <div class="hist-head">
          <div style="flex:1">
            <div style="font-size:14px;font-weight:500;display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <span class="tag ${tagColor}">${codigo}</span>
              ${meta?.label || codigo}
              ${meta?.auto ? '<span style="font-size:10px;color:var(--text3);background:var(--card-bg);border:1px solid var(--border);padding:1px 6px;border-radius:99px">AUTO</span>' : '<span style="font-size:10px;color:#f59e0b;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);padding:1px 6px;border-radius:99px">MANUAL</span>'}
            </div>
            ${ultimo ? `<div class="hist-meta">Último: <strong>${valorUltimo?.toLocaleString('es-AR',{maximumFractionDigits:2})}</strong> (${ultimo}) ${ultimaVar !== null ? `· Var: <strong style="color:${ultimaVar>=0?'#4ade80':'#f87171'}">${ultimaVar>=0?'+':''}${ultimaVar.toFixed(2)}%</strong>` : ''}</div>` : '<div class="hist-meta" style="color:#f59e0b">Sin datos — cargá valores manualmente</div>'}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
            <span class="source-chip ${valorUltimo ? 'ok' : 'manual'}">${valorUltimo ? '● Con datos' : '⚠ Sin datos'}</span>
          </div>
        </div>

        ${ultimosMeses.length > 0 ? `
        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap" class="celdas-indice" data-codigo="${codigo}">
          ${variaciones.map(v => {
            const color = v.pct !== null ? (v.pct >= 0 ? '#4ade80' : '#f87171') : 'var(--text3)'
            return `
            <div style="font-size:11px;background:var(--card-bg);border:1px solid var(--border);border-radius:6px;padding:6px 10px;text-align:center;min-width:72px;position:relative">
              <div style="color:var(--text3);margin-bottom:3px">${v.periodo}</div>
              <div class="celda-valor" style="font-weight:600">${v.valor !== null ? v.valor.toLocaleString('es-AR',{maximumFractionDigits:1}) : '—'}</div>
              <div class="celda-pct" style="font-weight:600;color:${color};display:none">${v.pct !== null ? (v.pct>=0?'+':'')+v.pct.toFixed(2)+'%' : '—'}</div>
              <button onclick="borrarIndiceManual('${codigo}','${v.periodo}')" title="Borrar este valor"
                style="position:absolute;top:2px;right:2px;background:none;border:none;color:#ef4444;cursor:pointer;font-size:10px;opacity:0;transition:opacity .15s;line-height:1"
                onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">×</button>
            </div>`
          }).join('')}
        </div>` : ''}
      </div>`
  })

  html += `</div></div>`
  document.getElementById('page-content').innerHTML = html
}

function setModoIndices(modo) {
  const btnValor = document.getElementById('btn-ver-valor')
  const btnPct = document.getElementById('btn-ver-pct')
  if (modo === 'pct') {
    document.querySelectorAll('.celda-valor').forEach(el => el.style.display = 'none')
    document.querySelectorAll('.celda-pct').forEach(el => el.style.display = 'block')
    btnValor.classList.remove('btn-accent'); btnValor.classList.add('btn-ghost'); btnValor.style.opacity = '0.5'
    btnPct.classList.add('btn-accent'); btnPct.classList.remove('btn-ghost'); btnPct.style.opacity = '1'
  } else {
    document.querySelectorAll('.celda-valor').forEach(el => el.style.display = 'block')
    document.querySelectorAll('.celda-pct').forEach(el => el.style.display = 'none')
    btnPct.classList.remove('btn-accent'); btnPct.classList.add('btn-ghost'); btnPct.style.opacity = '0.5'
    btnValor.classList.add('btn-accent'); btnValor.classList.remove('btn-ghost'); btnValor.style.opacity = '1'
  }
}

async function borrarIndiceManual(codigo, periodo) {
  if (!confirm(`¿Borrar ${codigo} ${periodo}?`)) return
  const { error } = await sb.from('indices_valores').delete().eq('codigo', codigo).eq('periodo', periodo)
  if (error) { toast('Error: ' + error.message, 'error'); return }
  toast(`${codigo} ${periodo} eliminado`, 'success')
  await loadIndicesValores()
  renderIndices()
}

async function guardarIndiceManual() {
  const codigo = document.getElementById('m-codigo').value
  const periodo = document.getElementById('m-periodo').value
  const valor = parseFloat(document.getElementById('m-valor').value)

  if (!codigo || !periodo || isNaN(valor)) {
    toast('Completá todos los campos', 'warn'); return
  }

  const { error } = await sb.from('indices_valores').upsert({
    codigo, periodo, valor,
    fuente_real: 'manual',
    org_id: currentOrg.id,
    actualizado_at: new Date().toISOString()
  }, { onConflict: 'codigo,periodo' })

  if (error) { toast('Error: ' + error.message, 'error'); return }

  document.getElementById('m-valor').value = ''
  await loadIndicesValores()
  renderIndices()
  await registrarAuditoria('cargó índice', 'indice', null, `${codigo} ${periodo}`, { valor })
  toast(`${codigo} ${periodo} guardado ✓`, 'success')
}

async function sincronizarIndices() {
  toast('Sincronizando...', 'success')
  try {
    const r1 = await fetch('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=200&format=json')
    const d1 = await r1.json()
    for (const [fecha, valor] of d1.data || []) {
      if (valor === null) continue
      await sb.from('indices_valores').upsert({ codigo: 'IPC', periodo: fecha.slice(0, 7), valor, fuente_real: 'auto', actualizado_at: new Date().toISOString() })
    }
  } catch (e) {}
  await loadIndicesValores(); renderIndices(); toast('Sincronización completa ✓', 'success')
}

async function renderAlertas() {
  // Generar alertas automáticas primero
  await generarAlertasAutomaticas()

  const { data } = await sb.from('alertas').select('*').eq('org_id', currentOrg.id).order('created_at', { ascending: false }).limit(100)

  const total = data?.length || 0
  const noLeidas = data?.filter(a => !a.leida).length || 0
  const altas = data?.filter(a => a.prioridad === 'alta' && !a.leida).length || 0

  const PRIORIDAD_CONFIG = {
    alta:  { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  icon: '🔴', label: 'Alta'  },
    media: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', icon: '🟡', label: 'Media' },
    baja:  { color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.25)', icon: '🟢', label: 'Baja'  },
  }

  const TIPO_ICON = {
    'variacion-alta':      '📈',
    'contrato-vencido':    '📋',
    'contrato-por-vencer': '⏰',
    'indice-faltante':     '📊',
    'formula-incompleta':  '⚠️',
    'sin-actualizacion':   '🔄',
    'scraper-error':       '🤖',
    'certificacion':       '📅',
    'default':             '🔔',
  }

  let html = `
    <div class="page-head">
      <div>
        <div class="page-title">Alertas</div>
        <div class="page-sub">Centro de notificaciones y alertas automáticas</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="marcarTodasLeidas()">✓ Marcar todas leídas</button>
        <button class="btn btn-ghost btn-sm" onclick="renderAlertas()">↻ Actualizar</button>
      </div>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
      <div class="card" style="padding:16px;text-align:center;border-color:${altas > 0 ? 'rgba(239,68,68,0.3)' : 'var(--border)'}">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:6px">🔴 Alta prioridad</div>
        <div style="font-size:36px;font-weight:800;color:${altas > 0 ? '#ef4444' : 'var(--text3)'}">${altas}</div>
      </div>
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:6px">🔔 Sin leer</div>
        <div style="font-size:36px;font-weight:800;color:${noLeidas > 0 ? 'var(--accent)' : 'var(--text3)'}">${noLeidas}</div>
      </div>
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:6px">📋 Total</div>
        <div style="font-size:36px;font-weight:800;color:var(--text2)">${total}</div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card" style="margin-bottom:16px;padding:14px 16px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <span style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px">Filtrar:</span>
        <button class="btn btn-sm filter-btn active-filter" onclick="filtrarAlertas('todas',this)">Todas</button>
        <button class="btn btn-sm filter-btn" onclick="filtrarAlertas('alta',this)">🔴 Alta</button>
        <button class="btn btn-sm filter-btn" onclick="filtrarAlertas('media',this)">🟡 Media</button>
        <button class="btn btn-sm filter-btn" onclick="filtrarAlertas('baja',this)">🟢 Baja</button>
        <button class="btn btn-sm filter-btn" onclick="filtrarAlertas('no-leidas',this)">🔔 No leídas</button>
      </div>
    </div>

    <div id="alertas-lista">
  `

  if (!data || data.length === 0) {
    html += `
      <div class="card" style="text-align:center;padding:48px">
        <div style="font-size:40px;margin-bottom:12px">✅</div>
        <div style="font-size:16px;font-weight:500;margin-bottom:8px">Todo en orden</div>
        <div style="color:var(--text3);font-size:13px">No hay alertas pendientes. El sistema está funcionando correctamente.</div>
      </div>`
  } else {
    data.forEach(a => {
      const fecha = new Date(a.created_at).toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
      const prio = a.prioridad || 'baja'
      const cfg = PRIORIDAD_CONFIG[prio] || PRIORIDAD_CONFIG.baja
      const icon = TIPO_ICON[a.tipo] || TIPO_ICON.default
      const leida = a.leida

      html += `
        <div class="alerta-item-v2 ${leida ? 'leida' : ''}" data-prioridad="${prio}"
          style="background:${leida ? 'var(--surface2)' : cfg.bg};border:1px solid ${leida ? 'var(--border)' : cfg.border};
                 border-radius:var(--radius);padding:16px 18px;margin-bottom:10px;transition:all .2s;
                 ${leida ? 'opacity:0.6' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
                <span style="font-size:16px">${icon}</span>
                <span style="font-size:14px;font-weight:${leida ? '400' : '600'};color:${leida ? 'var(--text2)' : 'var(--text)'}">${a.titulo}</span>
                <span style="font-size:10px;padding:2px 8px;border-radius:99px;background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.border};font-weight:600;text-transform:uppercase">${cfg.label}</span>
                ${!leida ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--accent);display:inline-block;flex-shrink:0"></span>' : ''}
              </div>
              ${a.mensaje ? `<div style="font-size:13px;color:var(--text2);margin-bottom:8px;line-height:1.5">${a.mensaje}</div>` : ''}
              ${a.accion_recomendada ? `
                <div style="font-size:12px;color:var(--text3);background:var(--surface3);padding:6px 10px;border-radius:6px;border-left:2px solid ${cfg.color}">
                  💡 ${a.accion_recomendada}
                </div>` : ''}
              <div style="font-size:11px;color:var(--text3);margin-top:8px">📅 ${fecha}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
              ${!leida ? `<button onclick="marcarLeida('${a.id}')" class="btn btn-ghost btn-sm" style="font-size:11px">✓ Resolver</button>` : '<span style="font-size:11px;color:var(--text3)">✓ Resuelta</span>'}
              ${a.contrato_id ? `<button onclick="verContratoDesdeAlerta('${a.contrato_id}')" class="btn btn-ghost btn-sm" style="font-size:11px">Ver contrato</button>` : ''}
              <button onclick="borrarAlerta('${a.id}')" class="btn btn-ghost btn-sm" style="font-size:11px;color:#ef4444">🗑</button>
            </div>
          </div>
        </div>`
    })
  }

  html += `</div>`
  document.getElementById('page-content').innerHTML = html

  // Aplicar estilos a botones de filtro
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.style.cssText = 'background:var(--surface2);border:1px solid var(--border);color:var(--text2)'
  })
  const activeBtn = document.querySelector('.active-filter')
  if (activeBtn) activeBtn.style.cssText = 'background:var(--accent);color:#0a0a0a;border:none'
}

async function generarAlertasAutomaticas() {
  try {
    const ahora = new Date()
    const hoy = ahora.toISOString().slice(0, 10)
    const en30dias = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const mesActual = ahora.toISOString().slice(0, 7)

    // Cargar contratos
    const { data: contratosData } = await sb.from('contratos').select('*').eq('org_id', currentOrg.id)

    for (const c of contratosData || []) {
      // Contrato vencido
      if (c.vigencia_hasta && c.vigencia_hasta < hoy) {
        await crearAlertaAuto({
          tipo: 'contrato-vencido',
          titulo: `Contrato vencido: ${c.nombre}`,
          mensaje: `El contrato venció el ${new Date(c.vigencia_hasta).toLocaleDateString('es-AR')}. Revisá si necesita renovación.`,
          prioridad: 'alta',
          contrato_id: c.id,
          accion_recomendada: 'Contactar al cliente para renovar o cerrar el contrato'
        })
      }
      // Por vencer en 30 días
      else if (c.vigencia_hasta && c.vigencia_hasta <= en30dias && c.vigencia_hasta >= hoy) {
        await crearAlertaAuto({
          tipo: 'contrato-por-vencer',
          titulo: `Contrato por vencer: ${c.nombre}`,
          mensaje: `Vence el ${new Date(c.vigencia_hasta).toLocaleDateString('es-AR')}. Quedan menos de 30 días.`,
          prioridad: 'media',
          contrato_id: c.id,
          accion_recomendada: 'Iniciar gestión de renovación con el cliente'
        })
      }
    }

    // Índices faltantes del mes actual
    const indicesRequeridos = ['IPC', 'USD', 'GR3']
    for (const codigo of indicesRequeridos) {
      const tiene = indicesValores[codigo]?.[mesActual]
      if (!tiene) {
        await crearAlertaAuto({
          tipo: 'indice-faltante',
          titulo: `Índice ${codigo} sin datos para ${mesActual}`,
          mensaje: `No hay valor cargado para ${codigo} en el período ${mesActual}. Los cálculos del mes pueden estar incompletos.`,
          prioridad: 'media',
          accion_recomendada: `Cargar el valor de ${codigo} en la sección Índices`
        })
      }
    }

  } catch (e) {
    console.error('Error generando alertas automáticas:', e)
  }
}

async function crearAlertaAuto({ tipo, titulo, mensaje, prioridad, contrato_id, accion_recomendada }) {
  // Solo crear si no existe una igual no resuelta
  const { data: existe } = await sb.from('alertas')
    .select('id')
    .eq('org_id', currentOrg.id)
    .eq('tipo', tipo)
    .eq('titulo', titulo)
    .eq('leida', false)
    .limit(1)

  if (existe && existe.length > 0) return

  await sb.from('alertas').insert({
    org_id: currentOrg.id,
    tipo, titulo, mensaje,
    prioridad: prioridad || 'baja',
    contrato_id: contrato_id || null,
    accion_recomendada: accion_recomendada || null,
    leida: false
  })
}

function filtrarAlertas(filtro, btn) {
  // Actualizar estilos de botones
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.style.cssText = 'background:var(--surface2);border:1px solid var(--border);color:var(--text2)'
  })
  btn.style.cssText = 'background:var(--accent);color:#0a0a0a;border:none'

  const items = document.querySelectorAll('.alerta-item-v2')
  items.forEach(item => {
    const prio = item.dataset.prioridad
    const esLeida = item.classList.contains('leida')
    if (filtro === 'todas') item.style.display = 'block'
    else if (filtro === 'no-leidas') item.style.display = esLeida ? 'none' : 'block'
    else item.style.display = prio === filtro ? 'block' : 'none'
  })
}

async function marcarLeida(id) {
  await sb.from('alertas').update({ leida: true }).eq('id', id)
  await checkAlertas()
  renderAlertas()
}

async function marcarTodasLeidas() {
  await sb.from('alertas').update({ leida: true }).eq('org_id', currentOrg.id).eq('leida', false)
  await checkAlertas()
  renderAlertas()
  toast('Todas las alertas marcadas como leídas ✓', 'success')
}

async function borrarAlerta(id) {
  await sb.from('alertas').delete().eq('id', id)
  renderAlertas()
}

async function verContratoDesdeAlerta(contratoId) {
  goPage('contratos')
  setTimeout(() => abrirContrato(contratoId), 300)
}

function toast(msg, type = 'success') {
  const c = document.createElement('div')
  c.className = 'toast ' + type
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warn' ? '⚠' : 'ℹ'
  const color = type === 'success' ? 'var(--green)' : type === 'error' ? 'var(--red)' : type === 'warn' ? 'var(--amber)' : 'var(--text2)'
  c.innerHTML = `<span style="color:${color};font-size:14px">${icon}</span> ${msg}`
  document.body.appendChild(c)
  setTimeout(() => { c.style.animation = 'toastIn .2s reverse'; setTimeout(() => c.remove(), 200) }, 2400)
}

async function guardarContrato() {
  const nombre = document.getElementById('contrato-nombre').value.trim()
  const formulaId = document.getElementById('contrato-formula').value
  const monto = parseFloat(document.getElementById('contrato-monto').value)
  const mesDesde = parseInt(document.getElementById('mes-desde').value)
  const anioDesde = parseInt(document.getElementById('anio-desde').value)
  const mesHasta = parseInt(document.getElementById('mes-hasta').value)
  const anioHasta = parseInt(document.getElementById('anio-hasta').value)

  if (!nombre) { toast('Poné un nombre al contrato', 'warn'); return }
  if (!formulaId) { toast('Seleccioná una fórmula', 'warn'); return }
  if (isNaN(monto)) { toast('Poné un monto base', 'warn'); return }

  const periodoDesde = `${anioDesde}-${String(mesDesde + 1).padStart(2, '0')}`
  const periodoHasta = `${anioHasta}-${String(mesHasta + 1).padStart(2, '0')}`

  if (contratoActual) {
    // Actualizar existente
    const { error } = await sb.from('contratos').update({
      nombre, formula_id: formulaId, monto_base: monto,
      periodo_desde: periodoDesde, periodo_hasta: periodoHasta
    }).eq('id', contratoActual.id)
    if (error) { toast('Error: ' + error.message, 'error'); return }
    toast('Contrato actualizado ✓', 'success')
  } else {
    // Crear nuevo
    const { data, error } = await sb.from('contratos').insert({
      org_id: currentOrg.id, nombre, formula_id: formulaId,
      monto_base: monto, periodo_desde: periodoDesde, periodo_hasta: periodoHasta
    }).select().single()
    if (error) { toast('Error: ' + error.message, 'error'); return }
    contratoActual = data
    toast('Contrato guardado ✓', 'success')
  }

  await loadContratos()
  renderMatriz()
}

async function eliminarContrato(id) {
  if (!confirm('¿Eliminar este contrato?')) return
  const { error } = await sb.from('contratos').delete().eq('id', id)
  if (error) { toast('Error: ' + error.message, 'error'); return }
  contratoActual = null
  toast('Contrato eliminado', 'success')
  await loadContratos()
  renderMatriz()
}

async function exportarExcel() {
  if (!window._matrizActual) { toast('Calculá la matriz primero', 'warn'); return }

  if (!window.XLSX) {
    toast('Cargando Excel...', 'success')
    await new Promise((res, rej) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      s.onload = res; s.onerror = rej
      document.head.appendChild(s)
    })
  }

  const { formula, periodos, componentes, valoresPorIndice, totalesMensuales, montos } = window._matrizActual
  const pkPrev = getPeriodoPrevio(periodos[0])
  const nombreContrato = document.getElementById('contrato-nombre').value || 'Contrato'
  const hoy = new Date().toLocaleDateString('es-AR')
  const fmtPeso = '"$"#,##0.00'
  const fmtPct = '+0.00%;-0.00%;0.00%'

  let acumTotal = 0
  totalesMensuales.forEach(t => { if (t.valid) acumTotal = ((1+acumTotal/100)*(1+t.val/100)-1)*100 })
  const montoBase = montos[0]
  const montoFinal = montos[montos.length-1]

  // ════ HOJA 1: RESUMEN EJECUTIVO ════
  const resumen = [
    ['POLICALC — ACTUALIZACIÓN CONTRACTUAL', '', ''],
    ['', '', ''],
    ['Contrato', nombreContrato, ''],
    ['Fórmula', formula.nombre, ''],
    ['Empresa', formula.empresa || currentOrg.nombre, ''],
    ['Período', `${periodos[0].label} → ${periodos[periodos.length-1].label}`, ''],
    ['Fecha de cálculo', hoy, ''],
    ['', '', ''],
    ['── INDICADORES CLAVE', '', ''],
    ['', '', ''],
    ['Monto base', montoBase, ''],
    ['Monto actualizado', montoFinal, ''],
    ['Diferencia', montoFinal - montoBase, ''],
    ['Variación acumulada', acumTotal / 100, ''],
    ['Meses analizados', periodos.length, ''],
    ['', '', ''],
    ['── COMPOSICIÓN DE LA FÓRMULA', '', ''],
    ['', '', ''],
    ['Índice', 'Ponderación', 'Afección acumulada'],
  ]

  componentes.forEach(c => {
    let sumAfec = 0
    periodos.forEach((p, i) => {
      const v0 = i === 0 ? getValue(c.codigo, pkPrev) : valoresPorIndice[c.codigo][i-1]
      const v1 = valoresPorIndice[c.codigo][i]
      if (v0 && v1 && v0 !== 0) sumAfec += ((v1-v0)/v0)*100*(c.coef/100)
    })
    resumen.push([`${c.codigo} — ${INDICES_META[c.codigo]?.label || c.codigo}`, c.coef/100, sumAfec/100])
  })

  resumen.push(['', '', ''])
  resumen.push(['── EVOLUCIÓN DEL MONTO', '', ''])
  resumen.push(['', '', ''])
  resumen.push(['Mes', 'Monto ($)', 'Variación mensual'])
  periodos.forEach((p, i) => {
    const t = totalesMensuales[i]
    resumen.push([p.label, montos[i+1], t.valid ? t.val/100 : null])
  })

  const wsR = XLSX.utils.aoa_to_sheet(resumen)
  wsR['!cols'] = [{wch:36},{wch:22},{wch:20}]

  // Formato celdas resumen
  if (wsR['B11']) wsR['B11'].z = fmtPeso
  if (wsR['B12']) wsR['B12'].z = fmtPeso
  if (wsR['B13']) wsR['B13'].z = fmtPeso
  if (wsR['B14']) wsR['B14'].z = fmtPct
  const baseComp = 20
  componentes.forEach((c, i) => {
    const r = baseComp + i
    if (wsR[`B${r}`]) wsR[`B${r}`].z = '0%'
    if (wsR[`C${r}`]) wsR[`C${r}`].z = fmtPct
  })
  const baseMes = baseComp + componentes.length + 4
  periodos.forEach((p, i) => {
    const r = baseMes + i
    if (wsR[`B${r}`]) wsR[`B${r}`].z = fmtPeso
    if (wsR[`C${r}`]) wsR[`C${r}`].z = fmtPct
  })

  // ════ HOJA 2: MATRIZ COMPLETA ════
  const enc = ['Índice', 'Coef.', ...periodos.map(p => p.label), 'TOTAL']
  const filas = [enc]

  componentes.forEach(comp => {
    const filaVar = [`${comp.codigo} — ${INDICES_META[comp.codigo]?.label || comp.codigo}`, `${comp.coef}%`]
    let sumVar = 0
    periodos.forEach((p, i) => {
      const v0 = i === 0 ? getValue(comp.codigo, pkPrev) : valoresPorIndice[comp.codigo][i-1]
      const v1 = valoresPorIndice[comp.codigo][i]
      let v = null
      if (v0 && v1 && v0 !== 0) { v = ((v1-v0)/v0); sumVar += v*100 }
      filaVar.push(v)
    })
    filaVar.push(sumVar/100)
    filas.push(filaVar)

    const filaAfec = [`  ↳ Afección`, '']
    let sumA = 0
    periodos.forEach((p, i) => {
      const v0 = i === 0 ? getValue(comp.codigo, pkPrev) : valoresPorIndice[comp.codigo][i-1]
      const v1 = valoresPorIndice[comp.codigo][i]
      let a = null
      if (v0 && v1 && v0 !== 0) a = ((v1-v0)/v0)*(comp.coef/100)
      if (a != null) sumA += a*100
      filaAfec.push(a)
    })
    filaAfec.push(sumA/100)
    filas.push(filaAfec)
  })

  const filaTotal = ['TOTAL AJUSTE MENSUAL', '100%']
  let acum2 = 0
  totalesMensuales.forEach(t => {
    filaTotal.push(t.valid ? t.val/100 : null)
    if (t.valid) acum2 = ((1+acum2/100)*(1+t.val/100)-1)*100
  })
  filaTotal.push(acum2/100)
  filas.push(filaTotal)
  filas.push(Array(enc.length).fill(''))

  const filaMonto = ['MONTO CONTRATO ($)', `Base: $${montoBase.toLocaleString('es-AR')}`]
  totalesMensuales.forEach((t, i) => { filaMonto.push(montos[i+1]) })
  filaMonto.push(montoFinal)
  filas.push(filaMonto)

  const wsM = XLSX.utils.aoa_to_sheet(filas)
  wsM['!cols'] = [{wch:34},{wch:8},...periodos.map(()=>({wch:10})),{wch:10}]

  // Formato % matriz
  for (let r = 1; r < filas.length; r++) {
    const esMontoRow = r === filas.length - 1
    for (let c = 2; c < enc.length; c++) {
      const cell = XLSX.utils.encode_cell({r, c})
      if (wsM[cell] && wsM[cell].v != null) {
        wsM[cell].z = esMontoRow ? fmtPeso : fmtPct
      }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsR, 'Resumen Ejecutivo')
  XLSX.utils.book_append_sheet(wb, wsM, 'Matriz Completa')

  const filename = `PoliCalc_${nombreContrato.replace(/\s+/g,'_')}_${hoy.replace(/\//g,'-')}.xlsx`
  XLSX.writeFile(wb, filename)
  toast('Excel exportado ✓', 'success')
}

function generarInforme() {
  if (!window._matrizActual) { toast('Calculá la matriz primero', 'warn'); return }

  const { formula, periodos, componentes, valoresPorIndice, totalesMensuales, montos } = window._matrizActual
  const pkPrev = getPeriodoPrevio(periodos[0])
  const nombreContrato = document.getElementById('contrato-nombre').value || 'Contrato'
  const hoy = new Date().toLocaleDateString('es-AR', {day:'2-digit',month:'long',year:'numeric'})

  let acumTotal = 0
  totalesMensuales.forEach(t => { if (t.valid) acumTotal = ((1+acumTotal/100)*(1+t.val/100)-1)*100 })
  const montoBase = montos[0]
  const montoFinal = montos[montos.length-1]
  const diferencia = montoFinal - montoBase
  const positivo = acumTotal >= 0

  // Calcular afección por componente
  const afecciones = componentes.map(c => {
    let sumAfec = 0
    periodos.forEach((p, i) => {
      const v0 = i === 0 ? getValue(c.codigo, pkPrev) : valoresPorIndice[c.codigo][i-1]
      const v1 = valoresPorIndice[c.codigo][i]
      if (v0 && v1 && v0 !== 0) sumAfec += ((v1-v0)/v0)*100*(c.coef/100)
    })
    return { ...c, afec: sumAfec }
  })

  // Barras de componentes
  const maxAfec = Math.max(...afecciones.map(a => Math.abs(a.afec)), 1)
  const colores = { IPC:'#6366f1', USD:'#f59e0b', GR3:'#10b981', CCT:'#3b82f6', IPIM:'#8b5cf6' }

  const barras = afecciones.map(c => `
    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-weight:600;color:#1e293b">${c.codigo} <span style="font-weight:400;color:#64748b;font-size:13px">${INDICES_META[c.codigo]?.label || c.codigo}</span></span>
        <span style="font-weight:700;color:${c.afec>=0?'#059669':'#dc2626'}">${c.afec>=0?'+':''}${c.afec.toFixed(2)}%</span>
      </div>
      <div style="background:#f1f5f9;border-radius:99px;height:10px;overflow:hidden">
        <div style="width:${Math.abs(c.afec)/maxAfec*100}%;background:${colores[c.codigo]||'#6366f1'};height:100%;border-radius:99px;transition:width .3s"></div>
      </div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">Ponderación: ${c.coef}%</div>
    </div>`).join('')

  // Tabla evolución
  const filasMeses = periodos.map((p, i) => {
    const t = totalesMensuales[i]
    const m = montos[i+1]
    const color = t.valid && t.val >= 0 ? '#059669' : '#dc2626'
    return `<tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:10px 16px;font-weight:500;color:#1e293b">${p.label}</td>
      <td style="padding:10px 16px;text-align:right;color:#1e293b">$${m.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td style="padding:10px 16px;text-align:right;font-weight:600;color:${color}">${t.valid?(t.val>=0?'+':'')+t.val.toFixed(3)+'%':'—'}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>PoliCalc — ${nombreContrato}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0 }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f8fafc; color:#1e293b; padding:40px 20px }
  .page { max-width:900px; margin:0 auto }
  @media print {
    body { background:white; padding:0 }
    .no-print { display:none }
    .card { break-inside:avoid }
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);border-radius:16px;padding:36px 40px;margin-bottom:24px;color:white">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
      <div>
        <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">PoliCalc — Actualización Contractual</div>
        <div style="font-size:28px;font-weight:700;margin-bottom:4px">${nombreContrato}</div>
        <div style="font-size:14px;color:#94a3b8">${formula.nombre} &nbsp;·&nbsp; ${formula.empresa || currentOrg.nombre}</div>
        <div style="font-size:13px;color:#64748b;margin-top:6px">Período: ${periodos[0].label} → ${periodos[periodos.length-1].label} &nbsp;·&nbsp; ${hoy}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;color:#94a3b8;margin-bottom:4px">Variación acumulada</div>
        <div style="font-size:48px;font-weight:800;color:${positivo?'#34d399':'#f87171'}">${positivo?'+':''}${acumTotal.toFixed(2)}%</div>
      </div>
    </div>
  </div>

  <!-- KPI CARDS -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
    <div style="background:white;border-radius:12px;padding:24px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.06)">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px">Monto Base</div>
      <div style="font-size:24px;font-weight:700;color:#1e293b">$${montoBase.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">${periodos[0].label}</div>
    </div>
    <div style="background:white;border-radius:12px;padding:24px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.06)">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px">Monto Actualizado</div>
      <div style="font-size:24px;font-weight:700;color:${positivo?'#059669':'#dc2626'}">$${montoFinal.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">${periodos[periodos.length-1].label}</div>
    </div>
    <div style="background:white;border-radius:12px;padding:24px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.06)">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:8px">Diferencia</div>
      <div style="font-size:24px;font-weight:700;color:${positivo?'#059669':'#dc2626'}">${positivo?'+':''}$${diferencia.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">${periodos.length} meses</div>
    </div>
  </div>

  <!-- COMPOSICIÓN -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
    <div style="background:white;border-radius:12px;padding:28px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.06)">
      <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#475569;margin-bottom:20px">Composición de la Fórmula</div>
      ${barras}
    </div>
    <div style="background:white;border-radius:12px;padding:28px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.06)">
      <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#475569;margin-bottom:20px">Evolución Mensual</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:8px 16px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:600">Mes</th>
            <th style="padding:8px 16px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:600">Monto</th>
            <th style="padding:8px 16px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:600">Var.</th>
          </tr>
        </thead>
        <tbody>${filasMeses}</tbody>
      </table>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">
    Generado por <strong>PoliCalc</strong> · ${hoy} · Datos: INDEC, BNA, YPF
  </div>

  <!-- BOTÓN IMPRIMIR -->
  <div class="no-print" style="text-align:center;margin-top:24px">
    <button onclick="window.print()" style="background:#1e293b;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">🖨️ Guardar como PDF</button>
  </div>

</div>
</body>
</html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}

// ════════════════════════════════════════════════════════════════
// PÁGINA CONTRATOS — Gestión completa con ítems
// ════════════════════════════════════════════════════════════════

let contratoEditando = null
let itemsContratoActual = []

async function renderContratos() {
  const { data: listaContratos } = await sb
    .from('contratos')
    .select('*, formulas(nombre)')
    .eq('org_id', currentOrg.id)
    .order('created_at', { ascending: false })

  // KPIs
  const hoy = new Date()
  const en30 = new Date(hoy.getTime() + 30*24*60*60*1000)
  let activos = 0, vencidos = 0, porVencer = 0, totalMonto = 0

  listaContratos?.forEach(c => {
    const hasta = c.vigencia_hasta ? new Date(c.vigencia_hasta) : null
    if (!hasta) { activos++; return }
    if (hasta < hoy) vencidos++
    else if (hasta <= en30) porVencer++
    else activos++
    totalMonto += Number(c.monto_base || 0)
  })

  let html = `
    <div class="page-head">
      <div>
        <div class="page-title">Contratos</div>
        <div class="page-sub">Gestión de contratos con ítems y actualización polinómica</div>
      </div>
      <button class="btn btn-accent" onclick="abrirNuevoContrato()">+ Nuevo contrato</button>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      <div class="card" style="padding:16px;text-align:center;border-color:rgba(74,222,128,0.2)">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">✅ Activos</div>
        <div style="font-size:32px;font-weight:800;color:#4ade80">${activos}</div>
      </div>
      <div class="card" style="padding:16px;text-align:center;border-color:${porVencer>0?'rgba(245,158,11,0.3)':'var(--border)'}">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">⏰ Por vencer</div>
        <div style="font-size:32px;font-weight:800;color:${porVencer>0?'#f59e0b':'var(--text3)'}">${porVencer}</div>
      </div>
      <div class="card" style="padding:16px;text-align:center;border-color:${vencidos>0?'rgba(239,68,68,0.3)':'var(--border)'}">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">❌ Vencidos</div>
        <div style="font-size:32px;font-weight:800;color:${vencidos>0?'#ef4444':'var(--text3)'}">${vencidos}</div>
      </div>
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">💰 Monto total</div>
        <div style="font-size:20px;font-weight:800;color:var(--accent)">$${totalMonto.toLocaleString('es-AR',{maximumFractionDigits:0})}</div>
      </div>
    </div>

    <!-- Filtros y búsqueda -->
    <div class="card" style="margin-bottom:16px;padding:14px 16px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input type="text" id="buscar-contrato" placeholder="🔍 Buscar contrato..." 
          style="width:220px;padding:7px 12px;font-size:12px" 
          oninput="filtrarContratos()"/>
        <select id="filtro-estado" onchange="filtrarContratos()" style="width:140px;font-size:12px;padding:7px">
          <option value="">Todos los estados</option>
          <option value="activo">✅ Activo</option>
          <option value="por-vencer">⏰ Por vencer</option>
          <option value="vencido">❌ Vencido</option>
        </select>
        <select id="filtro-formula" onchange="filtrarContratos()" style="width:160px;font-size:12px;padding:7px">
          <option value="">Todas las fórmulas</option>
          ${[...new Set(listaContratos?.map(c => c.formulas?.nombre).filter(Boolean))].map(n => `<option value="${n}">${n}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" onclick="limpiarFiltros()">✕ Limpiar</button>
      </div>
    </div>

    <!-- Lista de contratos -->
    <div id="contratos-lista" style="display:grid;gap:12px">
  `

  if (!listaContratos || listaContratos.length === 0) {
    html += `
      <div class="card" style="text-align:center;padding:48px">
        <div style="font-size:32px;margin-bottom:12px">📋</div>
        <div style="font-size:16px;font-weight:500;margin-bottom:8px">Sin contratos todavía</div>
        <div style="color:var(--text3);font-size:13px;margin-bottom:20px">Creá tu primer contrato con ítems y fórmula polinómica</div>
        <button class="btn btn-accent" onclick="abrirNuevoContrato()">+ Crear primer contrato</button>
      </div>`
  } else {
    listaContratos.forEach(c => {
      const desde = c.vigencia_desde ? new Date(c.vigencia_desde) : null
      const hasta = c.vigencia_hasta ? new Date(c.vigencia_hasta) : null
      const desdeStr = desde ? desde.toLocaleDateString('es-AR') : '—'
      const hastaStr = hasta ? hasta.toLocaleDateString('es-AR') : '—'

      // Estado
      let estado = 'activo'
      let estadoLabel = '● Activo'
      let estadoColor = '#4ade80'
      let estadoBg = 'rgba(74,222,128,0.08)'
      let diasRestantes = null

      if (hasta) {
        diasRestantes = Math.ceil((hasta - hoy) / (1000*60*60*24))
        if (diasRestantes < 0) {
          estado = 'vencido'; estadoLabel = '● Vencido'; estadoColor = '#ef4444'; estadoBg = 'rgba(239,68,68,0.08)'
        } else if (diasRestantes <= 30) {
          estado = 'por-vencer'; estadoLabel = `⏰ Vence en ${diasRestantes}d`; estadoColor = '#f59e0b'; estadoBg = 'rgba(245,158,11,0.08)'
        }
      }

      // Progreso de vigencia
      let progresoPct = 0
      if (desde && hasta) {
        const total = hasta - desde
        const transcurrido = hoy - desde
        progresoPct = Math.min(100, Math.max(0, (transcurrido / total) * 100))
      }

      // Tipo de fórmula
      const tipoFormula = c.formulas?.nombre || 'Sin fórmula'
      const tipoTag = tipoFormula.toLowerCase().includes('indec') ? 'INDEC' :
                      tipoFormula !== 'Sin fórmula' ? 'Polinómica' : 'Sin fórmula'
      const tipoColor = tipoTag === 'INDEC' ? 'tag-blue' : tipoTag === 'Polinómica' ? 'tag-green' : 'tag-amber'

      html += `
        <div class="contrato-card" data-estado="${estado}" data-formula="${tipoFormula}" data-nombre="${c.nombre.toLowerCase()}"
          style="background:var(--surface);border:1px solid ${estado==='vencido'?'rgba(239,68,68,0.2)':estado==='por-vencer'?'rgba(245,158,11,0.2)':'var(--border)'};
                 border-radius:var(--radius);padding:20px;transition:all .2s;
                 background:${estadoBg}">

          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:14px">
            <!-- Info principal -->
            <div style="flex:1;min-width:200px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
                ${c.nro_contrato ? `<span style="font-size:10px;padding:2px 8px;border-radius:99px;background:var(--surface3);color:var(--text3);border:1px solid var(--border)">${c.nro_contrato}</span>` : ''}
                <span style="font-size:16px;font-weight:700;letter-spacing:-0.3px">${c.nombre}</span>
                <span style="font-size:10px;padding:2px 8px;border-radius:99px;background:${estadoBg};color:${estadoColor};border:1px solid ${estadoColor}33;font-weight:600">${estadoLabel}</span>
              </div>
              <div style="font-size:13px;color:var(--text2);margin-bottom:4px">
                ${c.proveedor ? `<strong>${c.proveedor}</strong>` : ''} ${c.actividad ? `<span style="color:var(--text3)">· ${c.actividad}</span>` : ''}
              </div>
              <div style="font-size:12px;color:var(--text3);margin-bottom:8px">
                📅 ${desdeStr} → ${hastaStr}
                ${diasRestantes !== null && diasRestantes >= 0 ? `<span style="color:${estadoColor};margin-left:6px">(${diasRestantes} días restantes)</span>` : ''}
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <span class="tag ${tipoColor}">${tipoTag}</span>
                ${c.gatillo_activo ? `<span class="tag tag-amber">⚡ Gatillo ${c.gatillo_pct}%</span>` : ''}
                ${c.gestor ? `<span style="font-size:11px;color:var(--text3)">👤 ${c.gestor}</span>` : ''}
              </div>
            </div>

            <!-- Montos -->
            <div style="text-align:right">
              <div style="font-size:11px;color:var(--text3);margin-bottom:2px">Monto base</div>
              <div style="font-size:22px;font-weight:800;color:var(--accent);letter-spacing:-0.5px">
                ${c.moneda === 'USD' ? 'USD' : '$'} ${Number(c.monto_base||0).toLocaleString('es-AR',{maximumFractionDigits:0})}
              </div>
              <div style="font-size:11px;color:var(--text3);margin-top:4px">${tipoFormula}</div>
            </div>
          </div>

          <!-- Barra de progreso de vigencia -->
          ${desde && hasta ? `
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:10px;color:var(--text3)">Vigencia</span>
              <span style="font-size:10px;color:${estadoColor}">${Math.round(progresoPct)}% transcurrido</span>
            </div>
            <div style="background:var(--surface3);border-radius:99px;height:4px;overflow:hidden">
              <div style="width:${progresoPct}%;background:${estadoColor};height:100%;border-radius:99px;transition:width .3s"></div>
            </div>
          </div>` : ''}

          <!-- Botones de acción -->
          <div style="display:flex;gap:8px;flex-wrap:wrap" onclick="event.stopPropagation()">
            <button class="btn btn-ghost btn-sm" onclick="abrirContrato('${c.id}')">✏️ Editar</button>
            <button class="btn btn-accent btn-sm" onclick="abrirYCalcular('${c.id}')">📊 Calcular</button>
            <button class="btn btn-ghost btn-sm" onclick="verHistorialContrato('${c.id}','${c.nombre}')">📅 Historial</button>
            <button class="btn btn-ghost btn-sm" onclick="exportarInformeRapido('${c.id}')">📄 PDF</button>
            <button class="btn btn-ghost btn-sm" style="color:#ef4444;margin-left:auto" onclick="eliminarContratoCompleto('${c.id}')">🗑</button>
          </div>
        </div>`
    })
  }

  html += `</div>`
  document.getElementById('page-content').innerHTML = html
}

function filtrarContratos() {
  const buscar = document.getElementById('buscar-contrato')?.value.toLowerCase() || ''
  const estado = document.getElementById('filtro-estado')?.value || ''
  const formula = document.getElementById('filtro-formula')?.value || ''

  document.querySelectorAll('.contrato-card').forEach(card => {
    const nombre = card.dataset.nombre || ''
    const cardEstado = card.dataset.estado || ''
    const cardFormula = card.dataset.formula || ''

    const matchBuscar = !buscar || nombre.includes(buscar)
    const matchEstado = !estado || cardEstado === estado
    const matchFormula = !formula || cardFormula === formula

    card.style.display = matchBuscar && matchEstado && matchFormula ? 'block' : 'none'
  })
}

function limpiarFiltros() {
  const b = document.getElementById('buscar-contrato')
  const e = document.getElementById('filtro-estado')
  const f = document.getElementById('filtro-formula')
  if (b) b.value = ''
  if (e) e.value = ''
  if (f) f.value = ''
  filtrarContratos()
}

async function abrirYCalcular(id) {
  await abrirContrato(id)
  setTimeout(() => calcularContratoCompleto(), 400)
}

async function verHistorialContrato(id, nombre) {
  const { data } = await sb.from('calculos_mensuales').select('*')
    .eq('org_id', currentOrg.id)
    .eq('contrato_id', id)
    .order('created_at', { ascending: false })

  const modal = document.createElement('div')
  modal.id = 'modal-overlay'
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center'

  let filas = ''
  if (!data || data.length === 0) {
    filas = '<tr><td colspan="4" style="padding:24px;text-align:center;color:var(--text3)">Sin historial para este contrato</td></tr>'
  } else {
    data.forEach(h => {
      const fecha = new Date(h.created_at).toLocaleDateString('es-AR')
      const color = h.ajuste_acumulado >= 0 ? '#4ade80' : '#ef4444'
      filas += `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 14px">${fecha}</td>
        <td style="padding:10px 14px">$${Number(h.monto_inicial).toLocaleString('es-AR',{maximumFractionDigits:0})}</td>
        <td style="padding:10px 14px;color:#4ade80;font-weight:600">$${Number(h.monto_final).toLocaleString('es-AR',{maximumFractionDigits:0})}</td>
        <td style="padding:10px 14px;font-weight:700;color:${color}">${h.ajuste_acumulado>=0?'+':''}${Number(h.ajuste_acumulado).toFixed(2)}%</td>
      </tr>`
    })
  }

  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;padding:28px;width:580px;border:1px solid var(--border);max-height:80vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3 style="font-size:16px;font-weight:600">📅 Historial — ${nombre}</h3>
        <button onclick="document.getElementById('modal-overlay').remove()" class="btn btn-ghost btn-sm">✕ Cerrar</button>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:var(--surface2)">
          <th style="padding:8px 14px;text-align:left;font-size:11px;color:var(--text3)">Fecha</th>
          <th style="padding:8px 14px;text-align:left;font-size:11px;color:var(--text3)">Monto inicial</th>
          <th style="padding:8px 14px;text-align:left;font-size:11px;color:var(--text3)">Monto final</th>
          <th style="padding:8px 14px;text-align:left;font-size:11px;color:var(--text3)">Ajuste</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`
  document.getElementById('modal-overlay')?.remove()
  document.body.appendChild(modal)
}

async function exportarInformeRapido(id) {
  const { data: c } = await sb.from('contratos').select('*, formulas(nombre,componentes)').eq('id', id).single()
  if (!c) return
  contratoEditando = c
  const { data: items } = await sb.from('contrato_items').select('*').eq('contrato_id', id).order('orden')
  itemsContratoActual = items || []
  await calcularContratoCompleto()
  setTimeout(() => {
    if (window._contratoCalculo) exportarInformeContrato()
  }, 500)
}

function abrirNuevoContrato() {
  contratoEditando = null
  itemsContratoActual = []
  mostrarFormContrato()
}

async function abrirContrato(id) {
  const { data: c } = await sb.from('contratos').select('*, formulas(nombre,componentes)').eq('id', id).single()
  const { data: items } = await sb.from('contrato_items').select('*').eq('contrato_id', id).order('orden')
  contratoEditando = c
  itemsContratoActual = items || []
  mostrarFormContrato()
}

function mostrarFormContrato() {
  const c = contratoEditando
  const optsFormulas = formulas.map(f =>
    `<option value="${f.id}" ${c?.formula_id === f.id ? 'selected' : ''}>${f.nombre}</option>`
  ).join('')

  const optsIndices = Object.entries(INDICES_META).map(([k, v]) =>
    `<option value="${k}">${k} — ${v.label}</option>`
  ).join('')

  const itemsHTML = itemsContratoActual.map((item, i) => renderItemRow(item, i)).join('')

  const html = `
    <div class="page-head">
      <div>
        <div class="page-title">${c ? 'Editar contrato' : 'Nuevo contrato'}</div>
        <div class="page-sub">${c?.nombre || 'Completá los datos del contrato'}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" onclick="renderContratos()">← Volver</button>
        ${c ? `<button class="btn btn-ghost btn-sm" style="color:#ef4444" onclick="eliminarContratoCompleto('${c.id}')">Eliminar</button>` : ''}
      </div>
    </div>

    <!-- ENCABEZADO DEL CONTRATO -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">Datos del contrato</div>
      <div class="grid-4" style="margin-bottom:12px">
        <div class="input-group" style="margin:0">
          <label>Nro. de contrato</label>
          <input type="text" id="c-nro" placeholder="Ej: C5836" value="${c?.nro_contrato||''}"/>
        </div>
        <div class="input-group" style="margin:0">
          <label>Nombre / Descripción *</label>
          <input type="text" id="c-nombre" placeholder="Ej: EyP CN Serv campamento" value="${c?.nombre||''}"/>
        </div>
        <div class="input-group" style="margin:0">
          <label>Proveedor</label>
          <input type="text" id="c-proveedor" placeholder="Ej: Servicios L&A S.R.L." value="${c?.proveedor||''}"/>
        </div>
        <div class="input-group" style="margin:0">
          <label>Actividad</label>
          <input type="text" id="c-actividad" placeholder="Ej: Comedor y Limpieza" value="${c?.actividad||''}"/>
        </div>
      </div>
      <div class="grid-4" style="margin-bottom:12px">
        <div class="input-group" style="margin:0">
          <label>Vigencia desde</label>
          <input type="date" id="c-desde" value="${c?.vigencia_desde||''}"/>
        </div>
        <div class="input-group" style="margin:0">
          <label>Vigencia hasta</label>
          <input type="date" id="c-hasta" value="${c?.vigencia_hasta||''}"/>
        </div>
        <div class="input-group" style="margin:0">
          <label>Gestor de Compras</label>
          <input type="text" id="c-gestor" placeholder="Nombre del gestor" value="${c?.gestor||''}"/>
        </div>
        <div class="input-group" style="margin:0">
          <label>Controlador</label>
          <input type="text" id="c-controlador" placeholder="Nombre del controlador" value="${c?.controlador||''}"/>
        </div>
      </div>
    </div>

    <!-- FÓRMULA Y GATILLO -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">Fórmula polinómica</div>
      <div class="grid-4">
        <div class="input-group" style="margin:0">
          <label>Fórmula *</label>
          <select id="c-formula">${optsFormulas}</select>
        </div>
        <div class="input-group" style="margin:0">
          <label>Período base (mes inicio)</label>
          <input type="month" id="c-periodo-base" value="${c?.periodo_desde||''}"/>
        </div>
        <div class="input-group" style="margin:0">
          <label>Período hasta</label>
          <input type="month" id="c-periodo-hasta" value="${c?.periodo_hasta||''}"/>
        </div>
        <div class="input-group" style="margin:0">
          <label>Moneda</label>
          <select id="c-moneda">
            <option value="ARS" ${c?.moneda==='ARS'||!c?.moneda?'selected':''}>Pesos Argentinos (ARS)</option>
            <option value="USD" ${c?.moneda==='USD'?'selected':''}>Dólar (USD)</option>
          </select>
        </div>
      </div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
          <input type="checkbox" id="c-gatillo" ${c?.gatillo_activo?'checked':''} onchange="toggleGatillo(this.checked)"/>
          Activar gatillo de actualización
        </label>
        <div id="gatillo-config" style="display:${c?.gatillo_activo?'flex':'none'};align-items:center;gap:8px">
          <span style="font-size:13px;color:var(--text3)">Disparar cuando la variación acumulada supere</span>
          <input type="number" id="c-gatillo-pct" value="${c?.gatillo_pct||5}" min="1" max="50" step="0.5" style="width:70px"/>
          <span style="font-size:13px;color:var(--text3)">%</span>
        </div>
      </div>
      ${c?.gatillo_activo ? `<div style="margin-top:8px;font-size:12px;color:var(--amber);background:rgba(245,158,11,0.1);padding:8px 12px;border-radius:8px">
        ⚡ La actualización se aplica cuando la variación acumulada desde el período base supera el ${c.gatillo_pct}%
      </div>` : ''}
    </div>

    <!-- ÍTEMS DEL CONTRATO -->
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div class="card-title" style="margin:0">Ítems del contrato</div>
        <button class="btn btn-ghost btn-sm" onclick="agregarItem()">+ Agregar ítem</button>
      </div>

      <div id="items-container">
        ${itemsHTML || `<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">
          Sin ítems todavía — hacé click en "+ Agregar ítem"
        </div>`}
      </div>

      <div id="items-totales" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
        ${renderTotalesItems()}
      </div>
    </div>

    <!-- BOTÓN GUARDAR -->
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-bottom:32px">
      <button class="btn btn-ghost" onclick="renderContratos()">Cancelar</button>
      <button class="btn btn-accent" onclick="guardarContratoCompleto()">💾 Guardar contrato</button>
      ${c ? `<button class="btn btn-accent" onclick="calcularContratoCompleto()" style="background:var(--green-dim,#052e16);color:#4ade80;border-color:#166534">
        📊 Calcular actualización
      </button>` : ''}
    </div>

    <!-- RESULTADO DE CÁLCULO -->
    <div id="resultado-contrato"></div>
  `

  document.getElementById('page-content').innerHTML = html
}

function renderItemRow(item, idx) {
  return `
    <div class="item-row" data-idx="${idx}" style="display:grid;grid-template-columns:1fr 160px 36px;gap:8px;margin-bottom:8px;align-items:center">
      <input type="text" class="item-desc" placeholder="Descripción del servicio/ítem" value="${item.descripcion||''}"
        oninput="actualizarItemLocal(${idx},'descripcion',this.value)"/>
      <div style="position:relative">
        <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:12px;pointer-events:none">$</span>
        <input type="number" class="item-monto" placeholder="0.00" value="${item.monto_base||''}" step="0.01"
          style="padding-left:22px" oninput="actualizarItemLocal(${idx},'monto_base',parseFloat(this.value)||0);renderTotalesItemsDOM()"/>
      </div>
      <button onclick="eliminarItemLocal(${idx})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:18px;padding:0">×</button>
    </div>`
}

function renderTotalesItems() {
  const total = itemsContratoActual.reduce((s, i) => s + (Number(i.monto_base)||0), 0)
  const count = itemsContratoActual.length
  if (count === 0) return ''
  return `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;color:var(--text3)">${count} ítem${count!==1?'s':''}</span>
      <span style="font-size:16px;font-weight:700">Total base: $${total.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
    </div>`
}

function renderTotalesItemsDOM() {
  const el = document.getElementById('items-totales')
  if (el) el.innerHTML = renderTotalesItems()
}

function actualizarItemLocal(idx, campo, valor) {
  if (itemsContratoActual[idx]) itemsContratoActual[idx][campo] = valor
}

function eliminarItemLocal(idx) {
  itemsContratoActual.splice(idx, 1)
  refreshItemsDOM()
}

function agregarItem() {
  itemsContratoActual.push({ descripcion: '', monto_base: 0, orden: itemsContratoActual.length })
  refreshItemsDOM()
}

function refreshItemsDOM() {
  const cont = document.getElementById('items-container')
  if (!cont) return
  if (itemsContratoActual.length === 0) {
    cont.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">Sin ítems — hacé click en "+ Agregar ítem"</div>`
  } else {
    cont.innerHTML = itemsContratoActual.map((item, i) => renderItemRow(item, i)).join('')
  }
  renderTotalesItemsDOM()
}

function toggleGatillo(activo) {
  const el = document.getElementById('gatillo-config')
  if (el) el.style.display = activo ? 'flex' : 'none'
}

async function guardarContratoCompleto() {
  const nombre = document.getElementById('c-nombre').value.trim()
  const formulaId = document.getElementById('c-formula').value
  if (!nombre) { toast('Poné un nombre al contrato', 'warn'); return }
  if (!formulaId) { toast('Seleccioná una fórmula', 'warn'); return }

  // Leer valores actuales de los inputs
  document.querySelectorAll('.item-row').forEach((row, idx) => {
    const desc = row.querySelector('.item-desc')?.value.trim()
    const monto = parseFloat(row.querySelector('.item-monto')?.value) || 0
    if (itemsContratoActual[idx]) {
      itemsContratoActual[idx].descripcion = desc || ''
      itemsContratoActual[idx].monto_base = monto
    }
  })

  const totalBase = itemsContratoActual.reduce((s, i) => s + (Number(i.monto_base)||0), 0)
  const gatilloActivo = document.getElementById('c-gatillo').checked
  const gatilloPct = parseFloat(document.getElementById('c-gatillo-pct')?.value) || 5

  const payload = {
    org_id: currentOrg.id,
    nombre,
    nro_contrato: document.getElementById('c-nro').value.trim(),
    proveedor: document.getElementById('c-proveedor').value.trim(),
    actividad: document.getElementById('c-actividad').value.trim(),
    gestor: document.getElementById('c-gestor').value.trim(),
    controlador: document.getElementById('c-controlador').value.trim(),
    vigencia_desde: document.getElementById('c-desde').value || null,
    vigencia_hasta: document.getElementById('c-hasta').value || null,
    formula_id: formulaId,
    periodo_desde: document.getElementById('c-periodo-base').value || null,
    periodo_hasta: document.getElementById('c-periodo-hasta').value || null,
    moneda: document.getElementById('c-moneda').value,
    monto_base: totalBase,
    gatillo_activo: gatilloActivo,
    gatillo_pct: gatilloPct
  }

  let contratoId = contratoEditando?.id

  if (contratoEditando) {
    const { error } = await sb.from('contratos').update(payload).eq('id', contratoId)
    if (error) { toast('Error: ' + error.message, 'error'); return }
  } else {
    const { data, error } = await sb.from('contratos').insert(payload).select().single()
    if (error) { toast('Error: ' + error.message, 'error'); return }
    contratoId = data.id
    contratoEditando = data
  }

  // Guardar ítems
  await sb.from('contrato_items').delete().eq('contrato_id', contratoId)
  const itemsValidos = itemsContratoActual.filter(i => i.descripcion && i.monto_base > 0)
  if (itemsValidos.length > 0) {
    const { error } = await sb.from('contrato_items').insert(
      itemsValidos.map((item, idx) => ({
        contrato_id: contratoId,
        org_id: currentOrg.id,
        descripcion: item.descripcion,
        monto_base: item.monto_base,
        orden: idx
      }))
    )
    if (error) { toast('Error guardando ítems: ' + error.message, 'error'); return }
  }

  await loadContratos()
  await registrarAuditoria(
    contratoEditando ? 'editó' : 'creó',
    'contrato', contratoId, payload.nombre,
    { monto: payload.monto_base, formula_id: payload.formula_id }
  )
  toast('Contrato guardado ✓', 'success')
  
  // Recargar para ver el botón calcular
  const { data: updated } = await sb.from('contratos').select('*, formulas(nombre,componentes)').eq('id', contratoId).single()
  contratoEditando = updated
  const { data: updatedItems } = await sb.from('contrato_items').select('*').eq('contrato_id', contratoId).order('orden')
  itemsContratoActual = updatedItems || []
  mostrarFormContrato()
}

async function calcularContratoCompleto() {
  if (!contratoEditando) return
  
  const formula = formulas.find(f => f.id === contratoEditando.formula_id)
  if (!formula) { toast('Sin fórmula asignada', 'warn'); return }

  const componentes = parseComponentes(formula.componentes)
  const periodoDesde = contratoEditando.periodo_desde
  const periodoHasta = contratoEditando.periodo_hasta

  if (!periodoDesde || !periodoHasta) { toast('Definí el período base y hasta', 'warn'); return }

  // Generar meses
  const meses = []
  let [y, m] = periodoDesde.split('-').map(Number)
  const [fy, fm] = periodoHasta.split('-').map(Number)
  while (y < fy || (y === fy && m <= fm)) {
    meses.push(`${y}-${String(m).padStart(2,'0')}`)
    m++; if (m > 12) { m = 1; y++ }
  }

  // Calcular variación total acumulada
  let varAcum = 0
  let mesBase = meses[0]
  // Período previo al inicio para calcular variación del primer mes
  const [y0, m0] = periodoDesde.split('-').map(Number)
  const prevM = m0 === 1 ? 12 : m0 - 1
  const prevY = m0 === 1 ? y0 - 1 : y0
  const periodoBase = `${prevY}-${String(prevM).padStart(2,'0')}`

  // Calcular mes a mes
  const evolucion = []
  for (let i = 0; i < meses.length; i++) {
    const mes = meses[i]
    const mesPrev = i === 0 ? periodoBase : meses[i-1]
    let varMes = 0
    let tieneData = false

    componentes.forEach(comp => {
      const v0 = indicesValores[comp.codigo]?.[mesPrev]?.valor
      const v1 = indicesValores[comp.codigo]?.[mes]?.valor
      if (v0 && v1 && v0 !== 0) {
        varMes += ((v1 - v0) / v0) * 100 * (comp.coef / 100)
        tieneData = true
      }
    })

    if (tieneData) {
      varAcum = ((1 + varAcum/100) * (1 + varMes/100) - 1) * 100
      evolucion.push({ mes, varMes, varAcum })
    }
  }

  // Aplicar gatillo si está activo
  let varAplicada = varAcum
  let gatilloInfo = ''
  if (contratoEditando.gatillo_activo && contratoEditando.gatillo_pct) {
    const umbral = Number(contratoEditando.gatillo_pct)
    if (Math.abs(varAcum) < umbral) {
      gatilloInfo = `<div style="padding:10px 14px;background:rgba(245,158,11,0.1);border-radius:8px;font-size:13px;color:#f59e0b;margin-bottom:16px">
        ⚡ Gatillo no alcanzado — variación acumulada ${varAcum.toFixed(2)}% no supera el umbral de ${umbral}%
      </div>`
      varAplicada = 0
    } else {
      gatilloInfo = `<div style="padding:10px 14px;background:rgba(74,222,128,0.1);border-radius:8px;font-size:13px;color:#4ade80;margin-bottom:16px">
        ✅ Gatillo disparado — variación ${varAcum.toFixed(2)}% supera el umbral de ${umbral}%
      </div>`
    }
  }

  // Calcular ítems actualizados
  const moneda = contratoEditando.moneda === 'USD' ? 'USD' : '$'
  const itemsActualizados = itemsContratoActual.map(item => {
    const montoActualizado = item.monto_base * (1 + varAplicada/100)
    const diferencia = montoActualizado - item.monto_base
    return { ...item, montoActualizado, diferencia }
  })

  const totalBase = itemsActualizados.reduce((s, i) => s + i.monto_base, 0)
  const totalActualizado = itemsActualizados.reduce((s, i) => s + i.montoActualizado, 0)
  const totalDif = totalActualizado - totalBase

  // Render resultado
  const filasItems = itemsActualizados.map(item => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:12px 16px">${item.descripcion}</td>
      <td style="padding:12px 16px;text-align:right">${moneda} ${item.monto_base.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td style="padding:12px 16px;text-align:right;color:var(--accent);font-weight:600">${moneda} ${item.montoActualizado.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td style="padding:12px 16px;text-align:right;color:${item.diferencia>=0?'#4ade80':'#f87171'};font-weight:500">
        ${item.diferencia>=0?'+':''}${moneda} ${item.diferencia.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}
      </td>
    </tr>`).join('')

  const filasEvolucion = evolucion.map(e => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 16px">${e.mes}</td>
      <td style="padding:8px 16px;text-align:right;color:${e.varMes>=0?'#4ade80':'#f87171'}">${e.varMes>=0?'+':''}${e.varMes.toFixed(3)}%</td>
      <td style="padding:8px 16px;text-align:right;font-weight:600;color:${e.varAcum>=0?'#4ade80':'#f87171'}">${e.varAcum>=0?'+':''}${e.varAcum.toFixed(3)}%</td>
    </tr>`).join('')

  const resultado = document.getElementById('resultado-contrato')
  if (!resultado) return

  resultado.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">Resultado de actualización</div>
      
      ${gatilloInfo}

      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        <div style="background:var(--card-bg);border-radius:10px;padding:16px;border:1px solid var(--border)">
          <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Variación acumulada</div>
          <div style="font-size:28px;font-weight:800;color:${varAcum>=0?'#4ade80':'#f87171'}">${varAcum>=0?'+':''}${varAcum.toFixed(2)}%</div>
        </div>
        <div style="background:var(--card-bg);border-radius:10px;padding:16px;border:1px solid var(--border)">
          <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Total base</div>
          <div style="font-size:22px;font-weight:700">${moneda} ${totalBase.toLocaleString('es-AR',{maximumFractionDigits:2})}</div>
        </div>
        <div style="background:var(--card-bg);border-radius:10px;padding:16px;border:1px solid var(--border)">
          <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Total actualizado</div>
          <div style="font-size:22px;font-weight:700;color:${varAplicada>=0?'#4ade80':'#f87171'}">${moneda} ${totalActualizado.toLocaleString('es-AR',{maximumFractionDigits:2})}</div>
          <div style="font-size:12px;color:${totalDif>=0?'#4ade80':'#f87171'};margin-top:4px">${totalDif>=0?'+':''}${moneda} ${totalDif.toLocaleString('es-AR',{maximumFractionDigits:2})}</div>
        </div>
      </div>

      <!-- Tabla ítems -->
      <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border);margin-bottom:16px">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:var(--card-bg)">
              <th style="padding:10px 16px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3)">Ítem</th>
              <th style="padding:10px 16px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3)">Precio base</th>
              <th style="padding:10px 16px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3)">Precio actualizado</th>
              <th style="padding:10px 16px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3)">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            ${filasItems}
            <tr style="background:var(--card-bg);font-weight:700;border-top:2px solid var(--border)">
              <td style="padding:12px 16px">TOTAL</td>
              <td style="padding:12px 16px;text-align:right">${moneda} ${totalBase.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
              <td style="padding:12px 16px;text-align:right;color:var(--accent)">${moneda} ${totalActualizado.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
              <td style="padding:12px 16px;text-align:right;color:${totalDif>=0?'#4ade80':'#f87171'}">${totalDif>=0?'+':''}${moneda} ${totalDif.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Evolución de índices -->
      <details style="margin-top:8px">
        <summary style="cursor:pointer;font-size:13px;color:var(--text3);padding:8px 0">Ver evolución mensual de índices</summary>
        <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border);margin-top:8px">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:var(--card-bg)">
                <th style="padding:8px 16px;text-align:left;color:var(--text3)">Período</th>
                <th style="padding:8px 16px;text-align:right;color:var(--text3)">Var. mensual</th>
                <th style="padding:8px 16px;text-align:right;color:var(--text3)">Var. acumulada</th>
              </tr>
            </thead>
            <tbody>${filasEvolucion}</tbody>
          </table>
        </div>
      </details>

      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-ghost" onclick="exportarInformeContrato()">📄 Informe PDF</button>
        <button class="btn btn-ghost" onclick="exportarExcelContrato()">↓ Excel</button>
      </div>
    </div>
  `

  // Guardar resultado para exportar
  window._contratoCalculo = { contratoEditando, itemsActualizados, varAcum, varAplicada, totalBase, totalActualizado, totalDif, evolucion, formula, moneda }

  resultado.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function eliminarContratoCompleto(id) {
  if (!confirm('¿Eliminar este contrato y todos sus ítems?')) return
  await sb.from('contrato_items').delete().eq('contrato_id', id)
  await sb.from('contratos').delete().eq('id', id)
  toast('Contrato eliminado', 'success')
  await loadContratos()
  renderContratos()
}

function exportarInformeContrato() {
  if (!window._contratoCalculo) { toast('Calculá primero', 'warn'); return }
  const { contratoEditando: c, itemsActualizados, varAcum, varAplicada, totalBase, totalActualizado, totalDif, evolucion, formula, moneda } = window._contratoCalculo
  const hoy = new Date().toLocaleDateString('es-AR', {day:'2-digit',month:'long',year:'numeric'})

  const filasItems = itemsActualizados.map(i => `
    <tr>
      <td>${i.descripcion}</td>
      <td style="text-align:right">${moneda} ${i.monto_base.toLocaleString('es-AR',{minimumFractionDigits:2})}</td>
      <td style="text-align:right;color:#059669;font-weight:600">${moneda} ${i.montoActualizado.toLocaleString('es-AR',{minimumFractionDigits:2})}</td>
      <td style="text-align:right;color:${i.diferencia>=0?'#059669':'#dc2626'}">${i.diferencia>=0?'+':''}${moneda} ${i.diferencia.toLocaleString('es-AR',{minimumFractionDigits:2})}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/>
<title>PoliCalc — ${c.nombre}</title>
<style>
* { box-sizing:border-box; margin:0; padding:0 }
body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f8fafc; color:#1e293b; padding:40px 20px }
.page { max-width:960px; margin:0 auto }
table { width:100%; border-collapse:collapse }
th,td { padding:10px 14px; border-bottom:1px solid #e2e8f0; font-size:13px }
th { font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; font-weight:600; background:#f8fafc; text-align:left }
@media print { body{background:white;padding:0} .no-print{display:none} }
</style></head><body><div class="page">

  <div style="background:linear-gradient(135deg,#1e293b,#334155);border-radius:16px;padding:36px 40px;margin-bottom:24px;color:white">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
      <div>
        <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">PoliCalc — Actualización Contractual</div>
        <div style="font-size:26px;font-weight:700;margin-bottom:4px">${c.nombre}</div>
        ${c.nro_contrato ? `<div style="font-size:13px;color:#94a3b8">Contrato ${c.nro_contrato}</div>` : ''}
        <div style="font-size:13px;color:#64748b;margin-top:6px">${c.proveedor||''} ${c.actividad?'· '+c.actividad:''}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Fórmula: ${formula.nombre}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;color:#94a3b8;margin-bottom:4px">Ajuste aplicado</div>
        <div style="font-size:52px;font-weight:800;color:${varAplicada>=0?'#34d399':'#f87171'}">${varAplicada>=0?'+':''}${varAplicada.toFixed(2)}%</div>
        <div style="font-size:12px;color:#64748b">${hoy}</div>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px">
    <div style="background:white;border-radius:12px;padding:20px;border:1px solid #e2e8f0">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:6px">Total base</div>
      <div style="font-size:22px;font-weight:700">${moneda} ${totalBase.toLocaleString('es-AR',{minimumFractionDigits:2})}</div>
    </div>
    <div style="background:white;border-radius:12px;padding:20px;border:1px solid #e2e8f0">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:6px">Total actualizado</div>
      <div style="font-size:22px;font-weight:700;color:#059669">${moneda} ${totalActualizado.toLocaleString('es-AR',{minimumFractionDigits:2})}</div>
    </div>
    <div style="background:white;border-radius:12px;padding:20px;border:1px solid #e2e8f0">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:6px">Diferencia</div>
      <div style="font-size:22px;font-weight:700;color:${totalDif>=0?'#059669':'#dc2626'}">${totalDif>=0?'+':''}${moneda} ${totalDif.toLocaleString('es-AR',{minimumFractionDigits:2})}</div>
    </div>
  </div>

  <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:20px;overflow:hidden">
    <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;font-weight:600">Detalle de ítems</div>
    <table>
      <thead><tr>
        <th>Descripción</th><th style="text-align:right">Precio base</th>
        <th style="text-align:right">Precio actualizado</th><th style="text-align:right">Diferencia</th>
      </tr></thead>
      <tbody>
        ${filasItems}
        <tr style="font-weight:700;background:#f8fafc">
          <td>TOTAL</td>
          <td style="text-align:right">${moneda} ${totalBase.toLocaleString('es-AR',{minimumFractionDigits:2})}</td>
          <td style="text-align:right;color:#059669">${moneda} ${totalActualizado.toLocaleString('es-AR',{minimumFractionDigits:2})}</td>
          <td style="text-align:right;color:${totalDif>=0?'#059669':'#dc2626'}">${totalDif>=0?'+':''}${moneda} ${totalDif.toLocaleString('es-AR',{minimumFractionDigits:2})}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div style="text-align:center;color:#94a3b8;font-size:12px;margin-top:24px">
    Generado por <strong>PoliCalc</strong> · ${hoy} · Datos: INDEC, BNA, YPF
  </div>

  <div class="no-print" style="text-align:center;margin-top:20px">
    <button onclick="window.print()" style="background:#1e293b;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">🖨️ Guardar como PDF</button>
  </div>
</div></body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}

async function exportarExcelContrato() {
  if (!window._contratoCalculo) { toast('Calculá primero', 'warn'); return }
  if (!window.XLSX) {
    await new Promise((res,rej) => { const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s) })
  }
  const { contratoEditando: c, itemsActualizados, varAcum, varAplicada, totalBase, totalActualizado, totalDif, evolucion, formula } = window._contratoCalculo
  const hoy = new Date().toLocaleDateString('es-AR')

  const filas = [
    ['POLICALC — ACTUALIZACIÓN CONTRACTUAL'],
    [],
    ['Contrato', c.nombre], ['Nro.', c.nro_contrato||''], ['Proveedor', c.proveedor||''],
    ['Actividad', c.actividad||''], ['Vigencia', `${c.vigencia_desde||''} → ${c.vigencia_hasta||''}`],
    ['Fórmula', formula.nombre], ['Gestor', c.gestor||''], ['Controlador', c.controlador||''],
    ['Fecha cálculo', hoy],
    [],
    ['Ajuste calculado', varAcum/100], ['Ajuste aplicado', varAplicada/100],
    [],
    ['DETALLE DE ÍTEMS', '', '', ''],
    ['Descripción', 'Precio base', 'Precio actualizado', 'Diferencia'],
    ...itemsActualizados.map(i => [i.descripcion, i.monto_base, i.montoActualizado, i.diferencia]),
    ['TOTAL', totalBase, totalActualizado, totalDif],
    [],
    ['EVOLUCIÓN MENSUAL'],
    ['Período', 'Var. mensual', 'Var. acumulada'],
    ...evolucion.map(e => [e.mes, e.varMes/100, e.varAcum/100])
  ]

  const ws = XLSX.utils.aoa_to_sheet(filas)
  ws['!cols'] = [{wch:40},{wch:18},{wch:18},{wch:18}]
  const fmtPeso = '"$"#,##0.00'; const fmtPct = '+0.00%;-0.00%'
  ;['B13','B14'].forEach(r => { if(ws[r]) ws[r].z = fmtPct })
  const baseItems = 16
  itemsActualizados.forEach((_, i) => {
    ;['B','C','D'].forEach(col => { const r = col+(baseItems+i); if(ws[r]) ws[r].z = fmtPeso })
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Contrato')
  XLSX.writeFile(wb, `PoliCalc_${c.nombre.replace(/\s+/g,'_')}_${hoy.replace(/\//g,'-')}.xlsx`)
  toast('Excel exportado ✓', 'success')
}

// ════════════════════════════════════════════════════════════════
// PANEL DE ADMIN — Solo superadmin
// ════════════════════════════════════════════════════════════════

async function renderAdmin() {
  if (currentUser.rol !== 'superadmin') {
    document.getElementById('page-content').innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">Acceso restringido</div>`
    return
  }

  // Cargar todas las orgs
  const { data: orgs } = await sb.from('organizaciones').select('*').order('created_at', { ascending: false })
  const { data: usuarios } = await sb.from('usuarios').select('*').order('created_at', { ascending: false })
  const { data: contratos } = await sb.from('contratos').select('org_id')

  // Contar por org
  const contratosXOrg = {}
  contratos?.forEach(c => { contratosXOrg[c.org_id] = (contratosXOrg[c.org_id] || 0) + 1 })
  const usuariosXOrg = {}
  usuarios?.forEach(u => { usuariosXOrg[u.org_id] = (usuariosXOrg[u.org_id] || 0) + 1 })

  const planColor = { trial: '#f59e0b', activo: '#4ade80', inactivo: '#ef4444' }

  let html = `
    <div class="page-head">
      <div>
        <div class="page-title">Panel de administración</div>
        <div class="page-sub">Gestión de organizaciones y usuarios — solo superadmin</div>
      </div>
      <button class="btn btn-accent" onclick="abrirNuevaOrg()">+ Nueva organización</button>
    </div>

    <!-- KPIs globales -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:6px">Organizaciones</div>
        <div style="font-size:32px;font-weight:800;color:var(--accent)">${orgs?.length || 0}</div>
      </div>
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:6px">Usuarios totales</div>
        <div style="font-size:32px;font-weight:800;color:var(--accent)">${usuarios?.length || 0}</div>
      </div>
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:6px">Contratos totales</div>
        <div style="font-size:32px;font-weight:800;color:var(--accent)">${contratos?.length || 0}</div>
      </div>
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:6px">En trial</div>
        <div style="font-size:32px;font-weight:800;color:#f59e0b">${orgs?.filter(o=>o.plan==='trial').length || 0}</div>
      </div>
    </div>

    <!-- Lista de organizaciones -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">Organizaciones</div>
      <div style="display:grid;gap:10px">
  `

  orgs?.forEach(org => {
    const nContratos = contratosXOrg[org.id] || 0
    const nUsuarios = usuariosXOrg[org.id] || 0
    const color = planColor[org.plan] || '#94a3b8'
    const created = org.created_at ? new Date(org.created_at).toLocaleDateString('es-AR') : '—'

    html += `
      <div style="display:grid;grid-template-columns:1fr auto;gap:12px;padding:14px 16px;background:var(--card-bg);border-radius:10px;border:1px solid var(--border);align-items:center">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:14px;font-weight:600">${org.nombre}</span>
            <span style="font-size:11px;padding:2px 8px;border-radius:99px;background:${color}22;color:${color};border:1px solid ${color}44">${org.plan}</span>
            ${!org.activa ? '<span style="font-size:11px;color:#ef4444">● Inactiva</span>' : ''}
          </div>
          <div style="font-size:12px;color:var(--text3)">${org.email_contacto || '—'} &nbsp;·&nbsp; ${nUsuarios} usuario${nUsuarios!==1?'s':''} &nbsp;·&nbsp; ${nContratos} contrato${nContratos!==1?'s':''} &nbsp;·&nbsp; desde ${created}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" onclick="verUsuariosOrg('${org.id}','${org.nombre}')">👥 Usuarios</button>
          <button class="btn btn-ghost btn-sm" onclick="invitarUsuario('${org.id}','${org.nombre}')">+ Invitar</button>
          <button class="btn btn-ghost btn-sm" onclick="editarOrg('${org.id}')">✏️</button>
          <button class="btn btn-ghost btn-sm" style="color:#ef4444" onclick="eliminarOrg('${org.id}','${org.nombre}')">🗑</button>
          <select onchange="cambiarPlan('${org.id}',this.value)" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--card-bg);color:var(--text)">
            <option value="trial" ${org.plan==='trial'?'selected':''}>Trial</option>
            <option value="activo" ${org.plan==='activo'?'selected':''}>Activo</option>
            <option value="inactivo" ${org.plan==='inactivo'?'selected':''}>Inactivo</option>
          </select>
        </div>
      </div>`
  })

  html += `</div></div>

    <!-- Lista de usuarios -->
    <div class="card">
      <div class="card-title">Todos los usuarios</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:var(--card-bg)">
              <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3)">Usuario</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3)">Email</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3)">Organización</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3)">Rol</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3)">Acciones</th>
            </tr>
          </thead>
          <tbody>
  `

  usuarios?.forEach(u => {
    const org = orgs?.find(o => o.id === u.org_id)
    const rolColor = u.rol === 'superadmin' ? '#f59e0b' : u.rol === 'admin' ? '#6366f1' : 'var(--text3)'
    html += `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 14px;font-weight:500">${u.nombre || '—'}</td>
        <td style="padding:10px 14px;color:var(--text3)">${u.email || '—'}</td>
        <td style="padding:10px 14px">${org?.nombre || '—'}</td>
        <td style="padding:10px 14px"><span style="color:${rolColor};font-size:12px;font-weight:500">${u.rol}</span></td>
        <td style="padding:10px 14px;display:flex;gap:6px;align-items:center">
          <select onchange="cambiarRolUsuario('${u.id}',this.value)" style="font-size:11px;padding:3px 6px;border-radius:6px;border:1px solid var(--border);background:var(--card-bg);color:var(--text)">
            <option value="usuario" ${u.rol==='usuario'?'selected':''}>usuario</option>
            <option value="admin" ${u.rol==='admin'?'selected':''}>admin</option>
            <option value="superadmin" ${u.rol==='superadmin'?'selected':''}>superadmin</option>
          </select>
          ${u.rol !== 'superadmin' ? `<button onclick="eliminarUsuario('${u.id}','${u.nombre}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px" title="Eliminar usuario">🗑</button>` : ''}
        </td>
      </tr>`
  })

  html += `</tbody></table></div></div>`
  document.getElementById('page-content').innerHTML = html
}

// ════ MODAL NUEVA ORG ════
function abrirNuevaOrg() {
  const modal = document.createElement('div')
  modal.id = 'modal-overlay'
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center'
  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;padding:28px;width:440px;border:1px solid var(--border)">
      <h3 style="margin-bottom:20px;font-size:16px;font-weight:600">Nueva organización</h3>
      <div class="input-group"><label>Nombre *</label><input type="text" id="no-nombre" placeholder="Ej: Servicios L&A S.R.L."/></div>
      <div class="input-group"><label>Slug (identificador único) *</label><input type="text" id="no-slug" placeholder="Ej: servicios-la"/></div>
      <div class="input-group"><label>Email de contacto</label><input type="email" id="no-email" placeholder="admin@empresa.com"/></div>
      <div class="input-group"><label>Plan</label>
        <select id="no-plan"><option value="trial">Trial</option><option value="activo">Activo</option></select>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').remove()">Cancelar</button>
        <button class="btn btn-accent" onclick="crearOrg()">Crear organización</button>
      </div>
    </div>`
  document.body.appendChild(modal)
}

async function crearOrg() {
  const nombre = document.getElementById('no-nombre').value.trim()
  const slug = document.getElementById('no-slug').value.trim().toLowerCase().replace(/\s+/g,'-')
  const email = document.getElementById('no-email').value.trim()
  const plan = document.getElementById('no-plan').value

  if (!nombre || !slug) { toast('Completá nombre y slug', 'warn'); return }

  const { error } = await sb.from('organizaciones').insert({ nombre, slug, email_contacto: email, plan, activa: true })
  if (error) { toast('Error: ' + error.message, 'error'); return }

  document.getElementById('modal-overlay').remove()
  toast('Organización creada ✓', 'success')
  renderAdmin()
}

async function cambiarPlan(orgId, plan) {
  await sb.from('organizaciones').update({ plan }).eq('id', orgId)
  toast(`Plan actualizado a ${plan} ✓`, 'success')
}

async function cambiarRolUsuario(userId, rol) {
  await sb.from('usuarios').update({ rol }).eq('id', userId)
  toast(`Rol actualizado a ${rol} ✓`, 'success')
}

async function verUsuariosOrg(orgId, orgNombre) {
  const { data: usuarios } = await sb.from('usuarios').select('*').eq('org_id', orgId)
  const { data: invitaciones } = await sb.from('invitaciones').select('*').eq('org_id', orgId)

  const modal = document.createElement('div')
  modal.id = 'modal-overlay'
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center'

  let filas = usuarios?.map(u => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 12px">${u.nombre||'—'}</td>
      <td style="padding:8px 12px;color:var(--text3)">${u.email||'—'}</td>
      <td style="padding:8px 12px">${u.rol}</td>
    </tr>`).join('') || '<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--text3)">Sin usuarios</td></tr>'

  let filasInv = invitaciones?.filter(i=>!i.usada).map(i => `
    <div style="font-size:12px;padding:6px 10px;background:var(--card-bg);border-radius:6px;border:1px solid var(--border);display:flex;justify-content:space-between">
      <span>${i.email}</span><span style="color:var(--text3)">${i.rol} · pendiente</span>
    </div>`).join('') || '<div style="font-size:12px;color:var(--text3)">Sin invitaciones pendientes</div>'

  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;padding:28px;width:500px;border:1px solid var(--border);max-height:80vh;overflow-y:auto">
      <h3 style="margin-bottom:16px;font-size:16px">${orgNombre}</h3>
      <div class="card-title">Usuarios activos</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
        <thead><tr style="background:var(--card-bg)">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3)">Nombre</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3)">Email</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text3)">Rol</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="card-title">Invitaciones pendientes</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">${filasInv}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="invitarUsuario('${orgId}','${orgNombre}')">+ Invitar usuario</button>
        <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').remove()">Cerrar</button>
      </div>
    </div>`
  document.getElementById('modal-overlay')?.remove()
  document.body.appendChild(modal)
}

function invitarUsuario(orgId, orgNombre) {
  document.getElementById('modal-overlay')?.remove()
  const modal = document.createElement('div')
  modal.id = 'modal-overlay'
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center'
  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;padding:28px;width:400px;border:1px solid var(--border)">
      <h3 style="margin-bottom:16px;font-size:16px">Invitar usuario a ${orgNombre}</h3>
      <div class="input-group"><label>Email del usuario *</label><input type="email" id="inv-email" placeholder="usuario@empresa.com"/></div>
      <div class="input-group"><label>Rol</label>
        <select id="inv-rol">
          <option value="usuario">usuario</option>
          <option value="admin">admin</option>
        </select>
      </div>
      <p style="font-size:12px;color:var(--text3);margin-bottom:16px">El usuario podrá registrarse con este email y quedará asignado automáticamente a ${orgNombre}.</p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').remove()">Cancelar</button>
        <button class="btn btn-accent" onclick="crearInvitacion('${orgId}')">Enviar invitación</button>
      </div>
    </div>`
  document.body.appendChild(modal)
}

async function crearInvitacion(orgId) {
  const email = document.getElementById('inv-email').value.trim()
  const rol = document.getElementById('inv-rol').value
  if (!email) { toast('Ingresá un email', 'warn'); return }

  const { error } = await sb.from('invitaciones').insert({ org_id: orgId, email, rol })
  if (error) { toast('Error: ' + error.message, 'error'); return }

  document.getElementById('modal-overlay').remove()
  toast(`Invitación creada para ${email} ✓`, 'success')
  renderAdmin()
}

async function editarOrg(orgId) {
  const { data: org } = await sb.from('organizaciones').select('*').eq('id', orgId).single()
  if (!org) return

  document.getElementById('modal-overlay')?.remove()
  const modal = document.createElement('div')
  modal.id = 'modal-overlay'
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center'
  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;padding:28px;width:440px;border:1px solid var(--border)">
      <h3 style="margin-bottom:20px;font-size:16px">Editar organización</h3>
      <div class="input-group"><label>Nombre</label><input type="text" id="eo-nombre" value="${org.nombre||''}"/></div>
      <div class="input-group"><label>Email de contacto</label><input type="email" id="eo-email" value="${org.email_contacto||''}"/></div>
      <div class="input-group"><label>Activa</label>
        <select id="eo-activa">
          <option value="true" ${org.activa?'selected':''}>Sí</option>
          <option value="false" ${!org.activa?'selected':''}>No</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').remove()">Cancelar</button>
        <button class="btn btn-accent" onclick="guardarOrg('${orgId}')">Guardar</button>
      </div>
    </div>`
  document.body.appendChild(modal)
}

async function eliminarOrg(orgId, nombre) {
  if (!confirm(`¿Eliminar la organización "${nombre}" y TODOS sus datos? Esta acción no se puede deshacer.`)) return
  
  // Borrar en cascada
  await sb.from('calculos_mensuales').delete().eq('org_id', orgId)
  await sb.from('contrato_items').delete().eq('org_id', orgId)
  await sb.from('contratos').delete().eq('org_id', orgId)
  await sb.from('formulas').delete().eq('org_id', orgId)
  await sb.from('alertas').delete().eq('org_id', orgId)
  await sb.from('invitaciones').delete().eq('org_id', orgId)
  await sb.from('usuarios').delete().eq('org_id', orgId)
  await sb.from('organizaciones').delete().eq('id', orgId)

  document.getElementById('modal-overlay')?.remove()
  toast('Organización eliminada ✓', 'success')
  renderAdmin()
}

async function eliminarUsuario(userId, nombre) {
  if (!confirm(`¿Eliminar el usuario "${nombre}"? Perderá acceso a la plataforma.`)) return
  const { error } = await sb.from('usuarios').delete().eq('id', userId)
  if (error) { toast('Error: ' + error.message, 'error'); return }
  toast(`Usuario ${nombre} eliminado ✓`, 'success')
  renderAdmin()
}

async function guardarOrg(orgId) {
  const nombre = document.getElementById('eo-nombre').value.trim()
  const email_contacto = document.getElementById('eo-email').value.trim()
  const activa = document.getElementById('eo-activa').value === 'true'
  const { error } = await sb.from('organizaciones').update({ nombre, email_contacto, activa }).eq('id', orgId)
  if (error) { toast('Error: ' + error.message, 'error'); return }
  document.getElementById('modal-overlay').remove()
  toast('Organización actualizada ✓', 'success')
  renderAdmin()
}

// ════════════════════════════════════════════════════════════════
// TIMELINE OPERACIONAL — Panel de auditoría
// ════════════════════════════════════════════════════════════════

async function renderTimeline() {
  if (currentUser.rol !== 'superadmin') {
    document.getElementById('page-content').innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">Acceso restringido</div>`
    return
  }

  const { data: eventos } = await sb
    .from('auditoria')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  const ACCION_CONFIG = {
    'creó':           { icon: '✨', color: '#4ade80', label: 'Creación'  },
    'editó':          { icon: '✏️', color: '#f59e0b', label: 'Edición'   },
    'eliminó':        { icon: '🗑',  color: '#ef4444', label: 'Eliminación'},
    'cargó índice':   { icon: '📊', color: '#6366f1', label: 'Índice'    },
    'guardó cálculo': { icon: '💾', color: '#3b82f6', label: 'Cálculo'   },
    'default':        { icon: '🔔', color: '#94a3b8', label: 'Evento'    },
  }

  const ENTIDAD_ICON = {
    'contrato': '📋',
    'formula':  '⚙️',
    'indice':   '📈',
    'calculo':  '🧮',
    'usuario':  '👤',
    'default':  '📌',
  }

  // Agrupar por día
  const porDia = {}
  eventos?.forEach(e => {
    const dia = new Date(e.created_at).toLocaleDateString('es-AR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })
    if (!porDia[dia]) porDia[dia] = []
    porDia[dia].push(e)
  })

  let html = `
    <div class="page-head">
      <div>
        <div class="page-title">Timeline operacional</div>
        <div class="page-sub">Registro de todas las acciones del sistema</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="renderTimeline()">↻ Actualizar</button>
        <button class="btn btn-ghost btn-sm" onclick="goPage('admin')">← Admin</button>
      </div>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">Eventos hoy</div>
        <div style="font-size:32px;font-weight:800;color:var(--accent)">
          ${eventos?.filter(e => new Date(e.created_at).toDateString() === new Date().toDateString()).length || 0}
        </div>
      </div>
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">Total eventos</div>
        <div style="font-size:32px;font-weight:800;color:var(--text2)">${eventos?.length || 0}</div>
      </div>
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">Usuarios activos</div>
        <div style="font-size:32px;font-weight:800;color:#4ade80">
          ${new Set(eventos?.map(e => e.usuario_id)).size || 0}
        </div>
      </div>
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">Índices cargados</div>
        <div style="font-size:32px;font-weight:800;color:#6366f1">
          ${eventos?.filter(e => e.accion === 'cargó índice').length || 0}
        </div>
      </div>
    </div>
  `

  if (!eventos || eventos.length === 0) {
    html += `
      <div class="card" style="text-align:center;padding:48px">
        <div style="font-size:40px;margin-bottom:12px">📭</div>
        <div style="font-size:16px;font-weight:500;margin-bottom:8px">Sin eventos registrados</div>
        <div style="color:var(--text3);font-size:13px">Los eventos aparecerán aquí cuando los usuarios empiecen a usar la plataforma</div>
      </div>`
  } else {
    html += `<div style="position:relative">`

    Object.entries(porDia).forEach(([dia, evs]) => {
      // Capitalizar día
      const diaCapital = dia.charAt(0).toUpperCase() + dia.slice(1)

      html += `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;margin-top:8px">
          <div style="height:1px;flex:1;background:var(--border)"></div>
          <span style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;white-space:nowrap;padding:4px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:99px">${diaCapital}</span>
          <div style="height:1px;flex:1;background:var(--border)"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px">`

      evs.forEach(e => {
        const cfg = ACCION_CONFIG[e.accion] || ACCION_CONFIG.default
        const entIcon = ENTIDAD_ICON[e.entidad] || ENTIDAD_ICON.default
        const hora = new Date(e.created_at).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })
        
        // Formatear detalle
        let detalleStr = ''
        if (e.detalle) {
          if (e.detalle.monto) detalleStr += `Monto: $${Number(e.detalle.monto).toLocaleString('es-AR')} `
          if (e.detalle.valor) detalleStr += `Valor: ${e.detalle.valor} `
          if (e.detalle.ajuste_acumulado) detalleStr += `Ajuste: ${Number(e.detalle.ajuste_acumulado).toFixed(2)}% `
          if (e.detalle.monto_final) detalleStr += `→ $${Number(e.detalle.monto_final).toLocaleString('es-AR')}`
        }

        html += `
          <div style="display:flex;gap:14px;align-items:flex-start;padding:14px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);transition:all .2s"
            onmouseover="this.style.borderColor='var(--border2)'" onmouseout="this.style.borderColor='var(--border)'">
            
            <!-- Ícono acción -->
            <div style="width:36px;height:36px;border-radius:50%;background:${cfg.color}15;border:1px solid ${cfg.color}33;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">
              ${cfg.icon}
            </div>

            <!-- Contenido -->
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
                <span style="font-weight:600;font-size:13px">${e.usuario_nombre || 'Sistema'}</span>
                <span style="font-size:12px;color:var(--text3)">${e.accion}</span>
                <span style="font-size:12px">${entIcon}</span>
                <span style="font-size:12px;font-weight:500;color:${cfg.color}">${e.entidad_nombre || e.entidad}</span>
              </div>
              ${detalleStr ? `<div style="font-size:11px;color:var(--text3);background:var(--surface2);padding:4px 8px;border-radius:4px;display:inline-block">${detalleStr.trim()}</div>` : ''}
            </div>

            <!-- Hora -->
            <div style="font-size:11px;color:var(--text3);white-space:nowrap;flex-shrink:0">${hora}</div>
          </div>`
      })

      html += `</div>`
    })

    html += `</div>`
  }

  document.getElementById('page-content').innerHTML = html
}

// ════════════════════════════════════════════════════════════════
// CRM ENTERPRISE — Gestión de clientes nivel premium
// ════════════════════════════════════════════════════════════════

let crmOrgActual = null

async function renderCRM() {
  if (currentUser.rol !== 'superadmin') {
    document.getElementById('page-content').innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">Acceso restringido</div>`
    return
  }

  const { data: orgs } = await sb.from('organizaciones').select('*').order('nombre')
  const { data: interacciones } = await sb.from('crm_interacciones').select('*').order('fecha', { ascending: false }).limit(5)

  // KPIs
  const hoy = new Date()
  const en7dias = new Date(hoy.getTime() + 7*24*60*60*1000).toISOString().slice(0,10)
  const seguimientos = orgs?.filter(o => o.proximo_seguimiento && o.proximo_seguimiento <= en7dias).length || 0

  let html = `
    <div class="page-head">
      <div>
        <div class="page-title">CRM — Gestión de clientes</div>
        <div class="page-sub">Historial, contactos, seguimientos e inteligencia comercial</div>
      </div>
      <button class="btn btn-accent" onclick="goPage('admin')">← Admin</button>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">Clientes totales</div>
        <div style="font-size:36px;font-weight:800;color:var(--accent)">${orgs?.length || 0}</div>
      </div>
      <div class="card" style="padding:16px;text-align:center;border-color:${seguimientos>0?'rgba(245,158,11,0.3)':'var(--border)'}">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">⏰ Seguimientos esta semana</div>
        <div style="font-size:36px;font-weight:800;color:${seguimientos>0?'#f59e0b':'var(--text3)'}">${seguimientos}</div>
      </div>
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">Interacciones totales</div>
        <div style="font-size:36px;font-weight:800;color:#6366f1">${interacciones?.length || 0}</div>
      </div>
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">Cuentas premium</div>
        <div style="font-size:36px;font-weight:800;color:#4ade80">${orgs?.filter(o=>o.nivel_cuenta==='premium').length || 0}</div>
      </div>
    </div>

    <!-- Lista de clientes -->
    <div class="card">
      <div class="card-title">Clientes</div>
      <div style="display:grid;gap:10px">
  `

  orgs?.forEach(org => {
    const nivelColor = { premium: '#f59e0b', enterprise: '#6366f1', standard: '#94a3b8' }
    const color = nivelColor[org.nivel_cuenta] || '#94a3b8'
    const diasSinContacto = org.ultima_interaccion
      ? Math.floor((hoy - new Date(org.ultima_interaccion)) / (1000*60*60*24))
      : null
    const alertaSeguimiento = org.proximo_seguimiento && org.proximo_seguimiento <= en7dias

    html += `
      <div onclick="abrirFichaCliente('${org.id}')"
        style="display:flex;justify-content:space-between;align-items:center;padding:16px 18px;
               background:var(--surface2);border:1px solid ${alertaSeguimiento?'rgba(245,158,11,0.3)':'var(--border)'};
               border-radius:var(--radius);cursor:pointer;transition:all .2s"
        onmouseover="this.style.borderColor='var(--border2)';this.style.transform='translateX(2px)'"
        onmouseout="this.style.borderColor='${alertaSeguimiento?'rgba(245,158,11,0.3)':'var(--border)'}';this.style.transform='translateX(0)'">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:42px;height:42px;border-radius:10px;background:${color}15;border:1px solid ${color}33;
                      display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:${color}">
            ${org.nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
              <span style="font-size:14px;font-weight:600">${org.nombre}</span>
              <span style="font-size:10px;padding:1px 7px;border-radius:99px;background:${color}15;color:${color};border:1px solid ${color}33;text-transform:uppercase;letter-spacing:0.5px">${org.nivel_cuenta || 'standard'}</span>
              ${alertaSeguimiento ? '<span style="font-size:10px;color:#f59e0b">⏰ Seguimiento pendiente</span>' : ''}
            </div>
            <div style="font-size:12px;color:var(--text3)">
              ${org.sector ? org.sector + ' · ' : ''}
              ${org.email_contacto || '—'}
              ${diasSinContacto !== null ? ` · Último contacto: hace ${diasSinContacto}d` : ' · Sin interacciones'}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--text3);margin-bottom:2px">Score relación</div>
            <div style="font-size:18px;font-weight:700;color:${(org.score_relacion||50)>70?'#4ade80':(org.score_relacion||50)>40?'#f59e0b':'#ef4444'}">${org.score_relacion || 50}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text3)" stroke-width="1.5"><polyline points="6,4 10,8 6,12"/></svg>
        </div>
      </div>`
  })

  html += `</div></div>`
  document.getElementById('page-content').innerHTML = html
}

async function abrirFichaCliente(orgId) {
  const { data: org } = await sb.from('organizaciones').select('*').eq('id', orgId).single()
  const { data: contactos } = await sb.from('crm_contactos').select('*').eq('org_id', orgId).order('es_principal', { ascending: false })
  const { data: interacciones } = await sb.from('crm_interacciones').select('*').eq('org_id', orgId).order('fecha', { ascending: false })
  const { data: notas } = await sb.from('crm_notas').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
  const { data: contratos } = await sb.from('contratos').select('*, formulas(nombre)').eq('org_id', orgId)

  crmOrgActual = org

  const TIPO_ICON = { llamada:'📞', reunion:'🤝', email:'📧', whatsapp:'💬', visita:'🏢', otro:'📌' }
  const RESULTADO_COLOR = { positivo:'#4ade80', neutro:'#f59e0b', pendiente:'#6366f1', negativo:'#ef4444' }

  const hoy = new Date()

  let html = `
    <div class="page-head">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:48px;height:48px;border-radius:12px;background:var(--accent-dim);border:1px solid var(--accent);
                    display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:var(--accent)">
          ${org.nombre.charAt(0).toUpperCase()}
        </div>
        <div>
          <div class="page-title">${org.nombre}</div>
          <div class="page-sub">${org.sector || 'Sin sector'} · ${org.nivel_cuenta || 'standard'} · ${org.plan}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="renderCRM()">← Clientes</button>
        <button class="btn btn-ghost btn-sm" onclick="editarFichaCliente('${orgId}')">✏️ Editar ficha</button>
        <button class="btn btn-accent btn-sm" onclick="nuevaInteraccion('${orgId}')">+ Interacción</button>
      </div>
    </div>

    <!-- Score y datos rápidos -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">Score relación</div>
        <div style="font-size:40px;font-weight:900;color:${(org.score_relacion||50)>70?'#4ade80':(org.score_relacion||50)>40?'#f59e0b':'#ef4444'}">${org.score_relacion || 50}</div>
        <div style="font-size:10px;color:var(--text3)">/ 100</div>
      </div>
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">Contratos</div>
        <div style="font-size:36px;font-weight:800;color:var(--accent)">${contratos?.length || 0}</div>
      </div>
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">Interacciones</div>
        <div style="font-size:36px;font-weight:800;color:#6366f1">${interacciones?.length || 0}</div>
      </div>
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:4px">Próx. seguimiento</div>
        <div style="font-size:14px;font-weight:700;color:${org.proximo_seguimiento && org.proximo_seguimiento <= new Date(hoy.getTime()+7*24*60*60*1000).toISOString().slice(0,10)?'#f59e0b':'var(--text)'}">
          ${org.proximo_seguimiento ? new Date(org.proximo_seguimiento).toLocaleDateString('es-AR') : '—'}
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 340px;gap:16px">
      <!-- Columna principal -->
      <div>

        <!-- Historial de interacciones -->
        <div class="card" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div class="card-title" style="margin:0">📋 Historial de interacciones</div>
            <button class="btn btn-accent btn-sm" onclick="nuevaInteraccion('${orgId}')">+ Nueva</button>
          </div>
          ${interacciones?.length === 0 ? `
            <div style="text-align:center;padding:24px;color:var(--text3)">Sin interacciones registradas</div>` :
          interacciones?.map(i => {
            const icon = TIPO_ICON[i.tipo] || '📌'
            const resColor = RESULTADO_COLOR[i.resultado] || '#94a3b8'
            const fecha = new Date(i.fecha).toLocaleDateString('es-AR', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
            return `
            <div style="display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--border)">
              <div style="width:38px;height:38px;border-radius:50%;background:var(--surface2);border:1px solid var(--border);
                          display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${icon}</div>
              <div style="flex:1">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:13px;font-weight:600;text-transform:capitalize">${i.tipo}</span>
                    ${i.resultado ? `<span style="font-size:10px;padding:1px 7px;border-radius:99px;background:${resColor}15;color:${resColor};border:1px solid ${resColor}33">${i.resultado}</span>` : ''}
                    ${i.duracion_min ? `<span style="font-size:11px;color:var(--text3)">⏱ ${i.duracion_min} min</span>` : ''}
                  </div>
                  <span style="font-size:11px;color:var(--text3)">${fecha}</span>
                </div>
                <div style="font-size:13px;color:var(--text2);line-height:1.5;margin-bottom:6px">${i.resumen}</div>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-size:11px;color:var(--text3)">por ${i.usuario_nombre || '—'}</span>
                  ${i.proximo_seguimiento ? `<span style="font-size:11px;color:#f59e0b">📅 Seguimiento: ${new Date(i.proximo_seguimiento).toLocaleDateString('es-AR')}</span>` : ''}
                </div>
              </div>
              <button onclick="borrarInteraccion('${i.id}','${orgId}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:12px;opacity:0.5;transition:opacity .2s"
                onmouseover="this.style.opacity=1;this.style.color='#ef4444'" onmouseout="this.style.opacity=0.5;this.style.color='var(--text3)'">🗑</button>
            </div>`
          }).join('')}
        </div>

        <!-- Contratos vinculados -->
        <div class="card">
          <div class="card-title">📋 Contratos vinculados</div>
          ${contratos?.length === 0 ? `<div style="text-align:center;padding:16px;color:var(--text3)">Sin contratos</div>` :
          contratos?.map(c => {
            const hasta = c.vigencia_hasta ? new Date(c.vigencia_hasta) : null
            const dias = hasta ? Math.ceil((hasta - hoy) / (1000*60*60*24)) : null
            const color = !dias ? '#94a3b8' : dias < 0 ? '#ef4444' : dias < 30 ? '#f59e0b' : '#4ade80'
            return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
              <div>
                <div style="font-size:13px;font-weight:500">${c.nombre}</div>
                <div style="font-size:11px;color:var(--text3)">${c.formulas?.nombre || 'Sin fórmula'} · ${c.vigencia_hasta ? new Date(c.vigencia_hasta).toLocaleDateString('es-AR') : '—'}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:14px;font-weight:700;color:var(--accent)">$${Number(c.monto_base||0).toLocaleString('es-AR',{maximumFractionDigits:0})}</div>
                <div style="font-size:11px;color:${color}">${dias === null ? '—' : dias < 0 ? 'Vencido' : dias < 30 ? `${dias}d restantes` : 'Activo'}</div>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>

      <!-- Columna lateral -->
      <div>

        <!-- Contactos -->
        <div class="card" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div class="card-title" style="margin:0">👥 Contactos</div>
            <button class="btn btn-ghost btn-sm" onclick="nuevoContacto('${orgId}')">+ Agregar</button>
          </div>
          ${contactos?.length === 0 ? `<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px">Sin contactos cargados</div>` :
          contactos?.map(c => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div>
                  <div style="font-size:13px;font-weight:500">${c.nombre} ${c.es_principal ? '⭐' : ''}</div>
                  ${c.cargo ? `<div style="font-size:11px;color:var(--text3)">${c.cargo}</div>` : ''}
                </div>
                <button onclick="borrarContacto('${c.id}','${orgId}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px">🗑</button>
              </div>
              <div style="margin-top:6px;display:flex;flex-direction:column;gap:3px">
                ${c.telefono ? `<a href="tel:${c.telefono}" style="font-size:12px;color:var(--accent);text-decoration:none">📞 ${c.telefono}</a>` : ''}
                ${c.whatsapp ? `<a href="https://wa.me/${c.whatsapp.replace(/\D/g,'')}" target="_blank" style="font-size:12px;color:#4ade80;text-decoration:none">💬 WhatsApp</a>` : ''}
                ${c.email ? `<a href="mailto:${c.email}" style="font-size:12px;color:#6366f1;text-decoration:none">📧 ${c.email}</a>` : ''}
                ${c.linkedin ? `<a href="${c.linkedin}" target="_blank" style="font-size:12px;color:#3b82f6;text-decoration:none">💼 LinkedIn</a>` : ''}
              </div>
            </div>`).join('')}
        </div>

        <!-- Notas internas -->
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div class="card-title" style="margin:0">📝 Notas internas</div>
            <button class="btn btn-ghost btn-sm" onclick="nuevaNota('${orgId}')">+ Nota</button>
          </div>
          ${notas?.length === 0 ? `<div style="text-align:center;padding:16px;color:var(--text3);font-size:12px">Sin notas</div>` :
          notas?.map(n => {
            const fecha = new Date(n.created_at).toLocaleDateString('es-AR',{day:'2-digit',month:'short'})
            return `
            <div style="padding:10px;background:var(--surface2);border-radius:8px;margin-bottom:8px;border:1px solid var(--border)">
              <div style="font-size:12px;color:var(--text2);line-height:1.5;margin-bottom:6px">${n.contenido}</div>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:10px;color:var(--text3)">${n.usuario_nombre || '—'} · ${fecha}</span>
                <button onclick="borrarNota('${n.id}','${orgId}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px">🗑</button>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>
    </div>
  `

  document.getElementById('page-content').innerHTML = html
}

function editarFichaCliente(orgId) {
  const org = crmOrgActual
  const modal = document.createElement('div')
  modal.id = 'modal-overlay'
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center'
  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;padding:28px;width:500px;border:1px solid var(--border);max-height:85vh;overflow-y:auto">
      <h3 style="margin-bottom:20px;font-size:16px;font-weight:600">Editar ficha — ${org.nombre}</h3>
      <div class="grid-2">
        <div class="input-group"><label>Sector / Industria</label><input type="text" id="fe-sector" value="${org.sector||''}" placeholder="Oil & Gas, Construcción..."/></div>
        <div class="input-group"><label>Nivel de cuenta</label>
          <select id="fe-nivel">
            <option value="standard" ${org.nivel_cuenta==='standard'?'selected':''}>Standard</option>
            <option value="premium" ${org.nivel_cuenta==='premium'?'selected':''}>Premium</option>
            <option value="enterprise" ${org.nivel_cuenta==='enterprise'?'selected':''}>Enterprise</option>
          </select>
        </div>
      </div>
      <div class="grid-2">
        <div class="input-group"><label>Sitio web</label><input type="text" id="fe-web" value="${org.sitio_web||''}" placeholder="https://..."/></div>
        <div class="input-group"><label>Dirección</label><input type="text" id="fe-dir" value="${org.direccion||''}" placeholder="Ciudad, Provincia"/></div>
      </div>
      <div class="grid-2">
        <div class="input-group"><label>Próximo seguimiento</label><input type="date" id="fe-seg" value="${org.proximo_seguimiento||''}"/></div>
        <div class="input-group"><label>Score relación (0-100)</label><input type="number" id="fe-score" value="${org.score_relacion||50}" min="0" max="100"/></div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').remove()">Cancelar</button>
        <button class="btn btn-accent" onclick="guardarFichaCliente('${orgId}')">Guardar</button>
      </div>
    </div>`
  document.getElementById('modal-overlay')?.remove()
  document.body.appendChild(modal)
}

async function guardarFichaCliente(orgId) {
  const { error } = await sb.from('organizaciones').update({
    sector: document.getElementById('fe-sector').value.trim(),
    nivel_cuenta: document.getElementById('fe-nivel').value,
    sitio_web: document.getElementById('fe-web').value.trim(),
    direccion: document.getElementById('fe-dir').value.trim(),
    proximo_seguimiento: document.getElementById('fe-seg').value || null,
    score_relacion: parseInt(document.getElementById('fe-score').value) || 50
  }).eq('id', orgId)
  if (error) { toast('Error: ' + error.message, 'error'); return }
  document.getElementById('modal-overlay').remove()
  toast('Ficha actualizada ✓', 'success')
  await registrarAuditoria('editó ficha CRM', 'cliente', orgId, crmOrgActual?.nombre)
  abrirFichaCliente(orgId)
}

function nuevaInteraccion(orgId) {
  const modal = document.createElement('div')
  modal.id = 'modal-overlay'
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center'
  const ahora = new Date().toISOString().slice(0,16)
  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;padding:28px;width:520px;border:1px solid var(--border);max-height:85vh;overflow-y:auto">
      <h3 style="margin-bottom:20px;font-size:16px;font-weight:600">Nueva interacción</h3>
      <div class="grid-2">
        <div class="input-group"><label>Tipo *</label>
          <select id="ni-tipo">
            <option value="llamada">📞 Llamada</option>
            <option value="reunion">🤝 Reunión</option>
            <option value="email">📧 Email</option>
            <option value="whatsapp">💬 WhatsApp</option>
            <option value="visita">🏢 Visita</option>
            <option value="otro">📌 Otro</option>
          </select>
        </div>
        <div class="input-group"><label>Fecha y hora *</label><input type="datetime-local" id="ni-fecha" value="${ahora}"/></div>
      </div>
      <div class="grid-2">
        <div class="input-group"><label>Duración (minutos)</label><input type="number" id="ni-dur" placeholder="30" min="1"/></div>
        <div class="input-group"><label>Resultado</label>
          <select id="ni-resultado">
            <option value="">Sin resultado</option>
            <option value="positivo">✅ Positivo</option>
            <option value="neutro">➖ Neutro</option>
            <option value="pendiente">⏳ Pendiente</option>
            <option value="negativo">❌ Negativo</option>
          </select>
        </div>
      </div>
      <div class="input-group"><label>Resumen de la interacción *</label>
        <textarea id="ni-resumen" rows="3" placeholder="¿De qué se habló? ¿Qué se acordó?" style="width:100%;resize:vertical;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:8px 11px;color:var(--text);font-family:inherit;font-size:13px"></textarea>
      </div>
      <div class="input-group"><label>Próximo seguimiento</label><input type="date" id="ni-seg"/></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').remove()">Cancelar</button>
        <button class="btn btn-accent" onclick="guardarInteraccion('${orgId}')">Guardar interacción</button>
      </div>
    </div>`
  document.getElementById('modal-overlay')?.remove()
  document.body.appendChild(modal)
}

async function guardarInteraccion(orgId) {
  const resumen = document.getElementById('ni-resumen').value.trim()
  const fecha = document.getElementById('ni-fecha').value
  if (!resumen || !fecha) { toast('Completá el resumen y la fecha', 'warn'); return }

  const proxSeg = document.getElementById('ni-seg').value
  const { error } = await sb.from('crm_interacciones').insert({
    org_id: orgId,
    usuario_id: currentUser.id,
    usuario_nombre: currentUser.nombre || currentUser.email,
    tipo: document.getElementById('ni-tipo').value,
    fecha: new Date(fecha).toISOString(),
    duracion_min: parseInt(document.getElementById('ni-dur').value) || null,
    resumen,
    resultado: document.getElementById('ni-resultado').value || null,
    proximo_seguimiento: proxSeg || null,
    prioridad: 'media'
  })
  if (error) { toast('Error: ' + error.message, 'error'); return }

  // Actualizar ultima_interaccion y proximo_seguimiento en org
  await sb.from('organizaciones').update({
    ultima_interaccion: new Date().toISOString().slice(0,10),
    ...(proxSeg ? { proximo_seguimiento: proxSeg } : {})
  }).eq('id', orgId)

  await registrarAuditoria('registró interacción', 'cliente', orgId, crmOrgActual?.nombre, { tipo: document.getElementById('ni-tipo').value })
  document.getElementById('modal-overlay').remove()
  toast('Interacción guardada ✓', 'success')
  abrirFichaCliente(orgId)
}

async function borrarInteraccion(id, orgId) {
  if (!confirm('¿Borrar esta interacción?')) return
  await sb.from('crm_interacciones').delete().eq('id', id)
  toast('Interacción eliminada', 'success')
  abrirFichaCliente(orgId)
}

function nuevoContacto(orgId) {
  const modal = document.createElement('div')
  modal.id = 'modal-overlay'
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center'
  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;padding:28px;width:460px;border:1px solid var(--border)">
      <h3 style="margin-bottom:20px;font-size:16px;font-weight:600">Nuevo contacto</h3>
      <div class="grid-2">
        <div class="input-group"><label>Nombre completo *</label><input type="text" id="nc-nombre" placeholder="Juan García"/></div>
        <div class="input-group"><label>Cargo / Puesto</label><input type="text" id="nc-cargo" placeholder="Gerente de Contratos"/></div>
      </div>
      <div class="grid-2">
        <div class="input-group"><label>Teléfono</label><input type="text" id="nc-tel" placeholder="+54 9 299..."/></div>
        <div class="input-group"><label>WhatsApp</label><input type="text" id="nc-wa" placeholder="+54 9 299..."/></div>
      </div>
      <div class="grid-2">
        <div class="input-group"><label>Email</label><input type="email" id="nc-email" placeholder="juan@empresa.com"/></div>
        <div class="input-group"><label>LinkedIn</label><input type="text" id="nc-li" placeholder="https://linkedin.com/in/..."/></div>
      </div>
      <div class="input-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="nc-principal"/> Contacto principal de la cuenta
        </label>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').remove()">Cancelar</button>
        <button class="btn btn-accent" onclick="guardarContacto('${orgId}')">Guardar contacto</button>
      </div>
    </div>`
  document.getElementById('modal-overlay')?.remove()
  document.body.appendChild(modal)
}

async function guardarContacto(orgId) {
  const nombre = document.getElementById('nc-nombre').value.trim()
  if (!nombre) { toast('Ingresá el nombre', 'warn'); return }
  const { error } = await sb.from('crm_contactos').insert({
    org_id: orgId,
    nombre,
    cargo: document.getElementById('nc-cargo').value.trim(),
    telefono: document.getElementById('nc-tel').value.trim(),
    whatsapp: document.getElementById('nc-wa').value.trim(),
    email: document.getElementById('nc-email').value.trim(),
    linkedin: document.getElementById('nc-li').value.trim(),
    es_principal: document.getElementById('nc-principal').checked
  })
  if (error) { toast('Error: ' + error.message, 'error'); return }
  document.getElementById('modal-overlay').remove()
  toast('Contacto guardado ✓', 'success')
  abrirFichaCliente(orgId)
}

async function borrarContacto(id, orgId) {
  if (!confirm('¿Borrar este contacto?')) return
  await sb.from('crm_contactos').delete().eq('id', id)
  toast('Contacto eliminado', 'success')
  abrirFichaCliente(orgId)
}

function nuevaNota(orgId) {
  const modal = document.createElement('div')
  modal.id = 'modal-overlay'
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center'
  modal.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;padding:28px;width:440px;border:1px solid var(--border)">
      <h3 style="margin-bottom:16px;font-size:16px;font-weight:600">Nueva nota interna</h3>
      <textarea id="nn-contenido" rows="4" placeholder="Escribí tu nota aquí..."
        style="width:100%;resize:vertical;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:10px;color:var(--text);font-family:inherit;font-size:13px;margin-bottom:14px"></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-overlay').remove()">Cancelar</button>
        <button class="btn btn-accent" onclick="guardarNota('${orgId}')">Guardar nota</button>
      </div>
    </div>`
  document.getElementById('modal-overlay')?.remove()
  document.body.appendChild(modal)
}

async function guardarNota(orgId) {
  const contenido = document.getElementById('nn-contenido').value.trim()
  if (!contenido) { toast('Escribí algo en la nota', 'warn'); return }
  const { error } = await sb.from('crm_notas').insert({
    org_id: orgId,
    usuario_id: currentUser.id,
    usuario_nombre: currentUser.nombre || currentUser.email,
    contenido, privada: true
  })
  if (error) { toast('Error: ' + error.message, 'error'); return }
  document.getElementById('modal-overlay').remove()
  toast('Nota guardada ✓', 'success')
  abrirFichaCliente(orgId)
}

async function borrarNota(id, orgId) {
  if (!confirm('¿Borrar esta nota?')) return
  await sb.from('crm_notas').delete().eq('id', id)
  toast('Nota eliminada', 'success')
  abrirFichaCliente(orgId)
}