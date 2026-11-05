import { Navigate, Route, Routes } from "react-router";
import { use$ } from "applesauce-react/hooks";

import { accounts } from "@/lib/accounts";
import { AppLayout } from "@/components/app-layout";
import { SignInPage } from "@/pages/signin";
import { GroupsIndexPage } from "@/pages/groups-index";
import { GroupChatPage } from "@/pages/group-chat";
import { GroupDebugPage } from "@/pages/group-debug";
import { KimchiTabPage } from "@/pages/kimchi/kimchi-tab";
import { InvitesPage } from "@/pages/invites";
import { ContactsPage } from "@/pages/contacts";
import { JoinPage } from "@/pages/join";
import { AddPage } from "@/pages/add";
import { WalletPage } from "@/pages/wallet";
import { SettingsLayout } from "@/pages/settings/_layout";
import { ProfileSettings } from "@/pages/settings/profile";
import { RelaySettings } from "@/pages/settings/relays";
import { KeyPackageSettings } from "@/pages/settings/key-packages";
import { AuditLogSettings } from "@/pages/settings/audit-log";
import { AdvancedSettings } from "@/pages/settings/advanced";
import CashuHarness from "@/pages/dev/cashu";

export function App() {
  const account = use$(accounts.active$);

  return (
    <Routes>
      <Route path="/dev/cashu" element={<CashuHarness />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/join/:code" element={<JoinPage />} />
      <Route path="/add/:code" element={<AddPage />} />
      {account ? (
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/groups" replace />} />
          <Route path="/groups" element={<GroupsIndexPage />} />
          <Route path="/groups/:id" element={<GroupChatPage />} />
          <Route path="/groups/:id/kimchi" element={<KimchiTabPage />} />
          <Route path="/groups/:id/debug" element={<GroupDebugPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/invites" element={<InvitesPage />} />
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="profile" replace />} />
            <Route path="profile" element={<ProfileSettings />} />
            <Route path="relays" element={<RelaySettings />} />
            <Route path="key-packages" element={<KeyPackageSettings />} />
            <Route path="audit-log" element={<AuditLogSettings />} />
            <Route path="advanced" element={<AdvancedSettings />} />
            <Route
              path="*"
              element={<Navigate to="/settings/profile" replace />}
            />
          </Route>
          <Route path="*" element={<Navigate to="/groups" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/signin" replace />} />
      )}
    </Routes>
  );
}
