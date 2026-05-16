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
const UMBRAL_ALERTA = 5.0 // Alertar si varía más de 5%

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
      const periodo = fecha.slice(0, 7)
      valores.push({ codigo: 'IPC', periodo, valor })
    }
    
    console.log(`✅ IPC: ${valores.length} meses obtenidos`)
    return valores
  } catch (e) {
    console.error('❌ Error IPC:', e.message)
    return []
  }
}

// ════ SCRAPER USD OFICIAL (BNA via API Argentina Datos) ════
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
    
    const valores = []
    Object.entries(agg).forEach(([periodo, data]) => {
      const valor = data.sum / data.n
      valores.push({ codigo: 'USD', periodo, valor })
    })
    
    console.log(`✅ USD: ${valores.length} meses obtenidos`)
    return valores
  } catch (e) {
    console.error('❌ Error USD:', e.message)
    return []
  }
}

// ════ SCRAPER GR3 GASOIL (YPF - Secretaría de Energía) ════
async function scrapearGR3() {
  console.log('⛽ Scrapeando GR3 Gasoil desde Secretaría de Energía...')
  
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    
    // La página de Secretaría de Energía requiere navegación y selección
    await page.goto('http://res1104.se.gob.ar/consultaprecios.eess.php', { waitUntil: 'networkidle' })
    
    // Seleccionar provincia (ej: Buenos Aires)
    await page.selectOption('select[name="provincia"]', { label: 'Buenos Aires' })
    await page.waitForTimeout(1000)
    
    // Seleccionar YPF
    await page.selectOption('select[name="empresa"]', { label: 'YPF' })
    await page.waitForTimeout(1000)
    
    // Buscar
    await page.click('button[type="submit"], input[type="submit"]')
    await page.waitForTimeout(2000)
    
    // Scrapear la tabla de precios
    const precios = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr'))
      const gasoilRow = rows.find(r => r.textContent.includes('Gasoil') || r.textContent.includes('GR3'))
      if (!gasoilRow) return null
      
      const cells = gasoilRow.querySelectorAll('td')
      if (cells.length < 2) return null
      
      // El precio suele estar en la segunda o tercera columna
      const precioText = cells[1]?.textContent?.trim() || cells[2]?.textContent?.trim()
      const precio = parseFloat(precioText.replace(/[^\d.,]/g, '').replace(',', '.'))
      
      return isNaN(precio) ? null : precio
    })
    
    await browser.close()
    
    if (!precios) {
      console.log('⚠ GR3: No se pudo obtener el precio')
      return []
    }
    
    const hoy = new Date()
    const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
    
    console.log(`✅ GR3: $${precios} (${periodo})`)
    return [{ codigo: 'GR3', periodo, valor: precios }]
    
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
    // Obtener valor anterior para calcular variación
    const { data: anterior } = await sb
      .from('indices_valores')
      .select('valor, periodo')
      .eq('codigo', codigo)
      .is('org_id', null)
      .order('periodo', { ascending: false })
      .limit(1)
      .single()
    
    // Insertar nuevo valor
    const { error } = await sb.from('indices_valores').upsert({
      codigo,
      periodo,
      valor,
      fuente_real: 'auto',
      actualizado_at: new Date().toISOString()
    })
    
    if (error) {
      console.error(`❌ Error guardando ${codigo} ${periodo}:`, error.message)
      continue
    }
    
    console.log(`✅ ${codigo} ${periodo}: ${valor}`)
    
    // Crear alerta si varió mucho
    if (anterior?.valor) {
      const variacion = ((valor - anterior.valor) / anterior.valor) * 100
      
      if (Math.abs(variacion) >= UMBRAL_ALERTA) {
        await crearAlerta(codigo, periodo, variacion)
      }
    }
  }
}

// ════ CREAR ALERTAS ════
async function crearAlerta(codigo, periodo, variacion) {
  console.log(`🔔 Creando alerta: ${codigo} varió ${variacion.toFixed(2)}%`)
  
  // Obtener todas las orgs
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
  
  const resultados = []
  
  // Ejecutar scrapers en paralelo
  const [ipc, usd, gr3] = await Promise.all([
    scrapearIPC(),
    scrapearUSD(),
    scrapearGR3()
  ])
  
  resultados.push(...ipc, ...usd, ...gr3)
  
  // Guardar en base de datos
  if (resultados.length > 0) {
    await guardarValores(resultados)
    console.log(`\n✅ Scraping completado: ${resultados.length} valores guardados`)
  } else {
    console.log('\n⚠ No se obtuvieron valores')
  }
  
  console.log('════════════════════════════════════════\n')
}

// ════ PROGRAMAR EJECUCIÓN ════
// Día 15 de cada mes a las 09:00 ART
cron.schedule('0 9 15 * *', () => {
  console.log('⏰ Cron activado — ejecutando scraping programado')
  ejecutarScraping()
}, {
  timezone: 'America/Argentina/Buenos_Aires'
})

// Ejecutar al iniciar (para testing)
ejecutarScraping()

// Mantener el proceso vivo
console.log('✅ Scraper iniciado — esperando cron (día 15 de cada mes, 09:00 ART)')
console.log('💡 Para testing manual: el scraper se ejecutó al iniciar\n')