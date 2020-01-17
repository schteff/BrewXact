const http = require("http");
const sensor = require("ds18b20-raspi");

const hostname = "127.0.0.1";
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  const temps = sensor.readAllC();
  console.log(temps);

  res.end(JSON.stringify(temps));
});

server.listen(port, hostname, () => {
  console.log(`Temp server running at http://${hostname}:${port}/`);
});
