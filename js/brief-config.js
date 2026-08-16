// Cấu hình Daily Brief: thời điểm trong ngày, ngưỡng bận, ngày lễ/sự kiện + decoration header.
// Muốn thêm lễ/sự kiện hoặc đổi decoration: chỉ sửa file này.
(function(){
  window.BRIEF_CONFIG = {
    // Thời tiết (Open-Meteo, không cần key). Tắt bằng enabled:false.
    weather: {
      enabled: true,
      latitude: 21.03,   // Hà Nội — đổi theo vị trí phòng
      longitude: 105.85,
      cacheMinutes: 30
    },

    // Ranh giới thời điểm trong ngày (giờ, 24h)
    timeOfDay: { morningEnd: 11, noonEnd: 13, afternoonEnd: 18 },

    // Số pin "cần chú ý" từ mức này trở lên coi là ngày bận
    busyThreshold: 5,

    // Ngày lễ / sự kiện đặc biệt.
    // - annual: [tháng, ngày] (+ annualEnd nếu kéo dài nhiều ngày) — lặp lại hàng năm theo dương lịch.
    // - ranges: các khoảng ngày dương cụ thể — dùng cho lễ âm lịch (Tết, Trung thu), cần bổ sung mỗi năm.
    // - emojis: decoration hiện ở header trong dịp đó.
    events: [
      {id:'newyear',   label:'Năm mới',        emojis:['🎉','✨'], annual:[1,1]},
      {id:'tet',       label:'Tết',            emojis:['🌸','🧧'], ranges:[['2026-02-14','2026-02-22']]},
      {id:'women83',   label:'8/3',            emojis:['🌷','💐'], annual:[3,8]},
      {id:'thongnhat', label:'30/4 – 1/5',     emojis:['🇻🇳','🎉'], annual:[4,30], annualEnd:[5,1]},
      {id:'quockhanh', label:'Quốc khánh',     emojis:['🇻🇳','⭐'], annual:[9,2]},
      {id:'trungthu',  label:'Trung thu',      emojis:['🌕','🏮'], ranges:[['2026-09-24','2026-09-26']]},
      {id:'phunu2010', label:'20/10',          emojis:['🌷','💐'], annual:[10,20]},
      {id:'nhagiao',   label:'Ngày Nhà giáo',  emojis:['🌼','📚'], annual:[11,20]},
      {id:'noel',      label:'Noel',           emojis:['🎄','❄️'], annual:[12,24], annualEnd:[12,25]}
    ],

    // Decoration theo thời tiết (khi không có sự kiện nào)
    weatherDeco: {
      rain: ['🌧️','💧'],
      storm: ['⛈️','🌧️']
    }
  };
})();
