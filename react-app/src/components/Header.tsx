import React, { useSyncExternalStore } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { EditableTextField } from './EditableTextField';
import { useObserve } from '../hooks';
import { signalObserver, type UserReadHandle } from '../utils';
import { type UserViewInterface } from '../generated/ankurah_rn_model';

interface HeaderProps {
  currentUser: UserReadHandle;
  connectionStatus?: string;
}

export const Header = signalObserver(function Header({ currentUser, connectionStatus = 'Connecting...' }: HeaderProps) {
  const isDarkMode = useColorScheme() === 'dark';
  const observer = useObserve();

  // Subscribe to currentUser changes
  const user = useSyncExternalStore(
    currentUser.subscribe,
    currentUser.get
  );

  // Track signal access for any reactive fields
  observer.beginTracking();
  try {
    return (
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <Text style={[styles.title, isDarkMode && styles.textLight]}>
          Ankurah Chat
        </Text>
        <View style={styles.headerRight}>
          <View style={styles.userInfo}>
            <Text style={styles.userIcon}>👤</Text>
            {user ? (
              <EditableTextField
                view={user}
                field="displayName"
                placeholder="Set name..."
                style={isDarkMode ? styles.textLight : undefined}
              />
            ) : (
              <Text style={[styles.userName, isDarkMode && styles.textLight]}>
                Loading...
              </Text>
            )}
          </View>
          <View
            style={[
              styles.connectionStatus,
              connectionStatus === 'Connected'
                ? styles.connected
                : styles.disconnected,
            ]}>
            <Text style={styles.connectionText}>
              {connectionStatus}
            </Text>
          </View>
        </View>
      </View>
    );
  } finally {
    observer.finish();
  }
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerDark: {
    backgroundColor: '#1a1a1a',
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userIcon: {
    fontSize: 16,
  },
  userName: {
    fontSize: 14,
    color: '#333',
  },
  connectionStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  connected: {
    backgroundColor: '#e8f5e9',
  },
  disconnected: {
    backgroundColor: '#ffebee',
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  textLight: {
    color: '#fff',
  },
});

export default Header;
