# Master Prompt: Build QNS (Quantum Name Service) for Quantum Fusion

You are building QNS (Quantum Name Service) for the Quantum Fusion (QF) blockchain. QNS is a naming service that lets users register human-readable .qf names (like alice.qf) that resolve to wallet addresses. It also stores profile metadata (avatar, bio, social links). QNS will integrate directly into QFLink, an existing on-chain encrypted messaging dApp on QF, replacing its profile name system.

## Environment and Tooling

- QF is a Substrate-based blockchain with EVM compatibility via pallet-revive.
- Smart contracts are written in Solidity 0.8.x and compiled using resolc (the Revive compiler), which compiles Solidity to PolkaVM (RISC-V based), not standard EVM bytecode.
- Deploy using Remix or Hardhat with the resolc compiler plugin.
- The chain uses native QF tokens for gas and payments. 1 QF = 10^18 wei. Payments use msg.value in wei.
- **There is no delegatecall support** — do not use proxy patterns or upgradeable contracts.
- SELFDESTRUCT is not available.
- Standard Solidity patterns (mappings, structs, events, modifiers, multi-contract interaction via interfaces) all work.
- The frontend uses React, viem for contract interactions, and Zustand for state management.

## What You Are Building

1. Three Solidity smart contracts: QNSRegistry.sol, QNSRegistrar.sol, QNSResolver.sol
2. A QFLink frontend integration that replaces the existing profile name system with QNS
3. A standalone QNS landing page for direct name registration and management

---

## Contract 1: QNSRegistry.sol

This is the core ownership ledger. It maps namehashes to owners and resolvers.

Use the ENS namehash algorithm (EIP-137). The namehash is computed recursively: namehash("") = bytes32(0), namehash("label.domain") = keccak256(abi.encodePacked(namehash("domain"), keccak256("label"))). Namehash computation happens off-chain. The contract stores and operates on bytes32 values only.

### Storage

```solidity
struct Record {
    address owner;
    address resolver;
}
mapping(bytes32 => Record) public records;
Copy
Functions
setOwner(bytes32 node, address newOwner)

Requires msg.sender == records[node].owner
Sets records[node].owner = newOwner
Emits Transfer(bytes32 indexed node, address newOwner)
setResolver(bytes32 node, address resolver)

Requires msg.sender == records[node].owner
Sets records[node].resolver = resolver
Emits NewResolver(bytes32 indexed node, address resolver)
setSubnodeOwner(bytes32 node, bytes32 labelHash, address newOwner)

Requires msg.sender == records[node].owner
Computes: bytes32 subnode = keccak256(abi.encodePacked(node, labelHash))
Sets records[subnode].owner = newOwner
Emits NewOwner(bytes32 indexed node, bytes32 indexed labelHash, address newOwner)
Returns bytes32 subnode
owner(bytes32 node) — public view, returns records[node].owner

resolver(bytes32 node) — public view, returns records[node].resolver

Constructor
Sets records[bytes32(0)].owner = msg.sender (deployer owns root). After deployment, deployer calls setSubnodeOwner(bytes32(0), keccak256("qf"), registrarAddress) to give the registrar ownership of the .qf root node.

Contract 2: QNSRegistrar.sol
Handles registration, pricing, payments, expiry, renewals, reserved names, and admin controls. This is the only contract that accepts QF payments.

Constructor Parameters
address registryAddress, address resolverAddress, address treasuryAddress, address burnAddress

Set initial pricing in constructor:

price3Char = 1000 * 10^18 (1,000 QF)
price4Char = 300 * 10^18 (300 QF)
price5PlusChar = 100 * 10^18 (100 QF)
permanentMultiplier = 15
GRACE_PERIOD = 30 days
admin = msg.sender
Storage
struct Registration {
    address owner;
    uint256 expires;    // 0 = permanent
    uint256 registeredAt;
}
mapping(bytes32 => Registration) public registrations;  // labelHash => Registration
mapping(bytes32 => bool) public reserved;               // labelHash => isReserved
Plus: registry, resolver, treasury, burn address references, pricing variables, admin address.

Name Validation
Internal function validateName(string memory name) that:

Requires bytes(name).length >= 3 and <= 64
Checks every character is a-z, 0-9, or hyphen (0x2D)
Converts uppercase to lowercase (if byte is 0x41-0x5A, add 0x20)
Requires first character is not a hyphen
Requires last character is not a hyphen
Returns the lowercase string
Pricing
Internal function getPrice(uint256 nameLength, uint256 durationYears, bool permanent) returns uint256:

Base price: price3Char if length == 3, price4Char if length == 4, price5PlusChar if length >= 5
If permanent: base price * permanentMultiplier
If annual: base price * durationYears
Revenue Split
95% of fees kept in contract for treasury withdrawal. 5% sent to burn address.

register(string memory name, uint256 durationInYears, bool permanent) — payable, external
Validate and lowercase the name
Compute labelHash = keccak256(bytes(name))
Require !reserved[labelHash]
Require name is available: registrations[labelHash].owner == address(0) OR (registrations[labelHash].expires != 0 AND block.timestamp > registrations[labelHash].expires + GRACE_PERIOD)
Compute fee via getPrice
Require msg.value >= fee
Store registration: owner = msg.sender, expires = permanent ? 0 : block.timestamp + (durationInYears * 365 days), registeredAt = block.timestamp
Compute qfNode = keccak256(abi.encodePacked(bytes32(0), keccak256("qf")))
Compute nameNode = keccak256(abi.encodePacked(qfNode, labelHash))
Call registry.setSubnodeOwner(qfNode, labelHash, address(this)) — registrar temporarily owns the node
Call registry.setResolver(nameNode, resolverAddress) — set default resolver
Call resolver.setAddr(nameNode, msg.sender) — forward resolution
Call resolver.setName(nameNode, name) — plaintext storage
Call resolver.setReverse(msg.sender, nameNode) — reverse resolution
Call registry.setOwner(nameNode, msg.sender) — transfer node to registrant
Split payment: burnAmount = msg.value * 5 / 100, send burnAmount to burnAddress, keep rest in contract
Refund excess if msg.value > fee: send (msg.value - fee) back to msg.sender
Emit NameRegistered(string name, bytes32 indexed labelHash, address indexed owner, uint256 expires, uint256 fee)
renew(string memory name, uint256 durationYears) — payable, external
Compute labelHash
Require registrations[labelHash].owner != address(0)
Require registrations[labelHash].expires != 0 (can't renew permanent)
Require block.timestamp <= registrations[labelHash].expires + GRACE_PERIOD
Compute fee via getPrice(nameLength, durationYears, false)
Require msg.value >= fee
If not yet expired: registrations[labelHash].expires += durationYears * 365 days
If expired but in grace: registrations[labelHash].expires = block.timestamp + (durationYears * 365 days)
Split payment 95/5, refund excess
Emit NameRenewed(string name, bytes32 indexed labelHash, uint256 newExpiry, uint256 fee)
available(string memory name) — public view
Validate name. Compute labelHash. Return !reserved[labelHash] && (registrations[labelHash].owner == address(0) || (registrations[labelHash].expires != 0 && block.timestamp > registrations[labelHash].expires + GRACE_PERIOD))

transferName(string memory name, address newOwner) — external
Compute labelHash. Require msg.sender == registrations[labelHash].owner
Require newOwner != address(0)
Update registrations[labelHash].owner = newOwner
Compute nameNode
Call resolver.setAddr(nameNode, newOwner)
Call resolver.clearReverse(msg.sender)
Call resolver.setReverse(newOwner, nameNode)
Call registry.setOwner(nameNode, newOwner)
Emit NameTransferred(string name, address indexed from, address indexed to)
Reserved Names — Admin Only
reserveName(string name) — set reserved[labelHash] = true

unreserveName(string name) — set reserved[labelHash] = false

assignReservedName(string name, address to) — require reserved[labelHash]. Follow register() flow but no payment required. Set reserved[labelHash] = false after.

Initial reserved list: qflink, qfpad, qfclash, qfstream, nucleusx, quantumnotary, quantum, fusion, quantumfusion, qf, dapp, bridge, governance, admin, treasury, validator, node, swap, stake, pool, vault, dao, nft, token, wallet, vector, nucleus

Admin Functions — All require msg.sender == admin
setPrice(uint256 new3, uint256 new4, uint256 new5Plus)
setPermanentMultiplier(uint256 newMult)
setTreasury(address newTreasury)
setBurnAddress(address newBurn)
withdrawToTreasury() — sends contract balance to treasury
setDefaultResolver(address newResolver)
setAdmin(address newAdmin)
Contract 3: QNSResolver.sol
Stores resolution data: forward (name → address), reverse (address → name), and text records.

Constructor Parameters
address registryAddress. Deployer is stored as contract owner.

Storage
mapping(bytes32 => address) public addresses;          // namehash => address (forward)
mapping(address => bytes32) public reverseNodes;        // address => namehash (reverse)
mapping(bytes32 => string) public names;                // namehash => plaintext name
mapping(bytes32 => mapping(string => string)) public texts;  // namehash => key => value
mapping(address => bool) public authorizedCallers;      // registrar authorization
Access Control
Internal function isAuthorized(bytes32 node) returns bool:

Returns true if msg.sender == QNSRegistry.owner(node) OR authorizedCallers[msg.sender] == true
Functions
setAddr(bytes32 node, address addr) — requires isAuthorized(node). Sets addresses[node] = addr. Emits AddrChanged(bytes32 indexed node, address addr).

addr(bytes32 node) — public view. Returns addresses[node].

setReverse(address addr, bytes32 node) — requires msg.sender == addr OR authorizedCallers[msg.sender]. Sets reverseNodes[addr] = node.

clearReverse(address addr) — requires msg.sender == addr OR authorizedCallers[msg.sender]. Deletes reverseNodes[addr].

setName(bytes32 node, string memory name) — requires isAuthorized(node). Sets names[node] = name.

name(bytes32 node) — public view. Returns names[node].

reverseResolve(address addr) — public view. Gets node = reverseNodes[addr]. If node == bytes32(0), return "". Else return string(abi.encodePacked(names[node], ".qf")).

nameHash(address addr) — public view. Returns reverseNodes[addr].

setText(bytes32 node, string key, string value) — requires isAuthorized(node). Sets texts[node][key] = value. Emits TextChanged(bytes32 indexed node, string key, string value).

text(bytes32 node, string key) — public view. Returns texts[node][key].

addAuthorizedCaller(address caller) — requires msg.sender == contract owner.

removeAuthorizedCaller(address caller) — requires msg.sender == contract owner.

QFLink Frontend Integration
QFLink uses React, viem for contract interactions, and Zustand for state management.

QNS Resolution Utility (src/utils/qns.ts or similar)
namehash(name: string) → bytes32

Takes a full name like "alice.qf"
Splits by ".", reverses labels, iteratively computes keccak256(encodePacked(currentHash, keccak256(label))) from bytes32(0)
Use viem's keccak256 and encodePacked
resolveForward(name: string) → address | null

Compute namehash of the .qf name
Call QNSRegistry.resolver(namehash) to get resolver address
Call QNSResolver.addr(namehash) to get wallet address
Return address or null if zero address
resolveReverse(address: string) → string | null

Call QNSResolver.reverseResolve(address)
Return .qf name string or null if empty
checkAvailability(name: string) → boolean

Call QNSRegistrar.available(name)
getPrice(name: string, years: number, permanent: boolean) → bigint

Compute locally based on name length and pricing constants
Return price in wei
registerName(name: string, years: number, permanent: boolean) → txHash

Call QNSRegistrar.register with appropriate msg.value
renewName(name: string, years: number) → txHash

Call QNSRegistrar.renew with appropriate msg.value
Define QNS contract addresses and ABIs as constants (set after deployment).

Zustand Cache Store
Copyinterface QNSCacheEntry {
    name: string | null;
    resolvedAt: number;
}

interface QNSCacheStore {
    entries: Record<string, QNSCacheEntry>;  // address => entry
    setEntry: (address: string, name: string | null) => void;
    getEntry: (address: string) => QNSCacheEntry | null;  // null if missing or stale (>5min)
    batchResolve: (addresses: string[]) => Promise<void>;  // resolves uncached, stores results
}
TTL: 300,000ms (5 minutes). getEntry returns null if resolvedAt is older than TTL.

batchResolve: filters out addresses already cached and fresh, calls reverseResolve for each remaining address, stores all results.

useQNSName Hook
CopyuseQNSName(address: string) → { name: string | null, loading: boolean }
Check Zustand cache via getEntry
If cached and fresh, return immediately with loading: false
If not cached or stale, trigger resolveReverse via useEffect, set loading: true
On resolution, update cache via setEntry, return result with loading: false
Every component that displays an address uses this hook.

Onboarding Flow Modification
Current flow: connect wallet → register profile name → sign → enter app.

New flow:

Connect wallet
Call QFLink Registry to check if already registered
Call QNS resolveReverse(connectedAddress)
If returning user: enter app with .qf name or hex address
If new user: show QNS registration screen:
Text input with ".qf" as static suffix displayed in emerald (#00D179)
Real-time availability check on keystroke (debounced 300-500ms) via checkAvailability
Price display updating based on name length
Duration selector: 1 year, 2 years, 5 years, permanent — price updates accordingly
"Register" button in emerald → calls registerName, waits for tx confirmation
"Skip for now" link below the form in text-secondary
After QNS step (register or skip): call QFLink Registry register() (existing required step)
Enter app
Two transactions max for new users: QNS registrar (optional, with payment) then QFLink Registry (required). Skip = one transaction only.

DM Recipient Input
On submit of DM recipient field:

If input ends with ".qf": call resolveForward(input). If returns address, use for sendDirectMessage. If returns null, show error "Name not found."
If input is hex address (starts with "0x", 42 chars, valid hex): use directly
Otherwise: show error "Enter a valid .qf name or wallet address."
Display Resolution
In every component showing a user address or profile name (message bubbles, conversation list, pod member list, pod message sender, DM headers):

Remove references to old profile name field
Call useQNSName(address)
Display .qf name if returned (with ".qf" portion in emerald for visual consistency), else truncated hex (first 6 + "..." + last 4)
For pod member lists and message histories: call batchResolve with all addresses when component mounts or address list changes, then individual components read from cache via useQNSName.

Profile Page
Replace profile name editing section:

If wallet has .qf name: display name prominently (with .qf in emerald), show editable text record fields (avatar, bio, twitter, github, url, discord) — load via resolver.text(), save via resolver.setText() as transactions. Show expiry and renew button if non-permanent.
If wallet has no .qf name: show QNS registration widget (reuse onboarding component)
Standalone QNS Landing Page
Single-page React application with viem for contract interactions. This is its own standalone deployment, separate from QFLink.

Brand & Design System
Colors:

Primary accent (emerald): #00D179
Primary hover: #00B868
Primary subtle (8% opacity for tinted backgrounds): #00D17915
Dark background: #0A0A0A
Surface/card: #141414
Surface border: #1E1E1E
Text primary: #FFFFFF
Text secondary: #8A8A8A
Text tertiary: #555555
Error: #E5484D
Warning: #F5A623
Typography:

Headlines: Clash Display (from Fontshare CDN or self-hosted) — Medium and Semibold weights
Body/UI: Satoshi (from Fontshare CDN or self-hosted) — Regular, Medium, Bold weights
Monospace (hex addresses): JetBrains Mono or IBM Plex Mono
Design Rules:

Dark mode only
".qf" is always rendered in emerald (#00D179) wherever it appears
Rounded corners: 12px on cards and inputs
Card borders: 1px solid #1E1E1E
No background gradients — flat dark surfaces
Emerald used sparingly: primary buttons, .qf suffix, active states, success indicators
Minimal animations: border color transitions (200ms ease), fade-ins (150ms), no scroll-triggered animations
Page Structure
Navbar:

Left: QNS logo — "QNS" in Clash Display Semibold white with small emerald dot after the S
Right: "My Names" link (text-secondary, scrolls to My Names section), wallet connect button (emerald outline border, white text "Connect Wallet", shows truncated address or .qf name when connected)
Section 1 — Hero (centered, 120px top padding, 80px bottom):

Headline: "Your identity on Quantum Fusion" — Clash Display Semibold, ~56px desktop / ~36px mobile, white
Subheadline: "Register a .qf name and use it across every dApp — messaging, trading, gaming, and everything built on QF Network." — Satoshi Regular, ~20px, text-secondary, max-width 560px centered
Search bar: centered, max-width 520px, dark surface bg (#141414), 1px border #1E1E1E, placeholder "Search for a name" in text-tertiary, fixed ".qf" suffix on right in emerald (Satoshi Medium), search button in emerald. Border transitions to emerald on focus.
Search results appear inline below:
Available: green check + "alice.qf" (.qf in emerald) + "is available" in text-secondary, price "100 QF / year (~$1)", emerald "Register" button
Taken: red X + "alice.qf" + "is taken", "Owned by 0x6f3a...8b2c" in text-tertiary
Reserved: shield icon + "alice.qf" + "is reserved", "This name is reserved for an ecosystem project." in text-tertiary
Below search: small text "Be among the first to claim your .qf name" in text-tertiary, 14px
Section 2 — How It Works (80px vertical padding):

Section label: "HOW IT WORKS" — Satoshi Medium, 14px, emerald, uppercase, letter-spaced
Three columns (stacked on mobile), each card has:
Number: "01" / "02" / "03" in emerald, Clash Display Medium, large
Heading in white, Clash Display Medium 24px
Description in text-secondary, Satoshi Regular 16px
Card 1: "Claim your name" / "Search for any name, pick your duration, and register in a single transaction. Done in seconds."
Card 2: "Use it everywhere" / "Send messages on QFLink, trade on NucleusX, compete on QFClash — all with yourname.qf instead of a hex address."
Card 3: "Own your identity" / "Attach your avatar, bio, and social links. Your .qf name is your on-chain profile across the entire QF ecosystem."
Section 3 — Ecosystem (80px vertical padding):

Section label: "ECOSYSTEM"
Headline: "One name. Every dApp." — Clash Display Medium, 32px, white
Subheadline: "QNS is the identity layer for Quantum Fusion. Register once, recognized everywhere." — Satoshi Regular, 18px, text-secondary, max-width 480px
Grid of cards (3x2 desktop, 1 column mobile):
Each card: surface bg, subtle border, dApp icon placeholder (48px square), dApp name (Satoshi Medium 18px white), description (Satoshi Regular 14px text-secondary), status badge ("Live" in emerald or "Coming Soon" in text-tertiary)
QFLink: "Message anyone by their .qf name. No more copying hex addresses." — Live
QFClash: "Player profiles and leaderboards powered by .qf identity." — Live
NucleusX: "Send and receive tokens to yourname.qf on the QF DEX." — Coming Soon
QFPad: "Project discovery and creator profiles with .qf names." — Coming Soon
52F: "Community identity for Vector's deflationary engine." — Coming Soon
QF dApp Store: "Developer profiles and dApp branding with .qf names." — Coming Soon
Section 4 — Pricing (80px vertical padding):

Section label: "PRICING"
Headline: "Simple, transparent pricing" — Clash Display Medium, 32px
Subheadline: "All fees paid in QF. 95% funds development, 5% is burned forever." — Satoshi Regular, 18px, text-secondary
Three pricing columns:
Premium (3 chars): example "ace.qf", 1,000 QF/yr (~$10), permanent 15,000 QF (~$150)
Standard (4 chars): example "alex.qf", 300 QF/yr (~$3), permanent 4,500 QF (~$45)
Basic (5+ chars, highlighted with emerald border + "Most popular" badge): example "alice.qf", 100 QF/yr (~$1), permanent 1,500 QF (~$15)
Below table: "Multi-year registration available. Renew anytime. 30-day grace period after expiry." — Satoshi Regular, 14px, text-tertiary
Section 5 — Registration Flow (centered card, max-width 480px, surface bg):

If no name selected: heading "Register your .qf name" + search bar component
If name selected from hero: name displayed large ("alice" white + ".qf" emerald, Clash Display 36px), green check "Available"
Duration selector: segmented control — "1 year" | "2 years" | "5 years" | "Permanent" — selected state emerald bg white text, unselected surface bg text-secondary
Price display updates live: "Total: 100 QF (~$1)" or "100 QF × 2 years = 200 QF (~$2)" or "1,500 QF (~$15) — own forever"
Register button: full-width emerald bg, white text Satoshi Bold, "Register alice.qf"
Transaction states: pending spinner + "Confirming transaction...", success green check + "alice.qf is yours!", failed red X + "Transaction failed. Try again." + retry button
Section 6 — My Names (80px vertical padding):

Section label: "MY NAMES"
Not connected: "Connect your wallet to manage your .qf names" + emerald outline "Connect Wallet" button
Connected, no names: "You don't have any .qf names yet" + emerald solid "Register your first name" button
Connected with names: list of name cards, each showing:
Name (.qf in emerald), status badge (Active/Expiring soon/Permanent), expiry date
Buttons: "Renew" (emerald outline, hidden for permanent), "Edit Profile" (expands to avatar/bio/twitter/github/url/discord fields, each saves via setText transaction), "Transfer" (opens modal with recipient input, warning text, red confirm button)
Footer:

Surface bg (#141414)
Left: QNS logo small + "The identity layer for Quantum Fusion" text-tertiary 14px
Right: links — "QF Network" | "QFLink" | "QFClash" | "Docs" | "Twitter" | "Discord" — text-secondary 14px
Bottom: "QNS is community-built infrastructure for the QF ecosystem." — text-tertiary 12px centered
Responsive Breakpoints
Mobile < 768px: stacked layouts, full-width cards, reduced headline sizes (~32px hero)
Tablet 768-1024px: two-column grids
Desktop > 1024px: max content width 1120px centered, three-column layouts
Page Metadata
Title: "QNS — Your Identity on Quantum Fusion"
Meta description: "Register your .qf name and use it across every dApp on QF Network. One name for messaging, trading, gaming, and more."
Deployment Sequence
Deploy QNSResolver.sol → record address
Deploy QNSRegistry.sol → record address
Deploy QNSRegistrar.sol(registryAddr, resolverAddr, treasuryAddr, burnAddr) → record address
From deployer wallet:
QNSRegistry.setSubnodeOwner(bytes32(0), keccak256("qf"), registrarAddr)
QNSResolver.addAuthorizedCaller(registrarAddr)
QNSRegistrar.reserveName() for each reserved name
Test: register a name, verify forward + reverse resolution
Critical Constraints
NO delegatecall — do not use proxy/upgradeable patterns
NO SELFDESTRUCT
All payments via msg.value in native QF (1 QF = 10^18 wei)
Compile with resolc for PolkaVM target, not standard EVM
Name validation MUST happen in the contract, not just frontend
Revenue split: 95% kept in contract for treasury withdrawal, 5% sent to burn address
Testing Checklist
Register a 3-char name → correct fee charged (1,000 QF)
Register a 5+ char name → correct fee charged (100 QF)
Register a taken name → reverts
Register a reserved name → reverts
Forward resolution returns correct address
Reverse resolution returns correct .qf string
Set and read text records
Transfer a name → new owner resolves, old owner's reverse cleared
Let name expire → cannot resolve → wait past grace period → someone else can register
Renew before expiry → expiry extends from old expiry, not from now
Admin assigns reserved name → recipient can resolve
Admin adjusts pricing → new registrations use updated prices
QFLink: type .qf name in DM field → message delivered to correct address
QFLink: chat messages display .qf names instead of hex for registered users
Landing page: search, register, view My Names all functional
Landing page: responsive on mobile, tablet, desktop
Landing page: .qf suffix renders in emerald (#00D179) everywhere

Standalone QNS Landing Page
Single-page React application with viem for contract interactions. This is its own standalone deployment, separate from QFLink.

Brand & Design System
Colors:

Primary accent (emerald): #00D179
Primary hover: #00B868
Primary subtle (8% opacity for tinted backgrounds): #00D17915
Dark background: #0A0A0A
Surface/card: #141414
Surface border: #1E1E1E
Text primary: #FFFFFF
Text secondary: #8A8A8A
Text tertiary: #555555
Error: #E5484D
Warning: #F5A623
Typography:

Headlines: Clash Display (from Fontshare CDN or self-hosted) — Medium and Semibold weights
Body/UI: Satoshi (from Fontshare CDN or self-hosted) — Regular, Medium, Bold weights
Monospace (hex addresses): JetBrains Mono or IBM Plex Mono
Design Rules:

Dark mode only
".qf" is always rendered in emerald (#00D179) wherever it appears
Rounded corners: 12px on cards and inputs
Card borders: 1px solid #1E1E1E
No background gradients — flat dark surfaces
Emerald used sparingly: primary buttons, .qf suffix, active states, success indicators
Minimal animations: border color transitions (200ms ease), fade-ins (150ms), no scroll-triggered animations
Page Structure
Navbar:

Left: QNS logo — "QNS" in Clash Display Semibold white with small emerald dot after the S
Right: "My Names" link (text-secondary, scrolls to My Names section), wallet connect button (emerald outline border, white text "Connect Wallet", shows truncated address or .qf name when connected)
Section 1 — Hero (centered, 120px top padding, 80px bottom):

Headline: "Your identity on Quantum Fusion" — Clash Display Semibold, ~56px desktop / ~36px mobile, white
Subheadline: "Register a .qf name and use it across every dApp — messaging, trading, gaming, and everything built on QF Network." — Satoshi Regular, ~20px, text-secondary, max-width 560px centered
Search bar: centered, max-width 520px, dark surface bg (#141414), 1px border #1E1E1E, placeholder "Search for a name" in text-tertiary, fixed ".qf" suffix on right in emerald (Satoshi Medium), search button in emerald. Border transitions to emerald on focus.
Search results appear inline below:
Available: green check + "alice.qf" (.qf in emerald) + "is available" in text-secondary, price "100 QF / year (~$1)", emerald "Register" button
Taken: red X + "alice.qf" + "is taken", "Owned by 0x6f3a...8b2c" in text-tertiary
Reserved: shield icon + "alice.qf" + "is reserved", "This name is reserved for an ecosystem project." in text-tertiary
Below search: small text "Be among the first to claim your .qf name" in text-tertiary, 14px
Section 2 — How It Works (80px vertical padding):

Section label: "HOW IT WORKS" — Satoshi Medium, 14px, emerald, uppercase, letter-spaced
Three columns (stacked on mobile), each card has:
Number: "01" / "02" / "03" in emerald, Clash Display Medium, large
Heading in white, Clash Display Medium 24px
Description in text-secondary, Satoshi Regular 16px
Card 1: "Claim your name" / "Search for any name, pick your duration, and register in a single transaction. Done in seconds."
Card 2: "Use it everywhere" / "Send messages on QFLink, trade on NucleusX, compete on QFClash — all with yourname.qf instead of a hex address."
Card 3: "Own your identity" / "Attach your avatar, bio, and social links. Your .qf name is your on-chain profile across the entire QF ecosystem."
Section 3 — Ecosystem (80px vertical padding):

Section label: "ECOSYSTEM"
Headline: "One name. Every dApp." — Clash Display Medium, 32px, white
Subheadline: "QNS is the identity layer for Quantum Fusion. Register once, recognized everywhere." — Satoshi Regular, 18px, text-secondary, max-width 480px
Grid of cards (3x2 desktop, 1 column mobile):
Each card: surface bg, subtle border, dApp icon placeholder (48px square), dApp name (Satoshi Medium 18px white), description (Satoshi Regular 14px text-secondary), status badge ("Live" in emerald or "Coming Soon" in text-tertiary)
QFLink: "Message anyone by their .qf name. No more copying hex addresses." — Live
QFClash: "Player profiles and leaderboards powered by .qf identity." — Live
NucleusX: "Send and receive tokens to yourname.qf on the QF DEX." — Coming Soon
QFPad: "Project discovery and creator profiles with .qf names." — Coming Soon
52F: "Community identity for Vector's deflationary engine." — Coming Soon
QF dApp Store: "Developer profiles and dApp branding with .qf names." — Coming Soon
Section 4 — Pricing (80px vertical padding):

Section label: "PRICING"
Headline: "Simple, transparent pricing" — Clash Display Medium, 32px
Subheadline: "All fees paid in QF. 95% funds development, 5% is burned forever." — Satoshi Regular, 18px, text-secondary
Three pricing columns:
Premium (3 chars): example "ace.qf", 1,000 QF/yr (~$10), permanent 15,000 QF (~$150)
Standard (4 chars): example "alex.qf", 300 QF/yr (~$3), permanent 4,500 QF (~$45)
Basic (5+ chars, highlighted with emerald border + "Most popular" badge): example "alice.qf", 100 QF/yr (~$1), permanent 1,500 QF (~$15)
Below table: "Multi-year registration available. Renew anytime. 30-day grace period after expiry." — Satoshi Regular, 14px, text-tertiary
Section 5 — Registration Flow (centered card, max-width 480px, surface bg):

If no name selected: heading "Register your .qf name" + search bar component
If name selected from hero: name displayed large ("alice" white + ".qf" emerald, Clash Display 36px), green check "Available"
Duration selector: segmented control — "1 year" | "2 years" | "5 years" | "Permanent" — selected state emerald bg white text, unselected surface bg text-secondary
Price display updates live: "Total: 100 QF (~$1)" or "100 QF × 2 years = 200 QF (~$2)" or "1,500 QF (~$15) — own forever"
Register button: full-width emerald bg, white text Satoshi Bold, "Register alice.qf"
Transaction states: pending spinner + "Confirming transaction...", success green check + "alice.qf is yours!", failed red X + "Transaction failed. Try again." + retry button
Section 6 — My Names (80px vertical padding):

Section label: "MY NAMES"
Not connected: "Connect your wallet to manage your .qf names" + emerald outline "Connect Wallet" button
Connected, no names: "You don't have any .qf names yet" + emerald solid "Register your first name" button
Connected with names: list of name cards, each showing:
Name (.qf in emerald), status badge (Active/Expiring soon/Permanent), expiry date
Buttons: "Renew" (emerald outline, hidden for permanent), "Edit Profile" (expands to avatar/bio/twitter/github/url/discord fields, each saves via setText transaction), "Transfer" (opens modal with recipient input, warning text, red confirm button)
Footer:

Surface bg (#141414)
Left: QNS logo small + "The identity layer for Quantum Fusion" text-tertiary 14px
Right: links — "QF Network" | "QFLink" | "QFClash" | "Docs" | "Twitter" | "Discord" — text-secondary 14px
Bottom: "QNS is community-built infrastructure for the QF ecosystem." — text-tertiary 12px centered
Responsive Breakpoints
Mobile < 768px: stacked layouts, full-width cards, reduced headline sizes (~32px hero)
Tablet 768-1024px: two-column grids
Desktop > 1024px: max content width 1120px centered, three-column layouts
Page Metadata
Title: "QNS — Your Identity on Quantum Fusion"
Meta description: "Register your .qf name and use it across every dApp on QF Network. One name for messaging, trading, gaming, and more."
