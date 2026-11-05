import type { KimchiPaidMsg, KimchiShare, KimchiTab } from "./types";

export interface OpenTabStatus {
  open: boolean;
  openShares: KimchiShare[];
  unpaid: KimchiShare[];
  outstanding: number;
}

/**
 * Summarize whether a tab is still open and which shares remain unpaid.
 * @param args - Latest tab message, paid-share map, closing message, group status.
 * @returns Open state plus the unpaid shares and their total.
 */
export function openTabStatus(args: {
  tab: KimchiTab | null;
  paid: Map<string, KimchiPaidMsg>;
  closing: unknown;
  groupStatus?: string;
}): OpenTabStatus {
  const active =
    Boolean(args.tab) &&
    !args.closing &&
    args.groupStatus !== "disbanded" &&
    args.groupStatus !== "removed";
  if (!active || !args.tab) {
    return { open: false, openShares: [], unpaid: [], outstanding: 0 };
  }
  const openShares = args.tab.shares.filter((share) => !share.covered);
  const unpaid = openShares.filter((share) => !args.paid.has(share.share_id));
  const outstanding = unpaid.reduce((sum, share) => sum + share.amount_sats, 0);
  return { open: true, openShares, unpaid, outstanding };
}
