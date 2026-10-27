// node_modules 안의 Leaflet 파일을 vendor/leaflet 폴더로 복사한다.
// 이렇게 하면 다른 사이트(CDN)에서 불러오지 않고 내 파일로 지도를 쓸 수 있다.
const fs = require("fs");
const path = require("path");

const from = path.join(__dirname, "..", "node_modules", "leaflet", "dist");
const to = path.join(__dirname, "..", "vendor", "leaflet");

fs.mkdirSync(to, { recursive: true });
fs.copyFileSync(path.join(from, "leaflet.js"), path.join(to, "leaflet.js"));
fs.copyFileSync(path.join(from, "leaflet.css"), path.join(to, "leaflet.css"));
fs.cpSync(path.join(from, "images"), path.join(to, "images"), { recursive: true });

console.log("Leaflet 파일을 vendor/leaflet 폴더에 복사했습니다.");
