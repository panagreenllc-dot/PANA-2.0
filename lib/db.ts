import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Lazily create the Neon client so builds and imports don't fail when
// DATABASE_URL is not present (e.g. during `next build` without secrets).
let client: NeonQueryFunction<false, false> | null = null;

function getClient() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set. See .env.example.");
    }
    client = neon(url);
  }
  return client;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export default function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<Row[]> {
  return getClient()(strings, ...values) as Promise<Row[]>;
}
