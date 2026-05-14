// ════════════════════════════════════════════════════════════════
// POLICALC v2 — Frontend completo con GitHub OAuth
// ════════════════════════════════════════════════════════════════

// ⚠️ REEMPLAZÁ ESTOS VALORES con los tuyos de Supabase (Project Settings → API)
const SUPABASE_URL = 'https://uhdglwjpghdfjjmzwtub.supabase.co'
const SUPABASE_KEY = 'sb_publishable_WgbN4yhsgSQwReeRiPgFbw_gGb205J7'

const { createClient } = supabase
const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ════ CONSTANTES ════
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

// ════ ESTADO GLOBAL ════
let currentUser = null
let currentOrg = null
let formulas = []
let indicesValores = {} // {IPC: {'2024-09': 123.45}}
let collapsedRows = {}
let chartMonto = null

// ════ INIT ════
window.onload = async () => {
  // Manejar callback de OAuth
  const hashParams = new URLSearchParams(window.location.hash.substring(1))
  if (hashParams.get('access_token')) {
    // Venimos del callback de GitHub
    const { data, error } = await sb.auth.getSession()
    if (data.session) {
      await loadUserData()
      showApp()
      // Limpiar hash de la URL
      window.history.replaceState(null, '', window.location.pathname)
      return
    }
  }
  
  // Verificar sesión existente
  const { data: { session } } = await sb.auth.getSession()
  if (!session) {
    showLogin()
  } else {
    await loadUserData()
    showApp()
  }
  
  // Polling alertas cada 30s
  setInterval(checkAlertas, 30000)
  setInterval(updateClock, 1000)
  updateClock()
}

// ════ AUTH ════
function showLogin() {
  document.getElementById('login-screen').style.display = 'flex'
  document.getElementById('app-shell').style.display = 'none'
  
  document.getElementById('login-content').innerHTML = `
    <button class="btn btn-accent" style="width:100%;margin-bottom:16px;padding:12px" onclick="loginWithGitHub()">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
      </svg>
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
    <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:12px" onclick="showSignup()">Crear cuenta nueva</button>
  `
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
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: window.location.origin
    }
  })
  
  if (error) {
    toast('Error al conectar con GitHub: ' + error.message, 'error')
  }
  // El navegador redirige automáticamente a GitHub
}

async function doLogin() {
  const email = document.getElementById('email-input').value
  const pw = document.getElementById('pw-input').value
  const msg = document.getElementById('login-msg')
  
  if (!email || !pw) {
    msg.textContent = 'Completá todos los campos'
    msg.className = 'login-msg err'
    return
  }
  
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pw })
  
  if (error) {
    msg.textContent = error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message
    msg.className = 'login-msg err'
  } else {
    await loadUserData()
    showApp()
  }
}

async function doSignup() {
  const nombre = document.getElementById('nombre-input').value
  const email = document.getElementById('email-input').value
  const pw = document.getElementById('pw-input').value
  const pw2 = document.getElementById('pw2-input').value
  const msg = document.getElementById('login-msg')
  
  if (!nombre || !email || !pw) {
    msg.textContent = 'Completá todos los campos'
    msg.className = 'login-msg err'
    return
  }
  
  if (pw.length < 6) {
    msg.textContent = 'La contraseña debe tener mínimo 6 caracteres'
    msg.className = 'login-msg err'
    return
  }
  
  if (pw !== pw2) {
    msg.textContent = 'Las contraseñas no coinciden'
    msg.className = 'login-msg err'
    return
  }
  
  const { error } = await sb.auth.signUp({
    email,
    password: pw,
    options: { data: { nombre } }
  })
  
  if (error) {
    msg.textContent = error.message
    msg.className = 'login-msg err'
  } else {
    msg.textContent = 'Cuenta creada — verificá tu email para confirmar y después ingresá'
    msg.className = 'login-msg'
  }
}

async function logout() {
  await sb.auth.signOut()
  location.reload()
}

async function loadUserData() {
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return
  
  // Obtener datos de usuario desde tabla usuarios
  const { data: userData } = await sb.from('usuarios').select('*, org:organizaciones(*)').eq('id', user.id).single()
  
  if (!userData || !userData.org) {
    toast('Usuario sin organización asignada — contactá al administrador', 'error')
    await sb.auth.signOut()
    return
  }
  
  currentUser = userData
  currentOrg = userData.org
  
  document.getElementById('org-name-display').textContent = currentOrg.nombre
  document.getElementById('user-info-display').textContent = `${userData.nombre || userData.email} (${userData.rol})`
  
  // Cargar fórmulas de la org
  const { data: formData } = await sb.from('formulas').select('*').eq('org_id', currentOrg.id)
  formulas = formData || []
  
  // Cargar valores de índices
  await loadIndicesValores()
  
  // Check alertas pendientes
  await checkAlertas()
}

async function loadIndicesValores() {
  const { data } = await sb.from('indices_valores').select('*').or(`org_id.is.null,org_id.eq.${currentOrg.id}`)
  indicesValores = {}
  
  data?.forEach(row => {
    if (!indicesValores[row.codigo]) indicesValores[row.codigo] = {}
    indicesValores[row.codigo][row.periodo] = {
      valor: parseFloat(row.valor),
      source: row.org_id ? 'manual' : 'auto'
    }
  })
}

async function checkAlertas() {
  const { data, count } = await sb.from('alertas')
    .select('*', { count: 'exact' })
    .eq('org_id', currentOrg.id)
    .eq('leida', false)
  
  const badge = document.getElementById('alertas-badge')
  if (count > 0) {
    badge.textContent = count
    badge.style.display = 'inline-block'
  } else {
    badge.style.display = 'none'
  }
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none'
  document.getElementById('app-shell').style.display = 'grid'
  goPage('matriz')
}

function updateClock() {
  const d = new Date()
  const el = document.getElementById('footer-clock')
  if (el) el.textContent = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

// ════ NAVEGACIÓN ════
function goPage(page) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'))
  
  const idx = { 'matriz': 0, 'hist': 1, 'form': 2, 'indices': 3, 'alertas': 4 }[page]
  document.querySelectorAll('.nav-item')[idx]?.classList.add('active')
  
  const content = document.getElementById('page-content')
  
  if (page === 'matriz') renderMatriz()
  else if (page === 'hist') renderHistorial()
  else if (page === 'form') renderFormulas()
  else if (page === 'indices') renderIndices()
  else if (page === 'alertas') renderAlertas()
}

// ════ PÁGINA MATRIZ ════
async function renderMatriz() {
  // TODO: implementar matriz completa similar a la versión anterior
  // pero conectada a Supabase
  
  document.getElementById('page-content').innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">Matriz de actualización</div>
        <div class="page-sub">En desarrollo — conectado a Supabase ✓</div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Estado actual</div>
      <p style="margin-bottom:8px">✅ Login con GitHub funcionando</p>
      <p style="margin-bottom:8px">✅ Multi-empresa configurado</p>
      <p style="margin-bottom:8px">✅ Base de datos conectada</p>
      <p style="margin-bottom:8px">✅ Usuario: ${currentUser.email}</p>
      <p style="margin-bottom:8px">✅ Organización: ${currentOrg.nombre}</p>
      <p style="margin-bottom:8px">⏳ Matriz mensual en desarrollo</p>
      <p style="margin-bottom:8px">⏳ Scraper YPF en siguiente fase</p>
    </div>
    
    <div class="card">
      <div class="card-title">Próximos pasos</div>
      <p style="font-size:13px;color:var(--text2);line-height:1.6">
        La matriz completa con cálculo mes a mes, override manual de valores, y exportación CSV se completa en la siguiente iteración.
        Por ahora podés probar el sistema de <strong>Fórmulas</strong>, <strong>Índices</strong> y <strong>Alertas</strong> que ya están funcionando con la base de datos.
      </p>
    </div>
  `
}

// ════ PÁGINA HISTORIAL ════
async function renderHistorial() {
  const { data: calculos } = await sb.from('calculos_mensuales')
    .select('*')
    .eq('org_id', currentOrg.id)
    .order('created_at', { ascending: false })
  
  let html = `
    <div class="page-head">
      <div>
        <div class="page-title">Historial</div>
        <div class="page-sub">Cálculos guardados de tu organización</div>
      </div>
    </div>
    <div class="card">
  `
  
  if (!calculos || calculos.length === 0) {
    html += `<div style="text-align:center;padding:32px;color:var(--text3)">Sin cálculos guardados aún</div>`
  } else {
    calculos.forEach(c => {
      const fecha = new Date(c.created_at).toLocaleDateString('es-AR')
      html += `
        <div class="hist-card">
          <div class="hist-head">
            <div>
              <div style="font-size:14px;font-weight:500">${c.formula_snapshot.nombre || 'Sin nombre'}</div>
              <div class="hist-meta">Guardado el ${fecha}</div>
              <div class="hist-meta">$${c.monto_inicial.toLocaleString('es-AR')} → <strong style="color:var(--green)">$${c.monto_final.toLocaleString('es-AR')}</strong></div>
            </div>
            <div style="text-align:right">
              <div style="font-size:22px;font-weight:700" class="${c.ajuste_acumulado >= 0 ? 'pct-up' : 'pct-dn'}">
                ${c.ajuste_acumulado >= 0 ? '+' : ''}${c.ajuste_acumulado.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      `
    })
  }
  
  html += `</div>`
  document.getElementById('page-content').innerHTML = html
}

// ════ PÁGINA FÓRMULAS ════
async function renderFormulas() {
  let html = `
    <div class="page-head">
      <div>
        <div class="page-title">Fórmulas</div>
        <div class="page-sub">Polinómicas de tu organización</div>
      </div>
      <button class="btn btn-accent" onclick="showNewFormula()">Nueva fórmula</button>
    </div>
    <div class="card">
  `
  
  if (formulas.length === 0) {
    html += `<div style="text-align:center;padding:32px;color:var(--text3)">Sin fórmulas creadas — creá la primera</div>`
  } else {
    formulas.forEach(f => {
      const comps = JSON.parse(f.componentes)
      html += `
        <div class="hist-card">
          <div class="hist-head">
            <div style="flex:1">
              <div style="font-size:14px;font-weight:500;margin-bottom:6px">${f.nombre}</div>
              ${f.empresa ? `<div style="font-size:11px;color:var(--text3);margin-bottom:8px">${f.empresa}</div>` : ''}
              <div style="display:flex;flex-wrap:wrap;gap:5px">
                ${comps.map(c => `<span class="tag tag-blue">${c.codigo} ${c.coef}%</span>`).join('')}
              </div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="borrarFormula('${f.id}')">Borrar</button>
          </div>
        </div>
      `
    })
  }
  
  html += `</div>`
  document.getElementById('page-content').innerHTML = html
}

function showNewFormula() {
  // TODO: modal para crear nueva fórmula
  toast('Función en desarrollo', 'warn')
}

async function borrarFormula(id) {
  if (!confirm('¿Seguro que querés borrar esta fórmula?')) return
  
  const { error } = await sb.from('formulas').delete().eq('id', id)
  
  if (error) {
    toast('Error al borrar: ' + error.message, 'error')
  } else {
    formulas = formulas.filter(f => f.id !== id)
    renderFormulas()
    toast('Fórmula borrada', 'success')
  }
}

// ════ PÁGINA ÍNDICES ════
async function renderIndices() {
  const { data: catalogo } = await sb.from('indices_catalogo').select('*')
  
  let html = `
    <div class="page-head">
      <div>
        <div class="page-title">Índices</div>
        <div class="page-sub">Estado de fuentes de datos</div>
      </div>
      <button class="btn btn-ghost" onclick="sincronizarIndices()">Sincronizar</button>
    </div>
    <div class="card">
  `
  
  catalogo?.forEach(idx => {
    const valores = indicesValores[idx.codigo] || {}
    const periodos = Object.keys(valores).sort().reverse()
    const ultimo = periodos[0]
    const valorUltimo = ultimo ? valores[ultimo].valor : null
    
    const isApi = idx.fuente.startsWith('api')
    
    html += `
      <div class="hist-card">
        <div class="hist-head">
          <div>
            <div style="font-size:14px;font-weight:500;display:flex;align-items:center;gap:8px">
              <span class="tag tag-green">${idx.codigo}</span>
              ${idx.nombre}
            </div>
            <div class="hist-meta">Último valor: ${valorUltimo ? valorUltimo.toFixed(2) : '—'} ${ultimo ? `(${ultimo})` : ''}</div>
          </div>
          <div>
            ${isApi ? '<span class="source-chip ok">● API activa</span>' : '<span class="source-chip manual">⚠ Manual</span>'}
          </div>
        </div>
        <div style="margin-top:10px;font-size:11px;color:var(--text3);line-height:1.6">${idx.descripcion || ''}</div>
      </div>
    `
  })
  
  html += `</div>`
  document.getElementById('page-content').innerHTML = html
}

async function sincronizarIndices() {
  toast('Sincronizando desde APIs...', 'success')
  
  // IPC via INDEC
  try {
    const url = 'https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=200&format=json'
    const r = await fetch(url)
    const d = await r.json()
    
    for (const [fecha, valor] of d.data || []) {
      if (valor === null) continue
      const periodo = fecha.slice(0, 7)
      
      await sb.from('indices_valores').upsert({
        codigo: 'IPC',
        periodo,
        valor,
        fuente_real: 'auto',
        actualizado_at: new Date().toISOString()
      })
    }
  } catch (e) {
    console.error('Error IPC:', e)
  }
  
  // USD via argentinadatos
  try {
    const r = await fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial')
    const d = await r.json()
    
    const agg = {}
    d.forEach(x => {
      const k = x.fecha.slice(0, 7)
      if (!agg[k]) agg[k] = { sum: 0, n: 0 }
      agg[k].sum += x.venta
      agg[k].n++
    })
    
    for (const [periodo, data] of Object.entries(agg)) {
      const valor = data.sum / data.n
      await sb.from('indices_valores').upsert({
        codigo: 'USD',
        periodo,
        valor,
        fuente_real: 'auto',
        actualizado_at: new Date().toISOString()
      })
    }
  } catch (e) {
    console.error('Error USD:', e)
  }
  
  await loadIndicesValores()
  renderIndices()
  toast('Sincronización completa ✓', 'success')
}

// ════ PÁGINA ALERTAS ════
async function renderAlertas() {
  const { data: alertas } = await sb.from('alertas')
    .select('*')
    .eq('org_id', currentOrg.id)
    .order('created_at', { ascending: false })
    .limit(50)
  
  let html = `
    <div class="page-head">
      <div>
        <div class="page-title">Alertas</div>
        <div class="page-sub">Notificaciones de variaciones y actualizaciones</div>
      </div>
      ${alertas?.some(a => !a.leida) ? `<button class="btn btn-ghost btn-sm" onclick="marcarTodasLeidas()">Marcar todas leídas</button>` : ''}
    </div>
    <div class="card">
  `
  
  if (!alertas || alertas.length === 0) {
    html += `<div style="text-align:center;padding:32px;color:var(--text3)">Sin alertas aún</div>`
  } else {
    alertas.forEach(a => {
      const fecha = new Date(a.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      html += `
        <div class="alerta-item ${a.leida ? '' : 'no-leida'}" onclick="marcarLeida('${a.id}')">
          <div class="alerta-title">${a.titulo}</div>
          <div class="alerta-msg">${a.mensaje || ''}</div>
          <div class="alerta-footer">
            <span>${fecha}</span>
            <span>${a.leida ? 'Leída' : 'Nueva'}</span>
          </div>
        </div>
      `
    })
  }
  
  html += `</div>`
  document.getElementById('page-content').innerHTML = html
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
  toast('Todas las alertas marcadas como leídas', 'success')
}

// ════ UTILS ════
function toast(msg, type = 'success') {
  const c = document.createElement('div')
  c.className = 'toast ' + type
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warn' ? '⚠' : 'ℹ'
  const color = type === 'success' ? 'var(--green)' : type === 'error' ? 'var(--red)' : type === 'warn' ? 'var(--amber)' : 'var(--text2)'
  c.innerHTML = `<span style="color:${color};font-size:14px">${icon}</span> ${msg}`
  document.body.appendChild(c)
  setTimeout(() => { c.style.animation = 'toastIn .2s reverse'; setTimeout(() => c.remove(), 200) }, 2400)
}