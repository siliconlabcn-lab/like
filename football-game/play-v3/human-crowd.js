import * as THREE from 'three';
import {clone} from './vendor/utils/SkeletonUtils.js';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';

// Captured spectator actions are shared by three human meshes. Distant spectators
// use baked poses, while the broadcast group plays complete captured actions.
const frac=x=>x-Math.floor(x);
const variation=n=>frac(Math.sin(n*17.31+5.17)*43758.54);
const POSES=[['seated','Seated',.8],['rising','Rise',.65],['standing','Idle',.7],['cheerA','Cheer',.8],['cheerB','Cheer',1.8],['disappointed','Disappointed',3.4]];

export class HumanCrowd {
 constructor(scene){this.scene=scene;this.batches=[];this.close=[];this.ready=false;this.mood=0;this.moodTime=-100;this.dummy=new THREE.Object3D();}
 async load(getModel){
  const variants=[1,2,3];
  const lowModels=await Promise.all(variants.map(n=>getModel(`assets/crowd/fan-${n}-lod.glb`)));
  const allSeats=[];
  for(let type=0;type<3;type++){
   const fans=[];
   const add=(x,y,z,yaw,id)=>{
    const hash=variation(id),s=.89+variation(id+100)*.08;
    const f={x,y,z,yaw:yaw+(variation(id+200)-.5)*.11,s,standing:hash>.84,delay:.12+variation(id+9)*1.3,reacts:hash<.76,variant:hash<.38?'cheerA':'cheerB'};
    fans.push(f);allSeats.push(f);
   };
   for(let row=0;row<7;row++)for(let col=0;col<43;col++){
    if(col%15===0||(row===1&&Math.abs(col-21)<3)||(row*43+col)%3!==type)continue;
    const id=row*43+col;
    add((col-21)*.93,.63+row*.73,-20-row*1.45,0,id);
    if(row<4)add((col-21)*.93,.63+row*.73,22+row*1.45,Math.PI,id+700);
   }
   for(const side of [-1,1])for(let row=0;row<4;row++)for(let col=0;col<26;col++){
    if((row*26+col)%3!==type||col%12===0)continue;
    add(side*(16+row*1.4),.63+row*.73,-16+col*1.25,-side*Math.PI/2,2000+side*500+row*26+col);
   }
   for(const [pose,clip,t] of POSES){
    for(const {geometry,material} of this.bake(lowModels[type],clip,t)){
     const mesh=new THREE.InstancedMesh(geometry,material,fans.length);
     mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.visible=false;
     this.scene.add(mesh);this.batches.push({mesh,fans,pose});
    }
   }
  }
  const fullModels=await Promise.all(variants.map((n,index)=>
   getModel(`assets/crowd/fan-${n}.glb`).catch(()=>lowModels[index])));
  for(let i=0;i<5;i++){
   const source=fullModels[i%3],model=clone(source.scene);
   const bounds=new THREE.Box3().setFromObject(model),scale=1.73/(bounds.max.y-bounds.min.y);
   model.scale.multiplyScalar(scale);model.position.y=-bounds.min.y*scale;
   const root=new THREE.Group();root.add(model);root.position.set((i-2)*.93,1.36,-21.45);root.rotation.y=(i-2)*-.025;this.scene.add(root);
   model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
   const mixer=new THREE.AnimationMixer(model),actions={};
   for(const clip of source.animations)actions[clip.name.toLowerCase()]=mixer.clipAction(clip);
   const actor={root,model,mixer,actions,seatOrigin:root.position.clone(),standing:i===0||i===4,current:null,changedAt:0,reactionAt:Infinity,stage:'rest',delay:[.25,.48,.12,.72,.38][i]};
   this.play(actor,actor.standing?'idle':'seated',false,0);
   if(!actions[actor.current]){this.scene.remove(root);continue;}
   actions[actor.current].time=variation(i+40)*1.7;
   this.close.push(actor);
   allSeats.push({x:root.position.x,y:root.position.y,z:root.position.z,yaw:root.rotation.y,s:1});
  }
  this.addSeats(allSeats);
  this.ready=true;this.update(0,0);
 }
 addSeats(fans){
  // Each seat is behind the hips, with the feet on the existing terrace step.
  const material=new THREE.MeshStandardMaterial({color:0x35566a,roughness:.87});
  for(const [w,h,d,dy,dz] of [[.43,.065,.38,.68,-.025],[.43,.34,.045,.88,-.20]]){
   const seats=new THREE.InstancedMesh(new THREE.BoxGeometry(w,h,d),material,fans.length);
   for(let i=0;i<fans.length;i++){
    const f=fans[i];this.dummy.position.set(f.x+Math.sin(f.yaw)*dz,f.y+dy*f.s,f.z+Math.cos(f.yaw)*dz);this.dummy.rotation.set(0,f.yaw,0);this.dummy.scale.setScalar(f.s);this.dummy.updateMatrix();seats.setMatrixAt(i,this.dummy.matrix);
   }
   seats.receiveShadow=true;this.scene.add(seats);
  }
 }
 bake(source,name,time){
  const model=clone(source.scene),mixer=new THREE.AnimationMixer(model),clip=source.animations.find(c=>c.name.toLowerCase()===name.toLowerCase());
  if(clip){mixer.clipAction(clip).play();mixer.update(Math.min(time,clip.duration));}
  model.updateMatrixWorld(true);const groups=new Map();
  model.traverse(o=>{
   if(!o.isMesh)return;o.skeleton?.update();const g=o.geometry.clone(),p=g.attributes.position,v=new THREE.Vector3();
   for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);if(o.isSkinnedMesh)o.applyBoneTransform(i,v);v.applyMatrix4(o.matrixWorld);p.setXYZ(i,v.x,v.y,v.z);}
   for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);
   if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(p.count*2),2));g.computeVertexNormals();
   const material=Array.isArray(o.material)?o.material[0]:o.material,key=material.name||material.uuid;
   if(!groups.has(key))groups.set(key,{material,items:[]});groups.get(key).items.push(g);
  });
  return [...groups.values()].map(g=>({material:g.material,geometry:g.items.length===1?g.items[0]:mergeGeometries(g.items.map(x=>x.index?x.toNonIndexed():x),false)}));
 }
 play(actor,name,once,time){
  const action=actor.actions[name];if(!action||actor.current===name)return;
  actor.actions[actor.current]?.fadeOut(.35);
  action.reset().setEffectiveTimeScale(1).setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);
  action.clampWhenFinished=once;action.fadeIn(.35).play();actor.current=name;actor.changedAt=time;
 }
 react(win,time){
  this.mood=win?1:-1;this.moodTime=time;
  for(const actor of this.close){actor.reactionAt=time+actor.delay;actor.stage='waiting';}
 }
 poseFor(f,time){
  const elapsed=time-this.moodTime-f.delay;
  if(elapsed<0||elapsed>9)return f.standing?'standing':'seated';
  if(this.mood<0)return f.standing&&f.reacts?'disappointed':f.standing?'standing':'seated';
  if(!f.reacts)return f.standing?'standing':'seated';
  if(!f.standing&&elapsed<.35)return 'seated';
  if(!f.standing&&elapsed<1.10)return 'rising';
  return f.variant;
 }
 update(dt,time){
  if(!this.ready)return;
  // Backgrounds change only in response to the match. No floating/bobbing bodies.
  const stamp=Math.floor(time*12);
  if(stamp!==this.lastStamp){
   this.lastStamp=stamp;
   for(const batch of this.batches){
    let count=0;
    for(let i=0;i<batch.fans.length;i++){
     const f=batch.fans[i],visible=this.poseFor(f,time)===batch.pose;
     if(!visible)continue;
     const clearance=batch.pose==='seated'?0:batch.pose==='rising'?.18:.35;
     this.dummy.position.set(f.x+Math.sin(f.yaw)*clearance,f.y,f.z+Math.cos(f.yaw)*clearance);this.dummy.rotation.set(0,f.yaw,0);this.dummy.scale.setScalar(f.s);this.dummy.updateMatrix();batch.mesh.setMatrixAt(count++,this.dummy.matrix);
    }
    batch.mesh.count=count;batch.mesh.visible=count>0;
    batch.mesh.instanceMatrix.needsUpdate=true;
   }
  }
  for(const actor of this.close){
   if(actor.stage==='waiting'&&time>=actor.reactionAt){
    if(this.mood>0){this.play(actor,actor.standing?'cheer':'rise',true,time);actor.stage=actor.standing?'reaction':'rising';}
    else if(actor.standing){this.play(actor,'disappointed',true,time);actor.stage='reaction';}
    else actor.stage='rest';
   }
   if(actor.stage==='rising'&&time-actor.changedAt>=actor.actions.rise.getClip().duration-.1){this.play(actor,'cheer',true,time);actor.stage='reaction';}
   if(actor.stage==='reaction'&&time-this.moodTime>9){this.play(actor,actor.standing?'idle':'sit',!actor.standing,time);actor.stage=actor.standing?'rest':'sitting';}
   if(actor.stage==='sitting'&&time-actor.changedAt>=actor.actions.sit.getClip().duration-.1){this.play(actor,'seated',false,time);actor.stage='rest';}
   // The chair stays anchored at seatOrigin. Captured standing gestures happen
   // in front of it rather than inside the seat; rising/sitting preserve continuity.
   let clearance=actor.standing||['cheer','disappointed','idle'].includes(actor.current)?.35:0;
   if(actor.current==='rise'||actor.current==='sit'){
    const duration=actor.actions[actor.current].getClip().duration;
    const progress=Math.max(0,Math.min(1,(time-actor.changedAt)/duration));
    const eased=progress*progress*(3-2*progress);
    clearance=.35*(actor.current==='rise'?eased:1-eased);
   }
   actor.root.position.copy(actor.seatOrigin);
   actor.root.position.x+=Math.sin(actor.root.rotation.y)*clearance;
   actor.root.position.z+=Math.cos(actor.root.rotation.y)*clearance;
   actor.mixer.update(dt);
  }
 }
 shot(){return{camera:new THREE.Vector3(.9,2.72,-18.35),look:new THREE.Vector3(-.15,2.57,-21.45)};}
}
