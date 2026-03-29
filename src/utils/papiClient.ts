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
 * Fetch a fresh finalized block hash directly from the RPC.
 * This bypasses PAPI's potentially stale best-block subscription.
 * Used as the `at` parameter for all write transactions to prevent
 * AncientBirthBlock errors on QF Network (whose RPC doesn't reliably
 * push new-head subscription events).
 */
export async function getFreshBlockHash(): Promise<string> {
  const client = getClient();
  const block = await client.getFinalizedBlock();
  return block.hash;
}
