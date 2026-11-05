# Kimchi

**Share the date, not your data.**

Kimchi is a private group tab. A group of people split a bill, settle in ecash, and the tab disappears. The group chat is end-to-end encrypted with MLS over Nostr relays; the payments are Cashu ecash locked to the host with NUT-11 P2PK and requested with NUT-18 payment requests.

Built for bitcoin++ Seoul, privacy edition. Forked from the `marmot-ts` web chat reference.

**Live:** https://www.jakedat.com/kimchi/ · **Project page:** https://www.jakedat.com/projects/kimchi · **Source:** https://github.com/ye0man/kimchi

## What the demo shows

1. Three people join one Marmot group. No phone number, no email, no signup.
2. The host creates a tab: total in KRW, split equally, 24h lifetime, Minibits mint.
3. Each guest sees one number: what they owe, in sats.
4. A guest pays with one tap. The host redeems the locked ecash.
5. The tab fills up and settles.
6. The relay log shows MLS ciphertext. The mint log shows amounts, not the group.
7. The host closes the tab. The group vanishes.

## How it works

- **Group:** Marmot (MLS over Nostr relays). The relay sees `kind 445` ciphertext.
- **Tab messages:** a custom `kind 20001` rumor carried inside the MLS group. Types: `kimchi.tab`, `kimchi.payment`, `kimchi.paid`, `kimchi.closing`.
- **Request:** the host derives a fresh P2PK key per guest share and builds a NUT-18 payment request (`creqA…`) locked to that key.
- **Payment:** the guest pays the request from their Cashu wallet. The resulting P2PK-locked proofs are sent back inside an encrypted `kimchi.payment` message.
- **Redemption:** the host verifies the request, checks NUT-07 state, and redeems with the share private key.
- **Mint:** Minibits by default (`https://mint.minibits.cash/Bitcoin`). Any NUT-11-capable mint works.
- **Close:** a `kimchi.closing` message closes the tab and local tab secrets are deleted. The encrypted group chat stays; an admin can disband it separately.

## Run

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

The default account relays are `relay.damus.io`, `nos.lol`, and `relay.primal.net`.

## Deploy

The hosted build is a subpath deployment at `https://www.jakedat.com/kimchi/`, served from the `jakedat.com` Astro site on Vercel.

```powershell
$env:VITE_BASE_PATH="/kimchi/"
pnpm build
Copy-Item -Recurse -Force dist\* ..\jakedat.com\public\kimchi\
```

`jakedat.com` holds the Astro site, the Kimchi project entry (`src/content/projects/kimchi.md`), and the built app in `public/kimchi/`. Vercel rewrites the app routes under `/kimchi/` to `index.html`, and the PWA scope is `/kimchi/`.

## Demo setup

Use three browser profiles (or three devices):

1. Each profile opens the app and creates a local identity. The sign-in form creates the account on the three default relays.
2. The host creates a group and invites the guests. Discovery usually finds them by `npub`. If it does not, each guest opens **Show my invite QR → Copy key package**, and the host pastes it into **New group → Paste a key package**, or into **Invite → Paste a key package instead** for an existing group.
3. Each guest opens the group and taps the Kimchi icon in the header.
4. Fund each guest once: **Wallet → Add sats**, pay the 5,000-sat invoice, then **I paid — claim**. (Or paste a Minibits ecash token.)
5. The host creates the tab. The host's own share is marked **Covered by host**; guests pay their shares.
6. Each guest taps **Pay with ecash**. The host taps **Redeem payments**.
7. When every guest share is paid, the host taps **Settle** (or **Close tab** to close early).

## Privacy model

Hidden:

- Message contents, tab amounts, and who paid whom from the relays.
- The group and member identities from the mint.
- Address reuse: every share uses a fresh P2PK key.

Not hidden (yet):

- The mint sees amounts, timing, and the fact that distinct locks were redeemed.
- The relays see group IDs, timing, and message sizes.
- IP-level metadata is not covered by this demo.

The app never says "anonymous" or "untraceable". It says what it hides and what it does not.

## Roadmap

- A Marmot app component (`kimchi.tab.v1`) so White Noise and other clients render the tab natively.
- An agent host that opens a tab and redeems for a group.
- Multi-tab trip sessions.
- A Lightning fallback for guests without ecash.
- NIP-40 expiration on published events, plus relay-side deletion.

## Credits

Forked from [`marmot-protocol/marmots-web-chat`](https://github.com/marmot-protocol/marmots-web-chat), the `marmot-ts` reference client. Built with `@internet-privacy/marmot-ts`, `@cashu/cashu-ts`, and the Marmot protocol.
