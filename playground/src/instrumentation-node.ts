export async function registerNode() {
  if (process.env.ASSISTANT_SCHEDULER === '0') return;
  const g = globalThis as unknown as {
    assistantTimer?: ReturnType<typeof setInterval>;
    assistantTick?: boolean;
  };
  if (g.assistantTimer) return;
  const tick = async () => {
    if (g.assistantTick) return;
    g.assistantTick = true;
    try {
      const { scheduledTick } = await import('./lib/assistant');
      await scheduledTick();
    } catch {
      /* Detailed content must never be logged. Status is recorded by service. */
    } finally {
      g.assistantTick = false;
    }
  };
  g.assistantTimer = setInterval(() => {
    void tick();
  }, 60000);
  g.assistantTimer.unref();
}
