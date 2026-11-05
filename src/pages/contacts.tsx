import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  IconQrcode,
  IconSearch,
  IconSend,
  IconUserPlus,
} from "@tabler/icons-react";
import { normalizeToPubkey } from "applesauce-core/helpers";

import { JarMascot } from "@/components/kimchi/jar-mascot";
import { QrScanDialog } from "@/components/qr-scan-dialog";
import { UserAvatar, UserName } from "@/components/user";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useGroups, useMarmotAccount } from "@/hooks/use-marmot";
import { useContacts } from "@/lib/contacts";
import { upsertContacts } from "@/lib/contacts";
import { createGroup, inviteKeyPackages } from "@/lib/marmot/actions/invites";
import { describeInviteCandidate } from "@/lib/marmot/invitations";
import type { Contact } from "@/lib/contacts";

/** Address book for finding people and one-tap re-inviting. */
export function ContactsPage() {
  const account = useMarmotAccount();
  const contacts = useContacts(account?.pubkey);
  const groups = useGroups() ?? [];
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteTarget, setInviteTarget] = useState<Contact | null>(null);
  const [inviteGroup, setInviteGroup] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (contact) =>
        contact.pubkey.includes(q) ||
        (contact.name ?? "").toLowerCase().includes(q),
    );
  }, [contacts, query]);

  const resolve = async (value: string): Promise<string | null> => {
    if (!account) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const hex = normalizeToPubkey(trimmed);
    if (hex) return hex;
    if (trimmed.includes("@")) {
      const identity = await account.directory.resolveNip05(trimmed);
      return identity.pubkey;
    }
    return null;
  };

  const add = async () => {
    if (!account) return;
    setBusy("add");
    setError(null);
    try {
      const pubkey = await resolve(input);
      if (!pubkey) throw new Error("Enter an npub, hex key, or name@domain.");
      upsertContacts(account.pubkey, [{ pubkey }]);
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const startChat = async (contact: Contact) => {
    if (!account) return;
    setBusy(contact.pubkey);
    setError(null);
    try {
      const { events } = await account.keyPackageDiscovery.load(contact.pubkey);
      const best = events
        .map((event) => describeInviteCandidate(event, account.pubkey))
        .filter((candidate) => candidate.invitable)
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      if (!best)
        throw new Error(
          "No usable key package found. Ask them to open Kimchi and try again.",
        );
      const relays = await account.requirePublishRelays();
      const created = await createGroup(
        account.client,
        contact.name ? `Kimchi with ${contact.name}` : "Kimchi table",
        { relays, invitees: [best.event] },
      );
      upsertContacts(account.pubkey, [
        {
          pubkey: contact.pubkey,
          groupId: created.group.idStr,
          keyPackage: best.event,
        },
      ]);
      navigate(`/groups/${created.group.idStr}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const sendInvite = async () => {
    if (!account || !inviteTarget || !inviteGroup) return;
    const group = groups.find((entry) => entry.idStr === inviteGroup);
    if (!group) return;
    setBusy(inviteTarget.pubkey);
    setError(null);
    try {
      const { events } = await account.keyPackageDiscovery.load(
        inviteTarget.pubkey,
      );
      const best = events
        .map((event) => describeInviteCandidate(event, account.pubkey, group))
        .filter((candidate) => candidate.invitable)
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      if (!best)
        throw new Error(
          "No usable key package found. Ask them to open Kimchi and try again.",
        );
      await inviteKeyPackages(account.client, group, [best.event]);
      upsertContacts(account.pubkey, [
        {
          pubkey: inviteTarget.pubkey,
          groupId: group.idStr,
          keyPackage: best.event,
        },
      ]);
      setInviteTarget(null);
      setInviteGroup("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const onScanned = async (value: string) => {
    setScan(false);
    if (!account) return;
    if (value.includes("/join/") || value.includes("/add/")) {
      const url = new URL(value, window.location.origin);
      const base = import.meta.env.BASE_URL || "/";
      navigate(url.pathname.replace(base, "/"));
      return;
    }
    setBusy("scan");
    setError(null);
    try {
      const pubkey = await resolve(value);
      if (!pubkey) throw new Error("That code is not a Kimchi contact.");
      upsertContacts(account.pubkey, [{ pubkey }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b bg-card/70 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-black">Contacts</h1>
          <p className="text-[11px] font-bold text-muted-foreground">
            Find people once. Invite them in a tap.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => setScan(true)}
        >
          <IconQrcode className="size-4" /> Scan
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <div className="kimchi-surface flex flex-col gap-2 p-3">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <IconUserPlus className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void add();
                  }}
                  placeholder="npub1…, hex key, or name@domain"
                  className="pl-9"
                />
              </div>
              <Button
                className="rounded-full"
                disabled={busy === "add" || !input.trim()}
                onClick={() => void add()}
              >
                {busy === "add" ? "…" : "Add"}
              </Button>
            </div>
            {error && (
              <p className="text-xs font-bold text-destructive">{error}</p>
            )}
          </div>

          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search contacts"
              className="pl-9"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <JarMascot />
              <p className="text-sm font-black">No contacts yet</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Add a friend&apos;s npub or scan their invite card. People you
                share a table with show up here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((contact) => (
                <div
                  key={contact.pubkey}
                  className="kimchi-surface kimchi-card-lift flex items-center gap-3 p-2.5"
                >
                  <UserAvatar pubkey={contact.pubkey} size={42} />
                  <div className="min-w-0 flex-1">
                    <UserName
                      pubkey={contact.pubkey}
                      className="block truncate text-sm font-black"
                    />
                    <span className="block truncate text-[11px] font-semibold text-muted-foreground">
                      {contact.groups.length
                        ? `${contact.groups.length} shared table${contact.groups.length === 1 ? "" : "s"}`
                        : contact.pubkey.slice(0, 16) + "…"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={busy === contact.pubkey}
                    onClick={() => {
                      setInviteTarget(contact);
                      setInviteGroup(groups[0]?.idStr ?? "");
                    }}
                  >
                    <IconSend className="size-4" /> Invite
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={busy === contact.pubkey}
                    onClick={() => void startChat(contact)}
                  >
                    Chat
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <QrScanDialog open={scan} onOpenChange={setScan} onResult={onScanned} />

      <Dialog
        open={Boolean(inviteTarget)}
        onOpenChange={(open) => {
          if (!open) setInviteTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite to a table</DialogTitle>
            <DialogDescription>
              Add{" "}
              {inviteTarget ? (
                <UserName pubkey={inviteTarget.pubkey} />
              ) : (
                "them"
              )}{" "}
              to one of your groups.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {groups.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Create or join a group first.
              </p>
            )}
            {groups.map((group) => (
              <button
                key={group.idStr}
                type="button"
                onClick={() => setInviteGroup(group.idStr)}
                className={`flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm font-bold ${
                  inviteGroup === group.idStr
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent/60"
                }`}
              >
                {group.groupData?.name || group.idStr.slice(0, 8)}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              className="rounded-full"
              disabled={!inviteGroup || Boolean(busy)}
              onClick={() => void sendInvite()}
            >
              {busy ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
