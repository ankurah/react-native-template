import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { useObserve } from '../hooks';
import { signalObserver } from '../utils';
import {
  type MessageViewInterface,
  type UserLiveQueryInterface,
  type EntityIdInterface,
} from '../';

// Global registry of message row refs for scroll testing
export const messageRowRefs = new Map<string, View>();

interface MessageRowProps {
  message: MessageViewInterface;
  users: UserLiveQueryInterface | null;
  currentUserId: EntityIdInterface | null;
  onEdit: (message: MessageViewInterface) => void;
}

export const MessageRow = signalObserver(function MessageRow({
  message,
  users,
  currentUserId,
  onEdit,
}: MessageRowProps) {
  const isDarkMode = useColorScheme() === 'dark';
  const observer = useObserve();
  const viewRef = useRef<View>(null);

  // Track signal access for reactive properties
  observer.beginTracking();
  const messageId = message.id().toString();
  const messageText = message.text();
  const messageUserId = message.user();
  observer.finish();

  // Register/unregister ref for scroll testing
  useEffect(() => {
    if (viewRef.current) {
      messageRowRefs.set(messageId, viewRef.current);
    }
    return () => {
      messageRowRefs.delete(messageId);
    };
  }, [messageId]);

  // Look up author from users result set
  let authorName = 'Unknown';
  if (users) {
    const resultSet = users.resultset();
    const allUsers = resultSet.items();
    const author = allUsers.find(u => u.id().toString() === messageUserId);
    authorName = author?.displayName() ?? 'Unknown';
  }

  // Check if this is the current user's message
  const isOwnMessage = currentUserId ? messageUserId === currentUserId.toString() : false;

  const handleLongPress = () => {
    if (isOwnMessage) {
      onEdit(message);
    }
  };

  return (
    <View ref={viewRef} collapsable={false}>
      <Pressable onLongPress={handleLongPress}>
        <View
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownMessage : styles.otherMessage,
            isDarkMode && (isOwnMessage ? styles.ownMessageDark : styles.otherMessageDark),
          ]}>
          {!isOwnMessage && (
            <Text style={[styles.authorName, isDarkMode && styles.textLight]}>
              {authorName}
            </Text>
          )}
          <Text
            style={[styles.messageText, isDarkMode && styles.textLight]}
            testID={`message-text-${messageId}`}
            accessibilityLabel={messageText}>
            {messageText}
          </Text>
        </View>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginVertical: 2,
  },
  ownMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: '#e5e5ea',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  ownMessageDark: {
    backgroundColor: '#0a84ff',
  },
  otherMessageDark: {
    backgroundColor: '#3a3a3c',
  },
  authorName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 16,
    color: '#000',
  },
  textLight: {
    color: '#fff',
  },
});

export default MessageRow;
