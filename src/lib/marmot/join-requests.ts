import { kinds, type NostrEvent } from "applesauce-core/helpers/event";
import type { Rumor } from "applesauce-common/helpers/gift-wrap";
import { unlockGiftWrap } from "applesauce-common/helpers/gift-wrap";
import {
  sealRumor,
  toRumor,
  wrapSeal,
} from "applesauce-common/operations/gift-wrap";
import type { EventSigner } from "applesauce-core/factories";
import { relaySet } from "applesauce-core/helpers/relays";

import { recordGroupMembers } from "@/lib/contacts";
import type { MarmotNetwork } from "@/lib/marmot/network";
import { describeInviteCandidate } from "@/lib/marmot/invitations";
import { inviteKeyPackages } from "@/lib/marmot/actions/invites";
import {
  ensureDeviceKeyPackage,
  rotateDeviceKeyPackage,
} from "@/lib/marmot/actions/key-packages";
import { npubShort, groupName } from "@/lib/marmot/actions/guards";
import { selectDeviceKeyPackage } from "@/lib/marmot/key-packages";
import type { AppGroup, AppMarmotClient } from "@/lib/marmot/types";
import {
  addPendingJoin,
  consumeInviteToken,
  type JoinLink,
} from "@/lib/marmot/invite-links";

export interface JoinRequest {
  v: 1;
  type: "kimchi.join_request";
  token: string;
  group_id: string;
  key_package: NostrEvent;
}

export interface JoinAck {
  v: 1;
  type: "kimchi.join_ack";
  group_id: string;
  ok: boolean;
  error?: string;
}

/** The slice of the account runtime a join request needs. */
export interface JoinHost {
  pubkey: string;
  clientId: string;
  signer: EventSigner;
  client: AppMarmotClient;
  network: MarmotNetwork;
  findGroup(groupId: string): AppGroup | undefined;
  requirePublishRelays(): Promise<string[]>;
  ensureKeyPackage(): Promise<void>;
  notify(text: string, level?: "info" | "warn" | "error"): void;
}

const seen = new Set<string>();

async function giftWrapTo(
  signer: EventSigner,
  recipient: string,
  content: string,
): Promise<NostrEvent> {
  const rumor: Rumor = await toRumor(signer)({
    kind: kinds.PrivateDirectMessage,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["p", recipient]],
    content,
  });
  const seal = await sealRumor(recipient, signer)(rumor);
  return wrapSeal(recipient)(seal);
}

async function sendAck(
  host: JoinHost,
  recipient: string,
  ack: JoinAck,
): Promise<void> {
  try {
    const wrapped = await giftWrapTo(
      host.signer,
      recipient,
      JSON.stringify(ack),
    );
    const relays = await host.network.getUserInboxRelays(recipient);
    await host.network.publish(relays, wrapped);
  } catch (error) {
    console.warn("kimchi: join ack failed", error);
  }
}

/** Gift-wrap and publish a join request to the host in a join link. */
export async function requestToJoin(
  host: JoinHost,
  link: JoinLink,
): Promise<void> {
  await host.ensureKeyPackage();
  let packages = await host.client.keyPackages.list();
  let current = selectDeviceKeyPackage(packages, host.clientId);
  if (!current || current.used || !current.published?.length) {
    const relays = await host.requirePublishRelays();
    if (current) {
      await rotateDeviceKeyPackage(host.client, host.clientId, relays);
    } else {
      await ensureDeviceKeyPackage(host.client, host.clientId, relays);
    }
    packages = await host.client.keyPackages.list();
    current = selectDeviceKeyPackage(packages, host.clientId);
  }
  const keyPackage = current?.published
    ?.slice()
    .sort((a, b) => b.created_at - a.created_at)[0];
  if (!keyPackage)
    throw new Error("Could not publish a key package to join with.");

  const request: JoinRequest = {
    v: 1,
    type: "kimchi.join_request",
    token: link.n,
    group_id: link.g,
    key_package: keyPackage,
  };
  const wrapped = await giftWrapTo(
    host.signer,
    link.h,
    JSON.stringify(request),
  );
  const inbox = await host.network.getUserInboxRelays(link.h);
  await host.network.publish(relaySet(link.r, inbox), wrapped);
  addPendingJoin(host.pubkey, {
    groupId: link.g,
    host: link.h,
    at: Date.now(),
  });
}

/** Validate a gift-wrapped join request and add the guest when the token is live. */
export async function processJoinRequest(
  host: JoinHost,
  event: NostrEvent,
): Promise<void> {
  if (seen.has(event.id)) return;
  seen.add(event.id);
  let rumor: Rumor;
  try {
    rumor = await unlockGiftWrap(event, host.signer);
  } catch {
    return;
  }
  let request: JoinRequest;
  try {
    request = JSON.parse(rumor.content) as JoinRequest;
  } catch {
    return;
  }
  if (request?.v !== 1 || request.type !== "kimchi.join_request") return;
  const group = host.findGroup(request.group_id);
  if (!group) {
    await sendAck(host, rumor.pubkey, {
      v: 1,
      type: "kimchi.join_ack",
      group_id: request.group_id,
      ok: false,
      error: "That group is not on this device.",
    });
    return;
  }
  const candidate = describeInviteCandidate(
    request.key_package,
    host.pubkey,
    group,
  );
  if (!candidate.invitable) {
    await sendAck(host, rumor.pubkey, {
      v: 1,
      type: "kimchi.join_ack",
      group_id: request.group_id,
      ok: false,
      error: candidate.reasons.join(", ") || "That key package cannot join.",
    });
    return;
  }
  const token = consumeInviteToken(
    host.pubkey,
    request.token,
    request.group_id,
  );
  if (!token) {
    await sendAck(host, rumor.pubkey, {
      v: 1,
      type: "kimchi.join_ack",
      group_id: request.group_id,
      ok: false,
      error: "This invite link has expired or was already used.",
    });
    return;
  }
  try {
    await inviteKeyPackages(host.client, group, [request.key_package]);
    recordGroupMembers(host.pubkey, group.idStr, [request.key_package.pubkey]);
    host.notify(
      `${npubShort(request.key_package.pubkey)} joined ${groupName(group)}`,
      "info",
    );
    await sendAck(host, rumor.pubkey, {
      v: 1,
      type: "kimchi.join_ack",
      group_id: group.idStr,
      ok: true,
    });
  } catch (error) {
    await sendAck(host, rumor.pubkey, {
      v: 1,
      type: "kimchi.join_ack",
      group_id: group.idStr,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Filter for gift wraps addressed to the host. */
export function joinRequestFilter(hostPubkey: string) {
  return {
    kinds: [kinds.GiftWrap],
    "#p": [hostPubkey],
    since: Math.floor(Date.now() / 1000) - 7 * 86_400,
  };
}
