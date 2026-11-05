import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  IconBookmark,
  IconClock,
  IconDotsVertical,
  IconMessageCircle,
  IconQrcode,
  IconSearch,
  IconSend,
  IconTrash,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useGroups, useMarmotAccount } from "@/hooks/use-marmot";
import { useProfile } from "@/hooks/use-profile";
import {
  dismissContact,
  pruneRecentContacts,
  saveContact,
  updateContactProfile,
  upsertContacts,
  useContacts,
  type Contact,
} from "@/lib/contacts";
import { createGroup, inviteKeyPackages } from "@/lib/marmot/actions/invites";
import { describeInviteCandidate } from "@/lib/marmot/invitations";

const RECENT_TTL_MS = 24 * 3_600_000;

function hoursLeft(contact: Contact, now: number): number {
  return Math.max(
    1,
    Math.ceil((contact.lastSeen + RECENT_TTL_MS - now) / 3_600_000),
  );
}

function ContactRow({
  contact,
  now,
  groups,
  busy,
  onStartChat,
  onInvite,
}: {
  contact: Contact;
  now: number;
  groups: number;
  busy: boolean;
  onStartChat: (contact: Contact) => void;
  onInvite: (contact: Contact) => void;
}) {
  const account = useMarmotAccount();
  const profile = useProfile(contact.pubkey);

  useEffect(() => {
    if (!account) return;
    const name = profile?.display_name || profile?.name;
    if (
      (name && name !== contact.name) ||
      (profile?.picture && profile.picture !== contact.picture)
    ) {
      updateContactProfile(account.pubkey, contact.pubkey, {
        name,
        picture: profile.picture,
      });
    }
  }, [
    account,
    contact.pubkey,
    contact.name,
    contact.picture,
    profile?.display_name,
    profile?.name,
    profile?.picture,
  ]);

  const goodbye = () => {
    if (!account) return;
    const name = contact.name ?? contact.pubkey.slice(0, 10);
    if (
      window.confirm(
        `Say goodbye to ${name}? They will be removed from your history and won't be added back automatically.`,
      )
    ) {
      dismissContact(account.pubkey, contact.pubkey);
    }
  };

  const keep = () => {
    if (!account) return;
    saveContact(account.pubkey, contact.pubkey);
  };

  const remove = () => {
    if (!account) return;
    const name = contact.name ?? contact.pubkey.slice(0, 10);
    if (window.confirm(`Remove ${name} from your contacts?`)) {
      dismissContact(account.pubkey, contact.pubkey);
    }
  };

  return (
    <div className="kimchi-surface kimchi-card-lift flex flex-col gap-2 p-2.5">
      <div className="flex items-center gap-3">
        <UserAvatar pubkey={contact.pubkey} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <UserName
              pubkey={contact.pubkey}
              className="truncate text-sm font-black"
            />
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black tracking-[0.08em] uppercase ${
                contact.saved
                  ? "bg-kimchi-green/15 text-kimchi-green-dark"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {contact.saved ? "Saved" : "Recent"}
            </span>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            {!contact.saved && <IconClock size={12} />}
            {!contact.saved
              ? `Expires in ${hoursLeft(contact, now)}h`
              : "Kept in your contacts"}
            {groups > 0 &&
              ` · ${groups} shared table${groups === 1 ? "" : "s"}`}
          </span>
        </div>

        {contact.saved ? (
          <Button
            size="sm"
            className="rounded-full"
            disabled={busy}
            onClick={() => onStartChat(contact)}
          >
            <IconMessageCircle className="size-4" /> Chat
          </Button>
        ) : (
          <Button
            size="sm"
            className="rounded-full"
            disabled={busy}
            onClick={keep}
          >
            <IconBookmark className="size-4" /> Keep
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Contact options"
              title="Contact options"
            >
              <IconDotsVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44 rounded-2xl">
            {contact.saved && (
              <DropdownMenuItem onSelect={() => onStartChat(contact)}>
                <IconMessageCircle /> Chat
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => onInvite(contact)}>
              <IconSend /> Invite to a table
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {contact.saved ? (
              <DropdownMenuItem variant="destructive" onSelect={remove}>
                <IconTrash /> Remove contact
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem variant="destructive" onSelect={goodbye}>
                <IconTrash /> Say goodbye
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/** Address book for finding people and one-tap re-inviting. */
export function ContactsPage() {
  const account = useMarmotAccount();
  const contacts = useContacts(account?.pubkey);
  const allGroups = useGroups() ?? [];
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteTarget, setInviteTarget] = useState<Contact | null>(null);
  const [inviteGroup, setInviteGroup] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!account) return;
    const tick = () => {
      pruneRecentContacts(account.pubkey);
      setNow(Date.now());
    };
    tick();
    const id = setInterval(tick, 15 * 60_000);
    return () => clearInterval(id);
  }, [account]);

  const groupsById = useMemo(
    () => new Map(allGroups.map((group) => [group.idStr, group])),
    [allGroups],
  );

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
      upsertContacts(account.pubkey, [{ pubkey, saved: true, explicit: true }]);
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
    const group = groupsById.get(inviteGroup);
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
      upsertContacts(account.pubkey, [{ pubkey, saved: true, explicit: true }]);
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
            Keep the people you want. Everyone else fades in a day.
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
                share a table with appear here for a day unless you keep them.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((contact) => (
                <ContactRow
                  key={contact.pubkey}
                  contact={contact}
                  now={now}
                  groups={
                    contact.groups.filter((id) => groupsById.has(id)).length
                  }
                  busy={busy === contact.pubkey}
                  onStartChat={(target) => void startChat(target)}
                  onInvite={(target) => {
                    setInviteTarget(target);
                    setInviteGroup(allGroups[0]?.idStr ?? "");
                  }}
                />
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
            {allGroups.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Create or join a group first.
              </p>
            )}
            {allGroups.map((group) => (
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
