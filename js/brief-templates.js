// Template Daily Brief. Muốn thêm biến thể: thêm 1 object vào mảng BRIEF_TEMPLATES.
// Mỗi template: {id, priority, match(ctx), text(ctx)}
//  - priority: 3 = lễ/sự kiện, 2 = thời tiết / tình huống đặc thù, 1 = chung.
//  - Engine chọn nhóm priority cao nhất trong các template match, rồi chọn 1 theo seed ngày (không random hoàn toàn).
// Các trường của ctx: xem js/brief-context.js (name, dayPart, weather, event, attention, highPrio, overdue, dueToday, dueSoon, unseen, crossTeam, load).
(function(){
  // ---- các cụm câu dùng chung ----
  function statusLine(c){
    if(c.attention === 0) return 'Hôm nay bạn không có lưu ý khẩn nào.';
    let s = `Hôm nay bạn có ${c.attention} lưu ý cần chú ý`;
    if(c.highPrio > 0) s += `, trong đó ${c.highPrio} việc ưu tiên cao`;
    return s + '.';
  }
  function deadlineLine(c){
    const bits = [];
    if(c.overdue > 0) bits.push(`${c.overdue} việc đã quá hạn`);
    if(c.dueToday > 0) bits.push(`${c.dueToday} deadline hôm nay`);
    if(c.dueSoon > 0) bits.push(`${c.dueSoon} deadline sắp tới`);
    return bits.length ? 'Có ' + bits.join(', ') + '.' : '';
  }
  function unseenLine(c){
    return c.unseen > 0 ? `Có ${c.unseen} pin mới bạn chưa xem đấy.` : '';
  }
  function hello(c){
    const by = {morning:'Chào buổi sáng', noon:'Buổi trưa vui vẻ', afternoon:'Chào buổi chiều', evening:'Buổi tối an lành'};
    return `${by[c.dayPart]} ${c.name} 👋`;
  }

  window.BRIEF_TEMPLATES = [
    // ---- Lễ / sự kiện (priority 3) ----
    {id:'event-busy', priority:3,
      match: c => !!c.event && c.attention > 0,
      text: c => `${c.event.emojis[0]} ${c.event.label} rồi, chúc ${c.name} một ngày thật vui! Nhưng đừng quên: ${statusLine(c).toLowerCase()} ${deadlineLine(c)}`},
    {id:'event-free', priority:3,
      match: c => !!c.event && c.attention === 0,
      text: c => `${c.event.emojis.join(' ')} ${c.event.label} vui vẻ nhé ${c.name}! Bảng ghim hôm nay yên bình, không có lưu ý khẩn nào — tận hưởng ngày lễ thôi.`},

    // ---- Thời tiết / tình huống đặc thù (priority 2) ----
    {id:'rain-free', priority:2,
      match: c => (c.weather === 'rain' || c.weather === 'storm') && c.attention === 0,
      text: c => `🌧️ Trời đang mưa, mà bảng ghim hôm nay cũng khá yên bình. Bạn không có lưu ý khẩn nào, cứ từ từ thôi nhé ${c.name}.`},
    {id:'rain-busy', priority:2,
      match: c => (c.weather === 'rain' || c.weather === 'storm') && c.attention > 0,
      text: c => `🌧️ Ngoài trời mưa, trong bảng ghim cũng "mưa" việc nhẹ: ${statusLine(c).toLowerCase().replace('hôm nay ','')} ${deadlineLine(c)}`},
    {id:'hot-day', priority:2,
      match: c => c.weather === 'clear' && c.temp !== null && c.temp >= 34,
      text: c => `☀️ ${c.temp}°C — trời nóng đấy, nhớ uống nước nhé ${c.name}. ${statusLine(c)} ${unseenLine(c)}`},
    {id:'cold-day', priority:2,
      match: c => c.temp !== null && c.temp <= 15,
      text: c => `🧣 Trời lạnh ${c.temp}°C, giữ ấm nhé ${c.name}. ${statusLine(c)} ${deadlineLine(c)}`},
    {id:'overdue-alert', priority:2,
      match: c => c.overdue > 0,
      text: c => `${hello(c)} Nhắc nhỏ: bạn đang có ${c.overdue} việc quá hạn cần xử lý sớm${c.dueToday > 0 ? `, cộng thêm ${c.dueToday} deadline hôm nay` : ''}. Xem ngay bên dưới nhé.`},
    {id:'due-today', priority:2,
      match: c => c.overdue === 0 && c.dueToday > 0,
      text: c => `${hello(c)} Hôm nay có ${c.dueToday} deadline đến hạn — ưu tiên xử lý trước nhé. ${unseenLine(c)}`},
    {id:'cross-team', priority:2,
      match: c => c.crossTeam >= 2 && c.attention > 0,
      text: c => `${hello(c)} Có ${c.crossTeam} việc cần phối hợp liên tổ đang chờ. ${statusLine(c)}`},
    {id:'very-busy', priority:2,
      match: c => c.load === 'busy',
      text: c => `🔥 Hôm nay hơi bận một chút đấy ${c.name}. Bạn có ${c.attention} pin cần chú ý${c.highPrio > 0 ? `, ${c.highPrio} việc ưu tiên cao` : ''}. Làm từng việc một thôi nhé.`},

    // ---- Chung theo thời điểm trong ngày (priority 1) ----
    {id:'morning-1', priority:1,
      match: c => c.dayPart === 'morning',
      text: c => `Chào ${c.name} 👋 Một ngày mới bắt đầu rồi ☕ ${statusLine(c)} ${deadlineLine(c)}`},
    {id:'morning-2', priority:1,
      match: c => c.dayPart === 'morning',
      text: c => `☀️ Chào buổi sáng ${c.name}! ${statusLine(c)} ${unseenLine(c)}`},
    {id:'noon-1', priority:1,
      match: c => c.dayPart === 'noon',
      text: c => `🍚 Trưa rồi ${c.name}, ăn gì chưa? ${statusLine(c)} Nghỉ chút rồi làm tiếp nhé.`},
    {id:'noon-2', priority:1,
      match: c => c.dayPart === 'noon',
      text: c => `${hello(c)} Tranh thủ giờ trưa lướt qua bảng ghim chút: ${statusLine(c).toLowerCase()} ${unseenLine(c)}`},
    {id:'afternoon-1', priority:1,
      match: c => c.dayPart === 'afternoon',
      text: c => `${hello(c)} Buổi chiều rồi, chạy nốt cho gọn nhé. ${statusLine(c)} ${deadlineLine(c)}`},
    {id:'afternoon-2', priority:1,
      match: c => c.dayPart === 'afternoon',
      text: c => `🕒 Chiều nay thế nào ${c.name}? ${statusLine(c)} ${unseenLine(c)}`},
    {id:'evening-1', priority:1,
      match: c => c.dayPart === 'evening',
      text: c => `🌙 Tối rồi ${c.name}, còn ghé bảng ghim là chăm đấy. ${statusLine(c)} Xong sớm nghỉ sớm nhé.`},
    {id:'evening-2', priority:1,
      match: c => c.dayPart === 'evening',
      text: c => `${hello(c)} Điểm nhanh trước khi nghỉ: ${statusLine(c).toLowerCase()} ${deadlineLine(c)}`},
    {id:'free-day', priority:1,
      match: c => c.load === 'free',
      text: c => `${hello(c)} Bảng ghim của bạn đang nhẹ nhàng — không có lưu ý khẩn nào. ${c.unseen > 0 ? unseenLine(c) : 'Ngó qua việc của phòng một vòng nhé.'}`},
    {id:'fallback', priority:0,
      match: () => true,
      text: c => `Chào ${c.name} 👋 — đây là mọi thứ phòng đang cần đọc, cần làm hôm nay. ${statusLine(c)}`}
  ];
})();
