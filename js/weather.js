// Helper thời tiết: gọi Open-Meteo (miễn phí, không cần key), cache localStorage.
// Trả về {kind, temp} với kind: 'clear' | 'cloudy' | 'fog' | 'rain' | 'storm' | 'snow', hoặc null nếu lỗi/tắt.
(function(){
  const CACHE_KEY = 'ttp_weather_v1';

  // WMO weather code → nhóm đơn giản
  function kindOf(code){
    if(code === 0 || code === 1) return 'clear';
    if(code === 2 || code === 3) return 'cloudy';
    if(code === 45 || code === 48) return 'fog';
    if(code >= 51 && code <= 67) return 'rain';
    if(code >= 71 && code <= 77) return 'snow';
    if(code >= 80 && code <= 82) return 'rain';
    if(code >= 85 && code <= 86) return 'snow';
    if(code >= 95) return 'storm';
    return 'cloudy';
  }

  async function getWeather(){
    const cfg = (window.BRIEF_CONFIG || {}).weather || {};
    if(!cfg.enabled) return null;

    try{
      const raw = localStorage.getItem(CACHE_KEY);
      if(raw){
        const cached = JSON.parse(raw);
        if(Date.now() - cached.ts < (cfg.cacheMinutes || 30) * 60000) return cached.data;
      }
    }catch(e){}

    try{
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${cfg.latitude}&longitude=${cfg.longitude}&current=temperature_2m,weather_code`;
      const res = await fetch(url);
      if(!res.ok) throw new Error('weather http ' + res.status);
      const json = await res.json();
      const cur = json.current || {};
      const data = {kind: kindOf(cur.weather_code), temp: Math.round(cur.temperature_2m)};
      localStorage.setItem(CACHE_KEY, JSON.stringify({ts: Date.now(), data}));
      return data;
    }catch(e){
      console.warn('Không lấy được thời tiết:', e);
      return null;
    }
  }

  window.WeatherHelper = { getWeather };
})();
