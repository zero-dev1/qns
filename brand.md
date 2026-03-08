# QNS Landing Page Copy & Brand Specification

## Brand Identity

### Colors

Primary accent: Emerald #00D179
Primary accent hover: #00B868
Primary accent subtle (for backgrounds/tints): #00D17915 (emerald at 8% opacity)
Dark background: #0A0A0A
Surface/card background: #141414
Surface border: #1E1E1E
Text primary: #FFFFFF
Text secondary: #8A8A8A
Text tertiary: #555555
Success: #00D179 (same as primary — green means verified/confirmed)
Error: #E5484D
Warning: #F5A623

### Typography

Headlines/Display: Clash Display (Fontshare, free) — weights Medium and Semibold
Body/UI: Satoshi (Fontshare, free) — weights Regular, Medium, Bold
Monospace (for addresses, code): JetBrains Mono or IBM Plex Mono (for hex address displays)

Font loading: import from Fontshare CDN or self-host.

### Logo

Lettermark "QNS" in Clash Display Semibold, white (#FFFFFF). A small emerald (#00D179) dot to the right of the "S" — positioned like a period, slightly elevated. This dot is the brand mark and doubles as a visual nod to the ".qf" suffix. At favicon/small sizes, use just the emerald dot on dark background, or "Q" in white with the emerald dot.

### Design Principles

Dark mode only. No light mode variant.
Generous whitespace. Let elements breathe.
The ".qf" suffix is always rendered in emerald (#00D179) wherever it appears — search bar, name displays, results, cards.
Rounded corners on cards and inputs: 12px.
Subtle borders on cards: 1px solid #1E1E1E.
No gradients on backgrounds. Flat, dark surfaces.
Emerald used sparingly — primary buttons, .qf suffix, active states, success states. Not splashed everywhere.
Hover states on interactive elements: subtle emerald glow or background shift.

---

## Landing Page Structure & Copy

### Navbar

Left: QNS logo (lettermark + dot)
Right: "My Names" link (scrolls to My Names section, or shows count badge if wallet connected and names owned), wallet connect button styled as outline button with emerald border.

When wallet not connected, button reads "Connect Wallet"
When connected, button shows truncated address or .qf name if they have one.

---

### Section 1: Hero

Layout: centered, generous vertical padding (120px top, 80px bottom minimum). Search bar is the centerpiece.

Headline (Clash Display Semibold, ~56px on desktop, ~36px on mobile):
"Your identity on Quantum Fusion"

Subheadline (Satoshi Regular, ~20px, text-secondary color, max-width 560px centered):
"Register a .qf name and use it across every dApp — messaging, trading, gaming, and everything built on QF Network."

Search bar (centered, max-width 520px):
- Large input field, dark surface background (#141414), 1px border #1E1E1E
- Placeholder text in text-tertiary: "Search for a name"
- Fixed ".qf" suffix inside the input on the right side, rendered in emerald (#00D179), Satoshi Medium
- Search/arrow button on the far right in emerald
- On focus, border transitions to emerald

Search results (appear below the search bar inline, no page change):

If available:
- Green checkmark icon + "alice.qf" with .qf in emerald + "is available" in text-secondary
- Price display: "100 QF / year (~$1)" in Satoshi Regular
- "Register" button in emerald, full width of the results area

If taken:
- Red X icon + "alice.qf" with .qf in emerald + "is taken" in text-secondary
- "Owned by 0x6f3a...8b2c" in text-tertiary, small text
- "Try another name" prompt

If reserved:
- Shield icon + "alice.qf" with .qf in emerald + "is reserved" in text-secondary
- "This name is reserved for an ecosystem project." in text-tertiary

Below the search bar, small text in text-tertiary (Satoshi Regular, 14px):
"5,847 names registered" (dynamic counter from contract events, or static placeholder at launch: "Be among the first to claim your .qf name")

---

### Section 2: How It Works

Layout: three columns on desktop, stacked on mobile. Section padding 80px vertical.

Section label (Satoshi Medium, 14px, emerald, uppercase, letter-spaced):
"HOW IT WORKS"

Three cards, each with:
- A number in emerald (01, 02, 03) — Clash Display Medium, large
- A heading in white — Clash Display Medium, 24px
- A description in text-secondary — Satoshi Regular, 16px

Card 1:
Number: 01
Heading: "Claim your name"
Description: "Search for any name, pick your duration, and register in a single transaction. Done in seconds."

Card 2:
Number: 02
Heading: "Use it everywhere"
Description: "Send messages on QFLink, trade on NucleusX, compete on QFClash — all with yourname.qf instead of a hex address."

Card 3:
Number: 03
Heading: "Own your identity"
Description: "Attach your avatar, bio, and social links. Your .qf name is your on-chain profile across the entire QF ecosystem."

---

### Section 3: Ecosystem

Layout: centered section, 80px vertical padding.

Section label (same style as above):
"ECOSYSTEM"

Headline (Clash Display Medium, 32px, white):
"One name. Every dApp."

Subheadline (Satoshi Regular, 18px, text-secondary, max-width 480px centered):
"QNS is the identity layer for Quantum Fusion. Register once, recognized everywhere."

Grid of integration cards (2x3 or 3x2 on desktop, stacked on mobile). Each card:
- Dark surface background (#141414), subtle border
- dApp icon/logo placeholder (square, 48px)
- dApp name in white (Satoshi Medium, 18px)
- Integration description in text-secondary (Satoshi Regular, 14px)
- Status badge: "Live" in emerald or "Coming Soon" in text-tertiary

Card: QFLink
Description: "Message anyone by their .qf name. No more copying hex addresses."
Status: Live

Card: QFClash
Description: "Player profiles and leaderboards powered by .qf identity."
Status: Live

Card: NucleusX
Description: "Send and receive tokens to yourname.qf on the QF DEX."
Status: Coming Soon

Card: QFPad
Description: "Project discovery and creator profiles with .qf names."
Status: Coming Soon

Card: 52F
Description: "Community identity for Vector's deflationary engine."
Status: Coming Soon

Card: QF dApp Store
Description: "Developer profiles and dApp branding with .qf names."
Status: Coming Soon

---

### Section 4: Pricing

Layout: centered, 80px vertical padding.

Section label:
"PRICING"

Headline (Clash Display Medium, 32px, white):
"Simple, transparent pricing"

Subheadline (Satoshi Regular, 18px, text-secondary):
"All fees paid in QF. 95% funds development, 5% is burned forever."

Pricing table/cards — three columns:

Column 1:
Tier label (Satoshi Medium, text-secondary): "Premium"
Character length (Satoshi Regular, text-tertiary): "3 characters"
Example name (Satoshi Medium, white): "ace" + ".qf" in emerald
Annual price (Clash Display Medium, 28px, white): "1,000 QF"
Annual USD equivalent (Satoshi Regular, text-tertiary): "~$10 / year"
Divider line
Permanent price (Satoshi Medium, white): "15,000 QF"
Permanent USD equivalent (Satoshi Regular, text-tertiary): "~$150 one-time"
Permanent label (Satoshi Regular, text-secondary): "Own forever"

Column 2:
Tier label: "Standard"
Character length: "4 characters"
Example name: "alex" + ".qf" in emerald
Annual price: "300 QF"
Annual USD: "~$3 / year"
Permanent price: "4,500 QF"
Permanent USD: "~$45 one-time"

Column 3 (highlighted with emerald border or subtle emerald background tint to indicate best value):
Tier label: "Basic"
Character length: "5+ characters"
Example name: "alice" + ".qf" in emerald
Annual price: "100 QF"
Annual USD: "~$1 / year"
Permanent price: "1,500 QF"
Permanent USD: "~$15 one-time"
Badge: "Most popular" in emerald, small

Below the table (Satoshi Regular, 14px, text-tertiary, centered):
"Multi-year registration available. Renew anytime. 30-day grace period after expiry."

---

### Section 5: Registration Flow

This section appears when a user has clicked "Register" from the search results in the hero, OR can be scrolled to. If the user hasn't searched yet, this section shows a secondary search bar.

Layout: centered card, max-width 480px, dark surface background, generous padding.

If no name selected yet:
- Heading: "Register your .qf name"
- Repeat of search bar component

If name selected (passed from hero search):
- Selected name displayed prominently: "alice" in white + ".qf" in emerald, large (Clash Display, 36px)
- Availability confirmed: green check + "Available" in emerald

Duration selector — styled as segmented control or radio button group:
Options: "1 year" | "2 years" | "5 years" | "Permanent"
Default selected: "1 year"
Selected state: emerald background, white text
Unselected: surface background, text-secondary

Price display (updates live based on selection):
"Total: 100 QF (~$1)" — Satoshi Medium, white
If multi-year: "100 QF × 2 years = 200 QF (~$2)"
If permanent: "1,500 QF (~$15) — own forever"

Register button:
Full-width, emerald background, white text, Satoshi Bold
Text: "Register alice.qf"
On click: fires wallet transaction

Transaction states (replace button area):
Pending: spinner + "Confirming transaction..." in text-secondary
Success: green check + "alice.qf is yours!" in emerald + confetti or subtle animation
Failed: red X + "Transaction failed. Try again." in error red + retry button

---

### Section 6: My Names

This section is only fully visible when a wallet is connected. When not connected, show a prompt.

Layout: full-width section, 80px vertical padding.

Section label:
"MY NAMES"

If wallet not connected:
- Centered message: "Connect your wallet to manage your .qf names" in text-secondary
- "Connect Wallet" button, emerald outline

If wallet connected but no names:
- Centered message: "You don't have any .qf names yet" in text-secondary
- "Register your first name" button, emerald solid, links/scrolls to hero search

If wallet connected with names:
- List of name cards, each card:
  - Name in white + ".qf" in emerald (Satoshi Bold, 20px)
  - Status badge: "Active" in emerald, or "Expiring soon" in warning amber, or "Permanent" in emerald with a small infinity or shield icon
  - Expiry date: "Expires March 7, 2027" in text-secondary (or "Permanent — no expiry")
  - Action buttons row:
    - "Renew" — emerald outline button (hidden for permanent names)
    - "Edit Profile" — surface button, expands the card to show:
      - Avatar URL input field
      - Bio text input field
      - Twitter handle input field
      - GitHub username input field
      - Website URL input field
      - Discord handle input field
      - Each field loads current value from QNS resolver
      - "Save" button per field or "Save All" — each fires a setText transaction
    - "Transfer" — text-tertiary link, opens a modal:
      - "Transfer alice.qf to another wallet"
      - Input field for recipient address (also accepts .qf names)
      - Warning text: "This action cannot be undone. The new owner will have full control of this name."
      - "Transfer" button in error red (red because it's destructive)
      - "Cancel" link

---

### Footer

Layout: simple, single row or two rows, generous padding, surface background (#141414).

Left: QNS logo small + "The identity layer for Quantum Fusion" in text-tertiary, Satoshi Regular 14px.

Right: links in text-secondary, Satoshi Regular 14px:
"QF Network" | "QFLink" | "QFClash" | "Documentation" | "Twitter" | "Discord"

Bottom line (text-tertiary, 12px, centered):
"QNS is community-built infrastructure for the QF ecosystem."

---

## Responsive Behavior

Mobile (< 768px):
- Hero headline drops to ~32px
- Search bar goes full-width with padding
- How It Works cards stack vertically
- Ecosystem grid becomes 1 column
- Pricing cards stack vertically with the "Basic" best-value card on top
- My Names cards go full-width
- Navbar collapses: logo left, hamburger or just wallet button right

Tablet (768-1024px):
- Two-column grids where applicable
- Slightly reduced padding

Desktop (> 1024px):
- Max content width 1120px, centered
- Full three-column layouts

---

## Animations & Interactions

Keep it minimal. No flashy transitions.

- Search bar: border color transitions to emerald on focus (200ms ease)
- Search results: fade in below search bar (150ms ease)
- Duration selector: selected state transitions background color (150ms)
- Cards on hover: border transitions to emerald at 30% opacity (200ms)
- Register button on hover: slight brightness increase
- Success state: simple scale-up of checkmark icon + name text
- Page sections: no scroll-triggered animations. Everything is visible immediately. Scroll animations feel gimmicky on a utility product.

---

## Page Metadata

Title: "QNS — Your Identity on Quantum Fusion"
Description: "Register your .qf name and use it across every dApp on QF Network. One name for messaging, trading, gaming, and more."
OG Image: dark background with "yourname.qf" in white+emerald, QNS logo. (Generate separately or use a simple template.)
Favicon: Emerald dot on dark background, or "Q" with emerald dot.