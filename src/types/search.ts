export type SearchResult = {
  source_id: string;
  chunk_index: number;
  chunk_text: string;
  title: string | null;
  canonical_url: string | null;
  score: number;
};

export type AskCitation = {
  source_id: string;
  chunk_index: number;
  quote: string;
  title?: string;
};

export type AskAnswer = {
  answer: string;
  citations: AskCitation[];
  insufficient_evidence: boolean;
};
