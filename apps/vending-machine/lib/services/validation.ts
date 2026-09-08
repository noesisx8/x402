import Ajv from "ajv";
import type { VendingService } from "./types";
import { inputSchema, outputSchema, typedQuery } from "./contracts";
const ajv = new Ajv({ strict:false, allErrors:true });
const validators = new Map<string, {input:ReturnType<Ajv["compile"]>;output:ReturnType<Ajv["compile"]>}>();
function forService(service: VendingService) {
  let pair=validators.get(service.slug);
  if (!pair) { pair={input:ajv.compile(inputSchema(service)),output:ajv.compile(outputSchema(service))}; validators.set(service.slug,pair); }
  return pair;
}
export function validInput(service: VendingService, query: Record<string,unknown>): boolean { return Boolean(forService(service).input(typedQuery(service,query))); }
export function validOutput(service: VendingService, body: Record<string,unknown>): boolean { return Boolean(forService(service).output(body)); }
