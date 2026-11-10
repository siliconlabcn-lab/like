import * as THREE from 'three';

const bound=(n,a,b)=>Math.max(a,Math.min(b,n));
// The eyes and lids are real mesh targets. The capture remains the base pose.
export class FacialPerformance {
 constructor(actor){
  this.actor=actor;this.meshes=[];this.saved=[];this.time=0;this.nextBlink=3.1;this.blinkStart=-10;this.blinks=0;
  this.yaw=0;this.pitch=0;this.eyeYaw=0;this.eyePitch=0;this.smile=0;this.focus=0;
  actor.model.traverse(o=>{if(o.morphTargetDictionary&&o.morphTargetInfluences)this.meshes.push(o)});
  this.enabled=this.meshes.some(o=>'BlinkLeft' in o.morphTargetDictionary);
  if(!actor.head)return;
  actor.model.updateMatrixWorld(true);
  const inverse=actor.head.getWorldQuaternion(new THREE.Quaternion()).invert();
  this.forward=new THREE.Vector3(0,0,1).applyQuaternion(inverse);
  this.right=new THREE.Vector3(1,0,0).applyQuaternion(inverse);
  this.up=new THREE.Vector3(0,1,0).applyQuaternion(inverse);
 }
 restore(){for(const [bone,q] of this.saved)bone.quaternion.copy(q);this.saved.length=0;}
 lookToward(target,seconds=1.2){this.focusTarget=target.clone();this.focusUntil=this.time+seconds;}
 set(name,value){for(const mesh of this.meshes){const i=mesh.morphTargetDictionary[name];if(i!==undefined)mesh.morphTargetInfluences[i]=value;}}
 update(dt,ball){
  if(!this.actor.head)return;
  const a=this.actor;this.time+=dt;a.model.updateMatrixWorld(true);
  const head=a.head.getWorldPosition(new THREE.Vector3()),q=a.head.getWorldQuaternion(new THREE.Quaternion());
  const running=/run|walk|turn/.test(a.current||''),kicking=(a.current||'').startsWith('kick'),reacting=(a.current||'').startsWith('react');
  // During travel, look where the body is going. Near the ball, lower the gaze.
  // Never aim the face toward the mouse, and never pull the head around backwards.
  const forward=new THREE.Vector3(Math.sin(a.root.rotation.y),0,Math.cos(a.root.rotation.y));
  const target=running?head.clone().addScaledVector(forward,6):ball.distanceTo(a.root.position)<(a.tracksIncomingBall?18:3)?ball.clone():head.clone().addScaledVector(forward,7);
  if(reacting)target.copy(head).addScaledVector(forward,7);
  if(!kicking&&this.focusTarget&&this.time<this.focusUntil)target.copy(this.focusTarget);
  const direction=target.sub(head).normalize();
  const right=this.right.clone().applyQuaternion(q),up=this.up.clone().applyQuaternion(q),front=this.forward.clone().applyQuaternion(q);
  const x=direction.dot(right),y=direction.dot(up),z=direction.dot(front);
  const yaw=z>.15?Math.atan2(x,z):0,pitch=z>.15?Math.atan2(y,Math.hypot(x,z)):0;
  const headYaw=kicking?0:bound(yaw*.3,-.16,.16),headPitch=kicking?0:bound(pitch*.22,-.11,.08);
  this.yaw=THREE.MathUtils.damp(this.yaw,headYaw,3,dt);this.pitch=THREE.MathUtils.damp(this.pitch,headPitch,3,dt);
  for(const [bone,weight] of [[a.neck,.35],[a.head,.65]]){
   if(!bone)continue;this.saved.push([bone,bone.quaternion.clone()]);
   const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());
   const rotation=new THREE.Quaternion().setFromAxisAngle(up,this.yaw*weight)
    .multiply(new THREE.Quaternion().setFromAxisAngle(right,-this.pitch*weight));
   bone.quaternion.premultiply(parent.clone().invert().multiply(rotation).multiply(parent));
  }
  if(!this.enabled)return;
  this.eyeYaw=THREE.MathUtils.damp(this.eyeYaw,bound(yaw-this.yaw,-.22,.22),12,dt);
  this.eyePitch=THREE.MathUtils.damp(this.eyePitch,bound(pitch-this.pitch,-.17,.13),10,dt);
  this.set('LookLeft',Math.max(0,-this.eyeYaw)/.22);this.set('LookRight',Math.max(0,this.eyeYaw)/.22);
  this.set('LookDown',Math.max(0,-this.eyePitch)/.17);this.set('LookUp',Math.max(0,this.eyePitch)/.13);
  if(this.time>=this.nextBlink&&!kicking){this.blinkStart=this.time;this.blinks++;this.nextBlink=this.time+3.2+(Math.sin(this.blinks*2.31)+1)*1.1;}
  const t=this.time-this.blinkStart;
  const blink=t<.06?t/.06:t<.085?1:t<.23?1-(t-.085)/.145:0;
  this.smile=THREE.MathUtils.damp(this.smile,a.current==='reactgoal'?.3:0,3,dt);
  this.focus=THREE.MathUtils.damp(this.focus,kicking?.32:running?.18:0,4,dt);
  const restingLid=(a.ronaldo?.12:.08)+this.focus*.2+this.smile*.1;
  const lid=restingLid+(1-restingLid)*bound(blink,0,1);
  this.set('BlinkLeft',lid);this.set('BlinkRight',lid);
  this.set('Smile',this.smile);this.set('Focus',this.focus);
 }
}
