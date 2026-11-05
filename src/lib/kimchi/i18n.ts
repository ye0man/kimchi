import { useCallback, useState } from "react";

export type Lang = "en" | "ko";

const en = {
  appName: "Kimchi",
  tagline: "Share the date, not your data.",
  subtitle: "Private group tabs for the moments you'd rather not publish.",
  createTitle: "Start a tab",
  createSubtitle: "One dinner, one trip, one clean settle.",
  titleLabel: "What is it for?",
  titlePlaceholder: "Seoul dinner",
  totalLabel: "Total (KRW)",
  splitLabel: "Split equally between",
  ttlLabel: "This tab disappears in",
  mintLabel: "Mint",
  createButton: "Create tab",
  creating: "Creating…",
  noTab: "No tab yet.",
  rateLocked: "Rate locked",
  expires: "expires",
  youOwe: "You owe",
  covered: "Covered by host",
  paid: "Paid",
  open: "Open",
  payButton: "Pay with ecash",
  paying: "Paying…",
  redeem: "Redeem payments",
  redeeming: "Redeeming…",
  settle: "Settle",
  closeTab: "Close tab",
  closed: "This tab is closed.",
  settled: "Settled!",
  waitingHost: "Waiting for the host to redeem.",
  wallet: "Wallet",
  balance: "Balance",
  addSats: "Add sats",
  invoice: "Lightning invoice",
  claim: "I paid — claim",
  pasteToken: "Paste an ecash token",
  receive: "Receive",
  copy: "Copy",
  privacy: "What leaks",
  relaySees: "What the relay sees",
  mintSees: "What the mint sees",
  noRelayEvent: "Publish a tab message to see the ciphertext.",
  backToGroups: "Back to groups",
  members: "members",
  perPerson: "each",
  language: "한국어",
  host: "Host",
  guest: "Guest",
  you: "You",
  amount: "Amount",
  invalidTotal: "Enter a total first.",
  walletNotReady: "Wallet is still loading.",
  noShare: "You are not on this tab.",
  error: "Something went wrong",
  sats: "sats",
  total: "Total",
  toCollect: "To collect",
  privacyNote:
    "The relay sees MLS ciphertext. The mint sees amounts and timing, not the group or who paid whom.",
} as const;

const ko: Record<keyof typeof en, string> = {
  appName: "김치",
  tagline: "데이터 대신 오늘을 나누세요.",
  subtitle: "공개하고 싶지 않은 순간을 위한 프라이빗 그룹 정산.",
  createTitle: "탭 열기",
  createSubtitle: "한 끼, 한 여행, 깔끔한 정산.",
  titleLabel: "무엇을 위한 탭인가요?",
  titlePlaceholder: "서울 저녁",
  totalLabel: "총액 (원)",
  splitLabel: "나눌 인원",
  ttlLabel: "이 탭은 다음 시간 뒤 사라져요",
  mintLabel: "민트",
  createButton: "탭 만들기",
  creating: "만드는 중…",
  noTab: "아직 탭이 없어요.",
  rateLocked: "환율 고정",
  expires: "만료",
  youOwe: "내가 낼 금액",
  covered: "호스트가 결제함",
  paid: "완료",
  open: "대기",
  payButton: "이캐시로 결제",
  paying: "결제 중…",
  redeem: "결제 수령",
  redeeming: "수령 중…",
  settle: "정산 완료",
  closeTab: "탭 닫기",
  closed: "이 탭은 닫혔어요.",
  settled: "정산 완료!",
  waitingHost: "호스트가 수령하기를 기다리는 중.",
  wallet: "지갑",
  balance: "잔액",
  addSats: "사토시 충전",
  invoice: "라이트닝 인보이스",
  claim: "결제했어요 — 받기",
  pasteToken: "이캐시 토큰 붙여넣기",
  receive: "받기",
  copy: "복사",
  privacy: "무엇이 보일까",
  relaySees: "릴레이가 보는 것",
  mintSees: "민트가 보는 것",
  noRelayEvent: "탭 메시지를 보내면 암호문이 보여요.",
  backToGroups: "그룹으로 돌아가기",
  members: "명",
  perPerson: "각",
  language: "English",
  host: "호스트",
  guest: "게스트",
  you: "나",
  amount: "금액",
  invalidTotal: "먼저 총액을 입력하세요.",
  walletNotReady: "지갑을 불러오는 중이에요.",
  noShare: "이 탭에 포함되어 있지 않아요.",
  error: "문제가 발생했어요",
  sats: "사토시",
  total: "총액",
  toCollect: "받을 금액",
  privacyNote:
    "릴레이는 MLS 암호문만 봅니다. 민트는 금액과 시각을 보지만 그룹이나 누가 누구에게 냈는지는 모릅니다.",
};

const dictionaries = { en, ko };

export function useLang() {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return localStorage.getItem("kimchi:lang") === "ko" ? "ko" : "en";
    } catch {
      return "en";
    }
  });

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem("kimchi:lang", next);
    } catch {}
  }, []);

  const t = useCallback(
    (key: keyof typeof en) => dictionaries[lang][key] ?? en[key],
    [lang],
  );

  return { lang, setLang, t };
}
