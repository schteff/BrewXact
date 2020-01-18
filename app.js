const sensor = require("ds18b20-raspi");
const jsonfile = require("jsonfile");

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
const file = "../data.json";
var fileArray = [];
jsonfile.readFile(file, function(err, obj) {
  if (err) {
    fileArray.push({ time: new Date().getTime(), temps: sensor.readAllC() });
    jsonfile.writeFile(file, fileArray, function(err2) {
      if (err2) console.error(err2);
    });
  } else {
    fileArray = fileArray.concat(jsonfile.readFileSync(file));
  }
});

app.get("/temps", function(req, res) {
  const temps = sensor.readAllC();
  fileArray.push({ time: new Date().getTime(), temps: temps });
  jsonfile.writeFile(file, fileArray, function(err) {
    if (err) console.error(err);
  });

  res.send(JSON.stringify(temps));
});

app.get("/init", function(req, res) {
  fileArray.push({ time: new Date().getTime(), temps: sensor.readAllC() });
  jsonfile.writeFile(file, fileArray, function(err) {
    if (err) console.error(err);
  });

  res.send(JSON.stringify(fileArray));
});

app.get("/clear", function(req, res) {
  fileArray = [{ time: new Date().getTime(), temps: sensor.readAllC() }];
  jsonfile.writeFile(file, fileArray, function(err) {
    if (err) console.error(err);
  });

  res.status(200);
  res.end();
});
