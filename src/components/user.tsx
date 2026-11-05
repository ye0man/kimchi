import { useState } from "react";

import { cn } from "@/lib/utils";
import { useDisplayName, useProfile } from "@/hooks/use-profile";
import { FoodMascot } from "@/components/kimchi/food-mascots";

/** Reactive display name for a pubkey. */
export function UserName({
  pubkey,
  className,
}: {
  pubkey: string;
  className?: string;
}) {
  const name = useDisplayName(pubkey);
  return <span className={className}>{name}</span>;
}

/** Reactive avatar for a pubkey (picture if known, food mascot fallback). */
export function UserAvatar({
  pubkey,
  size = 32,
  className,
}: {
  pubkey: string;
  size?: number;
  className?: string;
}) {
  const profile = useProfile(pubkey);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const rounded = cn(
    "rounded-full overflow-hidden shrink-0 bg-muted",
    className,
  );
  if (profile?.picture && profile.picture !== failedSrc) {
    return (
      <img
        src={profile.picture}
        alt=""
        width={size}
        height={size}
        className={rounded}
        style={{ width: size, height: size, objectFit: "cover" }}
        onError={() => setFailedSrc(profile.picture!)}
      />
    );
  }
  return (
    <span className={rounded} style={{ width: size, height: size }}>
      <FoodMascot seed={pubkey} size={size} />
    </span>
  );
}
