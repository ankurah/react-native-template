import React, { useState, useRef, useEffect } from 'react';
import {
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  TextStyle,
  NativeSyntheticEvent,
  TextInputChangeEventData,
} from 'react-native';
import { type TransactionInterface, type YrsStringStringInterface } from '../generated/ankurah_core';
import { getContext } from '../generated/{{crate_name}}_bindings';
import { useObserve } from '../hooks';

// View with a string field K that edits to a Mutable with YrsStringString at K
type EditableStringView<K extends string> = {
  [P in K]: () => string | undefined;
} & {
  edit(trx: TransactionInterface): { [P in K]: () => YrsStringStringInterface };
};

interface Props<K extends string> {
  view: EditableStringView<K>;
  field: K;
  placeholder?: string;
  style?: TextStyle;
  testID?: string;
}

export function EditableTextField<K extends string>({
  view,
  field,
  placeholder = 'Tap to edit',
  style,
  testID,
}: Props<K>) {
  const observer = useObserve();
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState('');
  const inputRef = useRef<TextInput>(null);
  const lastValueRef = useRef('');
  // Serialize commits to prevent lineage conflicts from concurrent transactions
  const commitQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Track signal access
  observer.beginTracking();
  let currentValue: string;
  try {
    currentValue = view[field]() ?? '';
  } finally {
    observer.finish();
  }

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const startEdit = () => {
    if (!view) return;
    const value = String(currentValue);
    setLocalValue(value);
    lastValueRef.current = value;
    setIsEditing(true);
  };

  const applyChanges = (oldValue: string, newValue: string) => {
    // Queue commits to run sequentially, preventing lineage conflicts
    commitQueueRef.current = commitQueueRef.current.then(async () => {
      try {
        const ctx = getContext();
        const trx = (ctx as any).begin();
        const mutable = view.edit(trx);
        const yrsString = mutable[field]();

        // Find where strings differ
        let i = 0;
        const minLen = Math.min(oldValue.length, newValue.length);
        while (i < minLen && oldValue[i] === newValue[i]) i++;

        // Delete remainder of old, insert remainder of new
        const deleteCount = oldValue.length - i;
        if (deleteCount > 0) yrsString.delete_(i, deleteCount);

        const insertText = newValue.slice(i);
        if (insertText) yrsString.insert(i, insertText);

        await trx.commit();
      } catch (e) {
        console.error('Failed to apply changes:', e);
      }
    });
  };

  const handleChange = (e: NativeSyntheticEvent<TextInputChangeEventData>) => {
    const newValue = e.nativeEvent.text;
    applyChanges(lastValueRef.current, newValue);
    setLocalValue(newValue);
    lastValueRef.current = newValue;
  };

  const endEdit = () => {
    setIsEditing(false);
    setLocalValue('');
    lastValueRef.current = '';
  };

  const handleSubmit = () => {
    endEdit();
  };

  if (isEditing) {
    return (
      <TextInput
        ref={inputRef}
        style={[styles.input, style]}
        value={localValue}
        onChange={handleChange}
        onSubmitEditing={handleSubmit}
        onBlur={endEdit}
        returnKeyType="done"
        testID={testID}
      />
    );
  }

  return (
    <Pressable onPress={startEdit} testID={testID}>
      <Text style={[styles.text, style]}>
        {currentValue || placeholder}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 14,
    color: '#333',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  input: {
    fontSize: 14,
    color: '#333',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    backgroundColor: '#fff',
    minWidth: 100,
  },
});

export default EditableTextField;
