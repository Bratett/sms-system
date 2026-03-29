import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ─── R2 Client (S3-compatible) ─────────────────────────────────────

let client: S3Client | undefined;

function getClient(): S3Client {
  if (!client) {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error("R2 storage configuration incomplete. Check R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.");
    }

    client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return client;
}

function getBucket(): string {
  return process.env.R2_BUCKET || "sms-uploads";
}

// ─── Upload ────────────────────────────────────────────────────────

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | ReadableStream,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<{ key: string; url: string }> {
  const params: PutObjectCommandInput = {
    Bucket: getBucket(),
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: metadata,
  };

  await getClient().send(new PutObjectCommand(params));

  return {
    key,
    url: `${process.env.R2_ENDPOINT}/${getBucket()}/${key}`,
  };
}

// ─── Download (Signed URL) ─────────────────────────────────────────

export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });

  return getSignedUrl(getClient(), command, { expiresIn });
}

// ─── Delete ────────────────────────────────────────────────────────

export async function deleteFile(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );
}

// ─── Key Generation ────────────────────────────────────────────────

export function generateFileKey(
  module: string,
  entityId: string,
  filename: string,
): string {
  const timestamp = Date.now();
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${module}/${entityId}/${timestamp}-${safeFilename}`;
}
