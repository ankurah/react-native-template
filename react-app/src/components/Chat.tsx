import React, { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useColorScheme, Pressable, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { signalObserver, type UserReadHandle } from '../utils';
import { MessageRow } from './MessageRow';
import { MessageInput } from './MessageInput';
import { ChatDebugHeader } from './ChatDebugHeader';
import { UserOps, type RoomViewInterface, type MessageViewInterface, type UserLiveQueryInterface } from '../generated/{{crate_name}}_model';
import { getContext, MessageScrollManager, type MessageVisibleSetInterface, type MessageScrollManagerInterface } from '../generated/{{crate_name}}_bindings';
const ctx = getContext;

// Scroll manager configuration
// MIN_ROW_HEIGHT should approximate actual row height in points (not pixels)
// With ~10.5 messages fitting in 600pt viewport, actual height is ~57pt
const MIN_ROW_HEIGHT = 57;
const BUFFER_FACTOR = 2.0;
const DEFAULT_VIEWPORT_HEIGHT = 600;
const maintainVisibleContentPosition = { minIndexForVisible: 0 };

// Optional test hook - tests can set this to observe render state
declare global {
    var __CHAT_RENDER_HOOK__: ((state: {
        visibleSet: MessageVisibleSetInterface | null;
        manager: MessageScrollManagerInterface | null;
        scrollViewRef: React.RefObject<ScrollView>;
        viewportHeight: number;
    }) => void) | undefined;
}

interface ChatProps {
    room: RoomViewInterface | null;
    currentUser: UserReadHandle;
    connectionStatus?: string;
    onBack?: () => void;
}

export const Chat = signalObserver(function Chat({ room, currentUser, connectionStatus = 'Connected', onBack }: ChatProps) {
    const isDarkMode = useColorScheme() === 'dark';
    const [editingMessage, setEditingMessage] = useState<MessageViewInterface | null>(null);
    const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT);

    const scrollViewRef = useRef<ScrollView | null>(null);
    const lastScrollTopRef = useRef(0);
    const userQueryRef = useRef<UserLiveQueryInterface | null>(null);
    // Track item layouts for visible item calculation
    const itemLayoutsRef = useRef<Map<string, { y: number; height: number }>>(new Map());
    // Track programmatic scrolls to avoid triggering pagination
    const isProgrammaticScrollRef = useRef(false);
    // Track if user is actively touching/dragging
    const isTouchingRef = useRef(false);
    // Debug panel state
    const [showDebugPanel, setShowDebugPanel] = useState(true);

    const roomId = room?.id().toString() ?? null;

    // Create manager - recreate if viewport changes significantly
    const manager = useMemo(() => {
        if (!roomId) return null;
        const m = new MessageScrollManager(
            ctx(),
            `room = '${roomId}' AND deleted = false`,
            'timestamp DESC',
            MIN_ROW_HEIGHT,
            BUFFER_FACTOR,
            viewportHeight
        );
        m.start(); // Fire and forget - visibleSet signal will update when ready
        return m;
    }, [roomId, viewportHeight]);

    // Get signals from manager - memoize to get same Arc wrapper each render
    // Then .get() which signalObserver tracks for reactivity
    const visibleSet = useMemo(() => manager?.visibleSet() ?? null, [manager])?.get() ?? null;
    const debugInfo = useMemo(() => manager?.debugInfo() ?? null, [manager])?.get() ?? null;

    // Extract data from visibleSet
    const messages = visibleSet?.items() ?? [];
    const shouldAutoScroll = visibleSet?.shouldAutoScroll() ?? false;
    const hasMorePreceding = visibleSet?.hasMorePreceding() ?? false;
    const hasMoreFollowing = visibleSet?.hasMoreFollowing() ?? false;
    const intersection = visibleSet?.intersection() ?? null;
    const mode = manager?.mode() ?? null;

    // Track the last intersection we processed (for logging)
    const lastProcessedIntersectionRef = useRef<string | null>(null);

    // Extract debug info for buffer visualization
    const itemsAbove = debugInfo?.itemsAbove() ?? 0;
    const itemsBelow = debugInfo?.itemsBelow() ?? 0;
    const triggerThreshold = debugInfo?.triggerThreshold() ?? 0;
    const updateCount = debugInfo?.updateCount() ?? 0;
    const updatePending = debugInfo?.updatePending() ?? false;

    // Track intersection changes (native maintainVisibleContentPosition handles scroll stability)
    const intersectionKey = intersection ? `${intersection.entityId()}-${intersection.index()}` : null;
    if (intersection && intersectionKey !== lastProcessedIntersectionRef.current) {
        lastProcessedIntersectionRef.current = intersectionKey;
    }

    // Call test hook if registered (for test observability)
    globalThis.__CHAT_RENDER_HOOK__?.({ visibleSet, manager, scrollViewRef: scrollViewRef as React.RefObject<ScrollView>, viewportHeight });

    useEffect(() => {
        new UserOps().query(ctx(), 'true', []).then(q => { userQueryRef.current = q; });
    }, []);

    const scrollToEnd = useCallback(() => {
        isProgrammaticScrollRef.current = true;
        scrollViewRef.current?.scrollToEnd({ animated: false });
        // Clear flag after a short delay to allow scroll events to settle
        setTimeout(() => { isProgrammaticScrollRef.current = false; }, 100);
    }, []);

    // Store manager in ref to avoid dependency array issues with Rust objects
    const managerRef = useRef(manager);
    managerRef.current = manager;

    const handleLayout = useCallback((e: LayoutChangeEvent) => {
        const height = e.nativeEvent.layout.height;
        // Always update for now to debug
        if (height !== viewportHeight) {
            setViewportHeight(height);
        }
    }, [viewportHeight]);

    // Calculate visible items based on scroll position and item layouts
    const getVisibleItems = useCallback((scrollY: number): { firstId: string | null; lastId: string | null } => {
        const layouts = itemLayoutsRef.current;
        if (layouts.size === 0) return { firstId: null, lastId: null };

        let firstId: string | null = null;
        let lastId: string | null = null;
        const viewportBottom = scrollY + viewportHeight;

        for (const msg of messages) {
            const id = msg.id().toString();
            const layout = layouts.get(id);
            if (!layout) continue;

            const itemTop = layout.y;
            const itemBottom = layout.y + layout.height;

            // Item is visible if it overlaps with viewport
            if (itemBottom > scrollY && itemTop < viewportBottom) {
                if (!firstId) firstId = id;
                lastId = id;
            }
        }

        return { firstId, lastId };
    }, [messages, viewportHeight]);

    const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const mgr = managerRef.current;
        if (!mgr) return;
        const { contentOffset } = e.nativeEvent;
        const scrollingBackward = contentOffset.y < lastScrollTopRef.current;
        lastScrollTopRef.current = contentOffset.y;

        // Calculate visible items from layouts and notify Rust for user-initiated scrolls
        const { firstId, lastId } = getVisibleItems(contentOffset.y);
        if (firstId && lastId && !isProgrammaticScrollRef.current) {
            mgr.onScroll(firstId, lastId, scrollingBackward);
        }
    }, [getVisibleItems]);

    // Track item layout when it mounts/changes
    const handleItemLayout = useCallback((id: string, e: LayoutChangeEvent) => {
        const { y, height } = e.nativeEvent.layout;
        itemLayoutsRef.current.set(id, { y, height });
    }, []);

    const handleJumpToLive = useCallback(() => {
        scrollToEnd();
    }, [scrollToEnd]);

    const handleMessageSent = useCallback(() => {
        // Scroll to end when sending a message in Live mode
        if (managerRef.current?.mode() === 'Live') {
            scrollToEnd();
        }
    }, [scrollToEnd]);

    const user = currentUser.get();
    // Show "Jump to Current" when not in auto-scroll mode (user scrolled away from bottom)
    const showJumpToCurrent = !shouldAutoScroll;

    // Handle touch/drag to prevent auto-scroll during user interaction
    const handleScrollBeginDrag = useCallback(() => {
        isTouchingRef.current = true;
    }, []);
    const handleScrollEndDrag = useCallback(() => {
        isTouchingRef.current = false;
        // When drag ends, if we're in Live mode, scroll to end
        if (visibleSet?.shouldAutoScroll()) {
            scrollToEnd();
        }
    }, [visibleSet, scrollToEnd]);

    // Auto-scroll to end when messages load and shouldAutoScroll is true
    // Only auto-scroll if user is NOT currently touching/dragging
    const messagesKey = messages.map(m => m.id().toString()).join(',');
    useEffect(() => {
        if (shouldAutoScroll && messages.length > 0 && !isTouchingRef.current) {
            scrollToEnd();
        }
    }, [messagesKey, shouldAutoScroll, scrollToEnd]);

    if (!room) {
        return (
            <View style={[styles.container, isDarkMode && styles.containerDark]}>
                <View style={styles.emptyState}><Text style={[styles.emptyText, isDarkMode && styles.textLight]}>Select a room to start chatting</Text></View>
            </View>
        );
    }

    return (
        <View style={[styles.container, isDarkMode && styles.containerDark]}>
            <View style={[styles.chatHeader, isDarkMode && styles.chatHeaderDark]} testID="chat-header">
                {onBack && <Pressable onPress={onBack} style={styles.backButton} testID="back-btn"><Text style={[styles.backButtonText, isDarkMode && styles.textLight]}>‹</Text></Pressable>}
                <Text style={[styles.roomTitle, isDarkMode && styles.textLight]} testID="room-title"># {room.name()}</Text>
                <Pressable onPress={() => setShowDebugPanel(!showDebugPanel)} style={styles.debugToggle} testID="debug-toggle">
                    <Text style={styles.debugToggleText}>{showDebugPanel ? '▼' : '▶'} Debug</Text>
                </Pressable>
                {mode && mode !== 'Live' && <Text style={styles.loadingIndicator} testID="loading-indicator">{mode === 'Backward' ? '↑' : '↓'}</Text>}
            </View>
            <View style={styles.messageListContainer} onLayout={handleLayout} testID="message-list-container">
                {showDebugPanel && (
                    <ChatDebugHeader
                        mode={mode}
                        messagesCount={messages.length}
                        updateCount={updateCount}
                        updatePending={updatePending}
                        itemsAbove={itemsAbove}
                        itemsBelow={itemsBelow}
                        triggerThreshold={triggerThreshold}
                        hasMorePreceding={hasMorePreceding}
                        hasMoreFollowing={hasMoreFollowing}
                        intersection={intersection}
                    />
                )}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.messageList}
                    contentContainerStyle={styles.messageListContent}
                    onScroll={handleScroll}
                    onScrollBeginDrag={handleScrollBeginDrag}
                    onScrollEndDrag={handleScrollEndDrag}
                    scrollEventThrottle={16}
                    testID="message-list"
                    // Keep content in place when items are prepended (pagination)
                    // Note: Using variable to avoid cargo-generate template syntax conflict with JSX
                    maintainVisibleContentPosition={maintainVisibleContentPosition}
                >
                    {messages.length === 0 ? (
                        <View style={styles.emptyState} testID="empty-messages">
                            <Text style={[styles.emptyText, isDarkMode && styles.textLight]}>No messages yet. Be the first to say hello!</Text>
                        </View>
                    ) : (
                        messages.map(item => {
                            const itemId = item.id().toString();
                            return (
                                <View
                                    key={itemId}
                                    onLayout={(e) => handleItemLayout(itemId, e)}
                                >
                                    <MessageRow message={item} users={userQueryRef.current} currentUserId={user?.id() ?? null} onEdit={setEditingMessage} />
                                </View>
                            );
                        })
                    )}
                </ScrollView>
                {showJumpToCurrent && <Pressable style={styles.jumpButton} onPress={handleJumpToLive} testID="jump-to-live-btn"><Text style={styles.jumpButtonText}>Jump to Current ↓</Text></Pressable>}
            </View>
            <MessageInput room={room} currentUser={user} editingMessage={editingMessage} onCancelEdit={() => setEditingMessage(null)} connectionStatus={connectionStatus} onMessageSent={handleMessageSent} />
        </View>
    );
});

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    containerDark: { backgroundColor: '#1a1a1a' },
    chatHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e0e0e0', backgroundColor: '#f8f8f8' },
    chatHeaderDark: { backgroundColor: '#252525', borderBottomColor: '#333' },
    backButton: { paddingRight: 12, paddingVertical: 4 },
    backButtonText: { fontSize: 28, fontWeight: '300', color: '#007AFF' },
    roomTitle: { fontSize: 16, fontWeight: '600', color: '#333', flex: 1 },
    loadingIndicator: { fontSize: 16, color: '#007AFF' },
    messageListContainer: { flex: 1 },
    messageList: { flex: 1 },
    messageListContent: { padding: 12 },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyText: { fontSize: 16, color: '#888', textAlign: 'center' },
    textLight: { color: '#ccc' },
    jumpButton: { position: 'absolute', bottom: 16, alignSelf: 'center', backgroundColor: '#007AFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    jumpButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    // Debug toggle (panel styles are in ChatDebugHeader)
    debugToggle: { paddingHorizontal: 8, paddingVertical: 4 },
    debugToggleText: { fontSize: 12, color: '#007AFF' },
});

export default Chat;
