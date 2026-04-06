import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getUser } from '../_shared/supabase.ts';

const WEATHER_API_KEY = Deno.env.get('WEATHER_API_KEY')!;

async function getWeather(city = 'Istanbul') {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},TR&units=metric&lang=tr&appid=${WEATHER_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Hava durumu alınamadı');

  const data = await response.json();
  const conditionMap: Record<string, string> = {
    Clear: 'gunesli', Clouds: 'bulutlu', Rain: 'yagmurlu',
    Drizzle: 'ciseleme', Thunderstorm: 'firtinali', Snow: 'karli',
    Mist: 'sisli', Fog: 'sisli', Haze: 'puslu',
  };

  return {
    temp: Math.round(data.main.temp),
    feels_like: Math.round(data.main.feels_like),
    humidity: data.main.humidity,
    description: data.weather[0].description,
    icon: data.weather[0].icon,
    wind_speed: data.wind.speed,
    condition: conditionMap[data.weather[0].main] || 'normal',
  };
}

function getClothingAdvice(weather: any) {
  const temp = weather.temp;
  let advice = { warmth_min: 1, warmth_max: 5, needs_outerwear: false, rain_gear: false };

  if (temp >= 30) {
    advice = { warmth_min: 1, warmth_max: 2, needs_outerwear: false, rain_gear: false };
  } else if (temp >= 20) {
    advice = { warmth_min: 1, warmth_max: 3, needs_outerwear: false, rain_gear: false };
  } else if (temp >= 10) {
    advice = { warmth_min: 2, warmth_max: 4, needs_outerwear: true, rain_gear: false };
  } else if (temp >= 0) {
    advice = { warmth_min: 3, warmth_max: 5, needs_outerwear: true, rain_gear: false };
  } else {
    advice = { warmth_min: 4, warmth_max: 5, needs_outerwear: true, rain_gear: false };
  }

  if (['yagmurlu', 'ciseleme', 'firtinali'].includes(weather.condition)) {
    advice.rain_gear = true;
  }

  return advice;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    await getUser(req); // auth check

    const url = new URL(req.url);
    const city = url.searchParams.get('city') || 'Istanbul';

    const weather = await getWeather(city);
    const clothingAdvice = getClothingAdvice(weather);

    return new Response(
      JSON.stringify({ weather, clothing_advice: clothingAdvice }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const status = err.message === 'Unauthorized' ? 401 : 500;
    return new Response(
      JSON.stringify({ error: err.message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
