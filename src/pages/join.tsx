import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { IconArrowRight, IconLoader2, IconUsers } from "@tabler/icons-react";

import { JarMascot } from "@/components/kimchi/jar-mascot";
import { Button } from "@/components/ui/button";
import { useAutoJoin } from "@/hooks/use-auto-join";
import { useMarmotAccount } from "@/hooks/use-marmot";
import { parseJoinLink, rememberPendingLink } from "@/lib/marmot/invite-links";
import { requestToJoin } from "@/lib/marmot/join-requests";
import "@/styles/kimchi.css";

/** Landing page for a host-shared join link. */
export function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const link = code ? parseJoinLink(code) : null;
  const account = useMarmotAccount();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  useAutoJoin();

  useEffect(() => {
    if (!account && link) rememberPendingLink(window.location.href);
  }, [account, link]);

  if (!link) {
    return (
      <Shell>
        <JarMascot />
        <h1 className="kimchi-title">That link is not valid</h1>
        <p className="kimchi-hint">
          Ask the host for a fresh Kimchi join link.
        </p>
        <Button
          className="w-full rounded-full"
          onClick={() => navigate("/groups")}
        >
          Open Kimchi
        </Button>
      </Shell>
    );
  }

  const expired = link.e < Date.now();

  const join = async () => {
    if (!account || status === "sending") return;
    setStatus("sending");
    setError(null);
    try {
      await requestToJoin(account, link);
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("idle");
    }
  };

  if (!account) {
    return (
      <Shell>
        <JarMascot full />
        <h1 className="kimchi-title">{link.t ?? "A Kimchi table"}</h1>
        <p className="kimchi-hint">
          Create a private identity first, then come back to this link to join.
        </p>
        <Button className="w-full rounded-full" asChild>
          <Link to="/signin">
            Create an identity <IconArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      {status === "sent" ? (
        <>
          <div className="grid size-14 place-items-center rounded-full bg-kimchi-green/15 text-kimchi-green-dark">
            <IconLoader2 className="size-7 animate-spin" />
          </div>
          <h1 className="kimchi-title">Request sent</h1>
          <p className="kimchi-hint">
            Waiting for the host to add you to{" "}
            <strong>{link.t ?? "the table"}</strong>. You will land in the chat
            automatically.
          </p>
          <Button
            variant="outline"
            className="w-full rounded-full"
            onClick={() => navigate("/invites")}
          >
            Check invites instead
          </Button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-full bg-kimchi-soft px-3 py-1.5 text-xs font-black text-kimchi-muted">
            <IconUsers size={14} /> You have been invited
          </div>
          <h1 className="kimchi-title">{link.t ?? "Join this table"}</h1>
          <p className="kimchi-hint">
            Hosted by <strong>{link.h.slice(0, 12)}…</strong>. Your key package
            is shared with the host only.
          </p>
          {expired && <p className="kimchi-error">This link has expired.</p>}
          {error && <p className="kimchi-error">{error}</p>}
          <Button
            className="w-full rounded-full"
            disabled={status === "sending" || expired}
            onClick={() => void join()}
          >
            {status === "sending" ? "Sending request…" : "Join the table"}
          </Button>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="kimchi-root kimchi-signin">
      <div className="kimchi-card kimchi-signin-card flex flex-col items-center gap-3 text-center">
        {children}
      </div>
    </div>
  );
}
