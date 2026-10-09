/**
 * AI seam — the contract future LLM automations depend on.
 *
 * Phase 1 ships a no-op implementation so the rest of the app (e.g. note
 * summarization) can be wired against a stable interface today. A real
 * provider (on-device model or a remote LLM API) is dropped in later by
 * swapping the `summarizer` binding, without touching any caller.
 */
export interface ISummarizer {
  summarize(text: string): Promise<string>;
}

/** Placeholder provider until a real LLM is integrated. Echoes its input. */
export const noopSummarizer: ISummarizer = {
  async summarize(text: string): Promise<string> {
    return text;
  },
};

/** The app-wide summarizer. Rebind this to a real provider in a later phase. */
export const summarizer: ISummarizer = noopSummarizer;
