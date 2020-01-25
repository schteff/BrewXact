const sensor = require("ds18b20-raspi");
const jsonfile = require("jsonfile");
const bonjour = require("bonjour")();
const PushBullet = require("pushbullet");

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

// Use '/' to go to index.html via static middleware
const dataFile = "../data.json";
var dataFileArray = [];
jsonfile.readFile(dataFile, function(err, obj) {
  if (err) {
    dataFileArray.push({ time: new Date().getTime(), temps: getTemps() });
    saveDataFile();
  } else {
    dataFileArray = dataFileArray.concat(jsonfile.readFileSync(dataFile));
  }
});
const settingsFile = "../settings.json";
var settings = { minTemp: 62, maxTemp: 67 };
jsonfile.readFile(settingsFile, function(err, obj) {
  if (err) {
    dataFileArray.push({ time: new Date().getTime(), temps: getTemps() });
    saveDataFile();
  } else {
    settings = obj;
  }
});

function getTemps() {
  const temps = sensor.readAllC();
  if (temps.length == 0) {
    temps.push({ id: "foo1", t: 40 + new Date().getSeconds() });
    temps.push({ id: "foo2", t: 90 - new Date().getSeconds() });
  }
  return temps;
}

function saveDataFile() {
  jsonfile.writeFile(dataFile, dataFileArray, function(err) {
    if (err) console.error(err);
  });
}

/**
 * The loop reading and storing the temperature values
 */
var notificationSent = false;
setInterval(function() {
  const temps = getTemps();
  dataFileArray.push({ time: new Date().getTime(), temps: temps });
  saveDataFile();

  //Check if outside min/max
  if (settings && settings.minTemp && settings.notify && settings.pushBulletToken) {
    const tooColdTemps = temps.filter(t => t.t < settings.minTemp);
    const tooWarmTemps = temps.filter(t => t.t > settings.maxTemp);
    if (tooColdTemps.length > 0 || tooWarmTemps.length > 0) {
      if (!notificationSent) {
        const hotOrCold = tooColdTemps.length === 0 ? "warm" : "cold";
        const noteTitle = "Temperature too " + hotOrCold;
        const tempsOutOfRange = tooColdTemps.concat(tooWarmTemps);
        const noteBody = "Temp: " + tempsOutOfRange.map(s => s.t + "°C").join(" & ");
        const pusher = new PushBullet(settings.pushBulletToken);
        pusher.devices(function(error, response) {
          response.devices.forEach(device => {
            pusher.note(device.iden, noteTitle, noteBody, function(error, response) {
              console.log("Push sent successfully to device " + device.nickname);
            });
          });
        });
      }
      notificationSent = true;
    } else {
      notificationSent = false;
    }
  }
}, config.logInterval);

/**
 * Server/API endpoints
 */
app.get("/temps", function(req, res) {
  const temps = dataFileArray[dataFileArray.length - 1].temps;
  res.send(JSON.stringify(temps));
});

app.get("/init", function(req, res) {
  res.send(JSON.stringify(dataFileArray));
});

app.get("/clear", function(req, res) {
  //Backup old file
  jsonfile.writeFileSync("../data" + new Date().getTime() + ".json", dataFileArray);

  dataFileArray = [{ time: new Date().getTime(), temps: getTemps() }];
  saveDataFile();
  res.status(200);
  res.end();
});

app.get("/getSettings", function(req, res) {
  res.send(JSON.stringify(settings));
});

app.post("/saveSettings", function(req, res) {
  console.log("Saving settings " + JSON.stringify(req.body));
  jsonfile.writeFile(settingsFile, req.body, function(err) {
    if (err) {
      console.error(err);
      res.status(500);
      res.end();
    } else settings = req.body;
  });
  notificationSent = false;
  res.status(200);
  res.end();
});

// TODO and notify (via email/nodemailer?) when outside settings limits
