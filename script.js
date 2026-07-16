const WEATHER_CODES = {
  0: ["Céu limpo", "☀️"],
  1: ["Predominantemente ensolarado", "🌤️"],
  2: ["Parcialmente nublado", "⛅"],
  3: ["Nublado", "☁️"],
  45: ["Neblina", "🌫️"],
  48: ["Neblina com geada", "🌫️"],
  51: ["Garoa leve", "🌦️"],
  53: ["Garoa moderada", "🌦️"],
  55: ["Garoa forte", "🌧️"],
  56: ["Garoa gelada", "🌧️"],
  57: ["Garoa gelada forte", "🌧️"],
  61: ["Chuva leve", "🌧️"],
  63: ["Chuva moderada", "🌧️"],
  65: ["Chuva forte", "🌧️"],
  66: ["Chuva gelada", "🌧️"],
  67: ["Chuva gelada forte", "🌧️"],
  71: ["Neve leve", "🌨️"],
  73: ["Neve moderada", "🌨️"],
  75: ["Neve forte", "❄️"],
  77: ["Grãos de neve", "❄️"],
  80: ["Pancadas de chuva leves", "🌦️"],
  81: ["Pancadas de chuva moderadas", "🌧️"],
  82: ["Pancadas de chuva fortes", "⛈️"],
  85: ["Pancadas de neve leves", "🌨️"],
  86: ["Pancadas de neve fortes", "❄️"],
  95: ["Trovoada", "⛈️"],
  96: ["Trovoada com granizo leve", "⛈️"],
  99: ["Trovoada com granizo forte", "⛈️"],
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const heroSection = $("hero");
const hourlyCard = $("hourly-card");
const forecastCard = $("forecast-card");

function describeWeather(code) {
  return WEATHER_CODES[code] || ["Condição desconhecida", "❔"];
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("hidden", !message);
  statusEl.style.color = isError ? "#ffd4d4" : "";
}

async function geocodeCity(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=pt&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao buscar a cidade.");
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error("Cidade não encontrada.");
  }
  const { latitude, longitude, name: foundName, admin1, country } = data.results[0];
  const label = [foundName, admin1, country].filter(Boolean).join(", ");
  return { latitude, longitude, label };
}

async function fetchWeather(latitude, longitude) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&hourly=temperature_2m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&forecast_days=4` +
    `&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao buscar a previsão do tempo.");
  return res.json();
}

function isSunnyCode(code) {
  return code === 0 || code === 1;
}

function applyBackground(code) {
  document.body.classList.toggle("weather-cloudy", !isSunnyCode(code));
}

function renderHero(label, tag, data) {
  const current = data.current;
  const [desc, icon] = describeWeather(current.weather_code);
  applyBackground(current.weather_code);

  $("hero-tag").textContent = tag ? `📍 ${tag}` : "";
  $("current-city").textContent = label;
  $("current-temp").textContent = `${Math.round(current.temperature_2m)}°`;
  $("current-desc").textContent = `${icon} ${desc}`;

  const today = data.daily;
  $("hero-minmax").textContent =
    `Máx.: ${Math.round(today.temperature_2m_max[0])}°  Mín.: ${Math.round(today.temperature_2m_min[0])}°`;

  heroSection.classList.remove("hidden");
}

function renderSummary(data) {
  const current = data.current;
  const [desc] = describeWeather(current.weather_code);
  const wind = Math.round(current.wind_speed_10m);
  $("summary-text").textContent =
    `${desc} agora, com sensação de ${Math.round(current.apparent_temperature)}°. ` +
    `Umidade em ${current.relative_humidity_2m}% e rajadas de vento a ${wind} km/h.`;
}

function renderHourly(data) {
  const { time, temperature_2m, weather_code } = data.hourly;
  const now = new Date(data.current.time);
  const list = $("hourly-list");
  list.innerHTML = "";

  const todayStr = now.toDateString();
  let nowCard = null;

  time.forEach((t, idx) => {
    const date = new Date(t);
    if (date.toDateString() !== todayStr) return;

    const [desc, icon] = describeWeather(weather_code[idx]);
    const isNow = date.getHours() === now.getHours();

    const card = document.createElement("div");
    card.className = "hour-card" + (isNow ? " is-now" : "");
    card.title = desc;
    card.innerHTML = `
      <div class="hour-time">${isNow ? "Agora" : date.toLocaleTimeString("pt-BR", { hour: "2-digit" })}</div>
      <div class="hour-icon">${icon}</div>
      <div class="hour-temp">${Math.round(temperature_2m[idx])}°</div>
    `;
    if (isNow) nowCard = card;
    list.appendChild(card);
  });

  hourlyCard.classList.remove("hidden");
  if (nowCard) {
    nowCard.scrollIntoView({ block: "nearest", inline: "start" });
  }
}

const TEMP_SCALE_MIN = -10;
const TEMP_SCALE_MAX = 40;

function tempToPct(temp) {
  return Math.min(Math.max(((temp - TEMP_SCALE_MIN) / (TEMP_SCALE_MAX - TEMP_SCALE_MIN)) * 100, 0), 100);
}

function renderForecast(data) {
  const { time, weather_code, temperature_2m_max, temperature_2m_min } = data.daily;
  const currentTemp = data.current.temperature_2m;
  const list = $("forecast-list");
  list.innerHTML = "";

  time.forEach((dateStr, i) => {
    const [desc, icon] = describeWeather(weather_code[i]);
    const date = new Date(dateStr + "T00:00:00");
    const dayName = i === 0 ? "Hoje" : WEEKDAYS[date.getDay()];
    const dayMin = temperature_2m_min[i];
    const dayMax = temperature_2m_max[i];

    const leftPct = tempToPct(dayMin);
    const rightPct = tempToPct(dayMax);

    let dotHtml = "";
    if (i === 0) {
      const dotPct = tempToPct(currentTemp);
      dotHtml = `<span class="bar-dot" style="left:${dotPct}%"></span>`;
    }

    const row = document.createElement("div");
    row.className = "daily-row";
    row.title = desc;
    row.innerHTML = `
      <span class="day-name">${dayName}</span>
      <span class="day-icon">${icon}</span>
      <span class="day-min">${Math.round(dayMin)}°</span>
      <span class="bar-track">
        <span class="bar-dim" style="left:0; width:${leftPct}%"></span>
        <span class="bar-dim" style="left:${rightPct}%; width:${100 - rightPct}%"></span>
        ${dotHtml}
      </span>
      <span class="day-max">${Math.round(dayMax)}°</span>
    `;
    list.appendChild(row);
  });

  forecastCard.classList.remove("hidden");
}

async function loadByCoords(latitude, longitude, label, tag) {
  setStatus("Carregando previsão...");
  heroSection.classList.add("hidden");
  hourlyCard.classList.add("hidden");
  forecastCard.classList.add("hidden");
  try {
    const data = await fetchWeather(latitude, longitude);
    renderHero(label, tag, data);
    renderSummary(data);
    renderHourly(data);
    renderForecast(data);
    setStatus("");
  } catch (err) {
    setStatus(err.message || "Ocorreu um erro.", true);
  }
}

async function loadByCity(cityName) {
  setStatus("Buscando cidade...");
  heroSection.classList.add("hidden");
  hourlyCard.classList.add("hidden");
  forecastCard.classList.add("hidden");
  try {
    const { latitude, longitude, label } = await geocodeCity(cityName);
    await loadByCoords(latitude, longitude, label, "");
  } catch (err) {
    setStatus(err.message || "Ocorreu um erro.", true);
  }
}

$("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const city = $("city-input").value.trim();
  if (city) loadByCity(city);
});

$("locate-btn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Geolocalização não é suportada neste navegador.", true);
    return;
  }
  setStatus("Obtendo sua localização...");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      loadByCoords(pos.coords.latitude, pos.coords.longitude, "Sua localização", "Localização atual");
    },
    () => {
      setStatus("Não foi possível obter sua localização.", true);
    }
  );
});
