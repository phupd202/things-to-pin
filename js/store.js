// Data layer: Supabase (shared, realtime) hoặc localStorage (fallback cục bộ).
(function(){
  const cfg = window.APP_CONFIG || {};
  const useSupabase = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const LS_KEY = 'ttp_data_v1';

  const DEFAULT_COLLECTIONS = [
    {id:'viec', label:'Việc cần chú ý', bg:'#FFDCC0', ink:'#8A4A18'},
    {id:'taily', label:'Tài liệu', bg:'#CFE6FF', ink:'#1B4E82'},
    {id:'link', label:'Link / Slide', bg:'#E5DEFF', ink:'#4A3A8A'}
  ];
  const DEFAULT_TEAMS = [
    'Nhóm Điều hành và Quản lý vận hành',
    'Nhóm Quản lý mạng lõi',
    'Nhóm Quản lý hạ tầng CNTT',
    'Nhóm Quản lý CSHT và đầu tư',
    'Nhóm Quản lý chất lượng',
    'Nhóm Điều hành dịch vụ'
  ];
  const NEW_COLL_PALETTE = [
    {bg:'#D9F0DC', ink:'#2C6B3F'}, {bg:'#FFE1EC', ink:'#8A3357'}, {bg:'#E4F0FF', ink:'#2A5D8A'},
    {bg:'#FFF0C7', ink:'#8A6A17'}, {bg:'#E8E3FF', ink:'#4E3F91'}
  ];

  function uid(){ return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  /* ---------- localStorage backend ---------- */
  function lsLoad(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(raw){
        const data = JSON.parse(raw);
        if(!data.members) data.members = [];
        return data;
      }
    }catch(e){}
    return {pins:[], collections:[...DEFAULT_COLLECTIONS], teams:[...DEFAULT_TEAMS], members:[]};
  }
  function lsSave(data){ localStorage.setItem(LS_KEY, JSON.stringify(data)); }

  const localBackend = {
    mode: 'local',
    async fetchAll(){
      return lsLoad();
    },
    async createPin(pin){
      const data = lsLoad();
      const row = {...pin, id: uid(), createdAt: new Date().toISOString(), updatedAt: null, updatedBy: null};
      data.pins.push(row);
      lsSave(data);
      return row;
    },
    async updatePin(id, fields){
      const data = lsLoad();
      const p = data.pins.find(x => x.id === id);
      if(!p) return null;
      Object.assign(p, fields, {updatedAt: new Date().toISOString()});
      lsSave(data);
      return p;
    },
    async deletePin(id){
      const data = lsLoad();
      data.pins = data.pins.filter(p => p.id !== id);
      lsSave(data);
    },
    async addCollection(label){
      const data = lsLoad();
      const c = NEW_COLL_PALETTE[data.collections.length % NEW_COLL_PALETTE.length];
      const coll = {id: uid(), label, bg: c.bg, ink: c.ink};
      data.collections.push(coll);
      lsSave(data);
      return coll;
    },
    async addTeam(name){
      const data = lsLoad();
      if(!data.teams.includes(name)){ data.teams.push(name); lsSave(data); }
      return name;
    },
    async saveMember(member){
      const data = lsLoad();
      const i = data.members.findIndex(m => m.displayName === member.displayName);
      if(i >= 0) data.members[i] = {...data.members[i], ...member};
      else data.members.push({...member, createdAt: new Date().toISOString()});
      lsSave(data);
      return member;
    },
    onChange(){ /* không có realtime ở chế độ cục bộ */ }
  };

  /* ---------- Supabase backend ---------- */
  function makeSupabaseBackend(){
    const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

    function pinFromRow(r){
      return {
        id: r.id,
        content: r.content,
        url: r.url || '',
        deadline: r.deadline || '',
        people: r.people || [],
        priority: r.priority,
        collection: r.collection_id,
        starred: !!r.starred,
        author: r.created_by,
        authorTeam: r.created_by_team || '',
        updatedBy: r.updated_by || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at || null
      };
    }
    function pinToRow(p){
      const row = {};
      if('content' in p) row.content = p.content;
      if('url' in p) row.url = p.url || null;
      if('deadline' in p) row.deadline = p.deadline || null;
      if('people' in p) row.people = p.people || [];
      if('priority' in p) row.priority = p.priority;
      if('collection' in p) row.collection_id = p.collection;
      if('starred' in p) row.starred = !!p.starred;
      if('author' in p) row.created_by = p.author;
      if('authorTeam' in p) row.created_by_team = p.authorTeam || null;
      if('updatedBy' in p) row.updated_by = p.updatedBy;
      return row;
    }

    return {
      mode: 'supabase',
      async fetchAll(){
        const [pinsRes, collRes, teamRes] = await Promise.all([
          client.from('pins').select('*').order('created_at', {ascending:false}),
          client.from('collections').select('*').order('created_at', {ascending:true}),
          client.from('teams').select('*').order('created_at', {ascending:true})
        ]);
        if(pinsRes.error) throw pinsRes.error;
        if(collRes.error) throw collRes.error;
        if(teamRes.error) throw teamRes.error;
        return {
          pins: pinsRes.data.map(pinFromRow),
          collections: collRes.data.map(r => ({id:r.id, label:r.label, bg:r.bg, ink:r.ink})),
          teams: teamRes.data.map(r => r.name)
        };
      },
      async createPin(pin){
        const {data, error} = await client.from('pins').insert(pinToRow(pin)).select().single();
        if(error) throw error;
        return pinFromRow(data);
      },
      async updatePin(id, fields){
        const row = pinToRow(fields);
        row.updated_at = new Date().toISOString();
        const {data, error} = await client.from('pins').update(row).eq('id', id).select().single();
        if(error) throw error;
        return pinFromRow(data);
      },
      async deletePin(id){
        const {error} = await client.from('pins').delete().eq('id', id);
        if(error) throw error;
      },
      async addCollection(label, count){
        const c = NEW_COLL_PALETTE[(count||0) % NEW_COLL_PALETTE.length];
        const {data, error} = await client.from('collections')
          .insert({label, bg:c.bg, ink:c.ink}).select().single();
        if(error) throw error;
        return {id:data.id, label:data.label, bg:data.bg, ink:data.ink};
      },
      async addTeam(name){
        const {error} = await client.from('teams').upsert({name}, {onConflict:'name', ignoreDuplicates:true});
        if(error) throw error;
        return name;
      },
      async saveMember(member){
        const {error} = await client.from('members').upsert({
          display_name: member.displayName,
          full_name: member.fullName,
          team: member.team,
          last_seen_at: new Date().toISOString()
        }, {onConflict:'display_name'});
        if(error) throw error;
        return member;
      },
      onChange(cb){
        client.channel('ttp-changes')
          .on('postgres_changes', {event:'*', schema:'public', table:'pins'}, cb)
          .on('postgres_changes', {event:'*', schema:'public', table:'collections'}, cb)
          .on('postgres_changes', {event:'*', schema:'public', table:'teams'}, cb)
          .subscribe();
      }
    };
  }

  window.Store = useSupabase ? makeSupabaseBackend() : localBackend;
})();
