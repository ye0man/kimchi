# Kimchi privacy model

Kimchi is a privacy demo, not an anonymity system. This document states what
the design hides, what it exposes, and which assumptions it relies on.

## Scope

Kimchi protects the **content and social context** of a group tab:

- the chat text,
- the receipt and media,
- the tab's total and per-person amounts,
- who paid which share, from the relay's and mint's perspectives.

It does **not** hide network-level metadata, local device compromise, or the
fact that a payment happened at a mint.

## Adversaries

| Adversary             | Capability                                                 | Kimchi's answer                                                                                          |
| --------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Relay operator        | Stores and serves Nostr events; sees routing metadata.     | Group content is MLS ciphertext; the tab is an application rumor inside the group.                       |
| Mint operator         | Issues and redeems ecash; sees amounts, timing, and locks. | Each share uses a fresh P2PK key; the mint does not learn the group or payer identity from the protocol. |
| Other group members   | Holds the MLS group keys.                                  | They see the tab and payments by design; they are the group.                                             |
| Network observer      | Sees IP traffic and relay connections.                     | Not covered. Use Tor/VPN if this matters.                                                                |
| Local device attacker | Reads browser storage or the active session.               | Not covered; MLS state and Cashu proofs are local.                                                       |
| Blossom/media host    | Stores encrypted media blobs.                              | Sees opaque ciphertext and hashes via MIP-04, not the receipt.                                           |

## What the relay sees

For a group message:

- the outer `kind 445` event,
- the **sender's Nostr pubkey**,
- the **group id**,
- the event timestamp,
- the ciphertext size,
- the relays it was published to.

It does **not** see:

- chat text or receipt contents,
- tab amounts or shares,
- who paid whom,
- the inner rumor kind (chat vs. tab).

For invites and join requests, the relay sees a NIP-59 gift wrap (`kind 1059`)
addressed to the recipient. It can see the recipient and timing, but not the
KeyPackage, the token, or the message inside.

## What the mint sees

For a tab payment:

- the amount,
- the timestamp,
- the P2PK lock pubkey for that share,
- the swap/redeem operations,
- the fact that distinct locks were redeemed.

It does **not** see:

- the group id or group members,
- names or npubs,
- which guest paid which share, from the mint alone,
- a reusable payment address (each share uses a fresh key).

Correlation is still possible: a mint that also observes relay traffic or knows
the participants could try to match amounts and timing. Fresh keys raise the
cost; they do not make correlation impossible.

## What is hidden

- Message contents, including receipts and tab amounts.
- The tab's internal share structure from relays and the mint.
- The social graph from the mint.
- Payment address reuse: one fresh P2PK key per share.

## What is not hidden

- Relay metadata: group id, sender pubkey, timing, sizes, active group.
- Mint metadata: amounts, timing, distinct locks, redemption patterns.
- IP addresses at relays, mints, and media hosts.
- Local device state if the device or browser profile is compromised.
- The existence of a group and the fact that members publish to it.

## Mitigations implemented

- **MLS group encryption** for every chat, receipt, and tab message.
- **Per-share P2PK keys** (NUT-11) so the mint does not see a reusable address.
- **NUT-18 requests** so the payment request is a portable capability, not a
  public invoice tied to a group.
- **NUT-07 proof-state checks** before redemption to avoid double-spend and
  ambiguous states.
- **NIP-59 gift wraps** for invites and join requests, so the relay does not see
  the KeyPackage or join token.
- **Capability-token join links** with expiry and max uses; the host adds only
  live requests.
- **No Kimchi server**: no service that sees the group, the tab, or the wallet.
- **Expiring recent contacts**: the local address book does not keep people you
  did not explicitly save for more than a day.
- **Local tab secrets** deleted when a tab closes.

## Non-goals

Kimchi does not claim:

- anonymity against a global passive adversary,
- protection from IP-level correlation,
- protection from a compromised device or browser extension,
- that the mint cannot refuse service or freeze funds,
- that relays cannot retain ciphertext or observe traffic patterns,
- that a group member cannot screenshot or disclose the tab.

## Language for the demo

Use precise claims:

- "The relay sees MLS ciphertext, not the bill."
- "The mint sees an amount and a lock, not the group."
- "Every share uses a fresh key, so the mint does not see a reusable address."
- "Relays still see group ids, sender pubkeys, timing, and sizes."
- "IP metadata is out of scope for this demo."

Do not say "anonymous," "untraceable," or "the mint can't see anything." Those
claims are false and easy for a judge to challenge.
