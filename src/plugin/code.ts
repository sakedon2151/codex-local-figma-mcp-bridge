figma.showUI(__html__, { width: 360, height: 520 });

figma.ui.onmessage = (message: unknown) => {
  if (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "notify"
  ) {
    figma.notify("Local Codex Figma Bridge is ready.");
  }
};
