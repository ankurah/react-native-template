/**
 * Pixel-Perfect Scroll Anchor Test
 *
 * This module implements a rigorous test for scroll anchoring during pagination.
 * The core invariant: when we scroll by N pixels, the content should move by
 * exactly N pixels, even across pagination boundaries.
 *
 * Test Strategy:
 * 1. Create a test room with many messages (enough for multiple page loads)
 * 2. Scroll to bottom (live mode)
 * 3. Scroll UP one step at a time:
 *    - Measure visible message screen positions
 *    - Scroll by N pixels
 *    - Wait for any pagination to complete
 *    - Measure again and verify delta is exactly N pixels
 * 4. Continue until we reach the top (no more older messages)
 * 5. Scroll DOWN back to live mode with same validation
 */

import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  RoomOps,
  RoomInput,
  MessageOps,
  MessageInput,
  UserOps,
  UserInput,
  type MessageViewInterface,
} from '../generated/{{crate_name}}_model';
import { getContext, type MessageScrollManagerInterface } from '../generated/{{crate_name}}_bindings';
import type { ScrollTestResult, ScrollTestStats, ScrollTestConfig } from './scrollTestIntegration';

// ============================================================================
// Types
// ============================================================================

interface MeasuredMessage {
  id: string;
  screenY: number;
  height: number;
}

export interface ScrollTestContext {
  flatListRef: React.RefObject<FlatList<MessageViewInterface>>;
  manager: MessageScrollManagerInterface;
  viewportHeight: number;
  measureVisibleMessages: () => Promise<MeasuredMessage[]>;
  validateScrollDelta: (
    before: MeasuredMessage[],
    after: MeasuredMessage[],
    expectedDelta: number,
    tolerance?: number
  ) => { valid: boolean; error?: string; testedCount: number };
  reportProgress: (msg: string) => void;
  config: ScrollTestConfig;
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateRoomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for scroll manager to finish loading, then wait for React render.
 * After isLoading() returns false, we need to wait for React to re-render
 * before measuring positions (the data change triggers a re-render).
 */
async function waitForIdle(
  manager: MessageScrollManagerInterface,
  maxWait = 5000
): Promise<void> {
  const start = Date.now();
  while (manager.isLoading()) {
    if (Date.now() - start > maxWait) {
      throw new Error(`Timeout waiting for scroll manager idle (waited ${maxWait}ms)`);
    }
    await sleep(16);
  }
  // Wait for React render cycle to complete after data changes
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  // Double-check - wait another frame to be safe
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

/**
 * Calculate required message count for thorough testing.
 */
function calculateMessageCount(viewportHeight: number, estimatedRowHeight = 74): number {
  const pageSize = Math.max(20, Math.ceil((viewportHeight * 3) / estimatedRowHeight));
  const totalPages = 5 * 2 + 1;
  return pageSize * totalPages;
}

// ============================================================================
// Main Test Function
// ============================================================================

export async function runScrollAnchorTest(ctx: ScrollTestContext): Promise<ScrollTestResult> {
  const {
    flatListRef,
    manager,
    viewportHeight,
    measureVisibleMessages,
    validateScrollDelta,
    reportProgress,
    config: cfg,
  } = ctx;

  const stats: ScrollTestStats = {
    messagesCreated: 0,
    scrollCyclesUp: 0,
    scrollCyclesDown: 0,
    totalValidations: 0,
    paginationEventsUp: 0,
    paginationEventsDown: 0,
  };

  try {
    // ========================================
    // Phase 1: Setup - Create Room and Messages
    // ========================================
    const ankurahCtx = getContext();
    const roomId = `Test_${generateRoomId()}`;
    reportProgress(`[Setup] Creating room: ${roomId}`);

    // Create a test user first
    const userOps = new UserOps();
    const userInput = UserInput.create({ displayName: 'Scroll Test User' });
    const testUser = await userOps.createOne(ankurahCtx, userInput);
    const testUserId = testUser.id().toString();
    reportProgress(`[Setup] Test user created with ID: ${testUserId}`);

    const roomOps = new RoomOps();
    const roomInput = RoomInput.create({ name: roomId });
    const room = await roomOps.createOne(ankurahCtx, roomInput);
    reportProgress(`[Setup] Room created with ID: ${room.id()}`);

    // Calculate message count based on viewport
    const vp = viewportHeight || 600;
    const msgCount = cfg.messageCount || calculateMessageCount(vp);
    reportProgress(`[Setup] Creating ${msgCount} messages (viewport: ${vp}px)...`);

    const messageOps = new MessageOps();
    const baseTimestamp = Date.now() - (msgCount * 1000);

    for (let i = 0; i < msgCount; i++) {
      const input = MessageInput.create({
        user: testUserId,
        room: room.id().toString(),
        text: `MSG_${i.toString().padStart(4, '0')}`,
        timestamp: BigInt(baseTimestamp + i * 1000),
        deleted: false,
      });
      await messageOps.createOne(ankurahCtx, input);
      stats.messagesCreated++;

      if (i > 0 && i % 50 === 0) {
        reportProgress(`[Setup] Created ${i}/${msgCount} messages`);
      }
    }
    reportProgress(`[Setup] All ${msgCount} messages created`);

    // NOTE: This test creates messages but the user must navigate to the room manually.
    // The test will wait for the scroll manager to be ready before proceeding.
    reportProgress(`[Setup] Messages created in room: ${roomId}`);
    reportProgress(`[Setup] Please navigate to the room to continue the test.`);
    reportProgress(`[Setup] Call __SCROLL_TEST__.continueAfterNavigation() when ready.`);

    // For now, return with stats showing setup completed
    return {
      pass: true,
      error: `Setup complete. Navigate to room "${roomId}" and call continueAfterNavigation()`,
      stats,
    };

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    reportProgress(`[ERROR] ${msg}`);
    return { pass: false, error: `Exception: ${msg}`, stats };
  }
}

/**
 * Run the scroll validation phase after navigating to the test room.
 */
export async function runScrollValidation(ctx: ScrollTestContext): Promise<ScrollTestResult> {
  const {
    flatListRef,
    manager,
    measureVisibleMessages,
    validateScrollDelta,
    reportProgress,
    config: cfg,
  } = ctx;

  const stats: ScrollTestStats = {
    messagesCreated: 0,
    scrollCyclesUp: 0,
    scrollCyclesDown: 0,
    totalValidations: 0,
    paginationEventsUp: 0,
    paginationEventsDown: 0,
  };

  try {
    const flatList = flatListRef.current;
    if (!flatList) {
      return { pass: false, error: 'FlatList ref not available', stats };
    }

    // Wait for initial load
    await waitForIdle(manager);
    await sleep(500);

    reportProgress(`[Phase 1] Initial state: mode=${manager.mode()}`);

    // Start from the TOP (offset 0) - this is a known position
    // We'll scroll DOWN through the content to validate pixel accuracy
    flatList.scrollToOffset({ offset: 0, animated: false });
    await sleep(300);
    await waitForIdle(manager);

    const initialMode = manager.mode();
    reportProgress(`[Phase 1] Initial mode: ${initialMode} (starting from top)`);

    // Start at offset 0 (top of content)
    let currentOffset = 0;

    // ========================================
    // Phase 2: Scroll DOWN Test (from top toward bottom)
    // ========================================
    reportProgress('[Phase 2] Starting SCROLL DOWN validation (top to bottom)...');

    let cycleCount = 0;
    let lastMode = manager.mode();
    let reachedBottom = false;

    while (cycleCount < cfg.maxCycles && !reachedBottom) {
      // Measure BEFORE scroll
      const beforeVisible = await measureVisibleMessages();

      if (beforeVisible.length === 0) {
        reportProgress(`[Warning] No visible messages at cycle ${cycleCount}`);
        await sleep(100);
        continue;
      }

      // Scroll DOWN (increase offset toward newer messages)
      currentOffset = currentOffset + cfg.scrollIncrement;
      flatList.scrollToOffset({ offset: currentOffset, animated: false });

      // Wait for render and any pagination
      await sleep(cfg.stabilizationDelay);
      await waitForIdle(manager);

      // Check for mode change
      const currentMode = manager.mode();
      if (currentMode !== lastMode) {
        stats.paginationEventsDown++;
        reportProgress(`[Phase 2] Pagination: ${lastMode} -> ${currentMode} at offset ${currentOffset.toFixed(0)}`);
        lastMode = currentMode;
      }

      // Measure AFTER scroll
      const afterVisible = await measureVisibleMessages();

      // Validate: scrolling DOWN means items should move UP on screen (-increment)
      if (beforeVisible.length > 0 && afterVisible.length > 0) {
        const result = validateScrollDelta(beforeVisible, afterVisible, -cfg.scrollIncrement);
        stats.totalValidations++;

        if (!result.valid) {
          return {
            pass: false,
            error: `[FAIL DOWN cycle ${cycleCount}] ${result.error}`,
            stats,
          };
        }
      }

      stats.scrollCyclesDown++;
      cycleCount++;

      // Progress report
      if (cycleCount % cfg.progressFrequency === 0) {
        const visSet = manager.visibleSet().get();
        reportProgress(
          `[Phase 2] Cycle ${cycleCount}: offset=${currentOffset.toFixed(0)}, ` +
          `hasMoreNewer=${visSet.hasMoreNewer()}, mode=${manager.mode()}`
        );
      }

      // Check if we've reached the bottom (Live mode with no more newer)
      const visSet = manager.visibleSet().get();
      if (!visSet.hasMoreNewer() && manager.mode() === 'Live') {
        reportProgress(`[Phase 2] Reached BOTTOM (Live) after ${cycleCount} cycles`);
        reachedBottom = true;
      }
    }

    reportProgress(`[Phase 2] SCROLL DOWN complete: ${stats.scrollCyclesDown} cycles, ${stats.paginationEventsDown} pagination events`);

    // ========================================
    // Phase 3: Scroll UP Test (from bottom back to top)
    // ========================================
    reportProgress('[Phase 3] Starting SCROLL UP validation (bottom to top)...');

    cycleCount = 0;
    lastMode = manager.mode();
    let reachedTop = false;

    while (cycleCount < cfg.maxCycles && !reachedTop) {
      const beforeVisible = await measureVisibleMessages();

      // Scroll UP (decrease offset toward older messages)
      const newOffset = currentOffset - cfg.scrollIncrement;
      if (newOffset <= 0) {
        reportProgress(`[Phase 3] Reached TOP (offset would go to ${newOffset})`);
        reachedTop = true;
        break;
      }
      currentOffset = newOffset;
      flatList.scrollToOffset({ offset: currentOffset, animated: false });

      await sleep(cfg.stabilizationDelay);
      await waitForIdle(manager);

      const currentMode = manager.mode();
      if (currentMode !== lastMode) {
        stats.paginationEventsUp++;
        reportProgress(`[Phase 3] Pagination: ${lastMode} -> ${currentMode} at offset ${currentOffset.toFixed(0)}`);
        lastMode = currentMode;
      }

      const afterVisible = await measureVisibleMessages();

      // Validate: scrolling UP means items should move DOWN on screen (+increment)
      if (beforeVisible.length > 0 && afterVisible.length > 0) {
        const result = validateScrollDelta(beforeVisible, afterVisible, cfg.scrollIncrement);
        stats.totalValidations++;

        if (!result.valid) {
          return {
            pass: false,
            error: `[FAIL UP cycle ${cycleCount}] ${result.error}`,
            stats,
          };
        }
      }

      stats.scrollCyclesUp++;
      cycleCount++;

      if (cycleCount % cfg.progressFrequency === 0) {
        const visSet = manager.visibleSet().get();
        reportProgress(
          `[Phase 3] Cycle ${cycleCount}: offset=${currentOffset.toFixed(0)}, ` +
          `hasMoreOlder=${visSet.hasMoreOlder()}, mode=${manager.mode()}`
        );
      }
    }

    reportProgress(`[Phase 3] SCROLL UP complete: ${stats.scrollCyclesUp} cycles, ${stats.paginationEventsUp} pagination events`);

    // ========================================
    // Phase 4: Final Verification
    // ========================================
    // Verify we completed both scroll directions
    if (stats.scrollCyclesDown === 0) {
      return {
        pass: false,
        error: '[FAIL] No scroll DOWN cycles completed',
        stats,
      };
    }

    if (stats.scrollCyclesUp === 0) {
      return {
        pass: false,
        error: '[FAIL] No scroll UP cycles completed',
        stats,
      };
    }

    const finalMode = manager.mode();
    reportProgress(`[Phase 4] Final state: mode=${finalMode}, offset=${currentOffset.toFixed(0)}`);
    reportProgress('[SUCCESS] All scroll anchor validations passed!');
    reportProgress(`[Stats] DOWN: ${stats.scrollCyclesDown} cycles, UP: ${stats.scrollCyclesUp} cycles`);
    reportProgress(`[Stats] Total validations: ${stats.totalValidations}, Pagination events: ${stats.paginationEventsUp + stats.paginationEventsDown}`);

    return { pass: true, stats };

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    reportProgress(`[ERROR] ${msg}`);
    return { pass: false, error: `Exception: ${msg}`, stats };
  }
}
