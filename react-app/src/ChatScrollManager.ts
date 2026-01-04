import { FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import {
  MessageOps,
  type MessageViewInterface,
  type MessageLiveQueryInterface,
} from './generated/ankurah_rn_model';
import { getContext } from './generated/ankurah_rn_bindings';

type ScrollMode = 'live' | 'backward' | 'forward';

interface ScrollMetrics {
  topGap: number;
  bottomGap: number;
  minBuffer: number;
  resultCount: number;
}

type ChangeListener = () => void;

interface ManagerSnapshot {
  messages: MessageViewInterface[];
  mode: ScrollMode;
  loading: 'forward' | 'backward' | false;
  shouldAutoScroll: boolean;
}

/**
 * ChatScrollManager for React Native
 * Manages message pagination and scroll behavior for the chat view.
 *
 * Unlike the WASM version which uses JsValueMut for reactive state,
 * this version uses a subscription pattern compatible with useSyncExternalStore.
 */
export class ChatScrollManager {
  // Configuration
  private readonly minBufferRatio = 0.75; // Trigger threshold in viewport units
  private readonly querySize = 3.0; // Load 3.0 viewports worth of content
  private readonly estimatedRowHeight = 74;

  // State
  private _mode: ScrollMode = 'live';
  private _loading: 'forward' | 'backward' | false = false;
  private _metrics: ScrollMetrics = {
    topGap: 0,
    bottomGap: 0,
    minBuffer: 0,
    resultCount: 0,
  };
  private _messages: MessageViewInterface[] = [];
  private _displayMessages: MessageViewInterface[] = []; // Cached display order
  private _error: string | null = null;

  // Query state
  private messageQuery: MessageLiveQueryInterface | null = null;
  private currentLimit = 50;
  private currentDirection: 'ASC' | 'DESC' = 'DESC';
  private lastContinuationTimestamp: bigint | null = null;

  // Scroll state
  private flatListRef: FlatList<MessageViewInterface> | null = null;
  private viewportHeight = 600; // Will be updated on layout
  private contentHeight = 0;
  private scrollOffset = 0;
  private userScrolling = false;
  private initialized = false;

  // Subscription
  private listeners = new Set<ChangeListener>();
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  // Cached snapshot for useSyncExternalStore (must be referentially stable)
  private _snapshot: ManagerSnapshot | null = null;

  constructor(private roomId: string) {
    this.initQuery();
  }

  private async initQuery() {
    try {
      const ctx = getContext();
      const messageOps = new MessageOps();
      this.currentLimit = this.computeLimit();
      this.currentDirection = 'DESC';

      this.messageQuery = await messageOps.query(
        ctx,
        `room = '${this.roomId}' AND deleted = false ORDER BY timestamp DESC LIMIT ${this.currentLimit}`,
        []
      );

      this.refreshMessages();
      this.startPolling();
    } catch (e) {
      this._error = String(e);
      this.notify();
    }
  }

  private startPolling() {
    // Poll for updates since LiveQuery doesn't have callback support in UniFFI
    this.pollInterval = setInterval(() => {
      this.refreshMessages();
    }, 250);
  }

  private refreshMessages() {
    if (!this.messageQuery) return;

    try {
      const items = this.messageQuery.resultset().items();
      const changed = items.length !== this._messages.length ||
        items.some((m, i) => {
          const existing = this._messages[i];
          return !existing || m.id().toString() !== existing.id().toString();
        });

      if (changed) {
        this._messages = items;
        this._metrics.resultCount = items.length;
        // Update cached display messages
        this._displayMessages = this._mode !== 'forward'
          ? [...items].reverse()
          : items;
        this.notify();
      }
    } catch (e) {
      // Query might be stale, ignore
    }
  }

  private updateSnapshot() {
    // Only create new snapshot if values changed
    const messages = this.messages;
    const mode = this._mode;
    const loading = this._loading;
    const shouldAutoScroll = this.shouldAutoScroll;

    if (!this._snapshot ||
        this._snapshot.mode !== mode ||
        this._snapshot.loading !== loading ||
        this._snapshot.shouldAutoScroll !== shouldAutoScroll ||
        this._snapshot.messages !== messages) {
      this._snapshot = { messages, mode, loading, shouldAutoScroll };
    }
  }

  private notify() {
    this.updateSnapshot();
    this.listeners.forEach(l => l());
  }

  // useSyncExternalStore compatible getSnapshot
  getSnapshot = (): ManagerSnapshot => {
    if (!this._snapshot) {
      this.updateSnapshot();
    }
    return this._snapshot!;
  };

  // useSyncExternalStore compatible subscription
  subscribe = (listener: ChangeListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  // Getters for reactive state
  get mode(): ScrollMode { return this._mode; }
  get loading(): 'forward' | 'backward' | false { return this._loading; }
  get metrics(): ScrollMetrics { return this._metrics; }
  get error(): string | null { return this._error; }

  get messages(): MessageViewInterface[] {
    // Return cached display messages (already in correct order)
    return this._displayMessages;
  }

  get atEarliest(): boolean {
    // DESC queries hit oldest when count < limit
    return this.currentDirection === 'DESC' && this._messages.length < this.currentLimit;
  }

  get atLatest(): boolean {
    // Live mode is always at latest, ASC queries hit newest when count < limit
    return this._mode === 'live' ||
           (this.currentDirection === 'ASC' && this._messages.length < this.currentLimit);
  }

  get shouldAutoScroll(): boolean {
    return this._mode === 'live' && this._metrics.bottomGap < 50;
  }

  // FlatList binding
  setFlatListRef = (ref: FlatList<MessageViewInterface> | null) => {
    this.flatListRef = ref;
  };

  onLayout = (height: number) => {
    this.viewportHeight = height;
    if (!this.initialized) {
      this.initialized = true;
      // Initial scroll to bottom for live mode
      if (this._mode === 'live') {
        setTimeout(() => this.scrollToEnd(), 100);
      }
    }
  };

  onContentSizeChange = (_width: number, height: number) => {
    const wasAtBottom = this.shouldAutoScroll;
    this.contentHeight = height;

    // Auto-scroll to bottom if we were already at the bottom
    if (wasAtBottom && this._mode === 'live') {
      this.scrollToEnd();
    }
  };

  onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

    const scrollDelta = contentOffset.y - this.scrollOffset;
    this.scrollOffset = contentOffset.y;
    this.contentHeight = contentSize.height;
    this.viewportHeight = layoutMeasurement.height;

    const topGap = contentOffset.y;
    const bottomGap = contentSize.height - contentOffset.y - layoutMeasurement.height;
    const minBuffer = this.viewportHeight * this.minBufferRatio;

    this._metrics = {
      topGap,
      bottomGap,
      minBuffer,
      resultCount: this._messages.length,
    };

    // Only trigger loads on user-initiated scrolls
    if (this.userScrolling) {
      this.userScrolling = false;

      // Scrolled up - try to load older messages
      if (scrollDelta < 0 && topGap < minBuffer && !this.atEarliest && this._loading !== 'backward') {
        this.loadMore('backward');
      }
      // Scrolled down - try to load newer messages
      else if (scrollDelta > 0 && bottomGap < minBuffer && !this.atLatest && this._loading !== 'forward') {
        this.loadMore('forward');
      }
    }

    this.notify();
  };

  onScrollBeginDrag = () => {
    this.userScrolling = true;
  };

  private computeLimit(): number {
    const queryHeightPx = this.viewportHeight * this.querySize;
    return Math.max(20, Math.ceil(queryHeightPx / this.estimatedRowHeight));
  }

  async loadMore(direction: 'backward' | 'forward') {
    if (!this.messageQuery || this._messages.length === 0) return;

    const messageList = this._displayMessages; // Display order (oldest first)
    if (messageList.length === 0) return;

    const isBackward = direction === 'backward';

    // Get anchor message for continuation
    const anchorMsg = isBackward ? messageList[0] : messageList[messageList.length - 1];
    const anchorTimestamp = anchorMsg.timestamp();

    // Prevent duplicate loads
    if (this.lastContinuationTimestamp === anchorTimestamp) return;

    this._loading = direction;
    this._mode = direction;
    this.lastContinuationTimestamp = anchorTimestamp;
    // Update display messages cache for new mode
    this._displayMessages = this._mode !== 'forward'
      ? [...this._messages].reverse()
      : this._messages;
    this.notify();

    try {
      const limit = this.computeLimit();
      const op = isBackward ? '<=' : '>=';
      const order = isBackward ? 'DESC' : 'ASC';

      await this.messageQuery.updateSelection(
        `room = '${this.roomId}' AND deleted = false AND timestamp ${op} ${anchorTimestamp} ORDER BY timestamp ${order} LIMIT ${limit}`,
        []
      );

      this.currentLimit = limit;
      this.currentDirection = order;
      this.refreshMessages();

      // If we hit the newest boundary, switch to live mode
      if (this.atLatest) {
        await this.setLiveMode();
        return;
      }
    } catch (e) {
      console.error('loadMore failed:', e);
    } finally {
      this._loading = false;
      this.notify();
    }
  }

  async setLiveMode() {
    this._mode = 'live';
    this.lastContinuationTimestamp = null;
    this._loading = false;
    // Update display messages cache for live mode (DESC → reversed)
    this._displayMessages = [...this._messages].reverse();

    if (this.messageQuery) {
      const limit = this.computeLimit();
      this.currentLimit = limit;
      this.currentDirection = 'DESC';

      await this.messageQuery.updateSelection(
        `room = '${this.roomId}' AND deleted = false ORDER BY timestamp DESC LIMIT ${limit}`,
        []
      );

      this.refreshMessages();
    }

    this.notify();
  }

  async jumpToLive() {
    await this.setLiveMode();
    this.scrollToEnd();
  }

  scrollToEnd() {
    if (this.flatListRef) {
      this.flatListRef.scrollToEnd({ animated: true });
    }
  }

  // Call after sending a message to immediately refresh
  onMessageSent() {
    this.refreshMessages();
    if (this._mode === 'live') {
      setTimeout(() => this.scrollToEnd(), 100);
    }
  }

  destroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.listeners.clear();
    this.flatListRef = null;
  }
}
