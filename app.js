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
  'IPC':  {label:'IPC General (INDEC)', color:'tag-green'},
  'IPIM': {label:'IPIM General (INDEC)', color:'tag-amber'},
  'CCT':  {label:'CCT 644/12 Petroleros', color:'tag-blue'},
  'USD':  {label:'Dólar Oficial BNA', color:'tag-red'},
  'GR3':  {label:'GR3 Gasoil YPF', color:'tag-purple'},
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
  goPage('matriz')
}

function updateClock() {
  const el = document.getElementById('footer-clock')
  if (el) el.textContent = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function goPage(page) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'))
  const idx = { 'matriz': 0, 'hist': 1, 'form': 2, 'indices': 3, 'alertas': 4 }[page]
  document.querySelectorAll('.nav-item')[idx]?.classList.add('active')
  if (page === 'matriz') renderMatriz()
  else if (page === 'hist') renderHistorial()
  else if (page === 'form') renderFormulas()
  else if (page === 'indices') renderIndices()
  else if (page === 'alertas') renderAlertas()
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
  let html = `<div class="page-head"><div><div class="page-title">Historial</div><div class="page-sub">Cálculos guardados</div></div></div><div class="card">`
  if (!data || data.length === 0) { html += `<div style="text-align:center;padding:32px;color:var(--text3)">Sin cálculos guardados</div>` }
  else { data.forEach(c => {
    const fecha = new Date(c.created_at).toLocaleDateString('es-AR')
    html += `<div class="hist-card"><div class="hist-head"><div><div style="font-size:14px;font-weight:500">${c.formula_snapshot.nombre}</div><div class="hist-meta">${fecha}</div><div class="hist-meta">$${c.monto_inicial.toLocaleString('es-AR')} → <strong style="color:var(--green)">$${c.monto_final.toLocaleString('es-AR')}</strong></div></div><div style="text-align:right"><div style="font-size:22px;font-weight:700" class="${c.ajuste_acumulado >= 0 ? 'pct-up' : 'pct-dn'}">${c.ajuste_acumulado >= 0 ? '+' : ''}${c.ajuste_acumulado.toFixed(2)}%</div></div></div></div>`
  }) }
  html += `</div>`; document.getElementById('page-content').innerHTML = html
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
      <option value="IPC">IPC — General INDEC</option>
      <option value="IPIM">IPIM — INDEC</option>
      <option value="USD">USD — Dólar BNA</option>
      <option value="GR3">GR3 — Gasoil YPF</option>
      <option value="CCT">CCT — Salario Petrolero</option>
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
  const { data: catalogo } = await sb.from('indices_catalogo').select('*')
  const hoy = new Date()
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`

  let html = `
    <div class="page-head">
      <div><div class="page-title">Índices</div><div class="page-sub">Estado de fuentes y carga manual</div></div>
      <button class="btn btn-ghost" onclick="sincronizarIndices()">↻ Sincronizar API</button>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-title">Cargar valor manual</div>
      <div class="grid-4" style="align-items:flex-end">
        <div class="input-group" style="margin:0">
          <label>Índice</label>
          <select id="m-codigo">
            <option value="GR3">GR3 — Gasoil YPF</option>
            <option value="CCT">CCT — Salario Petrolero</option>
            <option value="IPIM">IPIM — INDEC</option>
            <option value="IPC">IPC — INDEC</option>
            <option value="USD">USD — Dólar BNA</option>
          </select>
        </div>
        <div class="input-group" style="margin:0">
          <label>Período (año-mes)</label>
          <input type="month" id="m-periodo" value="${mesActual}"/>
        </div>
        <div class="input-group" style="margin:0">
          <label>Valor del índice</label>
          <input type="number" id="m-valor" placeholder="Ej: 1450.50" step="0.01"/>
        </div>
        <button class="btn btn-accent" onclick="guardarIndiceManual()">Guardar</button>
      </div>
      <p style="font-size:11px;color:var(--text3);margin-top:10px">
        El valor que cargues reemplaza cualquier dato anterior para ese índice y período. Queda guardado como fuente oficial.
      </p>
    </div>

    <div class="card">
      <div class="card-title">Estado de índices</div>
  `

  const codigos = catalogo?.map(c => c.codigo) || ['IPC','USD','GR3','CCT','IPIM']
  const todosLosCodigos = [...new Set([...codigos, ...Object.keys(indicesValores)])]

  todosLosCodigos.forEach(codigo => {
    const meta = catalogo?.find(c => c.codigo === codigo)
    const valores = indicesValores[codigo] || {}
    const periodos = Object.keys(valores).sort().reverse()
    const ultimo = periodos[0]
    const valorUltimo = ultimo ? valores[ultimo].valor : null
    const ultimosMeses = periodos.slice(0, 6)

    html += `
      <div class="hist-card">
        <div class="hist-head">
          <div>
            <div style="font-size:14px;font-weight:500;display:flex;align-items:center;gap:8px">
              <span class="tag tag-green">${codigo}</span>
              ${meta?.nombre || codigo}
            </div>
            <div class="hist-meta">Último: <strong>${valorUltimo ? valorUltimo.toLocaleString('es-AR', {maximumFractionDigits:2}) : '—'}</strong> ${ultimo ? `(${ultimo})` : ''}</div>
          </div>
          <div style="text-align:right">
            <span class="source-chip ${valorUltimo ? 'ok' : 'manual'}">${valorUltimo ? '● Con datos' : '⚠ Sin datos'}</span>
          </div>
        </div>
        ${ultimosMeses.length > 0 ? `
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          ${ultimosMeses.map(p => `
            <div style="font-size:11px;background:var(--card-bg);border:1px solid var(--border);border-radius:6px;padding:4px 8px;text-align:center">
              <div style="color:var(--text3)">${p}</div>
              <div style="font-weight:500">${valores[p].valor.toLocaleString('es-AR', {maximumFractionDigits:1})}</div>
            </div>
          `).join('')}
        </div>` : ''}
      </div>`
  })

  html += `</div>`
  document.getElementById('page-content').innerHTML = html
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
  const { data } = await sb.from('alertas').select('*').eq('org_id', currentOrg.id).order('created_at', { ascending: false }).limit(50)
  let html = `<div class="page-head"><div><div class="page-title">Alertas</div><div class="page-sub">Notificaciones</div></div></div><div class="card">`
  if (!data || data.length === 0) { html += `<div style="text-align:center;padding:32px;color:var(--text3)">Sin alertas</div>` }
  else { data.forEach(a => {
    const fecha = new Date(a.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    html += `<div class="alerta-item ${a.leida ? '' : 'no-leida'}" onclick="marcarLeida('${a.id}')"><div class="alerta-title">${a.titulo}</div><div class="alerta-msg">${a.mensaje || ''}</div><div class="alerta-footer"><span>${fecha}</span><span>${a.leida ? 'Leída' : 'Nueva'}</span></div></div>`
  }) }
  html += `</div>`; document.getElementById('page-content').innerHTML = html
}

async function marcarLeida(id) {
  await sb.from('alertas').update({ leida: true }).eq('id', id)
  await checkAlertas(); renderAlertas()
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