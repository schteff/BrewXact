const http = require("http");
const sensor = require("ds18b20-raspi");
const fs = require("fs");

const hostname = "127.0.0.1";
const port = 3000;

fs.readFile("./index.html", function(err, html) {
  if (err) {
    throw err;
  }
  http
    .createServer(function(request, response) {
      console.log(request.url);
      if (request.url === "/temps") {
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json");
        const temps = sensor.readAllC();
        console.log(temps);
        response.end(JSON.stringify(temps));
      } else {
        response.writeHeader(200, { "Content-Type": "text/html" });
        response.write(html);
        response.end();
        console.log("Serving html");
      }
    })
    .listen(port, hostname, () => {
      console.log(`Temp server running at http://${hostname}:${port}/`);
    });
});
