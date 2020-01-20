const sensor = require("ds18b20-raspi");
const jsonfile = require("jsonfile");
const bonjour = require("bonjour")();

const config = require("./config/config.js"), // import config variables
  port = config.port, // set the port
  express = require("express"), // use express as the framwork
  app = express(), // create the server using express
  path = require("path"); // utility module

app.use(express.static(path.join(__dirname, "public"))); // this middleware serves static files, such as .js, .img, .css files
app.use(express.json());

// Initialize server
var server = app.listen(port, function() {
  console.log("Listening on port %d", server.address().port);
});

bonjour.publish({ name: "BrewXact", type: "http", host: "brew", port: port });

// bonjour.find({ type: "http" }, function(service) {
//   console.log("Found an HTTP server:", service);
// });

// Use '/' to go to index.html via static middleware
const dataFile = "../data.json";
const settingsFile = "../settings.json";
var dataFileArray = [];
jsonfile.readFile(dataFile, function(err, obj) {
  if (err) {
    dataFileArray.push({ time: new Date().getTime(), temps: getTemps() });
    saveDataFile();
  } else {
    dataFileArray = dataFileArray.concat(jsonfile.readFileSync(dataFile));
  }
});

function getTemps() {
  const temps = sensor.readAllC();
  if (temps.length == 0) {
    temps.push({ id: "foo1", t: 30 + new Date().getSeconds() });
    temps.push({ id: "foo2", t: 90 - new Date().getSeconds() });
  }
  return temps;
}

app.get("/temps", function(req, res) {
  const temps = getTemps();
  dataFileArray.push({ time: new Date().getTime(), temps: temps });
  saveDataFile();
  res.send(JSON.stringify(temps));
});

app.get("/init", function(req, res) {
  dataFileArray.push({ time: new Date().getTime(), temps: getTemps() });
  saveDataFile();
  const json = JSON.stringify(dataFileArray);
  res.send(json);
});

app.get("/clear", function(req, res) {
  dataFileArray = [{ time: new Date().getTime(), temps: getTemps() }];
  saveDataFile();
  res.status(200);
  res.end();
});

app.get("/getSettings", function(req, res) {
  try {
    const settings = jsonfile.readFileSync(settingsFile);
    const json = JSON.stringify(settings);
    res.send(json);
  } catch (error) {
    // console.error(error);
    res.status(404);
    res.send("{}");
  }
});

app.post("/saveSettings", function(req, res) {
  console.log("Saving settings " + JSON.stringify(req.body));
  jsonfile.writeFile(settingsFile, req.body, function(err) {
    if (err) console.error(err);
  });
  res.status(200);
  res.end();
});

function saveDataFile() {
  jsonfile.writeFile(dataFile, dataFileArray, function(err) {
    if (err) console.error(err);
  });
}
//TODO run loop in background to save temp values without an active GUI,
// and notify (via email/nodemailer?) when outside settings limits
