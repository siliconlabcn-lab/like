export const players=[
{id:'ronaldo',name:'C 罗',full:'CRISTIANO RONALDO',country:'葡萄牙',number:7,tag:'自信出场',deep:'#310d1a',base:'#982339',shine:'#f2a1ae',glow:'#7d253e'},
{id:'yamal',name:'亚马尔',full:'LAMINE YAMAL',country:'西班牙',number:10,tag:'全息特别版',deep:'#21183e',base:'#6550d8',shine:'#e5ccff',glow:'#8d7fee'},
{id:'courtois',name:'库尔图瓦',full:'THIBAUT COURTOIS',country:'比利时',number:1,tag:'沉着应战',deep:'#20112f',base:'#653895',shine:'#d2aff5',glow:'#654287'},
{id:'messi',name:'梅西',full:'LIONEL MESSI',country:'阿根廷',number:10,tag:'享受足球',deep:'#152738',base:'#3f7a9c',shine:'#bae4f4',glow:'#305e78'},
{id:'mbappe',name:'姆巴佩',full:'KYLIAN MBAPPÉ',country:'法国',number:10,tag:'全速向前',deep:'#101a37',base:'#294a8e',shine:'#a7c8ff',glow:'#33457f'},
{id:'haaland',name:'哈兰德',full:'ERLING HAALAND',country:'挪威',number:9,tag:'全力一击',deep:'#311c10',base:'#9b5e2e',shine:'#f2cd91',glow:'#7b4a25'},
{id:'neymar',name:'内马尔',full:'NEYMAR JR.',country:'巴西',number:10,tag:'踢出灵感',deep:'#1c2b16',base:'#50713a',shine:'#d7eaaa',glow:'#4e6529'},
{id:'salah',name:'萨拉赫',full:'MOHAMED SALAH',country:'埃及',number:11,tag:'奔向球门',deep:'#33131d',base:'#9e3945',shine:'#f3b69d',glow:'#7e3435'},
{id:'bellingham',name:'贝林厄姆',full:'JUDE BELLINGHAM',country:'英格兰',number:10,tag:'迎接挑战',deep:'#242133',base:'#655d80',shine:'#e1d6f4',glow:'#625675'}
];

const heights={yamal:1.80,ronaldo:1.87,courtois:1.99,messi:1.70,mbappe:1.78,haaland:1.94,neymar:1.75,salah:1.75,bellingham:1.86};
for(const p of players){p.height=heights[p.id];p.image=p.id==='yamal'?'assets/yamal-card-portrait.png':p.id==='ronaldo'?'assets/ronaldo-holo-portrait.png':'../game/assets/'+(p.id==='messi'?'messi-photo.jpg':p.id+'.png');p.model=p.id==='yamal'?'assets/players/bellingham.glb':p.id==='ronaldo'?'assets/ronaldo-natural.glb':'assets/players/'+p.id+'.glb'}

const roles={ronaldo:'前锋',yamal:'右边锋',courtois:'门将',messi:'前锋',mbappe:'前锋',haaland:'中锋',neymar:'边锋',salah:'右边锋',bellingham:'中场'};
export function loadPortrait(image,source){
 image.decoding='async';
 image.addEventListener('error',()=>{image.src=source},{once:true});
 image.src=source.replace(/\.(png|jpg)$/,'.webp');
}

export function cardDesign(player){
 const {id,country,tag}=player;
 if(id==='ronaldo')return {colors:['#a82049','#67ba9b','#ffc7c5'],label:country,description:'葡萄牙 · 前锋 · 自信出场',page:'ronaldo-card.html'};
 if(id==='yamal')return {colors:['#514bd9','#72cfea','#ffafce'],label:'HOLO XI',description:'巴塞罗那 · 右边锋 · 西班牙',page:'yamal-card.html'};
 return {colors:[player.base,player.shine,'#f5eafd'],label:country,description:[country,roles[id],tag].join(' · '),page:'yamal-card.html?player='+id};
}

const foilStorageKey = playerId => 'homeground-v3-foil:' + playerId;
const copyStorageKey = playerId => 'homeground-v3-card-copy:' + playerId;
const foils = [
 ['原版虹彩', 'conic-gradient(#5a64ff,#a7efff,#ffa4cf,#5a64ff)'],
 ['蓝银', 'linear-gradient(145deg,#e2ecef,#7378ba)'],
 ['翡翠', 'linear-gradient(145deg,#e5f9df,#70d8c8)'],
 ['紫晶', 'linear-gradient(145deg,#f0d7ff,#9a79e8)'],
 ['玫瑰', 'linear-gradient(145deg,#ffe3ed,#ef9dbd)'],
 ['香槟金', 'linear-gradient(145deg,#fff3c7,#e0b45d)'],
];

function savedFoil(value) {
 return /^[0-5]$/.test(value ?? '') ? value : '0';
}

function readFoil(playerId) {
 try { return savedFoil(localStorage.getItem(foilStorageKey(playerId))); }
 catch { return '0'; }
}

function readCardCopy(player, design) {
 const initial={title:player.name,description:design.description};
 try {
  const saved=JSON.parse(localStorage.getItem(copyStorageKey(player.id)));
  if(typeof saved?.title==='string'&&typeof saved.description==='string'){
   return {title:saved.title.trim().slice(0,18)||initial.title,description:saved.description.slice(0,65)};
  }
 } catch { /* An unavailable store does not prevent selecting a player. */ }
 return initial;
}

export function rememberCardCustomization(playerId) {
 const stage = document.querySelector('.stage');
 const player=players.find(item=>item.id===playerId);
 const title=stage.querySelector('.copy h1');
 const description=stage.querySelector('.copy p');
 const dialog=document.querySelector('dialog');
 const refreshCopy=()=>{
  const copy=readCardCopy(player,cardDesign(player));
  title.textContent=copy.title;
  description.textContent=copy.description;
 };
 refreshCopy();
 dialog.addEventListener('close',()=>{
  if(dialog.returnValue!=='save')return;
  try {
   localStorage.setItem(copyStorageKey(playerId),JSON.stringify({title:title.textContent,description:description.textContent}));
  } catch {}
 });
 window.addEventListener('storage',event=>{
  if(event.key===copyStorageKey(playerId)||event.key===null)refreshCopy();
 });
 stage.dataset.foil = readFoil(playerId);
 for (const swatch of stage.querySelectorAll('.swatch')) {
  swatch.setAttribute('aria-pressed', String(swatch.dataset.index === stage.dataset.foil));
  swatch.addEventListener('click', () => {
   try { localStorage.setItem(foilStorageKey(playerId), swatch.dataset.index); }
   catch { /* The preview still works when storage is unavailable. */ }
  });
 }
}

export function buildRoster(container,select){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const template=document.querySelector('#roster-hologram');
 const editor=document.querySelector('#roster-card-editor');
 const form=editor.querySelector('form');
 let saveCopy=null;
 editor.addEventListener('close',()=>{
  if(editor.returnValue==='save')saveCopy?.();
  saveCopy=null;
 });
 const refreshCustomizations=new Map();
 for(const player of players){
  const design=cardDesign(player);
  const exhibit=document.createElement('article');
  exhibit.className='roster-card-exhibit';
  const card=document.createElement('button');
  card.type='button';
  card.className='player-card holo-ticket';
  card.dataset.player=player.id;
  card.setAttribute('aria-label','选择'+player.name);
  card.setAttribute('aria-pressed','false');
  card.style.setProperty('--shine',player.shine);
  design.colors.forEach((color,i)=>card.style.setProperty(['--original-a','--original-b','--original-c'][i],color));
  card.append(template.content.cloneNode(true));
  const number=String(player.number).padStart(2,'0');
  card.querySelector('.number').textContent=number;
  card.querySelector('.collection span:first-child').textContent=design.label;
  card.querySelector('.collection span:last-child').textContent='NO. '+number;
  card.querySelector('.copy .latin').textContent=player.full;
  const title=card.querySelector('.copy strong');
  const description=card.querySelector('.copy p');
  const setCopy=copy=>{
   title.textContent=copy.title;
   description.textContent=copy.description;
  };
  const refreshCopy=()=>setCopy(readCardCopy(player,design));
  refreshCopy();
  refreshCustomizations.set(copyStorageKey(player.id),refreshCopy);
  const portrait=card.querySelector('img');
  loadPortrait(portrait,player.image);
  if(player.id!=='yamal'&&player.id!=='ronaldo')card.querySelector('.face').dataset.portrait=player.id;
  card.onclick=()=>select(player);
  let x=.5,y=.3;
  function tilt(nextX,nextY){
   if(reduced.matches)return;
   x=Math.max(0,Math.min(1,nextX));
   y=Math.max(0,Math.min(1,nextY));
   card.style.transform=`perspective(850px) rotateX(${(.5-y)*8}deg) rotateY(${(x-.5)*10}deg)`;
   card.style.setProperty('--lx',`${x*100}%`);
   card.style.setProperty('--ly',`${y*100}%`);
   card.style.setProperty('--angle',`${132+(x-y)*44}deg`);
  }
  const resetTilt=()=>{
   x=.5;y=.3;
   card.style.transform='';
   for(const prop of ['--lx','--ly','--angle'])card.style.removeProperty(prop);
  };
  card.onpointermove=event=>{
   const rect=exhibit.getBoundingClientRect();
   tilt((event.clientX-rect.left)/card.offsetWidth,(event.clientY-rect.top)/card.offsetHeight);
  };
  card.onpointerleave=resetTilt;
  card.onpointercancel=resetTilt;
  card.onblur=resetTilt;
  card.onkeydown=event=>{
   const offset={ArrowLeft:[-.15,0],ArrowRight:[.15,0],ArrowUp:[0,-.15],ArrowDown:[0,.15]}[event.key];
   if(!offset||reduced.matches)return;
   event.preventDefault();
   tilt(x+offset[0],y+offset[1]);
  };

  const toolbar=document.createElement('div');
  toolbar.className='roster-card-tools';
  toolbar.setAttribute('role','group');
  toolbar.setAttribute('aria-label',player.name+'全息材质与编辑');
  const swatches=foils.map(([label,color],index)=>{
   const swatch=document.createElement('button');
   swatch.type='button';
   swatch.className='roster-swatch';
   swatch.title=label;
   swatch.setAttribute('aria-label',player.name+' · '+label);
   swatch.style.setProperty('--swatch',index===0?`linear-gradient(135deg,${design.colors.join(',')})`:color);
   swatch.onclick=()=>{
    const foil=String(index);
    applyFoil(foil);
    try { localStorage.setItem(foilStorageKey(player.id),foil); } catch {}
   };
   toolbar.append(swatch);
   return swatch;
  });
  function applyFoil(foil){
   card.dataset.foil=foil;
   swatches.forEach((swatch,index)=>swatch.setAttribute('aria-pressed',String(String(index)===foil)));
  }
  applyFoil(readFoil(player.id));
  refreshCustomizations.set(foilStorageKey(player.id),()=>applyFoil(readFoil(player.id)));
  const edit=document.createElement('button');
  edit.type='button';
  edit.className='roster-edit';
  edit.textContent='编辑';
  edit.setAttribute('aria-label','编辑'+player.name+'卡片');
  edit.setAttribute('aria-haspopup','dialog');
  edit.onclick=()=>{
   editor.returnValue='';
   form.elements.cardTitle.value=title.textContent;
   form.elements.cardDescription.value=description.textContent;
   saveCopy=()=>{
    const copy={title:form.elements.cardTitle.value.trim()||player.name,description:form.elements.cardDescription.value.trim()};
    setCopy(copy);
    try { localStorage.setItem(copyStorageKey(player.id),JSON.stringify(copy)); } catch {}
   };
   editor.showModal();
  };
  toolbar.append(edit);
  exhibit.append(card,toolbar);
  container.append(exhibit);
 }
 window.addEventListener('storage', event => {
  if(event.key===null)refreshCustomizations.forEach(refresh=>refresh());
  else refreshCustomizations.get(event.key)?.();
 });
}
