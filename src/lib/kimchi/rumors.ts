import { createApplicationMessageIntent } from "@internet-privacy/marmot-ts/client";
import { toRumor } from "applesauce-common/operations/gift-wrap";
import type { Rumor } from "applesauce-common/helpers/gift-wrap";

import type { AppGroup, AppMarmotClient } from "@/lib/marmot/types";
import {
  KIMCHI_KIND,
  KIMCHI_TAG,
  type KimchiMsg,
  type KimchiParsed,
} from "./types";

export async function sendKimchiMsg(
  client: AppMarmotClient,
  group: AppGroup,
  msg: KimchiMsg,
): Promise<Rumor> {
  const rumor = await toRumor(group.signer)({
    kind: KIMCHI_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["t", KIMCHI_TAG],
      ["d", msg.type],
    ],
    content: JSON.stringify(msg),
  });
  await client.groups.send(group.id, createApplicationMessageIntent(rumor));
  return rumor;
}

export function parseKimchiRumor(rumor: Rumor): KimchiParsed | null {
  try {
    const msg = JSON.parse(rumor.content) as KimchiMsg;
    if (!msg || msg.v !== 1 || typeof msg.type !== "string") return null;
    if (!msg.type.startsWith("kimchi.")) return null;
    return {
      rumorId: rumor.id,
      created_at: rumor.created_at,
      pubkey: rumor.pubkey,
      msg,
    };
  } catch {
    return null;
  }
}
