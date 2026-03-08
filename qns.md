# QNS Technical Specification Guide v1.0

## 1. Overview

QNS (Quantum Name Service) is the naming and identity layer for the Quantum Fusion (QF) blockchain. It allows users to register human-readable .qf names (e.g., alice.qf) that resolve to wallet addresses and store profile metadata. QNS replaces QFLink's existing profile name system and serves as the universal identity primitive for all QF ecosystem dApps.

QNS consists of three Solidity smart contracts deployed on QF's EVM layer via resolc, a frontend registration widget embedded in QFLink's onboarding flow, a display resolution system throughout QFLink's UI, and a standalone QNS landing page for direct name registration and management.

QNS is a standalone product with its own domain, branding, and deployment, separate from QFLink but deeply integrated with it.

## 2. Economic Model

### Token Economics

Post-migration, 1 QF is approximately $0.01 USD. All prices are denominated in QF and paid via msg.value. Prices are admin-adjustable to account for QF token price movement over time. The target is to keep standard name registration around $1 USD equivalent regardless of QF price fluctuations — admin adjusts QF-denominated prices periodically to maintain accessibility.

### Registration Pricing

Annual registration:
- 3-character names: 1,000 QF/year (~$10)
- 4-character names: 300 QF/year (~$3)
- 5+ character names: 100 QF/year (~$1)

Permanent registration (15x annual):
- 3-character names: 15,000 QF one-time (~$150)
- 4-character names: 4,500 QF one-time (~$45)
- 5+ character names: 1,500 QF one-time (~$15)

Multi-year annual registration is supported. A user can pay for multiple years upfront by multiplying the annual price by the number of years in a single transaction.

### Revenue Split

95% of all registration and renewal fees are kept in the contract for treasury withdrawal. 5% of all fees are burned by sending to a burn address. This burn percentage starts low intentionally to maximize QF accumulation in the treasury during the early ecosystem phase. The burn percentage is admin-adjustable and will increase over time as the ecosystem matures — planned schedule is 5% at launch, 10% after 1,000 names registered or post-CEX listing, 25% once QF reaches higher market cap milestones. This progressive burn schedule is part of the public roadmap.

### Treasury

The treasury is a dedicated address separate from the deployer's personal wallet. The deployer is the sole controller of the treasury at launch. A withdraw function on the registrar allows the admin to move accumulated fees from the contract to the treasury address. The treasury is an accumulation vehicle — the primary strategy is to hold QF tokens in treasury long-term, not to withdraw and sell.

## 3. Smart Contract Architecture

### 3.1 QNSRegistry.sol

This is the core ownership ledger. It maps namehashes to owners and resolvers. It is intentionally minimal because it holds all ownership state and should never need redeployment.

#### Namehash Algorithm

QNS uses the same namehash algorithm as ENS (EIP-137). The namehash of "alice.qf" is computed as keccak256(keccak256(keccak256(0x0, keccak256("qf")), keccak256("alice"))). The root node is bytes32(0). The .qf node is the namehash of "qf" under the root. All user names are subnodes under the .qf node. Namehash computation happens off-chain in the frontend. The contracts operate on bytes32 namehashes only.

#### Storage

A struct called Record containing: address owner, address resolver. A mapping from bytes32 (the node/namehash) to Record. The .qf root node is owned by the registrar contract so that only the registrar can create new names under .qf.

#### Functions

**setOwner(bytes32 node, address newOwner)** — transfers ownership of a node. Only callable by the current owner of that node. Emits a Transfer event with the node and new owner.

**setResolver(bytes32 node, address resolverAddress)** — sets the resolver contract for a node. Only callable by the node owner. Emits a NewResolver event with the node and resolver address.

**setSubnodeOwner(bytes32 node, bytes32 labelHash, address newOwner)** — creates or transfers a subnode. Computes the subnode hash as keccak256(node, labelHash). Only callable by the owner of the parent node. Emits a NewOwner event. This is how the registrar creates new name registrations — it calls setSubnodeOwner on the .qf node for each new name.

**owner(bytes32 node)** — view function, returns the owner address for a node.

**resolver(bytes32 node)** — view function, returns the resolver address for a node.

#### Access Control

Only the owner of a node can modify that node's owner or resolver. The .qf root node is owned by the registrar contract. The deployer sets this up during deployment.

### 3.2 QNSRegistrar.sol

This handles registration logic, pricing, payments, expiry, renewal, reserved names, and admin functions. It is the only contract that accepts QF payments.

#### Storage

A struct called Registration containing: address owner, uint256 expires (timestamp, 0 if permanent), uint256 registeredAt (timestamp). A mapping from bytes32 (labelHash of the name, i.e., keccak256("alice")) to Registration. A mapping of reserved names stored as labelHashes mapped to bool. Admin address (the deployer). Treasury address. Burn address. Pricing variables: uint256 price3Char, uint256 price4Char, uint256 price5PlusChar, uint256 permanentMultiplier. Burn percentage variable: uint256 burnPercent (initially 5). The default resolver address (set at deployment, pointing to QNSResolver).

#### Registration Flow

**register(string name, uint256 durationInYears, bool permanent)** — payable function.

1. Validates the name: must be 3+ characters, max 64 characters, alphanumeric and hyphens only, no leading or trailing hyphens, converted to lowercase.
2. Checks that the name is not reserved by looking up the labelHash in the reserved mapping.
3. Checks that the name is not currently registered (either never registered, or expired past grace period).
4. Computes the required fee based on name length, duration, and whether permanent.
5. Verifies msg.value >= required fee.
6. Records the registration: owner = msg.sender, expires = block.timestamp + (durationInYears * 365 days) or 0 if permanent, registeredAt = block.timestamp.
7. Calls QNSRegistry.setSubnodeOwner on the .qf node — registrar temporarily owns the node.
8. Calls QNSRegistry.setResolver on the new node to set the default resolver.
9. Calls QNSResolver.setAddr, QNSResolver.setName, and QNSResolver.setReverse to set forward resolution, plaintext name, and reverse resolution.
10. Calls QNSRegistry.setOwner to transfer the node to the registrant.
11. Splits payment: burnPercent% to burn address, remainder kept in contract for treasury withdrawal.
12. Refunds excess if msg.value > fee.
13. Emits NameRegistered(string name, bytes32 indexed labelHash, address indexed owner, uint256 expires, uint256 fee).

Note: This registration function makes six external calls. This is the function most likely to cause gas issues during testing. If gas limits or unexpected reverts occur, the first debugging step is to check this function. A potential simplification is combining resolver operations into a single batch function on the resolver contract.

#### Renewal

**renew(string name, uint256 durationYears)** — payable function.

1. Only works for non-permanent registrations.
2. Name must be registered and not expired past grace period.
3. Anyone can renew any name (allows gifting renewals).
4. Computes renewal fee same as registration pricing.
5. Extends expiry from the current expiry timestamp (not from now), so early renewal doesn't lose time. If expired but within grace period, extends from block.timestamp.
6. Splits payment per burnPercent, refunds excess.
7. Emits NameRenewed(string name, bytes32 indexed labelHash, uint256 newExpiry, uint256 fee).

#### Availability Check

**available(string name)** — view function. Returns true if the name is not reserved and either not registered or expired past the grace period.

#### Expiry and Grace Period

When a name's expires timestamp passes, the name enters a 30-day grace period. During grace period, only the original owner can renew. After grace period (expires + 30 days), the name becomes available for anyone to register. Permanent registrations (expires == 0) never expire.

#### Reserved Names

A mapping from bytes32 (labelHash) to bool indicating reserved status.

**reserveName(string name)** — admin only. Marks a name as reserved.

**unreserveName(string name)** — admin only. Removes the reservation.

**assignReservedName(string name, address to)** — admin only. Registers a reserved name to the specified address without payment. Sets reserved to false after assignment. Follows the same registration flow as register() but skips payment validation.

Initial reserved list: qflink, qfpad, qfclash, qfstream, nucleusx, quantumnotary, quantum, fusion, quantumfusion, qf, dapp, bridge, governance, admin, treasury, validator, node, swap, stake, pool, vault, dao, nft, token, wallet, vector, nucleus.

#### Admin Functions

All require msg.sender == admin.

- **setPrice(uint256 new3, uint256 new4, uint256 new5Plus)** — updates pricing tiers.
- **setPermanentMultiplier(uint256 newMult)** — updates permanent pricing multiplier (default 15).
- **setBurnPercent(uint256 newPercent)** — updates burn percentage. Must be between 0 and 50. Allows progressive increase per the public burn roadmap.
- **setTreasury(address newTreasury)** — updates treasury address.
- **setBurnAddress(address newBurn)** — updates burn address.
- **withdrawToTreasury()** — transfers contract's QF balance to treasury address.
- **setDefaultResolver(address newResolver)** — updates default resolver for new registrations.
- **setAdmin(address newAdmin)** — transfers admin role.

#### Transfer

**transferName(string name, address newOwner)** — callable by current name owner only. Updates registration owner, updates QNSRegistry node owner, updates forward and reverse resolution records (new owner gets the address record, old owner's reverse record is cleared, new owner's reverse record is set). Remaining registration duration transfers with the name. Emits NameTransferred(string name, address indexed from, address indexed to).

### 3.3 QNSResolver.sol

This stores resolution data — forward (name to address), reverse (address to name), and text records.

#### Storage

- Forward resolution: mapping(bytes32 => address) called addresses — alice.qf namehash maps to 0x6f3a...
- Reverse resolution: mapping(address => bytes32) called reverseNodes — 0x6f3a... maps to alice.qf namehash.
- Plaintext names: mapping(bytes32 => string) called names — namehash maps to "alice" for display.
- Text records: mapping(bytes32 => mapping(string => string)) called texts — namehash maps to key-value pairs.

Standard text record keys at launch: "avatar" (URL to profile image), "bio" (free text), "twitter" (handle), "github" (username), "url" (website), "discord" (handle).

#### Access Control

Internal function isAuthorized(bytes32 node) returns true if msg.sender is the node owner per QNSRegistry OR msg.sender is in the authorizedCallers mapping. The contract deployer can add/remove authorized callers (the registrar needs to be an authorized caller).

#### Functions

**setAddr(bytes32 node, address addr)** — requires isAuthorized(node). Sets addresses[node] = addr. Emits AddrChanged(bytes32 indexed node, address addr).

**addr(bytes32 node)** — public view. Returns addresses[node]. This is the primary function QFLink and other dApps call for forward resolution.

**setReverse(address addr, bytes32 node)** — requires msg.sender == addr OR authorized caller. Sets reverseNodes[addr] = node.

**clearReverse(address addr)** — requires msg.sender == addr OR authorized caller. Deletes reverseNodes[addr].

**setName(bytes32 node, string name)** — requires isAuthorized(node). Sets names[node] = name.

**name(bytes32 node)** — public view. Returns names[node].

**reverseResolve(address addr)** — public view. Gets node from reverseNodes[addr]. If node is bytes32(0), returns empty string. Otherwise returns string(abi.encodePacked(names[node], ".qf")).

**nameHash(address addr)** — public view. Returns reverseNodes[addr].

**setText(bytes32 node, string key, string value)** — requires isAuthorized(node). Sets texts[node][key] = value. Emits TextChanged(bytes32 indexed node, string key, string value).

**text(bytes32 node, string key)** — public view. Returns texts[node][key].

**addAuthorizedCaller(address caller)** — deployer only. Adds authorized caller.

**removeAuthorizedCaller(address caller)** — deployer only. Removes authorized caller.

## 4. QFLink Integration Specification

### 4.1 Replacing the Profile Name System

QFLink currently has a profile name system where users set a profile name on registration. This is being replaced entirely by QNS. QFLink's Registry contract (QFLinkRegistry) stays — it tracks "is this wallet a QFLink user" and gates app access. But display identity is no longer stored in QFLink. The profileName field in QFLink's registry becomes unused. The frontend stops reading it and reads from QNS instead. No contract migration needed.

Display priority everywhere in QFLink: QNS name if registered, otherwise truncated hex address (first 6 chars + "..." + last 4 chars). No profile name tier in between. This eliminates the duplicate profile name problem — QNS names are unique by definition.

### 4.2 Onboarding Flow

Current flow: connect wallet → register profile name → sign → enter app.

New flow: connect wallet → call QFLink Registry to check if already registered → call QNS resolver reverseResolve(walletAddress) to check for existing .qf name.

If returning user (already registered in QFLink): enter app with .qf name displayed, or hex address if no QNS name.

If new user (not registered in QFLink): show the QNS registration screen. This screen has an input field for the desired name with ".qf" shown as a fixed suffix in emerald (#00D179). On each keystroke (debounced 300-500ms), call QNS registrar available(name) to check availability. Display real-time feedback: green check if available, red X with "taken" if not. Show the price based on name length. Duration selector: 1 year, 2 years, 5 years, permanent — price updates accordingly. A "Register" button that calls QNS registrar register() with the fee as msg.value. A "Skip for now" link below the form. If they skip, they enter QFLink with hex address display. After QNS registration succeeds or is skipped, call QFLink Registry register() (existing required step). Enter app.

Two independent transactions for new users who register QNS: one to QNS registrar (optional, with payment), one to QFLink Registry (required). If they skip QNS, one transaction only — same as today.

### 4.3 Display Resolution

Create a useQNSName hook that takes an address and returns { name: string | null, loading: boolean }.

Implementation: check Zustand cache store first. If address is cached and entry is < 5 minutes old, return cached name immediately. If not cached or stale, trigger reverseResolve call, set loading true, update cache on return.

Zustand store structure: Map<address, { name: string | null, resolvedAt: number }>.

For batch resolution (pod member lists, conversation histories): create a batchResolve utility that takes an array of addresses, filters out already-cached ones, resolves the rest, and stores all results. Call this when loading a pod or conversation.

### 4.4 DM Recipient Input

The DM recipient field accepts both hex addresses and .qf names.

On submit: if input ends with ".qf", strip suffix, compute namehash, call QNS resolver addr(namehash). If non-zero address returned, use it for sendDirectMessage. If zero address returned, show error: "Name not found." If input is a valid hex address (starts with 0x, 42 characters), use directly. Otherwise show error: "Enter a valid .qf name or wallet address."

### 4.5 Profile Page

Replace profile name editing with QNS management.

If user has a .qf name: display name prominently (with .qf rendered in emerald), show editable text record fields (avatar, bio, twitter, github, url, discord) — each loads via QNSResolver.text() and saves via QNSResolver.setText() as a transaction, show expiry date and renew button for non-permanent names.

If user has no .qf name: show QNS registration widget (same component as onboarding) so they can register without leaving QFLink.

## 5. Standalone QNS Landing Page

A single-page React application with its own domain and deployment, separate from QFLink. Uses viem for contract interactions.

### Brand Identity

QNS has its own visual identity, distinct from QFLink and other QF dApps but complementary to the QF ecosystem aesthetic.

Primary accent color: Emerald #00D179. Dark background: #0A0A0A. Surface/card: #141414. Surface border: #1E1E1E. Text primary: #FFFFFF. Text secondary: #8A8A8A. Text tertiary: #555555. Error: #E5484D. Warning: #F5A623.

Typography: Clash Display (Fontshare) for headlines, Satoshi (Fontshare) for body and UI text. Dark mode only. The ".qf" suffix is always rendered in emerald wherever it appears.

Logo: "QNS" lettermark in Clash Display Semibold white with a small emerald dot after the S.

### Page Structure

Single page, no multi-page navigation. Sections from top to bottom:

Navbar with QNS logo, "My Names" link, wallet connect button.

Hero section: headline "Your identity on Quantum Fusion," subheadline describing .qf names, centered search bar with ".qf" suffix in emerald, real-time availability check with inline results showing availability, price, and register button.

How It Works section: three columns — Claim your name, Use it everywhere, Own your identity.

Ecosystem section: grid of dApp integration cards showing QFLink and QFClash as live, NucleusX, QFPad, 52F, and QF dApp Store as coming soon.

Pricing section: three-tier table (3-char, 4-char, 5+ char) showing annual and permanent prices in QF with USD equivalents. 5+ char tier highlighted as most popular.

Registration flow section: appears after selecting a name, shows duration selector, live price calculation, register button, transaction status feedback.

My Names section: wallet-gated, shows owned names with expiry, renew, edit profile records, and transfer functionality.

Footer: QNS logo, ecosystem links, "QNS is community-built infrastructure for the QF ecosystem."

Responsive: mobile (< 768px) stacks all layouts, tablet (768-1024px) two columns, desktop (> 1024px) max-width 1120px with three-column layouts.

## 6. Contract Deployment Order

1. Deploy QNSResolver.sol. Record address.
2. Deploy QNSRegistry.sol. Record address.
3. Deploy QNSRegistrar.sol with constructor params: registry address, resolver address, treasury address, burn address.
4. Post-deployment setup:
   - Call QNSRegistry.setSubnodeOwner(bytes32(0), keccak256("qf"), registrarAddress) from deployer to give registrar ownership of .qf root.
   - Call QNSResolver.addAuthorizedCaller(registrarAddress) from deployer to let registrar write records.
   - Call QNSRegistrar.reserveName() for each name in the reserved list.
5. Test by registering a name and verifying forward and reverse resolution.

Deploy to local qf-node first for testing. Deploy to mainnet after migration when post-migration token economics are live.

## 7. Security Considerations

- No delegatecall patterns — all contracts deployed directly, no proxies.
- If a contract needs upgrading, deploy new version and migrate. The registry is designed to allow this: the .qf root node can be transferred to a new registrar, and new names can point to a new resolver while old names keep their existing resolver.
- Registry is critical — keep it minimal. Registrar is most likely to need redeployment.
- Admin functions protected by single admin address. Centralized at launch. Admin role is transferable via setAdmin for future transition to multisig or governance when the ecosystem warrants it. No governance mechanisms in v1.
- Name validation must happen in the contract, not just frontend. Prevent empty strings, strings > 64 characters, invalid characters, and strings that are only hyphens.
- The register function makes six cross-contract calls. Monitor gas usage during testing. If gas limits are hit, consider combining resolver operations into a batch function.

## 8. Roadmap Considerations (Not in v1, documented for future reference)

- **Subdomains**: allow name owners to create subdomains (team.project.qf). Add when dApps express demand for branded sub-addressing.
- **NFT wrapping**: wrap .qf names as ERC-721 tokens so they appear in wallets and are tradeable on NFT marketplaces. Deploy as an additive NFT contract that reads from the existing registry — no changes to core contracts needed.
- **Progressive burn increase**: 5% at launch → 10% after 1,000 names or post-CEX listing → 25% at higher market cap milestones.
- **Governance**: transition admin to multisig, then to DAO contract when stakeholder base and treasury size warrant decentralization.
- **NucleusX integration**: .qf name resolution in DEX transfer fields. Post-launch, coordinated with Vector.
- **Name suggestions**: when a searched name is taken, suggest available alternatives (alice1.qf, alice-qf.qf). Frontend enhancement, no contract changes.
- **Off-chain DNS bridging**: resolve .qf names via traditional DNS for web2 interoperability. V2+ concern.

## 9. Testing Checklist

- Register a 3-char name → correct fee charged (1,000 QF)
- Register a 5+ char name → correct fee charged (100 QF)
- Register a permanent name → correct fee (15x annual)
- Register multi-year (e.g., 3 years) → correct fee (annual × 3)
- Register a taken name → reverts
- Register a reserved name → reverts
- Register a name with invalid characters → reverts
- Register a name with leading/trailing hyphen → reverts
- Register a name shorter than 3 characters → reverts
- Register a name longer than 64 characters → reverts
- Forward resolution returns correct address
- Reverse resolution returns correct .qf string
- Set and read text records (avatar, bio, twitter, github, url, discord)
- Transfer a name → new owner resolves, old owner's reverse cleared
- Let name expire → cannot resolve → wait past grace period → someone else can register
- Renew before expiry → expiry extends from old expiry, not from now
- Renew during grace period → expiry extends from block.timestamp
- Attempt to renew after grace period → reverts
- Attempt to renew a permanent name → reverts
- Admin assigns reserved name → recipient can resolve
- Admin adjusts pricing → new registrations use updated prices
- Admin adjusts burn percentage → new registrations use updated split
- Admin withdraws to treasury → correct balance transferred
- Revenue split: verify 95% stays in contract, 5% goes to burn address
- QFLink: type .qf name in DM field → message delivered to correct address
- QFLink: chat messages display .qf names instead of hex for registered users
- QFLink: new user onboarding shows QNS registration prompt
- QFLink: skip QNS → user enters with hex address display
- QFLink: profile page shows QNS management or registration widget
- Landing page: search, register, view My Names all functional
- Landing page: responsive on mobile, tablet, desktop
- Landing page: .qf suffix renders in emerald (#00D179) everywhere
