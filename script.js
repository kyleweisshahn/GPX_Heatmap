const map = L.map('map', {
  center: [45, -93],
  zoom: 8,
  layers: []
});

const baseLayers = {
  "Streets": L.tileLayer.provider('OpenStreetMap.Mapnik'),
  "Aerial": L.tileLayer.provider('Esri.WorldImagery')
};

// Default to Aerial
baseLayers["Aerial"].addTo(map);
L.control.layers(baseLayers).addTo(map);

let heatPoints = [];
let heatLayer = null;

document.getElementById('gpx-upload').addEventListener('change', async (event) => {
  const files = Array.from(event.target.files);
  let bounds = [];

  const parseGPX = (gpxText) => {
    const parser = new DOMParser();
    const xml = parser.parseFromString(gpxText, "application/xml");
    const trkpts = xml.getElementsByTagName('trkpt');
    const latlngs = [];

    for (let i = 0; i < trkpts.length; i++) {
      const lat = parseFloat(trkpts[i].getAttribute('lat'));
      const lon = parseFloat(trkpts[i].getAttribute('lon'));
      if (!isNaN(lat) && !isNaN(lon)) {
        latlngs.push([lat, lon]);
        bounds.push([lat, lon]);
      }
    }

    return latlngs;
  };

  for (const file of files) {
    const text = await file.text();
    const latlngs = parseGPX(text);
    heatPoints.push(...latlngs);
  }

  if (heatLayer) map.removeLayer(heatLayer);

  heatLayer = L.heatLayer(heatPoints, {
    radius: 10,
    blur: 15,
    maxZoom: 17,
    gradient: {
      0.0: 'green',
      0.5: 'yellow',
      1.0: 'red'
    },
    opacity: parseFloat(document.getElementById('opacity-slider').value)
  });

  heatLayer.addTo(map);

  if (bounds.length) map.fitBounds(bounds);
});

document.getElementById('opacity-slider').addEventListener('input', (event) => {
  if (heatLayer) {
    heatLayer.setOptions({ opacity: parseFloat(event.target.value) });
  }
});