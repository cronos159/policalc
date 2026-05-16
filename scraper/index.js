// ════════════════════════════════════════════════════════════════
// POLICALC SCRAPER — Node.js + Playwright
// Scraping automático mensual de IPC, USD, GR3 Gasoil
// ════════════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js')
const fetch = require('node-fetch')
const cron = require('node-cron')
const { chromium } = require('playwright-chromium')

// ════ CONFIG ════
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const UMBRAL_ALERTA = 5.0

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan variables de entorno SUPABASE_URL y SUPABASE_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ════ SCRAPER IPC (INDEC) ════
async function scrapearIPC() {
  console.log('📊 Scrapeando IPC desde INDEC...')
  try {
    const url = 'https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=12&format=json'
    const r = await fetch(url)
    const d = await r.json()
    const valores = []
    for (const [fecha, valor] of d.data || []) {
      if (valor === null) continue
      valores.push({ codigo: 'IPC', periodo: fecha.slice(0, 7), valor })
    }
    console.log(`✅ IPC: ${valores.length} meses obtenidos`)
    return valores
  } catch (e) {
    console.error('❌ Error IPC:', e.message)
    return []
  }
}

// ════ SCRAPER USD OFICIAL (BNA) ════
async function scrapearUSD() {
  console.log('💵 Scrapeando Dólar BNA...')
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
    const valores = Object.entries(agg).map(([periodo, data]) => ({
      codigo: 'USD', periodo, valor: data.sum / data.n
    }))
    console.log(`✅ USD: ${valores.length} meses obtenidos`)
    return valores
  } catch (e) {
    console.error('❌ Error USD:', e.message)
    return []
  }
}

// ════ SCRAPER GR3 GASOIL (surtidores.com.ar) ════
async function scrapearGR3() {
  console.log('⛽ Scrapeando GR3 Gasoil desde surtidores.com.ar...')
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.goto('https://surtidores.com.ar/precios/', { waitUntil: 'networkidle', timeout: 30000 })

    // Scrapear todas las tablas de precios
    const datos = await page.evaluate(() => {
      const resultados = []
      const tablas = Array.from(document.querySelectorAll('table'))

      tablas.forEach(tabla => {
        // Buscar el año en el encabezado de la tabla
        const headerRow = tabla.querySelector('tr')
        if (!headerRow) return
        const headers = Array.from(headerRow.querySelectorAll('th, td')).map(c => c.textContent.trim())
        const anio = headers[0]
        if (!anio || isNaN(parseInt(anio))) return

        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

        // Buscar fila de Gasoil
        const filas = Array.from(tabla.querySelectorAll('tr'))
        filas.forEach(fila => {
          const celdas = Array.from(fila.querySelectorAll('td')).map(c => c.textContent.trim())
          if (!celdas[0] || !celdas[0].toLowerCase().includes('gasoil')) return
          // celdas[0] = "Gasoil", celdas[1..12] = valores por mes
          for (let i = 1; i <= 12; i++) {
            const raw = celdas[i]
            if (!raw || raw === '') continue
            const valor = parseFloat(raw.replace(/\./g, '').replace(',', '.'))
            if (isNaN(valor) || valor === 0) continue
            const mes = String(i).padStart(2, '0')
            resultados.push({ periodo: `${anio}-${mes}`, valor })
          }
        })
      })
      return resultados
    })

    await browser.close()

    const valores = datos.map(d => ({ codigo: 'GR3', periodo: d.periodo, valor: d.valor }))
    console.log(`✅ GR3: ${valores.length} meses obtenidos`)
    return valores

  } catch (e) {
    console.error('❌ Error GR3:', e.message)
    if (browser) await browser.close()
    return []
  }
}

// ════ GUARDAR EN SUPABASE ════
async function guardarValores(valores) {
  console.log(`💾 Guardando ${valores.length} valores en Supabase...`)
  for (const { codigo, periodo, valor } of valores) {
    const { data: anterior } = await sb
      .from('indices_valores')
      .select('valor')
      .eq('codigo', codigo)
      .order('periodo', { ascending: false })
      .limit(1)
      .single()

    const { error } = await sb.from('indices_valores').upsert({
      codigo, periodo, valor,
      fuente_real: 'auto',
      actualizado_at: new Date().toISOString()
    }, { onConflict: 'codigo,periodo' })

    if (error) { console.error(`❌ Error guardando ${codigo} ${periodo}:`, error.message); continue }
    console.log(`✅ ${codigo} ${periodo}: ${valor}`)

    if (anterior?.valor) {
      const variacion = ((valor - anterior.valor) / anterior.valor) * 100
      if (Math.abs(variacion) >= UMBRAL_ALERTA) await crearAlerta(codigo, periodo, variacion)
    }
  }
}

// ════ CREAR ALERTAS ════
async function crearAlerta(codigo, periodo, variacion) {
  console.log(`🔔 Alerta: ${codigo} varió ${variacion.toFixed(2)}%`)
  const { data: orgs } = await sb.from('organizaciones').select('id')
  if (!orgs) return
  for (const org of orgs) {
    await sb.from('alertas').insert({
      org_id: org.id,
      tipo: 'variacion-alta',
      titulo: `${codigo} varió ${variacion >= 0 ? '+' : ''}${variacion.toFixed(2)}%`,
      mensaje: `El índice ${codigo} del período ${periodo} registró una variación de ${variacion >= 0 ? '+' : ''}${variacion.toFixed(2)}% respecto al mes anterior.`,
      data: { codigo, periodo, variacion },
      leida: false
    })
  }
}

// ════ FUNCIÓN PRINCIPAL ════
async function ejecutarScraping() {
  console.log('\n════════════════════════════════════════')
  console.log('🚀 POLICALC SCRAPER — Iniciando...')
  console.log(`📅 ${new Date().toLocaleString('es-AR')}`)
  console.log('════════════════════════════════════════\n')

  const [ipc, usd, gr3] = await Promise.all([
    scrapearIPC(),
    scrapearUSD(),
    scrapearGR3()
  ])

  const resultados = [...ipc, ...usd, ...gr3]

  if (resultados.length > 0) {
    await guardarValores(resultados)
    console.log(`\n✅ Scraping completado: ${resultados.length} valores guardados`)
  } else {
    console.log('\n⚠ No se obtuvieron valores')
  }
  console.log('════════════════════════════════════════\n')
}

// ════ CRON — Día 15 de cada mes 09:00 ART ════
cron.schedule('0 9 15 * *', () => {
  console.log('⏰ Cron activado — ejecutando scraping programado')
  ejecutarScraping()
}, { timezone: 'America/Argentina/Buenos_Aires' })

ejecutarScraping()

console.log('✅ Scraper iniciado — esperando cron (día 15 de cada mes, 09:00 ART)')