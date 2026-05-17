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
  const idx = { 'matriz': 0, 'contratos': 1, 'hist': 2, 'form': 3, 'indices': 4, 'alertas': 5, 'admin': 6 }[page]
  document.querySelectorAll('.nav-item')[idx]?.classList.add('active')
  if (page === 'matriz') renderMatriz()
  else if (page === 'contratos') renderContratos()
  else if (page === 'hist') renderHistorial()
  else if (page === 'form') renderFormulas()
  else if (page === 'indices') renderIndices()
  else if (page === 'alertas') renderAlertas()
  else if (page === 'admin') renderAdmin()
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
      <div><div class="page-title">Matriz de actualización</div><div class="page-sub">Cálculo mensual con fórmula polinómica</div></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" onclick="generarInforme()" style="margin-right:4px">📄 PDF</button><button class="btn btn-ghost" onclick="exportarExcel()">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2,10 L2,13 C2,13.5 2.5,14 3,14 L13,14 C13.5,14 14,13.5 14,13 L14,10"/><polyline points="5,6 8,2 11,6"/><line x1="8" y1="2" x2="8" y2="11"/></svg>
          Exportar
        </button>
        <button class="btn btn-accent" onclick="guardarCalculo()">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13,2 13,14 8,11 3,14 3,2"/></svg>
          Guardar
        </button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Contrato</div>
      <div class="grid-4">
        <div class="input-group" style="margin:0">
          <label>Seleccionar contrato</label>
          <select id="contrato-select" onchange="cargarContrato(this.value)">
            <option value="">-- Nuevo contrato --</option>
            ${contratos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
          </select>
        </div>
        <div class="input-group" style="margin:0">
          <label>Nombre</label>
          <input type="text" id="contrato-nombre" placeholder="Ej: Chevron 2024-2026" value="${contratoActual?.nombre || ''}"/>
        </div>
        <div class="input-group" style="margin:0">
          <label>Fórmula</label>
          <select id="contrato-formula">
            ${formulas.map(f => `<option value="${f.id}" ${contratoActual?.formula_id === f.id ? 'selected' : ''}>${f.nombre}</option>`).join('')}
          </select>
        </div>
        <div class="input-group" style="margin:0">
          <label>Monto base ($)</label>
          <input type="number" id="contrato-monto" value="${contratoActual?.monto_base || 1000000}" step="0.01"/>
        </div>
      </div>
      <div class="grid-2" style="margin-top:12px">
        <div class="input-group" style="margin:0">
          <label>Período desde</label>
          <div style="display:flex;gap:6px">
            <select id="mes-desde"></select>
            <input type="number" id="anio-desde" value="2024" min="2020" max="2030" style="width:80px"/>
          </div>
        </div>
        <div class="input-group" style="margin:0">
          <label>Período hasta</label>
          <div style="display:flex;gap:6px">
            <select id="mes-hasta"></select>
            <input type="number" id="anio-hasta" value="2026" min="2020" max="2030" style="width:80px"/>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn btn-accent btn-sm" onclick="calcularMatriz()">Calcular matriz</button><button class="btn btn-ghost btn-sm" onclick="guardarContrato()">💾 Guardar contrato</button></div>
    </div>
    <div id="matriz-resultado"></div>
  `
  document.getElementById('page-content').innerHTML = html
  ;['mes-desde', 'mes-hasta'].forEach(id => {
    const s = document.getElementById(id)
    s.innerHTML = MESES_LARGO.map((m, i) => `<option value="${i}">${m}</option>`).join('')
  })
  document.getElementById('mes-desde').value = 8
  document.getElementById('mes-hasta').value = 2
  if (contratoActual) calcularMatriz()
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
    let total = 0, valid = true
    componentes.forEach(comp => {
      const v0 = i === 0 ? getValue(comp.codigo, pkPrev) : valoresPorIndice[comp.codigo][i - 1]
      const v1 = valoresPorIndice[comp.codigo][i]
      if (!v0 || !v1 || v0 === 0) return
      total += ((v1 - v0) / v0) * 100 * (comp.coef / 100)
    })
    return { val: total, valid }
  })
  let monto = montoBase
  const montos = [monto]
  totalesMensuales.forEach(t => { if (t.valid) monto = monto * (1 + t.val / 100); montos.push(monto) })
  let html = `
    <div class="card" style="margin-top:16px">
      <div class="card-title">Matriz mensual — ${formula.nombre}</div>
      <div class="matrix-wrap">
        <table class="matrix">
          <thead><tr>
            <th class="idx-col">Componente</th>
            ${periodos.map(p => `<th>${p.label}</th>`).join('')}
            <th class="col-total">Total</th>
          </tr></thead>
          <tbody>
  `
  componentes.forEach(comp => {
    const meta = INDICES_META[comp.codigo] || { label: comp.codigo, color: 'tag-blue' }
    html += `<tr class="row-idx"><td class="idx-col"><span class="tag ${meta.color}">${comp.codigo}</span><span style="color:var(--text3);font-size:10px;margin-left:6px">${comp.coef}%</span></td>`
    let sumVar = 0
    periodos.forEach((p, i) => {
      const v0 = i === 0 ? getValue(comp.codigo, pkPrev) : valoresPorIndice[comp.codigo][i - 1]
      const v1 = valoresPorIndice[comp.codigo][i]
      let varPct = null
      if (v0 && v1 && v0 !== 0) { varPct = ((v1 - v0) / v0) * 100; sumVar += varPct }
      html += `<td>${varPct != null ? `<span class="${varPct >= 0 ? 'pct-pos' : 'pct-neg'}">${varPct >= 0 ? '+' : ''}${varPct.toFixed(2)}%</span>` : '—'}</td>`
    })
    html += `<td class="col-total">${sumVar.toFixed(2)}%</td></tr>`
    html += `<tr class="row-afec"><td class="idx-col" style="padding-left:24px;font-size:11px">↳ Afección</td>`
    let sumAfec = 0
    periodos.forEach((p, i) => {
      const v0 = i === 0 ? getValue(comp.codigo, pkPrev) : valoresPorIndice[comp.codigo][i - 1]
      const v1 = valoresPorIndice[comp.codigo][i]
      let afec = null
      if (v0 && v1 && v0 !== 0) afec = ((v1 - v0) / v0) * 100 * (comp.coef / 100)
      if (afec != null) sumAfec += afec
      html += `<td>${afec != null ? (afec >= 0 ? '+' : '') + afec.toFixed(2) + '%' : '—'}</td>`
    })
    html += `<td class="col-total">${sumAfec.toFixed(2)}%</td></tr>`
  })
  html += `<tr class="row-total"><td class="idx-col">Total ajuste mensual</td>`
  let acumPct = 0
  totalesMensuales.forEach(t => {
    html += `<td>${t.valid ? (t.val >= 0 ? '+' : '') + t.val.toFixed(3) + '%' : '—'}</td>`
    if (t.valid) acumPct = ((1 + acumPct / 100) * (1 + t.val / 100) - 1) * 100
  })
  html += `<td class="col-total">${acumPct.toFixed(2)}%</td></tr>`
  html += `<tr class="row-monto"><td class="idx-col">Monto contrato ($)</td>`
  totalesMensuales.forEach((t, i) => { html += `<td>${montos[i + 1].toLocaleString('es-AR', { maximumFractionDigits: 2 })}</td>` })
  html += `<td class="col-total">${montos[montos.length - 1].toLocaleString('es-AR', { maximumFractionDigits: 2 })}</td></tr>`
  html += `</tbody></table></div></div>`
  document.getElementById('matriz-resultado').innerHTML = html
  window._matrizActual = { formula, periodos, montoBase, totalesMensuales, montos, componentes, valoresPorIndice }
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

  let html = `
    <div class="page-head">
      <div>
        <div class="page-title">Contratos</div>
        <div class="page-sub">Gestión de contratos con ítems y actualización polinómica</div>
      </div>
      <button class="btn btn-accent" onclick="abrirNuevoContrato()">+ Nuevo contrato</button>
    </div>
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
    html += `<div style="display:grid;gap:12px">`
    listaContratos.forEach(c => {
      const desde = c.vigencia_desde ? new Date(c.vigencia_desde).toLocaleDateString('es-AR') : '—'
      const hasta = c.vigencia_hasta ? new Date(c.vigencia_hasta).toLocaleDateString('es-AR') : '—'
      html += `
        <div class="card" style="padding:20px;cursor:pointer" onclick="abrirContrato('${c.id}')">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
            <div>
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
                ${c.nro_contrato ? `<span style="font-size:11px;background:var(--card-bg);border:1px solid var(--border);padding:2px 8px;border-radius:99px;color:var(--text3)">${c.nro_contrato}</span>` : ''}
                <span style="font-size:16px;font-weight:600">${c.nombre}</span>
              </div>
              <div style="font-size:13px;color:var(--text3);margin-bottom:4px">${c.proveedor || ''} ${c.actividad ? '· '+c.actividad : ''}</div>
              <div style="font-size:12px;color:var(--text3)">Vigencia: ${desde} → ${hasta}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:12px;color:var(--text3);margin-bottom:4px">${c.formulas?.nombre || 'Sin fórmula'}</div>
              <div style="font-size:20px;font-weight:700;color:var(--accent)">$${Number(c.monto_base||0).toLocaleString('es-AR',{maximumFractionDigits:0})}</div>
              ${c.gatillo_activo ? `<div style="font-size:11px;color:var(--amber)">⚡ Gatillo ${c.gatillo_pct}%</div>` : ''}
            </div>
          </div>
        </div>`
    })
    html += `</div>`
  }

  document.getElementById('page-content').innerHTML = html
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
        <td style="padding:10px 14px">
          <select onchange="cambiarRolUsuario('${u.id}',this.value)" style="font-size:11px;padding:3px 6px;border-radius:6px;border:1px solid var(--border);background:var(--card-bg);color:var(--text)">
            <option value="usuario" ${u.rol==='usuario'?'selected':''}>usuario</option>
            <option value="admin" ${u.rol==='admin'?'selected':''}>admin</option>
            <option value="superadmin" ${u.rol==='superadmin'?'selected':''}>superadmin</option>
          </select>
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