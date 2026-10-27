// 내 컴퓨터에서 지도 앱을 열어 보기 위한 작은 서버
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const ROOT = __dirname;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png"
};

http.createServer(function (req, res) {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const filePath = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);

  // 이 폴더 밖의 파일은 보여 주지 않는다.
  if (!filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    res.end("열 수 없는 파일입니다.");
    return;
  }

  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("파일을 찾을 수 없습니다.");
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, function () {
  console.log("지도 앱이 켜졌어요! 브라우저에서 http://localhost:" + PORT + " 을 열어 보세요.");
  console.log("끄려면 이 창에서 Ctrl 키와 C 키를 함께 누르세요.");
});
