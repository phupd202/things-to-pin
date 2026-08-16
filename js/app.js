(function(){
  const USER_KEY = 'ttp_user_v1';

  let COLLECTIONS = [];
  let TEAMS = [];
  let MEMBERS = [];
  let pins = [];
  let IDEAS = [];

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
  function personTitle(n){
    const m = MEMBERS.find(x => x.displayName === n);
    return m ? `${m.fullName} — ${m.team}` : n;
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
    document.getElementById('teamList').innerHTML =
      TEAMS.map(t => `<option value="${esc(t)}">`).join('')
      + MEMBERS.map(m => `<option value="${esc(m.displayName)}">`).join('');
    const sel = document.getElementById('gTeam');
    const current = sel.value;
    sel.innerHTML = `<option value="" disabled ${current?'':'selected'}>— Chọn tổ chuyên môn —</option>`
      + TEAMS.map(t => `<option value="${esc(t)}" ${t===current?'selected':''}>${esc(t)}</option>`).join('');
  }

  // "Nguyễn Văn An" → "AnNV": tên + chữ cái đầu của họ và tên đệm
  function makeDisplayName(fullName){
    const words = fullName.trim().split(/\s+/);
    if(words.length < 2) return words[0] || '';
    const last = words[words.length-1];
    const initials = words.slice(0, -1).map(w => w[0].toUpperCase()).join('');
    return last.charAt(0).toUpperCase() + last.slice(1) + initials;
  }

  document.getElementById('gName').addEventListener('input', (e) => {
    const v = e.target.value.trim();
    const hint = document.getElementById('gNameHint');
    hint.innerHTML = v.split(/\s+/).filter(Boolean).length >= 2
      ? `Tên hiển thị: <b>${esc(makeDisplayName(v))}</b>` : '';
  });

  document.getElementById('gEnter').addEventListener('click', async () => {
    const name = document.getElementById('gName').value.trim();
    const team = document.getElementById('gTeam').value;
    const errEl = document.getElementById('gError');
    if(name.split(/\s+/).filter(Boolean).length < 2){
      errEl.textContent = 'Nhập tên đầy đủ (ví dụ: Nguyễn Văn An).';
      document.getElementById('gName').focus();
      return;
    }
    if(!team){
      errEl.textContent = 'Chọn tổ chuyên môn của bạn.';
      document.getElementById('gTeam').focus();
      return;
    }
    errEl.textContent = '';
    const display = makeDisplayName(name);
    user = {name, display, team};
    saveUser(user);
    try{
      await Store.saveMember({fullName: name, displayName: display, team});
    }catch(e){ fail(e, 'Không lưu được thông tin thành viên lên server.'); }
    gate.style.display = 'none';
    renderWhoami();
    render();
  });

  function renderWhoami(){
    if(!user) return;
    document.getElementById('whoami').innerHTML = `
      <div class="avatar" style="background:${avatarColor(user.display)}" title="${esc(user.name)}">${initials(user.name)}</div>
      <div class="txt"><b title="${esc(user.name)}">${esc(user.display)}</b><span>${esc(user.team)}</span></div>
      <button id="editWho">đổi</button>
    `;
    document.getElementById('editWho').addEventListener('click', () => {
      document.getElementById('gName').value = user.name;
      document.getElementById('gTeam').value = TEAMS.includes(user.team) ? user.team : '';
      renderTeamList();
      document.getElementById('gName').dispatchEvent(new Event('input'));
      gate.style.display = 'flex';
    });
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
    const memberChips = MEMBERS.length
      ? `<span class="chip-group-label">Người:</span>` + MEMBERS.map(m =>
          `<span class="team-chip person ${composerPeople.includes(m.displayName)?'on':''}" data-t="${esc(m.displayName)}" title="${esc(m.fullName)} — ${esc(m.team)}"><span class="chip-av" style="background:${avatarColor(m.displayName)}">${initials(m.displayName)}</span>${esc(m.displayName)}</span>`
        ).join('')
      : `<span class="chip-group-label" style="opacity:.6">Chưa có ai vào web — mỗi người vào lần đầu sẽ tự xuất hiện ở đây để gán việc.</span>`;
    document.getElementById('cPeopleChips').innerHTML =
      `<span class="chip-group-label">Tổ:</span>` + chips + adder + `<span class="chip-break"></span>` + memberChips;
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
        author: user ? user.display : 'ẩn danh',
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
    const items = [{id:'all', label:'Tất cả'}, {id:'mine', label:'🙋 Của tôi'}, ...COLLECTIONS.map(c=>({id:c.id, label:c.label})), {id:'deadline', label:'Có deadline'}, {id:'starred', label:'⭐ Ghim nổi'}, {id:'done', label:'✅ Đã xong'}];
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
    if(p.done) return false;
    const u = urgency(p.deadline);
    return p.starred || u === 'overdue' || u === 'today' || u === 'soon';
  }
  function sortKey(p){
    const u = urgency(p.deadline);
    const uRank = {overdue:0, today:1, soon:2, later:3, none:4}[u];
    return (p.done ? 1000 : 0) + (p.starred ? 0 : 100) + uRank*10 + PRANK[p.priority];
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
    const edgeColor = p.done ? 'var(--urg-sage)' : pm.color;
    const hot = !p.done && (u === 'overdue' || u === 'today');
    const viewers = p.viewers || [];
    const viewsHTML = viewers.length
      ? ` · <span class="views" title="Đã xem: ${esc(viewers.join(', '))}">👁 ${viewers.length}</span>`
      : '';
    const prioDot = `<span class="prio-dot" style="background:${pm.color}" title="${esc(pm.label)}"></span>`;
    const peopleHTML = p.people && p.people.length
      ? `<div class="people">${p.people.slice(0,4).map(n => `<span class="av" style="background:${avatarColor(n)}" title="${esc(personTitle(n))}">${initials(n)}</span>`).join('')}${p.people.length>4?`<span class="av" style="background:#9AA1AC">+${p.people.length-4}</span>`:''}</div>`
      : '';
    const deadlineHTML = p.deadline
      ? `<span class="deadline-badge" style="background:${um.color}">🗓 ${um.label ? um.label+' · ' : ''}${fmtDate(p.deadline)}</span><br>`
      : '';
    return `
      <div class="card ${p.starred?'starred':''} ${p.done?'done':''} ${hot?'hot':''}" style="background:${coll.bg}; --rot:${rotate}deg; --edge:${edgeColor}" data-id="${p.id}">
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
          <span>${auditLine(p)}${viewsHTML}</span>
          <div class="actions">
            <button data-act="done" data-id="${p.id}" title="${p.done?'Mở lại':'Đánh dấu đã xong'}">${p.done?'↩':'✓'}</button>
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
      const updated = await Store.updatePin(id, {starred: !p.starred, updatedBy: user ? user.display : 'ẩn danh'});
      Object.assign(p, updated);
      render();
    }catch(e){ fail(e); }
  }
  async function toggleDone(id){
    const p = pins.find(x => x.id === id);
    if(!p) return;
    try{
      const updated = await Store.updatePin(id, {done: !p.done, updatedBy: user ? user.display : 'ẩn danh'});
      Object.assign(p, updated);
      render();
      toast(p.done ? '✅ Đã xong!' : 'Đã mở lại pin.');
    }catch(e){ fail(e); }
  }
  function pinLink(id){ return location.origin + location.pathname + '?pin=' + encodeURIComponent(id); }
  async function copyPinLink(id){
    try{
      await navigator.clipboard.writeText(pinLink(id));
      toast('🔗 Đã chép link pin — dán vào chat để gửi.');
    }catch(e){
      prompt('Chép link này:', pinLink(id));
    }
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
      updatedBy: user ? user.display : 'ẩn danh'
    };
    try{
      // Chỉ gán tổ hoặc người đã có trong danh sách thành viên
      const known = new Set([...TEAMS, ...MEMBERS.map(m => m.displayName)]);
      const unknown = fields.people.filter(x => !known.has(x));
      if(unknown.length){
        toast('Bỏ qua “' + unknown.join(', ') + '” — chỉ gán được tổ hoặc người đã vào web.');
        fields.people = fields.people.filter(x => known.has(x));
      }
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
        else if(act === 'done'){ toggleDone(id); }
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
      ? p.people.map(n => `<span title="${esc(personTitle(n))}"><span class="av" style="background:${avatarColor(n)}">${initials(n)}</span>${esc(n)}</span>`).join('')
      : '<span style="opacity:.55">Chưa gán ai</span>';
    // ghi nhận người xem (mỗi người tính 1 lần)
    if(user && !(p.viewers||[]).includes(user.display)){
      p.viewers = [...(p.viewers||[]), user.display];
      Store.markViewed(id, user.display).catch(console.error);
    }
    const viewers = p.viewers || [];
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
      <div class="vm-row"><span class="vm-label">Đã xem</span><span class="vm-viewers">👁 ${viewers.length} lượt${viewers.length ? ' · ' + viewers.map(esc).join(', ') : ''}</span></div>
      <div class="vm-meta">Tạo bởi ${esc(p.author)}${p.authorTeam ? ' ('+esc(p.authorTeam)+')' : ''} · ${timeAgo(p.createdAt)}${editedLine}</div>
      <div class="vm-actions">
        <button class="btn-ghost" id="vmDelete">Bỏ ghim</button>
        <button class="btn-ghost" id="vmCopy" title="Chép link trực tiếp tới pin này">🔗 Chép link</button>
        <button class="btn-ghost" id="vmDone">${p.done ? '↩ Mở lại' : '✓ Đã xong'}</button>
        <button class="btn-ghost" id="vmStar">${p.starred ? '⭐ Bỏ ghim nổi' : '☆ Ghim nổi'}</button>
        <button class="btn-solid" id="vmEdit">✎ Sửa</button>
      </div>
    `;
    document.getElementById('viewOverlay').classList.add('open');
    document.getElementById('vmClose').addEventListener('click', closeView);
    document.getElementById('vmEdit').addEventListener('click', () => { closeView(); editingId = id; render(); });
    document.getElementById('vmStar').addEventListener('click', () => { closeView(); toggleStar(id); });
    document.getElementById('vmDone').addEventListener('click', () => { closeView(); toggleDone(id); });
    document.getElementById('vmCopy').addEventListener('click', () => copyPinLink(id));
    document.getElementById('vmDelete').addEventListener('click', () => { closeView(); deletePin(id); });
  }
  function closeView(){ document.getElementById('viewOverlay').classList.remove('open'); }
  document.getElementById('viewOverlay').addEventListener('click', (e) => { if(e.target.id === 'viewOverlay') closeView(); });

  function matchesFilter(p){
    if(activeFilter === 'all') return true;
    if(activeFilter === 'deadline') return !!p.deadline;
    if(activeFilter === 'starred') return !!p.starred;
    if(activeFilter === 'done') return !!p.done;
    if(activeFilter === 'mine') return !!user && ((p.people||[]).includes(user.display) || (p.people||[]).includes(user.team) || p.author === user.display);
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

  /* ---------- ý tưởng & feedback: vote ▲▼ ---------- */
  const ideaScore = i => (i.upVoters||[]).length - (i.downVoters||[]).length;
  function renderIdeas(){
    const listEl = document.getElementById('ideaList');
    if(!IDEAS.length){
      listEl.innerHTML = `<p class="idea-empty">Chưa có ý tưởng nào — gửi ý tưởng đầu tiên đi!</p>`;
      return;
    }
    const me = user ? user.display : null;
    const sorted = [...IDEAS].sort((a,b) => ideaScore(b) - ideaScore(a) || createdMs(a) - createdMs(b));
    listEl.innerHTML = sorted.map((i, idx) => {
      const score = ideaScore(i);
      const top = idx === 0 && score > 0;
      return `
        <div class="idea-row ${top?'top':''}">
          <div class="idea-votes">
            <button class="vote-btn ${me && i.upVoters.includes(me)?'on-up':''}" data-id="${i.id}" data-dir="up" title="Đáng làm (${i.upVoters.length})">▲</button>
            <b class="idea-score ${score>0?'pos':score<0?'neg':''}">${score}</b>
            <button class="vote-btn ${me && i.downVoters.includes(me)?'on-down':''}" data-id="${i.id}" data-dir="down" title="Chưa cần (${i.downVoters.length})">▼</button>
          </div>
          <div class="idea-main">
            ${top?'<span class="idea-top-badge">🏆 nhiều vote nhất</span>':''}
            <p>${esc(i.content)}</p>
            <span class="idea-meta">${esc(i.author)} · ${timeAgo(i.createdAt)}</span>
          </div>
        </div>`;
    }).join('');
    listEl.querySelectorAll('.vote-btn').forEach(btn => btn.addEventListener('click', async () => {
      if(!user){ toast('Nhập tên ở màn hình chào để vote nhé.'); return; }
      try{
        const updated = await Store.voteIdea(btn.dataset.id, user.display, btn.dataset.dir);
        const i = IDEAS.find(x => x.id === btn.dataset.id);
        if(i && updated) Object.assign(i, updated);
        renderIdeas();
      }catch(e){ fail(e, 'Không vote được, thử lại nhé.'); }
    }));
  }
  async function submitIdea(){
    const input = document.getElementById('ideaInput');
    const content = input.value.trim();
    if(!content){ input.focus(); return; }
    if(!user){ toast('Nhập tên ở màn hình chào để gửi ý tưởng nhé.'); return; }
    try{
      const idea = await Store.addIdea({content, author: user.display});
      IDEAS.push(idea);
      input.value = '';
      renderIdeas();
      toast('💡 Đã gửi ý tưởng!');
    }catch(e){ fail(e, 'Không gửi được ý tưởng.'); }
  }
  document.getElementById('ideaSend').addEventListener('click', submitIdea);
  document.getElementById('ideaInput').addEventListener('keydown', e => { if(e.key === 'Enter') submitIdea(); });

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
    if(window.Brief) Brief.update({user, pins, teams: TEAMS, members: MEMBERS});
    renderFilterChips();
    renderHeatmap();
    renderIdeas();

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
    MEMBERS = data.members || [];
    IDEAS = data.ideas || [];
    if(!COLLECTIONS.find(c => c.id === composerColl)){
      composerColl = COLLECTIONS[0] ? COLLECTIONS[0].id : 'viec';
    }
    renderTeamList();
    renderCollChips();
    renderPeopleChips();
    render();
  }

  /* ---------- thanh tiến độ ngày làm việc (8h → 17h) ---------- */
  const WORK_START = 8, WORK_END = 17;
  function renderDayProgress(){
    const el = document.getElementById('dayProgress');
    if(!el) return;
    const now = new Date();
    const h = now.getHours() + now.getMinutes()/60;
    const pct = Math.max(0, Math.min(1, (h - WORK_START)/(WORK_END - WORK_START)));
    el.querySelector('.dp-cover').style.width = ((1 - pct)*100).toFixed(1) + '%';
    el.title = pct <= 0 ? 'Chưa tới giờ làm việc (8h00–17h00)'
      : pct >= 1 ? 'Đã hết giờ làm việc (8h00–17h00)'
      : `Đã qua ${Math.round(pct*100)}% ngày làm việc (8h00–17h00)`;
  }

  /* ---------- init ---------- */
  (async function init(){
    document.getElementById('modeBadge').textContent = Store.mode === 'local' ? 'chế độ cục bộ' : '';
    renderDayProgress();
    setInterval(renderDayProgress, 60 * 1000);

    try{
      await reload();
    }catch(e){
      fail(e, 'Không tải được dữ liệu. Kiểm tra cấu hình Supabase trong js/config.js.');
    }

    user = loadUser();
    if(user && user.display && TEAMS.includes(user.team)){
      renderWhoami();
      // đối chiếu: đảm bảo thành viên có trong database
      Store.saveMember({fullName: user.name, displayName: user.display, team: user.team}).catch(console.error);
      render();
    } else {
      if(user){
        document.getElementById('gName').value = user.name || '';
        document.getElementById('gName').dispatchEvent(new Event('input'));
      }
      gate.style.display = 'flex';
    }

    // deep link: mở thẳng pin được chia sẻ qua ?pin=<id>
    const linkedPin = new URLSearchParams(location.search).get('pin');
    if(linkedPin && pins.some(p => p.id === linkedPin)) openView(linkedPin);

    // realtime: khi ai đó thay đổi dữ liệu, tự tải lại
    let reloadTimer = null;
    Store.onChange(() => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => reload().catch(console.error), 400);
    });
  })();
})();
