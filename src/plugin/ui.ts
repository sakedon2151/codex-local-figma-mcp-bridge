const statusElement = document.getElementById("status");

if (statusElement) {
  statusElement.textContent = "Plugin UI loaded";
}

parent.postMessage(
  {
    pluginMessage: {
      type: "notify"
    }
  },
  "*"
);
