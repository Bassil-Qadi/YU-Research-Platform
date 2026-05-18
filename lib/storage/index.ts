/**
 * S3 / R2 file storage — Phase 3+
 */
export interface UploadResult {
  key: string;
  url: string;
}

export async function uploadFile(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _file: Buffer,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _key: string
): Promise<UploadResult> {
  throw new Error("File uploads are not implemented yet (Phase 3)");
}

export async function getSignedUrl(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _key: string
): Promise<string> {
  throw new Error("Signed URLs are not implemented yet (Phase 3)");
}
