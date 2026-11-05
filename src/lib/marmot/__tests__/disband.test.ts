import { EMPTY } from "rxjs";
import { describe, expect, it } from "vitest";
import type { NostrNetworkInterface } from "@internet-privacy/marmot-ts/client";

import { disbandGroup } from "@/lib/marmot/actions/group-admin";
import { makeTestClient } from "./helpers";

function testNetwork(): NostrNetworkInterface {
  return {
    publish: async (relays) =>
      Object.fromEntries(
        relays.map((relay) => [relay, { ok: true, from: relay }]),
      ),
    request: async () => [],
    subscription: () => EMPTY,
    getUserInboxRelays: async () => ["wss://inbox.test"],
  };
}

describe("disbandGroup", () => {
  it("purges the local group after the terminal commit is acknowledged", async () => {
    const client = makeTestClient(testNetwork());
    const group = await client.groups.create("Delete me", {
      relays: ["wss://relay.test"],
    });
    const id = group.idStr;

    await disbandGroup(client, group);

    expect(client.groups.loaded.some((entry) => entry.idStr === id)).toBe(
      false,
    );
    expect(await client.groups.loadAll()).toEqual([]);
  });
});
