import React, { useEffect, useState, useMemo, useCallback, useSyncExternalStore } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  useColorScheme,
  Pressable,
  LayoutChangeEvent,
} from 'react-native';
import { useObserve } from '../hooks';
import { signalObserver, type UserReadHandle } from '../utils';
import { MessageRow } from './MessageRow';
import { MessageInput } from './MessageInput';
import { ChatScrollManager } from '../ChatScrollManager';
import {
  UserOps,
  type RoomViewInterface,
  type MessageViewInterface,
  type UserLiveQueryInterface,
} from '../generated/ankurah_rn_model';
import { getContext } from '../generated/ankurah_rn_bindings';

interface ChatProps {
  room: RoomViewInterface | null;
  currentUser: UserReadHandle;
  connectionStatus?: string;
  onBack?: () => void;
}

export const Chat = signalObserver(function Chat({ room, currentUser, connectionStatus = 'Connected', onBack }: ChatProps) {
  const isDarkMode = useColorScheme() === 'dark';
  const observer = useObserve();

  // Subscribe to currentUser changes
  const user = useSyncExternalStore(
    currentUser.subscribe,
    currentUser.get
  );

  // State for editing messages
  const [editingMessage, setEditingMessage] = useState<MessageViewInterface | null>(null);

  // User query for displaying author names
  const [userQuery, setUserQuery] = useState<UserLiveQueryInterface | null>(null);

  // Create ChatScrollManager when room changes
  const roomId = room?.id().toString() ?? null;
  const manager = useMemo(() => {
    if (!roomId) return null;
    return new ChatScrollManager(roomId);
  }, [roomId]);

  // Subscribe to manager updates - getSnapshot must return cached value
  const getManagerSnapshot = useCallback(() => manager?.getSnapshot() ?? null, [manager]);
  const subscribeToManager = useCallback(
    (onStoreChange: () => void) => manager?.subscribe(onStoreChange) ?? (() => {}),
    [manager]
  );
  const managerState = useSyncExternalStore(subscribeToManager, getManagerSnapshot);

  // Initialize user query
  useEffect(() => {
    const initUserQuery = async () => {
      try {
        const ctx = getContext();
        const userOps = new UserOps();
        const usrQuery = await userOps.query(ctx, 'true', []);
        setUserQuery(usrQuery);
      } catch (e) {
        console.error('Failed to init user query:', e);
      }
    };
    initUserQuery();
  }, []);

  // Cleanup on unmount or room change
  useEffect(() => {
    return () => manager?.destroy();
  }, [manager]);

  // Callback for message sent
  const handleMessageSent = useCallback(() => {
    manager?.onMessageSent();
  }, [manager]);

  // FlatList ref callback
  const flatListRef = useCallback((ref: FlatList<MessageViewInterface> | null) => {
    manager?.setFlatListRef(ref);
  }, [manager]);

  // Layout handler
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    manager?.onLayout(event.nativeEvent.layout.height);
  }, [manager]);

  if (!room) {
    return (
      <View style={[styles.container, isDarkMode && styles.containerDark]}>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, isDarkMode && styles.textLight]}>
            Select a room to start chatting
          </Text>
        </View>
      </View>
    );
  }

  // Track signal access for room name (reactive property)
  observer.beginTracking();
  const roomName = room.name();
  observer.finish();

  const messages = managerState?.messages ?? [];
  const showJumpToCurrent = managerState && !managerState.shouldAutoScroll && managerState.mode !== 'live';

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Room header with back button for mobile */}
      <View style={[styles.chatHeader, isDarkMode && styles.chatHeaderDark]}>
        {onBack && (
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={[styles.backButtonText, isDarkMode && styles.textLight]}>‹</Text>
          </Pressable>
        )}
        <Text style={[styles.roomTitle, isDarkMode && styles.textLight]}>
          # {roomName}
        </Text>
        {managerState?.loading && (
          <Text style={styles.loadingIndicator}>
            {managerState.loading === 'backward' ? '↑' : '↓'}
          </Text>
        )}
      </View>

      <View style={styles.messageListContainer} onLayout={handleLayout}>
        <FlatList
          ref={flatListRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          data={messages}
          keyExtractor={item => item.id().toString()}
          renderItem={({ item }) => (
            <MessageRow
              message={item}
              users={userQuery}
              currentUserId={user?.id() ?? null}
              onEdit={setEditingMessage}
            />
          )}
          onScroll={manager?.onScroll}
          onScrollBeginDrag={manager?.onScrollBeginDrag}
          onContentSizeChange={manager?.onContentSizeChange}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, isDarkMode && styles.textLight]}>
                No messages yet. Be the first to say hello!
              </Text>
            </View>
          }
        />

        {showJumpToCurrent && (
          <Pressable
            style={styles.jumpButton}
            onPress={() => manager?.jumpToLive()}
          >
            <Text style={styles.jumpButtonText}>Jump to Current ↓</Text>
          </Pressable>
        )}
      </View>

      <MessageInput
        room={room}
        currentUser={user}
        editingMessage={editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
        connectionStatus={connectionStatus}
        onMessageSent={handleMessageSent}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
  },
  chatHeaderDark: {
    backgroundColor: '#252525',
    borderBottomColor: '#333',
  },
  backButton: {
    paddingRight: 12,
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#007AFF',
  },
  roomTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  loadingIndicator: {
    fontSize: 16,
    color: '#007AFF',
  },
  messageListContainer: {
    flex: 1,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  textLight: {
    color: '#ccc',
  },
  jumpButton: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  jumpButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default Chat;
