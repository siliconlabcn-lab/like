import * as THREE from 'three';

// A local approximation of the gold-and-white CR7 special edition.
export function createCR7BootTexture(){
 const canvas=document.createElement('canvas');
 canvas.width=512;
 canvas.height=256;
 const c=canvas.getContext('2d');
 const gold=c.createLinearGradient(0,0,0,256);
 gold.addColorStop(0,'#f4d98e');
 gold.addColorStop(.42,'#d5ad5d');
 gold.addColorStop(1,'#9a6b2f');
 c.fillStyle=gold;
 c.fillRect(0,0,512,256);
 c.strokeStyle='#fff2be35';
 c.lineWidth=1.5;
 for(let x=-160;x<530;x+=12){
  c.beginPath();
  c.moveTo(x,256);
  c.lineTo(x+160,0);
  c.stroke();
 }
 c.fillStyle='#fff9ec';
 c.beginPath();
 c.moveTo(113,154);
 c.bezierCurveTo(98,193,121,213,166,196);
 c.bezierCurveTo(242,169,354,111,452,74);
 c.bezierCurveTo(324,107,225,137,162,160);
 c.bezierCurveTo(134,170,118,169,113,154);
 c.fill();
 c.font='bold italic 29px sans-serif';
 c.fillText('CR7',30,103);
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 return texture;
}

export function styleCR7Boot(mesh,texture){
 const material=mesh.material;
 if(/^boot_upper/.test(mesh.name)){
  const positions=mesh.geometry.attributes.position;
  const uv=new Float32Array(positions.count*2);
  for(let i=0;i<positions.count;i++){
   uv[i*2]=THREE.MathUtils.clamp((positions.getZ(i)+.043)/.302,0,1);
   uv[i*2+1]=THREE.MathUtils.clamp((positions.getY(i)-.013)/.11,0,1);
  }
  mesh.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  material.map=texture;
  material.color.set(0xffffff);
  material.roughness=.42;
 }else if(/^boot_lace/.test(mesh.name)){
  material.color.set(0xf5edd8);
 }else{
  material.color.set(0x876638);
 }
 material.needsUpdate=true;
}
