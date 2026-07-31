export type SourceStatus = "queued" | "processing" | "ready" | "failed";

export type SourceMetadata = {
  summary: string | null;
  key_claims: string[];
  topics: string[];
  entities: Array<{
    name: string;
    type: "person" | "company" | "place" | "concept";
  }>;
  content_type: string | null;
  reading_time_minutes: number | null;
  warnings: string[];
  model_name: string | null;
};

export type LibrarySource = {
  id: string;
  source_type: "url" | "pdf" | "note";
  title: string | null;
  canonical_url: string | null;
  extracted_text: string | null;
  author: string | null;
  published_at: string | null;
  saved_at: string;
  status: SourceStatus;
  processing_error: string | null;
  why_saved: string | null;
  /** Non-null means published on the public reading page. */
  starred_at: string | null;
  public_blurb: string | null;
  favicon_url: string | null;
  source_metadata: SourceMetadata | SourceMetadata[] | null;
};

export function firstMetadata(source: LibrarySource) {
  return Array.isArray(source.source_metadata)
    ? (source.source_metadata[0] ?? null)
    : source.source_metadata;
}
