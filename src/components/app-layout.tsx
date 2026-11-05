import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  IconInbox,
  IconPlus,
  IconQrcode,
  IconSettings,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { use$ } from "applesauce-react/hooks";

import { useIsMobile } from "@/hooks/use-mobile";
import { useAutoJoin } from "@/hooks/use-auto-join";
import { MyQrDialog } from "@/components/marmot/my-qr-dialog";
import { JarMascot } from "@/components/kimchi/jar-mascot";
import { MobileBottomNav } from "@/components/mobile-nav";

import { cn } from "@/lib/utils";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Jdenticon } from "@/components/jdenticon";
import { UserAvatar, UserName } from "@/components/user";
import {
  useGroups,
  useKeyPackages,
  useMarmotAccount,
  useWatchedInvites,
} from "@/hooks/use-marmot";
import { summarizeKeyPackages } from "@/lib/marmot/key-packages";
import { NewGroupDialog } from "@/components/marmot/new-group-dialog";
import { Badge } from "@/components/ui/badge";

function GroupList() {
  const groups = useGroups() ?? [];
  const location = useLocation();

  if (groups.length === 0) {
    return (
      <div className="mx-auto flex max-w-xs flex-col items-center gap-2 px-4 py-8 text-center">
        <JarMascot />
        <p className="text-sm font-bold">No tables yet.</p>
        <p className="text-xs text-muted-foreground">
          Start a group, split the bill, and let the tab do the math.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {groups.map((group) => {
        const active = location.pathname.startsWith(`/groups/${group.idStr}`);
        return (
          <NavLink
            key={group.idStr}
            to={`/groups/${group.idStr}`}
            className={cn(
              "kimchi-press flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-sm",
              active ? "bg-primary/10 text-foreground" : "hover:bg-accent/70",
            )}
          >
            <span className="size-10 shrink-0 overflow-hidden rounded-2xl border bg-card">
              <Jdenticon value={group.idStr} size={40} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold">
                {group.groupData?.name || group.idStr.slice(0, 8)}
              </span>
              <span className="block truncate text-[11px] font-semibold text-muted-foreground">
                {group.groupData?.description || "Private group tab"}
              </span>
            </span>
            {active && (
              <span className="size-2 shrink-0 rounded-full bg-primary" />
            )}
          </NavLink>
        );
      })}
    </div>
  );
}

function SidebarNav() {
  const invites = useWatchedInvites();
  const joinable = invites.filter((entry) => entry.joinable);
  return (
    <div className="space-y-1">
      <NavLink
        to="/invites"
        className={({ isActive }) =>
          cn(
            "kimchi-press flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-sm font-bold",
            isActive ? "bg-primary/10 text-primary" : "hover:bg-accent/70",
          )
        }
      >
        <IconInbox size={18} aria-hidden />
        <span className="flex-1">Invites</span>
        {invites.length > 0 && (
          <Badge variant={joinable.length ? "default" : "secondary"}>
            {joinable.length || invites.length}
          </Badge>
        )}
      </NavLink>
      <NavLink
        to="/contacts"
        className={({ isActive }) =>
          cn(
            "kimchi-press flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-sm font-bold",
            isActive ? "bg-primary/10 text-primary" : "hover:bg-accent/70",
          )
        }
      >
        <IconUsers size={18} aria-hidden />
        <span className="flex-1">Contacts</span>
      </NavLink>
      <NavLink
        to="/wallet"
        className={({ isActive }) =>
          cn(
            "kimchi-press flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-sm font-bold",
            isActive ? "bg-primary/10 text-primary" : "hover:bg-accent/70",
          )
        }
      >
        <IconWallet size={18} aria-hidden />
        <span className="flex-1">Wallet</span>
      </NavLink>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={compact ? "scale-75" : "scale-90"}>
        <JarMascot />
      </span>
      <div className="min-w-0">
        <div className="text-xl leading-none font-black tracking-tight text-primary">
          Kimchi
        </div>
        {!compact && (
          <div className="mt-0.5 text-[10px] font-bold text-muted-foreground">
            Share the date, not your data.
          </div>
        )}
      </div>
    </div>
  );
}

export function AppLayout() {
  const account = useMarmotAccount();
  useAutoJoin();
  const notices = use$(() => account?.notices$, [account]);
  const packages = useKeyPackages();
  const invites = useWatchedInvites();
  const joinableInvites = invites.filter((entry) => entry.joinable);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [newGroup, setNewGroup] = useState(false);
  const [dismissedStatus, setDismissedStatus] = useState(-1);
  const notice = [...(notices ?? [])]
    .reverse()
    .find((line) => line.level !== "info" && line.id > dismissedStatus);
  const [showQr, setShowQr] = useState(false);
  useEffect(() => setDismissedStatus(-1), [account]);

  const path = location.pathname;
  const isGroupDetail = /^\/groups\/[^/]+/.test(path);
  const isSettings = path.startsWith("/settings");
  const isRootList = path === "/groups";
  const showBottomNav = isMobile && !isGroupDetail && !isSettings;
  const atMostRecent = isMobile && isRootList;

  return (
    <div className="flex h-dvh flex-col">
      {notice && (
        <Alert
          className="max-h-40 shrink-0 overflow-y-auto"
          variant={notice.level === "error" ? "destructive" : "default"}
        >
          <AlertTitle>
            {notice.level === "error" ? "Action failed" : "Needs attention"}
          </AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            <span className="min-w-0 flex-1">{notice.text}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDismissedStatus(notice.id)}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex min-h-0 flex-1">
        {!isMobile && (
          <aside className="flex w-80 shrink-0 flex-col border-r bg-sidebar">
            <div className="flex items-center justify-between gap-2 border-b p-3">
              <Brand />
              <Button
                size="icon"
                variant="ghost"
                title="New group"
                aria-label="New group"
                onClick={() => setNewGroup(true)}
              >
                <IconPlus className="size-5" />
              </Button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-2">
              <SidebarNav />
              <div className="px-2 pt-2 pb-1 text-[10px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                Your tables
              </div>
              <GroupList />
            </div>
            <div className="flex items-center gap-2 border-t p-2">
              {account && (
                <>
                  <UserAvatar pubkey={account.pubkey} size={34} />
                  <div className="min-w-0 flex-1">
                    <UserName
                      pubkey={account.pubkey}
                      className="block truncate text-sm font-bold"
                    />
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {summarizeKeyPackages(packages, account.clientId).unused}{" "}
                      key package(s)
                    </span>
                  </div>
                </>
              )}
              <Button
                size="icon"
                variant="ghost"
                title="Show my invite QR"
                onClick={() => setShowQr(true)}
              >
                <IconQrcode className="size-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Settings"
                onClick={() => navigate("/settings/profile")}
              >
                <IconSettings className="size-5" />
              </Button>
            </div>
          </aside>
        )}

        {isMobile && !isGroupDetail && !isSettings && (
          <div className="flex min-h-0 flex-1 flex-col">
            <header className="flex shrink-0 items-center gap-2 border-b bg-card/80 px-3 py-2 backdrop-blur">
              <Brand compact />
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  title="Invites"
                  aria-label={`Invites, ${invites.length} pending`}
                  className="relative"
                  onClick={() => navigate("/invites")}
                >
                  <IconInbox className="size-5" />
                  {invites.length > 0 && (
                    <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Show my invite QR"
                  onClick={() => setShowQr(true)}
                >
                  <IconQrcode className="size-5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="New group"
                  onClick={() => setNewGroup(true)}
                >
                  <IconPlus className="size-5" />
                </Button>
              </div>
            </header>
            <main className="min-h-0 flex-1 overflow-y-auto p-2">
              {atMostRecent ? <GroupList /> : <Outlet />}
            </main>
          </div>
        )}

        {(!isMobile || isGroupDetail || isSettings) && (
          <main className="min-w-0 flex-1 overflow-hidden">
            <Outlet />
          </main>
        )}
      </div>

      {showBottomNav && <MobileBottomNav />}

      <NewGroupDialog open={newGroup} onOpenChange={setNewGroup} />
      {account && (
        <MyQrDialog
          npub={account.npub}
          open={showQr}
          onOpenChange={setShowQr}
        />
      )}
    </div>
  );
}
