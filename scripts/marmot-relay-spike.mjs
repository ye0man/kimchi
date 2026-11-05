import { MarmotClient } from "@internet-privacy/marmot-ts";
import {
  createApplicationMessageIntent,
  createChatRumor,
} from "@internet-privacy/marmot-ts/client";
import { InMemoryKeyValueStore } from "@internet-privacy/marmot-ts/extra";
import { PrivateKeySigner } from "applesauce-signers";
import { RelayPool } from "applesauce-relay";
import { bytesToHex, randomBytes } from "@noble/hashes/utils.js";
import { lastValueFrom, toArray } from "rxjs";

const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
];

class RelayNetwork {
  constructor(pool, relays) {
    this.pool = pool;
    this.relays = relays;
  }
  async publish(relays, event) {
    const targets = relays.length ? relays : this.relays;
    const responses = await this.pool.publish(targets, event);
    const out = {};
    for (const response of responses) {
      out[response.from] = {
        ok: response.ok,
        from: response.from,
        message: response.message,
      };
    }
    console.log("publish", event.kind, targets.length, out);
    if (!responses.some((response) => response.ok)) {
      throw new Error("No relay acknowledged the published event");
    }
    return out;
  }
  async request(relays, filters, options) {
    const targets = relays.length ? relays : this.relays;
    return await lastValueFrom(
      this.pool.request(targets, filters, options).pipe(toArray()),
    );
  }
  subscription(relays, filters) {
    const targets = relays.length ? relays : this.relays;
    return this.pool.subscription(targets, filters);
  }
  async getUserInboxRelays() {
    return this.relays;
  }
}

function makeClient(pool, name) {
  const clientId = bytesToHex(randomBytes(32));
  return new MarmotClient({
    signer: new PrivateKeySigner(randomBytes(32)),
    network: new RelayNetwork(pool, RELAYS),
    groupStateStore: new InMemoryKeyValueStore(),
    keyPackageStore: new InMemoryKeyValueStore(),
    clientId,
  });
}

const pool = new RelayPool();
const creator = makeClient(pool, "creator");
const invitee = makeClient(pool, "invitee");

const creatorPk = await creator.signer.getPublicKey();
const inviteePk = await invitee.signer.getPublicKey();
console.log("creator", creatorPk);
console.log("invitee", inviteePk);

await invitee.keyPackages.create({ relays: RELAYS });
const [pkg] = await invitee.keyPackages.list();
console.log("key package published", pkg.published?.length);

const listener = await invitee.invites.listen(RELAYS);
console.log("invite listener started");

const group = await creator.groups.create("Kimchi relay spike", {
  relays: RELAYS,
  invitees: [pkg.published[0]],
});
console.log("group created", group.idStr, "epoch", group.state.groupContext.epoch.toString());
console.log("pending welcomes", group.pendingWelcomes?.length ?? 0);

let welcome = null;
for (let i = 0; i < 40; i++) {
  const unread = await invitee.invites.getUnread();
  if (unread.length) {
    welcome = unread[0];
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!welcome) throw new Error("No welcome received from relays");
console.log("welcome received", welcome.id);

const { group: joined } = await invitee.joinGroupFromWelcome({ welcomeRumor: welcome });
console.log("joined", joined.idStr, "epoch", joined.state.groupContext.epoch.toString());

function listenGroup(client, marmotGroup, label) {
  const h = bytesToHex(marmotGroup.groupData.nostrGroupId);
  const sub = client.network
    .subscription(marmotGroup.relays, [{ kinds: [445], "#h": [h] }])
    .subscribe({
      next: async (event) => {
        for await (const result of marmotGroup.ingest([event])) {
          if (result.kind === "unreadable") {
            console.warn(label, "unreadable event");
          }
        }
      },
      error: (error) => console.error(label, "subscription error", error),
    });
  return sub;
}

const creatorSub = listenGroup(creator, group, "creator");
const inviteeSub = listenGroup(invitee, joined, "invitee");

const received = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Timed out waiting for rumor")), 20000);
  joined.on("applicationMessage", (data) => {
    const rumor = JSON.parse(new TextDecoder().decode(data));
    console.log("invitee received rumor", rumor.kind, rumor.content);
    clearTimeout(timer);
    resolve(rumor);
  });
});

await new Promise((resolve) => setTimeout(resolve, 1500));

const payload = JSON.stringify({ type: "kimchi.tab", amount_sats: 43200, title: "Seoul dinner" });
await creator.groups.send(
  group.id,
  createApplicationMessageIntent(
    createChatRumor({ pubkey: creatorPk, content: payload }),
  ),
);
console.log("creator sent custom JSON rumor");

const rumor = await received;
console.log("OK JSON rumor:", rumor.content);

creatorSub.unsubscribe();
inviteeSub.unsubscribe();
listener.unsubscribe();
group.dispose();
joined.dispose();
pool.close();
process.exit(0);
