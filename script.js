const map = L.map('map').setView([45, -93], 8); // Default center

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
}).addTo(map);

document.getElementById('gpx-upload').addEventListener('change', async (event) => {
  const files = Array.from(event.target.files);

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const gpx = e.target.result;

      new L.GPX(gpx, {
        async: true,
        marker_options: {
          startIconUrl: null,
          endIconUrl: null,
          shadowUrl: null
        },
        polyline_options: {
          color: 'red',
          opacity: 0.5,
          weight: 4
        }
      }).on('loaded', function(e) {
        map.fitBounds(e.target.getBounds());
      }).addTo(map);
    };
    reader.readAsText(file);
  });
});