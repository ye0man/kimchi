# Kimchi

**Share the date, not your data.**

Kimchi is a private group tab for the moments you would rather not publish. A group of friends opens an encrypted group, one person shares the receipt, the group splits the bill, and everyone settles in Cashu ecash.

The chat is **Marmot**: MLS group messaging over Nostr relays. The money is **Cashu**: NUT-11 P2PK-locked ecash requested with NUT-18 payment requests. There is no phone number, no email, no account server, and no plaintext bill on a relay.

- **Live:** https://www.jakedat.com/kimchi/
- **Project page:** https://www.jakedat.com/projects/kimchi
- **Source:** https://github.com/ye0man/kimchi
- **Demo runbook:** [DEMO.md](./DEMO.md)
- **Architecture:** [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Privacy model:** [docs/PRIVACY.md](./docs/PRIVACY.md)

---

## Why this exists

Splitting a bill leaks a surprising amount of social information: who was together, who paid, how much, where, and when. Most apps fix that by asking you to trust a server. Kimchi removes the server from the conversation model:

- The group is an **MLS group** whose keys live on the members' devices.
- Relays only carry **MLS ciphertext** and routing metadata.
- The bill is an **application message inside MLS**, not a public event.
- The payment is **ecash locked to a fresh key per share**, not an invoice that names the group.
- The tab can close and the local tab secrets can be deleted, while the chat remains.

The result is a demo where the relay operator can see that a group is active but not what the group is saying, and the mint can see amounts but not who was at dinner.

---

## The demo in one minute

1. The host creates a group and shares a **join link** in any messaging app.
2. Each guest taps the link, taps **Join the table**, and is added automatically.
3. The host attaches the receipt photo and starts a tab: total in KRW, split equally, 24h lifetime, Minibits mint.
4. Each guest sees one number: what they owe, in sats.
5. A guest pays with one tap. The ecash is locked to a **fresh P2PK key** derived for that share.
6. The host redeems the locked ecash. The tab fills and settles.
7. The relay log shows a `kind 445` ciphertext blob. The mint log shows amounts and swaps, not the group.

The full stage script, including fallbacks and judge Q&A, is in [DEMO.md](./DEMO.md).

---

## Architecture

```
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ Guest device                 │        │ Host device                  │
│                              │        │                              │
│ Cashu wallet (proofs)        │        │ Cashu wallet (proofs)        │
│ Marmot group state (MLS)     │        │ Marmot group state (MLS)     │
│ Kimchi tab state (rumors)    │        │ Kimchi tab state (rumors)    │
└──────────────┬───────────────┘        └──────────────┬───────────────┘
               │ kind 445 ciphertext                   │ kind 445 ciphertext
               ▼                                       ▼
        ┌─────────────────────────────────────────────────────┐
        │ Nostr relays                                        │
        │ see: group id, sender pubkey, timing, sizes         │
        │ cannot see: plaintext, tab amounts, payer identity  │
        └─────────────────────────────────────────────────────┘

               ┌──────────────────────────────────────────────┐
               │ Cashu mint (Minibits by default)             │
               │ sees: amounts, timestamps, distinct locks    │
               │ cannot see: group, names, who paid whom      │
               └──────────────────────────────────────────────┘
```

Optional encrypted media is uploaded to a Blossom server as ciphertext (MIP-04). The server sees opaque blobs and hashes, not the receipt.

---

## The three layers

### 1. Marmot / MLS — the room

**Marmot** specifies efficient end-to-end encrypted group messaging using Nostr's decentralized identity and relay network combined with the **Messaging Layer Security (MLS)** protocol.

Kimchi uses Marmot as the core messaging substrate, not as a bolt-on:

- **Group creation** is an MLS group with a public Nostr group id and a set of relays.
- **Membership** is MLS group state. Adding or removing a member is an MLS commit, and every member converges on the same epoch.
- **KeyPackages** (`kind 30443`) advertise a device to potential inviters.
- **Invites** are MLS **Welcomes**, delivered as NIP-59 gift-wrapped events to the recipient's inbox relays.
- **Chat** is an MLS application message. The relay sees a `kind 445` ciphertext event, not the text.
- **Forward secrecy and post-compromise security** come from MLS's epoch-based key schedule, not from a server promise.
- **No central server** holds the group. Members store the MLS state locally and use relays as dumb transport.

Kimchi adds an application protocol inside the group for tabs: `kind 20001` rumors with `kimchi.tab`, `kimchi.payment`, `kimchi.paid`, and `kimchi.closing` payloads. The relay cannot distinguish a tab message from a chat message; both are MLS ciphertext.

This is the Marmot track story: the bill is not a separate product with a group-chat feature. It is a **Marmot-native application** where the group, the invite, the chat, the media, and the settlement all ride the same encrypted group state.

### 2. Nostr — identity, discovery, transport

Nostr supplies the decentralized identity and relay layer:

- **Identity:** a secp256k1 keypair. The public key is the `npub`. No phone number, no email, no signup server.
- **Transport:** relays. Marmot group messages are `kind 445` events; the relay routes ciphertext and knows the group id, author pubkey, timestamp, and size.
- **Discovery:** NIP-65 outbox relay lists (`kind 10002`) and Marmot invite-inbox relays (`kind 10050`). NIP-05 is optional.
- **Invites:** KeyPackages are `kind 30443` addressable events; Welcomes and join requests are NIP-59 gift wraps (`kind 1059`) whose inner rumor is encrypted to the recipient.
- **Join links:** Kimchi mints a capability token for a group and shares a URL. A guest opens it, publishes a fresh KeyPackage, and sends a NIP-17-style gift-wrapped join request to the host. The host validates the token and adds them. The guest auto-accepts the Welcome.
- **Invite cards:** a shareable npub + KeyPackage card, with QR scanning, as the fallback when relay discovery is slow.

Nostr does not provide confidentiality by itself. Marmot supplies the group encryption; Nostr supplies identity, routing, and censorship-resistant transport.

### 3. Cashu — the money

Cashu is Chaumian ecash. A mint issues blind-signed proofs; wallets hold and swap them. Kimchi uses the parts that make a private group tab possible:

- **NUT-10 / NUT-11 P2PK:** the host derives a fresh keypair per guest share and builds a payment request locked to that share's public key.
- **NUT-18 payment requests:** the request is a `creqA…` string containing the amount, mint, description, and P2PK lock. The guest pays the request from their wallet.
- **NUT-07 proof states:** before redeeming, the host checks that the proofs are unspent and not pending.
- **NUT-04 / NUT-05 / NUT-03:** mint, melt, and swap operations used by the wallet for funding, receiving, and paying.
- **Minibits** (`https://mint.minibits.cash/Bitcoin`) is the default. Live verification: it advertises NUT-10, NUT-11, and NUT-07. NUT-18 is a wallet-level request format, not a mint capability; the mint only needs to honor the P2PK lock and process the swap/redeem.

**Payment flow**

1. The host computes the total in sats and splits it equally.
2. For each guest share, the host generates a fresh P2PK keypair.
3. The host publishes a `kimchi.tab` message inside MLS containing one `creqA…` per guest, each locked to that share's public key.
4. The guest's wallet pays the request. The resulting proofs are locked to the host's share key.
5. The guest sends the NUT-18 payload back inside a `kimchi.payment` MLS message.
6. The host verifies the request, checks NUT-07 states, and redeems with the share private key.
7. The host publishes `kimchi.paid` so every member sees the tab fill.

Because each share uses a fresh key, the mint sees distinct locks rather than one reusable address. It still sees amounts and timing; the privacy model is explicit about that.

---

## Privacy model

### Hidden from the relay

- Message contents, including chat, receipts, and tab amounts.
- Who paid whom.
- The tab's internal structure and share amounts.

### Hidden from the mint

- The group, the members, and the social context.
- Which guest paid which share (from the mint's view alone).
- A reusable payment address: every share uses a fresh P2PK key.

### Not hidden

- **Relays:** group id, sender pubkey, timing, message sizes, and the fact that a group is active. IP-level metadata is not covered.
- **Mint:** amounts, timing, distinct locks, and redemption patterns. The mint can correlate amounts and timing if it tries.
- **Local device:** MLS state, Cashu proofs, and tab secrets live on the device. A compromised device reveals local state.
- **Network:** IP addresses are visible to relays, mints, and media servers unless you use Tor/VPN.

Kimchi never says "anonymous" or "untraceable." It says what it hides and what it does not. See [docs/PRIVACY.md](./docs/PRIVACY.md) for the full adversary matrix.

---

## Protocol details

### Kimchi messages

All tab events are app-level rumors inside the MLS group (`kind 20001`):

```json
{
  "v": 1,
  "type": "kimchi.tab",
  "tab": {
    "tab_id": "uuid",
    "title": "Seoul dinner",
    "host": "<hex pubkey>",
    "mint": "https://mint.minibits.cash/Bitcoin",
    "unit": "sat",
    "currency": "KRW",
    "fiat_total": 18000,
    "rate": 180000000,
    "rate_at": "2026-11-06T00:00:00.000Z",
    "total_sats": 10000,
    "expires_at": "2026-11-07T00:00:00.000Z",
    "shares": [
      {
        "share_id": "uuid:0",
        "member": "<host pubkey>",
        "label": "…",
        "amount_sats": 3334,
        "creq": "",
        "covered": true
      },
      {
        "share_id": "uuid:1",
        "member": "<guest pubkey>",
        "label": "…",
        "amount_sats": 3333,
        "creq": "creqA…",
        "covered": false
      }
    ]
  }
}
```

| Message          | Direction     | Meaning                                                      |
| ---------------- | ------------- | ------------------------------------------------------------ |
| `kimchi.tab`     | Host → group  | Opens a tab and publishes one payment request per share.     |
| `kimchi.payment` | Guest → group | Carries a NUT-18 payload with P2PK-locked proofs.            |
| `kimchi.paid`    | Host → group  | Confirms a share was redeemed; updates the tab for everyone. |
| `kimchi.closing` | Host → group  | Closes the tab (`settled`, `expired`, or `host_closed`).     |

The group chat and the tab share the same MLS epoch and the same encrypted transport.

### Group lifecycle

- A tab opens with `kimchi.tab`.
- Guests pay with `kimchi.payment`; the host redeems and publishes `kimchi.paid`.
- When every open share is paid, the host can settle; the tab sends `kimchi.closing` and deletes local tab secrets.
- **The group chat stays.** Deleting the group is a separate admin action and warns if a tab is still open with unpaid shares.
- Invites are KeyPackage discovery + MLS Welcome delivery; join links add a capability-token join request on top.

---

## Run

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

The default relays are `relay.damus.io`, `nos.lol`, and `relay.primal.net`. The default mint is Minibits. Any NUT-11-capable mint works; the tab form checks the mint's capabilities before creating a tab.

### Test and build

```bash
pnpm test     # Vitest: protocol, transport, migration, integration, tab status
pnpm build    # tsc -b && vite build
pnpm exec tsc -b
```

The browser smoke scripts in `scripts/` exercise the shell, group creation, share link, contacts, wallet, and group deletion against a running dev server.

---

## Deploy

The hosted build is a subpath deployment at `https://www.jakedat.com/kimchi/`:

```powershell
$env:VITE_BASE_PATH="/kimchi/"
pnpm build
Copy-Item -Recurse -Force dist\* ..\jakedat.com\public\kimchi\
```

`jakedat.com` serves the built app and the project page; Vercel deploys it on push. The PWA scope is `/kimchi/`.

---

## Status and roadmap

**Working**

- Marmot group chat with replies, reactions, and encrypted media.
- Join links with gift-wrapped join requests and automatic acceptance.
- Invite cards, QR scanning, and an expiring contacts book.
- Cashu wallet with Lightning top-up, receive/send, and account-scoped proofs.
- Kimchi tabs with per-share P2PK requests, auto-redeem, and inline tab cards in chat.
- Group deletion with an unpaid-tab warning.

**Next**

- `kimchi.tab.v1` as a Marmot app component so White Noise and other clients render tabs natively.
- An agent host that opens and redeems tabs for a group.
- Multi-tab trip sessions and a Lightning fallback for guests without ecash.
- NIP-40 expiration and relay-side deletion for closed tabs.
- Seed-based wallet recovery, multi-mint support, and optional Tor transport.
- Push notifications without leaking message metadata.

---

## Credits

Forked from [`marmot-protocol/marmots-web-chat`](https://github.com/marmot-protocol/marmots-web-chat), the `marmot-ts` reference client. Built with [`@internet-privacy/marmot-ts`](https://github.com/marmot-protocol/marmot-ts), [`@cashu/cashu-ts`](https://github.com/cashubtc/cashu-ts), and the Marmot protocol. Thanks to the Marmot/White Noise, Cashu, and Minibits teams.
