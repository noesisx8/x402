type CallLog = {
  slug: string;
  ok: boolean;
  ms: number;
  error?: string;
  at: string;
};

const MAX = 500;
const buffer: CallLog[] = [];

export async function logCall(partial: Omit<CallLog, "at">) {
  buffer.push({ ...partial, at: new Date().toISOString() });
  if (buffer.length > MAX) buffer.shift();
}

export function getRecentAnalytics(limit = 50): CallLog[] {
  return buffer.slice(-limit).reverse();
}