import { getClient } from "./papiClient";
import { callContract } from "./contractCall";
import { QNS_REGISTRAR_ADDRESS, QNS_REGISTRAR_ABI } from "../config/contracts";
import { checkAvailability } from "./qns";

export async function testPapiConnection() {
  console.log("[TEST] Connecting to QF mainnet via PAPI...");

  try {
    const client = getClient();
    const finalized = await client.getFinalizedBlock();
    console.log("[TEST] Connected! Finalized block:", finalized.number, finalized.hash);
  } catch (e: any) {
    console.error("[TEST] Connection failed:", e.message);
    return;
  }

  // Test 1: Read price3Char using the fixed callContract
  console.log("[TEST] Reading price3Char via callContract...");
  try {
    const price = await callContract(
      QNS_REGISTRAR_ADDRESS,
      QNS_REGISTRAR_ABI as unknown as any[],
      "price3Char"
    );
    console.log("[TEST] price3Char SUCCESS:", price?.toString());
  } catch (e: any) {
    console.error("[TEST] price3Char FAILED:", e.message);
  }

  // Test 2: Check availability
  console.log("[TEST] Checking availability of 'testname123'...");
  try {
    const available = await checkAvailability("testname123");
    console.log("[TEST] availability SUCCESS:", available);
  } catch (e: any) {
    console.error("[TEST] availability FAILED:", e.message);
  }

  console.log("[TEST] All tests complete.");
}
