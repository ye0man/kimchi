import { describe, expect, it } from "vitest";

import { mintCaps, tabMintProblems } from "@/lib/kimchi/mint";

function wallet(supported: number[], throws = false) {
  return {
    getMintInfo: () => ({
      isSupported: (nut: number) => {
        if (throws) throw new Error("nut is not supported by cashu-ts");
        return { supported: supported.includes(nut) };
      },
    }),
  };
}

describe("mint capabilities", () => {
  it("reads NUT-11 P2PK and NUT-07 proof state", () => {
    const caps = mintCaps(wallet([7, 10, 11]));
    expect(caps).toEqual({
      p2pk: true,
      proofState: true,
      paymentRequests: true,
    });
    expect(tabMintProblems(caps)).toEqual([]);
  });

  it("reports a mint without P2PK or proof-state support", () => {
    const caps = mintCaps(wallet([4, 5]));
    expect(caps.p2pk).toBe(false);
    expect(caps.proofState).toBe(false);
    expect(tabMintProblems(caps)).toHaveLength(2);
  });

  it("treats an unsupported NUT lookup as missing, not a crash", () => {
    const caps = mintCaps(wallet([], true));
    expect(caps.p2pk).toBe(false);
    expect(caps.proofState).toBe(false);
  });
});
