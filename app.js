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

/**
 * Log to file also
 */
const fs = require("fs");
const util = require("util");
const logFile = fs.createWriteStream("../log.txt", { flags: "w" });
const logStdout = process.stdout;
console.log = function () {
  logFile.write(getFormattedDate() + " " + util.format.apply(null, arguments) + "\n");
  logStdout.write(getFormattedDate() + " " + util.format.apply(null, arguments) + "\n");
};
console.error = console.log;

function getFormattedDate() {
  var d = new Date();
  return (
    d.getFullYear() +
    "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) +
    "-" +
    ("0" + d.getDate()).slice(-2) +
    " " +
    ("0" + d.getHours()).slice(-2) +
    ":" +
    ("0" + d.getMinutes()).slice(-2) +
    ":" +
    ("0" + d.getSeconds()).slice(-2)
  );
}

function getLog() {
  return fs.readFileSync("../log.txt", "utf8");
}

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
  const temps = sensor.readAllC(2);
  if (temps.length == 0) {
    //Mock values
    temps.push({ id: "foo1", t: 40 + new Date().getSeconds() });
    temps.push({ id: "foo2", t: 90 - new Date().getSeconds() });
    temps.push({ id: "foo3", t: 22 });
    //console.log("no temp sensors found, using mock sensors", temps);
  }
  return temps;
}

function lastReading() {
  return dataFileArray[dataFileArray.length - 1];
}

function getDataFileArrayItem(temps) {
  return { time: Date.now(), temps: temps ? temps : getTemps(), iftttState: lastIftttTempState, iftttTemp: lastIftttBeerTemp, ngrokUrl: localtunnelUrl };
}

/**
 * The loop reading and storing the temperature values to the file / array
 */
var settings = { measuring: false, minTemp: 62, maxTemp: 67, minFridgeTemp: 10, maxFridgeTemp: 30, logInterval: config.standardLogInterval };
var notificationSent = false;
var logInterval = settings.logInterval;
var logVar = setInterval(() => readTempAndCheck(), settings.logInterval);
var lastIftttTempState = "unknown";
var lastIftttTempStateChange = 0;
var lastIftttBeerTemp = -1;
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
    const beerTemp = getAvgBeerTemp(temps);
    const tooColdTemps = beerTemp.filter((t) => t.t < settings.minTemp);
    const tooWarmTemps = beerTemp.filter((t) => t.t > settings.maxTemp);
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
 * NGROK
 */
var localtunnelUrl = "not available";
async function refreshNgrok() {
  console.log("ngrok enabled: " + settings.ngrokEnabled);
  if (settings.ngrokEnabled) {
    if (localtunnelUrl.startsWith("htt")) {
      console.log("disconnecting old ngrok tunnel");
      await ngrok.disconnect(localtunnelUrl);
    }
    localtunnelUrl = await ngrok.connect({ addr: port, region: "eu", authtoken: settings.ngrokAuthToken ? settings.ngrokAuthToken : null });
    console.log("new ngrok tunnel url: " + localtunnelUrl);
  } else {
    if (localtunnelUrl.startsWith("htt")) {
      console.log("disconnecting old ngrok tunnel (ngrok disabled)");
      await ngrok.disconnect(localtunnelUrl);
    }
    localtunnelUrl = "disconnected";
  }
}
setInterval(() => refreshNgrok(), 12 * 3600000); //12 hours

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
    refreshNgrok();
  }
});

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

/**
 * TEMP CONTROLLER
 *
 */
setInterval(() => tempController(), 10000);
function tempController() {
  if (settings.iftttEnabled && settings.iftttWebhooksKey) {
    const temps = getTemps();
    const beerTemp = getAvgBeerTemp(temps);
    const fridgeTemp = getAvgFridgeTemp(temps);
    const roomTemp = getAvgRoomTemp(temps);
    if (beerTemp === -100) {
      console.log("No beer temp found, doing nothing...");
      if (settings.notify && settings.pushBulletToken) {
        push("No temperature detected!", "Could not find any sensors!");
      }
      return;
    }
    lastIftttBeerTemp = beerTemp + 0;
    const targetTemp = (settings.minTemp + settings.maxTemp) / 2;
    const belowBeerMin = beerTemp < settings.minTemp + 0;
    const aboveBeerMax = beerTemp > settings.maxTemp + 0;
    const isHeating = lastIftttTempState === "heating";
    const isCooling = lastIftttTempState === "cooling";
    const isResting = lastIftttTempState === "resting";
    const lastChangeWasHalfHourAgo = Date.now() - lastIftttTempStateChange > 30 * 60 * 1000;
    const lastChangeWasHourAgo = Date.now() - lastIftttTempStateChange > 60 * 60 * 1000;

    //Check fridge limits
    var belowFridgeMin = false;
    var aboveFridgeMax = false;
    if (fridgeTemp !== -100 && settings.minFridgeTemp && settings.maxFridgeTemp) {
      belowFridgeMin = fridgeTemp < settings.minFridgeTemp + 0;
      aboveFridgeMax = fridgeTemp > settings.maxFridgeTemp + 0;
    }

    //Check room temp
    var roomHotterThanFridge = false;
    var roomColderThanFridge = false;
    if (roomTemp !== -100 && fridgeTemp !== -100) {
      roomHotterThanFridge = roomTemp > fridgeTemp;
      roomColderThanFridge = roomTemp < fridgeTemp;
    }

    if (belowFridgeMin || belowBeerMin) {
      //Should heat
      if (isCooling) {
        iftttHeat(beerTemp, targetTemp);
        return;
      } else if (isHeating) {
        if (lastChangeWasHalfHourAgo) {
          iftttHeat(beerTemp, targetTemp); //Heat again because long ago last change
          return;
        }
      } else {
        //Resting
        if (!roomHotterThanFridge) {
          // in cold room
          iftttHeat(beerTemp, targetTemp); //Heat because room colder than fridge
          return;
        } else {
          if (lastChangeWasHourAgo) {
            iftttHeat(beerTemp, targetTemp); //Heat because long ago change
            return;
          } else {
            iftttRest(beerTemp, targetTemp); //Rest because room hotter than fridge
            return;
          }
        }
      }
    } else if (aboveFridgeMax || aboveBeerMax) {
      //Should cool
      if (isHeating) {
        iftttCool(beerTemp, targetTemp);
        return;
      } else if (isCooling) {
        if (lastChangeWasHalfHourAgo) {
          iftttCool(beerTemp, targetTemp); //Cool again because long ago last change
          return;
        }
      } else {
        //Resting
        if (!roomColderThanFridge) {
          // in hot room
          iftttCool(beerTemp, targetTemp); //Cool because room hotter than fridge
          return;
        } else {
          if (lastChangeWasHourAgo) {
            iftttCool(beerTemp, targetTemp); //Cool because long ago change
            return;
          } else {
            iftttRest(beerTemp, targetTemp); //Rest because room colder than fridge
            return;
          }
        }
      }
    } else if (!isResting) {
      iftttRest(beerTemp, targetTemp); //Rest because all is fine
      return;
    }
  }
}

function getAvgBeerTemp(temps) {
  const beerTemps = temps.filter((t) => !settings.tempTypes[t.id] || settings.tempTypes[t.id] === "beer");
  return getAvgTemp(beerTemps);
}

function getAvgRoomTemp(temps) {
  const roomTemps = temps.filter((t) => settings.tempTypes[t.id] === "room");
  return getAvgTemp(roomTemps);
}
function getAvgTemp(temps) {
  const sum = temps.map((t) => (t.t ? t.t : 0)).reduce((acc, cur) => (cur += acc), 0);
  const count = temps.filter((t) => t.t).length;
  if (count === 0) {
    return -100;
  }
  const avgTemp = sum / count;
  return Math.round((avgTemp + Number.EPSILON) * 100) / 100;
}

function getAvgFridgeTemp(temps) {
  const fridgeTemps = temps.filter((t) => settings.tempTypes[t.id] === "fridge");
  return getAvgTemp(fridgeTemps);
}

async function iftttHeat(beerTemp, targetTemp) {
  const res = await siftttwebhooks.sendRequest(settings.iftttLowTempEventName, settings.iftttWebhooksKey, { value1: beerTemp });
  console.log("IFTTT Heating. avgTemp: " + beerTemp + " targetTemp: " + targetTemp + " prevState: " + lastIftttTempState);
  lastIftttTempState = "heating";
  lastIftttTempStateChange = Date.now();
}

async function iftttCool(beerTemp, targetTemp) {
  const res = await siftttwebhooks.sendRequest(settings.iftttHighTempEventName, settings.iftttWebhooksKey, { value1: beerTemp });
  console.log("IFTTT Cooling. avgTemp: " + beerTemp + " targetTemp: " + targetTemp + " prevState: " + lastIftttTempState);
  lastIftttTempState = "cooling";
  lastIftttTempStateChange = Date.now();
}

async function iftttRest(beerTemp, targetTemp) {
  const res = await siftttwebhooks.sendRequest(settings.iftttRestEventName, settings.iftttWebhooksKey, { value1: beerTemp });
  console.log("IFTTT Resting. avgTemp: " + beerTemp + " targetTemp: " + targetTemp + " prevState: " + lastIftttTempState);
  lastIftttTempState = "resting";
  lastIftttTempStateChange = Date.now();
}

/**
 * Logging values to brewfather
 */

function trySendLastReadingToBrewfather() {
  if (settings.logToBrewfather && settings.brewfatherStreamUrl) {
    const temps = getTemps();
    const avgBeerTemp = getAvgBeerTemp(temps);
    const avgRoomTemp = getAvgRoomTemp(temps);
    const avgFridgeTemp = getAvgFridgeTemp(temps);
    Object.entries(settings.customNames).forEach((key, value) => {
      const sensor = key[0];
      const tempType = settings.tempTypes[sensor];
      if (tempType !== "beer") {
        return;
      }
      const name = key[1];
      const temp = temps.filter((t) => t.id === sensor)[0].t;
      const brewfatherData = {
        name: sensor + name,
        temp: temp,
        temp_unit: "C", // C, F, K
        beer: name,
        aux_temp: avgFridgeTemp === -100 ? null : avgFridgeTemp,
        ext_temp: avgRoomTemp === -100 ? null : avgRoomTemp,
        comment:
          "Temperature reading. " +
          lastIftttTempState +
          " since " +
          (lastIftttTempStateChange ? new Date(lastIftttTempStateChange).toLocaleTimeString() : "?") +
          " sensor: " +
          sensor +
          "-" +
          name +
          " avgBeerTemp: " +
          avgBeerTemp,
      };

      request.post(settings.brewfatherStreamUrl, { json: brewfatherData }, (error, response, body) => {
        if (!error && response.statusCode == 200) {
          console.log("Successful logged temp sensor " + sensor + " " + name + " to brewfather");
        } else if (error) {
          console.error(error);
        }
      });
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
  const oldNgrokEnabled = settings.ngrokEnabled;

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
      if (oldNgrokEnabled !== settings.ngrokEnabled) {
        refreshNgrok();
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
  git.fetch(() => {
    git.reset("hard");
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
});
app.get("/getLog", (req, res) => res.send(getLog()));
