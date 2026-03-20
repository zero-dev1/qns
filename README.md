# QNS - QF Name Service

A decentralized naming service built on QF Network using Substrate and the Revive pallet for PolkaVM smart contracts.

## Overview

QNS (QF Name Service) allows users to register human-readable names (like `alice.qf`) that resolve to addresses on the QF Network. It consists of three contracts:

- **QNSRegistry**: Stores ownership and expiration information
- **QNSRegistrar**: Handles registration, renewal, and pricing
- **QNSResolver**: Provides forward and reverse resolution

All contracts are written in Solidity and compiled to PolkaVM via the Revive compiler.

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS, Framer Motion, Zustand for state
- **Blockchain**: Substrate-based QF Network with pallet-revive
- **Smart Contracts**: Solidity → PolkaVM via resolc (Revive compiler)
- **Chain interaction**: polkadot-api (PAPI) — not @polkadot/api
- **Wallets**: Talisman, SubWallet via polkadot-api/pjs-signer
- **ABI encoding**: viem (encodeFunctionData/decodeFunctionResult only — no viem RPC client)

## How It Works (for builders)

QF Network uses a Substrate + Solidity model. Here's how it works in plain terms:

- **Smart contracts** are written in Solidity and compiled with `resolc` (the Revive compiler) to PolkaVM bytecode
- These contracts run inside the Revive pallet on a Substrate-based chain
- The **frontend does NOT use MetaMask, ethers RPC, or viem RPC**
- Instead:
  - **Read calls** use `typedApi.apis.ReviveApi.call()`
  - **Write calls** use `typedApi.tx.Revive.call().signAndSubmit()`
- Users connect via **Talisman/SubWallet** (Polkadot wallets)
- A one-time `map_account` links their SS58 address to an on-chain EVM address
- **ABI encoding/decoding** uses viem utilities — the ABI JSON is identical to standard Solidity ABIs

---

## Contract Deployment

### Prerequisites

1. **Node.js** (v18+) and npm
2. **Revive Compiler (resolc)**: Install from [paritytech/revive](https://github.com/paritytech/revive)
3. **QF Account**: With testnet/mainnet QF tokens for gas

### Deployment Flow

#### 1. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your values
nano .env
```

Required environment variables:

```env
QF_RPC_URL=wss://rpc.qfnetwork.io
DEPLOYER_MNEMONIC="your twelve word mnemonic phrase here"
```

#### 2. Compile Solidity → PolkaVM

```bash
# Compile a contract
./scripts/compile-revive.sh contracts/QNSRegistrar.sol

# Or with custom output name
./scripts/compile-revive.sh contracts/QNSRegistry.sol QNSRegistry
```

This will:
- Run resolc (Revive compiler) targeting PolkaVM architecture
- Generate `.polkavm` bytecode for deployment
- Generate `.abi` and `.bin` files
- Copy the ABI to `src/abi/` for frontend use

#### 3. Deploy Contract

```bash
# Deploy using the compiled bytecode
npx ts-node scripts/deploy-substrate.ts
```

The deploy script will:
- Connect to QF Network via WebSocket
- Load the deployer account from mnemonic
- Read the PolkaVM bytecode and ABI
- Submit `revive.instantiate` extrinsic
- Wait for finalization
- Output the deployed contract address

#### 4. Update Contract Addresses

After deployment, update the contract addresses in:

```typescript
// src/config/contracts.ts
export const QNS_REGISTRAR_ADDRESS = '0xYOUR_DEPLOYED_ADDRESS';
export const QNS_RESOLVER_ADDRESS = '0xYOUR_DEPLOYED_ADDRESS';
```

### Full Deploy Flow Summary

```bash
# Step 1: Compile
./scripts/compile-revive.sh contracts/QNSRegistrar.sol

# Step 2: Deploy
npx ts-node scripts/deploy-substrate.ts

# Step 3: Update CONTRACT_ADDRESS in src/config/contracts.ts
# Copy the deployed address from the output

# Step 4: (Optional) Verify on explorer
# https://explorer.qfnetwork.io/contract/YOUR_ADDRESS
```

### Contract Deployment Order

For a fresh deployment, deploy in this order:

1. **QNSRegistry** - Core registry contract (no dependencies)
2. **QNSResolver** - Resolver implementation (no dependencies)  
3. **QNSRegistrar** - Main registrar (may depend on Registry)

### Troubleshooting

**"Revive compiler not found"**
```bash
# Build from source
git clone https://github.com/paritytech/revive
cd revive
cargo build --release
# Add target/release/revive to your PATH
```

**"Insufficient balance"**
- Get testnet tokens from the QF Network faucet
- Or check your mainnet balance

**"Contract deployment failed"**
- Check gas limit in .env (default: 100000000000)
- Verify bytecode file exists in output/
- Ensure ABI file is valid JSON

---

## Development

### Install Dependencies

```bash
npm install
```

**Note:** Before the first build, you must run:
```bash
npx papi generate
```
This generates the chain descriptors required for polkadot-api.

### Run Development Server

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

---

## Project Structure

```
src/
  utils/
    contractCall.ts    # Read/write helpers for contract interaction
    wallet.ts          # Polkadot wallet connection (Talisman/SubWallet)
    qns.ts             # QNS client functions
    accountMapping.ts  # SS58↔EVM address mapping utilities
  config/
    contracts.ts       # Deployed contract addresses
  abi/                 # Solidity ABIs for contract interaction
contracts/             # Solidity source files
```
