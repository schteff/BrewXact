function init(callback) {
  fetch("/init")
    .then((response) => response.json())
    .then((json) => callback(json));
}

function fetchTemps(callback) {
  fetch("/temps")
    .then((response) => response.json())
    .then((json) => callback(json));
}

function fetchSettings(callback) {
  fetch("/getSettings")
    .then((response) => response.json())
    .then((json) => callback(json));
}

function saveSettings(settings) {
  const other_params = {
    headers: { "content-type": "application/json; charset=UTF-8" },
    body: JSON.stringify(settings),
    method: "POST",
    mode: "cors",
  };
  fetch("/saveSettings", other_params);
}

function updateApp() {
  const other_params = {
    headers: { "content-type": "application/json; charset=UTF-8" },
    method: "POST",
    mode: "cors",
  };
  fetch("/update", other_params);
}
function rebootDevice() {
  const other_params = {
    headers: { "content-type": "application/json; charset=UTF-8" },
    method: "POST",
    mode: "cors",
  };
  fetch("/reboot", other_params);
}
function shutdownDevice() {
  const other_params = {
    headers: { "content-type": "application/json; charset=UTF-8" },
    method: "POST",
    mode: "cors",
  };
  fetch("/shutdown", other_params);
}

const refreshInterval = 12000;

const customNames = {};
const tempTypes = {};

function setGuiSettings(settings) {
  if (settings.minTemp) document.getElementById("minTemp").value = settings.minTemp;
  if (settings.maxTemp) document.getElementById("maxTemp").value = settings.maxTemp;
  if (settings.minFridgeTemp) document.getElementById("minFridgeTemp").value = settings.minFridgeTemp;
  if (settings.maxFridgeTemp) document.getElementById("maxFridgeTemp").value = settings.maxFridgeTemp;
  if (settings.logInterval) document.getElementById("logInterval").value = settings.logInterval / 1000;
  if (settings.pushBulletToken) document.getElementById("pushBulletToken").value = settings.pushBulletToken;
  if (settings.brewfatherStreamUrl) document.getElementById("brewfatherUrl").value = settings.brewfatherStreamUrl;
  if (settings.iftttWebhooksKey) document.getElementById("iftttWebhooksKey").value = settings.iftttWebhooksKey;
  if (settings.iftttLowTempEventName) document.getElementById("iftttLowTempEventName").value = settings.iftttLowTempEventName;
  if (settings.iftttHighTempEventName) document.getElementById("iftttHighTempEventName").value = settings.iftttHighTempEventName;
  if (settings.iftttRestEventName) document.getElementById("iftttRestEventName").value = settings.iftttRestEventName;
  if (settings.ngrokAuthToken) document.getElementById("ngrokAuthToken").value = settings.ngrokAuthToken;

  if (settings.customNames) Object.entries(settings.customNames).forEach((key, value) => (customNames[key[0]] = key[1]));
  if (settings.tempTypes) Object.entries(settings.tempTypes).forEach((key, value) => (tempTypes[key[0]] = key[1]));

  if (!settings.logToBrewfather) document.getElementById("brewfather_wrapper").classList.add("hide");
  if (!settings.notify) document.getElementById("pushbullet_wrapper").classList.add("hide");
  if (!settings.iftttEnabled) document.getElementById("ifttt_wrapper").classList.add("hide");
  if (!settings.ngrokEnabled) document.getElementById("ngrok_wrapper").classList.add("hide");

  document.getElementById("bfEnabled").checked = settings.logToBrewfather;
  document.getElementById("notificationsEnabled").checked = settings.notify;
  document.getElementById("iftttEnabled").checked = settings.iftttEnabled;
  document.getElementById("ngrokEnabled").checked = settings.ngrokEnabled;
  document.getElementById("measuringEnabled").checked = settings.measuring;
}

function downloadChart(chart) {
  var a = $("<a>").attr("href", chart.getImageURI()).attr("download", "chart.png").appendTo("body");
  a[0].click();
  a.remove();
}

function downloadData() {
  init((data) => {
    var a = document.createElement("a");
    var file = new Blob([JSON.stringify(data)], { type: "text/json" });
    a.href = URL.createObjectURL(file);
    a.download = "data.json";
    a.click();
    a.remove();
  });
}

function getGuiSettings() {
  const minTemp = Number(document.getElementById("minTemp").value);
  const maxTemp = Number(document.getElementById("maxTemp").value);
  const minFridgeTemp = Number(document.getElementById("minFridgeTemp").value);
  const maxFridgeTemp = Number(document.getElementById("maxFridgeTemp").value);
  const logInterval = Number(document.getElementById("logInterval").value) * 1000;
  const customNames = {};
  customNameInputs.forEach((input) => (customNames[input.id.replace("_name", "")] = input.value));
  const tempTypes = {};
  customNameInputs.forEach((input) => {
    const sensorName = input.id.replace("_name", "");
    tempTypes[sensorName] = document.getElementById(sensorName + "_roomtemp").checked
      ? "room"
      : document.getElementById(sensorName + "_fridgetemp").checked
      ? "fridge"
      : "beer";
  });
  const notify = document.getElementById("notificationsEnabled").checked;
  const pushBulletToken = document.getElementById("pushBulletToken").value;
  const brewfatherStreamUrl = document.getElementById("brewfatherUrl").value;
  const logToBrewfather = document.getElementById("bfEnabled").checked;
  const iftttEnabled = document.getElementById("iftttEnabled").checked;
  const iftttWebhooksKey = document.getElementById("iftttWebhooksKey").value;
  const iftttLowTempEventName = document.getElementById("iftttLowTempEventName").value;
  const iftttHighTempEventName = document.getElementById("iftttHighTempEventName").value;
  const iftttRestEventName = document.getElementById("iftttRestEventName").value;
  const measuring = document.getElementById("measuringEnabled").checked;
  const ngrokEnabled = document.getElementById("ngrokEnabled").checked;
  const ngrokAuthToken = document.getElementById("ngrokAuthToken").value;
  return {
    measuring: measuring,
    minTemp: minTemp,
    maxTemp: maxTemp,
    minFridgeTemp: minFridgeTemp,
    maxFridgeTemp: maxFridgeTemp,
    logInterval: logInterval,
    customNames: customNames,
    tempTypes: tempTypes,
    notify: notify,
    pushBulletToken: pushBulletToken,
    brewfatherStreamUrl: brewfatherStreamUrl,
    logToBrewfather: logToBrewfather,
    iftttEnabled: iftttEnabled,
    iftttWebhooksKey: iftttWebhooksKey,
    iftttLowTempEventName: iftttLowTempEventName,
    iftttHighTempEventName: iftttHighTempEventName,
    iftttRestEventName: iftttRestEventName,
    ngrokAuthToken: ngrokAuthToken,
    ngrokEnabled: ngrokEnabled,
  };
}

fetchSettings((settings) => setGuiSettings(settings));

document.getElementById("save_btn").addEventListener("click", () => saveSettings(getGuiSettings()));
document.getElementById("update_btn").addEventListener("click", () => updateApp());
document.getElementById("reboot_btn").addEventListener("click", () => rebootDevice());
document.getElementById("shutdown_btn").addEventListener("click", () => shutdownDevice());
document.getElementById("notificationsEnabled").addEventListener("change", (event) => document.getElementById("pushbullet_wrapper").classList.toggle("hide"));
document.getElementById("bfEnabled").addEventListener("change", (event) => document.getElementById("brewfather_wrapper").classList.toggle("hide"));
document.getElementById("iftttEnabled").addEventListener("change", (event) => document.getElementById("ifttt_wrapper").classList.toggle("hide"));
document.getElementById("ngrokEnabled").addEventListener("change", (event) => document.getElementById("ngrok_wrapper").classList.toggle("hide"));

const customNameInputs = [];

const chartOptions = {
  title: "Temperatüren",
  curveType: "function",
  legend: { position: "bottom" },
  focusTarget: "category",
  hAxis: { format: "yyyy-MM-dd HH:mm:ss" },
  chartArea: { left: 40, top: 20, width: "95%", height: "75%" },
  backgroundColor: "#eceff1",
};

var gaugeOptions = {
  width: 400,
  height: 120,
  redTo: 100,
  yellowColor: "#1FAAF1",
  yellowFrom: 0,
  minorTicks: 5,
  min: 20,
  max: 100,
};

function drawChart() {
  init((firstTemps) => start(firstTemps));
}

function start(firstTemps) {
  const lineChart = new google.visualization.LineChart(document.getElementById("curve_chart"));
  const chartDataTable = new google.visualization.DataTable();

  document.getElementById("download_chart_btn").addEventListener("click", () => downloadChart(lineChart));
  document.getElementById("download_data_btn").addEventListener("click", () => downloadData(chartDataTable));
  document.getElementById("clear_btn").addEventListener("click", () => {
    fetch("/clear").then((response) => {
      chartDataTable.removeRows(0, chartDataTable.getNumberOfRows());
      document.getElementById("curve_chart").scrollIntoView();
    });
  });

  const gaugeChart = new google.visualization.Gauge(document.getElementById("gauge_chart"));

  chartDataTable.addColumn("datetime", "Tid");
  chartDataTable.addColumn("number", "Min");
  chartDataTable.addColumn("number", "Max");

  const gaugeDataTable = new google.visualization.DataTable();
  gaugeDataTable.addColumn("string", "Label");
  gaugeDataTable.addColumn("number", "Value");

  const sensorsNamesWrapper = document.getElementById("sensor_names");
  const sensorsRadiosWrapper = document.getElementById("sensor_room_switches");
  firstTemps[firstTemps.length - 1].temps.forEach((sensor) => {
    chartDataTable.addColumn("number", sensor.id);
    const sensorNameInputId = sensor.id + "_name";

    // -----
    const sensorWrapper = document.createElement("DIV");
    sensorWrapper.setAttribute("class", "input-field col s4");

    const sensorNameInput = document.createElement("INPUT");
    sensorNameInput.setAttribute("id", sensorNameInputId);
    sensorNameInput.setAttribute("type", "text");
    customNameInputs.push(sensorNameInput);
    const index = customNameInputs.indexOf(sensorNameInput);
    const name = customNames[sensor.id + ""];
    sensorNameInput.setAttribute("value", name ? name : "Mätare " + (index + 1));
    sensorWrapper.append(sensorNameInput);

    const sensorNameLabel = document.createElement("LABEL");
    sensorNameLabel.setAttribute("for", sensorNameInputId);
    sensorNameLabel.setAttribute("class", "active");
    sensorNameLabel.append(sensor.id + "");
    sensorWrapper.append(sensorNameLabel);

    sensorsNamesWrapper.append(sensorWrapper);

    const tempType = tempTypes[sensor.id + ""];
    const beerRadioP = createTempSelector(sensor, tempType, "beer");
    const roomRadioP = createTempSelector(sensor, tempType, "room");
    const fridgeRadioP = createTempSelector(sensor, tempType, "fridge");
    const radioWrapper = document.createElement("DIV");
    radioWrapper.setAttribute("class", "switch col s4");
    radioWrapper.append(beerRadioP);
    radioWrapper.append(roomRadioP);
    radioWrapper.append(fridgeRadioP);

    sensorsRadiosWrapper.append(radioWrapper);

    // -----

    gaugeDataTable.addRow([sensor.id, sensor.t]);
  });

  toRowArrays(firstTemps).forEach((rowArray) => chartDataTable.addRow(rowArray));

  refresh(gaugeChart, lineChart, chartDataTable, gaugeDataTable);
  setInterval(() => refresh(gaugeChart, lineChart, chartDataTable, gaugeDataTable), refreshInterval);
}

function createTempSelector(sensor, tempType, type) {
  const sensorTempRadioId = sensor.id + "_" + type + "temp";
  const radioInput = document.createElement("INPUT");
  radioInput.setAttribute("id", sensorTempRadioId);
  radioInput.setAttribute("type", "radio");
  radioInput.setAttribute("name", sensor.id + "_group");
  radioInput.checked = tempType === type;
  const radioLabel = document.createElement("LABEL");
  radioLabel.setAttribute("for", sensorTempRadioId);
  radioLabel.append(type + " temp");

  const radioP = document.createElement("P");
  radioP.append(radioInput);
  radioP.append(radioLabel);

  return radioP;
}

function toRowArrays(firstTemps) {
  const initSettings = getGuiSettings();
  return firstTemps.map((obj) => toRowArray(obj, initSettings));
}
function toRowArray(obj, settings) {
  const rowArray = [new Date(obj.time)];
  obj.temps.forEach((tempObj) => rowArray.push(tempObj.t));
  rowArray.push(settings.minTemp);
  rowArray.push(settings.maxTemp);
  return rowArray;
}

function refresh(gaugeChart, lineChart, chartDataTable, gaugeDataTable) {
  fetchTemps((jsonTemp) => {
    const settings = getGuiSettings();
    chartDataTable.addRow(toRowArray(jsonTemp, settings));

    for (var i = 0; i < jsonTemp.temps.length; i++) {
      //Update column label names (could have changed)
      const customName = document.getElementById(jsonTemp.temps[i].id + "_name").value;
      chartDataTable.setColumnLabel(i + 1, customName);

      //Beep
      const currentTemp = jsonTemp.temps[i].t;
      if (currentTemp < minTemp || currentTemp > maxTemp) {
        beep();
      }

      //Update gauge names and values
      gaugeDataTable.setValue(i, 0, customName);
      gaugeDataTable.setValue(i, 1, currentTemp);
    }

    chartDataTable.setColumnLabel(jsonTemp.temps.length + 1, "Min " + settings.minTemp + "°C");
    chartDataTable.setColumnLabel(jsonTemp.temps.length + 2, "Max " + settings.maxTemp + "°C");

    lineChart.draw(chartDataTable, chartOptions);
    gaugeOptions = {
      ...gaugeOptions,
      yellowTo: settings.minTemp,
      greenFrom: settings.minTemp,
      greenTo: settings.maxTemp,
      redFrom: settings.maxTemp,
    };
    gaugeChart.draw(gaugeDataTable, gaugeOptions);

    document.getElementById("iftttState").innerHTML = jsonTemp.iftttState + " (avg " + jsonTemp.iftttTemp + "°C)";
    document.getElementById("ngrokUrl").innerHTML = '<a href="' + jsonTemp.ngrokUrl + '" target="_blank">' + jsonTemp.ngrokUrl + "</a>";
  });
}

function beep() {
  var sound = document.getElementById("sound1");
  sound.play();
}
