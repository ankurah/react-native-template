/**
 * Ankurah initialization - runs at module import time
 */

import { initRuntime, initNode, initLogging, getBufferedLogs } from './';

// Test mode: offline standalone node (no server needed)
const TEST_MODE = process.env.ANKURAH_TEST_MODE === 'true';

// Initialize runtime and logging first (sync)
initRuntime();
initLogging();

// Poll Rust logs and forward to console
setInterval(() => {
  for (const log of getBufferedLogs()) {
    console.log(`[Rust/${log.level}] ${log.target}:`, log.message);
  }
}, 100);

// Initialize node once at module load
let initPromise: Promise<void> | null = null;

export function initAnkurah(): Promise<void> {
  if (initPromise) return initPromise;

  // null = offline/test mode, string = connect to server
  initPromise = initNode(TEST_MODE ? null : 'ws://localhost:9898');
  return initPromise;
}

// Start initialization immediately on import
initAnkurah().catch(e => console.error('Ankurah init failed:', e));
