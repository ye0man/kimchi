export const KIMCHI_KIND = 20001;
export const KIMCHI_TAG = "kimchi";

export interface KimchiShare {
  share_id: string;
  member: string;
  label: string;
  amount_sats: number;
  creq: string;
  covered?: boolean;
}

export interface KimchiTab {
  tab_id: string;
  title: string;
  host: string;
  mint: string;
  unit: "sat";
  currency: "KRW";
  fiat_total: number;
  rate: number;
  rate_at: string;
  total_sats: number;
  expires_at: string;
  note?: string;
  shares: KimchiShare[];
}

export interface KimchiTabMsg {
  v: 1;
  type: "kimchi.tab";
  tab: KimchiTab;
}

export interface KimchiPaymentMsg {
  v: 1;
  type: "kimchi.payment";
  tab_id: string;
  share_id: string;
  payer: string;
  payload: string;
}

export interface KimchiPaidMsg {
  v: 1;
  type: "kimchi.paid";
  tab_id: string;
  share_id: string;
  payer: string;
  amount_sats: number;
}

export interface KimchiClosingMsg {
  v: 1;
  type: "kimchi.closing";
  tab_id: string;
  reason: "settled" | "expired" | "host_closed";
}

export type KimchiMsg =
  | KimchiTabMsg
  | KimchiPaymentMsg
  | KimchiPaidMsg
  | KimchiClosingMsg;

export interface KimchiSecrets {
  [shareId: string]: { privkey: string; pubkey: string };
}

export interface KimchiParsed {
  rumorId: string;
  created_at: number;
  pubkey: string;
  msg: KimchiMsg;
}
