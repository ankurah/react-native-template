import { getContext } from './generated/{{crate_name}}_bindings';
import {
  MessageOps,
  type MessageViewInterface,
  type MessageChangeSetInterface,
  type MessageLiveQueryInterface,
  type RoomViewInterface,
  type RoomLiveQueryInterface,
  type RoomChangeSetInterface,
} from './generated/{{crate_name}}_model';
import { type SubscriptionGuardInterface } from './generated/ankurah_signals';
import { createSignal, type Signal, type SignalRead } from './hooks';
import { playNotificationSound } from './notificationSound';

// Note: this uses one query per room since GROUP BY is not yet available in Ankurah.
// In the future, this could be optimized to a single query with GROUP BY.
//
// This is the React Native counterpart of the web templates' NotificationManager.
// The unread-count tracking is platform-agnostic; the chime is delegated to a
// native module via playNotificationSound() (React Native has no Web Audio API).

interface RoomQueryState {
  query: MessageLiveQueryInterface | null;
  guard: SubscriptionGuardInterface | null;
}

export class NotificationManager {
  // Retained so the room subscription isn't dropped by GC.
  private roomsGuard: SubscriptionGuardInterface | null = null;
  private roomQueries = new Map<string, RoomQueryState>();

  // The current user's id (base64). Notifications only fire for messages from
  // *other* users, so this must reflect the resolved user — see setCurrentUserId.
  private currentUserId: string | null;
  // Room currently being viewed in live mode; messages here don't bump unread.
  private activeRoomId: string | null = null;

  // Plain mirror of the counts for reads inside subscription callbacks (avoids
  // registering a spurious signal dependency); the signal drives reactive badges.
  private counts: Record<string, number> = {};
  private unreadCountsSignal: Signal<Record<string, number>>;
  public readonly unreadCounts: SignalRead<Record<string, number>>;

  constructor(rooms: RoomLiveQueryInterface, currentUserId: string | null) {
    this.currentUserId = currentUserId;
    this.unreadCountsSignal = createSignal<Record<string, number>>({});
    this.unreadCounts = this.unreadCountsSignal;

    // Seed queries for rooms already present, then subscribe for future changes.
    // (The subscription also replays the current set once loaded; addRoomQuery is
    // idempotent, so seeding here just covers an already-loaded resultset.)
    try {
      for (const room of rooms.resultset().items()) {
        this.addRoomQuery(room);
      }
    } catch {
      // Resultset may not be loaded yet; the subscription below delivers them.
    }

    this.roomsGuard = rooms.subscribe({
      onChange: (changeset: RoomChangeSetInterface) => {
        for (const room of changeset.appeared()) {
          this.addRoomQuery(room);
        }
        for (const room of changeset.removed()) {
          this.removeRoomQuery(room.id().toString());
        }
      },
    });
  }

  private addRoomQuery(room: RoomViewInterface) {
    const roomId = room.id().toString();
    if (this.roomQueries.has(roomId)) return;

    // Reserve the slot synchronously so concurrent callbacks (or the seed loop
    // racing the subscription) don't create duplicate queries while query() awaits.
    const state: RoomQueryState = { query: null, guard: null };
    this.roomQueries.set(roomId, state);

    // Lightweight query for the latest messages in this room.
    new MessageOps()
      .query(
        getContext(),
        `room = '${roomId}' AND deleted = false ORDER BY timestamp DESC LIMIT 10`,
        [],
      )
      .then((query) => {
        // Room was removed while the query was resolving — discard.
        if (this.roomQueries.get(roomId) !== state) return;
        state.query = query;
        state.guard = query.subscribe({
          onChange: (changeset: MessageChangeSetInterface) =>
            this.handleRoomMessages(roomId, changeset),
        });
      })
      .catch((e) => {
        console.error('NotificationManager: failed to query room', roomId, e);
        // Drop the reservation so a later add can retry.
        if (this.roomQueries.get(roomId) === state) {
          this.roomQueries.delete(roomId);
        }
      });
  }

  private handleRoomMessages(roomId: string, changeset: MessageChangeSetInterface) {
    // added() = genuinely new items after the subscription started; this excludes
    // the initial load, so we don't chime for history on first open.
    const added = changeset.added();
    if (added.length === 0) return;

    const fromOthers = added.filter(
      (msg: MessageViewInterface) => msg.user() !== this.currentUserId,
    );
    if (fromOthers.length === 0) return;

    // Only bump the unread count if this isn't the room being actively viewed.
    if (roomId !== this.activeRoomId) {
      this.setCounts({
        ...this.counts,
        [roomId]: (this.counts[roomId] ?? 0) + fromOthers.length,
      });
    }

    // Always chime for messages from others (even in the active room).
    playNotificationSound();
  }

  private removeRoomQuery(roomId: string) {
    // Dropping the guard reference lets the subscription be released.
    this.roomQueries.delete(roomId);
    if (roomId in this.counts) {
      const next = { ...this.counts };
      delete next[roomId];
      this.setCounts(next);
    }
  }

  private setCounts(next: Record<string, number>) {
    this.counts = next;
    this.unreadCountsSignal.set(next);
  }

  /**
   * Update the current user's id. Notifications only fire for messages from
   * *other* users, so this must be called once the async user load completes —
   * otherwise (id = null) your own messages are treated as someone else's and
   * you chime on your own sends.
   */
  setCurrentUserId(id: string | null) {
    this.currentUserId = id;
  }

  /** Set the room being actively viewed (marks it read). Pass null to clear. */
  setActiveRoom(roomId: string | null) {
    this.activeRoomId = roomId;
    if (roomId) this.markAsRead(roomId);
  }

  markAsRead(roomId: string) {
    if (this.counts[roomId]) {
      const next = { ...this.counts };
      delete next[roomId];
      this.setCounts(next);
    }
  }
}
