const map = L.map('map', {
  center: [45, -93],
  zoom: 8,
  layers: []
});

const baseLayers = {
  "Streets": L.tileLayer.provider('OpenStreetMap.Mapnik'),
  "Aerial": L.tileLayer.provider('Esri.WorldImagery')
};

baseLayers["Aerial"].addTo(map);
L.control.layers(baseLayers).addTo(map);

let polyLayer = null;

fetch('heatmap.geojson')
  .then(response => response.json())
  .then(data => {
    const features = data.features;
    const maxCount = Math.max(...features.map(f => f.properties.count));

    polyLayer = L.layerGroup();

    features.forEach(feature => {
      const coords = feature.geometry.coordinates.map(c => [c[1], c[0]]);
      const ratio = feature.properties.count / maxCount;
      const color = ratio < 0.33 ? 'green' : ratio < 0.66 ? 'yellow' : 'red';

      L.polyline(coords, {
        color,
        weight: 4,
        opacity: parseFloat(document.getElementById('opacity-slider').value)
      }).addTo(polyLayer);
    });

    polyLayer.addTo(map);
    const bounds = polyLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds);
  });

document.getElementById('apply-opacity').addEventListener('click', () => {
  if (!polyLayer) return;
  const opacity = parseFloat(document.getElementById('opacity-slider').value);
  polyLayer.eachLayer(layer => {
    if (layer.setStyle) {
      layer.setStyle({ opacity });
    }
  });
});

document.getElementById('export-map').addEventListener('click', () => {
  domtoimage.toPng(document.getElementById('map'))
    .then(dataUrl => {
      const link = document.createElement('a');
      link.download = 'heatmap.png';
      link.href = dataUrl;
      link.click();
    })
    .catch(error => {
      console.error('Export failed:', error);
      alert('Export failed.');
    });
});
