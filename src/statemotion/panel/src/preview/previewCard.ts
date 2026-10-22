// Original explanatory endpoint previews in canonical units.
import {canonicalDefault} from '../domain/parameterValues.ts';
import type {StateMotionPreset} from '../domain/presetSchema.ts';
function number(p:StateMotionPreset,id:string):number{const value=p.parameters[id]??canonicalDefault(id);return typeof value==='number'&&Number.isFinite(value)?value:0;}
function position(p:StateMotionPreset,state:'a'|'b'):{x:number;y:number}{const value=p.parameters['transform.position.'+state];return value&&typeof value==='object'?value:{x:.5,y:.5};}
const rounded=(value:number)=>Number(value.toFixed(6));
export function describePresetMotion(p:StateMotionPreset):string{
 const a=position(p,'a'),b=position(p,'b'),parts:string[]=[];
 if(a.x!==b.x||a.y!==b.y)parts.push('position change');
 const sx=number(p,'transform.scaleX.b'),sy=number(p,'transform.scaleY.b');
 if(sx!==1||sy!==1)parts.push(`scale ${sx.toFixed(2)}x/${sy.toFixed(2)}x`);
 const rotation=number(p,'transform.rotation.b')*180/Math.PI;
 if(rotation)parts.push(`rotate ${rounded(rotation)}°`);
 const opacityA=number(p,'transform.opacity.a'),opacityB=number(p,'transform.opacity.b');
 if(opacityA!==opacityB)parts.push(`opacity ${rounded(opacityA*100)}→${rounded(opacityB*100)}%`);
 return parts.join(', ')||'static';
}
export function renderPreviewSvg(p:StateMotionPreset):string{
 const endpoint=(state:'a'|'b')=>{
  const point=position(p,state),sx=number(p,'transform.scaleX.'+state),sy=number(p,'transform.scaleY.'+state);
  const width=34*Math.abs(sx),height=34*Math.abs(sy),rotation=rounded(number(p,'transform.rotation.'+state)*180/Math.PI);
  const opacity=state==='a'?.35:Math.min(1,Math.max(0,number(p,'transform.opacity.b')));
  return `<g transform="translate(${rounded(60+(point.x-.5)*60)} ${rounded(45+(point.y-.5)*45)}) rotate(${rotation})" opacity="${opacity.toFixed(2)}"><rect x="${-width/2}" y="${-height/2}" width="${width}" height="${height}" rx="4" fill="${state==='a'?'none':'#36C5D6'}" stroke="${state==='a'?'#a3abb8':'none'}"/></g>`;
 };
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90" role="img" aria-label="${escapeXml(p.name)}: ${escapeXml(describePresetMotion(p))}"><rect width="120" height="90" fill="#1b1d21"/>${endpoint('a')}${endpoint('b')}<text x="6" y="84" fill="#cfd3d8" font-size="9">${escapeXml(p.name)}</text></svg>`;
}
function escapeXml(value:string):string{return value.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));}
