# Kimchi demo runbook

**Tagline:** Share the date, not your data.

## Before the stage

- Three browser profiles: **Minji** (host), **Alex**, **Priya**.
- Each profile is signed in with its own identity on the three default relays.
- Minji has created a group with Alex and Priya as founding members.
  - If relay discovery is slow: each guest opens **Show my invite QR → Copy key package**; Minji pastes it into **New group → Paste a key package**, or into **Invite → Paste a key package instead** if the group already exists.
- Alex and Priya have opened the group and tapped the Kimchi icon once, so the tab page is warm.
- Alex and Priya each have ~5,000 sats in the Kimchi wallet:
  - **Wallet → Add sats → pay the invoice → I paid — claim**, or paste a Minibits ecash token.
- Minji has the group page open in one window and the Kimchi tab in another.

## Stage script (90 seconds)

1. "This is Kimchi. **Share the date, not your data.**"
2. Minji opens the Kimchi tab and creates: "Seoul dinner", ₩18,000, 3 ways, 24h, Minibits.
3. The tab appears on all three screens. Minji's row says **Covered by host**; Alex and Priya see what they owe in sats.
4. Alex taps **Pay with ecash**. Steam animation; row stamps **PAID**.
5. Priya taps **Pay with ecash**.
6. Minji taps **Redeem payments**. The jar fills; **Settled!**
7. Open **What leaks**:
   - "The relay sees this: a kind 445 ciphertext blob."
   - "The mint sees this: an amount and a swap. No group, no names."
8. Minji taps **Close tab**. The tab disappears; the group enters its closing state.
9. "Kimchi. **Share the date, not your data.**"

## Fallbacks

- **Discovery fails:** use **Copy key package** → **Paste a key package instead**. The invite dialog now explains this when no package is found.
- **Minibits is slow:** use the local `cdk-mintd` backup and label it; the UI takes any NUT-11 mint URL.
- **A payer has no ecash:** show the **Add sats** invoice flow, or use a pre-funded profile.
- **Stage Wi-Fi:** keep a pre-recorded 90-second video; switch to it without apologizing.
- **Redeem fails:** the host can retry; the pending count stays until a `paid` message is sent.

## What to say about privacy

- Hidden: message contents, tab amounts, who paid whom from relays; the group and member identities from the mint; address reuse via fresh P2PK keys.
- Not hidden: the mint sees amounts and timing; relays see group IDs, timing, and sizes; IP metadata is out of scope for this demo.
- Never say "anonymous" or "untraceable."

## Tracks

- Main competition (privacy).
- **Best Use of the Marmot Protocol** (IPF): 1M sats per winner + White Noise shirts.
- Best Beginner Hack only if every teammate is a first-time open-source Bitcoin contributor.
