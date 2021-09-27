function init(callback) {
  $("body").addClass("loading");
  fetch("/init")
    .then((response) => response.json())
    .then((json) => callback(json))
    .then(() => $("body").removeClass("loading"));
}

function fetchTemps(callback) {
  $("body").addClass("loading");
  fetch("/temps")
    .then((response) => response.json())
    .then((json) => callback(json))
    .then(() => $("body").removeClass("loading"));
}

function fetchSettings(callback) {
  $("body").addClass("loading");
  fetch("/getSettings")
    .then((response) => response.json())
    .then((json) => callback(json))
    .then(() => $("body").removeClass("loading"));
}

function fetchLog() {
  $("body").addClass("loading");
  fetch("/getLog")
    .then((response) => response.text())
    .then((text) => {
      document.getElementById("logArea").value = text + "";
      $("#logArea").trigger("autoresize");
    })
    .then(() => $("body").removeClass("loading"));
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

const refreshInterval = 20000;

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
  const tempTypes = {};
  const tempOffsets = {};
  customNameInputs.forEach((input) => {
    const sensorName = input.id.replace("_name", "");
    tempTypes[sensorName] = document.getElementById(sensorName + "_roomtemp").checked
      ? "room"
      : document.getElementById(sensorName + "_fridgetemp").checked
      ? "fridge"
      : "beer";
    customNames[sensorName] = input.value;
    tempOffsets[sensorName] = document.getElementById(sensorName + "_offset").value;
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
    tempOffsets: tempOffsets,
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
document.getElementById("get_log_btn").addEventListener("click", () => fetchLog());
document.getElementById("update_btn").addEventListener("click", () => updateApp());
document.getElementById("reboot_btn").addEventListener("click", () => rebootDevice());
document.getElementById("shutdown_btn").addEventListener("click", () => shutdownDevice());
document.getElementById("notificationsEnabled").addEventListener("change", (event) => document.getElementById("pushbullet_wrapper").classList.toggle("hide"));
document.getElementById("bfEnabled").addEventListener("change", (event) => document.getElementById("brewfather_wrapper").classList.toggle("hide"));
document.getElementById("iftttEnabled").addEventListener("change", (event) => document.getElementById("ifttt_wrapper").classList.toggle("hide"));
document.getElementById("ngrokEnabled").addEventListener("change", (event) => document.getElementById("ngrok_wrapper").classList.toggle("hide"));

const customNameInputs = [];

const chartOptions = {
  titlePosition: "none",
  curveType: "function",
  legend: { position: "bottom" },
  focusTarget: "category",
  hAxis: { format: "yyyy-MM-dd HH:mm:ss" },
  chartArea: { left: 40, top: 20, width: "95%", height: "75%", backgroundColor: "transparent" },
  backgroundColor: "transparent",
};

var gaugeOptions = {
  width: 360,
  height: 120,
  redTo: 100,
  yellowColor: "#1FAAF1",
  yellowFrom: 0,
  minorTicks: 5,
  min: 0,
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
  const sensorsOffsetsWrapper = document.getElementById("sensor_offsets");
  const sensorIds = [...new Set(firstTemps.flatMap((t) => t.temps).map((t) => t.id))];

  sensorIds.forEach((sensorId) => {
    chartDataTable.addColumn("number", sensorId);

    // ----- sensor name input
    const sensorNameInputId = sensorId + "_name";
    const sensorNameWrapper = document.createElement("DIV");
    sensorNameWrapper.setAttribute("class", "input-field col s4");

    const sensorNameInput = document.createElement("INPUT");
    sensorNameInput.setAttribute("id", sensorNameInputId);
    sensorNameInput.setAttribute("type", "text");
    customNameInputs.push(sensorNameInput);
    const index = customNameInputs.indexOf(sensorNameInput);
    const name = customNames[sensorId + ""];
    sensorNameInput.setAttribute("value", name ? name : "Mätare " + (index + 1));
    sensorNameWrapper.append(sensorNameInput);

    const sensorNameLabel = document.createElement("LABEL");
    sensorNameLabel.setAttribute("for", sensorNameInputId);
    sensorNameLabel.setAttribute("class", "active");
    sensorNameLabel.append(sensorId + "");
    sensorNameWrapper.append(sensorNameLabel);

    sensorsNamesWrapper.append(sensorNameWrapper);

    // ----- sensor offset input
    const sensorOffsetInputId = sensorId + "_offset";
    const sensorOffsetWrapper = document.createElement("DIV");
    sensorOffsetWrapper.setAttribute("class", "input-field col s4");

    const sensorOffsetInput = document.createElement("INPUT");
    sensorOffsetInput.setAttribute("id", sensorOffsetInputId);
    sensorOffsetInput.setAttribute("type", "number");
    sensorOffsetInput.setAttribute("step", "0.1");
    sensorOffsetInput.setAttribute("min", "-100");
    sensorOffsetInput.setAttribute("max", "100");
    sensorOffsetInput.setAttribute("value", 0);
    sensorOffsetWrapper.append(sensorOffsetInput);

    const sensorOffsetLabel = document.createElement("LABEL");
    sensorOffsetLabel.setAttribute("for", sensorOffsetInputId);
    sensorOffsetLabel.setAttribute("class", "active");
    sensorOffsetLabel.append(sensorId + " offset");
    sensorOffsetWrapper.append(sensorOffsetLabel);

    sensorsOffsetsWrapper.append(sensorOffsetWrapper);

    // ----- sensor type radio buttons

    const tempType = tempTypes[sensorId + ""];
    const beerRadioP = createTempSelector(sensorId, tempType, "beer");
    const roomRadioP = createTempSelector(sensorId, tempType, "room");
    const fridgeRadioP = createTempSelector(sensorId, tempType, "fridge");
    const radioWrapper = document.createElement("DIV");
    radioWrapper.setAttribute("class", "switch col s4");
    radioWrapper.append(beerRadioP);
    radioWrapper.append(roomRadioP);
    radioWrapper.append(fridgeRadioP);

    sensorsRadiosWrapper.append(radioWrapper);

    // -----

    gaugeDataTable.addRow([sensorId, 0]);
  });

  const rowArrays = toRowArrays(firstTemps);
  rowArrays.forEach((rowArray) => chartDataTable.addRow(rowArray));

  refresh(gaugeChart, lineChart, chartDataTable, gaugeDataTable);
  setInterval(() => refresh(gaugeChart, lineChart, chartDataTable, gaugeDataTable), refreshInterval);
}

function createTempSelector(sensorId, tempType, type) {
  const sensorTempRadioId = sensorId + "_" + type + "temp";
  const radioInput = document.createElement("INPUT");
  radioInput.setAttribute("id", sensorTempRadioId);
  radioInput.setAttribute("type", "radio");
  radioInput.setAttribute("name", sensorId + "_group");
  radioInput.checked = tempType === type;

  const radioLabel = document.createElement("LABEL");
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
  const sensorCount = Object.entries(settings.customNames).length;
  while (rowArray.length <= sensorCount) {
    rowArray.push(null);
  }
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

    lineChart.draw(chartDataTable, google.charts.Line.convertOptions(chartOptions));
    gaugeOptions = {
      ...gaugeOptions,
      yellowFrom: settings.minFridgeTemp - 10,
      yellowTo: settings.minFridgeTemp,
      greenFrom: settings.minTemp,
      greenTo: settings.maxTemp,
      redFrom: settings.maxFridgeTemp,
      min: settings.minFridgeTemp - 10,
      max: settings.maxFridgeTemp + 10,
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
