export const FALLBACK_KRW_PER_BTC = 180_000_000;

interface CoinGeckoResponse {
  bitcoin?: { krw?: number };
}

export async function fetchKrwPerBtc(): Promise<number> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=krw",
      { signal: AbortSignal.timeout(4000) },
    );
    if (!response.ok) return FALLBACK_KRW_PER_BTC;
    const data = (await response.json()) as CoinGeckoResponse;
    const rate = data.bitcoin?.krw;
    return typeof rate === "number" && rate > 0 ? rate : FALLBACK_KRW_PER_BTC;
  } catch {
    return FALLBACK_KRW_PER_BTC;
  }
}

export function fiatToSats(totalFiat: number, krwPerBtc: number): number {
  if (!Number.isFinite(totalFiat) || totalFiat <= 0) return 0;
  if (!Number.isFinite(krwPerBtc) || krwPerBtc <= 0) return 0;
  return Math.ceil(totalFiat / (krwPerBtc / 100_000_000));
}

export function splitSats(totalSats: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalSats / count);
  const shares = Array.from({ length: count }, () => base);
  shares[0] = totalSats - base * (count - 1);
  return shares;
}

export function formatKrw(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatSats(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
