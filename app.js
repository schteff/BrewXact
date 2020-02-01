const sensor = require("ds18b20-raspi");
const jsonfile = require("jsonfile");
const bonjour = require("bonjour")();
const PushBullet = require("pushbullet");
const request = require("request");
const git = require("simple-git")();

const config = require("./config/config.js"), // import config variables
  port = config.port, // set the port
  express = require("express"), // use express as the framwork
  app = express(), // create the server using express
  path = require("path"); // utility module

const exec = require("child_process").exec;

// Create shutdown function
function shutdown(callback) {
  exec("shutdown now", (error, stdout, stderr) => callback(stdout));
}

function reboot(callback) {
  exec("shutdown -r now", (error, stdout, stderr) => callback(stdout));
}

app.use(express.static(path.join(__dirname, "public"))); // this middleware serves static files, such as .js, .img, .css files
app.use(express.json());

// Initialize server
var server = app.listen(port, function() {
  console.log("Listening on port %d", server.address().port);
});

/**
 * Publish the app on local dns using bonjour
 */
bonjour.publish({ name: "BrewXact", type: "http", host: "brew", port: port });

function saveDataFile() {
  jsonfile.writeFile(dataFile, dataFileArray, err => (err ? console.error(err) : null));
}
/**
 * Read the data file if it exists
 */
const dataFile = "../data.json";
var dataFileArray = [];
jsonfile.readFile(dataFile, (err, obj) => {
  if (err) {
    dataFileArray.push({ time: new Date().getTime(), temps: getTemps() });
    saveDataFile();
  } else {
    dataFileArray = dataFileArray.concat(jsonfile.readFileSync(dataFile));
  }
});
/**
 * Read the settings file if it exists
 */
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

function lastReading() {
  return dataFileArray[dataFileArray.length - 1];
}

/**
 * The loop reading and storing the temperature values to the file / array
 */
var notificationSent = false;
setInterval(() => readTempAndCheck(), config.logInterval);
function readTempAndCheck() {
  const temps = getTemps();
  dataFileArray.push({ time: new Date().getTime(), temps: temps });
  saveDataFile();

  //Check if outside min/max
  if (settings && settings.minTemp && settings.notify && settings.pushBulletToken) {
    const tooColdTemps = temps.filter(t => t.t < settings.minTemp);
    const tooWarmTemps = temps.filter(t => t.t > settings.maxTemp);
    const outsideRange = tooColdTemps.length > 0 || tooWarmTemps.length > 0;
    if (outsideRange && !notificationSent) {
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
    notificationSent = outsideRange;
  }
}

/**
 * Logging values to brewfather
 */

function trySendLastReadingToBrewfather() {
  if (settings.logToBrewfather && settings.brewfatherStreamUrl) {
    var index = 0;
    const temps = lastReading();
    settings.customNames.forEach(name => {
      const brewfatherData = {
        name: "Temp sensor " + index,
        temp: temps.temps[index].t,
        temp_unit: "C", // C, F, K
        comment: "Temperature reading",
        beer: name
      };

      request.post(settings.brewfatherStreamUrl, { json: brewfatherData }, (error, response, body) => {
        if (!error && response.statusCode == 200) {
          console.log("Successful logging temp sensor " + index + " to brewfather");
        } else if (error) {
          console.error(error);
        }
      });

      index++;
    });
  }
}
//Try logging at upstart
setTimeout(() => {
  trySendLastReadingToBrewfather();
  setInterval(() => trySendLastReadingToBrewfather(), 900000); //And then every 15 minutes
}, 5000); //After 5 seconds

/**
 * Server/API endpoints
 */
app.get("/temps", (req, res) => res.send(JSON.stringify(lastReading())));
app.get("/init", (req, res) => res.send(JSON.stringify(dataFileArray)));
app.get("/clear", (req, res) => {
  //Backup old file
  jsonfile.writeFileSync("../data" + new Date().getTime() + ".json", dataFileArray);

  dataFileArray = [{ time: new Date().getTime(), temps: getTemps() }];
  saveDataFile();
  res.status(200);
  res.end();
});
app.get("/getSettings", (req, res) => res.send(JSON.stringify(settings)));
app.post("/saveSettings", (req, res) => {
  console.log("Saving settings " + JSON.stringify(req.body));

  const oldLogToBrewfather = settings.logToBrewfather;

  jsonfile.writeFile(settingsFile, req.body, function(err) {
    if (err) {
      console.error(err);
      res.status(500);
      res.end();
    } else {
      settings = req.body;

      //If brewfather logging was switched to on from off, send a value
      if (!oldLogToBrewfather && settings.logToBrewfather) {
        trySendLastReadingToBrewfather();
      }
    }
  });
  notificationSent = false;
  res.status(200);
  res.end();
});
app.post("/shutdown", (req, res) => {
  console.log("Shutting down");
  shutdown(function(output) {
    console.log(output);
    res.status(200);
    res.end();
  });
});
app.post("/reboot", (req, res) => {
  console.log("Rebooting");
  reboot(function(output) {
    console.log(output);
    res.status(200);
    res.end();
  });
});
app.post("/update", (req, res) => {
  console.log("Running GIT PULL");
  git.pull((err, update) => {
    if (update && update.summary.changes) {
      require("child_process").exec("npm restart");
    }
  });
  res.status(200);
  res.end();
});
