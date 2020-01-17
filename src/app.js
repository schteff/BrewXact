const http = require("http");
const sensor = require("ds18b20-raspi");

const hostname = "127.0.0.1";
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain");
  const temps = sensor.readAllC();
  console.log(temps);

  res.end("Hello World " + temps);
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
