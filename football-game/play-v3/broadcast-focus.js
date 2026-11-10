import * as THREE from 'three';
import {BokehShader} from './vendor/shaders/BokehShader.js';

// Real scene depth keeps the subject sharp while the distant terraces fall out of focus.
export class BroadcastFocus {
 constructor(renderer,scene,camera){
  this.renderer=renderer;this.scene=scene;this.camera=camera;
  this.color=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});
  this.depth=new THREE.WebGLRenderTarget(1,1);
  this.depthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
  this.uniforms=THREE.UniformsUtils.clone(BokehShader.uniforms);
  Object.assign(this.uniforms.tColor,{value:this.color.texture});Object.assign(this.uniforms.tDepth,{value:this.depth.texture});
  this.uniforms.aperture.value=.003;this.uniforms.maxblur.value=.018;
  this.uniforms.nearClip.value=camera.near;this.uniforms.farClip.value=camera.far;
  const shader=BokehShader.fragmentShader.replace('gl_FragColor.a = 1.0;','gl_FragColor.a = 1.0;\n#include <tonemapping_fragment>\n#include <colorspace_fragment>');
  this.material=new THREE.ShaderMaterial({defines:{...BokehShader.defines},uniforms:this.uniforms,vertexShader:BokehShader.vertexShader,fragmentShader:shader,depthTest:false,depthWrite:false});
  this.screen=new THREE.Scene();this.screen.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material));this.screenCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 }
 resize(w,h){const scale=Math.min(1.5,this.renderer.getPixelRatio());this.color.setSize(Math.round(w*scale),Math.round(h*scale));this.depth.setSize(Math.round(w*scale),Math.round(h*scale));this.uniforms.aspect.value=w/h}
 render(focus){
  const r=this.renderer,s=this.scene,background=s.background,clear=r.getClearColor(new THREE.Color()),alpha=r.getClearAlpha(),shadowUpdate=r.shadowMap.autoUpdate;
  this.uniforms.focus.value=this.camera.position.distanceTo(focus);
  r.setRenderTarget(this.color);r.clear();r.render(s,this.camera);
  s.overrideMaterial=this.depthMaterial;s.background=null;r.setClearColor(0xffffff,1);r.shadowMap.autoUpdate=false;r.setRenderTarget(this.depth);r.clear();r.render(s,this.camera);
  s.overrideMaterial=null;s.background=background;r.setClearColor(clear,alpha);r.shadowMap.autoUpdate=shadowUpdate;r.setRenderTarget(null);r.render(this.screen,this.screenCamera);
 }
}
