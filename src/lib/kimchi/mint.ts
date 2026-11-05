/** Minimal mint-info surface needed for Kimchi's capability checks. */
export interface MintInfoLike {
  isSupported(nut: number): { supported: boolean } | undefined;
}

/** Minimal wallet surface needed for Kimchi's capability checks. */
export interface WalletLike {
  getMintInfo(): MintInfoLike;
}

export interface MintCaps {
  /** NUT-11: P2PK spending conditions. */
  p2pk: boolean;
  /** NUT-07: proof state checks before redemption. */
  proofState: boolean;
  /** NUT-18 is a wallet-level payment request format, always available here. */
  paymentRequests: true;
}

function supports(info: MintInfoLike, nut: number): boolean {
  try {
    return Boolean(info.isSupported(nut)?.supported);
  } catch {
    return false;
  }
}

/** Read the mint capabilities a Kimchi tab depends on. */
export function mintCaps(wallet: WalletLike): MintCaps {
  const info = wallet.getMintInfo();
  return {
    p2pk: supports(info, 11),
    proofState: supports(info, 7),
    paymentRequests: true,
  };
}

/** Human-readable reasons a mint cannot safely host a Kimchi tab. */
export function tabMintProblems(caps: MintCaps): string[] {
  const problems: string[] = [];
  if (!caps.p2pk)
    problems.push("This mint does not advertise NUT-11 P2PK locks.");
  if (!caps.proofState)
    problems.push("This mint does not advertise NUT-07 proof-state checks.");
  return problems;
}
