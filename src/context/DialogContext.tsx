import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { View, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { colors, spacing, radius } from '../constants/theme';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface PromptOptions extends ConfirmOptions {
  placeholder?: string;
  secure?: boolean;
}

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  notify: (title: string, message?: string) => Promise<void>;
  // 취소하면 null, 확인하면 입력한 문자열을 돌려준다.
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

interface DialogState extends PromptOptions {
  visible: boolean;
  mode: 'confirm' | 'notify' | 'prompt';
}

const CLOSED: DialogState = { visible: false, mode: 'confirm', title: '' };

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>(CLOSED);
  const [inputValue, setInputValue] = useState('');
  const resolverRef = useRef<((value: any) => void) | null>(null);

  const settle = useCallback((value: any) => {
    setState(CLOSED);
    setInputValue('');
    resolverRef.current?.(value);
    resolverRef.current = null;
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    setState({ ...options, visible: true, mode: 'confirm' });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const notify = useCallback((title: string, message?: string) => {
    setState({ title, message, visible: true, mode: 'notify' });
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve();
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    setInputValue('');
    setState({ ...options, visible: true, mode: 'prompt' });
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  function handleConfirmPress() {
    if (state.mode === 'prompt') {
      settle(inputValue);
    } else {
      settle(true);
    }
  }

  function handleCancelPress() {
    settle(state.mode === 'prompt' ? null : false);
  }

  return (
    <DialogContext.Provider value={{ confirm, notify, prompt }}>
      {children}
      <Modal visible={state.visible} transparent animationType="fade" onRequestClose={handleCancelPress}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>{state.title}</Text>
            {state.message ? <Text style={styles.message}>{state.message}</Text> : null}
            {state.mode === 'prompt' && (
              <TextInput
                style={styles.input}
                placeholder={state.placeholder}
                placeholderTextColor={colors.textSoft}
                secureTextEntry={state.secure}
                value={inputValue}
                onChangeText={setInputValue}
                autoFocus
              />
            )}
            <View style={styles.actions}>
              {state.mode !== 'notify' && (
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancelPress}>
                  <Text style={styles.cancelText}>{state.cancelLabel ?? '취소'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.confirmButton, state.destructive && styles.destructiveButton]}
                onPress={handleConfirmPress}
              >
                <Text style={styles.confirmText}>{state.confirmLabel ?? '확인'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  message: { marginTop: spacing.sm, color: colors.textSoft, lineHeight: 22 },
  input: {
    marginTop: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
  cancelButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  cancelText: { color: colors.textSoft, fontWeight: '600' },
  confirmButton: { backgroundColor: colors.primary, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  destructiveButton: { backgroundColor: colors.danger },
  confirmText: { color: '#fff', fontWeight: '700' },
});
