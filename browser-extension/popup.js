async function update(type = "status") {
  const state = await chrome.runtime.sendMessage({ type });
  document.querySelector("#status").textContent = state.detail;
}
document.querySelector("#connect").addEventListener("click", async () => {
  await update("reconnect");
  setTimeout(() => update(), 500);
});
void update();
