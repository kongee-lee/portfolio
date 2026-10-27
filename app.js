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

// 3. 나만의 명소 저장소 (브라우저의 localStorage에 저장한다)
function getBrowserStorage() {
  try {
    return window.localStorage;
  } catch (e) {
    return null;
  }
}

const store = createPlaceStore(getBrowserStorage(), PLACES);

// 지도에 보일 모든 명소 = 예시 명소 + 나만의 명소
function allPlaces() {
  return PLACES.concat(store.list().map(function (p) {
    return Object.assign({ mine: true }, p);
  }));
}

function coordText(lat, lng) {
  return "위도: " + lat.toFixed(4) + " / 경도: " + lng.toFixed(4);
}

// 4. 말풍선에 들어갈 내용 만들기 (이름, 위도, 경도)
function makePopup(place) {
  const box = document.createElement("div");

  const name = document.createElement("p");
  name.className = "popup-name";
  name.textContent = place.name;

  const coord = document.createElement("p");
  coord.className = "popup-coord";
  coord.textContent = coordText(place.lat, place.lng);

  box.append(name, coord);

  if (place.mine) {
    const tag = document.createElement("p");
    tag.className = "popup-tag";
    tag.textContent = "나만의 명소";
    box.append(tag);
  }
  return box;
}

// 5. 장소마다 핀 꽂기
// markers에 핀을 id별로 모아 둔다. 다음 단계(거리 계산)에서 꺼내 쓸 수 있다.
const markerLayer = L.layerGroup().addTo(map);
let markers = {};

function drawMarkers() {
  markerLayer.clearLayers();
  markers = {};
  allPlaces().forEach(function (place) {
    markers[place.id] = L.marker([place.lat, place.lng])
      .addTo(markerLayer)
      .bindPopup(makePopup(place));
  });
}

// 6. 등록·수정 칸
const nameInput = document.getElementById("place-name");
const pickedCoord = document.getElementById("picked-coord");
const formTitle = document.getElementById("form-title");
const formMessage = document.getElementById("form-message");
const saveBtn = document.getElementById("save-btn");
const cancelBtn = document.getElementById("cancel-btn");
const myList = document.getElementById("my-list");

let editingId = null; // 수정 중인 명소의 id (새로 등록할 때는 null)
let picked = null;    // 지도에서 고른 위치 { lat, lng }
let pickMarker = null; // 고른 위치를 보여 주는 주황색 동그라미

function showMessage(text, kind) {
  formMessage.textContent = text;
  formMessage.className = "message" + (kind ? " " + kind : "");
}

function showPicked() {
  if (!picked) {
    pickedCoord.textContent = "아직 고르지 않았어요. 지도를 눌러 주세요.";
    pickedCoord.classList.remove("ready");
    if (pickMarker) {
      map.removeLayer(pickMarker);
      pickMarker = null;
    }
    return;
  }
  pickedCoord.textContent = coordText(picked.lat, picked.lng);
  pickedCoord.classList.add("ready");
  if (pickMarker) {
    pickMarker.setLatLng([picked.lat, picked.lng]);
  } else {
    pickMarker = L.circleMarker([picked.lat, picked.lng], {
      radius: 10,
      color: "#ea580c",
      fillColor: "#fb923c",
      fillOpacity: 0.7
    }).addTo(map);
  }
}

// 지도를 누르면 그 위치의 위도·경도를 가져온다.
map.on("click", function (e) {
  picked = { lat: e.latlng.lat, lng: e.latlng.lng };
  showPicked();
  showMessage("위치를 골랐어요. 이름과 위치를 확인하고 저장을 누르세요.", "");
});

function resetForm() {
  editingId = null;
  picked = null;
  nameInput.value = "";
  formTitle.textContent = "새 명소 등록";
  saveBtn.textContent = "저장";
  showPicked();
}

function save() {
  const input = {
    name: nameInput.value,
    lat: picked ? picked.lat : null,
    lng: picked ? picked.lng : null
  };
  const result = editingId ? store.update(editingId, input) : store.add(input);

  if (!result.ok) {
    showMessage(result.message, "error");
    return;
  }
  const doneText = editingId ? "고친 내용을 저장했어요." : "새 명소를 저장했어요.";
  resetForm();
  render();
  showMessage(doneText, "success");
}

function startEdit(id) {
  const place = store.get(id);
  if (!place) return;
  editingId = id;
  nameInput.value = place.name;
  picked = { lat: place.lat, lng: place.lng };
  formTitle.textContent = "명소 수정";
  saveBtn.textContent = "수정 저장";
  showPicked();
  map.panTo([place.lat, place.lng]);
  showMessage("이름을 고치거나 지도를 눌러 위치를 바꾼 뒤 수정 저장을 누르세요.", "");
  document.getElementById("form-card").scrollIntoView({ behavior: "smooth", block: "start" });
}

function removePlace(id) {
  const place = store.get(id);
  if (!place) return;
  if (!window.confirm("'" + place.name + "' 명소를 지울까요?")) return;

  const result = store.remove(id);
  if (!result.ok) {
    showMessage(result.message, "error");
    return;
  }
  if (editingId === id) resetForm();
  render();
  showMessage("명소를 지웠어요.", "success");
}

saveBtn.addEventListener("click", save);

cancelBtn.addEventListener("click", function () {
  resetForm();
  showMessage("", "");
});

nameInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") save();
});

// 7. 나만의 명소 목록 그리기
function renderList() {
  const mine = store.list();
  myList.replaceChildren();

  mine.forEach(function (place) {
    const item = document.createElement("li");
    item.className = "place-item";

    const info = document.createElement("div");
    const name = document.createElement("p");
    name.className = "place-name";
    name.textContent = place.name;
    const coord = document.createElement("p");
    coord.className = "place-coord";
    coord.textContent = coordText(place.lat, place.lng);
    info.append(name, coord);

    const buttons = document.createElement("div");
    buttons.className = "item-buttons";
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn small";
    editBtn.textContent = "수정";
    editBtn.dataset.action = "edit";
    editBtn.dataset.id = place.id;
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn small danger";
    delBtn.textContent = "삭제";
    delBtn.dataset.action = "delete";
    delBtn.dataset.id = place.id;
    buttons.append(editBtn, delBtn);

    item.append(info, buttons);
    myList.append(item);
  });

  document.getElementById("my-count").textContent = mine.length;
  document.getElementById("empty-text").hidden = mine.length > 0;
}

myList.addEventListener("click", function (e) {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.dataset.action === "edit") startEdit(btn.dataset.id);
  if (btn.dataset.action === "delete") removePlace(btn.dataset.id);
});

function render() {
  drawMarkers();
  renderList();
  document.getElementById("place-count").textContent = allPlaces().length;
}

render();

// 화면 크기(컴퓨터·휴대전화)에 맞춰 예시 명소가 한눈에 보이도록 맞춘다.
if (PLACES.length > 0) {
  const bounds = L.latLngBounds(PLACES.map(function (place) {
    return [place.lat, place.lng];
  }));
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: START_ZOOM });
}

// 다음 단계: 두 장소를 골라 거리를 보여 주는 기능을 여기 아래에 추가한다.
// allPlaces()로 모든 명소를, markers[id]로 각 핀을 꺼내 쓸 수 있다.
