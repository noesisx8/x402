import type { VendingService } from "./types";
export type Schema = Record<string, unknown>;
const text = { type: "string" };
const number = { type: "number" };
const object = { type: "object", additionalProperties: true };
const bool = { type: "boolean" };
const array = { type: "array", items: {} };
const nullableText = { type: ["string", "null"] };
const integer = (minimum: number, maximum: number, value: number): Schema => ({ type: "integer", minimum, maximum, default: value });
const enums = (values: string[], value: string): Schema => ({ type: "string", enum: values, default: value });
const parameterRules: Record<string, Record<string, Schema>> = {
  weather: { city: { ...text, minLength: 1, maxLength: 200, default: "London" } },
  "crypto-prices": { ids: { ...text, minLength: 1, maxLength: 1000, default: "bitcoin,ethereum" } },
  "qr-code": { data: { ...text, minLength: 1, maxLength: 2048 }, size: integer(128,512,256) },
  "tls-cert": { port: { ...integer(443,8443,443), enum: [443,8443] } },
  "fx-rate": { base: { ...text, pattern: "^[A-Za-z]{3}$", default: "USD" }, symbols: { ...text, minLength: 1, maxLength: 200, default: "EUR,GBP,JPY" } },
  "redirect-trace": { max_hops: integer(1,10,10) },
  "dns-records": { types: { ...text, pattern: "^(A|AAAA|MX|TXT|NS|CNAME)(,(A|AAAA|MX|TXT|NS|CNAME)){0,5}$", default: "A,AAAA,MX,TXT,NS" } },
  "http-get": { max_bytes: integer(1024,48000,48000) },
  "fetch-text": { max_chars: integer(500,20000,12000), format: enums(["text","markdown","structured"],"text") },
  "kronos-forecast": { symbol: enums(["BTCUSDT","ETHUSDT"],"BTCUSDT"), interval: enums(["15m","1h","4h"],"1h"), lookback: integer(16,256,64), pred_len: integer(1,24,6), model: enums(["mini"],"mini") },
};
const outputs: Record<string, Record<string, Schema>> = {
  "email-validate": { email:text,valid_format:bool,domain:nullableText,likely_disposable:bool,has_mx:bool,null_mx:bool,mx:array,mx_source:nullableText,mx_ms:number },
  "ip-lookup": {ip:text,country:nullableText,country_code:nullableText,city:nullableText,org:nullableText,asn:nullableText,source:text},
  weather: {city:text,latitude:number,longitude:number,current:object,source:text},
  "crypto-prices": {ids:{type:"array",items:text},prices:object,vs:text,include_24hr_change:bool,source:text},
  "qr-code": {data_preview:text,png_url:text,size:number,content_type:text,source:text},
  "dns-resolve": {host:text,a:array,aaaa:array,source:text,ms:number},
  "http-head": {url:text,final_url:text,status:number,ok:bool,ms:number,headers:object},
  "bundle-infra": {host:text,url:text,ms_total:number,dns:object,http_head:object,tls:object},
  "bundle-outbound": {email:object,ip:object,http_head:object,ms_total:number},
  "tls-cert": {host:text,port:number,valid:bool,protocol:nullableText,authorized:bool,authorization_error:nullableText,subject:{type:["object","null"]},issuer:{type:["object","null"]},valid_from:nullableText,valid_to:nullableText,days_until_expiry:{type:["number","null"]},fingerprint256:nullableText,ms:number},
  "whois-lite": {domain:text,registrar:nullableText,status:array,events:array,nameservers:array,source:text},
  "fx-rate": {base:text,date:nullableText,rates:object,source:text,as_of_utc:nullableText,ms:number},
  "redirect-trace": {start_url:text,final_url:text,hop_count:number,hops:array,final_status:number,ms_total:number},
  "dns-records": {host:text,records:object,source:text,ms:number},
  "http-get": {url:text,final_url:text,status:number,ok:bool,ms:number,content_type:nullableText,bytes:number,truncated:bool,body_text:nullableText,body_json:{}},
  "fetch-text": {url:text,final_url:text,status:number,ms:number,title:nullableText,text:text,chars:number,truncated:bool,source:text,retrieved_at:text,format:text,markdown:text,headings:array,links:array},
  "base-balance": {address:text,chain:text,chain_id:number,eth:text,usdc:text,block_number:text,source:text,ms:number},
  "domain-intel": {host:text,url:text,ms_total:number,dns:object,tls:object,whois:object,http_head:object,email_security:object,redirects:object,findings:array,partial:bool,checked_at:text},
  "kronos-forecast": {symbol:text,interval:text,lookback:number,pred_len:number,model_id:text,source_ohlcv:text,ms_total:number,ms_upstream:{type:["number","null"]},forecast:array,summary:{},disclaimer:text,research:object},
};
export function parameterSchema(slug: string, name: string): Schema {
  return parameterRules[slug]?.[name] ?? { ...text, minLength: 1, maxLength: name === "url" ? 2048 : 1000 };
}
export function inputSchema(service: VendingService): Schema {
  return { type:"object", properties:Object.fromEntries(service.queryParams.map(p=>[p.name,{...parameterSchema(service.slug,p.name),description:p.description}])), required:service.queryParams.filter(p=>p.required).map(p=>p.name), additionalProperties:false,
    ...(["bundle-infra","domain-intel"].includes(service.slug) ? { anyOf:[{required:["host"]},{required:["url"]}] } : {}) };
}
export function outputSchema(service: VendingService): Schema {
  if (!outputs[service.slug]) throw new Error(`missing_output_contract: ${service.slug}`);
  return {type:"object",properties:{service:{type:"string",const:service.slug},ok:bool,...outputs[service.slug]},required:["service","ok"],additionalProperties:true};
}
/** Normalize query transport strings for the shared schema; handlers retain strings. */
export function typedQuery(service: VendingService, query: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(query).map(([name,value])=>[name,parameterSchema(service.slug,name).type === "integer" && typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value]));
}
