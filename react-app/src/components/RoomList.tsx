import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useObserve } from '../hooks';
import { signalObserver } from '../utils';
import {
  RoomOps,
  RoomInput,
  type RoomViewInterface,
  type RoomLiveQueryInterface,
} from '../generated/ankurah_rn_model';
import { getContext } from '../generated/ankurah_rn_bindings';

interface RoomListProps {
  onSelectRoom: (room: RoomViewInterface) => void;
  rooms: RoomLiveQueryInterface;
}

export const RoomList = signalObserver(function RoomList({ onSelectRoom, rooms }: RoomListProps) {
  const isDarkMode = useColorScheme() === 'dark';
  const observer = useObserve();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Track signal access for reactive updates
  observer.beginTracking();
  let items: RoomViewInterface[] = [];
  try {
    items = rooms.resultset().items();
  } finally {
    observer.finish();
  }

  // Auto-select first room or "General" if no room selected
  useEffect(() => {
    if (!selectedRoomId && items.length > 0) {
      const generalRoom = items.find(r => r.name() === 'General');
      const roomToSelect = generalRoom || items[0];
      setSelectedRoomId(roomToSelect.id().toString());
      onSelectRoom(roomToSelect);
    }
  }, [selectedRoomId, items, onSelectRoom]);

  const handleSelectRoom = (room: RoomViewInterface) => {
    setSelectedRoomId(room.id().toString());
    onSelectRoom(room);
  };

  return (
    <View style={[styles.sidebar, isDarkMode && styles.sidebarDark]}>
      <View style={styles.sidebarHeader}>
        <Text style={[styles.sidebarTitle, isDarkMode && styles.textLight]}>
          Rooms
        </Text>
        <Pressable
          style={styles.createButton}
          onPress={() => setIsCreating(true)}>
          <Text style={styles.createButtonText}>+</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.roomList}>
        {isCreating && (
          <NewRoomInput
            onRoomCreated={handleSelectRoom}
            onCancel={() => setIsCreating(false)}
          />
        )}

        {items.length === 0 ? (
          <Text style={[styles.emptyText, isDarkMode && styles.textLight]}>
            No rooms available
          </Text>
        ) : (
          items.map(room => {
            const roomId = room.id().toString();
            const isSelected = selectedRoomId === roomId;
            return (
              <Pressable
                key={roomId}
                style={[
                  styles.roomItem,
                  isSelected && styles.roomItemSelected,
                  isDarkMode && styles.roomItemDark,
                  isSelected && isDarkMode && styles.roomItemSelectedDark,
                ]}
                onPress={() => handleSelectRoom(room)}>
                <Text
                  style={[
                    styles.roomName,
                    isDarkMode && styles.textLight,
                    isSelected && styles.roomNameSelected,
                  ]}>
                  # {room.name()}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
});

interface NewRoomInputProps {
  onRoomCreated: (room: RoomViewInterface) => void;
  onCancel: () => void;
}

function NewRoomInput({ onRoomCreated, onCancel }: NewRoomInputProps) {
  const isDarkMode = useColorScheme() === 'dark';
  const [roomName, setRoomName] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCreate = async () => {
    if (!roomName.trim()) return;

    try {
      const ctx = getContext();
      const roomOps = new RoomOps();
      const input = RoomInput.create({ name: roomName.trim() });
      const room = await roomOps.createOne(ctx, input);

      onRoomCreated(room);
      onCancel();
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  return (
    <View style={styles.newRoomInput}>
      <TextInput
        ref={inputRef}
        style={[styles.newRoomTextInput, isDarkMode && styles.inputDark]}
        placeholder="Room name..."
        placeholderTextColor={isDarkMode ? '#888' : '#999'}
        value={roomName}
        onChangeText={setRoomName}
        onSubmitEditing={handleCreate}
        onBlur={() => !roomName.trim() && onCancel()}
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  sidebarDark: {
    backgroundColor: '#252525',
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sidebarTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  createButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 22,
  },
  roomList: {
    flex: 1,
  },
  roomItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  roomItemDark: {
    borderBottomColor: '#333',
  },
  roomItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  roomItemSelectedDark: {
    backgroundColor: '#1a3a5c',
  },
  roomName: {
    fontSize: 14,
    color: '#333',
  },
  roomNameSelected: {
    fontWeight: '600',
  },
  emptyText: {
    padding: 16,
    textAlign: 'center',
    color: '#888',
    fontStyle: 'italic',
  },
  newRoomInput: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  newRoomTextInput: {
    fontSize: 14,
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  inputDark: {
    backgroundColor: '#333',
    borderColor: '#444',
    color: '#fff',
  },
  textLight: {
    color: '#fff',
  },
});

export default RoomList;
