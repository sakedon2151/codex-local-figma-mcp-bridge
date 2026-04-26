import type { CommandDsl } from "@shared/protocol";
import type { MinimalFigma } from "../figma-types";
import { dispatchPluginCommand, type DispatchContext } from "./dispatcher";

export async function batch(
  figma: MinimalFigma,
  command: CommandDsl,
  context: DispatchContext
): Promise<unknown> {
  const payload = command.payload as {
    operations: CommandDsl[];
    options?: { stopOnError?: boolean; dryRun?: boolean };
  };
  const results: Array<{ index: number; ok: boolean; result?: unknown; error?: unknown }> = [];
  const stopOnError = payload.options?.stopOnError ?? true;

  for (const [index, operation] of payload.operations.entries()) {
    context.onProgress?.({
      status: "in_progress",
      progress: Math.round((index / payload.operations.length) * 100),
      processedItems: index,
      totalItems: payload.operations.length,
      message: `Processing operation ${index + 1} of ${payload.operations.length}.`
    });

    try {
      if (payload.options?.dryRun) {
        results.push({ index, ok: true, result: { dryRun: true, operation } });
      } else {
        results.push({
          index,
          ok: true,
          result: await dispatchPluginCommand(figma, operation, context)
        });
      }
    } catch (error) {
      results.push({ index, ok: false, error });
      if (stopOnError) {
        break;
      }
    }
  }

  context.onProgress?.({
    status: "completed",
    progress: 100,
    processedItems: results.length,
    totalItems: payload.operations.length,
    message: "Batch complete."
  });

  return { results };
}
