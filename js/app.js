(function(){
  const USER_KEY = 'ttp_user_v1';

  let COLLECTIONS = [];
  let TEAMS = [];
  let pins = [];

  let user = null;
  let search = '';
  let activeFilter = 'all';
  let activeTeam = null;
  let composerPriority = 'bt';
  let composerColl = 'viec';
  let composerPeople = [];
  let editingId = null;

  const PRIORITY_META = {
    ttkhan:{label:'Thượng thượng khẩn', color:'var(--pr-ttkhan)'},
    tkhan:{label:'Thượng khẩn', color:'var(--pr-tkhan)'},
    khan:{label:'Khẩn', color:'var(--pr-khan)'},
    bt:{label:'Bình thường', color:'var(--pr-bt)'}
  };
  const PRIORITY_HEX = {ttkhan:'#B8291B', tkhan:'#E4574B', khan:'#E7A93B', bt:'#9AA394'};
  const AVATAR_COLORS = ['#E4574B','#3C7DBF','#3E9B75','#B5862B','#7C6FD1','#D46FA6'];

  /* ---------- helpers ---------- */
  function hexToRgba(hex, alpha){
    const h = hex.replace('#','');
    const r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  function collOf(id){ return COLLECTIONS.find(c=>c.id===id) || {label:'Khác', bg:'var(--col-neutral)', ink:'var(--col-neutral-ink)'}; }
  function initials(name){ return (name||'?').trim().split(/\s+/).slice(-2).map(w=>w[0]).join('').toUpperCase(); }
  function avatarColor(name){
    let h=0; for(const c of (name||'')) h = (h*31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
    return AVATAR_COLORS[h];
  }
  function esc(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fmtDate(iso){
    if(!iso) return '';
    const d = new Date(iso+'T00:00:00');
    return d.toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'});
  }
  function timeAgo(ts){
    if(!ts) return '';
    const t = typeof ts === 'number' ? ts : new Date(ts).getTime();
    const m = Math.floor((Date.now()-t)/60000);
    if(m<1) return 'vừa xong';
    if(m<60) return m+' phút trước';
    const h = Math.floor(m/60);
    if(h<24) return h+' giờ trước';
    return Math.floor(h/24)+' ngày trước';
  }
  function urgency(deadline){
    if(!deadline) return 'none';
    const today = new Date(); today.setHours(0,0,0,0);
    const d = new Date(deadline+'T00:00:00');
    const days = Math.round((d-today)/86400000);
    if(days < 0) return 'overdue';
    if(days === 0) return 'today';
    if(days <= 3) return 'soon';
    return 'later';
  }
  const URG_META = {
    overdue:{label:'Quá hạn', color:'var(--urg-red)'},
    today:{label:'Hôm nay', color:'var(--urg-red)'},
    soon:{label:'Sắp đến hạn', color:'var(--urg-amber)'},
    later:{label:null, color:'var(--urg-sage)'},
    none:{label:null, color:null}
  };

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg){
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }
  function fail(err, msg){
    console.error(err);
    toast(msg || 'Có lỗi xảy ra, thử lại nhé.');
  }

  /* ---------- onboarding (localStorage) ---------- */
  const gate = document.getElementById('gate');
  function loadUser(){
    try{ return JSON.parse(localStorage.getItem(USER_KEY)); }catch(e){ return null; }
  }
  function saveUser(u){ localStorage.setItem(USER_KEY, JSON.stringify(u)); }
  function renderTeamList(){
    document.getElementById('teamList').innerHTML = TEAMS.map(t => `<option value="${esc(t)}">`).join('');
  }
  document.getElementById('gEnter').addEventListener('click', async () => {
    const name = document.getElementById('gName').value.trim();
    const team = document.getElementById('gTeam').value.trim();
    if(!name){ document.getElementById('gName').focus(); return; }
    user = {name, team: team || 'Chưa rõ tổ'};
    saveUser(user);
    gate.style.display = 'none';
    renderWhoami();
    if(team && !TEAMS.includes(team)){
      try{ await Store.addTeam(team); TEAMS.push(team); renderTeamList(); }catch(e){ fail(e); }
    }
    render();
  });

  function renderWhoami(){
    if(!user) return;
    document.getElementById('whoami').innerHTML = `
      <div class="avatar" style="background:${avatarColor(user.name)}">${initials(user.name)}</div>
      <div class="txt"><b>${esc(user.name)}</b><span>${esc(user.team)}</span></div>
      <button id="editWho">đổi</button>
    `;
    document.getElementById('editWho').addEventListener('click', () => {
      document.getElementById('gName').value = user.name;
      document.getElementById('gTeam').value = user.team === 'Chưa rõ tổ' ? '' : user.team;
      gate.style.display = 'flex';
    });
    document.getElementById('greetingLine').innerHTML = `Chào <b>${esc(user.name)}</b> 👋 — đây là mọi thứ phòng đang cần đọc, cần làm hôm nay.`;
  }

  /* ---------- composer ---------- */
  const composer = document.getElementById('composer');
  document.getElementById('composerHead').addEventListener('click', () => {
    composer.classList.toggle('open');
  });
  document.getElementById('cCancel').addEventListener('click', () => {
    composer.classList.remove('open');
    clearComposer();
  });
  document.getElementById('cPrioritySeg').addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if(!btn) return;
    composerPriority = btn.dataset.v;
    [...e.currentTarget.children].forEach(b => b.classList.toggle('on', b===btn));
  });

  let addingColl = false;
  function renderCollChips(){
    const chips = COLLECTIONS.map(c =>
      `<span class="coll-chip ${c.id===composerColl?'on':''}" data-id="${c.id}" style="background:${c.bg};color:${c.ink}">${esc(c.label)}</span>`
    ).join('');
    const adder = addingColl
      ? `<span class="add-inline"><input id="newCollInput" placeholder="Tên nhóm mới..."><button id="newCollConfirm">✓</button></span>`
      : `<span class="add-chip" id="addCollBtn">+ Nhóm mới</span>`;
    document.getElementById('cCollChips').innerHTML = chips + adder;
    document.querySelectorAll('#cCollChips .coll-chip').forEach(el => {
      el.addEventListener('click', () => { composerColl = el.dataset.id; renderCollChips(); });
    });
    if(addingColl){
      const input = document.getElementById('newCollInput');
      input.focus();
      const confirm = async () => {
        const v = input.value.trim();
        addingColl = false;
        if(v){
          try{
            const coll = await Store.addCollection(v, COLLECTIONS.length);
            COLLECTIONS.push(coll);
            composerColl = coll.id;
          }catch(e){ fail(e, 'Không tạo được nhóm mới.'); }
        }
        renderCollChips();
        renderFilterChips();
      };
      document.getElementById('newCollConfirm').addEventListener('click', confirm);
      input.addEventListener('keydown', (e) => { if(e.key==='Enter') confirm(); if(e.key==='Escape'){ addingColl=false; renderCollChips(); } });
    } else {
      document.getElementById('addCollBtn').addEventListener('click', () => { addingColl = true; renderCollChips(); });
    }
  }

  let addingTeam = false;
  function renderPeopleChips(){
    const chips = TEAMS.map(t =>
      `<span class="team-chip ${composerPeople.includes(t)?'on':''}" data-t="${esc(t)}">${esc(t)}</span>`
    ).join('');
    const adder = addingTeam
      ? `<span class="add-inline"><input id="newTeamInput" placeholder="Tên tổ mới..."><button id="newTeamConfirm">✓</button></span>`
      : `<span class="add-chip" id="addTeamBtn">+ Tổ mới</span>`;
    document.getElementById('cPeopleChips').innerHTML = chips + adder;
    document.querySelectorAll('#cPeopleChips .team-chip').forEach(el => {
      el.addEventListener('click', () => {
        const t = el.dataset.t;
        composerPeople = composerPeople.includes(t) ? composerPeople.filter(x=>x!==t) : [...composerPeople, t];
        renderPeopleChips();
      });
    });
    if(addingTeam){
      const input = document.getElementById('newTeamInput');
      input.focus();
      const confirm = async () => {
        const v = input.value.trim();
        addingTeam = false;
        if(v && !TEAMS.includes(v)){
          try{
            await Store.addTeam(v);
            TEAMS.push(v);
            composerPeople.push(v);
            renderTeamList();
          }catch(e){ fail(e, 'Không thêm được tổ mới.'); }
        }
        renderPeopleChips();
      };
      document.getElementById('newTeamConfirm').addEventListener('click', confirm);
      input.addEventListener('keydown', (e) => { if(e.key==='Enter') confirm(); if(e.key==='Escape'){ addingTeam=false; renderPeopleChips(); } });
    } else {
      document.getElementById('addTeamBtn').addEventListener('click', () => { addingTeam = true; renderPeopleChips(); });
    }
  }

  function clearComposer(){
    document.getElementById('cContent').value = '';
    document.getElementById('cUrl').value = '';
    document.getElementById('cDeadline').value = '';
    document.getElementById('cStar').checked = false;
    composerPriority = 'bt'; composerColl = COLLECTIONS[0] ? COLLECTIONS[0].id : 'viec'; composerPeople = [];
    document.querySelectorAll('#cPrioritySeg button').forEach(b => b.classList.toggle('on', b.dataset.v==='bt'));
    renderCollChips();
    renderPeopleChips();
  }
  document.getElementById('cSave').addEventListener('click', async () => {
    const content = document.getElementById('cContent').value.trim();
    if(!content){ document.getElementById('cContent').focus(); return; }
    const btn = document.getElementById('cSave');
    btn.disabled = true;
    try{
      const pin = await Store.createPin({
        content,
        url: document.getElementById('cUrl').value.trim(),
        deadline: document.getElementById('cDeadline').value,
        people: [...composerPeople],
        priority: composerPriority,
        collection: composerColl,
        starred: document.getElementById('cStar').checked,
        author: user ? user.name : 'ẩn danh',
        authorTeam: user ? user.team : ''
      });
      pins.unshift(pin);
      composer.classList.remove('open');
      clearComposer();
      render();
      toast('📌 Đã ghim!');
    }catch(e){ fail(e, 'Không lưu được pin.'); }
    btn.disabled = false;
  });

  /* ---------- filters ---------- */
  document.getElementById('searchInput').addEventListener('input', (e) => { search = e.target.value; render(); });
  function renderFilterChips(){
    const items = [{id:'all', label:'Tất cả'}, ...COLLECTIONS.map(c=>({id:c.id, label:c.label})), {id:'deadline', label:'Có deadline'}, {id:'starred', label:'⭐ Ghim nổi'}];
    document.getElementById('filterChips').innerHTML = items.map(it =>
      `<span class="fchip ${activeFilter===it.id?'active':''}" data-id="${it.id}">${esc(it.label)}</span>`
    ).join('');
    document.querySelectorAll('.fchip').forEach(el => {
      el.addEventListener('click', () => { activeFilter = el.dataset.id; render(); });
    });
  }

  /* ---------- card rendering ---------- */
  const PRANK = {ttkhan:0, tkhan:1, khan:2, bt:3};
  function isUrgent(p){
    const u = urgency(p.deadline);
    return p.starred || u === 'overdue' || u === 'today' || u === 'soon';
  }
  function sortKey(p){
    const u = urgency(p.deadline);
    const uRank = {overdue:0, today:1, soon:2, later:3, none:4}[u];
    return (p.starred ? 0 : 100) + uRank*10 + PRANK[p.priority];
  }
  function createdMs(p){ return new Date(p.createdAt).getTime() || 0; }

  function auditLine(p){
    const created = `${esc(p.author)} · ${timeAgo(p.createdAt)}`;
    return p.updatedAt ? `${created} · sửa bởi ${esc(p.updatedBy || p.author)} ${timeAgo(p.updatedAt)}` : created;
  }

  function cardHTML(p){
    const coll = collOf(p.collection);
    const u = urgency(p.deadline);
    const um = URG_META[u];
    let h=0; for(const c of String(p.id)) h = (h*31 + c.charCodeAt(0)) % 5;
    const rotate = (h - 2) * 0.7;
    const pm = PRIORITY_META[p.priority] || PRIORITY_META.bt;
    const star = `<span class="star-ico ${p.starred?'':'off'}" data-act="star" data-id="${p.id}" title="${p.starred?'Bỏ ghim nổi':'Ghim nổi lên đầu'}">⭐</span>`;
    const prioDot = `<span class="prio-dot" style="background:${pm.color}" title="${esc(pm.label)}"></span>`;
    const peopleHTML = p.people && p.people.length
      ? `<div class="people">${p.people.slice(0,4).map(n => `<span class="av" style="background:${avatarColor(n)}" title="${esc(n)}">${initials(n)}</span>`).join('')}${p.people.length>4?`<span class="av" style="background:#9AA1AC">+${p.people.length-4}</span>`:''}</div>`
      : '';
    const deadlineHTML = p.deadline
      ? `<span class="deadline-badge" style="background:${um.color}">🗓 ${um.label ? um.label+' · ' : ''}${fmtDate(p.deadline)}</span><br>`
      : '';
    return `
      <div class="card ${p.starred?'starred':''}" style="background:${coll.bg}; transform:rotate(${rotate}deg)" data-id="${p.id}">
        <svg class="clip" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.7 2 6 4.7 6 8c0 4.2 6 12 6 12s6-7.8 6-12c0-3.3-2.7-6-6-6z" fill="${um.color || '#B9B29A'}"/><circle cx="12" cy="8" r="2.6" fill="#fff"/></svg>
        <div class="card-top">
          <span class="coll-tag" style="background:rgba(255,255,255,.55);color:${coll.ink}">${esc(coll.label)}</span>
          <span style="display:flex;align-items:center;">${prioDot}${star}</span>
        </div>
        <p class="content">${esc(p.content)}</p>
        ${p.url ? `<a class="link" href="${esc(p.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">🔗 ${esc(p.url)}</a>` : ''}
        ${deadlineHTML}
        ${peopleHTML}
        <div class="meta">
          <span>${auditLine(p)}</span>
          <div class="actions">
            <button data-act="edit" data-id="${p.id}" title="Sửa">✎</button>
            <button data-act="del" data-id="${p.id}" title="Bỏ ghim">✕</button>
          </div>
        </div>
      </div>`;
  }

  function editHTML(p){
    return `
      <div class="card editing" style="background:${collOf(p.collection).bg}" data-id="${p.id}">
        <div class="edit-body">
          <textarea id="eContent">${esc(p.content)}</textarea>
          <label class="f-label">Link</label>
          <input class="f-input" id="eUrl" value="${esc(p.url)}" style="margin-bottom:8px;">
          <label class="f-label">Deadline</label>
          <input class="f-input" type="date" id="eDeadline" value="${p.deadline || ''}" style="margin-bottom:8px;">
          <label class="f-label">Thành phần tham gia</label>
          <input class="f-input" id="ePeople" value="${esc((p.people||[]).join(', '))}" style="margin-bottom:8px;" list="teamList">
          <div class="edit-actions">
            <button class="btn-ghost" data-act="cancel-edit" data-id="${p.id}">Huỷ</button>
            <button class="btn-solid" data-act="save-edit" data-id="${p.id}">Lưu</button>
          </div>
        </div>
      </div>`;
  }

  async function toggleStar(id){
    const p = pins.find(x => x.id === id);
    if(!p) return;
    try{
      const updated = await Store.updatePin(id, {starred: !p.starred, updatedBy: user ? user.name : 'ẩn danh'});
      Object.assign(p, updated);
      render();
    }catch(e){ fail(e); }
  }
  async function deletePin(id){
    try{
      await Store.deletePin(id);
      pins = pins.filter(p => p.id !== id);
      render();
      toast('Đã bỏ ghim.');
    }catch(e){ fail(e, 'Không xoá được pin.'); }
  }
  async function saveEdit(id){
    const p = pins.find(x => x.id === id);
    if(!p) return;
    const fields = {
      content: document.getElementById('eContent').value.trim() || p.content,
      url: document.getElementById('eUrl').value.trim(),
      deadline: document.getElementById('eDeadline').value,
      people: document.getElementById('ePeople').value.split(',').map(s=>s.trim()).filter(Boolean),
      updatedBy: user ? user.name : 'ẩn danh'
    };
    try{
      for(const t of fields.people){
        if(!TEAMS.includes(t)){ await Store.addTeam(t); TEAMS.push(t); }
      }
      renderTeamList();
      const updated = await Store.updatePin(id, fields);
      Object.assign(p, updated);
      editingId = null;
      render();
    }catch(e){ fail(e, 'Không lưu được thay đổi.'); }
  }

  function bindCardEvents(root){
    root.querySelectorAll('[data-act]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.id;
        const act = el.dataset.act;
        if(act === 'del'){ deletePin(id); }
        else if(act === 'star'){ toggleStar(id); }
        else if(act === 'edit'){ editingId = id; render(); }
        else if(act === 'cancel-edit'){ editingId = null; render(); }
        else if(act === 'save-edit'){ saveEdit(id); }
      });
    });
    root.querySelectorAll('.card:not(.editing)').forEach(card => {
      card.addEventListener('click', () => openView(card.dataset.id));
    });
  }

  function openView(id){
    const p = pins.find(x => x.id === id);
    if(!p) return;
    const coll = collOf(p.collection);
    const pm = PRIORITY_META[p.priority] || PRIORITY_META.bt;
    const u = urgency(p.deadline);
    const um = URG_META[u];
    const peopleHTML = p.people && p.people.length
      ? p.people.map(n => `<span><span class="av" style="background:${avatarColor(n)}">${initials(n)}</span>${esc(n)}</span>`).join('')
      : '<span style="opacity:.55">Chưa gán ai</span>';
    const editedLine = p.updatedAt ? ` · sửa lần cuối bởi ${esc(p.updatedBy || p.author)}, ${timeAgo(p.updatedAt)}` : '';
    const modal = document.getElementById('viewModal');
    modal.style.background = coll.bg;
    modal.innerHTML = `
      <button class="vm-close" id="vmClose">✕</button>
      <div class="vm-top">
        <span class="coll-tag" style="background:rgba(255,255,255,.6);color:${coll.ink}">${esc(coll.label)}</span>
        <span style="display:flex;align-items:center;gap:6px;">
          ${p.starred ? '<span title="Ghim nổi">⭐</span>' : ''}
          <span class="prio-dot" style="background:${pm.color}" title="${esc(pm.label)}"></span>
        </span>
      </div>
      <p class="vm-content">${esc(p.content)}</p>
      ${p.url ? `<a class="link" href="${esc(p.url)}" target="_blank" rel="noopener">🔗 ${esc(p.url)}</a>` : ''}
      <div class="vm-row"><span class="vm-label">Ưu tiên</span><span>${esc(pm.label)}</span></div>
      ${p.deadline ? `<div class="vm-row"><span class="vm-label">Deadline</span><span class="deadline-badge" style="background:${um.color}">🗓 ${um.label?um.label+' · ':''}${fmtDate(p.deadline)}</span></div>` : ''}
      <div class="vm-row"><span class="vm-label">Tham gia</span><div class="vm-people">${peopleHTML}</div></div>
      <div class="vm-meta">Tạo bởi ${esc(p.author)}${p.authorTeam ? ' ('+esc(p.authorTeam)+')' : ''} · ${timeAgo(p.createdAt)}${editedLine}</div>
      <div class="vm-actions">
        <button class="btn-ghost" id="vmDelete">Bỏ ghim</button>
        <button class="btn-ghost" id="vmStar">${p.starred ? '⭐ Bỏ ghim nổi' : '☆ Ghim nổi'}</button>
        <button class="btn-solid" id="vmEdit">✎ Sửa</button>
      </div>
    `;
    document.getElementById('viewOverlay').classList.add('open');
    document.getElementById('vmClose').addEventListener('click', closeView);
    document.getElementById('vmEdit').addEventListener('click', () => { closeView(); editingId = id; render(); });
    document.getElementById('vmStar').addEventListener('click', () => { closeView(); toggleStar(id); });
    document.getElementById('vmDelete').addEventListener('click', () => { closeView(); deletePin(id); });
  }
  function closeView(){ document.getElementById('viewOverlay').classList.remove('open'); }
  document.getElementById('viewOverlay').addEventListener('click', (e) => { if(e.target.id === 'viewOverlay') closeView(); });

  function matchesFilter(p){
    if(activeFilter === 'all') return true;
    if(activeFilter === 'deadline') return !!p.deadline;
    if(activeFilter === 'starred') return !!p.starred;
    return p.collection === activeFilter;
  }
  function matchesTeam(p){
    return !activeTeam || (p.people && p.people.includes(activeTeam));
  }
  function matchesSearch(p){
    if(!search) return true;
    const q = search.toLowerCase();
    return p.content.toLowerCase().includes(q)
      || (p.url||'').toLowerCase().includes(q)
      || (p.people||[]).join(' ').toLowerCase().includes(q)
      || (p.author||'').toLowerCase().includes(q);
  }

  function renderHeatmap(){
    const stats = TEAMS.map(t => {
      const counts = {ttkhan:0, tkhan:0, khan:0, bt:0};
      let total = 0;
      pins.forEach(p => { if(p.people && p.people.includes(t)){ counts[p.priority] = (counts[p.priority]||0)+1; total++; } });
      return {team:t, counts, total};
    }).sort((a,b) => b.total - a.total);

    const noteEl = document.getElementById('heatFilterNote');
    noteEl.innerHTML = activeTeam
      ? `<div class="heat-filter-note"><span>Đang lọc: <b>${esc(activeTeam)}</b></span><button id="clearTeamFilter">Bỏ lọc ✕</button></div>`
      : '';
    if(activeTeam){
      document.getElementById('clearTeamFilter').addEventListener('click', () => { activeTeam = null; render(); });
    }

    const body = document.getElementById('heatBody');
    if(stats.every(s => s.total === 0)){
      body.innerHTML = `<div class="heat-empty">Chưa có pin nào gán cho tổ cụ thể.</div>`;
      return;
    }
    body.innerHTML = stats.map(s => {
      const cells = ['ttkhan','tkhan','khan','bt'].map(k => {
        const c = s.counts[k];
        const bg = c === 0 ? 'rgba(35,38,43,.06)' : hexToRgba(PRIORITY_HEX[k], Math.min(1, 0.35 + c*0.25));
        return `<span class="heat-cell" style="background:${bg}">${c || ''}</span>`;
      }).join('');
      return `
        <div class="heat-row ${activeTeam===s.team?'active-team':''}" data-team="${esc(s.team)}" title="${esc(s.team)} — ${s.total} pin">
          <span class="heat-team">${esc(s.team)}</span>
          ${cells}
          <span class="heat-total">${s.total}</span>
        </div>`;
    }).join('');
    body.querySelectorAll('.heat-row').forEach(row => {
      row.addEventListener('click', () => {
        const t = row.dataset.team;
        activeTeam = activeTeam === t ? null : t;
        render();
      });
    });
  }

  function render(){
    renderFilterChips();
    renderHeatmap();

    // urgent strip: ghim nổi + quá hạn + hôm nay + deadline trong 3 ngày, bỏ qua filter/search
    const urgentList = pins.filter(isUrgent).sort((a,b) => sortKey(a)-sortKey(b)).slice(0,8);
    const urgentTrack = document.getElementById('urgentTrack');
    if(urgentList.length === 0){
      urgentTrack.innerHTML = `<div class="empty-urgent">Không có gì gấp — bảng ghim đang yên bình 🌤️</div>`;
    } else {
      urgentTrack.innerHTML = urgentList.map(p => cardHTML(p)).join('');
      bindCardEvents(urgentTrack);
    }

    // main board
    let list = pins.filter(matchesFilter).filter(matchesTeam).filter(matchesSearch)
      .sort((a,b) => sortKey(a)-sortKey(b) || createdMs(b)-createdMs(a));
    document.getElementById('boardTitle').textContent = `Bảng ghim (${list.length})${activeTeam ? ' · ' + activeTeam : ''}`;
    const board = document.getElementById('board');
    if(list.length === 0){
      board.innerHTML = `<div class="empty-board"><h3>Chưa có gì khớp</h3><p>Thử đổi bộ lọc hoặc ghim thêm nội dung mới.</p></div>`;
      return;
    }
    board.innerHTML = list.map(p => editingId === p.id ? editHTML(p) : cardHTML(p)).join('');
    bindCardEvents(board);
  }

  async function reload(){
    const data = await Store.fetchAll();
    pins = data.pins;
    COLLECTIONS = data.collections;
    TEAMS = data.teams;
    if(!COLLECTIONS.find(c => c.id === composerColl)){
      composerColl = COLLECTIONS[0] ? COLLECTIONS[0].id : 'viec';
    }
    renderTeamList();
    renderCollChips();
    renderPeopleChips();
    render();
  }

  /* ---------- init ---------- */
  (async function init(){
    document.getElementById('modeBadge').textContent = Store.mode === 'local' ? 'chế độ cục bộ' : '';
    document.getElementById('footerNote').textContent = Store.mode === 'local'
      ? '⚠️ Chưa cấu hình Supabase — dữ liệu chỉ lưu trên trình duyệt này (localStorage).'
      : '📌 Things to Pin — bảng ghim chung của phòng';

    try{
      await reload();
    }catch(e){
      fail(e, 'Không tải được dữ liệu. Kiểm tra cấu hình Supabase trong js/config.js.');
    }

    user = loadUser();
    if(user){
      renderWhoami();
      render();
    } else {
      gate.style.display = 'flex';
    }

    // realtime: khi ai đó thay đổi dữ liệu, tự tải lại
    let reloadTimer = null;
    Store.onChange(() => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => reload().catch(console.error), 400);
    });
  })();
})();
