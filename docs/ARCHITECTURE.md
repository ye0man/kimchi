# Kimchi architecture

This document is the technical companion to the demo. It covers the group,
identity, tab, payment, and storage flows, plus the exact protocols Kimchi uses.

## Design principles

1. **The group is the product.** The tab is an application protocol inside a
   Marmot/MLS group, not a separate service with a chat feature.
2. **Relays are transport, not compute.** They carry ciphertext and routing
   metadata; they never hold group keys or plaintext.
3. **The mint is money, not identity.** It sees amounts and locks, not the
   group or the payer's social context.
4. **Local-first state.** MLS group state, Cashu proofs, and tab secrets live on
   the member's device. There is no Kimchi server.
5. **Be honest about metadata.** The privacy model names what leaks, not just
   what is hidden.

## Components

| Component                     | Responsibility                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| React PWA (`src/`)            | UI, routing, contacts, wallet page, tab page, invite flow.                                                     |
| `@internet-privacy/marmot-ts` | MLS group state, KeyPackages, Welcomes, commits, encrypted media, history.                                     |
| Applesauce                    | Nostr client, event store, signers, relay pool, gift-wrap operations.                                          |
| `@cashu/cashu-ts`             | Cashu wallet, mint loading, P2PK sends, NUT-18 requests, proof-state checks.                                   |
| Nostr relays                  | Ciphertext transport (`kind 445`), KeyPackages (`kind 30443`), Welcomes/join requests (`kind 1059` gift wrap). |
| Cashu mint                    | Blind-signature issuance, swaps, melts; Minibits by default.                                                   |
| Blossom server (optional)     | Encrypted media blobs (MIP-04).                                                                                |

## Identity and keys

- **Nostr identity:** a secp256k1 keypair. The public key is the `npub`. The
  private key stays in the browser (or a NIP-07 extension).
- **MLS identity:** the same Nostr key signs the MLS KeyPackage and group
  events. The group has a 32-byte public Nostr group id used as the relay
  routing identifier.
- **KeyPackage (`kind 30443`):** an addressable event advertising this device,
  its MLS ciphersuite, capabilities, and a key-package reference. Kimchi keeps
  one current package per browser slot and rotates it after use.
- **Tab share keys:** a fresh secp256k1 keypair per guest share. The private key
  is stored locally by the host and used only to redeem that share.
- **Wallet proofs:** Cashu proofs scoped by account and mint in localStorage
  (`kimchi:wallet:v1:<account>:proofs:<mint>`).

## Flow 1: create a group and invite by link

```
Host                          Relays                         Guest
 │                              │                              │
 │ create MLS group             │                              │
 │ publish KeyPackage           │                              │
 │ mint join token              │                              │
 │ share /join/<token> ─────────┼─────────────────────────────▶│
 │                              │                              │ open link
 │                              │◀── publish fresh KeyPackage ─│
 │                              │◀── NIP-59 gift-wrapped join ─│
 │                              │    request (token + KP)      │
 │◀── join request ─────────────┤                              │
 │ validate token + KP          │                              │
 │ MLS Add commit + Welcome ────▶│── gift-wrapped Welcome ─────▶│
 │                              │                              │ auto-accept
 │                              │                              │ join group
```

Details:

- The join token is a local capability: `{nonce, groupId, host, expiresAt,
maxUses}`. The host accepts a join request only for a live token.
- The join request is a NIP-17-style `kind 14` rumor inside a NIP-59 gift wrap
  (`kind 1059`), addressed to the host's inbox/outbox relays.
- The host validates the guest's KeyPackage with the same trust boundary used
  for the invite dialog (`createInviteIntent` + identity proof validation).
- The guest persists a pending join and auto-accepts the matching Welcome.

An **invite card** is the fallback: a URL carrying the guest's npub and a
published KeyPackage. The host opens it, picks a group, and sends the Welcome.
The contact book records both sides for one-tap re-invites.

## Flow 2: chat

```
Sender                      Relays                       Group members
 │                            │                              │
 │ app rumor (kind 9/7/1063/  │                              │
 │ 20001)                     │                              │
 │ MLS encrypt for epoch N    │                              │
 │ publish kind 445 ─────────▶│── ciphertext ───────────────▶│
 │                            │                              │ MLS decrypt
 │                            │                              │ project rumor
```

- Chat is `kind 9`; reactions are `kind 7`; media metadata is `kind 1063` with
  an `imeta` tag; Kimchi tab events are `kind 20001`.
- These are **rumors** (unsigned) inside MLS. The outer `kind 445` event is
  signed by the sender and published to the group relays.
- The relay sees the group id, sender pubkey, timestamp, size, and ciphertext.
- The group timeline is stored locally per group; the relay is not the source
  of truth for membership or history.

## Flow 3: open a tab

```
Host                          Group (MLS)                  Guests
 │                              │                            │
 │ total KRW → sats             │                            │
 │ split equally                │                            │
 │ per guest: fresh P2PK key    │                            │
 │ per guest: NUT-18 creqA      │                            │
 │ publish kimchi.tab ─────────▶│───────────────────────────▶│
 │                              │                            │ render tab
 │                              │                            │ see one amount
```

The tab message contains the total, rate, expiry, and one share per member. The
host's own share is marked `covered`. Each guest share carries a `creqA…`
payment request locked to a fresh P2PK pubkey.

## Flow 4: pay a share

```
Guest wallet                  Mint                         Host
 │                              │                            │
 │ decode creqA (NUT-18)        │                            │
 │ sendToRequest / P2PK swap ──▶│                            │
 │◀── locked proofs ────────────│                            │
 │ publish kimchi.payment ──────┼── inside MLS ─────────────▶│
 │                              │                            │ verify request
 │                              │◀── check proof states ─────│ (NUT-07)
 │                              │◀── receive with share key ─│ (NUT-11)
 │                              │── unblinded proofs ───────▶│
 │                              │                            │ publish kimchi.paid
```

- `sendToRequest` handles the NUT-18 request directly. If the wallet cannot use
  the request path, Kimchi falls back to a manual `send(...).asLocked(P2PK)`.
- The guest sends the encoded payload inside the encrypted group; the relay
  never sees the proofs or the amount.
- The host verifies the request (mint, amount, lock), checks NUT-07 states, and
  redeems with the share private key.
- `kimchi.paid` updates every member's view. The host auto-redeems incoming
  payments; the manual button remains as a retry path.

## Tab state machine

```
(no tab)
   │ host publishes kimchi.tab
   ▼
OPEN ── guest payments ──▶ PARTIALLY PAID ── all shares paid ──▶ SETTLED
   │                                                             │
   │ host closes early                                           │ host closes
   ▼                                                             ▼
CLOSED (host_closed)                                      CLOSED (settled)
```

- A closed tab keeps the group chat. Local tab secrets are deleted.
- Deleting the whole group is a separate admin action. If a tab is still open,
  the delete dialog shows unpaid shares and outstanding sats before allowing
  `Delete anyway`.

## Data model

```ts
interface KimchiTab {
  tab_id: string;
  title: string;
  host: string; // hex pubkey
  mint: string; // mint base URL
  unit: "sat";
  currency: "KRW";
  fiat_total: number;
  rate: number; // KRW per BTC, locked at creation
  rate_at: string; // ISO timestamp
  total_sats: number;
  expires_at: string;
  shares: KimchiShare[];
}

interface KimchiShare {
  share_id: string; // `${tab_id}:${index}`
  member: string; // hex pubkey
  label: string;
  amount_sats: number;
  creq: string; // NUT-18 creqA, empty for the covered host share
  covered?: boolean;
}
```

Messages: `kimchi.tab`, `kimchi.payment`, `kimchi.paid`, `kimchi.closing`.
Every message carries `v: 1` and a `type` discriminant.

## Storage and lifecycle

| Data                   | Store                         | Scope                           |
| ---------------------- | ----------------------------- | ------------------------------- |
| MLS group state        | IndexedDB (`groupStateStore`) | Account                         |
| Group history (rumors) | IndexedDB (`historyFactory`)  | Account + group                 |
| KeyPackages            | IndexedDB (`keyPackageStore`) | Account + browser slot          |
| Invites                | IndexedDB (`inviteStore`)     | Account                         |
| Cashu proofs           | localStorage                  | Account + mint                  |
| Wallet history         | localStorage                  | Account                         |
| Contacts               | localStorage                  | Account                         |
| Tab secrets            | localStorage                  | Host, per tab; deleted on close |

The account runtime restores local groups before publishing a fresh account's
relay lists, so a just-created group opens immediately even when relays are slow.

## Protocols and specs

| Area                     | Spec / API                                                |
| ------------------------ | --------------------------------------------------------- |
| Group messaging          | Marmot, MLS (RFC 9420)                                    |
| Group message event      | Nostr `kind 445`                                          |
| KeyPackage               | Nostr `kind 30443`                                        |
| Invites / join requests  | NIP-59 gift wrap (`kind 1059`), NIP-17-style DM rumor     |
| Relay discovery          | NIP-65 outbox (`kind 10002`), Marmot inbox (`kind 10050`) |
| Identity discovery       | NIP-05 (optional)                                         |
| Chat / reactions / media | `kind 9`, `kind 7`, `kind 1063`; MIP-04 encrypted media   |
| Ecash                    | Cashu NUT-00…NUT-07, NUT-10, NUT-11, NUT-18               |
| Payment request          | NUT-18 `creqA…`                                           |
| P2PK lock                | NUT-11 with NUT-10 spending condition                     |
| Proof state              | NUT-07                                                    |

## Failure handling

- **Invite discovery fails:** join link remains the primary path; invite cards
  and QR scanning are the fallback. KeyPackage discovery retries briefly.
- **Join request arrives while the host is offline:** gift wraps persist on
  relays; the host processes them on the next start.
- **Publish fails:** the delete/invite flows surface a relay-specific error and
  keep local state for retry. A disband publication has a 20s timeout in the UI.
- **Mint lacking P2PK:** tab creation is blocked with an explicit NUT-11 error;
  the wallet shows capability badges.
- **Payment already redeemed:** NUT-07 state checks reject spent proofs.
- **Tab closes with unpaid shares:** the host is warned before deleting the
  group; the tab closes either way.

## Interoperability and next step

Kimchi is a Marmot application. Any Marmot client can render the group chat.
The tab is currently an app-level `kind 20001` rumor; the next step is a
`kimchi.tab.v1` app component so White Noise and other Marmot clients can render
the same tab natively instead of showing a generic message.
