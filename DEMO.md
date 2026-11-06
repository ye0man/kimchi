# Kimchi demo runbook

**Tagline:** Share the date, not your data.

**Track:** Best Use of the Marmot Protocol (plus the privacy main track).

Kimchi is a Marmot-native group chat where the bill is an encrypted application
message and the settlement is Cashu ecash. The demo should make three things
visible:

1. The group, invite, chat, receipt, and tab all ride **one MLS group**.
2. The relay only sees **ciphertext and routing metadata**.
3. The mint sees **amounts and locks**, not the group or who paid whom.

---

## Before the stage

- Three browser profiles or devices: **Minji** (host), **Alex**, **Priya**.
- Each profile has its own identity. No phone number, no email.
- Minji has created a group and opened **Share join link**.
- Alex and Priya have the join link (or the host is ready to scan their invite
  cards if relay discovery is slow).
- Alex and Priya each have a little ecash in **Wallet**:
  - **Wallet → Add sats → pay the invoice → I paid — claim**, or
  - paste a Minibits token.
- Minji has the group page open. The Kimchi tab page is one tap away.
- Optional: keep a relay log and a mint log visible in a second window.

---

## 90-second stage script

### 0:00 — The problem

> "Every dinner splits more than the bill. It leaks who was together, who paid,
> how much, and when. Kimchi keeps the social context off the relay and the
> crowd off the mint's books."

### 0:10 — The group is Marmot

Create the group (or open the existing one).

> "This is a real Marmot group: MLS over Nostr. The relay carries `kind 445`
> ciphertext. There is no Kimchi server holding the room."

Show **Share join link**.

### 0:20 — Seamless join

Alex taps the link, then **Join the table**. Priya does the same.

> "The link carries a capability token. Each guest publishes a fresh KeyPackage
> and sends a gift-wrapped join request. The host validates it and sends an MLS
> Welcome. The guest auto-accepts. No phone number, no email, no account."

### 0:35 — Receipt and tab

Minji attaches the receipt photo in the chat, then opens the Kimchi tab:
**Seoul dinner**, ₩18,000, split 3 ways, 24h, Minibits.

> "The receipt is MIP-04 encrypted media. The tab is a `kind 20001` application
> message inside the same MLS group. The relay cannot tell it apart from chat."

Point at the mint capability line:

> "The tab checks the mint first: NUT-11 P2PK and NUT-07 proof states. Minibits
> supports both."

### 0:50 — Pay with ecash

Alex taps **Pay with ecash**. Priya does the same.

> "Each person gets a fresh P2PK key and a NUT-18 payment request. Their wallet
> pays a request locked to that key. The mint sees a distinct lock and an
> amount, not the group or the person."

### 1:05 — Host redeems

Minji's app auto-redeems; the jar fills; the tab stamps **PAID** / **Settled**.

> "The host checks NUT-07, unlocks with the share key, and publishes
> `kimchi.paid` inside MLS. Every member sees the tab fill."

### 1:15 — What leaks

Open **What leaks** on the tab.

> "The relay sees this: a `kind 445` ciphertext blob. The mint sees this: an
> amount and a swap. Neither sees the group, the receipt, or who paid whom."

### 1:25 — Close

Minji taps **Close tab**.

> "The tab closes and its local secrets are deleted. The group chat stays. If
> we delete the group, we get a warning when a tab is still unpaid."

> "Kimchi. Share the date, not your data."

---

## 3-minute deep dive (if the judges want more)

### Marmot

- **MLS group state** provides epoch-based group keys with forward secrecy and
  post-compromise security. The relay is not part of the key agreement.
- **KeyPackages** (`kind 30443`) are published per device. **Welcomes** are
  NIP-59 gift-wrapped and delivered to the invitee's inbox relays.
- **Chat, reactions, media, and tabs** are all application rumors inside the
  same MLS group. The relay sees the same `kind 445` envelope for all of them.
- **Group membership changes** are MLS commits; the app derives the member list
  from group state, not from a server database.
- **Interop:** the chat is a normal Marmot group. The tab is the app-level piece;
  `kimchi.tab.v1` is the next step to make it render natively in White Noise.

### Nostr

- Identity is a secp256k1 keypair. The `npub` is the user; no signup.
- NIP-65 outbox and `kind 10050` inbox relay lists drive discovery.
- Relays carry ciphertext and see group id, sender pubkey, timing, and sizes.
- Join links use capability tokens plus gift-wrapped join requests; invite cards
  and QR scanning are the fallback.

### Cashu

- The host derives a fresh P2PK key per share and builds a NUT-18 `creqA…`
  request locked with NUT-10/NUT-11.
- The guest pays; the proofs are locked to the host's share key.
- The host checks NUT-07, redeems with the share private key, and confirms in
  MLS.
- The mint sees amounts and locks; it does not see the group, names, or who paid
  whom from the protocol alone.
- Minibits live check: NUT-10, NUT-11, NUT-07 are advertised. NUT-18 is a
  wallet-level format, not a mint capability.

---

## Judge Q&A

**"Why not Signal or a normal group chat?"**
Signal is centralized around phone numbers. Kimchi uses Nostr identity and
relays: no phone number, no server holding the group, and the same group can be
used by other Marmot clients.

**"What does the relay actually see?"**
The outer `kind 445` event: group id, sender pubkey, timestamp, size, and
ciphertext. It does not see chat text, tab amounts, the receipt, or who paid
whom.

**"What does the mint see?"**
An amount, a timestamp, and a fresh P2PK lock. It does not see the group, the
member list, or a reusable payment address. Correlation by amount/timing is
still possible; we say so.

**"Why P2PK instead of a normal Cashu token?"**
A P2PK lock makes the payment redeemable only by the holder of the share key.
Using a fresh key per share avoids a reusable address and avoids handing the
host a bearer token that anyone could redeem.

**"Is NUT-18 a mint feature?"**
No. NUT-18 is a wallet-level payment request format (`creqA…`). The mint needs
to support the P2PK spending condition and swaps; Minibits supports NUT-10,
NUT-11, and NUT-07.

**"How do invites work without a server?"**
The host shares a capability link. The guest publishes a fresh KeyPackage and
sends a gift-wrapped join request. The host validates the token and sends an MLS
Welcome. The guest auto-accepts. If discovery is slow, the guest shares a QR
invite card with their KeyPackage.

**"What happens when the tab closes?"**
The tab sends `kimchi.closing`, deletes local tab secrets, and keeps the group
chat. Deleting the group is a separate admin action; it warns if a tab is still
open with unpaid shares.

**"What is not private?"**
Relay metadata (group id, sender pubkey, timing, sizes), mint amounts and timing,
IP addresses, and local device compromise. We do not claim anonymity or
untraceability.

---

## What to show on screen

- The **group chat** and the **join link** flow.
- The **tab page** with the per-person amount and the **Pay with ecash** button.
- The **What leaks** drawer: `kind 445` ciphertext on the relay side, amounts on
  the mint side.
- The **Contacts** page: recent people expire unless kept.
- The **Wallet** page: balance, mint, and the NUT-11 / NUT-07 / NUT-18 badges.

---

## Fallbacks

- **Join discovery fails:** share the join link again, or have the guest show
  **Show my invite QR → Invite card**; the host scans it in **Contacts**.
- **Minibits is slow:** use a local `cdk-mintd` backup and label it. The tab
  form accepts any NUT-11 mint and checks capabilities before creating the tab.
- **A payer has no ecash:** use **Wallet → Add sats** or a pre-funded profile.
- **Stage Wi-Fi:** keep a pre-recorded 90-second video and switch to it without
  apologizing.
- **Redeem fails:** the host can retry; the pending count stays until a
  `kimchi.paid` message is sent.

---

## Privacy language

Use:

- "The relay sees MLS ciphertext, not the bill."
- "The mint sees an amount and a lock, not the group."
- "Each share uses a fresh key."
- "Relays still see group ids, sender pubkeys, timing, and sizes."
- "IP metadata is out of scope for this demo."

Never say "anonymous" or "untraceable."

---

## Marmot track framing

The Marmot judges should leave with one sentence:

> "Kimchi is not a payment app with a chat bolted on. It is a Marmot group where
> the bill, the receipt, the invites, and the settlement are all encrypted MLS
> application messages — the tab is a first-class Marmot workload."

Concrete Marmot usage to point at:

- group creation and MLS epochs,
- KeyPackage publication and Welcome delivery,
- NIP-59 gift-wrapped invites and join requests,
- `kind 445` ciphertext transport,
- application rumors for chat, reactions, media, and `kimchi.*`,
- group state as the source of truth for members and admins.
