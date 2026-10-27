// 처음 화면에 보일 부산의 가운데 위치와 확대 수준
const BUSAN_CENTER = [35.14, 129.08];
const START_ZOOM = 12;

// 1. 지도 만들기
const map = L.map("map").setView(BUSAN_CENTER, START_ZOOM);

// 2. OpenStreetMap 지도 그림 깔기
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자'
}).addTo(map);

// 3. 말풍선에 들어갈 내용 만들기 (이름, 위도, 경도)
function makePopup(place) {
  const box = document.createElement("div");

  const name = document.createElement("p");
  name.className = "popup-name";
  name.textContent = place.name;

  const coord = document.createElement("p");
  coord.className = "popup-coord";
  coord.textContent = "위도: " + place.lat.toFixed(4) + " / 경도: " + place.lng.toFixed(4);

  box.append(name, coord);
  return box;
}

// 4. 장소마다 핀 꽂기
// markers에 핀을 id별로 모아 둔다. 다음 단계(거리 계산)에서 꺼내 쓸 수 있다.
const markers = {};

PLACES.forEach(function (place) {
  markers[place.id] = L.marker([place.lat, place.lng])
    .addTo(map)
    .bindPopup(makePopup(place));
});

// 화면 크기(컴퓨터·휴대전화)에 맞춰 모든 핀이 한눈에 보이도록 맞춘다.
if (PLACES.length > 0) {
  const bounds = L.latLngBounds(PLACES.map(function (place) {
    return [place.lat, place.lng];
  }));
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: START_ZOOM });
}

document.getElementById("place-count").textContent = PLACES.length;

// 다음 단계: 두 장소를 골라 거리를 보여 주는 기능을 여기 아래에 추가한다.
