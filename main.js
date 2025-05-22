$(document).ready(function () {
    maptilersdk.config.apiKey = 'uAItrm0npRJhGt3vgNDx';

    let map;
    let startMarker;
    let endMarker = null;
    let currentPosition = [0, 0]; // [lng, lat]
    let initialized = false;
    let fullRouteCoords = [];
    let pendingSimulatedRoute = null;
    let routeLayerId = null;
    let inputValueSave;
    let trackingEnabled = false;

    $('#startBtn').on('click', function () {
        trackingEnabled = true;
        alert("Слежение включено!");

        $('.maplibregl-marker svg').eq(0).remove()
        $('.maplibregl-marker').eq(0).html(`<img class="bolide" src="./free-icon-racing-car-1505502.png"/>`)

        if (pendingSimulatedRoute && pendingSimulatedRoute.length > 0) {
            simulateMovementAlongRoute(pendingSimulatedRoute);
            pendingSimulatedRoute = null; // сбросить, чтобы не запускалось снова
        }
    });

    // 🔍 Функция для поиска ближайшей точки на маршруте
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

    function getBearing(from, to) { // 🔍 Функция для вычисления угла между двумя координатами (в градусах)
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
                })

                const gc = new maptilersdkMaptilerGeocoder.GeocodingControl({
                    country: ['KZ'], // ограничить поиск по стране
                    bbox: [57.005856, 50.1969322, 57.2762532, 50.3650833], // актобе
                    marker: false,
                    debounceSearch: 100,
                    // clearOnBlur: true
                });
                map.addControl(gc, 'top-left');

                gc.on('select', () => {
                    $('.marker-interactive').remove()
                })

                gc.on('pick', (e) => {
                    const fullAddress = e.feature.place_name; // язык
                    const address = fullAddress.split(',')[0].trim();

                    const input = document.querySelector('.svelte-bz0zu3 input');

                    const currentValue = input.value.trim();
                    if (currentValue.length > 0) {
                        inputValueSave = address
                    }

                    map.removeControl(gc, 'top-left'); // тут обновляю поисковик
                    $('.mapboxgl-ctrl-geocoder').remove()
                    map.addControl(gc, 'top-left')  // иначе не подсказываются адреса

                    drawTheRoad(e.feature.center[0], e.feature.center[1])

                })

                startMarker = new maptilersdk.Marker({color: '#f50'})
                    .setLngLat(currentPosition)
                    .addTo(map);

                initialized = true;

            } else {
            if (fullRouteCoords.length > 0 && map.getSource('route')) {
                const nearestIndex = findNearestIndex(currentPosition, fullRouteCoords);
                const remainingRoute = fullRouteCoords.slice(nearestIndex);

                // 🔹 1. Удалить пройденный маршрут
                map.getSource('route').setData({
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: remainingRoute
                    }
                });

                // 🔹 2. Переместить маркер уже после обновления маршрута
                startMarker.setLngLat(currentPosition);

                // 🔹 3. Двигаем карту (если включено слежение)
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
            } else {
                // Без маршрута — просто обновить позицию маркера
                startMarker.setLngLat(currentPosition);
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

        $(document).on('click', '.svelte-bz0zu3 button', function () { // очистить поисковик
            input.value = ''
            const event = new Event('input', {bubbles: true});
            input.dispatchEvent(event);
        });

        if (input) {
            input.value = inputValueSave; // устанавливаем адрес в поисковик

            input.addEventListener('focus', () => { // а тут при фокусе на ней показываем подсказки
                const currentValue = input.value.trim();
                if (currentValue.length > 0) {
                    const event = new Event('input', {bubbles: true});
                    input.dispatchEvent(event);
                }
            });
        }

        const end = [lng, lat];

        if (endMarker) endMarker.remove();

        endMarker = new maptilersdk.Marker({color: '#1E90FF', draggable: true}) // ← добавлен draggable: true
            .setLngLat(end)
            .addTo(map);

        // 🔁 слушаем окончание перетаскивания
        endMarker.on('dragend', () => {
            let cloneMarker;

            setTimeout(() => {
                // Поиск последнего маркера по классу
                cloneMarker = $('.maplibregl-marker svg').eq(-1)
                const markerEl = $('.maplibregl-marker').eq(-1); // или более точно: по позиции

                $(markerEl).html(`<div class="loader"><img src="./Dual%20Ring@1x-1.0s-242px-242px.gif"></div>`)

            }, 0);

            const newLngLat = endMarker.getLngLat();
            drawTheRoad(newLngLat.lng, newLngLat.lat); // перестроить маршрут
            let address

            // Выполняем обратное геокодирование через MapTiler
            fetch(`https://api.maptiler.com/geocoding/${newLngLat.lng},${newLngLat.lat}.json?key=uAItrm0npRJhGt3vgNDx`)
                .then(response => response.json())
                .then(data => {
                    if (data && data.features && data.features.length > 0) {
                        fullAddress = data.features[0].place_name_ru; // язык
                        address = fullAddress.split(',')[0].trim();
                        // alert(address)
                        // или вставить в элемент: $('#someElement').text(address);
                        // Поиск последнего маркера по классу
                        const markerEl = $('.maplibregl-marker').eq(-1);

                        $(markerEl).html(cloneMarker)

                        const input = document.querySelector('.svelte-bz0zu3 input');
                        if (input) {
                            input.value = address; // устанавливаем адрес в поисковик
                            input.focus()

                            if (inputValueSave === address) {
                                input.addEventListener('focus', () => { // а тут при фокусе на ней показываем подсказки
                                    const currentValue = input.value.trim();
                                    if (currentValue.length > 0) {
                                        const event = new Event('input', {bubbles: true});
                                        input.dispatchEvent(event);
                                    }
                                });
                            } else {

                                const currentValue = input.value.trim();
                                if (currentValue.length > 0) {
                                    const event = new Event('input', {bubbles: true});
                                    input.dispatchEvent(event);
                                }
                            }
                        }
                    }
                })
                .catch(err => console.error('Ошибка при обратном геокодировании:', err))
                .finally(() => {

                })
        });

        const url = `https://router.project-osrm.org/route/v1/driving/${currentPosition[0]},${currentPosition[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`;

        fetch(url)
            .then(response => response.json())
            .then(data => {
                fullRouteCoords = data.routes[0].geometry.coordinates;

                const routeGeoJSON = {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: fullRouteCoords
                    }
                };

                if (routeLayerId && map.getSource('route')) {
                    map.removeLayer(routeLayerId);
                    map.removeSource('route');
                }

                routeLayerId = 'route-' + Date.now();

                map.addSource('route', {
                    type: 'geojson',
                    data: routeGeoJSON
                });

                map.addLayer({
                    id: routeLayerId,
                    type: 'line',
                    source: 'route',
                    layout: {'line-cap': 'round', 'line-join': 'round'},
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
                map.fitBounds(bounds, {padding: 50});

                // симуляция
                pendingSimulatedRoute = fullRouteCoords;
            });
    }

    // ======= 🔄 Симуляция движения =======
    function simulateMovementAlongRoute(coords) {
        let i = 0;
        const totalPoints = coords.length;

        const interval = setInterval(() => {
            if (i >= totalPoints) {
                clearInterval(interval);
                return;
            }

            const lngLat = coords[i];
            const nextPoint = coords[Math.min(i + 1, totalPoints - 1)];

            const remainingCoords = coords.slice(i);

            // 🔹 1. Сначала обновим оставшуюся линию
            const updatedRouteGeoJSON = {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: remainingCoords
                }
            };

            if (map.getSource('route')) {
                map.getSource('route').setData(updatedRouteGeoJSON);
            }

            // 🔹 2. Затем переместим маркер
            currentPosition = lngLat;
            startMarker.setLngLat(lngLat);

            // 🔹 3. Потом переместим камеру
            const bearing = getBearing(lngLat, nextPoint);
            map.easeTo({
                center: lngLat,
                bearing: bearing,
                pitch: 45,
                duration: 300
            });

            i++;
        }, 1000); // скорость анимации
    }

});
