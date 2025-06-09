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

  for (const file of files) {
    const text = await file.text();
    const latlngs = parseGPX(text);

    if (latlngs.length > 1) {
      const simplified = document.getElementById('simplify-tracks').checked
        ? simplifyPath(latlngs, 0.0001)
        : latlngs;

      for (let i = 0; i < simplified.length - 1; i++) {
        const key = getSegmentKey(simplified[i], simplified[i + 1]);
        segmentCount[key] = (segmentCount[key] || 0) + 1;
        bounds.push(simplified[i]);
        bounds.push(simplified[i + 1]);
      }
    }
  }

  if (Object.keys(segmentCount).length === 0) {
    alert("No valid GPX data found.");
    return;
  }

  if (polyLayer) map.removeLayer(polyLayer);

  const segments = Object.keys(segmentCount).map(key => {
    const [lat1, lon1, lat2, lon2] = key.split(',').map(Number);
    return {
      latlngs: [[lat1, lon1], [lat2, lon2]],
      count: segmentCount[key]
    };
  });

  const maxCount = Math.max(...segments.map(s => s.count));
  polyLayer = L.layerGroup();

  for (const seg of segments) {
    const ratio = seg.count / maxCount;
    const color = ratio < 0.33 ? 'green' : ratio < 0.66 ? 'yellow' : 'red';

    L.polyline(seg.latlngs, {
      color,
      weight: 4,
      opacity: parseFloat(document.getElementById('opacity-slider').value)
    }).addTo(polyLayer);
  }

  polyLayer.addTo(map);
  if (bounds.length) map.fitBounds(bounds);
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
        latlngs.push([parseFloat(lat.toFixed(5)), parseFloat(lon.toFixed(5))]);
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
  return sorted.flat().join(',');
}

function simplifyPath(points, tolerance) {
  if (points.length < 3) return points;

  const sq = (x) => x * x;
  const getSqDist = (p1, p2) => sq(p1[0] - p2[0]) + sq(p1[1] - p2[1]);

  const getSqSegDist = (p, p1, p2) => {
    let x = p1[0], y = p1[1];
    let dx = p2[0] - x, dy = p2[1] - y;

    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = p2[0]; y = p2[1];
      } else if (t > 0) {
        x += dx * t; y += dy * t;
      }
    }

    return sq(p[0] - x) + sq(p[1] - y);
  };

  const simplifyDP = (pts, first, last, tol, simplified) => {
    let maxDist = tol;
    let index = -1;

    for (let i = first + 1; i < last; i++) {
      const dist = getSqSegDist(pts[i], pts[first], pts[last]);
      if (dist > maxDist) {
        index = i;
        maxDist = dist;
      }
    }

    if (maxDist > tol) {
      if (index - first > 1) simplifyDP(pts, first, index, tol, simplified);
      simplified.push(pts[index]);
      if (last - index > 1) simplifyDP(pts, index, last, tol, simplified);
    }
  };

  const out = [points[0]];
  simplifyDP(points, 0, points.length - 1, tolerance * tolerance, out);
  out.push(points[points.length - 1]);
  return out;
}