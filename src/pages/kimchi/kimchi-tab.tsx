import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { getGroupMembers } from "@internet-privacy/marmot-ts";
import { use$ } from "applesauce-react/hooks";

import { Jdenticon } from "@/components/jdenticon";
import { JarMascot } from "@/components/kimchi/jar-mascot";
import {
  useGroup,
  useMarmotAccount,
  useMarmotClient,
} from "@/hooks/use-marmot";
import { lastPublishedEvent$ } from "@/lib/marmot/network";
import {
  clearSecrets,
  createRequest,
  generateKey,
  isRedeemed,
  loadSecrets,
  markRedeemed,
  MINIBITS_MINT,
  saveSecrets,
} from "@/lib/kimchi/cashu";
import { useLang } from "@/lib/kimchi/i18n";
import {
  fiatToSats,
  formatKrw,
  formatSats,
  FALLBACK_KRW_PER_BTC,
  fetchKrwPerBtc,
  splitSats,
} from "@/lib/kimchi/rate";
import { sendKimchiMsg } from "@/lib/kimchi/rumors";
import type { KimchiMsg, KimchiShare, KimchiTab } from "@/lib/kimchi/types";
import { useKimchiMessages, useKimchiState } from "@/lib/kimchi/use-kimchi";
import { useAccountWallet } from "@/lib/wallet/use-wallet";
import "@/styles/kimchi.css";

export function KimchiTabPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const account = useMarmotAccount();
  const client = useMarmotClient();
  const group = useGroup(id);
  const { lang, setLang, t } = useLang();

  const messages = useKimchiMessages(id);
  const { tab, paid, pending, closing } = useKimchiState(messages);
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState(18_000);
  const [ttlHours, setTtlHours] = useState(24);
  const [mint, setMint] = useState(MINIBITS_MINT);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const wallet = useAccountWallet(account?.pubkey, tab?.mint ?? mint);
  const lastEvent = use$(lastPublishedEvent$);
  const me = account?.pubkey ?? "";
  const attempted = useRef(new Set<string>());

  const members = useMemo(
    () => (group ? [...new Set(getGroupMembers(group.state))] : []),
    [group],
  );

  const myShare = tab?.shares.find((share) => share.member === me);
  const myPaymentPending = myShare
    ? pending.some(
        (payment) =>
          payment.share_id === myShare.share_id && payment.payer === me,
      )
    : false;
  const isHost = tab?.host === me;
  const openShares = tab ? tab.shares.filter((share) => !share.covered) : [];
  const allPaid =
    openShares.length > 0 &&
    openShares.every((share) => paid.has(share.share_id));
  const toCollect = openShares.reduce(
    (sum, share) => sum + share.amount_sats,
    0,
  );
  const collected = openShares
    .filter((share) => paid.has(share.share_id))
    .reduce((sum, share) => sum + share.amount_sats, 0);
  const closed =
    Boolean(closing) || (group ? group.status !== "active" : false);
  const walletLog = wallet.history
    .slice(0, 8)
    .map(
      (tx) =>
        `${new Date(tx.at).toLocaleTimeString()} ${tx.kind} ${tx.amount} sats`,
    );

  async function sendLocal(msg: KimchiMsg) {
    if (!client || !group || !account) return;
    const rumor = await sendKimchiMsg(client, group, msg);
    account.timeline(group).store.add(rumor);
  }

  async function createTab() {
    if (!client || !group || !account) return;
    if (!total || total <= 0) {
      setError(t("invalidTotal"));
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const rate = await fetchKrwPerBtc();
      const totalSats = fiatToSats(total, rate);
      const groupMembers = [...new Set(getGroupMembers(group.state))];
      if (!groupMembers.length) throw new Error("group has no members");
      const orderedMembers = [
        me,
        ...groupMembers.filter((member) => member !== me),
      ];
      const amounts = splitSats(totalSats, orderedMembers.length);
      const tabId = crypto.randomUUID();
      const secrets: Record<string, { privkey: string; pubkey: string }> = {};
      const shares: KimchiShare[] = orderedMembers.map((member, index) => {
        const shareId = `${tabId}:${index}`;
        const label = member.slice(0, 8);
        if (member === me) {
          return {
            share_id: shareId,
            member,
            label,
            amount_sats: amounts[index],
            creq: "",
            covered: true,
          };
        }
        const keys = generateKey();
        const request = createRequest({
          id: shareId,
          amount: amounts[index],
          mint,
          pubkey: keys.pubkey,
          description: `${title.trim() || t("appName")} · ${label}`,
        });
        secrets[shareId] = keys;
        return {
          share_id: shareId,
          member,
          label,
          amount_sats: amounts[index],
          creq: request.toEncodedCreqA(),
        };
      });
      saveSecrets(tabId, secrets);
      const nextTab: KimchiTab = {
        tab_id: tabId,
        title: title.trim() || t("appName"),
        host: me,
        mint,
        unit: "sat",
        currency: "KRW",
        fiat_total: total,
        rate,
        rate_at: new Date().toISOString(),
        total_sats: totalSats,
        expires_at: new Date(Date.now() + ttlHours * 3_600_000).toISOString(),
        shares,
      };
      await sendLocal({
        v: 1,
        type: "kimchi.tab",
        tab: nextTab,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function payShare() {
    if (!client || !group || !tab || !myShare || myShare.covered) return;
    setPaying(true);
    setError(null);
    try {
      const payload = await wallet.pay(
        myShare.creq,
        myShare.amount_sats,
        `${tab.title} · ${myShare.label}`,
      );
      await sendLocal({
        v: 1,
        type: "kimchi.payment",
        tab_id: tab.tab_id,
        share_id: myShare.share_id,
        payer: me,
        payload,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPaying(false);
    }
  }

  async function redeemPayments() {
    if (!client || !group || !tab || !isHost) return;
    setRedeeming(true);
    setError(null);
    const secrets = loadSecrets(tab.tab_id);
    try {
      for (const payment of pending) {
        const share = tab.shares.find(
          (candidate) => candidate.share_id === payment.share_id,
        );
        const secret = secrets[payment.share_id];
        if (!share || !secret) continue;
        if (isRedeemed(tab.tab_id, share.share_id)) {
          await sendLocal({
            v: 1,
            type: "kimchi.paid",
            tab_id: tab.tab_id,
            share_id: share.share_id,
            payer: payment.payer,
            amount_sats: share.amount_sats,
          });
          continue;
        }
        const received = await wallet.redeem(
          share.creq,
          payment.payload,
          share.amount_sats,
          secret.privkey,
        );
        markRedeemed(tab.tab_id, share.share_id);
        await sendLocal({
          v: 1,
          type: "kimchi.paid",
          tab_id: tab.tab_id,
          share_id: share.share_id,
          payer: payment.payer,
          amount_sats: received,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRedeeming(false);
    }
  }

  async function finish(reason: "settled" | "host_closed") {
    if (!client || !group || !tab || !isHost) return;
    const question =
      reason === "settled"
        ? "Settle this tab and close it for everyone? The chat stays open."
        : "Close this tab for everyone? The chat stays open.";
    if (!window.confirm(question)) return;
    try {
      await sendLocal({
        v: 1,
        type: "kimchi.closing",
        tab_id: tab.tab_id,
        reason,
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      clearSecrets(tab.tab_id);
      navigate(`/groups/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function addSats() {
    setError(null);
    try {
      await wallet.fund(5_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function claimSats() {
    if (!wallet.quote) return;
    setError(null);
    try {
      await wallet.claim(5_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function pasteToken() {
    setError(null);
    try {
      await wallet.receive(tokenInput);
      setTokenInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  // The host should not need a second tap for each incoming payment.
  useEffect(() => {
    if (!isHost || closed || redeeming || !wallet.wallet) return;
    const fresh = pending.filter(
      (payment) => !attempted.current.has(payment.share_id),
    );
    if (fresh.length === 0) return;
    fresh.forEach((payment) => attempted.current.add(payment.share_id));
    void redeemPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, closed, pending, redeeming, wallet.wallet]);

  if (!id) return null;
  if (group === undefined) {
    return <div className="kimchi-loading">Loading…</div>;
  }
  if (group === null) {
    return <div className="kimchi-loading">Group not found.</div>;
  }

  return (
    <div className="kimchi-root">
      <header className="kimchi-header">
        <button
          type="button"
          className="kimchi-ghost kimchi-back"
          onClick={() => navigate(`/groups/${id}`)}
          aria-label="Back to group"
        >
          ←
        </button>
        <JarMascot full={allPaid} />
        <div className="kimchi-brand">
          <div className="kimchi-logo">{t("appName")}</div>
          <div className="kimchi-tagline">{t("tagline")}</div>
        </div>
        <button
          type="button"
          className="kimchi-ghost kimchi-lang"
          onClick={() => setLang(lang === "en" ? "ko" : "en")}
        >
          {t("language")}
        </button>
      </header>

      {closed && (
        <section className="kimchi-card kimchi-center">
          <h2 className="kimchi-title">{t("closed")}</h2>
          <p className="kimchi-hint">
            {closing?.reason === "settled" ? t("settled") : t("closed")}
          </p>
          <button
            type="button"
            className="kimchi-button"
            onClick={() => navigate(`/groups/${id}`)}
          >
            Back to chat
          </button>
        </section>
      )}

      {!tab && !closed && (
        <section className="kimchi-card kimchi-form">
          <h2 className="kimchi-title">{t("createTitle")}</h2>
          <p className="kimchi-hint">{t("createSubtitle")}</p>

          <label className="kimchi-field">
            <span>{t("titleLabel")}</span>
            <input
              id="kimchi-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("titlePlaceholder")}
            />
          </label>

          <label className="kimchi-field">
            <span>{t("totalLabel")}</span>
            <input
              id="kimchi-total"
              type="number"
              min={1000}
              step={1000}
              value={total}
              onChange={(event) => setTotal(Number(event.target.value))}
            />
          </label>

          <div className="kimchi-field">
            <span>{t("splitLabel")}</span>
            <strong>
              {members.length} {t("members")}
            </strong>
          </div>

          <label className="kimchi-field">
            <span>{t("ttlLabel")}</span>
            <select
              id="kimchi-ttl"
              value={ttlHours}
              onChange={(event) => setTtlHours(Number(event.target.value))}
            >
              <option value={6}>6h</option>
              <option value={24}>24h</option>
              <option value={72}>72h</option>
              <option value={168}>7d</option>
            </select>
          </label>

          <label className="kimchi-field">
            <span>{t("mintLabel")}</span>
            <input
              id="kimchi-mint"
              value={mint}
              onChange={(event) => setMint(event.target.value)}
            />
          </label>

          <p className="kimchi-hint">
            {formatKrw(total)} ≈{" "}
            {formatSats(fiatToSats(total, FALLBACK_KRW_PER_BTC))} {t("sats")} ·{" "}
            {formatSats(
              splitSats(
                fiatToSats(total, FALLBACK_KRW_PER_BTC),
                Math.max(members.length, 1),
              )[0] ?? 0,
            )}{" "}
            {t("perPerson")}
          </p>
          <p className="kimchi-hint">
            Tip: attach the receipt photo in the chat first, then start the tab
            here.
          </p>

          <button
            type="button"
            id="kimchi-create"
            className="kimchi-button"
            onClick={() => void createTab()}
            disabled={creating}
          >
            {creating ? t("creating") : t("createButton")}
          </button>
        </section>
      )}

      {tab && !closed && (
        <section className="kimchi-card kimchi-tab-card">
          <div className="kimchi-kicker">
            {t("host")} · {tab.host.slice(0, 8)}
          </div>
          <h1 className="kimchi-title">{tab.title}</h1>
          <div className="kimchi-total">{formatKrw(tab.fiat_total)}</div>
          <div className="kimchi-sub">
            {formatSats(tab.total_sats)} {t("sats")} ·{" "}
            {formatSats(tab.shares[0]?.amount_sats ?? 0)} {t("perPerson")}
          </div>
          <div className="kimchi-meta">
            {t("rateLocked")} {formatKrw(tab.rate)}/BTC · {t("expires")}{" "}
            {new Date(tab.expires_at).toLocaleString(
              lang === "ko" ? "ko-KR" : "en-US",
            )}
          </div>

          <div className="kimchi-shares">
            {tab.shares.map((share) => {
              const isPaid = share.covered || paid.has(share.share_id);
              return (
                <div
                  key={share.share_id}
                  className={`kimchi-row${isPaid ? " is-paid" : ""}`}
                >
                  <span className="kimchi-avatar">
                    <Jdenticon value={share.member} size={36} />
                  </span>
                  <span className="kimchi-row-main">
                    <span className="kimchi-row-label">
                      {share.member === me ? t("you") : share.label}
                    </span>
                    <span className="kimchi-row-sub">
                      {formatSats(share.amount_sats)} {t("sats")}
                    </span>
                  </span>
                  <span className={isPaid ? "kimchi-stamp" : "kimchi-open"}>
                    {share.covered
                      ? t("covered")
                      : isPaid
                        ? t("paid")
                        : t("open")}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="kimchi-progress">
            <span>
              {t("toCollect")}: {formatSats(toCollect)} {t("sats")}
            </span>
            <span>
              {formatSats(collected)} {t("sats")}
            </span>
          </div>

          {allPaid && <div className="kimchi-settled">{t("settled")}</div>}

          <div className="kimchi-actions">
            {myShare &&
              !myShare.covered &&
              !paid.has(myShare.share_id) &&
              !myPaymentPending && (
                <button
                  type="button"
                  id="kimchi-pay"
                  className="kimchi-button"
                  onClick={() => void payShare()}
                  disabled={paying || wallet.busy || !wallet.wallet}
                >
                  {paying
                    ? t("paying")
                    : `${t("payButton")} · ${formatSats(myShare.amount_sats)} ${t("sats")}`}
                </button>
              )}
            {myShare &&
              !paid.has(myShare.share_id) &&
              wallet.balance < myShare.amount_sats && (
                <p className="kimchi-hint">
                  {t("addSats")} → {formatSats(myShare.amount_sats)} {t("sats")}
                </p>
              )}
            {isHost && pending.length > 0 && (
              <button
                type="button"
                id="kimchi-redeem"
                className="kimchi-button"
                onClick={() => void redeemPayments()}
                disabled={redeeming || wallet.busy || !wallet.wallet}
              >
                {redeeming
                  ? t("redeeming")
                  : `${t("redeem")} (${pending.length})`}
              </button>
            )}
            {isHost && allPaid && (
              <button
                type="button"
                id="kimchi-settle"
                className="kimchi-button kimchi-settle"
                onClick={() => void finish("settled")}
              >
                {t("settle")}
              </button>
            )}
            {isHost && (
              <button
                type="button"
                id="kimchi-close"
                className="kimchi-ghost kimchi-close"
                onClick={() => void finish("host_closed")}
              >
                {t("closeTab")}
              </button>
            )}
          </div>

          {myShare && !isHost && myPaymentPending && (
            <p className="kimchi-hint">{t("waitingHost")}</p>
          )}
        </section>
      )}

      {error && (
        <p className="kimchi-error">
          {t("error")}: {error}
        </p>
      )}
      {wallet.error && <p className="kimchi-error">{wallet.error}</p>}

      <details id="kimchi-wallet" className="kimchi-card kimchi-wallet">
        <summary>
          {t("wallet")} · {formatSats(wallet.balance)} {t("sats")}
        </summary>
        <div className="kimchi-wallet-body">
          <div className="kimchi-wallet-actions">
            <button
              type="button"
              id="kimchi-add-sats"
              className="kimchi-button kimchi-small"
              onClick={() => void addSats()}
              disabled={wallet.busy || !wallet.wallet}
            >
              {t("addSats")}
            </button>
          </div>

          {wallet.quote && (
            <div className="kimchi-quote">
              <p className="kimchi-hint">{t("invoice")}</p>
              <textarea readOnly value={wallet.quote.invoice} />
              <div className="kimchi-wallet-actions">
                <button
                  type="button"
                  className="kimchi-ghost kimchi-small"
                  onClick={() =>
                    void navigator.clipboard.writeText(wallet.quote!.invoice)
                  }
                >
                  {t("copy")}
                </button>
                <button
                  type="button"
                  id="kimchi-claim"
                  className="kimchi-button kimchi-small"
                  onClick={() => void claimSats()}
                  disabled={wallet.busy}
                >
                  {t("claim")}
                </button>
              </div>
            </div>
          )}

          <div className="kimchi-paste">
            <input
              id="kimchi-token"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder={t("pasteToken")}
            />
            <button
              type="button"
              id="kimchi-receive"
              className="kimchi-button kimchi-small"
              onClick={() => void pasteToken()}
              disabled={wallet.busy || !tokenInput.trim()}
            >
              {t("receive")}
            </button>
          </div>

          {walletLog.length > 0 && (
            <pre className="kimchi-log">{walletLog.join("\n")}</pre>
          )}
        </div>
      </details>

      <details className="kimchi-card kimchi-privacy">
        <summary>{t("privacy")}</summary>
        <div className="kimchi-privacy-body">
          <h3>{t("relaySees")}</h3>
          {lastEvent ? (
            <pre className="kimchi-cipher">
              {JSON.stringify(
                {
                  kind: lastEvent.kind,
                  id: lastEvent.id,
                  content: `${lastEvent.content.slice(0, 280)}…`,
                },
                null,
                2,
              )}
            </pre>
          ) : (
            <p className="kimchi-hint">{t("noRelayEvent")}</p>
          )}
          <h3>{t("mintSees")}</h3>
          <pre className="kimchi-log">
            {walletLog.length ? walletLog.join("\n") : "—"}
          </pre>
          <p className="kimchi-hint">{t("privacyNote")}</p>
        </div>
      </details>
    </div>
  );
}
