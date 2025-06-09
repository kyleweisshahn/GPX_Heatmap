const ORS_API_KEY = '5b3ce3597851110001cf624851dc40ac20e043cc8ca7ea17f7b8baa9';
const ORS_ENDPOINT = 'https://api.openrouteservice.org/match';

const domToImageScript = document.createElement('script');
domToImageScript.src = "https://cdn.jsdelivr.net/npm/dom-to-image@2.6.0/src/dom-to-image.min.js";
document.head.appendChild(domToImageScript);

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
let segmentCount = {};

document.getElementById('gpx-upload').addEventListener('change', async (event) => {
  const files = Array.from(event.target.files);
  let bounds = [];

  segmentCount = {};
  if (polyLayer) {
    map.removeLayer(polyLayer);
  }
  polyLayer = L.layerGroup();

  for (const file of files) {
    const text = await file.text();
    const latlngs = parseGPX(text);
    if (latlngs.length < 2) continue;

    const snapped = await snapToORS(latlngs);
    if (!snapped) continue;

    const coords = snapped.map(p => [p[1], p[0]]);
    bounds.push(...coords);

    for (let i = 0; i < coords.length - 1; i++) {
      const key = getSegmentKey(coords[i], coords[i + 1]);
      segmentCount[key] = (segmentCount[key] || 0) + 1;
    }
  }

  const segments = Object.entries(segmentCount).map(([key, count]) => {
    const [lat1, lon1, lat2, lon2] = key.split(',').map(Number);
    return {
      latlngs: [[lat1, lon1], [lat2, lon2]],
      count
    };
  });

  const maxCount = Math.max(...segments.map(s => s.count));

  segments.forEach(seg => {
    const ratio = seg.count / maxCount;
    const color = ratio < 0.33 ? 'green' : ratio < 0.66 ? 'yellow' : 'red';

    L.polyline(seg.latlngs, {
      color,
      weight: 4,
      opacity: parseFloat(document.getElementById('opacity-slider').value)
    }).addTo(polyLayer);
  });

  polyLayer.addTo(map);
  if (bounds.length) map.fitBounds(bounds);
});

async function snapToORS(latlngs) {
  try {
    const coords = latlngs.map(p => [p[1], p[0]]);
    const response = await fetch(ORS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        coordinates: coords,
        radiuses: Array(coords.length).fill(25),
        geometry: true
      })
    });

    if (!response.ok) {
      console.warn('ORS error:', await response.text());
      return null;
    }

    const data = await response.json();
    const line = data?.routes?.[0]?.geometry;
    if (!line) return null;

    return decodePolyline(line);
  } catch (e) {
    console.error('ORS request failed:', e);
    return null;
  }
}

function decodePolyline(str, precision = 5) {
  let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null;
  const factor = Math.pow(10, precision);

  while (index < str.length) {
    shift = result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    shift = result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += deltaLng;

    coordinates.push([lat / factor, lng / factor]);
  }

  return coordinates;
}

function parseGPX(gpxText) {
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(gpxText, "application/xml");
    const trkpts = xml.getElementsByTagName('trkpt');
    const latlngs = [];

    for (let i = 0; i < trkpts.length; i++) {
      const lat = parseFloat(trkpts[i].getAttribute('lat'));
      const lon = parseFloat(trkpts[i].getAttribute('lon'));
      if (!isNaN(lat) && !isNaN(lon)) {
        latlngs.push([lat, lon]);
      }
    }

    return latlngs;
  } catch (e) {
    console.warn("Failed to parse GPX file:", e);
    return [];
  }
}

function getSegmentKey(p1, p2) {
  const sorted = [p1, p2].sort((a, b) =>
    a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]
  );
  return sorted.flat().map(n => n.toFixed(5)).join(',');
}

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
    .then((dataUrl) => {
      const link = document.createElement('a');
      link.download = 'heatmap.png';
      link.href = dataUrl;
      link.click();
    })
    .catch((error) => {
      console.error('Export failed:', error);
      alert('Export failed.');
    });
});