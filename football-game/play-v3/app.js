import * as THREE from 'three';
import {QUICK_KICK_START,RonaldoDribble} from './ronaldo-motion.js?v=3w';
import {Locomotion,sampleRoot,rootInWorld,wrapAngle} from './locomotion.js?v=3j';
import {players,buildRoster,cardDesign} from './roster.js?v=4c';
import {FootballWorld} from './world.js?v=4c';
import {MatchAudio} from './audio.js?v=3j';
import {clamp,flight,flightPoint,inGoal,sweptContact,GRAVITY,randomRefScenarios,GOAL_Z,strikeRoot} from './rules.js?v=3r';
const $=s=>document.querySelector(s),screens=[...document.querySelectorAll('.screen')],audio=new MatchAudio(),keys=new Set();
let locomotion,npcMotion;
const reboundVelocity=new THREE.Vector3();
const ronaldoDribble=new RonaldoDribble();
let reboundActive=false,aiDiveUsed=false;const rollingVelocity=new THREE.Vector3();let lastTouch=-1,shotPending=false;
let world;try{world=new FootballWorld($('#world'))}catch(e){$('#fatal').hidden=false;$('#fatal').textContent='球场未能启动。请使用支持三维图形的浏览器，并开启硬件加速后重试。';throw e}
const roles={player:{name:'球员',title:'五球，征服全场。',goal:'自由带球，寻找角度。五次射门，尽可能多地得分。',instruction:'<div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 跑动　<kbd>Shift</kbd> 加速</div><div>点击球门锁定落点，或用方向键微调</div><div>拖动滑杆调力度，再点击「射门」；长按 <kbd>空格</kbd> 可蓄力</div><div>触屏：左侧方向键跑动，点球门选落点，再点「射门」</div>',label:'射门挑战',max:5},keeper:{name:'门将',title:'你的球门，你来守。',goal:'五次来球，观察出脚方向，移动或扑救。',instruction:'<div><kbd>A</kbd><kbd>D</kbd> 左右移动</div><div><kbd>空格</kbd> 向移动方向扑救</div><div>站在球路上可以直接挡球，扑救范围更大</div><div>触屏：左侧方向键移动，右侧按钮扑救</div>',label:'守门挑战',max:5},referee:{name:'裁判',title:'看清每一次接触。',goal:'四次争球，跟随跑动，判断是否犯规。',instruction:'<div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 跑动观察</div><div><kbd>F</kbd> 鸣哨判犯规　<kbd>C</kbd> 比赛继续</div><div>争球结束后可直接判罚，也可点击「再看一次」</div><div>触屏：点击下方的判罚按钮</div>',label:'执法挑战',max:4}};
let refRounds=[],refReplayT=null;
let chosen=players[0],loadedId=null,loadSerial=0;
let role='player',screen='start',loaded=false,loading=null,paused=false,phase='idle',phaseT=0,round=0,score=0,results=[],totalTime=0,shotTime=0,power=0,charging=false,aim={x:1.5,y:1.2,z:GOAL_Z},ballFlight=null,flightT=0,diveT=-1,diveDir=0,refPhase=0;const actorPos=new THREE.Vector3(),velocity=new THREE.Vector3();let strikePlayed=false,shotRoot=null,shotOrigin=null;
function chooseStar(p){chosen=p;document.querySelectorAll('[data-player]').forEach(b=>{const active=b.dataset.player===p.id;b.setAttribute('aria-pressed',String(active));b.querySelector('.selected-mark').textContent=active?'✓ 已选择':'选择'});$('#chosen-name').textContent=p.name;$('#chosen-country').textContent=`${p.country} · ${p.number} 号`;$('#choose-role').textContent=`选定 ${p.name} →`;$('#role-star').textContent=p.name;try{localStorage.setItem('homeground-v3-star',p.id)}catch{}}
buildRoster($('#roster'),chooseStar);chooseStar(players[0]);
const fullCard=$('#full-player-card');
const cardFrame=fullCard.querySelector('iframe');
$('#view-full-card').onclick=()=>{
 $('#full-player-card-title').textContent=chosen.name+' · 完整球星卡';
 cardFrame.src=cardDesign(chosen).page;
 fullCard.showModal();
};
$('#close-full-card').onclick=()=>fullCard.close();
fullCard.addEventListener('close',()=>cardFrame.removeAttribute('src'));
function go(next){if(!screens.some(s=>s.id===next))next='start';screen=next;document.body.dataset.screen=next;for(const el of screens)el.hidden=el.id!==next;$('#pause').hidden=next!=='match';$('#view').hidden=next!=='match';keys.clear();charging=false;paused=false;$('#pause-panel').hidden=true;world.endCutaway();document.body.dataset.cutaway='false';$('#broadcast').hidden=true;world.aim.visible=next==='match'&&role==='player';if(next!=='match'){phase='idle';world.cameraMode=next==='brief'?'portrait':'menu';if(loaded){world.player.root.visible=next==='brief';world.player.root.position.set(0,0,0);world.player.root.rotation.set(0,0,0);world.animate(world.player,'idle');world.opponent.root.visible=false;world.extra.root.visible=false}world.ball.visible=next==='start';}history.replaceState(null,'',location.pathname+location.search+'#'+next);const heading=$('#'+next+' h1, #'+next+' h2');if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true})}}
$('#choose-star').onclick=()=>go('stars');$('#choose-role').onclick=()=>go('roles');document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>go(b.dataset.back));$('.brand').onclick=e=>{e.preventDefault();if(screen==='match')togglePause();else go('start')};
document.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>{role=b.dataset.role;document.querySelectorAll('[data-role]').forEach(o=>{o.classList.toggle('active',o===b);o.setAttribute('aria-pressed',String(o===b))});$('#role-selected').textContent=roles[role].name});
async function load(){if(loadedId===chosen.id&&loaded)return;const ticket=++loadSerial;loaded=false;const current=chosen;$('#kickoff').disabled=true;$('#kickoff').textContent='球员准备中…';$('#load-status').textContent=`${current.name}正在入场…`;
 loading=world.loadPlayer(current,p=>{if(ticket===loadSerial)$('#load-status').textContent=`${current.name}入场中 · ${p}%`}).then(()=>{if(ticket!==loadSerial)return;loaded=true;loadedId=current.id;locomotion=new Locomotion(world,world.player);npcMotion=new Locomotion(world,world.opponent);world.player.root.visible=screen==='brief';world.player.root.position.set(0,0,0);world.player.root.rotation.set(0,0,0);world.setRole(role);$('#load-status').textContent=`${current.name}已准备好`;$('#kickoff').disabled=false;$('#kickoff').textContent='开始比赛 ↗';}).catch(e=>{if(ticket!==loadSerial)return;$('#load-status').textContent=`${current.name}暂时未能加载，请重试或选择另一位球星。`;$('#kickoff').disabled=false;$('#kickoff').textContent='重新加载球员';loading=null;console.error(e)});return loading}
$('#prepare').onclick=()=>{const r=roles[role];$('#brief-title').textContent=r.title;$('#brief-goal').textContent=r.goal;$('#instructions').innerHTML=r.instruction;go('brief');if(loaded&&loadedId===chosen.id){world.setRole(role);$('#kickoff').disabled=false;$('#kickoff').textContent='开始比赛 ↗';$('#load-status').textContent=`${chosen.name}已准备好`}else{if(world.player)world.player.root.visible=false;load()}};
$('#kickoff').onclick=()=>{if(!loaded){$('#kickoff').disabled=true;load().catch(()=>{});return}startMatch()};$('#again').onclick=startMatch;$('#change-role').onclick=()=>go('roles');
$('#sound').onclick=()=>{const enabled=audio.toggle();$('#sound').textContent='声音 '+(enabled?'开':'关');$('#sound').setAttribute('aria-pressed',String(enabled))};
function togglePause(force){if(screen!=='match')return;paused=typeof force==='boolean'?force:!paused;$('#pause-panel').hidden=!paused;keys.clear();charging=false;power=0;updatePower()}
$('#view').onclick=()=>{world.sideView=!world.sideView;$('#view').textContent=world.sideView?'视角：场边':'视角：跟随'};
$('#pause').onclick=()=>togglePause();$('#resume').onclick=()=>togglePause(false);$('#exit-match').onclick=()=>go('roles');document.addEventListener('visibilitychange',()=>{if(document.hidden)togglePause(true)});window.addEventListener('blur',()=>{keys.clear();if(screen==='match')togglePause(true)});
function announce(title='',detail='',small=''){ $('#event-title').textContent=title;$('#event-detail').textContent=detail;$('#event-small').textContent=small;$('#event').style.opacity=title?'1':'0'}
function updateScore(){const r=roles[role];$('#score').innerHTML=`${score} <em>/ ${r.max}</em>`;$('#round-label').textContent=`第 ${Math.min(round+1,r.max)} / ${r.max} ${role==='referee'?'次判罚':'球'}`;$('#round-dots').innerHTML=Array.from({length:r.max},(_,i)=>`<i class="${i<results.length?(results[i]?'win':'lose'):i===round?'current':''}"></i>`).join('')}
const powerSlider=$('#power');
let selectedPower=.65;
function updatePower(){
 const shown=Math.round((charging?Math.max(.18,power):selectedPower)*100);
 powerSlider.value=shown;
 powerSlider.setAttribute('aria-valuetext',shown+'%');
 $('#power-value').textContent=shown+'%';
}
powerSlider.addEventListener('input',()=>{
 selectedPower=powerSlider.valueAsNumber/100;
 updatePower();
});
function startMatch(){selectedPower=.65;if(role==='referee')refRounds=randomRefScenarios();document.body.dataset.role=role;go('match');world.startCrowd();round=0;score=0;results=[];totalTime=0;world.cameraMode=role;world.player.root.visible=true;world.opponent.root.visible=true;world.extra.root.visible=role==='referee';world.setRole(role);world.selectedStar=chosen.id;$('#mode-label').textContent=roles[role].label;$('#player-tag').textContent=`${chosen.name} · ${roles[role].name}`;$('#shot-controls').hidden=role==='referee';$('#ref-controls').hidden=role!=='referee';$('.power-label').hidden=role!=='player';$('.power-track').hidden=role!=='player';$('#action').textContent=role==='keeper'?'扑救！':'射门';$('#match-help').innerHTML=role==='player'?'<kbd>W A S D</kbd> 跑动　<kbd>Shift</kbd> 加速<br>点球门锁定落点，拖动滑杆调力度<br>长按空格可蓄力 ·　<kbd>R</kbd> 重新摆球':role==='keeper'?'<kbd>A D</kbd> 移动　<kbd>空格</kbd> 扑救<br>观察球路，守住球门':'<kbd>W A S D</kbd> 跟随跑动<br><kbd>F</kbd> 犯规　<kbd>C</kbd> 继续';resetRound();audio.whistle()}
function resetRound(){ronaldoDribble.reset();reboundActive=false;aiDiveUsed=false;refReplayT=null;$('#ref-replay').disabled=true;$('#aim-status').textContent='点击球门选择落点';$('#action').textContent=role==='keeper'?'扑救！':'射门';locomotion?.reset();npcMotion?.reset();rollingVelocity.set(0,0,0);shotPending=false;world.player.strike=null;world.player.reactionUntil=0;phase='countdown';phaseT=0;world.endCutaway();document.body.dataset.cutaway='false';$('#broadcast').hidden=true;velocity.set(0,0,0);shotTime=0;ballFlight=null;flightT=0;diveT=-1;power=0;charging=false;world.ball.visible=true;world.player.root.rotation.set(0,role==='keeper'?0:Math.PI+(world.motionInfo('kick')?.root?.[0]?.yaw||0),0);world.opponent.root.rotation.set(0,Math.PI,0);world.setSpeed(world.player,1);world.setSpeed(world.opponent,1);world.extra.root.rotation.set(0,Math.PI/2,0);world.animate(world.player,'idle');world.animate(world.opponent,'idle');world.animate(world.extra,'idle');if(role==='player'){world.player.root.position.set((round%3-1)*1.5,0,3);world.opponent.root.position.set(0,0,-13.3);world.opponent.root.rotation.y=0;aim={x:round%2? -1.8:1.8,y:1.15,z:GOAL_Z};const contact=world.motionData?.kick?.contact||{x:.12,z:.85};world.ball.position.set(world.player.root.position.x-contact.x*chosen.height/1.87,.12,world.player.root.position.z-contact.z*chosen.height/1.87);const heading=Math.atan2(aim.x-world.ball.position.x,aim.z-world.ball.position.z),ready=strikeRoot(world.ball.position,heading,contact,chosen.height/1.87);world.player.root.position.set(ready.x,0,ready.z);world.player.root.rotation.y=heading+(world.motionInfo('kick')?.root?.[0]?.yaw||0);world.aim.position.set(aim.x,aim.y,GOAL_Z+.05)}else if(role==='keeper'){world.player.root.position.set(0,0,-13.2);world.opponent.root.position.set((round%3-1)*2,0,-1);const contact=world.motionData?.kick?.contact||{x:0,z:.6};world.ball.position.set(world.opponent.root.position.x-contact.x*world.opponent.height/1.87,.12,world.opponent.root.position.z-contact.z*world.opponent.height/1.87)}else{world.player.root.position.set(3.8,0,.5);world.player.root.rotation.y=-Math.PI/2;placeRefScene(0);$('#foul').disabled=true;$('#play-on').disabled=true}announce('准备好了吗？',role==='player'?'靠近足球，瞄准球门，再把握出脚时机':role==='keeper'?'观察来球，随时准备扑救':'跟上球员，留意争球时的接触',`ROUND ${round+1}`);updateScore();updatePower()}
function finishRound(win,title,detail){if(phase==='feedback'||phase==='done')return;results.push(win);if(win)score++;phase='feedback';phaseT=0;charging=false;power=0;updatePower();world.aim.visible=false;if(diveT<0||role!=='keeper')world.setSpeed(world.player,1);if(diveT<0||role!=='player')world.setSpeed(world.opponent,1);if(win||role!=='player')world.animate(world.opponent,'idle');world.crowdReaction(win);audio.crowd(win);if(role!=='referee'){world.startCutaway(win,role);$('#broadcast').hidden=false;document.body.dataset.cutaway='true';$('#broadcast-label').textContent=win?'球星特写':'场边镜头';}announce(title,detail,win?'WELL PLAYED':'NEXT CHANCE');updateScore();if(role==='player'){world.player.reactionName=win?'reactgoal':'reactmiss';if(!world.player.strike){world.animate(world.player,world.player.reactionName,true,true);world.player.reactionUntil=worldTime+2.8;}}}
function finishMatch(){phase='done';go('results');const max=roles[role].max;$('#result-title').textContent=score===max?'全场，为你沸腾。':score>=Math.ceil(max*.6)?'精彩表现！':'下一场，更进一步。';$('#result-score').innerHTML=`${score} <span>/ ${max}</span>`;$('#result-desc').textContent=role==='player'?`${chosen.name}完成 ${max} 次射门，打进 ${score} 球。${score<max?'试着换个角度，把球送进远角。':'每一次机会，你都把握住了。'}`:role==='keeper'?`你成功守住了 ${score} 次来球。${score<max?'提早移动，最后一刻再扑救。':'这座球门，由你守护。'}`:`你作出了 ${score} 次正确判罚。${score<max?'留意防守队员先碰到的是球，还是对手。':'清晰判断，让比赛更精彩。'}`;audio.whistle()}
function beginAction(){if(screen!=='match'||paused)return;if(role==='player'&&phase==='playing'){charging=true;power=.12}else if(role==='keeper'&&(phase==='playing'||phase==='shooting')&&diveT<0){const direction=keys.has('KeyA')||keys.has('ArrowLeft')?1:keys.has('KeyD')||keys.has('ArrowRight')?-1:(world.ball.position.x-world.player.root.position.x>=0?1:-1);startDive(world.player,direction);audio.tone(170,.12,'triangle',.06)}}
function releaseAction(){if(!charging)return;charging=false;if(screen==='match'&&!paused&&role==='player'&&phase==='playing')shoot();power=0;updatePower()}
function beginStrike(actor,target,power){
 const info=world.motionInfo('kick'),contract=world.motionData?.kick||world.strikeContract;
 const contact=contract.contact,scale=actor.height/1.87,yaw=Math.atan2(target.x-world.ball.position.x,target.z-world.ball.position.z);
 const root=strikeRoot(world.ball.position,yaw,contact,scale),origin=new THREE.Vector3(root.x,0,root.z);
 const startYaw=yaw+(info?.root?.[0]?.yaw||0),distance=origin.distanceTo(actor.root.position),aligned=Math.abs(wrapAngle(startYaw-actor.root.rotation.y))<.35;
 actor.strike={stage:distance<.12&&aligned?'ready':'approach',origin,yaw,startYaw,t:0,info,contract,scale,ball:world.ball.position.clone(),target:{...target},power,waypoint:distance>.65||!aligned?origin.clone().add(new THREE.Vector3(-Math.sin(startYaw)*1.1,0,-Math.cos(startYaw)*1.1)):null};
 actor.strike.clipStart=0;
 if(actor.actions.kickquick&&info?.root?.length&&contract.time>QUICK_KICK_START){
  const entry=sampleRoot(info,QUICK_KICK_START);
  const entryPosition=rootInWorld(origin,yaw,{x:entry.x*scale,z:entry.z*scale});
  const entryYaw=yaw+entry.yaw;
  if(actor.root.position.distanceTo(entryPosition)<.48&&Math.abs(wrapAngle(entryYaw-actor.root.rotation.y))<.85){
   actor.strike.clipStart=QUICK_KICK_START;
   actor.strike.stage='ready';
   actor.strike.startYaw=entryYaw;
  }
 }
 rollingVelocity.set(0,0,0);flightT=-contract.time;strikePlayed=false;ballFlight=flight(world.ball.position,target,Math.max(.18,power));
}
function updateStrike(actor,dt){
 const s=actor.strike;if(!s)return false;
 if(s.stage==='approach'){
  const mover=actor===world.player?locomotion:npcMotion;
  const destination=s.waypoint||s.origin,dir=destination.clone().sub(actor.root.position);dir.y=0;const distance=dir.length();
  if(s.waypoint&&distance<.32){s.waypoint=null;return false;}
  if(!s.waypoint){
   if(!s.approachCurve){
    const start=actor.root.position.clone(),handle=Math.max(.3,Math.min(.8,distance*.45));
    const forward=new THREE.Vector3(Math.sin(actor.root.rotation.y),0,Math.cos(actor.root.rotation.y));
    const finalForward=new THREE.Vector3(Math.sin(s.startYaw),0,Math.cos(s.startYaw));
    s.approachCurve=new THREE.CubicBezierCurve3(start,start.clone().addScaledVector(forward,handle),s.origin.clone().addScaledVector(finalForward,-handle),s.origin.clone());
    s.approachLength=s.approachCurve.getLength();s.approachDistance=0;s.approachSpeed=Math.min(mover.speed,.8);
   }
   const remaining=s.approachLength-s.approachDistance,walkSpeed=(world.motionInfo('walk')?.nominalSpeed||1.2)*s.scale;
   const wanted=Math.min(walkSpeed,Math.sqrt(Math.max(0,remaining)*2.4));
   s.approachSpeed+=clamp(wanted-s.approachSpeed,-dt*2.4,dt*2.4);
   s.approachDistance=Math.min(s.approachLength,s.approachDistance+Math.max(.12,s.approachSpeed)*dt);
   const u=s.approachDistance/Math.max(.001,s.approachLength),tangent=s.approachCurve.getTangentAt(u);
   actor.root.position.copy(s.approachCurve.getPointAt(u));actor.root.rotation.y=Math.atan2(tangent.x,tangent.z);
   world.animate(actor,'walk');world.setSpeed(actor,Math.max(.1,s.approachSpeed/walkSpeed));
   if(u<1)return false;
   s.stage='ready';mover.reset();
  }else{mover.step(dir.normalize(),dt,{limit:false,targetSpeed:Math.min(world.motionInfo('walk')?.nominalSpeed||1.4,Math.max(.22,distance*2)),recordedTurns:false});return false;}
 }
 if(s.stage==='ready'){
  s.stage='kick';s.t=s.clipStart;if(actor===world.player)$('#action').textContent='出脚！';actor.root.rotation.y=s.startYaw;world.setSpeed(actor,1);world.animate(actor,s.clipStart?'kickquick':'kick',true,true);
 }
 s.t+=dt;
 const r=sampleRoot(s.info,s.t);actor.root.position.copy(rootInWorld(s.origin,s.yaw,{x:r.x*s.scale,z:r.z*s.scale}));actor.root.rotation.y=s.yaw+(r.yaw||0);
 flightT=s.t-s.contract.time;
 if(flightT<0){world.ball.position.copy(s.ball);return false;}
 if(!strikePlayed){strikePlayed=true;audio.kick();}
 return true;
}
function shoot(){$('#action').disabled=true;$('#action').textContent='助跑中…';$('#aim-status').textContent='落点已锁定，准备出脚';phase='shooting';phaseT=0;velocity.set(0,0,0);const target={...aim};beginStrike(world.player,target,power);announce();}
$('#action').addEventListener('click',()=>{
 if(screen!=='match'||paused)return;
 if(role==='player'&&phase==='playing'){charging=false;power=selectedPower;shoot();updatePower();}
 else if(role==='keeper')beginAction();
});
document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key)});for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>keys.delete(b.dataset.key))});
window.addEventListener('keydown',e=>{if(screen!=='match')return;if(e.target===powerSlider&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.code))return;if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(e.code==='Escape'){if(!e.repeat)togglePause();return}if(paused)return;keys.add(e.code);if(!e.repeat&&e.code==='KeyR'&&role==='player'&&phase==='playing'){resetRound();return}if(!e.repeat&&e.code==='Space')beginAction();if(!e.repeat&&e.code==='KeyF')judge(true);if(!e.repeat&&e.code==='KeyC')judge(false)});window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space'){if(power<.26)power=selectedPower;releaseAction()}});
$('#world').addEventListener('pointerdown',e=>{
 if(e.button===0&&screen==='match'&&!paused&&!charging&&role==='player'&&phase==='playing')setAim(e);
});
function setAim(e){
 const p=world.aimAtPointer(e.clientX,e.clientY);
 // Only clicks on the actual goal select a target; grass and HUD clicks do not.
 if(!p||Math.abs(p.x)>3.66||p.y<0||p.y>2.44)return;
 aim.x=clamp(p.x,-3.45,3.45);aim.y=clamp(p.y,.25,2.2);
 world.aim.position.set(aim.x,aim.y,GOAL_Z+.05);
 world.player.facial?.lookToward(new THREE.Vector3(aim.x,aim.y,GOAL_Z));
 $('#aim-status').textContent='落点已锁定 · 点击「射门」';
}
function moveKeeper(actor,speed,dt,limit){
 if(dt<=0)return;
 const position=actor.root.position;
 const nextX=clamp(position.x+speed*dt,-limit,limit);
 const stride=(nextX-position.x)/dt;
 const moving=Math.abs(stride)>.08;
 const faceBall=Math.atan2(world.ball.position.x-position.x,Math.max(2,world.ball.position.z-position.z));
 const facing=clamp(faceBall+(moving?Math.sign(stride)*.95:0),-1.35,1.35);
 actor.root.rotation.y=THREE.MathUtils.damp(actor.root.rotation.y,facing,11,dt);
 position.x=nextX;
 world.animate(actor,moving?'walk':'idle');
 const walkSpeed=world.motionInfo('walk')?.nominalSpeed||1.2;
 world.setSpeed(actor,moving?clamp(Math.abs(stride)/walkSpeed,.45,1.9):1);
}

function moveActor(dt){
 let dx=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),dz=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0);
 if(role==='keeper'){
  if(diveT>=0)return;dx=-dx;if(keys.has('ArrowLeft'))dx=1;if(keys.has('ArrowRight'))dx=-1;
  velocity.x=THREE.MathUtils.damp(velocity.x,dx*2.5,9,dt);
  moveKeeper(world.player,velocity.x,dt,3.4);
  return;
 }
 const input=new THREE.Vector3(dx,0,dz).normalize();const speed=locomotion.step(input,dt,{sprint:keys.has('ShiftLeft')||keys.has('ShiftRight')});
 const yaw=world.player.root.rotation.y;velocity.set(Math.sin(yaw)*speed,0,Math.cos(yaw)*speed);
}
function rollBall(dt){
 const ball=world.ball.position,player=world.player,yaw=player.root.rotation.y,forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
 const speed=locomotion.speed;
 if(chosen.id==='ronaldo'){
  if(ronaldoDribble.update(world,player,ball,rollingVelocity,speed,worldTime,dt))audio.tone(95,.035,'sine',.015);
 }else if(speed>.25&&worldTime-lastTouch>.23){
  for(const side of ['l','r']){
   const foot=world.footPosition(player,side);if(!foot)continue;
   const toBall=ball.clone().sub(foot);toBall.y=0;
   if(foot.y<.4&&toBall.length()<.38&&toBall.dot(forward)>-.06){
    rollingVelocity.copy(forward).multiplyScalar(speed*.85+1.6);lastTouch=worldTime;audio.tone(95,.035,'sine',.015);break;
   }
  }
 }
 const old=ball.clone();ball.addScaledVector(rollingVelocity,dt);rollingVelocity.multiplyScalar(Math.exp(-dt*2.0));ball.y=.12;
 ball.x=clamp(ball.x,-10,10);ball.z=clamp(ball.z,-11,9);
 const distance=old.distanceTo(ball);world.ball.rotateOnWorldAxis(new THREE.Vector3(rollingVelocity.z,0,-rollingVelocity.x).normalize(),distance/.12);
}
function tickPlayer(dt){if(phase==='playing'){shotTime+=dt;moveActor(dt);rollBall(dt);if(keys.has('ArrowLeft'))aim.x-=dt*2.8;if(keys.has('ArrowRight'))aim.x+=dt*2.8;if(keys.has('ArrowUp'))aim.y+=dt*1.5;if(keys.has('ArrowDown'))aim.y-=dt*1.5;aim.x=clamp(aim.x,-4.5,4.5);aim.y=clamp(aim.y,.3,3.1);world.aim.position.set(aim.x,aim.y,GOAL_Z+.05);world.aim.visible=true;moveKeeper(world.opponent,clamp((world.player.root.position.x*.22-world.opponent.root.position.x)*2,-1,1),dt,3.4);if(charging){power=clamp(power+dt*.7,0,1);updatePower()}if(shotTime>35)finishRound(false,'机会稍纵即逝','时间到了。下一球试着更果断地出脚。');}
if(phase==='shooting'&&ballFlight)updateShot(world.player,world.opponent,dt);
}

function startDive(keeper,direction){
 diveT=0;
 diveDir=direction;
 keeper.root.rotation.y=0;
 const duration=keeper.actions.dive?.getClip().duration||.86;
 world.setSpeed(keeper,duration/.86);
 world.animate(keeper,'dive',true,true);
}

function advanceDive(keeper,dt){
 const previous=clamp(diveT/.86,0,1);
 diveT+=dt;
 const progress=clamp(diveT/.86,0,1);
 const travel=t=>1-Math.pow(1-t,2);
 keeper.root.position.x=clamp(keeper.root.position.x+diveDir*1.75*(travel(progress)-travel(previous)),-4,4);
 keeper.root.position.y=.24*Math.sin(progress*Math.PI);
 keeper.root.rotation.z=-diveDir*.68*Math.sin(progress*Math.PI);
 if(progress===1){
  diveT=-1;
  keeper.root.position.y=0;
  keeper.root.rotation.z=0;
  world.setSpeed(keeper,1);
  world.animate(keeper,'idle');
 }
}

const keeperColliders=[
 ['hand_l',.19],['hand_r',.19],['lowerarm_l',.14],['lowerarm_r',.14],
 ['spine_02',.29],['pelvis',.25],['head',.16],
 ['calf_l',.15],['calf_r',.15],['foot_l',.14],['foot_r',.14]
];

function keeperContact(keeper,from,to){
 if(Math.min(from.z,to.z)>keeper.root.position.z+1.5)return null;
 keeper.model.updateWorldMatrix(true,true);
 let first=null;
 const center=new THREE.Vector3();
 for(const [name,radius] of keeperColliders){
  const bone=keeper.model.getObjectByName(name);
  if(!bone)continue;
  bone.getWorldPosition(center);
  const hit=sweptContact(from,to,center,.12+radius*keeper.height/1.87);
  if(hit!==null&&(first===null||hit<first))first=hit;
 }
 return first;
}

function updateShot(shooter,keeper,dt){
 if(!updateStrike(shooter,dt))return;
 const ball=world.ball.position;
 const next=flightPoint(ballFlight,flightT);
 if(role==='player'&&flightT>.22&&diveT<0&&!aiDiveUsed){
  const delta=ballFlight.target.x-keeper.root.position.x;
  const remaining=ballFlight.duration-flightT;
  if(remaining<.43&&Math.abs(delta)>.65&&Math.abs(delta)<2.1){
   aiDiveUsed=true;
   startDive(keeper,Math.sign(delta));
  }else{
   moveKeeper(keeper,clamp(delta*5,-2.2,2.2),dt,3.4);
  }
 }
 const contact=keeperContact(keeper,ball,next);
 if(contact!==null){
  reboundVelocity.set(next.x-ball.x,0,next.z-ball.z).normalize().multiplyScalar(-4.5);
  reboundVelocity.x+=2*Math.sign(next.x-keeper.root.position.x||diveDir||1);
  reboundVelocity.y=1.55;
  ball.lerp(next,contact);
  reboundActive=true;
  audio.tone(145,.10,'triangle',.07);
  if(role==='keeper')finishRound(true,'漂亮的扑救！','你挡住了这次来球。');
  else finishRound(false,'被挡住了！','试试球门的远角。');
  return;
 }
 world.ball.rotation.x-=(ball.z-next.z)/.12;
 ball.copy(next);
 if(flightT<ballFlight.duration)return;
 const goal=inGoal(next);
 if(goal){
  const direction=new THREE.Vector3(ballFlight.target.x-ballFlight.start.x,0,GOAL_Z-ballFlight.start.z);
  reboundVelocity.copy(direction.normalize().multiplyScalar(4));
  reboundActive=true;
 }
 if(role==='keeper'){
  finishRound(!goal,goal?'差一点！':'来球偏出',goal?'下一球提前调整站位，再把握扑救时机。':'球没有越过球门范围。');
 }else{
  finishRound(goal,goal?'好球！':next.y>=2.32?'高了一点！':'擦门而过！',goal?'球进了！看台为你欢呼。':'试试调整球门上的落点。');
 }
}

function tickKeeper(dt){
 if(phase==='playing'||phase==='shooting')moveActor(dt);
 if(phase==='playing'&&phaseT>2.1){
  phase='shooting';
  phaseT=0;
  const x=[2.7,-2.4,.25,-3,1.9][round],y=[1,.6,2,1.65,.4][round];
  beginStrike(world.opponent,{x,y,z:GOAL_Z},.22+round*.025);
  announce('来球了！','','准备扑救');
 }
 if(phase==='shooting'&&ballFlight)updateShot(world.opponent,world.player,dt);
}

function updateRebound(dt){
 const ball=world.ball.position;
 reboundVelocity.y-=GRAVITY*dt;
 ball.addScaledVector(reboundVelocity,dt);
 if(ball.z<-15.1&&reboundVelocity.z<0){
  ball.z=-15.1;
  reboundVelocity.multiplyScalar(.2);
  reboundVelocity.z=0;
 }
 if(ball.y<.12){
  ball.y=.12;
  reboundVelocity.y=Math.abs(reboundVelocity.y)>.7?-reboundVelocity.y*.28:0;
  const friction=Math.exp(-3.8*dt);
  reboundVelocity.x*=friction;
  reboundVelocity.z*=friction;
  if(reboundVelocity.lengthSq()<.01)reboundActive=false;
 }
}

const refContact=1.65, refSceneDuration=3.1;

function placeRefScene(time, playbackRate=1){
 const scenario=refRounds[round];
 const attacker=world.opponent, defender=world.extra;
 const approach=Math.min(time,refContact);
 const elapsed=Math.max(0,time-refContact);
 const follow=1-Math.pow(1-clamp(elapsed/1.15,0,1),2);
 const attackerX=-4+approach*2.1;
 const push=scenario.type==='push';
 const defenderX=push?-5.15+approach*2.48:attackerX+.52;
 const defenderZ=push?-4:-5.8+approach*.88;
 attacker.root.position.set(attackerX,0,-4);
 defender.root.position.set(defenderX,0,defenderZ);
 attacker.root.rotation.set(0,Math.PI/2,0);
 defender.root.rotation.set(0,push?Math.PI/2:Math.atan2(2.1,.88),0);
 const stride=.07*Math.sin(time*15);
 world.ball.position.set(attackerX+.53+stride,.12,-4);
 if(time===0)return;
 world.setSpeed(attacker,playbackRate);
 world.setSpeed(defender,playbackRate);
 if(time<refContact){
  world.animate(attacker,'run');
  world.animate(defender,'run');
  const runSpeed=world.motionInfo('run')?.nominalSpeed||3;
  world.setSpeed(attacker,2.1/runSpeed*playbackRate);
  world.setSpeed(defender,(push?2.48:Math.hypot(2.1,.88))/runSpeed*playbackRate);
  return;
 }
 if(scenario.foul){
  attacker.root.position.x+=.56*follow;
  defender.root.position.x+=.34*follow;
  world.ball.position.x=attackerX+.53+.95*follow;
  world.animate(attacker,'fall',true);
  world.animate(defender,scenario.type==='trip'?'kick':'runstop',true);
 }else{
  const clean=scenario.type==='clean';
  attacker.root.position.x+=(clean?.36:1.6)*follow;
  defender.root.position.x+=(clean?1.65:1.08)*follow;
  defender.root.position.z-=(clean?.65:0)*follow;
  const possession=clamp(elapsed/.28,0,1);
  const contactX=attackerX+.53+.07*Math.sin(refContact*15);
  world.ball.position.x=clean?THREE.MathUtils.lerp(contactX,defender.root.position.x+.47,possession):attacker.root.position.x+.53;
  world.ball.position.z=clean?THREE.MathUtils.lerp(-4,defender.root.position.z,possession):-4;
  world.animate(attacker,'runstop',true);
  world.animate(defender,'runstop',true);
 }
}

function tickRef(dt){
 if(phase!=='playing')return;
 moveActor(dt);
 if(refReplayT!==null){
  phaseT-=dt;
  refReplayT+=dt*.65;
  placeRefScene(Math.min(refReplayT,refSceneDuration),.65);
  if(refReplayT>=refSceneDuration){
   refReplayT=null;
   phaseT=refSceneDuration;
   refPhase=0;
  }
  return;
 }
 if(phaseT<refSceneDuration){
  placeRefScene(phaseT);
 }else if(refPhase!==2){
  refPhase=2;
  $('#ref-replay').disabled=false;
  $('#foul').disabled=false;
  $('#play-on').disabled=false;
  announce('你的判罚是？','鸣哨判犯规，或让比赛继续。','MAKE THE CALL');
 }
 if(phaseT>18.3&&refPhase===2)judge(null);
}

$('#ref-replay').onclick=()=>{
 if(screen!=='match'||paused||role!=='referee'||phase!=='playing'||refPhase!==2)return;
 refReplayT=0;
 refPhase=1;
 $('#foul').disabled=true;
 $('#play-on').disabled=true;
 $('#ref-replay').disabled=true;
 world.setSpeed(world.opponent,.65);
 world.setSpeed(world.extra,.65);
 world.animate(world.opponent,'run',false,true);
 world.animate(world.extra,'run',false,true);
 placeRefScene(0);
 announce('再看一次','看完后选择判犯规或比赛继续','慢动作');
};
function judge(foul){if(screen!=='match'||paused||role!=='referee'||phase!=='playing'||refPhase!==2)return;$('#foul').disabled=true;$('#play-on').disabled=true;$('#ref-replay').disabled=true;const s=refRounds[round],correct=foul===s.foul;if(foul===true)audio.whistle();finishRound(correct,correct?'判罚正确！':foul===null?'判罚时间到了':'再仔细看一点',s.explain)}$('#foul').onclick=()=>judge(true);$('#play-on').onclick=()=>judge(false);
let last=performance.now(),worldTime=0;function frame(ms){requestAnimationFrame(frame);const dt=Math.min((ms-last)/1000,.05);last=ms;$('#action').disabled=paused||screen!=='match'||(role==='player'?phase!=='playing':role==='keeper'?!(phase==='playing'||phase==='shooting')||diveT>=0:true);powerSlider.disabled=$('#action').disabled||role!=='player'||charging;if(!paused){worldTime+=dt;if(screen==='match'){totalTime+=dt;phaseT+=dt;if(phase==='countdown'&&phaseT>2){phase='playing';phaseT=0;refPhase=0;announce(role==='keeper'?'准备接球':role==='referee'?'跟上这次争球':'',role==='keeper'?'看清出脚方向，移动到球路上。':'');}if(diveT>=0)advanceDive(role==='player'?world.opponent:world.player,dt);if(reboundActive)updateRebound(dt);if(role==='player')tickPlayer(dt);else if(role==='keeper')tickKeeper(dt);else tickRef(dt);if(phase==='feedback'&&role==='player'&&world.player.strike){const s=world.player.strike;if(s.t<(s.info?.duration||1)){s.t+=dt;const r=sampleRoot(s.info,s.t);world.player.root.position.copy(rootInWorld(s.origin,s.yaw,{x:r.x*s.scale,z:r.z*s.scale}));world.player.root.rotation.y=s.yaw+(r.yaw||0);}else{world.animate(world.player,world.player.reactionName||'idle',true,true);world.player.reactionUntil=worldTime+2.8;world.player.strike=null;}}if(world.player?.reactionUntil&&worldTime>world.player.reactionUntil){world.animate(world.player,'idle');world.player.reactionUntil=0;}if(phase==='feedback'&&phaseT>(role==='referee'?3.2:5.6)){round++;if(round>=roles[role].max)finishMatch();else resetRound()}const seconds=role==='player'?Math.max(0,Math.ceil(35-shotTime)):Math.floor(totalTime);$('#clock').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}world.update(dt,worldTime);if(world.cutaway)$('#broadcast-label').textContent=world.cutawayLabel}else world.render()}$('#skip-cutaway').onclick=()=>{if(phase==='feedback')phaseT=8};go('stars');requestAnimationFrame(frame);
