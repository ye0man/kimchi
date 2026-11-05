import type { NostrEvent } from "applesauce-core/helpers/event";
import { EMPTY } from "rxjs";
import { describe, expect, it } from "vitest";
import { decodePaymentRequest } from "@cashu/cashu-ts";
import type { NostrNetworkInterface } from "@internet-privacy/marmot-ts/client";

import { makeTestClient } from "@/lib/marmot/__tests__/helpers";
import { createRequest, generateKey } from "@/lib/kimchi/cashu";
import { fiatToSats, splitSats } from "@/lib/kimchi/rate";
import { parseKimchiRumor, sendKimchiMsg } from "@/lib/kimchi/rumors";
import { KIMCHI_KIND, type KimchiTab } from "@/lib/kimchi/types";

function testNetwork(events: NostrEvent[] = []): NostrNetworkInterface {
  return {
    publish: async (relays, event) => {
      events.push(event);
      return Object.fromEntries(
        relays.map((relay) => [relay, { ok: true, from: relay }]),
      );
    },
    request: async () => [],
    subscription: () => EMPTY,
    getUserInboxRelays: async () => ["wss://inbox.test"],
  };
}

function tab(): KimchiTab {
  return {
    tab_id: "tab-1",
    title: "Seoul dinner",
    host: "a".repeat(64),
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
        member: "a".repeat(64),
        label: "You",
        amount_sats: 3334,
        creq: "",
        covered: true,
      },
      {
        share_id: "tab-1:1",
        member: "b".repeat(64),
        label: "b",
        amount_sats: 3333,
        creq: "creqA…",
      },
    ],
  };
}

describe("kimchi messages", () => {
  it("stores a custom kind rumor in the group history", async () => {
    const network = testNetwork();
    const client = makeTestClient(network);
    const group = await client.groups.create("Kimchi test", {
      relays: ["wss://relay.test"],
    });
    try {
      await sendKimchiMsg(client, group, {
        v: 1,
        type: "kimchi.tab",
        tab: tab(),
      });
      const rumors = await group.history.queryRumors({ kinds: [KIMCHI_KIND] });
      expect(rumors).toHaveLength(1);
      const parsed = parseKimchiRumor(rumors[0]);
      expect(parsed?.msg.type).toBe("kimchi.tab");
      expect(parsed?.msg.type === "kimchi.tab" && parsed.msg.tab.title).toBe(
        "Seoul dinner",
      );
    } finally {
      group.dispose();
    }
  });

  it("derives sats and splits with the remainder on the host", () => {
    const sats = fiatToSats(18_000, 180_000_000);
    expect(sats).toBe(10_000);
    expect(splitSats(sats, 3)).toEqual([3334, 3333, 3333]);
  });

  it("builds a NUT-18 request with a P2PK lock", () => {
    const keys = generateKey();
    const request = createRequest({
      id: "share-1",
      amount: 3333,
      mint: "https://mint.minibits.cash/Bitcoin",
      pubkey: keys.pubkey,
      description: "Kimchi test",
    });
    const encoded = request.toEncodedCreqA();
    const decoded = decodePaymentRequest(encoded);
    expect(decoded.amount?.toNumber()).toBe(3333);
    expect(decoded.nut10?.kind).toBe("P2PK");
    expect(decoded.nut10?.data).toBe(keys.pubkey);
  });
});
