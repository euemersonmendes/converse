import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { SOCKET_EVENTS, type ChatSummary, type MessageItem } from '@converse/shared';
import { mobileApi } from '../config/api';
import { useAuth } from '../context/AuthContext';

export function ChatDetailScreen({ route }: any) {
  const chat: ChatSummary = route.params.chat;
  const { session, socket } = useAuth();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
  const [editingMsg, setEditingMsg] = useState<MessageItem | null>(null);
  const [pinnedMsg, setPinnedMsg] = useState(chat.pinnedMessage || null);

  const [pollModal, setPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOpt1, setPollOpt1] = useState('');
  const [pollOpt2, setPollOpt2] = useState('');

  useEffect(() => {
    mobileApi.getMessages(chat.id).then((res) => setMessages(res.messages));
    mobileApi.markRead(chat.id).catch(() => {});
    socket?.emit(SOCKET_EVENTS.CHAT_JOIN, { chatId: chat.id });
  }, [chat.id, socket]);

  useEffect(() => {
    if (!socket) return;
    const onNew = (msg: MessageItem) => {
      if (msg.chatId !== chat.id) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      if (msg.senderId !== session?.user.id) {
        mobileApi.markRead(chat.id).catch(() => {});
      }
    };
    const onEdited = (edited: MessageItem) => {
      if (edited.chatId !== chat.id) return;
      setMessages((prev) => prev.map((m) => (m.id === edited.id ? edited : m)));
    };
    const onDeleted = (payload: { chatId: string; messageId: string; deletedAt: string }) => {
      if (payload.chatId !== chat.id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? { ...m, deletedAt: payload.deletedAt, content: '🚫 Mensagem apagada', poll: null }
            : m
        )
      );
    };
    const onPoll = (payload: { chatId: string; messageId: string; poll: MessageItem['poll'] }) => {
      if (payload.chatId !== chat.id) return;
      setMessages((prev) => prev.map((m) => (m.id === payload.messageId ? { ...m, poll: payload.poll } : m)));
    };
    const onPinned = (payload: { chatId: string; pinnedMessage: ChatSummary['pinnedMessage'] }) => {
      if (payload.chatId === chat.id) setPinnedMsg(payload.pinnedMessage || null);
    };

    socket.on(SOCKET_EVENTS.MESSAGE_NEW, onNew);
    socket.on(SOCKET_EVENTS.MESSAGE_EDITED, onEdited);
    socket.on(SOCKET_EVENTS.MESSAGE_DELETED, onDeleted);
    socket.on(SOCKET_EVENTS.POLL_UPDATED, onPoll);
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE_PINNED, onPinned);

    return () => {
      socket.off(SOCKET_EVENTS.MESSAGE_NEW, onNew);
      socket.off(SOCKET_EVENTS.MESSAGE_EDITED, onEdited);
      socket.off(SOCKET_EVENTS.MESSAGE_DELETED, onDeleted);
      socket.off(SOCKET_EVENTS.POLL_UPDATED, onPoll);
      socket.off(SOCKET_EVENTS.CHAT_MESSAGE_PINNED, onPinned);
    };
  }, [chat.id, socket, session?.user.id]);

  const handleSend = async () => {
    if (!text.trim()) return;
    const content = text.trim();
    setText('');
    if (editingMsg) {
      const res = await mobileApi.editMessage(editingMsg.id, content);
      setMessages((prev) => prev.map((m) => (m.id === editingMsg.id ? res.message : m)));
      setEditingMsg(null);
      return;
    }
    const res = await mobileApi.sendMessage(chat.id, content, replyTo?.id ?? null);
    setReplyTo(null);
    setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
  };

  const handleLongPress = (msg: MessageItem) => {
    if (msg.deletedAt) return;
    const isMine = msg.senderId === session?.user.id;
    const buttons: any[] = [
      { text: 'Responder', onPress: () => setReplyTo(msg) },
      {
        text: msg.isStarred ? 'Remover Favorita' : 'Favoritar ★',
        onPress: async () => {
          const res = await mobileApi.toggleStarMessage(msg.id);
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isStarred: res.starred } : m)));
        },
      },
      {
        text: 'Fixar no topo 📌',
        onPress: () => mobileApi.pinMessageInChat(chat.id, msg.id),
      },
    ];
    if (isMine && msg.type === 'text') {
      buttons.push({
        text: 'Editar',
        onPress: () => {
          setEditingMsg(msg);
          setText(msg.content);
        },
      });
    }
    if (isMine) {
      buttons.push({
        text: 'Apagar para todos',
        style: 'destructive',
        onPress: () => mobileApi.deleteMessage(msg.id),
      });
    }
    buttons.push({ text: 'Cancelar', style: 'cancel' });
    Alert.alert('Ações da mensagem', msg.content.slice(0, 60), buttons);
  };

  const handleCreatePoll = async () => {
    if (!pollQuestion.trim() || !pollOpt1.trim() || !pollOpt2.trim()) return;
    await mobileApi.createPoll(chat.id, pollQuestion.trim(), [pollOpt1.trim(), pollOpt2.trim()]);
    setPollQuestion('');
    setPollOpt1('');
    setPollOpt2('');
    setPollModal(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {pinnedMsg && (
        <View style={styles.pinnedBanner}>
          <Text style={styles.pinnedLabel}>📌 Mensagem fixada</Text>
          <Text style={styles.pinnedText} numberOfLines={1}>
            {pinnedMsg.content}
          </Text>
        </View>
      )}

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 14, gap: 8 }}
        renderItem={({ item }) => {
          const isMine = item.senderId === session?.user.id;
          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onLongPress={() => handleLongPress(item)}
              style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubblePeer]}
            >
              {item.isForwarded && !item.deletedAt && (
                <Text style={styles.forwarded}>↪ Encaminhada</Text>
              )}
              {item.replyToPreview && (
                <View style={styles.replyBox}>
                  <Text style={styles.replyAuthor}>{item.replyToPreview.senderName}</Text>
                  <Text style={styles.replyText} numberOfLines={1}>
                    {item.replyToPreview.content}
                  </Text>
                </View>
              )}

              {item.type === 'poll' && item.poll ? (
                <View style={{ gap: 6, minWidth: 210 }}>
                  <Text style={[styles.msgText, { fontWeight: '700' }]}>📊 {item.poll.question}</Text>
                  {item.poll.options.map((opt) => {
                    const voted = opt.voterIds.includes(session?.user.id || '');
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.pollOpt, voted && styles.pollOptActive]}
                        onPress={() => mobileApi.votePoll(item.id, opt.id)}
                      >
                        <Text style={{ color: '#F0F7FF', fontSize: 13 }}>
                          {voted ? '✓ ' : ''}{opt.text}
                        </Text>
                        <Text style={{ color: '#AEBAC1', fontSize: 12 }}>{opt.voterIds.length}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={[styles.msgText, item.deletedAt && { fontStyle: 'italic', opacity: 0.7 }]}>
                  {item.content}
                </Text>
              )}

              <Text style={styles.meta}>
                {item.isStarred ? '★ ' : ''}
                {item.editedAt && !item.deletedAt ? 'editada • ' : ''}
                {new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{' '}
                {isMine && !item.deletedAt ? (item.status === 'read' ? '✓✓' : '✓') : ''}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {(replyTo || editingMsg) && (
        <View style={styles.replyBar}>
          <Text style={{ color: '#00D4FF', fontSize: 12, fontWeight: '700' }}>
            {editingMsg ? 'Editando mensagem' : `Respondendo: ${replyTo?.content}`}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setReplyTo(null);
              setEditingMsg(null);
              setText('');
            }}
          >
            <Text style={{ color: '#8BA4BE', fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.composer}>
        <TouchableOpacity style={styles.pollBtn} onPress={() => setPollModal(true)}>
          <Text style={{ fontSize: 18 }}>📊</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={editingMsg ? 'Edite sua mensagem...' : 'Mensagem...'}
          placeholderTextColor="#8BA4BE"
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendText}>Enviar</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={pollModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Criar Enquete</Text>
            <TextInput
              style={styles.modalInput}
              value={pollQuestion}
              onChangeText={setPollQuestion}
              placeholder="Pergunta..."
              placeholderTextColor="#8BA4BE"
            />
            <TextInput
              style={styles.modalInput}
              value={pollOpt1}
              onChangeText={setPollOpt1}
              placeholder="Opção 1"
              placeholderTextColor="#8BA4BE"
            />
            <TextInput
              style={styles.modalInput}
              value={pollOpt2}
              onChangeText={setPollOpt2}
              placeholder="Opção 2"
              placeholderTextColor="#8BA4BE"
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <TouchableOpacity style={[styles.sendBtn, { flex: 1, backgroundColor: '#1E3248' }]} onPress={() => setPollModal(false)}>
                <Text style={{ color: '#F0F7FF', textAlign: 'center', fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sendBtn, { flex: 1 }]} onPress={handleCreatePoll}>
                <Text style={[styles.sendText, { textAlign: 'center' }]}>Criar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070B12' },
  pinnedBanner: {
    backgroundColor: '#101B29',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1C2E42',
  },
  pinnedLabel: { color: '#00D4FF', fontSize: 11, fontWeight: '700' },
  pinnedText: { color: '#D1D7DB', fontSize: 12 },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#0E4F7A',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.22)',
    borderTopRightRadius: 4,
  },
  bubblePeer: {
    alignSelf: 'flex-start',
    backgroundColor: '#132030',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderTopLeftRadius: 4,
  },
  forwarded: { color: '#AEBAC1', fontSize: 11, fontStyle: 'italic', marginBottom: 3 },
  replyBox: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderLeftWidth: 3,
    borderLeftColor: '#00D4FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
  },
  replyAuthor: { color: '#00D4FF', fontSize: 11, fontWeight: '700' },
  replyText: { color: '#D1D7DB', fontSize: 12 },
  pollOpt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pollOptActive: { borderColor: '#00D4FF', backgroundColor: 'rgba(0,212,255,0.2)' },
  msgText: { color: '#F0F7FF', fontSize: 15 },
  meta: { color: '#AEBAC1', fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  replyBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#101B29',
  },
  composer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#132030',
    alignItems: 'center',
    gap: 8,
  },
  pollBtn: { padding: 6 },
  input: {
    flex: 1,
    backgroundColor: '#1E3248',
    color: '#F0F7FF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: '#00D4FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendText: { color: '#0D1520', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#0D1520', borderRadius: 20, padding: 18, gap: 10 },
  modalTitle: { color: '#F0F7FF', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  modalInput: { backgroundColor: '#132030', color: '#F0F7FF', borderRadius: 12, padding: 12 },
});
