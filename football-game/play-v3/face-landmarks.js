import * as THREE from 'three';

// Local landmark controls, inspired by FaceScape's landmark-fitting demo.
// Coordinates are on our own rig. Each target is an artist-set displacement
// in the neutral pose, not a FaceScape dataset vertex or a biometric scan.
const profiles={
 ronaldo:[
  [[.061,1.728,.117],[.004,.002,.002],.036],
  [[.055,1.650,.096],[-.003,.002,.004],.044],
  [[0,1.635,.151],[0,-.003,.003],.026],
 ],
 yamal:[
  [[.057,1.739,.128],[.004,.003,.004],.033],
  [[.062,1.690,.109],[.003,0,.005],.045],
  [[.053,1.645,.097],[-.010,.004,-.003],.041],
  [[0,1.638,.153],[0,.006,-.005],.030],
  [[0,1.713,.181],[0,-.003,.003],.023],
 ],
};

export function fitPlayerLandmarks(mesh,player){
 const controls=profiles[player];
 if(!controls)return;
 const materialName=mesh.material.name;
 if(!/Face_reference|_Face$|^Skin_warm_olive$/.test(materialName))return;
 const geometry=mesh.geometry.clone();
 const position=geometry.attributes.position;
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
  if(y<1.58||y>1.81||z<.03)continue;
  const side=Math.sign(x);
  let dx=0,dy=0,dz=0;
  for(const [[cx,cy,cz],[tx,ty,tz],radius] of controls){
   const distance=Math.hypot(Math.abs(x)-cx,y-cy,z-cz);
   const weight=1-THREE.MathUtils.smoothstep(distance,0,radius);
   dx+=side*tx*weight;
   dy+=ty*weight;
   dz+=tz*weight;
  }
  position.setXYZ(i,x+dx,y+dy,z+dz);
 }
 position.needsUpdate=true;
 geometry.computeBoundingBox();
 geometry.computeBoundingSphere();
 mesh.geometry=geometry;
}

export function styleYamalMaterial(material){
 const name=material.name;
 if(name.endsWith('_Face')||name==='Skin_warm_olive'){
  material.map=null;
  material.color.set(0xa96c4d);
  material.roughness=.77;
 }else if(name==='hair_dark_brown'){
  material.color.set(0x9c7435);
 }else if(/short|sock|trim/.test(name)){
  material.color.set(0x182e5d);
 }
}
