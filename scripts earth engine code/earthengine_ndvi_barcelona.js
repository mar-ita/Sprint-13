// ============================================================
// NDVI (vegetación) de Barcelona en verano 2026 - Landsat 8 y 9
// Mismas fechas y mismos filtros que el script de temperatura,
// para que las dos variables salgan de las mismas imágenes.
// ============================================================

// 1. La zona: el mismo rectángulo que en el script de temperatura
var barcelona = ee.Geometry.Rectangle([2.04, 41.30, 2.24, 41.48]);

// 2. Las imágenes: Landsat 8 y 9, nivel 2, con los MISMOS filtros que la temperatura
var l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2');
var l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2');

var coleccion = l8.merge(l9)
  .filterBounds(barcelona)
  .filterDate('2026-06-01', '2026-10-01')
  .filter(ee.Filter.lt('CLOUD_COVER', 10))
  .filter(ee.Filter.eq('PROCESSING_LEVEL', 'L2SP'));

print('Número de imágenes:', coleccion.size());       // debe ser el mismo que en el script de temperatura
print('Fechas de las imágenes:', coleccion.aggregate_array('DATE_ACQUIRED').sort());   // y las mismas fechas

// 3. NDVI de cada imagen, quitando nubes, sombras, cirros y agua
//    NDVI = (infrarrojo cercano - rojo) / (infrarrojo cercano + rojo)
//    Banda 5 = infrarrojo cercano, banda 4 = rojo.
//    Las bandas de reflectancia llevan factor de escala 0,0000275 y desplazamiento -0,2.
function prepararNDVI(imagen) {
  var qa = imagen.select('QA_PIXEL');
  var mascara = qa.bitwiseAnd(159).eq(0);                      // misma máscara que la temperatura
  var reflectancia = imagen.select(['SR_B4', 'SR_B5']).multiply(0.0000275).add(-0.2);
  var ndvi = reflectancia.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
  return ndvi.updateMask(mascara).copyProperties(imagen, ['system:time_start']);
}
var indices = coleccion.map(prepararNDVI);

// 4. Un solo mapa: la mediana de todas las imágenes, y cuántas imágenes válidas hay en cada píxel
var mediana = indices.median().clip(barcelona);
var recuento = indices.count().rename('n_imagenes').clip(barcelona);

// 5. Verlo en el mapa (verde oscuro = mucha vegetación; blanco = poca o ninguna)
Map.centerObject(barcelona, 11);
Map.addLayer(mediana, {min: 0, max: 0.8, palette: ['#ffffe5', '#c2e699', '#78c679', '#238443', '#004529']}, 'NDVI mediano');
Map.addLayer(recuento, {min: 1, max: 10, palette: ['white', 'black']}, 'Nº de imágenes válidas', false);

// 6. Exportar a Google Drive (los píxeles sin dato se guardan como -9999)
Export.image.toDrive({
  image: mediana.toFloat().addBands(recuento.toFloat()).unmask(-9999),      // las dos bandas del mismo tipo (Float32)
  description: 'ndvi_barcelona_verano2026',
  folder: 'proyectofinal_ITAcademy',                       // carpeta de Drive (en 'Mi unidad', al nivel principal),
  fileNamePrefix: 'ndvi_mediana_verano2026',
  region: barcelona,
  scale: 30,
  crs: 'EPSG:25831',
  maxPixels: 1e9
});
