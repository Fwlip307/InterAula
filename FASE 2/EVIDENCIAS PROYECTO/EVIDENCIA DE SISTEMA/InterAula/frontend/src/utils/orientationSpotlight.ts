export interface SpotlightRect {left:number;top:number;width:number;height:number}
export type SpotlightPlacement='bottom'|'top'|'right'|'left'|'overlap'|'center';
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(n,Math.max(min,max)));
export function positionOrientationTour(rect:SpotlightRect|null,viewport:{width:number;height:number},measuredHeight=430){
 const margin=12,gap=16,width=Math.max(0,Math.min(360,viewport.width-margin*2));
 const fullHeight=Math.max(0,viewport.height-margin*2),height=Math.min(measuredHeight,fullHeight);
 if(!rect||rect.top+rect.height<=0||rect.top>=viewport.height||rect.left+rect.width<=0||rect.left>=viewport.width)
  return {left:margin+(viewport.width-margin*2-width)/2,top:clamp((viewport.height-height)/2,margin,viewport.height-height-margin),width,maxHeight:fullHeight,placement:'center' as SpotlightPlacement,arrow:0,hole:null};
 const left=clamp(rect.left-7,4,viewport.width-4),top=clamp(rect.top-7,4,viewport.height-4);
 const right=clamp(rect.left+rect.width+7,left,viewport.width-4),bottom=clamp(rect.top+rect.height+7,top,viewport.height-4);
 const hole={left,top,width:Math.max(0,right-left),height:Math.max(0,bottom-top)};
 const below=viewport.height-bottom-gap-margin,above=top-gap-margin;
 const onRight=viewport.width-right-gap-margin,onLeft=left-gap-margin;
 let placement:SpotlightPlacement='overlap',x=clamp(left,margin,viewport.width-width-margin),y=clamp(bottom+gap,margin,viewport.height-height-margin),maxHeight=fullHeight;
 if(below>=height){placement='bottom';y=bottom+gap;maxHeight=below;}
 else if(above>=height){placement='top';y=top-gap-height;maxHeight=above;}
 else if(onRight>=width){placement='right';x=right+gap;y=clamp(top,margin,viewport.height-height-margin);}
 else if(onLeft>=width){placement='left';x=left-gap-width;y=clamp(top,margin,viewport.height-height-margin);}
 else if(Math.max(below,above)>=220){
  if(below>=above){placement='bottom';maxHeight=below;y=bottom+gap;}
  else{placement='top';maxHeight=above;y=margin;}
 }
 const arrow=placement==='bottom'||placement==='top'?clamp(left+hole.width/2-x,24,width-24):clamp(top+Math.min(hole.height/2,90)-y,24,Math.min(height,maxHeight)-24);
 return {left:x,top:y,width,maxHeight:Math.max(0,maxHeight),placement,arrow,hole};
}
