// 나만의 명소를 브라우저 저장 공간(localStorage)에 저장하고, 고치고, 지우는 도구
// 브라우저를 닫았다 다시 열어도 이 저장 공간에 넣은 내용은 남아 있다.
const STORAGE_KEY = "busan-map-my-places";
const NAME_MAX = 30;

// storage: 저장 공간 (브라우저에서는 window.localStorage)
// fixedPlaces: 고칠 수 없는 예시 명소 목록 (중복 검사에만 쓴다)
function createPlaceStore(storage, fixedPlaces) {
  let places = readAll();

  // 저장 공간에서 명소 목록 읽기. 망가진 내용이 있으면 빼고 읽는다.
  function readAll() {
    try {
      const list = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(list) ? list.filter(isValidPlace) : [];
    } catch (e) {
      return [];
    }
  }

  // 저장 공간에 명소 목록 쓰기. 성공하면 true를 돌려준다.
  function writeAll(list) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  }

  function isValidPlace(p) {
    return Boolean(p) &&
      typeof p.id === "string" &&
      typeof p.name === "string" && p.name.trim() !== "" &&
      Number.isFinite(p.lat) && Number.isFinite(p.lng);
  }

  // 띄어쓰기와 영어 대소문자는 달라도 같은 이름으로 본다.
  function sameName(a, b) {
    return a.replace(/\s+/g, "").toLowerCase() === b.replace(/\s+/g, "").toLowerCase();
  }

  // 위도·경도가 0.0001(약 10m)보다 가까우면 같은 위치로 본다.
  function sameSpot(a, b) {
    return Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lng - b.lng) < 0.0001;
  }

  function round6(n) {
    return Math.round(n * 1000000) / 1000000;
  }

  // 입력한 내용 검사하기. 문제가 있으면 { error }, 괜찮으면 정리한 값을 돌려준다.
  // exceptId: 수정할 때 자기 자신과는 비교하지 않도록 빼는 id
  function check(input, exceptId) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const lat = Number(input.lat);
    const lng = Number(input.lng);

    if (name === "") {
      return { error: "장소 이름을 입력해 주세요." };
    }
    if (name.length > NAME_MAX) {
      return { error: "장소 이름은 " + NAME_MAX + "자까지 쓸 수 있어요." };
    }
    if (input.lat === null || input.lat === undefined || input.lng === null || input.lng === undefined ||
        !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { error: "지도를 눌러 위치를 골라 주세요." };
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { error: "위치가 올바르지 않아요. 지도를 다시 눌러 주세요." };
    }

    const others = fixedPlaces.concat(places).filter(function (p) {
      return p.id !== exceptId;
    });
    const nameTwin = others.find(function (p) { return sameName(p.name, name); });
    if (nameTwin) {
      return { error: "같은 이름의 명소가 이미 있어요: " + nameTwin.name };
    }
    const spotTwin = others.find(function (p) { return sameSpot(p, { lat: lat, lng: lng }); });
    if (spotTwin) {
      return { error: "같은 위치에 이미 명소가 있어요: " + spotTwin.name };
    }

    return { name: name, lat: round6(lat), lng: round6(lng) };
  }

  function makeId() {
    return "my-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  const SAVE_FAILED = "브라우저에 저장하지 못했어요. 시크릿(개인정보 보호) 창이라면 일반 창에서 열어 주세요.";

  return {
    // 내 명소 목록 (복사본)
    list: function () {
      return places.map(function (p) { return Object.assign({}, p); });
    },

    get: function (id) {
      const found = places.find(function (p) { return p.id === id; });
      return found ? Object.assign({}, found) : null;
    },

    add: function (input) {
      const checked = check(input, null);
      if (checked.error) return { ok: false, message: checked.error };

      const place = { id: makeId(), name: checked.name, lat: checked.lat, lng: checked.lng };
      const next = places.concat([place]);
      if (!writeAll(next)) return { ok: false, message: SAVE_FAILED };
      places = next;
      return { ok: true, place: Object.assign({}, place) };
    },

    update: function (id, input) {
      if (!places.some(function (p) { return p.id === id; })) {
        return { ok: false, message: "고칠 명소를 찾지 못했어요." };
      }
      const checked = check(input, id);
      if (checked.error) return { ok: false, message: checked.error };

      const next = places.map(function (p) {
        return p.id === id ? { id: id, name: checked.name, lat: checked.lat, lng: checked.lng } : p;
      });
      if (!writeAll(next)) return { ok: false, message: SAVE_FAILED };
      places = next;
      return { ok: true };
    },

    remove: function (id) {
      if (!places.some(function (p) { return p.id === id; })) {
        return { ok: false, message: "지울 명소를 찾지 못했어요." };
      }
      const next = places.filter(function (p) { return p.id !== id; });
      if (!writeAll(next)) return { ok: false, message: SAVE_FAILED };
      places = next;
      return { ok: true };
    }
  };
}

// 자동 시험(test 폴더)에서 이 파일을 불러 쓸 수 있게 한다. 브라우저에서는 쓰이지 않는다.
if (typeof module !== "undefined") {
  module.exports = { createPlaceStore: createPlaceStore, STORAGE_KEY: STORAGE_KEY };
}
