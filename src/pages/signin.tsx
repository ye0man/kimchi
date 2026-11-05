import { useState } from "react";
import { useNavigate } from "react-router";

import { JarMascot } from "@/components/kimchi/jar-mascot";
import { useLang } from "@/lib/kimchi/i18n";
import {
  connectExtensionAccount,
  createNewAccount,
  importAccount,
} from "@/lib/accounts";
import { DEFAULT_NEW_ACCOUNT_RELAYS } from "@/lib/settings";
import "@/styles/kimchi.css";

export function SignInPage() {
  const navigate = useNavigate();
  const { lang, setLang, t } = useLang();
  const [mode, setMode] = useState<"create" | "import">("create");
  const [connecting, setConnecting] = useState(false);
  const [name, setName] = useState("");
  const [relay, setRelay] = useState(DEFAULT_NEW_ACCOUNT_RELAYS.join(", "));
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await connectExtensionAccount();
      navigate("/groups");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  };

  const create = () => {
    setError(null);
    try {
      const relays = relay.split(/[\s,]+/).filter(Boolean);
      createNewAccount({
        name: name.trim() || undefined,
        relays: relays.length ? relays : undefined,
      });
      navigate("/groups");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const importKey = () => {
    setError(null);
    try {
      importAccount(secret.trim());
      navigate("/groups");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="kimchi-root kimchi-signin">
      <div className="kimchi-card kimchi-signin-card">
        <div className="kimchi-signin-header">
          <JarMascot full />
          <div className="kimchi-logo">{t("appName")}</div>
          <p className="kimchi-signin-tagline">{t("tagline")}</p>
          <p className="kimchi-signin-subtitle">{t("signInSubtitle")}</p>
        </div>

        <div className="kimchi-signin-lang">
          <button
            type="button"
            className="kimchi-ghost kimchi-small"
            onClick={() => setLang(lang === "en" ? "ko" : "en")}
          >
            {t("language")}
          </button>
        </div>

        <div className="kimchi-tabs">
          <button
            type="button"
            className={`kimchi-tab-toggle${mode === "create" ? " is-active" : ""}`}
            onClick={() => {
              setMode("create");
              setError(null);
            }}
          >
            {t("newAccount")}
          </button>
          <button
            type="button"
            className={`kimchi-tab-toggle${mode === "import" ? " is-active" : ""}`}
            onClick={() => {
              setMode("import");
              setError(null);
            }}
          >
            {t("importKey")}
          </button>
        </div>

        {mode === "create" ? (
          <div className="kimchi-signin-body">
            <label className="kimchi-field" htmlFor="name">
              <span>{t("displayName")}</span>
              <input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("displayNamePlaceholder")}
                autoComplete="off"
              />
            </label>
            <label className="kimchi-field" htmlFor="relay">
              <span>{t("homeRelays")}</span>
              <input
                id="relay"
                value={relay}
                onChange={(event) => setRelay(event.target.value)}
                placeholder="wss://relay.example.com"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <p className="kimchi-hint">{t("relayHint")}</p>
            <button
              type="button"
              className="kimchi-button kimchi-wide"
              onClick={create}
            >
              {t("generateIdentity")}
            </button>
          </div>
        ) : (
          <div className="kimchi-signin-body">
            <label className="kimchi-field" htmlFor="secret">
              <span>{t("privateKey")}</span>
              <input
                id="secret"
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder={t("privateKeyPlaceholder")}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              className="kimchi-button kimchi-wide"
              onClick={importKey}
              disabled={!secret.trim()}
            >
              {t("import")}
            </button>
          </div>
        )}

        {error && <p className="kimchi-error">{error}</p>}

        <div className="kimchi-signin-divider">
          <span>{t("or")}</span>
        </div>

        <button
          type="button"
          className="kimchi-ghost kimchi-wide"
          disabled={connecting}
          onClick={() => void connect()}
        >
          {connecting ? t("connecting") : t("connectExtension")}
        </button>

        <p className="kimchi-signin-note">{t("signInNote")}</p>
        <p className="kimchi-signin-footer">{t("signInFooter")}</p>
      </div>
    </div>
  );
}
