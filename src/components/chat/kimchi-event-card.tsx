import { memo } from "react";
import { useNavigate } from "react-router";
import {
  IconReceipt,
  IconCheck,
  IconClock,
  IconSoup,
} from "@tabler/icons-react";
import type { Rumor } from "applesauce-core/helpers/event";

import { UserName } from "@/components/user";
import { parseKimchiRumor } from "@/lib/kimchi/rumors";
import { formatKrw, formatSats } from "@/lib/kimchi/rate";

/** Inline timeline card for a Kimchi tab, payment, or closing event. */
export const KimchiEventCard = memo(function KimchiEventCard({
  groupId,
  message,
}: {
  groupId: string;
  message: Rumor;
}) {
  const navigate = useNavigate();
  const parsed = parseKimchiRumor(message);
  if (!parsed) return null;
  const { msg } = parsed;

  if (msg.type === "kimchi.tab") {
    return (
      <div className="px-3 py-1.5">
        <button
          type="button"
          onClick={() => navigate(`/groups/${groupId}/kimchi`)}
          className="kimchi-surface kimchi-card-lift flex w-full items-center gap-3 p-3 text-left"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <IconSoup size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-black tracking-[0.14em] text-muted-foreground uppercase">
              Tab opened by <UserName pubkey={message.pubkey} />
            </span>
            <span className="block truncate text-sm font-black">
              {msg.tab.title}
            </span>
            <span className="block text-xs font-bold text-muted-foreground">
              {formatKrw(msg.tab.fiat_total)} · {formatSats(msg.tab.total_sats)}{" "}
              sats
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-[11px] font-black text-primary-foreground">
            Open
          </span>
        </button>
      </div>
    );
  }

  if (msg.type === "kimchi.payment") {
    return (
      <div className="flex justify-center px-3 py-1">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-kimchi-line bg-card px-3 py-1 text-[11px] font-bold text-muted-foreground">
          <IconClock size={13} /> <UserName pubkey={msg.payer} /> paid their
          share
        </span>
      </div>
    );
  }

  if (msg.type === "kimchi.paid") {
    return (
      <div className="flex justify-center px-3 py-1">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-kimchi-green/40 bg-kimchi-green/10 px-3 py-1 text-[11px] font-bold text-kimchi-green-dark">
          <IconCheck size={13} /> Received {formatSats(msg.amount_sats)} sats
          from <UserName pubkey={msg.payer} />
        </span>
      </div>
    );
  }

  return (
    <div className="flex justify-center px-3 py-1">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-kimchi-line bg-card px-3 py-1 text-[11px] font-bold text-muted-foreground">
        <IconReceipt size={13} />
        {msg.reason === "settled"
          ? "Tab settled"
          : msg.reason === "expired"
            ? "Tab expired"
            : "Tab closed"}
      </span>
    </div>
  );
});
