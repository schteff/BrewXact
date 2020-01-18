const sensor = require("ds18b20-raspi");

const config = require("./config/config.js"), // import config variables
  port = config.port, // set the port
  express = require("express"), // use express as the framwork
  app = express(), // create the server using express
  path = require("path"); // utility module

app.use(express.static(path.join(__dirname, "public"))); // this middleware serves static files, such as .js, .img, .css files

// Initialize server
var server = app.listen(port, function() {
  console.log("Listening on port %d", server.address().port);
});

// Use '/' to go to index.html via static middleware

app.get("/temps", function(req, res) {
  const temps = sensor.readAllC();
  res.send(JSON.stringify(temps));
});
