import { describe, expect, it } from "vitest";

import { openTabStatus } from "@/lib/kimchi/tab-status";
import type { KimchiPaidMsg, KimchiTab } from "@/lib/kimchi/types";

const host = "a".repeat(64);
const guest = "b".repeat(64);

function tab(): KimchiTab {
  return {
    tab_id: "tab-1",
    title: "Seoul dinner",
    host,
    mint: "https://mint.minibits.cash/Bitcoin",
    unit: "sat",
    currency: "KRW",
    fiat_total: 18_000,
    rate: 180_000_000,
    rate_at: new Date(0).toISOString(),
    total_sats: 10_000,
    expires_at: new Date(0).toISOString(),
    shares: [
      {
        share_id: "tab-1:0",
        member: host,
        label: "You",
        amount_sats: 3334,
        creq: "",
        covered: true,
      },
      {
        share_id: "tab-1:1",
        member: guest,
        label: "b",
        amount_sats: 3333,
        creq: "creqA…",
      },
    ],
  };
}

function paid(shareId: string): Map<string, KimchiPaidMsg> {
  return new Map([
    [
      shareId,
      {
        v: 1,
        type: "kimchi.paid",
        tab_id: "tab-1",
        share_id: shareId,
        payer: guest,
        amount_sats: 3333,
      },
    ],
  ]);
}

describe("open tab status", () => {
  it("is closed with no tab", () => {
    expect(
      openTabStatus({ tab: null, paid: new Map(), closing: null }).open,
    ).toBe(false);
  });

  it("ignores the host's covered share", () => {
    const status = openTabStatus({
      tab: tab(),
      paid: new Map(),
      closing: null,
      groupStatus: "active",
    });
    expect(status.open).toBe(true);
    expect(status.openShares).toHaveLength(1);
    expect(status.unpaid).toHaveLength(1);
    expect(status.outstanding).toBe(3333);
  });

  it("has nothing outstanding once every open share is paid", () => {
    const status = openTabStatus({
      tab: tab(),
      paid: paid("tab-1:1"),
      closing: null,
      groupStatus: "active",
    });
    expect(status.open).toBe(true);
    expect(status.unpaid).toHaveLength(0);
    expect(status.outstanding).toBe(0);
  });

  it("treats a closing or disbanded tab as closed", () => {
    expect(
      openTabStatus({
        tab: tab(),
        paid: new Map(),
        closing: { v: 1, type: "kimchi.closing" },
      }).open,
    ).toBe(false);
    expect(
      openTabStatus({
        tab: tab(),
        paid: new Map(),
        closing: null,
        groupStatus: "disbanded",
      }).open,
    ).toBe(false);
  });
});
