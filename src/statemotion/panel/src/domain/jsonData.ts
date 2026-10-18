// StateMotion persisted models contain JSON values only; no browser clone API required.
export function cloneJson<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}
