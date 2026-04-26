import { dispatchPluginCommand } from "./commands/dispatcher";
import type { MinimalFigma } from "./figma-types";
import { PluginCommandError } from "./plugin-errors";

figma.showUI(__html__, { width: 360, height: 560 });

interface ExecuteCommandMessage {
  type: "execute-command";
  commandId: string;
  command: unknown;
}

function isExecuteCommandMessage(message: unknown): message is ExecuteCommandMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "execute-command" &&
    "commandId" in message &&
    typeof message.commandId === "string" &&
    "command" in message
  );
}

figma.ui.onmessage = async (message: unknown) => {
  if (!isExecuteCommandMessage(message)) {
    return;
  }

  try {
    const result = await dispatchPluginCommand(figma as unknown as MinimalFigma, message.command, {
      onProgress: (progress) => {
        figma.ui.postMessage({
          type: "command-progress",
          commandId: message.commandId,
          progress
        });
      }
    });
    figma.ui.postMessage({
      type: "command-result",
      commandId: message.commandId,
      result
    });
  } catch (error) {
    const code = error instanceof PluginCommandError ? error.code : "FIGMA_API_ERROR";
    const errorMessage = error instanceof Error ? error.message : "Command failed.";
    figma.ui.postMessage({
      type: "command-error",
      commandId: message.commandId,
      error: {
        code,
        message: errorMessage
      }
    });
  }
};
