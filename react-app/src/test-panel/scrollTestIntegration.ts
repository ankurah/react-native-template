/**
 * Scroll Test Integration
 *
 * Uses the __CHAT_RENDER_HOOK__ to observe Chat component state reactively.
 *
 * Single-button flow:
 * 1. Create test room + messages (using current user)
 * 2. Auto-navigate to the test room
 * 3. __CHAT_RENDER_HOOK__ receives state on each render
 * 4. Run scroll validation
 */

import { FlatList } from 'react-native';
import type { MessageViewInterface, RoomViewInterface } from '../generated/ankurah_rn_model';
import type { MessageScrollManagerInterface, MessageVisibleSetInterface } from '../generated/ankurah_rn_bindings';
import { messageRowRefs } from '../components/MessageRow';
import {
  RoomOps,
  RoomInput,
  MessageOps,
  MessageInput,
} from '../generated/ankurah_rn_model';
import { getContext } from '../generated/ankurah_rn_bindings';

// ============================================================================
// Types
// ============================================================================

export interface ScrollTestResult {
  pass: boolean;
  error?: string;
  stats?: ScrollTestStats;
}

export interface ScrollTestStats {
  messagesCreated: number;
  scrollCyclesUp: number;
  scrollCyclesDown: number;
  totalValidations: number;
  paginationEventsUp: number;
  paginationEventsDown: number;
}

export interface ScrollTestConfig {
  scrollIncrement: number;
  messageCount: number;
  stabilizationDelay: number;
  maxCycles: number;
}

const DEFAULT_CONFIG: ScrollTestConfig = {
  scrollIncrement: 10,
  messageCount: 100,
  stabilizationDelay: 50,
  maxCycles: 5000,
};

// Epsilon for floating point comparison
const EPSILON = 100;

// ============================================================================
// Measurement Utilities
// ============================================================================

interface MeasuredMessage {
  id: string;
  screenY: number;
  height: number;
}

async function measureVisibleMessages(): Promise<MeasuredMessage[]> {
  const results: MeasuredMessage[] = [];
  const measurePromises: Promise<void>[] = [];

  for (const [id, viewRef] of messageRowRefs) {
    const promise = new Promise<void>((resolve) => {
      viewRef.measureInWindow((x, y, width, height) => {
        if (height > 0) {
          results.push({ id, screenY: y, height });
        }
        resolve();
      });
    });
    measurePromises.push(promise);
  }

  await Promise.all(measurePromises);
  return results.sort((a, b) => a.screenY - b.screenY);
}

// ============================================================================
// Utilities
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

// ============================================================================
// Global State and API
// ============================================================================

interface ChatRenderState {
  visibleSet: MessageVisibleSetInterface | null;
  manager: MessageScrollManagerInterface | null;
  flatListRef: React.RefObject<FlatList<MessageViewInterface>>;
  viewportHeight: number;
}

interface ScrollTestGlobal {
  // State
  isRunning: boolean;
  lastResult: ScrollTestResult | null;
  progressLog: string[];

  // Latest state from Chat component (updated via __CHAT_RENDER_HOOK__)
  chatState: ChatRenderState | null;

  // User and navigation (set by TestPanel)
  currentUserId: string | null;
  navigationCallback: ((room: RoomViewInterface) => void) | null;

  // Methods
  run: (config?: Partial<ScrollTestConfig>) => Promise<ScrollTestResult>;
  getStatus: () => { running: boolean; result: ScrollTestResult | null; log: string[] };
  clearLog: () => void;

  // For TestPanel to call
  setCurrentUserId: (userId: string) => void;
  setNavigationCallback: (callback: (room: RoomViewInterface) => void) => void;
}

const scrollTest: ScrollTestGlobal = {
  isRunning: false,
  lastResult: null,
  progressLog: [],
  chatState: null,

  currentUserId: null,
  navigationCallback: null,

  run: async (config = {}) => {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    if (scrollTest.isRunning) {
      return { pass: false, error: 'Test already running' };
    }

    if (!scrollTest.currentUserId) {
      return { pass: false, error: 'Current user ID not set' };
    }

    if (!scrollTest.navigationCallback) {
      return { pass: false, error: 'Navigation callback not set' };
    }

    scrollTest.isRunning = true;
    scrollTest.progressLog = [];
    scrollTest.lastResult = null;
    scrollTest.chatState = null;

    const stats: ScrollTestStats = {
      messagesCreated: 0,
      scrollCyclesUp: 0,
      scrollCyclesDown: 0,
      totalValidations: 0,
      paginationEventsUp: 0,
      paginationEventsDown: 0,
    };

    const reportProgress = (msg: string) => {
      console.log(`[ScrollTest] ${msg}`);
      scrollTest.progressLog.push(msg);
    };

    try {
      const ankurahCtx = getContext();

      // Phase 1: Create test room
      const roomId = `Test_${generateRoomId()}`;
      reportProgress(`Creating room: ${roomId}`);

      const roomOps = new RoomOps();
      const roomInput = RoomInput.create({ name: roomId });
      const room = await roomOps.createOne(ankurahCtx, roomInput);
      reportProgress(`Room created: ${room.id()}`);

      // Phase 2: Create messages
      const msgCount = cfg.messageCount;
      reportProgress(`Creating ${msgCount} messages...`);

      const messageOps = new MessageOps();
      const baseTimestamp = Date.now() - (msgCount * 1000);

      for (let i = 0; i < msgCount; i++) {
        const input = MessageInput.create({
          user: scrollTest.currentUserId!,
          room: room.id().toString(),
          text: `MSG_${i.toString().padStart(4, '0')}`,
          timestamp: BigInt(baseTimestamp + i * 1000),
          deleted: false,
        });
        await messageOps.createOne(ankurahCtx, input);
        stats.messagesCreated++;

        if (i % 5 === 0) {
          await sleep(20);
          if (i > 0 && i % 20 === 0) {
            reportProgress(`Created ${i}/${msgCount} messages`);
          }
        }
      }
      reportProgress(`All ${msgCount} messages created`);

      // Phase 3: Navigate to test room
      reportProgress('Navigating to test room...');
      scrollTest.navigationCallback!(room);

      // Wait for Chat component to render with data
      reportProgress('Waiting for Chat component...');
      const timeout = 10000;
      const start = Date.now();
      while (!scrollTest.chatState?.visibleSet?.items()?.length) {
        if (Date.now() - start > timeout) {
          return { pass: false, error: 'Timeout waiting for Chat to render with items', stats };
        }
        await sleep(100);
      }
      reportProgress('Chat ready with items');

      // ========================================
      // Phase 4: Verify Initial State
      // ========================================
      const { manager, flatListRef, viewportHeight, visibleSet } = scrollTest.chatState!;
      const flatList = flatListRef?.current;
      if (!flatList || !manager || !visibleSet) {
        return { pass: false, error: 'BAIL: Required refs not available', stats };
      }

      const initialMode = manager.mode();
      const items = visibleSet.items();

      reportProgress(`Initial state: mode=${initialMode}, items=${items.length}`);
      reportProgress(`hasMorePreceding=${visibleSet.hasMorePreceding()}, hasMoreFollowing=${visibleSet.hasMoreFollowing()}`);

      if (initialMode !== 'Live') {
        return { pass: false, error: `BAIL: Expected Live mode, got ${initialMode}`, stats };
      }

      if (visibleSet.hasMoreFollowing()) {
        return { pass: false, error: 'BAIL: Live mode but hasMoreFollowing=true', stats };
      }

      if (!visibleSet.hasMorePreceding()) {
        return { pass: false, error: 'BAIL: No older content to scroll to', stats };
      }

      // Verify we see MSG_0099 (newest)
      const msgTexts = items.map(m => m.text());
      if (!msgTexts.includes('MSG_0099')) {
        return { pass: false, error: `BAIL: MSG_0099 not visible. Newest: ${msgTexts[msgTexts.length - 1]}`, stats };
      }
      reportProgress('✓ Initial state verified: Live mode, MSG_0099 visible');

      // ========================================
      // Phase 5: Scroll UP Test
      // ========================================
      reportProgress('--- SCROLL UP TEST ---');

      let cycleCount = 0;
      let reachedTop = false;
      let prevItemCount = items.length;

      while (cycleCount < cfg.maxCycles && !reachedTop) {
        try {
          // Get current state from Chat render hook
          const state = scrollTest.chatState;
          if (!state?.visibleSet) continue;

          const beforeMsgs = await measureVisibleMessages();
          const itemsBefore = state.visibleSet.items().length;

          // Scroll up by decrementing offset
          // Note: We don't have direct offset tracking anymore, so we use scrollToIndex or small increments
          flatList.scrollToOffset({ offset: Math.max(0, cycleCount === 0 ? 9999 : 0), animated: false });

          // Actually, let's scroll by small increments using scrollToOffset
          // We need to track offset ourselves or just scroll incrementally

          await sleep(cfg.stabilizationDelay);

          const afterMsgs = await measureVisibleMessages();
          const currentVisSet = scrollTest.chatState?.visibleSet;
          if (!currentVisSet) continue;

          const itemsAfter = currentVisSet.items().length;
          const itemDelta = itemsAfter - itemsBefore;

          if (itemsAfter !== prevItemCount) {
            prevItemCount = itemsAfter;
          }

          // Check for top
          const currentTexts = currentVisSet.items().map(m => m.text());
          if (currentTexts.includes('MSG_0000') && !currentVisSet.hasMorePreceding()) {
            reportProgress(`✓ TOP: MSG_0000 visible, hasMorePreceding=false`);
            reachedTop = true;
            break;
          }

          // Log progress
          if (cycleCount % 50 === 0) {
            reportProgress(`Cycle ${cycleCount}: items=${itemsAfter}, measured=${afterMsgs.length}`);
          }

          stats.scrollCyclesUp++;
          cycleCount++;
        } catch (cycleError) {
          const msg = cycleError instanceof Error ? cycleError.message : String(cycleError);
          reportProgress(`[ERR] ${msg}`);
          return { pass: false, error: `Cycle ${cycleCount}: ${msg}`, stats };
        }
      }

      if (!reachedTop) {
        return { pass: false, error: `Did not reach top after ${cycleCount} cycles`, stats };
      }

      reportProgress('--- TEST COMPLETE ---');
      reportProgress(`Cycles: ${stats.scrollCyclesUp}`);

      const result = { pass: true, stats };
      scrollTest.lastResult = result;
      return result;

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      reportProgress(`[ERROR] ${msg}`);
      const result = { pass: false, error: `Exception: ${msg}`, stats };
      scrollTest.lastResult = result;
      return result;
    } finally {
      scrollTest.isRunning = false;
    }
  },

  getStatus: () => ({
    running: scrollTest.isRunning,
    result: scrollTest.lastResult,
    log: scrollTest.progressLog.slice(-50),
  }),

  clearLog: () => {
    scrollTest.progressLog = [];
  },

  setCurrentUserId: (userId) => {
    scrollTest.currentUserId = userId;
  },

  setNavigationCallback: (callback) => {
    scrollTest.navigationCallback = callback;
  },
};

// Register the render hook that Chat component calls
globalThis.__CHAT_RENDER_HOOK__ = (state) => {
  scrollTest.chatState = state;
};

// Expose globally for rn-debugger access
declare global {
  var __SCROLL_TEST__: ScrollTestGlobal;
}
global.__SCROLL_TEST__ = scrollTest;

export default scrollTest;
export { scrollTest, measureVisibleMessages };
