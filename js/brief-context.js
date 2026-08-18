// Tính context Daily Brief từ dữ liệu pins + user. Hàm thuần, không đụng DOM.
(function(){
  const LEADER_ROLE = 'Lãnh đạo phòng';

  function daysUntil(deadline, now){
    if(!deadline) return null;
    const today = new Date(now); today.setHours(0,0,0,0);
    const d = new Date(deadline + 'T00:00:00');
    return Math.round((d - today) / 86400000);
  }

  function isMine(p, user){
    if(!user) return false;
    const people = p.people || [];
    return people.includes(user.display) || people.includes(user.team) || p.author === user.display;
  }

  function isHighPriority(p){
    return p.priority === 'ttkhan' || p.priority === 'tkhan';
  }

  function needsAttention(p, now){
    if(p.done) return false;
    const days = daysUntil(p.deadline, now);
    return p.starred || isHighPriority(p) || (days !== null && days <= 3);
  }

  // Pin có thành phần tham gia thuộc từ 2 tổ khác nhau trở lên (cần phối hợp liên tổ)
  function isCrossTeam(p, teams, members){
    const people = p.people || [];
    const memberTeam = {};
    (members || []).forEach(m => { memberTeam[m.displayName] = m.team; });
    const set = new Set();
    people.forEach(x => {
      if(teams.includes(x)) set.add(x);
      else if(memberTeam[x]) set.add(memberTeam[x]);
    });
    return set.size >= 2;
  }

  function timeOfDay(now, cfg){
    const t = (cfg && cfg.timeOfDay) || {morningEnd:11, noonEnd:13, afternoonEnd:18};
    const h = now.getHours();
    if(h < t.morningEnd) return 'morning';
    if(h < t.noonEnd) return 'noon';
    if(h < t.afternoonEnd) return 'afternoon';
    return 'evening';
  }

  function activeEvent(now, cfg){
    const events = (cfg && cfg.events) || [];
    const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
    const cur = y * 10000 + m * 100 + d;
    for(const ev of events){
      if(ev.annual){
        const start = y * 10000 + ev.annual[0] * 100 + ev.annual[1];
        const end = ev.annualEnd ? y * 10000 + ev.annualEnd[0] * 100 + ev.annualEnd[1] : start;
        if(cur >= start && cur <= end) return ev;
      }
      if(ev.ranges){
        const iso = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        for(const [a, b] of ev.ranges){
          if(iso >= a && iso <= b) return ev;
        }
      }
    }
    return null;
  }

  // Tổng hợp toàn bộ context cho template engine
  function build({pins, user, teams, members, now, weather}){
    now = now || new Date();
    const cfg = window.BRIEF_CONFIG || {};
    // lãnh đạo phòng không thuộc tổ nào — brief tổng hợp toàn phòng thay vì cá nhân
    const isLeader = !!user && user.team === LEADER_ROLE;
    const pool = isLeader ? (pins || []) : (pins || []).filter(p => isMine(p, user));
    const open = pool.filter(p => !p.done);

    const attention = open.filter(p => needsAttention(p, now));
    const highPrio = open.filter(isHighPriority);
    let overdue = 0, dueToday = 0, dueSoon = 0;
    open.forEach(p => {
      const days = daysUntil(p.deadline, now);
      if(days === null) return;
      if(days < 0) overdue++;
      else if(days === 0) dueToday++;
      else if(days <= 3) dueSoon++;
    });

    const unseen = (pins || []).filter(p =>
      !p.done && user && p.author !== user.display && !(p.viewers || []).includes(user.display)
    ).length;

    const crossTeam = open.filter(p => isCrossTeam(p, teams || [], members || [])).length;

    const busyAt = cfg.busyThreshold || 5;
    const load = attention.length >= busyAt ? 'busy' : attention.length > 0 ? 'normal' : 'free';

    return {
      name: user ? user.display : 'bạn',
      hour: now.getHours(),
      dayPart: timeOfDay(now, cfg),
      weather: weather ? weather.kind : null,
      temp: weather ? weather.temp : null,
      event: activeEvent(now, cfg),
      attention: attention.length,
      highPrio: highPrio.length,
      overdue, dueToday, dueSoon,
      unseen, crossTeam, load, isLeader
    };
  }

  window.BriefContext = { build, timeOfDay, activeEvent };
})();
