// 나만의 명소 저장·수정·삭제가 잘 되는지 자동으로 시험한다.
// 실행: npm test
const test = require("node:test");
const assert = require("node:assert");
const { createPlaceStore, STORAGE_KEY } = require("../storage.js");

// 브라우저의 localStorage 흉내
function fakeStorage() {
  const data = {};
  return {
    getItem: function (key) { return key in data ? data[key] : null; },
    setItem: function (key, value) { data[key] = String(value); }
  };
}

const EXAMPLES = [
  { id: "haeundae", name: "해운대해수욕장", lat: 35.1587, lng: 129.1604 }
];

test("새 명소를 저장하면 목록에 생긴다", function () {
  const store = createPlaceStore(fakeStorage(), EXAMPLES);
  const result = store.add({ name: " 태종대 ", lat: 35.0533, lng: 129.0876 });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(store.list().length, 1);
  assert.strictEqual(store.list()[0].name, "태종대");
});

test("브라우저를 다시 열어도(새로 읽어도) 저장한 명소가 남아 있다", function () {
  const storage = fakeStorage();
  createPlaceStore(storage, EXAMPLES).add({ name: "태종대", lat: 35.0533, lng: 129.0876 });
  const reopened = createPlaceStore(storage, EXAMPLES);
  assert.strictEqual(reopened.list().length, 1);
  assert.strictEqual(reopened.list()[0].name, "태종대");
});

test("이름과 위치를 고칠 수 있다", function () {
  const storage = fakeStorage();
  const store = createPlaceStore(storage, EXAMPLES);
  const id = store.add({ name: "태종대", lat: 35.0533, lng: 129.0876 }).place.id;
  const result = store.update(id, { name: "태종대 전망대", lat: 35.05, lng: 129.08 });
  assert.strictEqual(result.ok, true);
  const saved = createPlaceStore(storage, EXAMPLES).get(id);
  assert.strictEqual(saved.name, "태종대 전망대");
  assert.strictEqual(saved.lat, 35.05);
  assert.strictEqual(saved.lng, 129.08);
});

test("이름만 고치고 위치는 그대로 둬도 된다 (자기 자신과는 중복이 아님)", function () {
  const store = createPlaceStore(fakeStorage(), EXAMPLES);
  const id = store.add({ name: "태종대", lat: 35.0533, lng: 129.0876 }).place.id;
  assert.strictEqual(store.update(id, { name: "태종대 공원", lat: 35.0533, lng: 129.0876 }).ok, true);
});

test("명소를 지우면 목록과 저장 공간에서 사라진다", function () {
  const storage = fakeStorage();
  const store = createPlaceStore(storage, EXAMPLES);
  const id = store.add({ name: "태종대", lat: 35.0533, lng: 129.0876 }).place.id;
  assert.strictEqual(store.remove(id).ok, true);
  assert.strictEqual(store.list().length, 0);
  assert.strictEqual(createPlaceStore(storage, EXAMPLES).list().length, 0);
});

test("이름이 비어 있으면 저장하지 않는다", function () {
  const store = createPlaceStore(fakeStorage(), EXAMPLES);
  const result = store.add({ name: "   ", lat: 35.0533, lng: 129.0876 });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.message, "장소 이름을 입력해 주세요.");
});

test("위치를 고르지 않으면 저장하지 않는다", function () {
  const store = createPlaceStore(fakeStorage(), EXAMPLES);
  const result = store.add({ name: "태종대", lat: null, lng: null });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.message, "지도를 눌러 위치를 골라 주세요.");
});

test("같은 이름은 띄어쓰기가 달라도 중복으로 막는다 (예시 명소 포함)", function () {
  const store = createPlaceStore(fakeStorage(), EXAMPLES);
  assert.strictEqual(store.add({ name: "해운대 해수욕장", lat: 35.2, lng: 129.2 }).ok, false);
  store.add({ name: "태종대", lat: 35.0533, lng: 129.0876 });
  assert.strictEqual(store.add({ name: "태종대", lat: 35.1, lng: 129.1 }).ok, false);
  assert.strictEqual(store.list().length, 1);
});

test("거의 같은 위치(약 10m 안)는 중복으로 막는다", function () {
  const store = createPlaceStore(fakeStorage(), EXAMPLES);
  const result = store.add({ name: "해운대 바닷가", lat: 35.15871, lng: 129.16042 });
  assert.strictEqual(result.ok, false);
  assert.match(result.message, /같은 위치/);
});

test("수정할 때도 다른 명소와 같은 이름이면 막는다", function () {
  const store = createPlaceStore(fakeStorage(), EXAMPLES);
  const id = store.add({ name: "태종대", lat: 35.0533, lng: 129.0876 }).place.id;
  assert.strictEqual(store.update(id, { name: "해운대해수욕장", lat: 35.0533, lng: 129.0876 }).ok, false);
  assert.strictEqual(store.get(id).name, "태종대");
});

test("저장 공간 내용이 망가져 있어도 앱이 멈추지 않는다", function () {
  const storage = fakeStorage();
  storage.setItem(STORAGE_KEY, "{망가진 내용");
  assert.deepStrictEqual(createPlaceStore(storage, EXAMPLES).list(), []);
});

test("저장 공간을 쓸 수 없으면 안내 문구를 돌려준다", function () {
  const broken = {
    getItem: function () { return null; },
    setItem: function () { throw new Error("가득 참"); }
  };
  const store = createPlaceStore(broken, EXAMPLES);
  const result = store.add({ name: "태종대", lat: 35.0533, lng: 129.0876 });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(store.list().length, 0);
});
