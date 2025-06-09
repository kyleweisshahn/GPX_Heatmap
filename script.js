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

let heatPoints = [];
let heatLayer = null;

document.getElementById('gpx-upload').addEventListener('change', async (event) => {
  const files = Array.from(event.target.files);
  let bounds = [];

  const parseGPX = (gpxText) => {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(gpxText, "application/xml");
      const trkpts = xml.getElementsByTagName('trkpt');
      const latlngs = [];

      for (let i = 0; i < trkpts.length; i++) {
        const lat = parseFloat(trkpts[i].getAttribute('lat'));
        const lon = parseFloat(trkpts[i].getAttribute('lon'));
        if (!isNaN(lat) && !isNaN(lon)) {
          // Rounded for basic snapping (5 decimals ~1.1m resolution)
          const roundedLat = parseFloat(lat.toFixed(5));
          const roundedLon = parseFloat(lon.toFixed(5));
          latlngs.push([roundedLat, roundedLon]);
          bounds.push([roundedLat, roundedLon]);
        }
      }

      return latlngs;
    } catch (e) {
      console.warn("Failed to parse GPX file:", e);
      return [];
    }
  };

  for (const file of files) {
    const text = await file.text();
    const latlngs = parseGPX(text);

    if (latlngs.length > 0) {
      heatPoints.push(...latlngs);
    } else {
      console.warn(`No valid track points in: ${file.name}`);
    }
  }

  if (heatPoints.length === 0) {
    alert("No valid GPX data found.");
    return;
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

document.getElementById('apply-opacity').addEventListener('click', () => {
  if (heatLayer) {
    const newOpacity = parseFloat(document.getElementById('opacity-slider').value);
    heatLayer.setOptions({ opacity: newOpacity });
  }
});