// Lớp điều phối Daily Brief: gom context (brief-context) + thời tiết (weather)
// + template (brief-templates) + config (brief-config), rồi render vào header.
// Gọi từ app.js: Brief.update({user, pins, teams, members})
(function(){
  let weather = null;
  let weatherLoaded = false;
  let lastData = null;

  // Chọn template: lấy nhóm priority cao nhất trong các template match,
  // rồi random nhẹ 1 câu trong nhóm đó — random có điều kiện, không random hoàn toàn.
  // Giữ nguyên câu trong suốt phiên xem (chỉ đổi khi mở/refresh trang).
  let sessionRoll = Math.random();
  function pickTemplate(ctx){
    const matched = (window.BRIEF_TEMPLATES || []).filter(t => t.match(ctx));
    if(!matched.length) return null;
    const top = Math.max(...matched.map(t => t.priority));
    const pool = matched.filter(t => t.priority === top);
    return pool[Math.floor(sessionRoll * pool.length)];
  }

  // Decoration chỉ trong header: sự kiện > thời tiết mưa/bão > không có
  function decoEmojis(ctx){
    if(ctx.event) return ctx.event.emojis;
    const wd = (window.BRIEF_CONFIG || {}).weatherDeco || {};
    if(ctx.weather && wd[ctx.weather]) return wd[ctx.weather];
    return [];
  }

  function esc(s){
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function render(){
    const el = document.getElementById('greetingLine');
    if(!el || !lastData) return;
    const ctx = window.BriefContext.build({...lastData, weather});
    const tpl = pickTemplate(ctx);
    el.textContent = tpl ? tpl.text(ctx) : '';

    const deco = document.getElementById('briefDeco');
    if(deco){
      const emojis = decoEmojis(ctx);
      deco.innerHTML = emojis.length
        ? [0,1,2,3].map(i => `<span class="deco-item deco-${i}">${esc(emojis[i % emojis.length])}</span>`).join('')
        : '';
    }
  }

  function update(data){
    lastData = data;
    render();
    if(!weatherLoaded && window.WeatherHelper){
      weatherLoaded = true;
      window.WeatherHelper.getWeather().then(w => {
        if(w){ weather = w; render(); }
      });
    }
  }

  window.Brief = { update };
})();
