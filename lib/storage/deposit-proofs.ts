import { tryCreateAdminClient } from "@/lib/supabase/admin";

const BUCKET = "deposit-proofs";
const SIGNED_URL_TTL_SECONDS = 60 * 10;

/** Start cleanup when deposit-proofs usage reaches this size. */
const CLEANUP_THRESHOLD_BYTES = 980 * 1024 * 1024; // 980 MB
/** Delete oldest objects until about this much space is reclaimed. */
const CLEANUP_FREE_BYTES = 100 * 1024 * 1024; // 100 MB

export type DepositProofUpload = {
  path: string;
  provider: "supabase";
};

type StorageFile = {
  path: string;
  size: number;
  createdAt: string;
};

function getAdmin() {
  return tryCreateAdminClient();
}

async function listFolderFiles(
  admin: NonNullable<ReturnType<typeof tryCreateAdminClient>>,
  folder: string
): Promise<StorageFile[]> {
  const files: StorageFile[] = [];
  let offset = 0;
  const limit = 100;

  for (;;) {
    const { data, error } = await admin.storage.from(BUCKET).list(folder || undefined, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error || !data?.length) break;

    for (const item of data) {
      const path = folder ? `${folder}/${item.name}` : item.name;
      const isFolder = !item.metadata || item.id === null;
      if (isFolder && !item.metadata) {
        // Directory placeholder — recurse
        files.push(...(await listFolderFiles(admin, path)));
        continue;
      }
      const size = Number(item.metadata?.size ?? 0);
      if (size <= 0 && !item.metadata) {
        files.push(...(await listFolderFiles(admin, path)));
        continue;
      }
      files.push({
        path,
        size,
        createdAt: item.created_at || item.updated_at || new Date(0).toISOString(),
      });
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return files;
}

async function listAllDepositProofs(
  admin: NonNullable<ReturnType<typeof tryCreateAdminClient>>
): Promise<StorageFile[]> {
  return listFolderFiles(admin, "");
}

export async function getDepositProofsUsageBytes(): Promise<number> {
  const admin = getAdmin();
  if (!admin) return 0;
  const files = await listAllDepositProofs(admin);
  return files.reduce((sum, f) => sum + f.size, 0);
}

/**
 * When deposit-proofs bucket usage is ≥ 980 MB, delete the oldest files
 * until ~100 MB is freed. Clears matching appointment_deposits.proof_path.
 */
export async function maybeCleanupDepositProofs(): Promise<{
  cleaned: boolean;
  freedBytes: number;
  deletedPaths: string[];
}> {
  const admin = getAdmin();
  if (!admin) {
    return { cleaned: false, freedBytes: 0, deletedPaths: [] };
  }

  const files = await listAllDepositProofs(admin);
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes < CLEANUP_THRESHOLD_BYTES) {
    return { cleaned: false, freedBytes: 0, deletedPaths: [] };
  }

  const oldestFirst = [...files].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const toDelete: StorageFile[] = [];
  let freed = 0;
  for (const file of oldestFirst) {
    if (freed >= CLEANUP_FREE_BYTES) break;
    toDelete.push(file);
    freed += file.size;
  }

  if (!toDelete.length) {
    return { cleaned: false, freedBytes: 0, deletedPaths: [] };
  }

  const paths = toDelete.map((f) => f.path);
  // Remove in chunks (Supabase remove accepts arrays)
  const chunkSize = 50;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const { error } = await admin.storage.from(BUCKET).remove(chunk);
    if (error) {
      console.error("[deposit-proofs] cleanup remove failed:", error.message);
      break;
    }
  }

  // Drop DB references so admin UI doesn't link to missing files
  await admin
    .from("appointment_deposits")
    .update({ proof_path: null })
    .in("proof_path", paths);

  return { cleaned: true, freedBytes: freed, deletedPaths: paths };
}

/** Upload a payment screenshot to the private Supabase deposit-proofs bucket. */
export async function uploadDepositProof(params: {
  organizationId: string;
  appointmentId: string;
  bytes: Buffer;
  contentType: string;
  extension: string;
}): Promise<{ ok: true; result: DepositProofUpload } | { ok: false; error: string }> {
  const admin = getAdmin();
  if (!admin) {
    return {
      ok: false,
      error: "Image storage is not configured. Set SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    };
  }

  // Keep headroom under the ~1 GB plan before accepting a new image
  await maybeCleanupDepositProofs();

  const objectName = `${params.organizationId}/${params.appointmentId}/${Date.now()}.${params.extension}`;
  const { error } = await admin.storage.from(BUCKET).upload(objectName, params.bytes, {
    contentType: params.contentType || "image/jpeg",
    upsert: false,
  });
  if (error) {
    return { ok: false, error: `Could not upload payment screenshot: ${error.message}` };
  }
  return { ok: true, result: { path: objectName, provider: "supabase" } };
}

/** Short-lived URL for staff to view a payment screenshot. */
export async function getDepositProofSignedUrl(
  storedPath: string
): Promise<{ url?: string; error?: string }> {
  // Legacy GCS paths from earlier experiment — no longer supported
  if (storedPath.startsWith("gcs:") || storedPath.startsWith("gs://")) {
    return {
      error: "This proof was stored on Google Cloud. Re-upload is required, or migrate the file to Supabase.",
    };
  }

  const admin = getAdmin();
  if (!admin) return { error: "Storage is not available" };

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storedPath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    return { error: error?.message ?? "Could not open payment screenshot" };
  }
  return { url: data.signedUrl };
}
