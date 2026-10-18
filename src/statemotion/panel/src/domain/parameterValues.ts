import { getBinding } from '../../../../../shared/generated/parameterBindings.ts';
import { toNative, toCanonical } from '../host/valueConversion.ts';
import type { ParameterValue, ValidationResult } from './presetSchema.ts';
export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
export function canonicalDefault(logicalId: string): ParameterValue | undefined {
  const binding=getBinding(logicalId);
  if(!binding)return undefined;
  // The schema stores ANGLE defaults in radians, POINT defaults as tokens.
  if(binding.nativeType==='POPUP'||binding.nativeType==='POINT'||binding.nativeType==='ANGLE'||binding.nativeType==='CHECKBOX')return binding.defaultVal;
  return toCanonical(logicalId,binding.defaultVal,binding);
}
export function validateParameterValues(values: unknown): ValidationResult {
  const errors:string[]=[];
  if(!isRecord(values))return {ok:false,errors:['parameters must be an object']};
  for(const [id,value] of Object.entries(values)){
    const binding=getBinding(id);
    let valid=!!binding && binding.stateOwnership!=='metadata';
    if(valid&&binding){
      switch(binding.nativeType){
        case 'POINT':valid=value==='frameCenter'||value==='sourceCenter'||
          (isRecord(value)&&typeof value.x==='number'&&Number.isFinite(value.x)&&typeof value.y==='number'&&Number.isFinite(value.y));break;
        case 'COLOR':valid=typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);break;
        case 'CHECKBOX':valid=typeof value==='boolean';break;
        case 'POPUP':{
          const count=binding.enumRef==='AlignmentMode'?3:7;
          valid=typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<count;break;
        }
        default:{
          valid=typeof value==='number'&&Number.isFinite(value);
          if(valid&&binding.nativeType==='FLOAT_SLIDER'){
            const native=toNative(id,value as number,binding) as number;
            valid=native>=binding.validMin-1e-9&&native<=binding.validMax+1e-9;
            if(id==='motionBlur.samples')valid=valid&&Number.isInteger(value);
          }
        }
      }
    }
    if(!valid)errors.push(`invalid parameter value or logical ID "${id}"`);
  }
  return {ok:errors.length===0,errors};
}
