// API configuration
const API_KEY = '4d8fb5b93d4af21d66a2948710284366';
const API_BASE_URL = 'https://api.openweathermap.org/data/2.5';

// DOM elements
const searchInput = document.getElementById('search');
const searchBtn = document.getElementById('searchBtn');
const errorDiv = document.getElementById('error');
const weatherCard = document.getElementById('weatherCard');
const locationElement = document.getElementById('location');
const weatherIcon = document.getElementById('weatherIcon');
const temperatureElement = document.getElementById('temperature');
const descriptionElement = document.getElementById('description');
const humidityElement = document.getElementById('humidity');
const windSpeedElement = document.getElementById('windSpeed');
const saveLocationBtn = document.getElementById('saveLocation');
const locationsList = document.getElementById('locationsList');
const forecastChart = document.getElementById('forecastChart');
const aqiElement = document.getElementById('aqi');

let chart = null;

// Event listeners
searchBtn.addEventListener('click', () => {
  const query = searchInput.value.trim();
  if (query) {
    fetchWeatherData(query);
  }
});

searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const query = searchInput.value.trim();
    if (query) {
      fetchWeatherData(query);
    }
  }
});

saveLocationBtn.addEventListener('click', saveLocation);

// Load saved locations from localStorage
let savedLocations = JSON.parse(localStorage.getItem('savedLocations') || '[]');
updateSavedLocationsList();

// Get user's location on page load
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const response = await fetch(
          `${API_BASE_URL}/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${API_KEY}`
        );
        const data = await response.json();
        if (data.cod === 200) {
          fetchWeatherData(data.name);
        }
      } catch (err) {
        showError('Failed to fetch local weather');
      }
    },
    () => {
      showError('Unable to get location. Please search for a city.');
    }
  );
}

async function fetchWeatherData(location) {
  try {
    showError('');
    
    // Fetch current weather
    const response = await fetch(
      `${API_BASE_URL}/weather?q=${location}&units=metric&appid=${API_KEY}`
    );
    const data = await response.json();
    
    if (data.cod !== 200) {
      throw new Error(data.message);
    }

    // Update UI with current weather
    updateWeatherUI(data);

    // Fetch and update forecast
    const forecastResponse = await fetch(
      `${API_BASE_URL}/forecast?q=${location}&units=metric&appid=${API_KEY}`
    );
    const forecastData = await forecastResponse.json();
    
    updateForecastChart(forecastData);

    // Fetch and update AQI
    const aqiResponse = await fetch(
      `${API_BASE_URL}/air_pollution?lat=${data.coord.lat}&lon=${data.coord.lon}&appid=${API_KEY}`
    );
    const aqiData = await aqiResponse.json();
    
    updateAQI(aqiData);

    weatherCard.classList.remove('hidden');
    forecastChart.classList.remove('hidden');
  } catch (err) {
    showError(err.message || 'Failed to fetch weather data');
  }
}

function updateWeatherUI(data) {
  locationElement.textContent = data.name;
  weatherIcon.src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
  weatherIcon.alt = data.weather[0].description;
  temperatureElement.textContent = `${Math.round(data.main.temp)}°C`;
  descriptionElement.textContent = data.weather[0].description;
  humidityElement.textContent = `${data.main.humidity}% Humidity`;
  windSpeedElement.textContent = `${data.wind.speed} m/s`;

  saveLocationBtn.disabled = savedLocations.some(loc => loc.name === data.name);
}

function updateForecastChart(data) {
  const dailyData = data.list
    .filter((_, index) => index % 8 === 0)
    .slice(0, 5)
    .map(item => ({
      date: new Date(item.dt_txt).toLocaleDateString('en-US', { weekday: 'short' }),
      temp: Math.round(item.main.temp)
    }));

  if (chart) {
    chart.destroy();
  }

  const ctx = document.getElementById('chart').getContext('2d');
  
  // Create gradient for the line
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(0, 255, 157, 0.5)');
  gradient.addColorStop(1, 'rgba(0, 255, 157, 0)');

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dailyData.map(d => d.date),
      datasets: [{
        label: 'Temperature (°C)',
        data: dailyData.map(d => d.temp),
        borderColor: '#00ff9d',
        backgroundColor: gradient,
        tension: 0.4,
        fill: true,
        borderWidth: 3,
        pointBackgroundColor: '#00ff9d',
        pointBorderColor: '#1f2937',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#1f2937',
          titleColor: '#ffffff',
          bodyColor: '#00ff9d',
          borderColor: '#374151',
          borderWidth: 1,
          padding: 12,
          displayColors: false
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: {
            color: '#374151',
            drawBorder: false
          },
          ticks: {
            callback: value => `${value}°C`,
            color: '#9ca3af'
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#9ca3af'
          }
        }
      }
    }
  });
}

function updateAQI(data) {
  const aqi = data.list[0].main.aqi;
  const aqiText = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'][aqi - 1];
  aqiElement.textContent = `Air Quality: ${aqiText} (${aqi})`;
}

function saveLocation() {
  const locationName = locationElement.textContent;
  if (locationName && !savedLocations.some(loc => loc.name === locationName)) {
    const newLocation = {
      id: Date.now().toString(),
      name: locationName
    };
    savedLocations.push(newLocation);
    localStorage.setItem('savedLocations', JSON.stringify(savedLocations));
    updateSavedLocationsList();
    saveLocationBtn.disabled = true;
  }
}

function updateSavedLocationsList() {
  locationsList.innerHTML = savedLocations.length === 0
    ? '<li>No saved locations yet</li>'
    : savedLocations.map(location => `
        <li>
          <span onclick="fetchWeatherData('${location.name}')">${location.name}</span>
          <button onclick="removeLocation('${location.id}')">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </li>
      `).join('');
}

function removeLocation(id) {
  savedLocations = savedLocations.filter(loc => loc.id !== id);
  localStorage.setItem('savedLocations', JSON.stringify(savedLocations));
  updateSavedLocationsList();
  
  const currentLocation = locationElement.textContent;
  const wasRemoved = !savedLocations.some(loc => loc.name === currentLocation);
  if (wasRemoved) {
    saveLocationBtn.disabled = false;
  }
}

function showError(message) {
  errorDiv.textContent = message;
  errorDiv.style.display = message ? 'block' : 'none';
}