$(document).ready(function () {
    maptilersdk.config.apiKey = 'uAItrm0npRJhGt3vgNDx';

    let map;
    let startMarker;
    let endMarker = null;
    let currentPosition = [0, 0]; // [lng, lat]
    let initialized = false;
    let fullRouteCoords = [];
    let inputValueSave;
    let trackingEnabled = false;
    let routeReady = false;

    const ROUTE_LAYER_ID = 'route';

    $('#startBtn').on('click', function () {
        trackingEnabled = true;
        alert("Слежение включено!");

        simulation(); // или simulation(0.001, 100) для быстрой прокрутки

        $('.maplibregl-marker svg').eq(0).remove()
        $('.maplibregl-marker').eq(0).html(`<img class="bolide" src="./free-icon-racing-car-1505502.png"/>`)
    });

    function findNearestIndex(current, coords) {
        let minDist = Infinity;
        let nearestIndex = 0;
        coords.forEach((coord, index) => {
            const dx = current[0] - coord[0];
            const dy = current[1] - coord[1];
            const dist = dx * dx + dy * dy;
            if (dist < minDist) {
                minDist = dist;
                nearestIndex = index;
            }
        });
        return nearestIndex;
    }

    function getBearing(from, to) {
        const lon1 = from[0] * Math.PI / 180;
        const lat1 = from[1] * Math.PI / 180;
        const lon2 = to[0] * Math.PI / 180;
        const lat2 = to[1] * Math.PI / 180;

        const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
        const brng = Math.atan2(y, x);
        return (brng * 180 / Math.PI + 360) % 360;
    }

    const watchId = navigator.geolocation.watchPosition(
        function (position) {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            currentPosition = [longitude, latitude];

            if (!initialized) {
                map = new maptilersdk.Map({
                    container: 'map',
                    center: currentPosition,
                    zoom: 15,
                    style: maptilersdk.MapStyle.STREETS
                });

                const gc = new maptilersdkMaptilerGeocoder.GeocodingControl({
                    country: ['KZ'],
                    bbox: [57.005856, 50.1969322, 57.2762532, 50.3650833],
                    marker: false,
                    debounceSearch: 100,
                });

                map.addControl(gc, 'top-left');

                gc.on('select', () => {
                    $('.marker-interactive').remove();
                });

                gc.on('pick', (e) => {
                    const fullAddress = e.feature.place_name;
                    const address = fullAddress.split(',')[0].trim();
                    const input = document.querySelector('.svelte-bz0zu3 input');
                    if (input?.value.trim().length > 0) {
                        inputValueSave = address;
                    }

                    map.removeControl(gc, 'top-left');
                    $('.mapboxgl-ctrl-geocoder').remove();
                    map.addControl(gc, 'top-left');
                    drawTheRoad(e.feature.center[0], e.feature.center[1]);
                });

                startMarker = new maptilersdk.Marker({ color: '#f50' })
                    .setLngLat(currentPosition)
                    .addTo(map);

                initialized = true;

            } else {
                if (!routeReady) return;

                const nearestIndex = findNearestIndex(currentPosition, fullRouteCoords);
                const offset = 3;
                const adjustedIndex = Math.max(0, nearestIndex - offset);
                const remainingRoute = fullRouteCoords.slice(adjustedIndex);

                try {
                    if (map.getSource(ROUTE_LAYER_ID)) {
                        map.getSource(ROUTE_LAYER_ID).setData({
                            type: 'Feature',
                            geometry: {
                                type: 'LineString',
                                coordinates: remainingRoute
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Ошибка при обновлении маршрута:', e);
                }

                startMarker.setLngLat(currentPosition);

                if (trackingEnabled && remainingRoute.length > 1) {
                    const nextPoint = remainingRoute[1];
                    const bearing = getBearing(currentPosition, nextPoint);

                    map.easeTo({
                        center: currentPosition,
                        bearing: bearing,
                        pitch: 45,
                        duration: 1000
                    });
                }
            }

        },
        function (error) {
            console.error("Ошибка при получении геолокации:", error.message);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
        }
    );

    function drawTheRoad(lng, lat) {
        const input = document.querySelector('.svelte-bz0zu3 input');
        $(document).on('click', '.svelte-bz0zu3 button', function () {
            input.value = '';
            const event = new Event('input', { bubbles: true });
            input.dispatchEvent(event);
        });

        if (input) {
            input.value = inputValueSave;
            input.addEventListener('focus', () => {
                const currentValue = input.value.trim();
                if (currentValue.length > 0) {
                    const event = new Event('input', { bubbles: true });
                    input.dispatchEvent(event);
                }
            });
        }

        const end = [lng, lat];

        if (endMarker) endMarker.remove();

        endMarker = new maptilersdk.Marker({ color: '#1E90FF', draggable: true })
            .setLngLat(end)
            .addTo(map);

        endMarker.on('dragend', () => {
            let cloneMarker;
            setTimeout(() => {
                cloneMarker = $('.maplibregl-marker svg').eq(-1);
                const markerEl = $('.maplibregl-marker').eq(-1);
                $(markerEl).html(`<div class="loader"><img src="./Dual%20Ring@1x-1.0s-242px-242px.gif"></div>`);
            }, 0);

            const newLngLat = endMarker.getLngLat();
            drawTheRoad(newLngLat.lng, newLngLat.lat);

            fetch(`https://api.maptiler.com/geocoding/${newLngLat.lng},${newLngLat.lat}.json?key=uAItrm0npRJhGt3vgNDx`)
                .then(response => response.json())
                .then(data => {
                    if (data?.features?.length > 0) {
                        const fullAddress = data.features[0].place_name_ru;
                        const address = fullAddress.split(',')[0].trim();
                        const markerEl = $('.maplibregl-marker').eq(-1);
                        $(markerEl).html(cloneMarker);

                        const input = document.querySelector('.svelte-bz0zu3 input');
                        if (input) {
                            input.value = address;
                            input.focus();

                            const event = new Event('input', { bubbles: true });
                            input.dispatchEvent(event);
                        }
                    }
                })
                .catch(err => console.error('Ошибка при обратном геокодировании:', err));
        });

        const url = `https://router.project-osrm.org/route/v1/driving/${currentPosition[0]},${currentPosition[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`;

        fetch(url)
            .then(response => response.json())
            .then(data => {
                fullRouteCoords = data.routes[0].geometry.coordinates;
                routeReady = false;

                const routeGeoJSON = {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: fullRouteCoords
                    }
                };

                if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
                if (map.getSource(ROUTE_LAYER_ID)) map.removeSource(ROUTE_LAYER_ID);

                map.addSource(ROUTE_LAYER_ID, {
                    type: 'geojson',
                    data: routeGeoJSON
                });

                map.addLayer({
                    id: ROUTE_LAYER_ID,
                    type: 'line',
                    source: ROUTE_LAYER_ID,
                    layout: { 'line-cap': 'round', 'line-join': 'round' },
                    paint: {
                        'line-color': '#1E90FF',
                        'line-width': 5,
                        'line-opacity': 0.8
                    }
                });

                const bounds = fullRouteCoords.reduce(
                    (b, coord) => b.extend(coord),
                    new maptilersdk.LngLatBounds(fullRouteCoords[0], fullRouteCoords[0])
                );
                map.fitBounds(bounds, { padding: 50 });

                routeReady = true;
            });
    }

    function simulation(speed = 0.0005, interval = 100) {
        if (!routeReady || fullRouteCoords.length === 0) {
            console.warn("Маршрут не готов для симуляции.");
            return;
        }

        let index = 0;
        let progress = 0;

        function interpolate(a, b, t) {
            return [
                a[0] + (b[0] - a[0]) * t,
                a[1] + (b[1] - a[1]) * t
            ];
        }

        const intervalId = setInterval(() => {
            if (index >= fullRouteCoords.length - 1) {
                clearInterval(intervalId);
                console.log("Симуляция завершена.");
                return;
            }

            const from = fullRouteCoords[index];
            const to = fullRouteCoords[index + 1];
            progress += speed;

            if (progress >= 1) {
                index++;
                progress = 0;
            }

            const position = interpolate(from, to, progress);
            currentPosition = position;

            // Обновление линии маршрута
            const remainingRoute = fullRouteCoords.slice(index);
            if (map.getSource(ROUTE_LAYER_ID)) {
                map.getSource(ROUTE_LAYER_ID).setData({
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: remainingRoute
                    }
                });
            }

            // Обновляем маркер
            if (startMarker) startMarker.setLngLat(position);

            // Поворот камеры
            if (remainingRoute.length > 1) {
                const next = remainingRoute[1];
                const bearing = getBearing(position, next);
                map.easeTo({
                    center: position,
                    bearing: bearing,
                    pitch: 45,
                    duration: interval
                });
            }
        }, interval);
    }

});
