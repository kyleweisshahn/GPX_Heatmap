import os
import json
import gpxpy
import requests
from shapely.geometry import LineString, mapping
from collections import defaultdict
import geojson

ORS_API_KEY = '5b3ce3597851110001cf624851dc40ac20e043cc8ca7ea17f7b8baa9'
ORS_ENDPOINT = 'https://api.openrouteservice.org/v2/directions/cycling-regular'

INPUT_DIR = 'data/apple_health_export/workout-routes'
OUTPUT_FILE = 'heatmap.geojson'
TOLERANCE_METERS = 6  # tolerance for merging segments, approx 20ft
RADIUS_METERS = 25

def decode_polyline(polyline, precision=5):
    index, lat, lng = 0, 0, 0
    coordinates = []
    factor = 10 ** precision

    while index < len(polyline):
        shift, result = 0, 0
        while True:
            byte = ord(polyline[index]) - 63
            index += 1
            result |= (byte & 0x1f) << shift
            shift += 5
            if byte < 0x20:
                break
        delta_lat = ~(result >> 1) if result & 1 else result >> 1
        lat += delta_lat

        shift, result = 0, 0
        while True:
            byte = ord(polyline[index]) - 63
            index += 1
            result |= (byte & 0x1f) << shift
            shift += 5
            if byte < 0x20:
                break
        delta_lng = ~(result >> 1) if result & 1 else result >> 1
        lng += delta_lng

        coordinates.append((lng / factor, lat / factor))
    return coordinates

def snap_track(latlngs):
    if len(latlngs) > 70:
        step = len(latlngs) // 70
        latlngs = latlngs[::step][:70]
    body = {
        "coordinates": [[lon, lat] for lat, lon in latlngs]
    }
    headers = {
        "Authorization": ORS_API_KEY,
        "Content-Type": "application/json"
    }
    response = requests.post(ORS_ENDPOINT, json=body, headers=headers)
    if not response.ok:
        print(f"Failed to snap track: {response.text}")
        return []
    geometry = response.json().get('routes', [{}])[0].get('geometry')
    return decode_polyline(geometry) if geometry else []

def round_coord(coord, precision=5):
    return tuple(round(c, precision) for c in coord)

def process_files():
    segment_counter = defaultdict(int)

    for filename in os.listdir(INPUT_DIR):
        if not filename.endswith('.gpx'):
            continue
        print(f"Processing {filename}")
        with open(os.path.join(INPUT_DIR, filename), 'r') as f:
            gpx = gpxpy.parse(f)
            for track in gpx.tracks:
                for segment in track.segments:
                    latlngs = [(p.latitude, p.longitude) for p in segment.points]
                    if len(latlngs) < 2:
                        continue
                    snapped = snap_track(latlngs)
                    for i in range(len(snapped) - 1):
                        key = tuple(sorted([round_coord(snapped[i]), round_coord(snapped[i + 1])]))
                        segment_counter[key] += 1

    features = []
    for (start, end), count in segment_counter.items():
        line = LineString([start, end])
        features.append(geojson.Feature(geometry=mapping(line), properties={'count': count}))

    with open(OUTPUT_FILE, 'w') as f:
        geojson.dump(geojson.FeatureCollection(features), f)
    print(f"Saved heatmap to {OUTPUT_FILE}")

if __name__ == '__main__':
    os.makedirs(INPUT_DIR, exist_ok=True)
    process_files()
