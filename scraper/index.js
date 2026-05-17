// ════════════════════════════════════════════════════════════════
// POLICALC SCRAPER v2 — IPC, IPIM, USD, GR3, IPCNQN, FADEEAC, CAC
// ════════════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js')
const fetch = require('node-fetch')
const cron = require('node-cron')
const { chromium } = require('playwright-chromium')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const UMBRAL_ALERTA = 5.0

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan variables de entorno SUPABASE_URL y SUPABASE_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ════ IPC NACIONAL (INDEC API) ════
async function scrapearIPC() {
  console.log('📊 Scrapeando IPC Nacional...')
  try {
    const url = 'https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=24&format=json'
    const r = await fetch(url)
    const d = await r.json()
    const valores = []
    for (const [fecha, valor] of d.data || []) {
      if (valor === null) continue
      valores.push({ codigo: 'IPC', periodo: fecha.slice(0, 7), valor })
    }
    console.log(`✅ IPC: ${valores.length} meses`)
    return valores
  } catch (e) { console.error('❌ Error IPC:', e.message); return [] }
}

// ════ IPIM (INDEC API) ════
async function scrapearIPIM() {
  console.log('📊 Scrapeando IPIM...')
  try {
    const url = 'https://apis.datos.gob.ar/series/api/series/?ids=11.3_VIPIM_2015_M_22&limit=24&format=json'
    const r = await fetch(url)
    const d = await r.json()
    const valores = []
    for (const [fecha, valor] of d.data || []) {
      if (valor === null) continue
      valores.push({ codigo: 'IPIM', periodo: fecha.slice(0, 7), valor })
    }
    console.log(`✅ IPIM: ${valores.length} meses`)
    return valores
  } catch (e) { console.error('❌ Error IPIM:', e.message); return [] }
}

// ════ USD OFICIAL BNA ════
async function scrapearUSD() {
  console.log('💵 Scrapeando Dólar BNA...')
  try {
    const r = await fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial')
    const d = await r.json()
    const agg = {}
    d.forEach(x => {
      const k = x.fecha.slice(0, 7)
      if (!agg[k]) agg[k] = { sum: 0, n: 0 }
      agg[k].sum += x.venta; agg[k].n++
    })
    const valores = Object.entries(agg).map(([periodo, data]) => ({
      codigo: 'USD', periodo, valor: data.sum / data.n
    }))
    console.log(`✅ USD: ${valores.length} meses`)
    return valores
  } catch (e) { console.error('❌ Error USD:', e.message); return [] }
}

// ════ GR3 GASOIL YPF (surtidores.com.ar) ════
async function scrapearGR3() {
  console.log('⛽ Scrapeando GR3 Gasoil...')
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.goto('https://surtidores.com.ar/precios/', { waitUntil: 'networkidle', timeout: 30000 })
    const datos = await page.evaluate(() => {
      const resultados = []
      Array.from(document.querySelectorAll('table')).forEach(tabla => {
        const headers = Array.from(tabla.querySelector('tr')?.querySelectorAll('th,td') || []).map(c => c.textContent.trim())
        const anio = headers[0]
        if (!anio || isNaN(parseInt(anio))) return
        Array.from(tabla.querySelectorAll('tr')).forEach(fila => {
          const celdas = Array.from(fila.querySelectorAll('td')).map(c => c.textContent.trim())
          if (!celdas[0]?.toLowerCase().includes('gasoil')) return
          for (let i = 1; i <= 12; i++) {
            const raw = celdas[i]
            if (!raw) continue
            const valor = parseFloat(raw.replace(/\./g,'').replace(',','.'))
            if (!isNaN(valor) && valor > 0) resultados.push({ periodo: `${anio}-${String(i).padStart(2,'0')}`, valor })
          }
        })
      })
      return resultados
    })
    await browser.close()
    const valores = datos.map(d => ({ codigo: 'GR3', periodo: d.periodo, valor: d.valor }))
    console.log(`✅ GR3: ${valores.length} meses`)
    return valores
  } catch (e) {
    console.error('❌ Error GR3:', e.message)
    if (browser) await browser.close()
    return []
  }
}

// ════ IPC NEUQUÉN ════
async function scrapearIPCNQN() {
  console.log('📍 Scrapeando IPC Neuquén...')
  try {
    // Intentar API datos.gob.ar con serie Neuquén
    const url = 'https://apis.datos.gob.ar/series/api/series/?ids=148.3_INEUQUE_DICI_M_26&limit=24&format=json'
    const r = await fetch(url)
    const d = await r.json()
    if (d.data?.length > 0) {
      const valores = d.data.filter(([,v]) => v !== null).map(([f,v]) => ({ codigo: 'IPCNQN', periodo: f.slice(0,7), valor: v }))
      if (valores.length > 0) { console.log(`✅ IPCNQN: ${valores.length} meses`); return valores }
    }
    console.log('⚠ IPCNQN: No disponible via API — usar carga manual en la app')
    return []
  } catch (e) { console.error('❌ Error IPCNQN:', e.message); return [] }
}

// ════ FADEEAC — Variación mensual publicada ════
async function scrapearFADEEAC() {
  console.log('🚛 Scrapeando FADEEAC...')
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.goto('https://www.fadeeac.org.ar/', { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    const datos = await page.evaluate(() => {
      // La página principal muestra DIC 25, ENE 26, FEB 26, MAR 26 con %
      const meses = { ENE:1,FEB:2,MAR:3,ABR:4,MAY:5,JUN:6,JUL:7,AGO:8,SEP:9,OCT:10,NOV:11,DIC:12 }
      const resultados = []
      const textos = Array.from(document.querySelectorAll('*')).map(el => el.textContent.trim()).filter(t => t.length < 100)
      
      textos.forEach(texto => {
        // Buscar patrón "MES AÑO X,XX%"
        const match = texto.match(/(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\s+(\d{2})\s+([\d,]+)%/i)
        if (match) {
          const mes = meses[match[1].toUpperCase()]
          const anio = 2000 + parseInt(match[2])
          const pct = parseFloat(match[3].replace(',','.'))
          if (mes && !isNaN(pct)) {
            resultados.push({ periodo: `${anio}-${String(mes).padStart(2,'0')}`, pct })
          }
        }
      })
      return resultados
    })

    await browser.close()

    // FADEEAC publica variación % — necesitamos convertir a índice
    // Usamos base 100 en 2020-01 y acumulamos
    if (datos.length > 0) {
      console.log(`✅ FADEEAC: ${datos.length} variaciones encontradas`)
      // Por ahora guardamos las variaciones como referencia para carga manual
      // TODO: acumular desde índice base histórico
    } else {
      console.log('⚠ FADEEAC: Requiere carga manual del índice acumulado')
    }
    return []
  } catch (e) {
    console.error('❌ Error FADEEAC:', e.message)
    if (browser) await browser.close()
    return []
  }
}

// ════ CAC CONSTRUCCIÓN ════
async function scrapearCAC() {
  console.log('🏗️ Scrapeando CAC Construcción...')
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.goto('https://calculadoracac.com.ar/', { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(3000)

    const datos = await page.evaluate(() => {
      const resultados = []
      // Buscar tabla de índices
      Array.from(document.querySelectorAll('table tr')).forEach((fila, idx) => {
        if (idx === 0) return
        const celdas = Array.from(fila.querySelectorAll('td')).map(c => c.textContent.trim())
        if (celdas.length < 2) return
        // Buscar período formato YYYY-MM o MM/YYYY
        const raw0 = celdas[0]
        let periodo = null
        const m1 = raw0.match(/(\d{4})-(\d{2})/)
        const m2 = raw0.match(/(\d{2})\/(\d{4})/)
        if (m1) periodo = m1[0]
        else if (m2) periodo = `${m2[2]}-${m2[1]}`
        
        if (!periodo) return
        const valor = parseFloat(celdas[1].replace(/[^\d.,]/g,'').replace(',','.'))
        if (!isNaN(valor) && valor > 0) resultados.push({ periodo, valor })
      })
      return resultados
    })

    await browser.close()

    if (datos.length > 0) {
      const valores = datos.map(d => ({ codigo: 'CAC', periodo: d.periodo, valor: d.valor }))
      console.log(`✅ CAC: ${valores.length} meses`)
      return valores
    }
    console.log('⚠ CAC: Requiere carga manual')
    return []
  } catch (e) {
    console.error('❌ Error CAC:', e.message)
    if (browser) await browser.close()
    return []
  }
}

// ════ GUARDAR EN SUPABASE ════
async function guardarValores(valores) {
  console.log(`💾 Guardando ${valores.length} valores...`)
  for (const { codigo, periodo, valor } of valores) {
    const { data: anterior } = await sb.from('indices_valores').select('valor').eq('codigo', codigo).order('periodo', { ascending: false }).limit(1).single()
    const { error } = await sb.from('indices_valores').upsert({ codigo, periodo, valor, fuente_real: 'auto', actualizado_at: new Date().toISOString() }, { onConflict: 'codigo,periodo' })
    if (error) { console.error(`❌ ${codigo} ${periodo}:`, error.message); continue }
    console.log(`✅ ${codigo} ${periodo}: ${typeof valor === 'number' ? valor.toFixed(2) : valor}`)
    if (anterior?.valor) {
      const variacion = ((valor - anterior.valor) / anterior.valor) * 100
      if (Math.abs(variacion) >= UMBRAL_ALERTA) await crearAlerta(codigo, periodo, variacion)
    }
  }
}

// ════ CREAR ALERTAS ════
async function crearAlerta(codigo, periodo, variacion) {
  const { data: orgs } = await sb.from('organizaciones').select('id')
  if (!orgs) return
  for (const org of orgs) {
    await sb.from('alertas').insert({
      org_id: org.id, tipo: 'variacion-alta',
      titulo: `${codigo} varió ${variacion >= 0 ? '+' : ''}${variacion.toFixed(2)}%`,
      mensaje: `El índice ${codigo} del período ${periodo} registró una variación de ${variacion >= 0 ? '+' : ''}${variacion.toFixed(2)}% respecto al mes anterior.`,
      data: { codigo, periodo, variacion }, leida: false
    })
  }
}

// ════ FUNCIÓN PRINCIPAL ════
async function ejecutarScraping() {
  console.log('\n══════════════════════════════════════════════')
  console.log('🚀 POLICALC SCRAPER v2')
  console.log(`📅 ${new Date().toLocaleString('es-AR')}`)
  console.log('══════════════════════════════════════════════\n')

  const [ipc, ipim, usd] = await Promise.all([scrapearIPC(), scrapearIPIM(), scrapearUSD()])
  const gr3 = await scrapearGR3()
  const ipcnqn = await scrapearIPCNQN()
  const fadeeac = await scrapearFADEEAC()
  const cac = await scrapearCAC()

  const resultados = [...ipc, ...ipim, ...usd, ...gr3, ...ipcnqn, ...fadeeac, ...cac]

  if (resultados.length > 0) await guardarValores(resultados)

  console.log('\n📋 RESUMEN FINAL:')
  console.log(`  IPC Nacional : ${ipc.length} meses ✅`)
  console.log(`  IPIM         : ${ipim.length} meses ${ipim.length > 0 ? '✅' : '⚠'}`)
  console.log(`  USD BNA      : ${usd.length} meses ✅`)
  console.log(`  GR3 Gasoil   : ${gr3.length} meses ${gr3.length > 0 ? '✅' : '⚠'}`)
  console.log(`  IPC Neuquén  : ${ipcnqn.length} meses ${ipcnqn.length > 0 ? '✅' : '⚠ manual'}`)
  console.log(`  FADEEAC      : ${fadeeac.length} meses ${fadeeac.length > 0 ? '✅' : '⚠ manual'}`)
  console.log(`  CAC          : ${cac.length} meses ${cac.length > 0 ? '✅' : '⚠ manual'}`)
  console.log('══════════════════════════════════════════════\n')
}

cron.schedule('0 9 15 * *', () => { console.log('⏰ Cron activado'); ejecutarScraping() }, { timezone: 'America/Argentina/Buenos_Aires' })

ejecutarScraping()
console.log('✅ Scraper v2 activo — IPC, IPIM, USD, GR3, IPCNQN, FADEEAC, CAC')