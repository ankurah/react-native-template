import { View, Text, StyleSheet } from 'react-native';
import type { MessageIntersectionInterface } from '../generated/ankurah_rn_bindings';

interface ChatDebugHeaderProps {
    mode: string | null;
    messagesCount: number;
    updateCount: number;
    updatePending: boolean;
    itemsAbove: number;
    itemsBelow: number;
    triggerThreshold: number;
    hasMorePreceding: boolean;
    hasMoreFollowing: boolean;
    intersection: MessageIntersectionInterface | null;
}

export function ChatDebugHeader({
    mode,
    messagesCount,
    updateCount,
    updatePending,
    itemsAbove,
    itemsBelow,
    triggerThreshold,
    hasMorePreceding,
    hasMoreFollowing,
    intersection,
}: ChatDebugHeaderProps) {
    return (
        <View style={styles.debugPanel} testID="debug-panel">
            <Text style={styles.debugPanelText}>
                Mode: <Text style={mode === 'Live' ? styles.debugLive : styles.debugPaginating}>{mode ?? 'null'}</Text>
                {' | '}Items: {messagesCount}
                {' | '}Updates: {updateCount}
                {updatePending && <Text style={styles.debugWarning}> (pending)</Text>}
            </Text>
            <Text style={styles.debugPanelText}>
                ↑buf: <Text style={itemsAbove <= triggerThreshold && hasMorePreceding ? styles.debugWarning : styles.debugOk}>{itemsAbove}</Text>
                {hasMorePreceding && itemsAbove > triggerThreshold && <Text style={styles.debugFalse}> ({itemsAbove - triggerThreshold} to trigger)</Text>}
                {' '}
                ↓buf: <Text style={itemsBelow <= triggerThreshold && hasMoreFollowing ? styles.debugWarning : styles.debugOk}>{itemsBelow}</Text>
                {hasMoreFollowing && itemsBelow > triggerThreshold && <Text style={styles.debugFalse}> ({itemsBelow - triggerThreshold} to trigger)</Text>}
            </Text>
            <Text style={styles.debugPanelText}>
                ↑more: <Text style={hasMorePreceding ? styles.debugTrue : styles.debugFalse}>{hasMorePreceding ? 'Y' : 'N'}</Text>
                {' '}
                ↓more: <Text style={hasMoreFollowing ? styles.debugTrue : styles.debugFalse}>{hasMoreFollowing ? 'Y' : 'N'}</Text>
                {' '}
                threshold: {triggerThreshold}
            </Text>
            {intersection && (
                <Text style={styles.debugPanelText}>
                    Anchor: idx={intersection.index()} id=...{intersection.entityId().slice(-6)}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    debugPanel: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', padding: 8, zIndex: 100 },
    debugPanelText: { fontSize: 11, color: '#fff', fontFamily: 'Menlo', marginBottom: 2 },
    debugLive: { color: '#4CAF50', fontWeight: '600' },
    debugPaginating: { color: '#FF9800', fontWeight: '600' },
    debugTrue: { color: '#4CAF50' },
    debugFalse: { color: '#888' },
    debugWarning: { color: '#FF5722', fontWeight: '600' },
    debugOk: { color: '#8BC34A' },
});
