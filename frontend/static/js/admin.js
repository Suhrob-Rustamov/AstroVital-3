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

const API='/admin/api';
let A=null,QS=null,users=[],sosList=[],critical=[],sosFilter='',view='sos',cur=null,det=null,ser={},range=0,metric='hr_rest',rd=null,tempPw=null,msg='',AE={},AV={},busy=false,lastSig='';
const aget=p=>api(API+p),apost=(p,b)=>api(API+p,b);
const fullName=o=>esc(o.first_name+' '+o.last_name);

async function loadLists(){const[u,s,c]=await Promise.all([aget('/users'),aget('/sos'),aget('/critical')]);users=u.users;sosList=s.requests;critical=c.items}
function route(){const h=(location.hash||'#sos').slice(1),m=h.match(/^user\/(\d+)$/);
 if(m){view='user';return+m[1]}view=['sos','users','critical','password'].includes(h)?h:'sos';return null}
async function go(){const id=route();rd=null;tempPw=null;
 if(!A)return render();
 try{await loadLists();if(id){const[d,s]=await Promise.all([aget('/users/'+id),aget('/users/'+id+'/series?days=0')]);const r=await aget('/users/'+id+'/records');det={...d,records:r.records};ser=conv(s.series);cur=id;
  const num=QS.categories.flatMap(c=>c.fields).filter(f=>f.type=='num');if(!num.find(f=>f.key==metric))metric=num[0].key}}
 catch(e){if(e.status==401){A=null}else msg=e.message}
 render()}

function loginView(){return `<div class="reg-w"><div class="logo" style="padding:0 0 28px">ASTRO<i>VITAL</i> · Admin</div><h1>Administrator sign in</h1><p class="sub">Administrator access only.</p>
<form id="lf" novalidate>${AE._?`<p class="err2" role="alert">${esc(AE._)}</p>`:''}<div class="fgrid"><div class="fd"><label for="u">Username</label><input id="u" data-a="username" autocomplete="username" value="${esc(AV.username)}"></div><div class="fd"><label for="p">Password</label><input id="p" type="password" data-a="password" autocomplete="current-password"></div></div><div class="row" style="margin-top:24px"><button class="btn on" type="submit" ${busy?'disabled':''}>Sign in</button></div></form></div>`}

const sosTable=(rows,withUser=true)=>rows.length?`<div class="scroll"><table><tr><th>#</th><th>Date and time</th>${withUser?'<th>Astronaut</th><th>ID</th><th>Position</th>':''}<th>Reason</th><th>Description</th><th>Status</th></tr>${rows.map(s=>`<tr><td>${s.id}</td><td>${fmtDT(s.created_at)}</td>${withUser?`<td><a class="ma" href="#user/${s.uid}">${fullName(s)}</a></td><td>${esc(s.astro_id)}</td><td>${esc(s.position)}</td>`:''}<td>${esc(s.reason)}</td><td class="w">${esc(s.description)}</td><td>${withUser?`<select class="mini" data-sosid="${s.id}">${Object.keys(SL).map(k=>`<option value="${k}" ${k==s.status?'selected':''}>${SL[k]}</option>`).join('')}</select>${s.handled_by?`<div class="un" style="font-size:11px">${esc(s.handled_by)} · ${fmtDT(s.updated_at)}</div>`:''}`:sosChip(s.status)}</td></tr>`).join('')}</table></div>`:'<p class="un">No requests.</p>';

const V={
sos(){const rows=sosFilter?sosList.filter(s=>s.status==sosFilter):sosList;
 return `<h1>SOS requests</h1><p class="sub">Astronaut requests appear automatically (refreshes every 10 seconds).</p>
<div class="row">${[['','All'],...Object.entries(SL)].map(([k,l])=>`<button class="btn ${k==sosFilter?'on':''}" data-f="${k}">${l}${k?` (${sosList.filter(s=>s.status==k).length})`:` (${sosList.length})`}</button>`).join('')}</div>${sosTable(rows)}`},
users(){return `<h1>Astronauts</h1><p class="sub">Select an astronaut to view their registration details, questionnaires, and charts.</p>${users.length?`<div class="scroll"><table><tr><th>Name</th><th>ID</th><th>Position</th><th>Age</th><th>Status</th><th>Latest questionnaire</th><th>Questionnaires</th><th>Open SOS</th></tr>${users.map(u=>`<tr class="lk" data-open="${u.id}"><td><a class="ma" href="#user/${u.id}">${fullName(u)}</a></td><td>${esc(u.astro_id)}</td><td>${esc(u.position)}</td><td>${u.age}</td><td>${u.overall==null?'<span class="un">No data</span>':chip(u.overall)}</td><td>${u.last_at?fmtDT(u.last_at):'—'}</td><td>${u.n_records}</td><td>${u.open_sos?`<span class="chip s2">${u.open_sos}</span>`:'0'}</td></tr>`).join('')}</table></div>`:'<p class="un">No astronauts have registered yet.</p>'}`},
critical(){return `<h1>Critical indicators</h1><p class="sub">Indicators marked “Critical” in each astronaut’s latest questionnaire. This is a preliminary automated assessment, not a diagnosis.</p>${critical.length?`<div class="scroll"><table><tr><th>Astronaut</th><th>ID</th><th>Metric</th><th>Value</th><th>When</th><th>Note</th></tr>${critical.map(c=>`<tr><td><a class="ma" href="#user/${c.uid}">${fullName(c)}</a></td><td>${esc(c.astro_id)}</td><td>${esc(c.label)}</td><td>${esc(c.value_text!=null?c.value_text:c.value_num+' '+c.unit)}</td><td>${fmtDT(c.measured_at)}</td><td class="un">${esc(c.note)}</td></tr>`).join('')}</table></div>`:'<p class="un">No critical indicators.</p>'}`},
user(){if(!det)return'<p class="un">Loading…</p>';const u=det.user,L=det.latest;
 const nums=QS.categories.flatMap(c=>c.fields).filter(f=>f.type=='num'),mf=nums.find(f=>f.key==metric),mm={name:mf.label,unit:mf.unit,pts:ser[mf.key]||[]};
 const crit=L?L.metrics.filter(m=>m.status==2):[];
 return `<p><a class="ma" href="#users">← All astronauts</a></p><h1>${fullName(u)}</h1><p class="sub">${esc(u.astro_id)} · ${esc(u.position)}</p>${msg?`<p class="ok2" role="status">${esc(msg)}</p>`:''}
<div class="grid" style="grid-template-columns:1fr 1fr"><div><h2 style="margin-top:0">Registration details</h2><table>${[['First name',u.first_name],['Last name',u.last_name],['Position',u.position],['Date of birth',u.birth_date],['Age',u.age],['Astronaut ID',u.astro_id],['Registered',fmtDT(u.created_at)]].map(r=>`<tr><td class="un">${r[0]}</td><td>${esc(r[1])}</td></tr>`).join('')}<tr><td class="un">Password</td><td class="un">Stored as a hash; unavailable</td></tr></table>
<div class="row" style="margin-top:14px"><button class="btn" data-reset="${u.id}">Reset password</button></div>${tempPw?`<div class="alert">Temporary password (shown once; share it with the astronaut, who must change it after signing in):<br><b style="font-size:18px;user-select:all">${esc(tempPw)}</b></div>`:''}</div>
<div><h2 style="margin-top:0">Current status</h2>${L?`<p>${chip(L.overall)} <span class="un">from questionnaire submitted ${fmtDT(L.submitted_at)}</span></p>${crit.length?`<div class="alert"><b>Critical indicators:</b><ul style="margin:6px 0 0;padding-left:18px">${crit.map(m=>`<li>${esc(m.label)}: ${esc(mval(m))}</li>`).join('')}</ul></div>`:'<p class="un">No critical indicators.</p>'}`:'<p class="un">No questionnaires have been submitted yet.</p>'}
<h2>SOS requests</h2>${sosTable(det.sos,false)}</div></div>
<h2>Metric chart</h2><div class="row"><div class="fd" style="min-width:280px"><label for="msel">Metric</label><select id="msel" data-msel>${nums.map(f=>`<option value="${f.key}" ${f.key==mf.key?'selected':''}>${esc(f.label)}</option>`).join('')}</select></div></div>
<div class="row"><span class="un" style="align-self:center">Period</span>${[[7,'Week'],[30,'30 days'],[90,'90 days'],[0,'All history']].map(([r,l])=>`<button class="btn ${r==range?'on':''}" data-range="${r}">${l}</button>`).join('')}</div>${wk(mm,range)}
<h2>All questionnaires (${det.records.length})</h2>${det.records.length?`<div class="scroll"><table><tr><th>Date and time</th><th>Status</th><th>Attention</th><th>Critical</th><th></th></tr>${det.records.map(r=>`<tr><td>${fmtDT(r.submitted_at)}</td><td>${chip(r.overall)}</td><td>${r.n_attention}</td><td>${r.n_critical}</td><td><button class="btn" data-rec="${r.id}">${rd&&rd.id==r.id?'Hide':'Details'}</button></td></tr>${rd&&rd.id==r.id?`<tr><td colspan="5">${resTables(rd.metrics,QS.categories)}</td></tr>`:''}`).join('')}</table></div>`:'<p class="un">No questionnaires.</p>'}`},
password(){return `<h1>Change password</h1><p class="sub">Administrator password.</p>${msg?`<p class="ok2" role="status">${esc(msg)}</p>`:''}<form id="pf" novalidate style="max-width:420px">${AE._?`<p class="err2" role="alert">${esc(AE._)}</p>`:''}<div class="fgrid" style="grid-template-columns:1fr">${[['opw','Current password'],['npw','New password (at least 8 characters)']].map(([k,l])=>`<div class="fd"><label for="${k}">${l}</label><input id="${k}" type="password" data-a="${k}" autocomplete="${k=='opw'?'current-password':'new-password'}"></div>`).join('')}</div><div class="row" style="margin-top:20px"><button class="btn on" type="submit">Change password</button></div></form>`}};

function render(){const app=$('app');app.classList.toggle('reg',!A);
 if(!A){$('main').innerHTML=loginView();return}
 const nNew=sosList.filter(s=>s.status=='new').length,nCrit=critical.length;
 $('nav').innerHTML=`<div class="logo">ASTRO<i>VITAL</i></div>`+[['sos','SOS requests',nNew],['users','Astronauts',0],['critical','Critical indicators',nCrit],['password','Change password',0]].map(([k,l,n])=>`<a href="#${k}" class="${(view==k||(view=='user'&&k=='users'))?'on':''} ${k=='sos'?'sos':''}">${l}${n?`<span class="bdg">${n}</span>`:''}</a>`).join('');
 $('top').innerHTML=`<span>Administrator panel</span><span class="sp"></span><span>${esc(A.username)}</span><button class="btn" id="lo">Sign out</button>`;
 const mn=$('main');mn.innerHTML=V[view]();msg=view=='password'||view=='user'?msg:''}

document.addEventListener('click',async e=>{const t=e.target.closest('button,tr[data-open]');if(!t)return;const d=t.dataset;
 if(t.matches('tr[data-open]')){if(!e.target.closest('a'))location.hash='#user/'+d.open;return}
 if(t.id=='lo'){try{await apost('/logout',{})}catch(_){}A=null;render();return}
 if(d.f!==undefined){sosFilter=d.f;render();return}
 if(d.range!==undefined){range=+d.range;render();return}
 if(d.reset){if(!confirm('Reset this astronaut’s password? Their current sessions will be revoked.'))return;try{tempPw=(await apost('/users/'+d.reset+'/reset-password',{})).temp_password}catch(err){msg=err.message}render();return}
 if(d.rec){const id=+d.rec;if(rd&&rd.id==id)rd=null;else try{rd=await aget(`/users/${cur}/records/${id}`)}catch(err){msg=err.message}render()}});
document.addEventListener('change',async e=>{const t=e.target;
 if(t.dataset.msel!==undefined){metric=t.value;render();return}
 if(t.dataset.sosid){try{await apost('/sos/'+t.dataset.sosid,{status:t.value});await loadLists()}catch(err){alert(err.message)}render()}});
document.addEventListener('input',e=>{if(e.target.dataset.a)AV[e.target.dataset.a]=e.target.value});
document.addEventListener('submit',async e=>{e.preventDefault();
 if(e.target.id=='lf'){AE={};busy=true;render();try{A=(await apost('/login',{username:(AV.username||'').trim(),password:AV.password||''})).admin;AV={};busy=false;await go();return}catch(err){AE._=err.message}busy=false;render()}
 if(e.target.id=='pf'){AE={};msg='';try{await apost('/password',{old:AV.opw||'',new:AV.npw||''});msg='Password changed.';AV={}}catch(err){AE._=err.message}render()}});
addEventListener('hashchange',go);
setInterval(async()=>{if(!A||view=='password')return;try{await loadLists();const sig=JSON.stringify([sosList,critical]);if(sig!==lastSig){lastSig=sig;if(view!='user'&&!(document.activeElement&&document.activeElement.tagName=='SELECT'))render();else{const n=$('nav');if(n)render()}}}catch(e){if(e.status==401){A=null;render()}}},10000);
(async()=>{try{QS=await api('/api/questionnaire')}catch(e){}
 try{A=(await aget('/me')).admin}catch(e){A=null}
 await go()})();
