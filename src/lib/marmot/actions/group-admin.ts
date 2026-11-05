import { encryptedMediaBlossomDefault } from "@internet-privacy/marmot-ts";
import { Proposals } from "@internet-privacy/marmot-ts/client";
import type { Proposal } from "@internet-privacy/marmot-ts/mls";

import {
  npubShort,
  requireActiveGroup,
  requireAdmin,
} from "@/lib/marmot/actions/guards";
import type { AppGroup, AppMarmotClient } from "@/lib/marmot/types";

// marmot-ts gap: the library exposes proposal builders and `groups.commit()`,
// but no one-call helpers for renaming, admin changes, member removal, media
// policy, or an admin's leave (which must hand over the admin role first).

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Commit a name and/or description change (admin only).
 * @param client - The account's Marmot client.
 * @param group - Group to update.
 * @param fields - Metadata fields to replace.
 */
export async function updateGroupInfo(
  client: AppMarmotClient,
  group: AppGroup,
  fields: { name?: string; description?: string },
): Promise<void> {
  requireAdmin(group, await client.signer.getPublicKey());
  const [proposal] = await Proposals.proposeUpdateMetadata(fields)(
    group.session.proposalContext(),
  );
  if (!proposal) return;
  await client.groups.commit(group.id, { extraProposals: [proposal] });
}

/**
 * Promote or demote a member (admin only); the last admin cannot be demoted.
 * @param client - The account's Marmot client.
 * @param group - Group to update.
 * @param pubkey - Member to change.
 * @param makeAdmin - True to promote, false to demote.
 */
export async function setMemberAdmin(
  client: AppMarmotClient,
  group: AppGroup,
  pubkey: string,
  makeAdmin: boolean,
): Promise<void> {
  requireAdmin(group, await client.signer.getPublicKey());
  const current = group.groupData?.adminPubkeys ?? [];
  if (makeAdmin === current.includes(pubkey)) return;
  const next = makeAdmin
    ? [...current, pubkey]
    : current.filter((key) => key !== pubkey);
  if (next.length === 0) throw new Error("cannot demote the last admin");
  const [proposal] = await Proposals.proposeUpdateMetadata({
    adminPubkeys: next,
  })(group.session.proposalContext());
  if (!proposal) return;
  await client.groups.commit(group.id, { extraProposals: [proposal] });
}

/**
 * Remove another member (admin only), dropping their admin role in the same commit.
 * @param client - The account's Marmot client.
 * @param group - Group to update.
 * @param pubkey - Member to remove.
 */
export async function removeMember(
  client: AppMarmotClient,
  group: AppGroup,
  pubkey: string,
): Promise<void> {
  const me = await client.signer.getPublicKey();
  requireAdmin(group, me);
  if (pubkey === me) throw new Error("use leave to remove yourself");
  const context = group.session.proposalContext();
  const extraProposals: Proposal[] =
    await Proposals.proposeRemoveUser(pubkey)(context);
  if (!extraProposals.length) return;
  const current = group.groupData?.adminPubkeys ?? [];
  if (current.includes(pubkey)) {
    const [metadata] = await Proposals.proposeUpdateMetadata({
      adminPubkeys: current.filter((key) => key !== pubkey),
    })(context);
    if (metadata) extraProposals.push(metadata);
  }
  await client.groups.commit(group.id, { extraProposals });
}

/**
 * Enable or update encrypted media (component `0x800b`) with the given Blossom servers (admin only).
 * @param client - The account's Marmot client.
 * @param group - Group to update.
 * @param baseUrls - Blossom server URLs; blanks are ignored.
 */
export async function setGroupMediaPolicy(
  client: AppMarmotClient,
  group: AppGroup,
  baseUrls: string[],
): Promise<void> {
  requireAdmin(group, await client.signer.getPublicKey());
  const urls = baseUrls.map((u) => u.trim()).filter(Boolean);
  if (!urls.length) throw new Error("provide at least one Blossom server URL");
  const [proposal] = await Proposals.proposeSetEncryptedMediaPolicy(
    encryptedMediaBlossomDefault(urls),
  )(group.session.proposalContext());
  if (!proposal) return;
  await client.groups.commit(group.id, { extraProposals: [proposal] });
}

/**
 * Step down from the admin set, then leave; local state is kept if publication fails.
 * @param client - The account's Marmot client.
 * @param group - Group to leave.
 */
export async function leaveGroup(
  client: AppMarmotClient,
  group: AppGroup,
): Promise<void> {
  requireActiveGroup(group);
  const me = await client.signer.getPublicKey();
  const admins = group.groupData?.adminPubkeys ?? [];
  if (admins.includes(me)) {
    if (!admins.some((pubkey) => pubkey !== me))
      throw new Error(
        "Promote another member to admin before leaving this group",
      );
    await client.groups.commit(group.id, {
      extraProposals: await Proposals.proposeUpdateMetadata({
        adminPubkeys: admins.filter((pubkey) => pubkey !== me),
      })(group.session.proposalContext()),
    });
  }
  await client.groups.leave(group.id);
}

/**
 * Permanently disband a group for every member (admin only). Enables the
 * lifecycle component first so older groups can still be deleted.
 * @param client - The account's Marmot client.
 * @param group - Group to disband.
 * @throws When lifecycle support is missing, the caller is not an admin, or
 * publication fails.
 */
export async function disbandGroup(
  client: AppMarmotClient,
  group: AppGroup,
): Promise<void> {
  // A previous delete already reached its terminal state: just purge the local
  // tombstone so it disappears from the UI and storage.
  if (group.status === "disbanded") {
    await client.groups.destroy(group.idStr);
    return;
  }
  requireActiveGroup(group);
  requireAdmin(group, await client.signer.getPublicKey());

  const enabled = await withTimeout(
    group.enableDisbanding(),
    20_000,
    "Deleting is taking longer than expected. Check your relay connection, then try again.",
  );
  if (enabled.kind === "rejected") {
    if (enabled.reason === "unsupportedMembers")
      throw new Error(
        "Some members use a client that cannot delete groups. Ask them to update Kimchi, or remove them first.",
      );
    if (enabled.reason === "notAdmin")
      throw new Error("Only a group admin can delete this group.");
    throw new Error(enabled.error);
  }
  if (enabled.kind === "publishFailed") throw new Error(enabled.error);

  const result = await withTimeout(
    group.disband(),
    20_000,
    "Deleting is taking longer than expected. Check your relay connection, then try again.",
  );
  switch (result.kind) {
    case "acknowledged":
      // The terminal commit is published. Purge the local tombstone so the
      // group disappears instead of lingering as a read-only, unnamed entry.
      await client.groups.destroy(group.idStr);
      return;
    case "pending":
      throw new Error(
        "Delete is queued but has not been published yet. Keep the app open, then try again.",
      );
    case "failed":
      throw new Error(`The group could not be deleted (${result.reason}).`);
    case "rejected":
      throw new Error(
        result.reason === "notEnabled"
          ? "This group cannot be deleted yet. Try again once every member has updated Kimchi."
          : result.error,
      );
    case "publishFailed":
      throw new Error(result.error);
  }
}

/**
 * Delete an unsupported (older-profile) group's local state.
 * @param client - The account's Marmot client.
 * @param group - Unsupported group to remove from this device.
 */
export async function removeLegacyGroup(
  client: AppMarmotClient,
  group: AppGroup,
): Promise<void> {
  if (group.profileSupport.kind !== "unsupported")
    throw new Error("Use Leave group for current groups");
  await client.groups.destroy(group.id);
}

/**
 * Retry the exact retained commit without regenerating membership or metadata changes.
 * @param group - Active group with a possibly pending publication.
 * @returns How many publications were retried, and warnings for partial success.
 */
export async function retryPendingChanges(
  group: AppGroup,
): Promise<{ published: number; warnings: string[] }> {
  const results = await requireActiveGroup(group).retryPendingPublication();
  const warnings: string[] = [];
  for (const result of results) {
    if (result.persistence.kind === "failed")
      warnings.push(
        `Changes published, but local persistence needs recovery: ${result.persistence.error}`,
      );
    if (result.welcomeDelivery.kind === "attempted")
      for (const outcome of result.welcomeDelivery.outcomes)
        if (outcome.kind === "failed")
          warnings.push(
            `Changes published, but Welcome delivery failed for ${npubShort(outcome.recipient.pubkey)}: ${outcome.error}`,
          );
  }
  return { published: results.length, warnings };
}
