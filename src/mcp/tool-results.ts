import type { CodedErrorShape } from "@shared/errors";

export interface ToolResultMeta {
  commandId: string;
  durationMs: number;
}

export interface TextToolResult {
  [key: string]: unknown;
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

export function createSuccessResult(data: unknown, meta: ToolResultMeta): TextToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          ok: true,
          data,
          meta
        })
      }
    ]
  };
}

export function createErrorResult(error: CodedErrorShape, meta: ToolResultMeta): TextToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify({
          ok: false,
          error,
          meta
        })
      }
    ]
  };
}

export function readToolResultJson(result: TextToolResult): unknown {
  const text = result.content[0]?.text;
  if (!text) {
    throw new Error("Tool result has no text content.");
  }
  return JSON.parse(text) as unknown;
}
