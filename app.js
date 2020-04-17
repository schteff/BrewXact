const sensor = require("ds18b20-raspi");
const jsonfile = require("jsonfile");
const bonjour = require("bonjour")();
const PushBullet = require("pushbullet");
const request = require("request");
const git = require("simple-git")();
const exec = require("child_process").exec;
const siftttwebhooks = require("simple-ifttt-webhooks");

const config = require("./config/config.js"), // import config variables
  port = config.port, // set the port
  express = require("express"), // use express as the framwork
  app = express(), // create the server using express
  path = require("path"); // utility module

// Create shutdown function
function shutdown(callback) {
  exec("shutdown now", (error, stdout, stderr) => {
    if (error) console.error(error);
    callback(stdout);
  });
}

function reboot(callback) {
  exec("shutdown -r now", (error, stdout, stderr) => {
    if (error) console.error(error);
    callback(stdout);
  });
}

exec("npm install", (error, stdout) => (error ? console.error(error) : console.log(stdout)));

app.use(express.static(path.join(__dirname, "public"))); // this middleware serves static files, such as .js, .img, .css files
app.use(express.json());

// Initialize server
var server = app.listen(port, function () {
  console.log("Listening on port %d", server.address().port);
});

/**
 * Publish the app on local dns using bonjour
 */
bonjour.publish({ name: "BrewXact", type: "http", host: "brew", port: port });

function saveDataFile() {
  jsonfile.writeFile(dataFile, dataFileArray, (err) => (err ? console.error(err) : null));
}
/**
 * Read the data file if it exists
 */
const dataFile = "../data.json";
var dataFileArray = [];
jsonfile.readFile(dataFile, (err, obj) => {
  if (err) {
    dataFileArray.push(getDataFileArrayItem());
  } else {
    dataFileArray = obj.concat(dataFileArray);
  }
  saveDataFile();
});
/**
 * Read the settings file if it exists
 */
const settingsFile = "../settings.json";
var settings = { minTemp: 62, maxTemp: 67, logInterval: config.standardLogInterval };
jsonfile.readFile(settingsFile, function (err, obj) {
  if (err) {
    console.error(err);
  } else {
    settings = obj;
  }
});

function getTemps() {
  const temps = sensor.readAllC();
  if (temps.length == 0) {
    //Mock values
    temps.push({ id: "foo1", t: 40 + new Date().getSeconds() });
    temps.push({ id: "foo2", t: 90 - new Date().getSeconds() });
  }
  return temps;
}

function lastReading() {
  return dataFileArray[dataFileArray.length - 1];
}

function getDataFileArrayItem(temps) {
  return { time: new Date().getTime(), temps: temps ? temps : getTemps(), iftttState: lastIftttTempState };
}

/**
 * The loop reading and storing the temperature values to the file / array
 */
var notificationSent = false;
var logInterval = settings.logInterval;
var logVar = setInterval(() => readTempAndCheck(), settings.logInterval);
var lastIftttTempState = "unknown";
var lastIftttTempStateChange = 0;
console.log("Starting logging with interval " + logInterval);
function readTempAndCheck() {
  const temps = getTemps();
  dataFileArray.push(getDataFileArrayItem(temps));
  saveDataFile();

  //Check if outside min/max
  if (settings.notify && settings.pushBulletToken) {
    const tooColdTemps = temps.filter((t) => t.t < settings.minTemp);
    const tooWarmTemps = temps.filter((t) => t.t > settings.maxTemp);
    const outsideRange = tooColdTemps.length > 0 || tooWarmTemps.length > 0;
    if (outsideRange && !notificationSent) {
      const hotOrCold = tooColdTemps.length === 0 ? "warm" : "cold";
      const noteTitle = "Temperature too " + hotOrCold;
      const tempsOutOfRange = tooColdTemps.concat(tooWarmTemps);
      const noteBody = "Temp: " + tempsOutOfRange.map((s) => s.t + "°C").join(" & ");
      push(noteTitle, noteBody);
    }
    notificationSent = outsideRange;
  }
}

function push(noteTitle, noteBody) {
  const pusher = new PushBullet(settings.pushBulletToken);
  pusher.devices(function (error, response) {
    response.devices.forEach((device) => {
      pusher.note(device.iden, noteTitle, noteBody, function (error, response) {
        console.log("Push sent successfully to device " + device.nickname);
      });
    });
  });
}

setInterval(() => tempController(), 5000);
function tempController() {
  if (settings.iftttEnabled && settings.iftttWebhooksKey) {
    const temps = getTemps();
    const sum = temps.map((t) => (t.t ? t.t : 0)).reduce((acc, cur) => (cur += acc));
    const count = temps.filter((t) => t.t).length;
    if (count === 0) {
      console.log("No temp found, doing nothing...");
      if (settings.notify && settings.pushBulletToken) {
        push("No temperature detected!", "Could not find any sensors!");
      }
      return;
    }
    const avgTemp = sum / count;
    if (avgTemp < 20) {
      console.log("missing data? sum: " + sum + " avg: " + avgTemp);
      console.log(temps);
    }
    const targetTemp = (settings.minTemp + settings.maxTemp) / 2;
    const belowMin = avgTemp < settings.minTemp + 0;
    const aboveMax = avgTemp > settings.maxTemp + 0;
    const aboveTarget = avgTemp > targetTemp + 0.1;
    const belowTarget = avgTemp < targetTemp - 0.1;

    // console.log(
    //   "avgTemp: " +
    //     avgTemp +
    //     " targetTemp: " +
    //     targetTemp +
    //     " belowMin: " +
    //     belowMin +
    //     " aboveMax: " +
    //     aboveMax +
    //     " aboveTarget: " +
    //     aboveTarget +
    //     " belowTarget: " +
    //     belowTarget +
    //     " lastIftttTempState: " +
    //     lastIftttTempState
    // );
    const isHeating = lastIftttTempState === "heating";
    const isCooling = lastIftttTempState === "cooling";
    const lastChangeWasLongAgo = new Date().getTime() - lastIftttTempStateChange > 15 * 60 * 1000;
    if (aboveTarget && isHeating) {
      iftttCool(avgTemp, targetTemp); //Cool because just went above target
    } else if (belowTarget && isCooling) {
      iftttHeat(avgTemp, targetTemp); //Heat because just went below target
    } else if (belowMin && (!isHeating || lastChangeWasLongAgo)) {
      iftttHeat(avgTemp, targetTemp); //Heat because below min
    } else if (aboveMax && (!isCooling || lastChangeWasLongAgo)) {
      iftttCool(avgTemp, targetTemp); //Cool because above max
    }
  }
}

async function iftttHeat(avgTemp, targetTemp) {
  const res = await siftttwebhooks.sendRequest(settings.iftttLowTempEventName, settings.iftttWebhooksKey, { value1: avgTemp });
  console.log("Heating. avgTemp: " + avgTemp + " targetTemp: " + targetTemp + " lastState: " + lastIftttTempState + " newState: heating");
  lastIftttTempState = "heating";
  lastIftttTempStateChange = new Date().getTime();
}

async function iftttCool(avgTemp, targetTemp) {
  const res = await siftttwebhooks.sendRequest(settings.iftttHighTempEventName, settings.iftttWebhooksKey, { value1: avgTemp });
  console.log("Cooling. avgTemp: " + avgTemp + " targetTemp: " + targetTemp + " lastState: " + lastIftttTempState + " newState: cooling");
  lastIftttTempState = "cooling";
  lastIftttTempStateChange = new Date().getTime();
}

/**
 * Logging values to brewfather
 */

function trySendLastReadingToBrewfather() {
  if (settings.logToBrewfather && settings.brewfatherStreamUrl) {
    var index = 0;
    const temps = lastReading();
    settings.customNames.forEach((name) => {
      const brewfatherData = {
        name: "Temp sensor " + index,
        temp: temps.temps[index].t,
        temp_unit: "C", // C, F, K
        comment: "Temperature reading",
        beer: name,
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
  console.log("Clearing history");
  //Backup old file
  jsonfile.writeFileSync("../data" + new Date().getTime() + ".json", dataFileArray);
  console.log("Old history saved to backup file.");

  dataFileArray = [getDataFileArrayItem()];
  saveDataFile();
  res.status(200);
  res.end();
});
app.get("/getSettings", (req, res) => res.send(JSON.stringify(settings)));
app.post("/saveSettings", (req, res) => {
  console.log("Saving settings " + JSON.stringify(req.body));

  const oldLogToBrewfather = settings.logToBrewfather;

  jsonfile.writeFile(settingsFile, req.body, function (err) {
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

      if (settings.logInterval != logInterval) {
        logInterval = settings.logInterval;
        clearInterval(logVar);
        console.log("Restarting logging with interval " + logInterval);
        logVar = setInterval(() => readTempAndCheck(), settings.logInterval);
      }
    }
  });
  notificationSent = false;
  res.status(200);
  res.end();
});
app.post("/shutdown", (req, res) => {
  console.log("Shutting down");
  shutdown((output) => {
    console.log(output);
    res.status(200);
    res.end();
  });
});
app.post("/reboot", (req, res) => {
  console.log("Rebooting");
  reboot((output) => {
    console.log(output);
    res.status(200);
    res.end();
  });
});
app.post("/update", (req, res) => {
  console.log("Running GIT PULL");
  git.pull((err, update) => {
    if (update && update.summary.changes) {
      console.log(update);
      res.send("updating");
      exec("npm install", (error, stdout) => (error ? console.error(error) : console.log(stdout)));
    } else if (err) {
      console.error(err);
      res.status(500);
      res.end();
    } else {
      console.log(update);
      res.send("noupdate");
    }
  });
});
