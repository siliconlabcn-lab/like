import * as THREE from 'three';
import {sweptContact} from './rules.js?v=3r';

export const QUICK_KICK_START = .55;

// Shape the actual match mesh in its bind pose, including the boot layers
// and shirt lettering. The rig, expression targets and toe reach stay intact.
export function refineRonaldoMatchModel(model){
 const smooth=THREE.MathUtils.smoothstep;
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const body=mesh.material?.name==='Face_reference';
  const boot=/^boot/.test(mesh.name);
  const clothing=/^(jersey|shirt|short)/.test(mesh.name);
  if(!body&&!boot&&!clothing)return;

  const geometry=mesh.geometry.clone();
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
   const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
   const side=Math.sign(x);
   let nextX=x,nextY=y,nextZ=z;
   if((boot||body)&&y<.145){
    const ankleFade=1-smooth(y,.105,.145);
    const footCenter=side*.206;
    nextX+=(footCenter-x)*.23*ankleFade;
    nextY-=Math.max(0,y-.028)*.19*ankleFade;
   }
   if(body||clothing){
    const torsoMask=1-smooth(Math.abs(x),.23,.37);
    const waist=Math.exp(-Math.pow((y-1.11)/.095,2))*torsoMask;
    const chest=Math.exp(-Math.pow((y-1.45)/.115,2))*torsoMask;
    nextX*=1+.063*waist-.026*chest;
    nextZ+=.008*waist*(2*smooth(z,-.035,.085)-1);
   }
   if(mesh.name==='shirt_collar'){
    nextY-=.004;
   }
   if(body){
    // Hands extend outward in the rest pose. Fade the adjustment at the wrist.
    const hand=smooth(Math.abs(x),.425,.57);
    nextX-=side*.017*hand;
    nextZ-=(z-.036)*.13*hand;
    if(y>=1.585&&y<=1.755&&z>=.045){
     const jaw=Math.exp(-Math.pow((y-1.621)/.023,2)-Math.pow((Math.abs(x)-.066)/.022,2));
     const cheek=Math.exp(-Math.pow((y-1.683)/.022,2)-Math.pow((Math.abs(x)-.062)/.022,2));
     const chin=Math.exp(-Math.pow((y-1.612)/.017,2)-Math.pow(x/.031,2));
     const noseBridge=Math.exp(-Math.pow((y-1.730)/.019,2)-Math.pow(x/.014,2));
     const underNose=Math.exp(-Math.pow((y-1.697)/.010,2)-Math.pow(x/.020,2));
     const lowerLip=Math.exp(-Math.pow((y-1.677)/.012,2)-Math.pow(x/.031,2));
     const jawline=Math.exp(-Math.pow((y-1.616)/.019,2)-Math.pow((Math.abs(x)-.053)/.019,2));
     const depth=smooth(z,.045,.095);
     nextX+=side*(.008*jaw+.003*jawline)*depth;
     nextY-=.006*chin*depth;
     nextZ+=(.004*cheek+.004*chin+.002*noseBridge-.004*underNose-.005*lowerLip)*depth;
    }
   }
   positions.setXYZ(i,nextX,nextY,nextZ);
  }
  positions.needsUpdate=true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.geometry=geometry;
 });
}

export class RonaldoDribble {
 constructor(){
  this.previous={l:null,r:null};
  this.lastTouch=-Infinity;
 }

 reset(){
  this.previous.l=this.previous.r=null;
  this.lastTouch=-Infinity;
 }

 // Only a foot moving into the ball can send it rolling. The feet still use
 // the recorded gait, while the push direction comes from the contact frame.
 update(world,actor,ball,velocity,speed,now,dt){
  const forward=new THREE.Vector3(Math.sin(actor.root.rotation.y),0,Math.cos(actor.root.rotation.y));
  let touch=null;
  for(const side of ['l','r']){
   const foot=world.footPosition(actor,side);
   const previous=this.previous[side];
   this.previous[side]=foot;
   if(!foot||!previous||dt<=0||speed<.25||now-this.lastTouch<.18)continue;
   if(foot.y>.32&&previous.y>.32)continue;
   const stroke=foot.clone().sub(previous);
   stroke.y=0;
   if(stroke.lengthSq()<.00002||stroke.dot(forward)<=0)continue;
   if(stroke.dot(ball.clone().sub(previous))<=0)continue;
   const hit=sweptContact(previous,foot,ball,.245);
   if(hit===null||(touch&&hit>=touch.hit))continue;
   touch={hit,stroke};
  }
  if(!touch)return false;
  const footSpeed=touch.stroke.length()/dt;
  const direction=touch.stroke.normalize().lerp(forward,.55).normalize();
  const pace=THREE.MathUtils.clamp(speed*.67+footSpeed*.25,1.25,speed+1.65);
  velocity.copy(direction).multiplyScalar(pace);
  this.lastTouch=now;
  return true;
 }
}


// Blend the baked nostril shadow toward nearby skin from the same atlas.
export function softenRonaldoFaceMaterial(material){
 const previousCompile=material.onBeforeCompile;
 const previousKey=material.customProgramCacheKey();
 material.customProgramCacheKey=()=>previousKey+'-cr7-face-cleanup';
 material.onBeforeCompile=(shader,renderer)=>{
  previousCompile.call(material,shader,renderer);
  shader.vertexShader='varying vec3 vCR7FacePosition;\n'+shader.vertexShader.replace(
   '#include <begin_vertex>',
   '#include <begin_vertex>\nvCR7FacePosition=position;'
  );
  shader.fragmentShader='varying vec3 vCR7FacePosition;\n'+shader.fragmentShader.replace(
   '#include <map_fragment>',
   `#include <map_fragment>
   #ifdef USE_MAP
    vec3 facePoint=vCR7FacePosition;
    float centerMask=1.0-smoothstep(.012,.033,abs(facePoint.x));
    float noseBand=smoothstep(1.689,1.702,facePoint.y)*(1.0-smoothstep(1.719,1.733,facePoint.y));
    float frontMask=smoothstep(.122,.158,facePoint.z);
    vec3 skinLeft=texture2D(map,vec2(.9042,.5639)).rgb;
    vec3 skinRight=texture2D(map,vec2(.9042,.4697)).rgb;
    vec3 skinTone=mix(skinLeft,skinRight,smoothstep(-.026,.026,facePoint.x));
    diffuseColor.rgb=mix(diffuseColor.rgb,skinTone,.88*centerMask*noseBand*frontMask);
   #endif
   `
  );
 };
 material.needsUpdate=true;
}
