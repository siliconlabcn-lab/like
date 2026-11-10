import {PlayerAppearance,addUniformDetail} from './player-appearance.js?v=3x';
import * as THREE from 'three';
import {fitPlayerLandmarks,styleYamalMaterial} from './face-landmarks.js?v=3x';
import {createCR7BootTexture,styleCR7Boot} from './cr7-boots.js?v=3w';
import {QUICK_KICK_START,refineRonaldoMatchModel,softenRonaldoFaceMaterial} from './ronaldo-motion.js?v=3w';
import {FacialPerformance} from './facial-performance.js?v=3w';
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {BroadcastFocus} from './broadcast-focus.js';
import {HumanCrowd} from './human-crowd.js?v=4c';
import {clone} from './vendor/utils/SkeletonUtils.js';
export class FootballWorld{
 constructor(host){this.host=host;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x202d3d);this.scene.fog=new THREE.Fog(0x283845,45,110);this.camera=new THREE.PerspectiveCamera(43,1,.05,150);this.camera.position.set(18,13,24);this.camera.lookAt(0,0,-9);this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.01;host.appendChild(this.renderer.domElement);this.scene.add(new THREE.HemisphereLight(0xe5edf8,0x574b3b,1.65));const sun=new THREE.DirectionalLight(0xfff1df,3.0);sun.position.set(-9,20,10);sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:.5,far:65});sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0004;this.scene.add(sun);const rim=new THREE.DirectionalLight(0xc0d9e8,1.55);rim.position.set(10,8,-20);this.scene.add(rim);this.actors=[];this.mood=0;this.moodTime=0;this.sceneTime=0;this.cameraMode='menu';this.buildPitch();this.crowd=new HumanCrowd(this.scene);this.modelCache=new Map();this.fabric=this.makeFabric();this.appearance=new PlayerAppearance(this.renderer);this.strikeContract={time:.58,contact:{x:-.16,y:.12,z:.57}};this.cutaway=null;this.ball=this.makeBall();this.scene.add(this.ball);this.ball.position.set(0,.22,3);this.ballShadow=new THREE.Mesh(new THREE.CircleGeometry(.17,24),new THREE.MeshBasicMaterial({color:0x031e17,transparent:true,opacity:.35,depthWrite:false}));this.ballShadow.rotation.x=-Math.PI/2;this.ballShadow.position.y=.022;this.scene.add(this.ballShadow);this.aim=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(.23,.015,8,32),new THREE.MeshBasicMaterial({color:0xffe4ae,depthTest:false}));this.aim.add(ring);for(let i=0;i<2;i++){const line=new THREE.Mesh(new THREE.BoxGeometry(i?.014:.12,i?.12:.014,.02),new THREE.MeshBasicMaterial({color:0xffefc8,depthTest:false}));this.aim.add(line)}this.aim.visible=false;this.scene.add(this.aim);this.ray=new THREE.Raycaster();this.goalPlane=new THREE.Plane(new THREE.Vector3(0,0,1),14);this.camTarget=new THREE.Vector3();this.depthFocus=new BroadcastFocus(this.renderer,this.scene,this.camera);new ResizeObserver(()=>this.resize()).observe(host);this.resize();}
 makeFabric(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#888';x.fillRect(0,0,128,128);for(let i=0;i<128;i+=4){x.fillStyle='#aaa';x.fillRect(i,0,1,128);x.fillStyle='#666';x.fillRect(0,i,128,1)}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(9,9);return t}
 mat(c,opts={}){return new THREE.MeshStandardMaterial({color:c,roughness:.85,...opts})}
 box(w,h,d,x,y,z,mat,shadow=false){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;this.scene.add(m);return m}
 buildPitch(){const turf=document.createElement('canvas');turf.width=turf.height=512;const c=turf.getContext('2d');c.fillStyle='#b4c899';c.fillRect(0,0,512,512);let seed=43;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};for(let i=0;i<36000;i++){const light=80+Math.floor(rand()*120);c.strokeStyle=`rgba(${light},${light+20},${light-20},.42)`;const x=rand()*512,y=rand()*512;c.beginPath();c.moveTo(x,y);c.lineTo(x+.5,y+2+rand()*4);c.stroke()}const txGrass=new THREE.CanvasTexture(turf);txGrass.wrapS=txGrass.wrapT=THREE.RepeatWrapping;txGrass.repeat.set(14,20);txGrass.colorSpace=THREE.SRGBColorSpace;txGrass.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());const green=this.mat(0x547a36,{map:txGrass}),green2=this.mat(0x608540,{map:txGrass}),white=this.mat(0xe7eee1),dark=this.mat(0x163637),seat=this.mat(0x3b5a55);this.box(80,.3,100,0,-.35,0,this.mat(0x102e29));this.box(28,.1,40,0,-.05,0,green);for(let z=-18;z<20;z+=4)this.box(28,.012,2,0,.009,z,green2);const line=(w,d,x,z)=>this.box(w,.015,d,x,.026,z,white);for(const x of [-12,12])line(.05,34,x,0);for(const z of [-14,17])line(24,.05,0,z);line(24,.05,0,4);for(const x of [-7.5,7.5])line(.05,6,x,-11);line(15,.05,0,-8);for(const x of [-4.5,4.5])line(.05,2.8,x,-12.6);line(9,.05,0,-11.2);const circle=new THREE.Mesh(new THREE.RingGeometry(3.96,4,100),new THREE.MeshBasicMaterial({color:0xc7dfc8,side:THREE.DoubleSide}));circle.rotation.x=-Math.PI/2;circle.position.set(0,.03,4);this.scene.add(circle);for(const x of [-3.66,3.66])this.box(.12,2.44,.12,x,1.22,-14,white,true);this.box(7.44,.12,.12,0,2.44,-14,white,true);const points=[];for(let x=-3.66;x<=3.67;x+=.25){points.push(x,.05,-15.5,x,2.44,-15.5,x,2.44,-15.5,x,2.44,-14)}for(let y=0;y<=2.45;y+=.22){points.push(-3.66,y,-15.5,3.66,y,-15.5);for(const x of [-3.66,3.66])points.push(x,y,-14,x,y,-15.5)}this.scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(points,3)),new THREE.LineBasicMaterial({color:0xaec9c1,transparent:true,opacity:.5})));for(let r=0;r<7;r++){this.box(42,.55,1.5,0,.35+r*.73,-20-r*1.45,dark);this.box(42,.14,.28,0,.8+r*.73,-19.6-r*1.45,seat);for(const side of [-1,1])this.box(1.6,.55,38,side*(16+r*1.4),.35+r*.73,-2,dark)}for(let r=0;r<7;r++){this.box(42,.55,1.5,0,.35+r*.73,22+r*1.45,dark);this.box(42,.14,.28,0,.8+r*.73,21.6+r*1.45,seat)}for(const x of [-15,15]){this.box(.22,17,.22,x,8.5,-19,dark);this.box(4,.6,.55,x,17,-19,this.mat(0xe7ffff,{emissive:0xb9e6f5,emissiveIntensity:3}));}this.box(28,.8,.18,0,.45,-18,this.mat(0x0c302e));for(const side of [-1,1])this.box(.18,.8,30,side*13.5,.45,-2,this.mat(0x183b32));const can=document.createElement('canvas');can.width=2048;can.height=128;const ctx=can.getContext('2d');ctx.fillStyle='#133e38';ctx.fillRect(0,0,2048,128);ctx.fillStyle='#dcd7b8';ctx.font='bold 42px sans-serif';ctx.textAlign='center';ctx.fillText('HOMEGROUND   ✦   YOUR GAME. YOUR MOMENT.   ✦   FOOTBALL CLUB',1024,80);const tx=new THREE.CanvasTexture(can);tx.colorSpace=THREE.SRGBColorSpace;const banner=new THREE.Mesh(new THREE.PlaneGeometry(28,.8),new THREE.MeshBasicMaterial({map:tx}));banner.position.set(0,.5,-17.89);this.scene.add(banner);}
 makeBall(){const group=new THREE.Group();const white=new THREE.Mesh(new THREE.SphereGeometry(.12,24,16),this.mat(0xf7f4e8,{roughness:.6}));white.castShadow=true;group.add(white);const ico=new THREE.IcosahedronGeometry(1,0);const pos=ico.attributes.position;const seen=new Set();for(let i=0;i<pos.count;i++){const v=new THREE.Vector3().fromBufferAttribute(pos,i).normalize();const key=[v.x,v.y,v.z].map(a=>a.toFixed(2)).join();if(seen.has(key))continue;seen.add(key);const patch=new THREE.Mesh(new THREE.CircleGeometry(.039,5),this.mat(0x142e35));patch.position.copy(v.clone().multiplyScalar(.119));patch.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),v);group.add(patch)}return group}
 startCrowd(){
  this.crowdLoading ??= this.crowd.load(url=>this.getModel(url)).catch(error=>{
   console.warn('观众加载失败',error);
   this.crowdLoading=null;
  });
 }
 async downloadModel(url){
  const loader=new GLTFLoader();
  const source=new URL(url,document.baseURI);
  if(typeof DecompressionStream==='undefined')return loader.loadAsync(source.href);
  const response=await fetch(source.href+'.gz',{signal:AbortSignal.timeout?.(90000)});
  if(!response.ok)throw new Error(`模型下载失败 (${response.status}): ${url}`);
  const stream=response.body.pipeThrough(new DecompressionStream('gzip'));
  const bytes=await new Response(stream).arrayBuffer();
  return loader.parseAsync(bytes,new URL('.',source).href);
 }
 getModel(url){
  if(!this.modelCache.has(url)){
   this.modelCache.set(url,this.downloadModel(url).catch(error=>{
    this.modelCache.delete(url);
    throw error;
   }));
  }
  return this.modelCache.get(url);
 }
 async loadPlayer(star,onProgress){
  onProgress(5);
  const serial=(this.loadSerial||0)+1;
  this.loadSerial=serial;
  let finished=0;
  const progress=()=>{
   if(serial===this.loadSerial)onProgress(5+Math.round(++finished*85/5));
  };
  const motionModel=this.getModel('assets/ronaldo-natural.glb');
  const opponentId=star.id==='courtois'?'mbappe':'courtois';
  const opponent=this.getModel(`assets/players/${opponentId}.glb`).catch(()=>motionModel);
  const reactions=this.getModel('assets/crowd/fan-1-lod.glb').catch(()=>null);
  const readContract=url=>fetch(url,{signal:AbortSignal.timeout?.(15000)})
   .then(response=>response.ok?response.json():null).catch(()=>null);
  const contracts=Promise.all([
   readContract('assets/mocap-contract.json?v=3j'),
   readContract('assets/strike-contract.json')
  ]);
  const [source,ronaldo,npc,emotions,[motionData,strikeContract]]=await Promise.all(
   [this.getModel(star.model),motionModel,opponent,reactions,contracts].map(async request=>{
    const result=await request;
    progress();
    return result;
   })
  );
  if(serial!==this.loadSerial)return;
  this.motionData=motionData;
  if(strikeContract)this.strikeContract=strikeContract;
  this.motionClips=[...ronaldo.animations];
  this.motionSource=ronaldo.scene;
  this.emotionSource=emotions?.scene;
  for(const [name,from,end] of [['ReactGoal','Cheer',168],['ReactMiss','Disappointed',180]]){
   const clip=emotions?.animations.find(animation=>animation.name===from);
   if(!clip)continue;
   const reaction=THREE.AnimationUtils.subclip(clip,name,0,end,60);
   const neutral=ronaldo.animations.find(animation=>animation.name==='Idle');
   for(const track of reaction.tracks){
    if(!/^(thumb|index|middle|ring|pinky)_.*\.quaternion$/.test(track.name))continue;
    const relaxed=neutral?.tracks.find(item=>item.name===track.name);
    if(relaxed)for(let i=0;i<track.values.length;i+=4)track.values.set(relaxed.values.subarray(0,4),i);
   }
   this.motionClips.push(reaction);
  }
  for(const actor of this.actors){
   this.scene.remove(actor.root);
   actor.mixer.stopAllAction();
   actor.model.traverse(object=>{if(object.isMesh)object.material?.dispose()});
  }
  this.actors=[];
  this.player=this.addActor(source,star.height,false,star.id);
  this.opponent=this.addActor(npc,npc===ronaldo?1.87:star.id==='courtois'?1.78:1.99,true);
  this.extra=this.addActor(ronaldo,1.87,true);
  this.opponent.root.visible=false;
  this.extra.root.visible=false;
  onProgress(100);
  return source;
 }
 addActor(source,height=1.87,npc=false,playerId=null){const ronaldo=playerId==='ronaldo',yamal=playerId==='yamal';const model=clone(source.scene);if(ronaldo)refineRonaldoMatchModel(model);const bounds=new THREE.Box3().setFromObject(model),scale=height/(bounds.max.y-bounds.min.y);model.scale.multiplyScalar(scale);model.position.y=-bounds.min.y*scale;model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.material){o.material=o.material.clone();if(ronaldo||yamal)fitPlayerLandmarks(o,playerId);if(yamal)styleYamalMaterial(o.material);if(/shirt_front_number|shirt_back_number|shirt_back_name|short_number|shirt_crest/.test(o.name)){o.geometry=o.geometry.clone();const position=o.geometry.attributes.position,normal=o.geometry.attributes.normal;if(normal)for(let i=0;i<position.count;i++){position.setXYZ(i,position.getX(i)+normal.getX(i)*.003,position.getY(i)+normal.getY(i)*.003,position.getZ(i)+normal.getZ(i)*.003);}o.material.polygonOffset=true;o.material.polygonOffsetFactor=-2;o.material.polygonOffsetUnits=-2;}o.material.userData.baseColor=o.material.color.getHex();o.material.roughness=/eye|iris|pupil/i.test(o.name)?Math.max(.22,o.material.roughness??.3):Math.max(.5,o.material.roughness??.7);if(/jersey|short|sock/i.test(o.material.name)){o.material.bumpMap=this.fabric;o.material.bumpScale=.0012;o.material.roughness=.9}if(npc&&/shirt|jersey|kit|short|sock/i.test(o.material.name))o.material.color.set(0x264c86);this.appearance.apply(o);if(ronaldo&&o.material.name==='eyes_white')o.material.color.multiplyScalar(.76);if(ronaldo&&/^boot/.test(o.name)){this.cr7BootTexture??=createCR7BootTexture();styleCR7Boot(o,this.cr7BootTexture);}addUniformDetail(o,yamal);if(ronaldo&&o.material.name==='Face_reference')softenRonaldoFaceMaterial(o.material)}}});const root=new THREE.Group();root.add(model);this.scene.add(root);const mixer=new THREE.AnimationMixer(model),actions={};for(const original of this.motionClips||source.animations){const clip=original.clone();clip.name=clip.name.replace(/_Ronaldo_Rig$/,'');clip.tracks=clip.tracks.filter(t=>!t.name.endsWith('.scale'));for(const t of clip.tracks){if(!t.name.endsWith('.position'))continue;const name=t.name.slice(0,-9),from=(original.name.startsWith('React')?this.emotionSource:this.motionSource)?.getObjectByName(name),to=model.getObjectByName(name);if(from&&to)for(let i=0;i<t.values.length;i+=3){t.values[i]+=to.position.x-from.position.x;t.values[i+1]+=to.position.y-from.position.y;t.values[i+2]+=to.position.z-from.position.z}}actions[clip.name.toLowerCase()]=mixer.clipAction(clip)};if(ronaldo&&actions.kick){
  const fullKick=actions.kick.getClip();
  const quickKick=THREE.AnimationUtils.subclip(fullKick,'KickQuick',Math.round(QUICK_KICK_START*60),Math.ceil(fullKick.duration*60)+1,60);
  actions.kickquick=mixer.clipAction(quickKick);
 }const actor={root,model,mixer,actions,current:null,ronaldo,yamal,height,speed:1,head:model.getObjectByName('head'),neck:model.getObjectByName('neck_01'),lookYaw:0,lookPitch:0};actor.facial=new FacialPerformance(actor);this.actors.push(actor);this.animate(actor,'idle');return actor}
 motionInfo(name){if(name==='stop')name='runstop';const clips=this.motionData?.clips;if(!clips)return null;return Array.isArray(clips)?clips.find(c=>c.name.toLowerCase()===name.toLowerCase()):clips[name]||clips[Object.keys(clips).find(k=>k.toLowerCase()===name.toLowerCase())];}
 animate(actor,name,once=false,restart=false){
  if(!actor)return;if(name==='stop')name='runstop';const key=Object.keys(actor.actions).find(k=>k===name.toLowerCase())||Object.keys(actor.actions).find(k=>k.includes(name));if(!key)return;
  if(actor.current===key&&!restart)return;
  const next=actor.actions[key],previous=actor.actions[actor.current];
  const blend=name==='kickquick'?.10:name==='kick'?.16:name==='idle'?.32:.22;
  if(previous)previous.fadeOut(blend);
  next.enabled=true;next.reset().setEffectiveWeight(1).setEffectiveTimeScale(actor.speed||1).setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;
  // Preserve normalized foot phase when changing between captured walking/running.
  if(previous&&/^(run|walk)$/.test(actor.current)&&/^(run|walk)$/.test(key)){const offset=actor.current==='walk'?.38:-.38;next.time=((previous.time/previous.getClip().duration+offset+1)%1)*next.getClip().duration;}
  next.fadeIn(blend).play();actor.current=key;
 }
 footPosition(actor,side){actor.model.updateMatrixWorld(true);return actor.model.getObjectByName('ball_'+side)?.getWorldPosition(new THREE.Vector3());}
 attention(actor,dt){actor.facial?.update(dt,this.ball.position);}
 setSpeed(actor,speed){actor.speed=speed;if(actor.current)actor.actions[actor.current].setEffectiveTimeScale(speed)}
 crowdReaction(win){this.mood=win?1:-1;this.moodTime=this.sceneTime;this.crowd.react(win,this.sceneTime)}
 startCutaway(win,role){this.cutaway={start:this.sceneTime,win,role,lastShot:''};this.cutawayLabel='球星特写'}
 endCutaway(){this.cutaway=null;this.camera.fov=43;this.camera.updateProjectionMatrix()}
 setRole(role){
  if(!this.player)return;
  const referee=role==='referee';
  this.player.tracksIncomingBall=role==='keeper';
  if(this.opponent)this.opponent.tracksIncomingBall=role==='player';
  this.opponent?.model.traverse(mesh=>{
   const roleUniform=mesh.material?.userData.uniformRole;
   if(roleUniform)roleUniform.value=role==='player'?1:0;
  });
  this.player.model.traverse(mesh=>{
   if(!mesh.isMesh||!mesh.material)return;
   const material=mesh.material;
   const name=material.name;
   if(material.userData.uniformRole)material.userData.uniformRole.value=referee?2:role==='keeper'?1:0;
   if(/shirt_front_number|shirt_back_number|shirt_back_name|short_number|shirt_crest/.test(mesh.name)||name==='number_ink'){
    mesh.visible=!referee&&!(this.player.yamal&&name==='number_ink');
   }
   if(!/shirt|jersey|kit|short|sock|trim/.test(name))return;
   material.color.set(material.userData.baseColor);
   if(role==='player')return;
   if(/shirt|jersey|kit/.test(name)){
    material.color.set(referee?0xd5b82c:0x593b80);
   }else{
    material.color.set(referee?0x181c20:0x27203a);
   }
  });
 }
 resize(){this.renderer.setSize(this.host.clientWidth,this.host.clientHeight);this.camera.aspect=this.host.clientWidth/this.host.clientHeight;this.camera.updateProjectionMatrix();this.depthFocus?.resize(this.host.clientWidth,this.host.clientHeight)}
 aimAtPointer(x,y){const rect=this.renderer.domElement.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),this.camera);const p=new THREE.Vector3();return this.ray.ray.intersectPlane(this.goalPlane,p)?p:null}
 render(){if(this.cutaway)this.depthFocus.render(this.camTarget);else this.renderer.render(this.scene,this.camera)}
 update(dt,time){this.sceneTime=time;for(const actor of this.actors)if(actor.root.visible){actor.facial?.restore();actor.mixer.update(dt);this.attention(actor,dt);}this.crowd.update(dt,time);this.ballShadow.visible=this.ball.visible;this.ballShadow.position.set(this.ball.position.x,.025,this.ball.position.z);this.ballShadow.scale.setScalar(1+this.ball.position.y*.3);this.ballShadow.material.opacity=.3/(1+this.ball.position.y*.5);const cam=new THREE.Vector3(),look=new THREE.Vector3();if(this.cutaway&&this.player){const elapsed=time-this.cutaway.start;let shot='player';this.camera.fov=38;this.camera.updateProjectionMatrix();if(elapsed>1.6&&elapsed<4.8&&this.crowd.ready){const c=this.crowd.shot(time);cam.copy(c.camera);look.copy(c.look);shot='crowd';this.cutawayLabel=this.cutaway.win?'看台上的欢呼':'看台上的遗憾'}else{const p=this.player.root.position,yaw=this.player.root.rotation.y,forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)),side=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));cam.copy(p).addScaledVector(forward,this.selectedStar==='ronaldo'?2.7:4.4).addScaledVector(side,.7);cam.y=p.y+1.5;look.copy(p);look.y+=1.35;this.cutawayLabel=this.cutaway.win?'球星特写':'下一次机会'}if(this.cutaway.lastShot!==shot){this.camera.position.copy(cam);this.camTarget.copy(look);this.cutaway.lastShot=shot}}else if(this.cameraMode==='player'&&this.player){const p=this.player.root.position;if(this.sideView){cam.set(p.x+7,2.6,p.z+2.7);look.set(p.x,1,p.z-.8)}else{cam.set(p.x*.85+2.0,3.05,p.z+6.6);look.set(p.x*.8,.95,p.z-4)}}else if(this.cameraMode==='keeper'){cam.set(0,5.2,-22.5);look.set(0,.7,-8)}else if(this.cameraMode==='referee'){cam.set(11,7,9);look.set(0,.7,-3)}else if(this.cameraMode==='portrait'&&this.player){cam.set(1.5,1.4,4.2);look.set(-.6,1.0,0)}else{cam.set(17+Math.sin(time*.035)*3,11,22);look.set(0,0,-8)}this.camera.position.lerp(cam,1-Math.exp(-dt*3.5));this.camTarget.lerp(look,1-Math.exp(-dt*4));this.camera.lookAt(this.camTarget);this.render()}
}
