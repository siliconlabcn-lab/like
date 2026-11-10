export const GOAL_Z=-14,GOAL_HALF=3.66,GOAL_HEIGHT=2.44;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const GRAVITY=9.81;

export function flight(start,target,power=.65){
 const speed=13+power*13;
 const distance=Math.hypot(target.x-start.x,target.z-start.z);
 return {duration:Math.max(.06,distance/speed),start:{...start},target:{...target}};
}

export function flightPoint(f,t){
 const time=clamp(t,0,f.duration);
 const p=time/f.duration;
 return {
  x:f.start.x+(f.target.x-f.start.x)*p,
  y:f.start.y+(f.target.y-f.start.y)*p+.5*GRAVITY*time*(f.duration-time),
  z:f.start.z+(f.target.z-f.start.z)*p
 };
}

// Return the first point in a frame where the moving ball touches a collider.
export function sweptContact(from,to,center,radius){
 const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z;
 const x=from.x-center.x,y=from.y-center.y,z=from.z-center.z;
 const c=x*x+y*y+z*z-radius*radius;
 if(c<=0)return 0;
 const a=dx*dx+dy*dy+dz*dz;
 const b=x*dx+y*dy+z*dz;
 const discriminant=b*b-a*c;
 if(a===0||b>=0||discriminant<0)return null;
 const hit=(-b-Math.sqrt(discriminant))/a;
 return hit<=1?hit:null;
}

export function inGoal(p){return Math.abs(p.x)<GOAL_HALF-.12&&p.y>.1&&p.y<GOAL_HEIGHT-.12}
export function keeperReach(ball,keeperX,diving){return Math.abs(ball.x-keeperX)<(diving?1.25:.47)&&ball.y<(diving?2.3:1.7)}
export const refScenarios=[{foul:true,title:'从身后推倒对手',explain:'防守队员从背后推人，没有触到球，应判犯规。',type:'push'},{foul:false,title:'干净地抢到球',explain:'防守队员先触球，随后带球离开，没有造成犯规接触。',type:'clean'},{foul:true,title:'伸腿绊倒对手',explain:'防守队员没有碰到球，伸腿绊倒了带球队员。',type:'trip'},{foul:false,title:'合理的肩部争抢',explain:'双方在争球距离内肩对肩接触，没有推搡或拉拽，比赛继续。',type:'shoulder'}];

export function strikeRoot(ball,yaw,contact,scale=1){return{x:ball.x-scale*(contact.x*Math.cos(yaw)+contact.z*Math.sin(yaw)),y:0,z:ball.z-scale*(-contact.x*Math.sin(yaw)+contact.z*Math.cos(yaw))}}

// Shuffle once per match so replay and judging share the same scenario.
export function randomRefScenarios(random=Math.random){
  const scenarios=[...refScenarios];
  for(let i=scenarios.length-1;i>0;i--){
    const j=Math.floor(random()*(i+1));
    [scenarios[i],scenarios[j]]=[scenarios[j],scenarios[i]];
  }
  return scenarios;
}
