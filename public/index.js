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

const refreshInterval = 6000;

function setGuiSettings(settings) {
  if (settings.minTemp) {
    document.getElementById("minTemp").value = settings.minTemp;
  }
  if (settings.maxTemp) {
    document.getElementById("maxTemp").value = settings.maxTemp;
  }
  if (settings.logInterval) {
    document.getElementById("logInterval").value = settings.logInterval / 1000;
  }
  if (settings.pushBulletToken) {
    document.getElementById("pushBulletToken").value = settings.pushBulletToken;
  }
  if (settings.customNames) {
    settings.customNames.forEach((name) => customNames.push(name));
  }
  if (settings.brewfatherStreamUrl) {
    document.getElementById("brewfatherUrl").value = settings.brewfatherStreamUrl;
  }
  document.getElementById("bfEnabled").checked = settings.logToBrewfather;
  if (!settings.logToBrewfather) {
    document.getElementById("brewfather_wrapper").classList.add("hide");
  }
  document.getElementById("notificationsEnabled").checked = settings.notify;
  if (!settings.notify) {
    document.getElementById("pushbullet_wrapper").classList.add("hide");
  }
  document.getElementById("iftttEnabled").checked = settings.iftttEnabled;
  if (!settings.iftttEnabled) {
    document.getElementById("ifttt_wrapper").classList.add("hide");
  }
  if (settings.iftttWebhooksKey) {
    document.getElementById("iftttWebhooksKey").value = settings.iftttWebhooksKey;
  }
  if (settings.iftttLowTempEventName) {
    document.getElementById("iftttLowTempEventName").value = settings.iftttLowTempEventName;
  }
  if (settings.iftttHighTempEventName) {
    document.getElementById("iftttHighTempEventName").value = settings.iftttHighTempEventName;
  }
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
  const logInterval = Number(document.getElementById("logInterval").value) * 1000;
  const customNames = customNameInputs.map((input) => input.value);
  const notify = document.getElementById("notificationsEnabled").checked;
  const pushBulletToken = document.getElementById("pushBulletToken").value;
  const brewfatherStreamUrl = document.getElementById("brewfatherUrl").value;
  const logToBrewfather = document.getElementById("bfEnabled").checked;
  const iftttEnabled = document.getElementById("iftttEnabled").checked;
  const iftttWebhooksKey = document.getElementById("iftttWebhooksKey").value;
  const iftttLowTempEventName = document.getElementById("iftttLowTempEventName").value;
  const iftttHighTempEventName = document.getElementById("iftttHighTempEventName").value;
  const measuring = document.getElementById("measuringEnabled").checked
  return {
    measuring: measuring,
    minTemp: minTemp,
    maxTemp: maxTemp,
    logInterval: logInterval,
    customNames: customNames,
    notify: notify,
    pushBulletToken: pushBulletToken,
    brewfatherStreamUrl: brewfatherStreamUrl,
    logToBrewfather: logToBrewfather,
    iftttEnabled: iftttEnabled,
    iftttWebhooksKey: iftttWebhooksKey,
    iftttLowTempEventName: iftttLowTempEventName,
    iftttHighTempEventName: iftttHighTempEventName,
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

const customNameInputs = [];
const customNames = [];
const sensorNamesWrapper = document.getElementById("sensor_names");

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

  firstTemps[firstTemps.length - 1].temps.forEach((sensor) => {
    chartDataTable.addColumn("number", sensor.id);
    const idAttr = sensor.id + "_name";

    // -----
    const wrapper = document.createElement("DIV");
    wrapper.setAttribute("class", "input-field col s4");

    const nameInput = document.createElement("INPUT");
    customNameInputs.push(nameInput);
    nameInput.setAttribute("id", idAttr);
    nameInput.setAttribute("type", "text");
    const index = customNameInputs.indexOf(nameInput);
    const customName = customNames[index];
    nameInput.setAttribute("value", customName ? customName : "Mätare " + (index + 1));
    wrapper.append(nameInput);

    const label = document.createElement("LABEL");
    label.setAttribute("for", idAttr);
    label.setAttribute("class", "active");
    label.append(sensor.id + "");
    wrapper.append(label);

    sensorNamesWrapper.append(wrapper);

    // -----

    gaugeDataTable.addRow([sensor.id, sensor.t]);
  });

  toRowArrays(firstTemps).forEach((rowArray) => chartDataTable.addRow(rowArray));

  refresh(gaugeChart, lineChart, chartDataTable, gaugeDataTable);
  setInterval(() => refresh(gaugeChart, lineChart, chartDataTable, gaugeDataTable), refreshInterval);
}

function toRowArrays(firstTemps) {
  const initSettings = getGuiSettings();
  return firstTemps.map((obj) => toRowArray(obj, initSettings));
}
function toRowArray(obj, settings) {
  const rowArray = [new Date(obj.time), settings.minTemp, settings.maxTemp];
  obj.temps.forEach((tempObj) => rowArray.push(tempObj.t));
  return rowArray;
}

function refresh(gaugeChart, lineChart, chartDataTable, gaugeDataTable) {
  fetchTemps((jsonTemp) => {
    const settings = getGuiSettings();
    chartDataTable.addRow(toRowArray(jsonTemp, settings));

    chartDataTable.setColumnLabel(1, "Min " + settings.minTemp + "°C");
    chartDataTable.setColumnLabel(2, "Max " + settings.maxTemp + "°C");
    for (var i = 0; i < jsonTemp.temps.length; i++) {
      //Update column label names (could have changed)
      const customName = document.getElementById(jsonTemp.temps[i].id + "_name").value;
      chartDataTable.setColumnLabel(i + 3, customName);

      //Beep
      const currentTemp = jsonTemp.temps[i].t;
      if (currentTemp < minTemp || currentTemp > maxTemp) {
        beep();
      }

      //Update gauge names and values
      gaugeDataTable.setValue(i, 0, customName);
      gaugeDataTable.setValue(i, 1, currentTemp);
    }

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
  });
}

function beep() {
  var sound = document.getElementById("sound1");
  sound.play();
}
