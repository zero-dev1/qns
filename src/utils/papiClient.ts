import { createClient, type PolkadotClient, type TypedApi } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider";
import { qf } from "@polkadot-api/descriptors";

export function watchConnectionStatus(callback: (connected: boolean) => void) {
  const client = getClient();
  let lastSeen = Date.now();
  const sub = client.finalizedBlock$.subscribe({
    next() {
      lastSeen = Date.now();
      callback(true);
    },
    error() {
      callback(false);
    },
  });
  const interval = setInterval(() => {
    if (Date.now() - lastSeen > 30000) callback(false);
  }, 10000);
  return () => { sub.unsubscribe(); clearInterval(interval); };
}

const QF_RPC_URL = import.meta.env.VITE_QF_RPC_URL || "wss://mainnet.qfnode.net";

let client: PolkadotClient | null = null;
let typedApi: TypedApi<typeof qf> | null = null;

export function getClient(): PolkadotClient {
  if (!client) {
    client = createClient(getWsProvider(QF_RPC_URL));
  }
  return client;
}

export function getTypedApi(): TypedApi<typeof qf> {
  if (!typedApi) {
    typedApi = getClient().getTypedApi(qf);
  }
  return typedApi;
}

export function destroyClient(): void {
  if (client) {
    client.destroy();
    client = null;
    typedApi = null;
  }
}

/**
 * Fetch a fresh finalized block hash via a direct RPC call.
 * 
 * IMPORTANT: We use client._request() instead of client.getFinalizedBlock()
 * because getFinalizedBlock() relies on the finalizedBlock$ subscription,
 * which can hang indefinitely on QF Network where WS doesn't reliably
 * push new-head events. _request() is a one-shot request/response that
 * bypasses the subscription system entirely.
 * 
 * A 5-second timeout ensures we never block the signing flow.
 * Fallback is "finalized" (NOT "best" — "best" is what caused AncientBirthBlock).
 */
export async function getFreshBlockHash(): Promise<string> {
  const client = getClient();
  try {
    const hash = await Promise.race([
      client._request<string>("chain_getFinalizedHead", []),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("getFreshBlockHash timed out")), 5000)
      ),
    ]);
    if (typeof hash === "string" && hash.startsWith("0x")) {
      return hash;
    }
    return "finalized";
  } catch (e) {
    console.warn("[papiClient] getFreshBlockHash failed, falling back to 'finalized'", e);
    return "finalized";
  }
}
