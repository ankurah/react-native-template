import React, { useState, useEffect } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet, useColorScheme } from 'react-native';
import { MessageOps, MessageInput as MessageInputType, type RoomViewInterface, type UserViewInterface, type MessageViewInterface } from '../generated/ankurah_rn_model';
import { getContext } from '../generated/ankurah_rn_bindings';

interface MessageInputProps {
    room: RoomViewInterface;
    currentUser: UserViewInterface | null;
    editingMessage: MessageViewInterface | null;
    onCancelEdit: () => void;
    connectionStatus?: string;
    onMessageSent?: () => void;
}

export function MessageInput({ room, currentUser, editingMessage, onCancelEdit, connectionStatus = 'Connected', onMessageSent }: MessageInputProps) {
    const isDarkMode = useColorScheme() === 'dark';
    const [messageText, setMessageText] = useState('');

    // Use message ID (primitive) as dependency to avoid render loops with Rust objects
    const editingMessageId = editingMessage?.id().toString() ?? null;
    useEffect(() => { setMessageText(editingMessage?.text() ?? ''); }, [editingMessageId]);

    const handleSend = async () => {
        if (!messageText.trim() || !currentUser) return;
        try {
            if (editingMessage) {
                const ctx = getContext();
                const trx = ctx.begin();
                const textField = editingMessage.edit(trx).text();
                const oldText = editingMessage.text(), newText = messageText.trim();
                let prefixLen = 0;
                while (prefixLen < oldText.length && prefixLen < newText.length && oldText[prefixLen] === newText[prefixLen]) prefixLen++;
                if (oldText.length - prefixLen > 0) textField.delete_(prefixLen, oldText.length - prefixLen);
                if (newText.slice(prefixLen)) textField.insert(prefixLen, newText.slice(prefixLen));
                await trx.commit();
                onCancelEdit();
            } else {
                const input = MessageInputType.create({ user: currentUser.id().toString(), room: room.id().toString(), text: messageText.trim(), timestamp: BigInt(Date.now()), deleted: false });
                await new MessageOps().createOne(getContext(), input);
                onMessageSent?.();
            }
            setMessageText('');
        } catch (e) { console.error('Failed to send:', e); }
    };

    const isDisabled = connectionStatus !== 'Connected';
    const canSend = messageText.trim().length > 0 && !isDisabled;

    return (
        <View style={[styles.container, isDarkMode && styles.containerDark]} testID="message-input-container">
            <TextInput style={[styles.input, isDarkMode && styles.inputDark]} placeholder="Type a message..." placeholderTextColor={isDarkMode ? '#888' : '#999'} value={messageText} onChangeText={setMessageText} onSubmitEditing={handleSend} editable={!isDisabled} returnKeyType="send" testID="message-input" accessibilityLabel="Message Input" />
            <Pressable style={[styles.sendButton, !canSend && styles.sendButtonDisabled]} onPress={handleSend} disabled={!canSend} testID="send-btn" accessibilityLabel="Send Message">
                <Text style={styles.sendButtonText}>{editingMessage ? 'Update' : 'Send'}</Text>
            </Pressable>
            {editingMessage && <Pressable style={styles.cancelButton} onPress={() => { onCancelEdit(); setMessageText(''); }} testID="cancel-edit-btn"><Text style={styles.cancelButtonText}>Cancel</Text></Pressable>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0', gap: 8 },
    containerDark: { backgroundColor: '#1a1a1a', borderTopColor: '#333' },
    input: { flex: 1, fontSize: 16, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f5f5f5', borderRadius: 20, color: '#000' },
    inputDark: { backgroundColor: '#333', color: '#fff' },
    sendButton: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#007AFF', borderRadius: 20 },
    sendButtonDisabled: { opacity: 0.5 },
    sendButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
    cancelButton: { paddingHorizontal: 12, paddingVertical: 10 },
    cancelButtonText: { color: '#ff3b30', fontSize: 14 },
});

export default MessageInput;
