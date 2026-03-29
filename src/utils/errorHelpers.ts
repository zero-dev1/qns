const RETRYABLE_PATTERNS = [
  'BadProof',
  'Priority is too low',
  'Transaction is outdated',
  'Transaction has a bad signature',
  '1010:',        // substrate error code prefix for BadProof
  '1014:',        // substrate error code for Priority
  'WouldBlock',
  'AncientBirthBlock',  // stale mortal era — birth block pruned from node's hash window
  'ExhaustsResources',  // gas_limit exceeds block weight — retry with lower gas
];

export function isRetryableError(message: string | undefined | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return RETRYABLE_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

export const RETRY_MESSAGE = "Almost there! The network needs one more try. Tap below to send again — no extra cost until it goes through.";
export const RETRY_MESSAGE_SHORT = "Network hiccup — just tap to try again!";
