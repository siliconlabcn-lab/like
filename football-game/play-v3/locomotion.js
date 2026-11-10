import * as THREE from 'three';

export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
export const clamp = (v,lo,hi) => Math.min(hi,Math.max(lo,v));
const approach = (v,to,step) => v < to ? Math.min(to,v+step) : Math.max(to,v-step);

// Movement and the recorded stride share one speed. Large changes of direction
// slow the player before the feet step into the new direction.
export class Locomotion {
  constructor(world,actor){this.world=world;this.actor=actor;this.speed=0;this.turn=null;this.travel=0;this.lastInput=new THREE.Vector3();this.stop=null;}
  reset(){this.speed=0;this.turn=null;this.stop=null;this.travel=0;this.actor.motionState='idle';}
  playRecorded(name){
    const clip=this.world.motionInfo(name);if(!clip?.root?.length)return false;
    const scale=this.actor.height/1.87;
    const entry=trajectorySpeed(clip,0)*scale;
    const rate=clamp(this.speed/Math.max(.5,entry),.65,1.45);
    this.turn={name,clip,time:0,rate,origin:this.actor.root.position.clone(),yaw:this.actor.root.rotation.y};
    this.world.animate(this.actor,name,true,true);this.world.setSpeed(this.actor,rate);return true;
  }
  step(input,dt,{sprint=false,limit=true,targetSpeed=null,recordedTurns=true}={}){
    const a=this.actor,w=this.world,p=a.root.position,has=input.lengthSq()>.001;
    const desiredYaw=has?Math.atan2(input.x,input.z):a.root.rotation.y;
    let delta=wrapAngle(desiredYaw-a.root.rotation.y);
    const factor=a.height/1.87;
    const base=(w.motionInfo('run')?.nominalSpeed||3.5)*factor;
    if(this.turn?.name==='stop'&&has&&this.turn.time>.35){this.turn=null;this.speed=.6;}
    if(this.turn){
      const tr=this.turn;tr.time+=dt*tr.rate;
      const root=sampleRoot(tr.clip,tr.time),factor=a.height/1.87;
      p.copy(rootInWorld(tr.origin,tr.yaw,{x:root.x*factor,z:root.z*factor}));
      a.root.rotation.y=tr.yaw+(root.yaw||0);a.motionState=tr.name;
      if(tr.time>=tr.clip.duration){this.turn=null;this.speed=tr.name==='stop'?0:trajectorySpeed(tr.clip,tr.clip.duration)*factor*tr.rate;}
      return this.speed;
    }
    if(recordedTurns&&has&&this.speed>base*.55&&Math.abs(delta)>.95){
      const choices=['turnleft','turnright'].map(name=>({name,clip:w.motionInfo(name)}));
      const match=choices.find(c=>c.clip?.root?.length&&Math.sign(c.clip.root.at(-1).yaw)===Math.sign(delta));
      if(match&&this.playRecorded(match.name))return this.speed;
    }
    if(!has&&this.speed>base*.55&&recordedTurns&&this.playRecorded('stop'))return this.speed;
    // Slow sharply for a reversal, and lean into a traversed arc instead of
    // swivelling the whole mesh instantly around its heels.
    const wanted=has?(targetSpeed??(sprint?base*1.12:base*.86))*Math.max(.12,Math.cos(Math.min(Math.abs(delta),1.44))):0;
    this.speed=approach(this.speed,wanted,dt*(wanted>this.speed?4.8:7.5));
    const maxYaw=(this.speed>.5?2.6:1.7)*dt;
    a.root.rotation.y+=clamp(delta,-maxYaw,maxYaw);
    if(has&&this.speed>.1){
      const walk=w.motionInfo('walk'),walking=walk&&this.speed<base*.65;
      w.animate(a,walking?'walk':'run');w.setSpeed(a,clamp(this.speed/(walking?walk.nominalSpeed*factor:base),.08,1.35));
      const distance=this.speed*dt;
      p.x+=Math.sin(a.root.rotation.y)*distance;p.z+=Math.cos(a.root.rotation.y)*distance;
      this.travel+=distance;a.motionState='run';
    }else if(this.speed>.1){
      const walk=w.motionInfo('walk');w.animate(a,walk?'walk':'run');w.setSpeed(a,clamp(this.speed/(walk?walk.nominalSpeed*factor:base),.08,1.35));
      p.x+=Math.sin(a.root.rotation.y)*this.speed*dt;p.z+=Math.cos(a.root.rotation.y)*this.speed*dt;
      a.motionState='decelerating';
    }else{w.animate(a,'idle');w.setSpeed(a,1);a.motionState='idle';}
    if(limit){p.x=clamp(p.x,-8.5,8.5);p.z=clamp(p.z,-9,8);}
    this.lastInput.copy(input);
    return this.speed;
  }
}

// Real recorded root trajectories are sampled outside the skeleton so that the
// collision body, camera and ball see the exact same movement as the performer.
export function sampleRoot(clip,time){
 const frames=clip?.root||[];
 if(!frames.length)return{x:0,z:0,yaw:0};
 if(time<=frames[0].t)return frames[0];
 let lo=0,hi=frames.length-1;
 while(hi-lo>1){const mid=(hi+lo)>>1;if(frames[mid].t<=time)lo=mid;else hi=mid;}
 const a=frames[lo],b=frames[hi],f=clamp((time-a.t)/(b.t-a.t||1),0,1);
 return{x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,yaw:(a.yaw||0)+wrapAngle((b.yaw||0)-(a.yaw||0))*f};
}

export function rootInWorld(origin,yaw,root){
 return new THREE.Vector3(origin.x+Math.cos(yaw)*root.x+Math.sin(yaw)*root.z,origin.y,origin.z-Math.sin(yaw)*root.x+Math.cos(yaw)*root.z);
}

// Average across a few samples rather than amplifying capture noise at one frame.
function trajectorySpeed(clip,time){
 const a=sampleRoot(clip,Math.max(0,time-.12)),b=sampleRoot(clip,Math.min(clip.duration,time+.12));
 const span=Math.min(clip.duration,time+.12)-Math.max(0,time-.12);
 return Math.hypot(b.x-a.x,b.z-a.z)/Math.max(.001,span);
}
