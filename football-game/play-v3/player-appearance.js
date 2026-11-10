import * as THREE from 'three';
// Shared surface details preserve each player's original face and skin tone.
export class PlayerAppearance {
 constructor(renderer){
  this.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(256,256);let seed=1729;
  for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=120+(seed%17);pixels.data.set([value,value,value,255],i);}
  ctx.putImageData(pixels,0,0);this.pores=new THREE.CanvasTexture(canvas);this.pores.wrapS=this.pores.wrapT=THREE.RepeatWrapping;this.pores.repeat.set(24,24);
  const iris=document.createElement('canvas');iris.width=iris.height=256;const c=iris.getContext('2d');c.fillStyle='#342015';c.fillRect(0,0,256,256);
  for(let i=0;i<720;i++){const angle=i*Math.PI/360;c.strokeStyle=i%3?'#725035':'#aa8150';c.lineWidth=1;c.beginPath();c.moveTo(128+Math.cos(angle)*43,128+Math.sin(angle)*43);c.lineTo(128+Math.cos(angle)*(104+i%15),128+Math.sin(angle)*(104+i%15));c.stroke();}
  const edge=c.createRadialGradient(128,128,78,128,128,128);edge.addColorStop(0,'#24170b00');edge.addColorStop(1,'#100c09');c.fillStyle=edge;c.fillRect(0,0,256,256);c.fillStyle='#080706';c.beginPath();c.arc(128,128,42,0,Math.PI*2);c.fill();
  this.iris=new THREE.CanvasTexture(iris);this.iris.colorSpace=THREE.SRGBColorSpace;
 }
 apply(mesh){
  const m=mesh.material;if(!m||Array.isArray(m))return;const name=(m.name+' '+mesh.name).toLowerCase();
  if(m.map){m.map.anisotropy=this.anisotropy;}
  if(/face|skin|body/.test(name)&&!/jersey|shirt|short|sock/.test(name)){
   m.metalness=0;m.roughness=.72;m.bumpMap=this.pores;m.bumpScale=.00026;
   // Restrained, broad highlights rather than a plastic-looking clear coat.
   if('specularIntensity' in m)m.specularIntensity=.25;
  }
  if(/eyes_white/.test(name)&&!m.map){m.color.set('#d4cbbd');m.roughness=.28;}
  if(/eyes_brown|\biris\b/.test(name)&&!m.map){m.map=this.iris;m.color.set(0xffffff);m.roughness=.27;}
  if(/pupil/.test(name)){m.roughness=.2;}
  if(/hair|beard|brow/.test(name)){m.roughness=.86;m.metalness=0;}
  if(/jersey|short|sock/.test(name)){m.roughness=.94;m.metalness=0;}
  if(/boot/.test(name)){m.roughness=/sole/.test(name)?.82:.46;m.metalness=0;}
  m.needsUpdate=true;
 }
}

// Coordinates stay on the original mesh as the skeleton animates.
const kitDetail = {
 jersey: `
  float ribs = cos(p.y*420.0)*cos(p.x*380.0);
  float fabricVisibility = 1.0-smoothstep(.006,.026,max(fwidth(p.x),fwidth(p.y)));
  diffuseColor.rgb *= 1.0+.055*ribs*fabricVisibility;
  float sidePanel = smoothstep(.53,.57,abs(p.x)) * (1.0-smoothstep(.67,.76,p.y));
  diffuseColor.rgb *= mix(1.0,.61,sidePanel);
  float seam = 1.0-smoothstep(.011,.024,abs(abs(p.x)-.55));
  diffuseColor.rgb *= 1.0-.17*seam*(1.0-smoothstep(.66,.74,p.y));
  float sleeveHem = smoothstep(.85,.94,abs(p.x));
  diffuseColor.rgb *= 1.0-.43*sleeveHem;
  if (uniformRole > 1.5 && p.z > .18) {
   vec2 badge = abs(p.xy-vec2(.25,.77));
   float badgeMask = 1.0-smoothstep(.94,1.04,max(badge.x/.091,badge.y/.084));
   float border = 1.0-smoothstep(.72,.8,max(badge.x/.091,badge.y/.084));
   float lines = (1.0-smoothstep(.005,.013,abs(badge.y-.026))) * step(badge.x,.051);
   diffuseColor.rgb = mix(diffuseColor.rgb,mix(vec3(.65,.67,.65),vec3(.026,.035,.045),border),badgeMask);
   diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.61,.63,.64),lines*badgeMask);
  }
 `,
 shorts: `
  float seam = 1.0-smoothstep(.04,.10,abs(abs(p.x)-.87));
  diffuseColor.rgb = mix(diffuseColor.rgb,diffuseColor.rgb*.7+vec3(.035),seam);
 `,
 socks: `
  float band = smoothstep(.73,.76,p.y)*(1.0-smoothstep(.80,.83,p.y));
  diffuseColor.rgb = mix(diffuseColor.rgb,diffuseColor.rgb*.55+vec3(.045),band);
 `,
};

function gloveWeights(mesh){
 if(!mesh.isSkinnedMesh)return null;
 const {skinIndex,skinWeight}=mesh.geometry.attributes;
 if(!skinIndex||!skinWeight)return null;
 const joints=mesh.skeleton.bones.map(b=>/^(hand|thumb|index|middle|ring|pinky)_/.test(b.name));
 const weights=new Float32Array(skinIndex.count);
 for(let i=0;i<weights.length;i++){
  for(let j=0;j<4;j++){
   if(joints[skinIndex.getComponent(i,j)])weights[i]+=skinWeight.getComponent(i,j);
  }
 }
 return weights.some(w=>w>.55)?weights:null;
}

export function addUniformDetail(mesh,yamal=false){
 const material=mesh.material;
 const name=material.name.toLowerCase();
 const kind=/jersey|shirt|kit/.test(name)?'jersey':/short/.test(name)?'shorts':/sock/.test(name)?'socks':null;
 const weights=/skin|face_reference/.test(name)?gloveWeights(mesh):null;
 if(!kind&&!weights)return;

 const role={value:0};
 material.userData.uniformRole=role;
 mesh.geometry.computeBoundingBox();
 const box=mesh.geometry.boundingBox;
 const size=box.getSize(new THREE.Vector3());
 const center=box.getCenter(new THREE.Vector3());
 const origin={value:new THREE.Vector3(center.x,box.min.y,center.z)};
 const scale={value:new THREE.Vector3(Math.max(size.x*.5,.01),Math.max(size.y,.01),Math.max(size.z*.5,.01))};
 if(weights){
  mesh.geometry=mesh.geometry.clone();
  mesh.geometry.setAttribute('gloveWeight',new THREE.BufferAttribute(weights,1));
 }
 const stripedJersey=yamal&&kind==='jersey';
 material.customProgramCacheKey=()=> 'football-kit-'+(kind||'glove')+(stripedJersey?'-yamal':'');
 material.onBeforeCompile=shader=>{
  shader.uniforms.uniformRole=role;
  shader.uniforms.uniformOrigin=origin;
  shader.uniforms.uniformScale=scale;
  const gloveVertex=weights?'attribute float gloveWeight; varying float vGloveWeight;':'';
  const gloveFragment=weights?'varying float vGloveWeight;':'';
  shader.vertexShader=`uniform vec3 uniformOrigin, uniformScale;
   uniform float uniformRole; varying vec3 vUniformPosition; ${gloveVertex}
  `+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vUniformPosition=(position-uniformOrigin)/uniformScale;
   ${weights?`vGloveWeight=gloveWeight;
    transformed+=normal*.004*smoothstep(.35,.82,gloveWeight)*step(.5,uniformRole)*(1.0-step(1.5,uniformRole));`:''}
  `);
  shader.fragmentShader=`uniform float uniformRole; varying vec3 vUniformPosition; ${gloveFragment}
  `+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec3 p=vUniformPosition;
   ${stripedJersey?`
    if(uniformRole<.5){
     float stripe=smoothstep(.40,.60,fract((p.x+.08)*7.0));
     diffuseColor.rgb=mix(vec3(.028,.070,.27),vec3(.39,.024,.061),stripe);
     if(p.z<-.30){
      vec2 q=vec2(-p.x,p.y-.55);
      float one=step(abs(q.x+.108),.017)*step(abs(q.y),.115);
      vec2 oval=(q-vec2(.072,0.0))/vec2(.072,.115);
      float zero=1.0-smoothstep(.13,.21,abs(length(oval)-.79));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.91,.72,.32),max(one,zero));
     }
    }
   `:''}
   ${kind?kitDetail[kind]:`
    float glove=smoothstep(.34,.58,vGloveWeight)*step(.5,uniformRole)*(1.0-step(1.5,uniformRole));
    float cuff=1.0-smoothstep(.54,.76,vGloveWeight);
    vec3 padding=mix(vec3(.34,.40,.43),vec3(.032,.054,.071),cuff);
    diffuseColor.rgb=mix(diffuseColor.rgb,padding,glove);
   `}
  `);
 };
}
