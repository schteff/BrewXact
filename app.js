const sensor = require("ds18b20-raspi");
const jsonfile = require("jsonfile");
const bonjour = require("bonjour")();
const PushBullet = require("pushbullet");
const request = require("request");
const git = require("simple-git")();
const exec = require("child_process").exec;
const siftttwebhooks = require("simple-ifttt-webhooks");
const ngrok = require("ngrok");

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

exec("npm install", (error, stdout) => (error ? console.error(error) : console.log("npm install result: " + stdout)));

app.use(express.static(path.join(__dirname, "public"))); // this middleware serves static files, such as .js, .img, .css files
app.use(express.json());

// Initialize server
const server = app.listen(port, () => console.log("Listening on port %d", server.address().port));

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

function getTemps() {
  const temps = sensor.readAllC(3, (e) => console.error("read error", e));
  if (temps.length == 0) {
    console.log("no temp sensors found", temps);
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
  return { time: Date.now(), temps: temps ? temps : getTemps(), iftttState: lastIftttTempState, iftttTemp: lastAvgTemp, ngrokUrl: localtunnelUrl };
}

/**
 * The loop reading and storing the temperature values to the file / array
 */
var settings = { measuring: false, minTemp: 62, maxTemp: 67, logInterval: config.standardLogInterval };
var notificationSent = false;
var logInterval = settings.logInterval;
var logVar = setInterval(() => readTempAndCheck(), settings.logInterval);
var lastIftttTempState = "unknown";
var lastIftttTempStateChange = 0;
var lastAvgTemp = -1;
console.log("Starting logging with interval " + logInterval);
function readTempAndCheck() {
  if (!settings.measuring) {
    return;
  }
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
/**
 * Read the settings file if it exists
 */
const settingsFile = "../settings.json";
jsonfile.readFile(settingsFile, function (err, obj) {
  if (err) {
    console.error(err);
  } else {
    settings = obj;
    logInterval = settings.logInterval;
    clearInterval(logVar);
    console.log("Restarting logging with interval " + logInterval);
    logVar = setInterval(() => readTempAndCheck(), settings.logInterval);
  }
});

var localtunnelUrl = "not available";
async function refreshNgrok() {
  if (settings.ngrokEnabled) {
    if (localtunnelUrl.startsWith("htt")) {
      await ngrok.disconnect(localtunnelUrl);
    }
    localtunnelUrl = await ngrok.connect({ addr: port, authtoken: settings.ngrokAuthToken ? settings.ngrokAuthToken : null });
  } else {
    await ngrok.disconnect(localtunnelUrl);
    localtunnelUrl = "disconnected";
  }
}
refreshNgrok();
setInterval(() => refreshNgrok(), 12 * 3600000); //12 hours

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
    const avgTemp = getAvg(temps);
    if (avgTemp === -100) {
      console.log("No temp found, doing nothing...");
      if (settings.notify && settings.pushBulletToken) {
        push("No temperature detected!", "Could not find any sensors!");
      }
      return;
    }
    lastAvgTemp = avgTemp + 0;
    const targetTemp = (settings.minTemp + settings.maxTemp) / 2;
    const belowMin = avgTemp < settings.minTemp + 0;
    const aboveMax = avgTemp > settings.maxTemp + 0;
    const aboveTarget = avgTemp > targetTemp + 0.1;
    const belowTarget = avgTemp < targetTemp - 0.1;
    const isHeating = lastIftttTempState === "heating";
    const isCooling = lastIftttTempState === "cooling";
    const lastChangeWasLongAgo = Date.now() - lastIftttTempStateChange > 15 * 60 * 1000;
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

function getAvg(temps) {
  const sum = temps.map((t) => (t.t ? t.t : 0)).reduce((acc, cur) => (cur += acc));
  const count = temps.filter((t) => t.t).length;
  if (count === 0) {
    return -100;
  }
  const avgTemp = sum / count;
  return avgTemp;
}

async function iftttHeat(avgTemp, targetTemp) {
  const res = await siftttwebhooks.sendRequest(settings.iftttLowTempEventName, settings.iftttWebhooksKey, { value1: avgTemp });
  console.log("IFTTT Heating. avgTemp: " + avgTemp + " targetTemp: " + targetTemp + " lastState: " + lastIftttTempState + " newState: heating");
  lastIftttTempState = "heating";
  lastIftttTempStateChange = Date.now();
}

async function iftttCool(avgTemp, targetTemp) {
  const res = await siftttwebhooks.sendRequest(settings.iftttHighTempEventName, settings.iftttWebhooksKey, { value1: avgTemp });
  console.log("IFTTT Cooling. avgTemp: " + avgTemp + " targetTemp: " + targetTemp + " lastState: " + lastIftttTempState + " newState: cooling");
  lastIftttTempState = "cooling";
  lastIftttTempStateChange = Date.now();
}

/**
 * Logging values to brewfather
 */

function trySendLastReadingToBrewfather() {
  if (settings.logToBrewfather && settings.brewfatherStreamUrl) {
    var index = 0;
    const temps = getTemps();
    const avgTemp = getAvg(temps);
    settings.customNames.forEach((name) => {
      const brewfatherData = {
        name: "Temp sensor " + index,
        temp: temps[index].t,
        temp_unit: "C", // C, F, K
        beer: name,
        aux_temp: Math.round((avgTemp + Number.EPSILON) * 100) / 100,
        comment:
          "Temperature reading. " +
          lastIftttTempState +
          " since " +
          (lastIftttTempStateChange ? new Date(lastIftttTempStateChange).toLocaleTimeString() : "?") +
          " configUrl: " +
          localtunnelUrl,
      };

      const dex = index + 0;
      request.post(settings.brewfatherStreamUrl, { json: brewfatherData }, (error, response, body) => {
        if (!error && response.statusCode == 200) {
          console.log("Successful logged temp sensor " + dex + " " + name + " to brewfather");
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
app.get("/getSettings", (req, res) => res.send(JSON.stringify(settings)));
app.get("/clear", (req, res) => {
  console.log("Clearing history");
  //Backup old file
  jsonfile.writeFileSync("../data" + Date.now() + ".json", dataFileArray);
  console.log("Old history saved to backup file.");

  dataFileArray = [getDataFileArrayItem()];
  saveDataFile();
  res.status(200);
  res.end();
});
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

      refreshNgrok();
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
