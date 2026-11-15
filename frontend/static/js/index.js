const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ST=['Stable','Attention','Critical'],SC=['#72C5B8','#E3B66B','#D85B65'];
const SL={new:'New',in_progress:'In progress',done:'Resolved'},SN={new:2,in_progress:1,done:0};
const fmtD=t=>new Date(t).toLocaleDateString('en',{day:'numeric',month:'short'});
const fmtDT=t=>new Date(t).toLocaleString('en',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
const chip=s=>`<span class="chip s${s}">${ST[s]}</span>`;
const sosChip=s=>`<span class="chip s${SN[s]}">${SL[s]}</span>`;
const mval=m=>m.value_text!=null?m.value_text:(m.value_num+(m.unit?' '+m.unit:''));
let srvOff=0; /* server time minus client time, ms */
async function api(path,body){
 const r=await fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 let j={};try{j=await r.json()}catch(e){}
 if(!r.ok){const e=new Error(j.error||'Server error');e.status=r.status;e.data=j;throw e}
 return j}
function conv(s){const o={};for(const k in s)o[k]=s[k].map(p=>({t:Date.parse(p.t),v:p.v,s:p.s}));return o}
function resTables(metrics,cats){
 return cats.map(c=>{const ms=metrics.filter(m=>m.category==c.id);if(!ms.length)return'';const w=Math.max(...ms.map(m=>m.status));
  return `<div class="panel" style="margin-bottom:14px"><div class="row" style="justify-content:space-between;align-items:center;margin:0 0 8px"><b>${esc(c.title)}</b>${chip(w)}</div><div class="scroll"><table><tr><th>Metric</th><th>Value</th><th>Status</th><th>Note</th></tr>${ms.map(m=>`<tr><td>${esc(m.label)}</td><td>${esc(mval(m))}</td><td>${chip(m.status)}</td><td class="un">${esc(m.note)}</td></tr>`).join('')}</table></div></div>`}).join('')}
/* Time-based line chart. m.pts=[{t:ms,v,s}], days=0 means whole history. */
function wk(m,days){
 const now=Date.now()+srvOff;let pts=(m.pts||[]).slice();if(days)pts=pts.filter(p=>p.t>=now-days*864e5);
 if(!pts.length)return `<div class="panel un">No data for the selected period.</div>`;
 const W=640,H=230,p={l:48,r:14,t:14,b:34},t1=now,t0=days?now-days*864e5:Math.min(...pts.map(q=>q.t))-432e5;
 const vs=pts.map(q=>q.v);let lo=Math.min(...vs),hi=Math.max(...vs);const pad=(hi-lo)||1;lo=Math.floor((lo-pad*.3)*10)/10;hi=Math.ceil((hi+pad*.3)*10)/10;
 const x=t=>p.l+(t-t0)/((t1-t0)||1)*(W-p.l-p.r),y=v=>H-p.b-(v-lo)/((hi-lo)||1)*(H-p.t-p.b);
 let g='';for(let k=0;k<=4;k++){const v=lo+(hi-lo)*k/4;g+=`<line x1="${p.l}" x2="${W-p.r}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(136,132,184,.18)"/><text x="${p.l-8}" y="${y(v)+4}" text-anchor="end">${+v.toFixed(1)}</text>`}
 const nl=days&&days<=7?days:6;let xl='';for(let i=0;i<=nl;i++){const t=t0+(t1-t0)*i/nl;xl+=`<text x="${x(t)}" y="${H-12}" text-anchor="${i==nl?'end':i==0?'start':'middle'}">${fmtD(t)}</text>`}
 const dots=pts.map(q=>`<circle cx="${x(q.t)}" cy="${y(q.v)}" r="4" fill="#0D1220" stroke="${SC[q.s||0]}" stroke-width="1.8"><title>${fmtDT(q.t)}: ${q.v} ${esc(m.unit||'')} — ${ST[q.s||0]}</title></circle>`).join('');
 return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(m.name)} over time"><text x="${p.l}" y="10">${esc(m.unit||'')}</text>${g}${xl}<polyline fill="none" stroke="#8AC9D8" stroke-width="1.6" points="${pts.map(q=>x(q.t)+','+y(q.v)).join(' ')}"/>${dots}</svg>`}

/* Daily chart: x = day 1..7 of the current period (n-th submitted questionnaire). Only real submissions make points. */
function dchart(name,unit,pts,demo,empty){
 if(!pts.length)return `<div class="panel un">${esc(empty||(demo?'No demo data is available for this metric. The chart will appear after your first questionnaire.':'A new seven-day period has started. The chart will appear after your next questionnaire.'))}</div>`;
 const W=640,H=230,p={l:48,r:14,t:14,b:34},N=7;
 const vs=pts.map(q=>q.v);let lo=Math.min(...vs),hi=Math.max(...vs);const pad=(hi-lo)||1;lo=Math.floor((lo-pad*.3)*10)/10;hi=Math.ceil((hi+pad*.3)*10)/10;
 const x=d=>p.l+(d-1)/(N-1)*(W-p.l-p.r),y=v=>H-p.b-(v-lo)/((hi-lo)||1)*(H-p.t-p.b);
 let g='';for(let k=0;k<=4;k++){const v=lo+(hi-lo)*k/4;g+=`<line x1="${p.l}" x2="${W-p.r}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(136,132,184,.18)"/><text x="${p.l-8}" y="${y(v)+4}" text-anchor="end">${+v.toFixed(1)}</text>`}
 let xl='';for(let d=1;d<=N;d++)xl+=`<text x="${x(d)}" y="${H-12}" text-anchor="${d==1?'start':d==N?'end':'middle'}">Day ${d}</text>`;
 const dots=pts.map(q=>`<circle cx="${x(q.day)}" cy="${y(q.v)}" r="4" fill="#0D1220" stroke="${SC[q.s||0]}" stroke-width="1.8"><title>Day ${q.day}${q.t?' · '+fmtDT(Date.parse(q.t)):' · demo'}: ${q.v} ${esc(unit||'')} — ${ST[q.s||0]}</title></circle>`).join('');
 return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(name)}, days 1–7"><text x="${p.l}" y="10">${esc(unit||'')}</text>${g}${xl}<polyline fill="none" stroke="#8AC9D8" stroke-width="1.6" ${demo?'stroke-dasharray="5 4" ':''}points="${pts.map(q=>x(q.day)+','+y(q.v)).join(' ')}"/>${dots}</svg>`}
function overviewChart(key){
 const c=H.charts.cycle;
 if(c.day_count)return {pts:c.series[key]||[],title:`Week ${c.week_no} · ${c.day_count} of 7 questionnaires`};
 const latest=H.charts.weeks[0];
 if(latest)return {pts:latest.series[key]||[],title:'Latest completed week'};
 return {pts:[],title:`Week ${c.week_no} · 0 of 7 questionnaires`}}
function chartTitle(demo){return demo?'demo values, days 1–7':`Week ${H.charts.cycle.week_no} · ${H.charts.cycle.day_count} of 7 questionnaires`}
function overviewChartTitle(demo){return demo?chartTitle(true):overviewChart('hr_rest').title}
function weeklyBlock(mf,wks){
 if(!wks.length)return `<p class="un" style="font-size:12px">Weekly charts will appear here after seven questionnaires. Each completed week is saved below the main chart.</p>`;
 return `<h2>Weekly charts</h2>`+wks.map(w=>`<div class="panel" style="margin-bottom:14px"><b>Week ${w.week_no}</b> <span class="un">· ${fmtD(Date.parse(w.started_at))} — ${fmtD(Date.parse(w.ended_at))}</span>${dchart(mf.label,mf.unit,w.series[mf.key]||[],false,'No data for this metric during this week.')}</div>`).join('')}
function indCards(){return `<div class="inds">${Object.values(M).map(m=>`<div class="ind ${m.demo?'off':''}"><div class="nm">${m.name}</div><div class="val">${m.val} <small>${m.unit}</small></div>${m.demo?'<span class="st unavailable">○ Demo</span>':chip(m.st)}<div class="meta">${m.ts}<br>Source: ${m.src}</div></div>`).join('')}</div>`}
const catWorst=ms=>Math.max(...ms.map(m=>m.status));
function recBody(id){const r=RC[id];if(!r)return '<p class="un">Loading…</p>';
 return QS.categories.map(c=>{const ms=r.metrics.filter(m=>m.category==c.id);if(!ms.length)return'';const k='c'+id+':'+c.id,o=!!OPEN[k];
  return `<div class="acc"><button class="acc-h" data-acc="${k}" aria-expanded="${o}"><b>${esc(c.title)}</b><span class="r">${chip(catWorst(ms))}<span aria-hidden="true">${o?'▴':'▾'}</span></span></button>${o?`<div class="acc-b scroll"><table><tr><th>Metric</th><th>Value</th><th>Status</th><th>Note</th></tr>${ms.map(m=>`<tr><td>${esc(m.label)}</td><td>${esc(mval(m))}</td><td>${chip(m.status)}</td><td class="un">${esc(m.note)}</td></tr>`).join('')}</table></div>`:''}</div>`}).join('')}
function tlHistory(){if(!H.records.length)return '<p class="un">No questionnaires have been submitted yet. Your first record will appear here after submission.</p>';
 return H.records.map(r=>{const k='r'+r.id,o=!!OPEN[k];
  return `<div class="acc"><button class="acc-h" data-acc="${k}" aria-expanded="${o}"><span>${fmtDT(r.submitted_at)}</span><span class="r">${chip(r.overall)}<span>attention: ${r.n_attention} · critical: ${r.n_critical}</span><span aria-hidden="true">${o?'▴':'▾'}</span></span></button>${o?`<div class="acc-b">${recBody(r.id)}</div>`:''}</div>`}).join('')}

const NAV=[['overview','Overview'],['body','Body Map'],['health','Health Monitoring'],['research','Research Data'],['timeline','Health Timeline'],['sos','Emergency Assistance'],['profile','Profile & Settings']];
const SYS={Cardiovascular:['Heart rate','hr','Heart and major vessels. Related indicators: resting heart rate, blood pressure, oxygen saturation.','NASA Standard Measures (cardiovascular variables)'],Respiratory:['Oxygen saturation','spo2','Lungs and airways. Oxygen saturation is not currently reported.','NASA Standard Measures (placeholder)'],Nervous:['Sleep duration','sl','Brain and spinal cord. Sleep is the closest available indicator.','Inspiration4 OSD-569 (placeholder)'],Muscular:['Physical activity','act','Skeletal muscle. Activity minutes serve as a proxy for loading.','ARCHER (placeholder)'],Skeletal:['Physical activity','act','Bone structure. No direct bone measurements are available.','NASA HRP Omics Archive (placeholder)'],Digestive:['None available','','No digestive indicators are connected.','Immune Biomarkers (placeholder)']};
const DS=[['NASA Standard Measures','Clinical & performance','Tabular','Pre-flight, in-flight, post-flight','Baseline physiological measures collected across missions.'],['ARCHER','Research archive','Tabular','Varies by study','Archive of research data. Contents not loaded in this prototype.'],['CIPHER','Research archive','Tabular','Varies by study','Contents not loaded in this prototype.'],['Immune Biomarkers','Immunology','Assay results','Pre, in-flight, post','Immune marker panels. Contents not loaded.'],['NASA HRP Omics Archive','Omics','Omics','Varies by study','Omics data from Human Research Program studies.'],['Inspiration4 OSD-569','Multi-omics','Omics','Pre, post-flight','Inspiration4 civilian crew study via NASA OSDR.'],['Inspiration4 OSD-575','Multi-omics','Omics','Pre, post-flight','Inspiration4 civilian crew study via NASA OSDR.']];
function badge(){return `<span class="tag">Illustrative data — not real astronaut measurements</span>`}
const DEMOTAG=`<span class="tag warn">Demo values — no real data has been received yet</span>`;
const DISC='This is a preliminary automated assessment, not a medical diagnosis.';
const DEMO={hr_rest:[62,4,.7],bp_sys:[118,5,.5],sleep_hours:[6.8,.8,.9],exercise_min:[94,20,.6],spo2:[97.5,.6,.4]};
const seed=(n,b,a,k)=>Array.from({length:n},(_,i)=>+(b+a*Math.sin(i*k)+a*.4*Math.cos(i*k*2.3)).toFixed(1));
function demoPts(q){const[b,a,k]=DEMO[q],v=seed(7,b,a,k);return v.map((x,i)=>({day:i+1,t:null,v:x,s:0}))}
const POSITIONS=[['Commander','Commander'],['Pilot','Pilot'],['Mission Specialist','Mission Specialist'],['Flight Engineer','Flight Engineer'],['Payload Specialist','Payload Specialist'],['Medical Officer','Medical Officer']];
const posLabel=v=>(POSITIONS.find(p=>p[0]==v)||[v,v])[1];
const bdLim=y=>{const d=new Date();d.setFullYear(d.getFullYear()-y);return d.toISOString().slice(0,10)};
function ageFrom(bd){const b=new Date(bd+'T00:00:00'),n=new Date();let a=n.getFullYear()-b.getFullYear();const m=n.getMonth()-b.getMonth();if(m<0||(m==0&&n.getDate()<b.getDate()))a--;return a}
const fmtBD=bd=>new Date(bd+'T00:00:00').toLocaleDateString('en',{day:'numeric',month:'long',year:'numeric'});
let OPEN={},RC={};
let U=null,H=null,QS=null,M={},Q={},QE={},AV={},AE={},cur='overview',last='',ovr=7,range=7,metric='hr_rest',sys='Cardiovascular',layer='Internal organs',ds=0,authTab='login',msg='',emsg='',rd=null,busy=false,tickBusy=false;

function buildM(){const L=H&&H.latest,g=k=>L&&L.metrics.find(m=>m.key==k);
 const defs={hr:['hr_rest','Resting heart rate','bpm'],sys:['bp_sys','Blood pressure','mmHg'],sl:['sleep_hours','Sleep duration','h'],act:['exercise_min','Physical activity','min'],spo2:['spo2','Oxygen saturation','%']};
 const o={};for(const k in defs){const[q,name,unit]=defs[k],m=g(q);
  const pts=L?overviewChart(q).pts:demoPts(q);let val='—',st=0,ts='—',src='Questionnaire';
  if(L){if(m){val=String(m.value_num);if(k=='sys'){const d=g('bp_dia');val=m.value_num+' / '+(d?d.value_num:'—')}st=m.status;ts=fmtDT(L.submitted_at)}}
  else{const p=pts[pts.length-1];val=k=='sys'?'118 / 76':String(p.v);ts='Demo';src='Demo'}
  o[k]={name,unit,val,src,ts,pts,st,demo:!L}}
 return o}

async function loadAll(){
 const[st,lt,se,hi,so]=await Promise.all([api('/api/health/status'),api('/api/health/latest'),api('/api/health/charts'),api('/api/health/history'),api('/api/sos')]);
 srvOff=Date.parse(st.server_time)-Date.now();H={status:st,latest:lt.record,charts:se,records:hi.records,sos:so.requests}}
function cdText(){const left=Date.parse(H.status.next_available_at)-(Date.now()+srvOff);if(left<=0)return'0 min';const s=Math.floor(left/1000);return `${Math.floor(s/3600)} h ${String(Math.floor(s%3600/60)).padStart(2,'0')} min ${String(s%60).padStart(2,'0')} sec`}

/* ---------- auth ---------- */
function afield(k,l,t,ac,extra=''){return `<div class="fd ${AE[k]?'bad':''}"><label for="a-${k}">${l}<span class="rq"> *</span></label><input id="a-${k}" data-a="${k}" type="${t}" value="${esc(AV[k])}" autocomplete="${ac}" ${extra}>${AE[k]?`<small class="err" role="alert">${esc(AE[k])}</small>`:''}</div>`}
function posField(){return `<div class="fd ${AE.position?'bad':''}"><label for="a-position">Position<span class="rq"> *</span></label><select id="a-position" data-a="position"><option value="">Select a position</option>${POSITIONS.map(([v,l])=>`<option value="${esc(v)}" ${AV.position==v?'selected':''}>${esc(l)}</option>`).join('')}</select>${AE.position?`<small class="err" role="alert">${esc(AE.position)}</small>`:''}</div>`}
function authView(){const reg=authTab=='reg';
 const fields=reg?afield('first_name','First name','text','given-name','minlength="3" maxlength="16"')+afield('last_name','Last name','text','family-name','minlength="3" maxlength="16"')+posField()+afield('birth_date','Date of birth','date','bday','min="'+bdLim(90)+'" max="'+bdLim(18)+'"')+afield('astro_id','Astronaut ID','text','username','maxlength="20" placeholder="e.g. A-07"')+afield('password','Password (3–8 characters)','password','new-password','maxlength="8"')+afield('password2','Confirm password','password','new-password','maxlength="8"')
  :afield('astro_id','Astronaut ID','text','username','maxlength="20"')+afield('password','Password','password','current-password','maxlength="128"');
 return `<div class="reg-w"><div class="logo" style="padding:0 0 28px">ASTRO<i>VITAL</i></div><h1>${reg?'Register':'Sign in'}</h1><p class="sub">${reg?'Create an astronaut profile. All fields are required. The ID must be unique.':'Enter your astronaut ID and password.'}</p>
 <div class="row" role="group"><button class="btn ${reg?'':'on'}" data-tab="login" type="button">Sign in</button><button class="btn ${reg?'on':''}" data-tab="reg" type="button">Register</button></div>
 <form id="af" novalidate style="margin-top:22px">${AE._?`<p class="err2" role="alert">${esc(AE._)}</p>`:''}<div class="fgrid">${fields}</div><div class="row" style="margin-top:26px"><button class="btn on" type="submit" ${busy?'disabled':''}>${reg?'Create profile':'Sign in'}</button></div></form>
 <p class="un" style="font-size:12px;margin-top:24px">Passwords are stored as hashes and cannot be viewed by administrators. <a class="ma" href="/admin">Administrator sign in</a></p></div>`}
function pwForm(forced){return `<form id="pw" novalidate>${AE._?`<p class="err2" role="alert">${esc(AE._)}</p>`:''}<div class="fgrid">${afield('opw',forced?'Temporary password':'Current password','password','current-password')}${afield('npw','New password (3–8 characters)','password','new-password','maxlength="8"')}${afield('npw2','Confirm new password','password','new-password','maxlength="8"')}</div><div class="row" style="margin-top:20px"><button class="btn on" type="submit">Change password</button>${forced?'<button class="btn" type="button" id="lo">Sign out</button>':''}</div></form>`}
async function doAuth(){const reg=authTab=='reg',v=AV;AE={};const t=k=>(v[k]||'').trim();
 if(reg){{const bad=s=>s.length<3||s.length>16;if(bad(t('first_name')))AE.first_name='First name must be 3–16 characters.';if(bad(t('last_name')))AE.last_name='Last name must be 3–16 characters.';if(!POSITIONS.some(p=>p[0]==t('position')))AE.position='Select a position from the list.'}
  const bd=t('birth_date');if(!/^\d{4}-\d{2}-\d{2}$/.test(bd)||isNaN(Date.parse(bd)))AE.birth_date='Enter a valid date of birth.';else{const ag=ageFrom(bd);if(ag<18||ag>90)AE.birth_date='Age must be between 18 and 90.'}
  if(!/^[A-Za-z0-9][A-Za-z0-9-]{2,19}$/.test(t('astro_id')))AE.astro_id='Use 3–20 characters: letters, numbers, or hyphens.';
  const pl=(v.password||'').length;if(pl<3||pl>8)AE.password='Password must be 3–8 characters.';else if(v.password!==v.password2)AE.password2='Passwords do not match.'}
 else{if(!t('astro_id'))AE.astro_id='Enter your ID.';if(!v.password)AE.password='Enter your password.'}
 if(Object.keys(AE).length){render();return}
 busy=true;render();
 try{const r=await api(reg?'/api/register':'/api/login',reg?{first_name:t('first_name'),last_name:t('last_name'),position:t('position'),birth_date:t('birth_date'),astro_id:t('astro_id'),password:v.password}:{astro_id:t('astro_id'),password:v.password});
  U=r.user;AV={};if(!U.must_change)await loadAll();location.hash='#overview'}
 catch(e){AE._=e.message;if(e.data&&e.data.fields)Object.assign(AE,e.data.fields)}
 busy=false;render()}
async function doPw(){AE={};const v=AV;
 if((v.npw||'').length<3||(v.npw||'').length>8)AE.npw='Password must be 3–8 characters.';else if(v.npw!==v.npw2)AE.npw2='Passwords do not match.';if(!v.opw)AE.opw='Enter your password.';
 if(Object.keys(AE).length){render();return}
 try{await api('/api/password',{old:v.opw,new:v.npw});const was=U.must_change;U.must_change=false;AV={};msg='Password changed.';if(was)await loadAll()}
 catch(e){AE._=e.message;if(e.data&&e.data.fields)Object.assign(AE,e.data.fields)}
 render()}
async function logout(){try{await api('/api/logout',{})}catch(e){}U=null;H=null;AV={};AE={};msg='';OPEN={};RC={};location.hash='';render()}

/* ---------- questionnaire ---------- */
function qField(f){const e=QE[f.key],v=Q[f.key]??'';let c;
 if(f.type=='num')c=`<input id="q-${f.key}" data-q="${f.key}" type="number" inputmode="decimal" min="${f.min}" max="${f.max}" step="${f.step}" value="${esc(v)}">`;
 else if(f.type=='choice')c=`<select id="q-${f.key}" data-q="${f.key}"><option value="">Select an option</option>${f.options.map(o=>`<option value="${esc(o.value)}" ${v==o.value?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`;
 else c=`<textarea id="q-${f.key}" data-q="${f.key}" rows="3" maxlength="1000">${esc(v)}</textarea>`;
 const h=f.type=='num'?`${f.min}–${f.max} ${f.unit} · reference: ${f.norm}`:(f.hint||'');
 return `<div class="fd ${e?'bad':''}" ${f.type=='text'?'style="grid-column:1/-1"':''}><label for="q-${f.key}">${esc(f.label)}${f.req?'<span class="rq"> *</span>':''}</label>${c}${e?`<small class="err" role="alert">${esc(e)}</small>`:`<small>${esc(h)}</small>`}</div>`}
function qForm(){return `<form id="qf" novalidate>${QS.categories.map(c=>`<div class="panel" style="margin-bottom:16px"><h2 style="margin:0 0 14px">${esc(c.title)}</h2><div class="fgrid">${c.fields.map(qField).join('')}</div></div>`).join('')}${emsg?`<p class="err2" role="alert">${esc(emsg)}</p>`:''}<div class="row"><button class="btn on" type="submit" ${busy?'disabled':''}>Submit questionnaire</button></div><p class="un" style="font-size:12px">${DISC} Your next questionnaire will be available 24 hours after submission (server time).</p></form>`}
async function doQ(){QE={};emsg='';msg='';const ans={};let bad=false;
 for(const c of QS.categories)for(const f of c.fields){const v=String(Q[f.key]??'').trim();if(v===''){if(f.req){QE[f.key]='This field is required.';bad=true}}else ans[f.key]=f.type=='num'?Number(v):v}
 if(bad){emsg='Complete all required fields.';render();const el=document.querySelector('.fd.bad');if(el)el.scrollIntoView({block:'center'});return}
 busy=true;render();
 try{await api('/api/health',{answers:ans});Q={};rd=null;msg='Questionnaire submitted. Results updated.';await loadAll();busy=false;render();const r=$('res');if(r)r.scrollIntoView();return}
 catch(e){emsg=e.message;if(e.data&&e.data.fields){QE=e.data.fields}if(e.status==429||e.status==401){try{await loadAll()}catch(_){}}}
 busy=false;render()}

/* ---------- SOS ---------- */
function openSos(){$('sr').innerHTML='<option value="">Select a reason</option>'+QS.sos_reasons.map(r=>`<option>${esc(r)}</option>`).join('');$('se').textContent='';$('dlg').showModal()}
async function doSos(){const r=$('sr').value,d=$('sd').value.trim();$('se').textContent='';
 if(!r){$('se').textContent='Select a reason for the request.';return}if(d.length<10){$('se').textContent='Please provide more detail (at least 10 characters).';return}
 try{await api('/api/sos',{reason:r,description:d});$('dlg').close();$('sd').value='';H.sos=(await api('/api/sos')).requests;msg='Request submitted.';location.hash='#sos';render()}
 catch(e){$('se').textContent=e.message}}

/* ---------- views ---------- */
const V={
overview(){const L=H.latest,demo=!L,cnt=[0,0,0];if(L)L.metrics.forEach(m=>cnt[m.status]++);
 const ev=[...H.records.slice(0,3).map(r=>['Questionnaire submitted · '+ST[r.overall],fmtDT(r.submitted_at),'Questionnaire']),...H.sos.slice(0,2).map(s=>['SOS: '+esc(s.reason)+' · '+SL[s.status],fmtDT(s.created_at),'SOS'])];
 return `<div class="ovh"><div><span class="k">${esc(U.first_name+' '+U.last_name)} · ${esc(U.astro_id)}</span><h1>Overview</h1></div>
<div><span class="k">Position</span><span class="v">${esc(U.position)}</span></div>
<div><span class="k">Questionnaires completed</span><span class="day">${H.records.length}</span></div>
<div><span class="k">Current status</span>${demo?'<span class="chip s0">Stable</span><span class="k" style="margin-top:6px">demo</span>':chip(L.overall)}</div></div>
<p class="un" style="margin:12px 0 0">${demo?DEMOTAG:'Status is based on the latest questionnaire ('+fmtDT(L.submitted_at)+'). '+DISC}</p>
<div class="inds">${Object.values(M).map(m=>`<div class="ind ${m.demo?'off':''}"><div class="nm">${m.name}</div><div class="val">${m.val} <small>${m.unit}</small></div>${m.demo?'<span class="st unavailable">○ Demo</span>':chip(m.st)}<div class="meta">${m.ts}<br>Source: ${m.src}</div></div>`).join('')}</div>
<div class="ovg"><section><h2>Resting heart rate${demo?', demonstration data':''}</h2>
<p class="un" style="margin:0 0 8px">${overviewChartTitle(demo)}</p>
${dchart(M.hr.name,M.hr.unit,M.hr.pts,demo)}<p class="un" style="font-size:12px">${demo?'Illustrative values, not astronaut telemetry.':'Points show questionnaire results; colors indicate status.'}</p></section>
<aside><h2>Recent activity</h2>${ev.length?`<ul class="act">${ev.map(e=>`<li><span>${e[0]}</span><span class="c">${e[2]}</span><span class="s">${e[1]}</span></li>`).join('')}</ul>`:'<p class="un">No recent activity.</p>'}
<h2>Data availability</h2>${demo?'<p class="un">No real data is available yet. Complete your first questionnaire on the Health Monitoring page.</p>':`<div class="av2">${ST.map((s,i)=>`<span class="chip s${i}" style="margin:0">${s}</span><span></span><b>${cnt[i]}</b>`).join('')}</div><p class="un" style="font-size:12px">Metric counts from the latest questionnaire.</p>`}</aside></div>
<div class="qn" role="navigation" aria-label="Quick navigation">${[['body','Body Map'],['health','Health Monitoring'],['research','Research Data'],['timeline','Health Timeline']].map(a=>`<a class="btn" href="#${a[0]}">${a[1]}</a>`).join('')}<button class="btn red" data-sos>SOS</button></div>`},
body(){const s=SYS[sys],m=M[s[1]];return `<h1>Body Map</h1><p class="sub">Select a system to see related indicators and references.</p>
<div class="grid" style="grid-template-columns:1fr 340px"><div><div class="row">${['External','Muscular','Skeletal','Internal organs','Cardiovascular'].map(l=>`<button class="btn ${l==layer?'on':''}" data-layer="${l}">${l}</button>`).join('')}</div>
<div class="stage"><svg viewBox="0 0 600 460" aria-hidden="true"><g class="orb" fill="none" stroke="#8884B8" stroke-opacity=".28"><ellipse cx="300" cy="230" rx="260" ry="90"/><ellipse cx="300" cy="230" rx="200" ry="200" stroke-dasharray="2 8"/></g><circle cx="300" cy="230" r="3" fill="#8AC9D8"/></svg><p><span class="tag warn">3D model slot</span><br><br>Layer: ${layer}. Selected: ${sys}.<br>Load an anatomical GLB here with React Three Fiber; mesh names map to <code>structure_id</code>.</p></div></div>
<div><h2 style="margin-top:0">Systems</h2>${Object.keys(SYS).map(k=>`<button class="sys ${k==sys?'on':''}" data-sys="${k}">${k}</button>`).join('')}
<h2>${sys}</h2><p class="un">${s[2]}</p><div class="panel"><b>${m?m.name:s[0]}</b>${m&&m.pts.length?`<div class="n" style="font:300 30px var(--serif)">${m.val} <small class="un" style="font:12px var(--sans)">${m.unit}</small></div>${dchart(m.name,m.unit,m.pts,m.demo)}`:`<p class="un">No data available.</p>`}</div><p class="un">Reference: ${s[3]}</p></div></div>`},
health(){const L=H.latest,st=H.status,demo=!L;
 const nums=QS.categories.flatMap(c=>c.fields).filter(f=>f.type=='num'),mf=nums.find(f=>f.key==metric)||nums[0];
 const pts=demo?(DEMO[mf.key]?demoPts(mf.key):[]):(H.charts.cycle.series[mf.key]||[]);
 const cards=`<div class="inds"><div class="ind"><div class="nm">Current status</div><div class="val" style="font-size:26px">${demo?'<span class="chip s0">Stable</span>':chip(L.overall)}</div><div class="meta">${demo?'Demo values':'Based on latest questionnaire'}</div></div>
<div class="ind"><div class="nm">Latest questionnaire</div><div class="val" style="font-size:22px">${st.last_submitted_at?fmtDT(st.last_submitted_at):'Not submitted yet'}</div><div class="meta">Server time</div></div>
<div class="ind"><div class="nm">Next questionnaire</div>${st.can_submit?'<div class="val" style="font-size:22px">Available now</div>':`<div class="val" id="cd" style="font-size:22px">${cdText()}</div>`}<div class="meta">${st.can_submit?'Limited to once every 24 hours':'Available at '+fmtDT(st.next_available_at)}</div></div></div>`;
 const form=st.can_submit?qForm():`<div class="panel"><b>Today's questionnaire has already been submitted.</b><p class="un" style="margin:6px 0 0">Your next questionnaire will be available ${fmtDT(st.next_available_at)} (<span id="cd2">${cdText()}</span> remaining).</p></div>`;
 const results=L?`<h2 id="res">Latest questionnaire results</h2><p class="un">${fmtDT(L.submitted_at)} · ${DISC}</p>${L.overall==2?'<div class="alert"><b>Critical indicators detected.</b> Prompt medical assessment is recommended. Use <button class="btn red" data-sos>SOS</button> in an emergency.</div>':''}${resTables(L.metrics,QS.categories)}`:'';
 const hist=`<h2>Questionnaire history</h2>${H.records.length?`<div class="scroll"><table><tr><th>Date and time</th><th>Status</th><th>Attention</th><th>Critical</th><th></th></tr>${H.records.map(r=>`<tr><td>${fmtDT(r.submitted_at)}</td><td>${chip(r.overall)}</td><td>${r.n_attention}</td><td>${r.n_critical}</td><td><button class="btn" data-rec="${r.id}">${rd&&rd.id==r.id?'Hide':'Details'}</button></td></tr>${rd&&rd.id==r.id?`<tr><td colspan="5">${resTables(rd.metrics,QS.categories)}</td></tr>`:''}`).join('')}</table></div>`:'<p class="un">No questionnaires have been submitted yet.</p>'}`;
 return `<h1>Health Monitoring</h1><p class="sub">Daily questionnaire across seven health categories. ${DISC}</p>${demo?`<p>${DEMOTAG}</p>`:''}${msg?`<p class="ok2" role="status">${esc(msg)}</p>`:''}${cards}
<h2>Daily questionnaire</h2>${form}${results}
<h2>Daily chart · ${chartTitle(demo)}</h2>${demo?`<p>${DEMOTAG}</p>`:''}
<div class="row"><div class="fd" style="min-width:280px"><label for="msel">Metric</label><select id="msel" data-msel>${nums.map(f=>`<option value="${f.key}" ${f.key==mf.key?'selected':''}>${esc(f.label)}</option>`).join('')}</select></div></div>
${dchart(mf.label,mf.unit,pts,demo)}${demo?'':weeklyBlock(mf,H.charts.weeks)}<p class="un" style="font-size:12px">Units: ${mf.unit}. Point color indicates status: <span class="s0">stable</span>, <span class="s1">attention</span>, <span class="s2">critical</span>. Charts are for display; all history is stored on the server.</p>${hist}`},
research(){const d=DS[ds];return `<h1>Research Data</h1><span class="tag warn">HISTORICAL RESEARCH DATA — INSPIRATION4</span><p class="sub" style="margin-top:12px">Archived NASA research. Separate from current monitoring. Values are not loaded here; tables show placeholders.</p>
<div class="grid" style="grid-template-columns:260px 1fr"><div>${DS.map((x,i)=>`<button class="sys ${i==ds?'on':''}" data-ds="${i}">${x[0]}</button>`).join('')}</div>
<div><h2 style="margin-top:0">${d[0]}</h2><p class="un">${d[4]}</p><table><tr><td class="un">Category</td><td>${d[1]}</td></tr><tr><td class="un">Data type</td><td>${d[2]}</td></tr><tr><td class="un">Timepoints</td><td>${d[3]}</td></tr><tr><td class="un">Source</td><td>NASA OSDR (attribution required)</td></tr></table>
<h2>Variables</h2><table><tr><th>Variable</th><th>Timepoint</th><th>Value</th></tr>${['Variable 1','Variable 2','Variable 3'].map(v=>`<tr><td>${v}</td><td>${d[3].split(',')[0]}</td><td class="un">Placeholder — CSV not loaded</td></tr>`).join('')}</table></div></div>`},
timeline(){const L=H.latest,demo=!L;
 const crit=L?L.metrics.filter(m=>m.status==2):[];
const top=demo?`<p>${DEMOTAG}</p><p class="un">No real measurements are available yet. Stable demo values are shown below and will be replaced after your first questionnaire.</p>${indCards()}`
 :`<p>${chip(L.overall)} <span class="un">based on the questionnaire from ${fmtDT(L.submitted_at)}. ${DISC}</span></p>${crit.length?`<div class="alert"><b>Critical indicators:</b><ul style="margin:6px 0 0;padding-left:18px">${crit.map(m=>`<li>${esc(m.label)}: ${esc(mval(m))}</li>`).join('')}</ul></div>`:''}${indCards()}`;
return `<h1>Health Timeline</h1><p class="sub">Current status and history of submitted questionnaires. Select a record to expand its categories.</p>${msg?`<p class="ok2" role="status">${esc(msg)}</p>`:''}
<h2 style="margin-top:0">Current health status</h2>${top}<h2>Questionnaire history (${H.records.length})</h2>${emsg?`<p class="err2" role="alert">${esc(emsg)}</p>`:''}${tlHistory()}`},
sos(){return `<h1>Emergency Assistance</h1><p class="sub">Send an emergency request to an administrator. This works independently of the daily questionnaire. It is not a diagnosis and does not track you automatically.</p>${msg?`<p class="ok2" role="status">${esc(msg)}</p>`:''}
<div class="grid" style="grid-template-columns:200px 1fr"><div><button class="sosb" id="sosb" data-sos>SOS</button></div>
<div><p>Press SOS, select a reason, and describe the issue. Your request will appear in the admin panel immediately.</p><h2>My requests</h2>${H.sos.length?`<div class="scroll"><table><tr><th>Date</th><th>Reason</th><th>Description</th><th>Status</th></tr>${H.sos.map(s=>`<tr><td>${fmtDT(s.created_at)}</td><td>${esc(s.reason)}</td><td class="un" style="white-space:pre-wrap">${esc(s.description)}</td><td>${sosChip(s.status)}</td></tr>`).join('')}</table></div>`:'<p class="un">No requests yet.</p>'}</div></div>`},
profile(){const rows=[['First name',U.first_name],['Last name',U.last_name],['Astronaut ID',U.astro_id],['Position',posLabel(U.position)],['Date of birth',fmtBD(U.birth_date)],['Current age',ageFrom(U.birth_date)],['Registration date',fmtDT(U.created_at)]];
return `<h1>Profile & Settings</h1><p class="sub">Your registration details are stored on the server. Passwords are stored as hashes.</p>${msg?`<p class="ok2" role="status">${esc(msg)}</p>`:''}
<div class="grid" style="grid-template-columns:1.3fr 1fr"><div><h2 style="margin-top:0">Personal information</h2><table>${rows.map(r=>`<tr><td class="un">${r[0]}</td><td>${esc(r[1])}</td></tr>`).join('')}</table><div class="row" style="margin-top:20px"><button class="btn" id="lo">Sign out</button></div></div>
<div><h2 style="margin-top:0">Change password</h2>${pwForm(false)}</div></div>`}};

function render(){cur=(location.hash||'#overview').slice(1);if(!V[cur])cur='overview';
 const app=$('app'),auth=!U||U.must_change;app.classList.toggle('reg',auth);
 if(!U){$('main').innerHTML=authView();last='';return}
 if(U.must_change){$('main').innerHTML=`<div class="reg-w"><div class="logo" style="padding:0 0 28px">ASTRO<i>VITAL</i></div><h1>Change your password</h1><p class="sub">An administrator reset your password. Enter your temporary password and choose a new one.</p>${msg?`<p class="ok2">${esc(msg)}</p>`:''}${pwForm(true)}</div>`;last='';return}
 if(!H){$('main').innerHTML='<p class="un">Loading…</p>';return}
 M=buildM();
 $('nav').innerHTML=`<div class="logo">ASTRO<i>VITAL</i></div>`+NAV.map(([k,l])=>`<a href="#${k}" class="${k==cur?'on':''} ${k=='sos'?'sos':''}">${l}</a>`).join('');
 $('top').innerHTML=`<span>Astronaut <b>${esc(U.astro_id)}</b></span><span>${esc(U.position)}</span><span><i class="dot"></i><b>${H.latest?ST[H.latest.overall]:'Demo status'}</b></span><span class="sp"></span><button class="btn red" data-sos>SOS</button><a href="#profile">${esc(U.first_name+' '+U.last_name)}</a><button class="btn" id="lo">Sign out</button>`;
 const mn=$('main');mn.innerHTML=V[cur]();mn.classList.remove('fade');if(cur!==last){void mn.offsetWidth;mn.classList.add('fade')}last=cur}

/* ---------- events (delegated) ---------- */
document.addEventListener('click',async e=>{const t=e.target.closest('button,a');if(!t)return;const d=t.dataset;
 if(t.matches('nav a,.qn a,header a')){msg='';emsg=''}
 if('sos' in d||t.id=='sosb'){e.preventDefault();openSos();return}
 if(t.id=='lo'){logout();return}
 if(t.id=='sc'){$('dlg').close();return}
 if(d.acc){const k=d.acc;OPEN[k]=!OPEN[k];emsg='';if(k[0]=='r'&&OPEN[k]&&!RC[k.slice(1)]){render();try{RC[k.slice(1)]=await api('/api/health/record/'+k.slice(1))}catch(err){OPEN[k]=false;emsg=err.message}}render();return}
 if(d.tab){authTab=d.tab;AE={};render();return}
 if(d.ovr){ovr=+d.ovr;render();return}if(d.range){range=+d.range;render();return}
 if(d.sys){sys=d.sys;render();return}if(d.layer){layer=d.layer;render();return}if(d.ds){ds=+d.ds;render();return}
 if(d.rec){const id=+d.rec;if(rd&&rd.id==id)rd=null;else try{rd=await api('/api/health/record/'+id)}catch(err){emsg=err.message}render()}});
const onField=e=>{const t=e.target;if(t.dataset.q)Q[t.dataset.q]=t.value;if(t.dataset.a)AV[t.dataset.a]=t.value};
document.addEventListener('input',onField);
document.addEventListener('change',e=>{onField(e);if(e.target.dataset.msel!==undefined){metric=e.target.value;render()}});
document.addEventListener('submit',e=>{e.preventDefault();({af:doAuth,qf:doQ,pw:doPw,sf:doSos})[e.target.id]?.()});
addEventListener('hashchange',async()=>{render();if(U&&!U.must_change&&H&&(location.hash=='#sos'||location.hash=='#overview')){try{const so=await api('/api/sos');if(JSON.stringify(so.requests)!==JSON.stringify(H.sos)){H.sos=so.requests;render()}}catch(e){if(e.status==401){U=null;H=null;render()}}}});
setInterval(()=>{if(!H||H.status.can_submit||!H.status.next_available_at)return;
 if(Date.parse(H.status.next_available_at)-(Date.now()+srvOff)<=0){if(!tickBusy){tickBusy=true;loadAll().then(render).catch(()=>{}).finally(()=>tickBusy=false)}return}
 ['cd','cd2'].forEach(i=>{const el=$(i);if(el)el.textContent=cdText()})},1000);
(async()=>{try{QS=await api('/api/questionnaire')}catch(e){}
 try{U=(await api('/api/me')).user;if(!U.must_change)await loadAll()}catch(e){U=null}
 render()})();
