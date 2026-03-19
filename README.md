# QNS - QF Name Service

A decentralized naming service built on QF Network using Substrate and the Revive pallet for PolkaVM smart contracts.

## Overview

QNS (QF Name Service) allows users to register human-readable names (like `alice.qf`) that resolve to addresses on the QF Network. It consists of:

- **QNSRegistry**: Stores ownership and expiration information
- **QNSRegistrar**: Handles registration, renewal, and pricing
- **QNSResolver**: Provides forward and reverse resolution

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Blockchain**: Substrate-based QF Network with Revive pallet
- **Smart Contracts**: Solidity compiled to PolkaVM via Revive compiler
- **Polkadot Integration**: @polkadot/api, @polkadot/extension-dapp

---

## Contract Deployment

### Prerequisites

1. **Node.js** (v18+) and npm
2. **Revive Compiler**: Install from [paritytech/revive](https://github.com/paritytech/revive)
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
- Run the Revive compiler targeting PolkaVM architecture
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

### Run Development Server

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

---

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable lint-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
```
