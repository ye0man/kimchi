import { JarMascot } from "@/components/kimchi/jar-mascot";

export function GroupsIndexPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <JarMascot full />
      <div>
        <p className="text-lg font-black">Pick a table</p>
        <p className="mx-auto max-w-xs text-sm font-semibold text-muted-foreground">
          Open a group to chat, share a receipt, and settle the tab without
          leaving anything public.
        </p>
      </div>
      <div className="rounded-full bg-muted px-3 py-1 text-[10px] font-black tracking-[0.14em] text-muted-foreground uppercase">
        Share the date, not your data
      </div>
    </div>
  );
}
