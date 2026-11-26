// ============================================================
// Temperatura de superficie de Barcelona - verano 2026
// Landsat 8 y 9 - nubosidad global inferior al 10 %
// ============================================================

// 1. Rectángulo aproximado de Barcelona
var barcelona = ee.Geometry.Rectangle([2.04, 41.30, 2.24, 41.48]);

// 2. Colecciones Landsat 8 y 9 (nivel 2, con temperatura de superficie)
var l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2');
var l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2');

// 3. Unir y aplicar filtros
var coleccion = l8.merge(l9)
  .filterBounds(barcelona)
  .filterDate('2026-06-01', '2026-10-01')                       // del 1 de junio al 30 de septiembre
  .filter(ee.Filter.lt('CLOUD_COVER', 10))                      // menos del 10 % de nubes en toda la escena
  .filter(ee.Filter.eq('PROCESSING_LEVEL', 'L2SP'));            // solo escenas con temperatura de superficie

// Comprobar cuántas imágenes quedan y de qué días son (apúntalas para la memoria)
print('Número de imágenes:', coleccion.size());
print('Fechas de las imágenes:', coleccion.aggregate_array('DATE_ACQUIRED').sort());

// 4. Enmascarar nubes, sombras, cirros y agua, y convertir la temperatura a grados Celsius
function prepararTemperatura(imagen) {
  var qa = imagen.select('QA_PIXEL');

  // Excluir bits 0, 1, 2, 3, 4 y 7 (relleno, nube dilatada, cirros, nube, sombra y agua)
  var mascara = qa.bitwiseAnd(159).eq(0);

  var temp = imagen.select('ST_B10')
    .multiply(0.00341802)
    .add(149.0)
    .subtract(273.15)
    .updateMask(mascara)
    .rename('temp_C');

  return temp.copyProperties(imagen, ['system:time_start']);
}

var temperaturas = coleccion.map(prepararTemperatura);

// 5. Mediana y número de observaciones válidas
var mediana = temperaturas.median().clip(barcelona);
var recuento = temperaturas.count()
  .rename('n_imagenes')
  .clip(barcelona);

// 6. Mostrar en el mapa
Map.centerObject(barcelona, 11);

Map.addLayer(
  mediana,
  {min: 25, max: 50, palette: ['blue', 'cyan', 'yellow', 'orange', 'red']},
  'Temperatura mediana (°C)'
);

Map.addLayer(
  recuento,
  {min: 1, max: 10, palette: ['white', 'black']},
  'Número de imágenes válidas',
  false
);

// 7. Exportar a Google Drive (los píxeles sin dato se guardan como -9999)
Export.image.toDrive({
  image: mediana.toFloat().addBands(recuento.toFloat()).unmask(-9999),      // las dos bandas del mismo tipo (Float32)
  description: 'temperatura_barcelona_verano2026',
  folder: 'proyectofinal_ITAcademy',                       // carpeta de Drive (en 'Mi unidad', al nivel principal),
  fileNamePrefix: 'temperatura_mediana_verano2026',
  region: barcelona,
  scale: 30,
  crs: 'EPSG:25831',
  maxPixels: 1e9
});
