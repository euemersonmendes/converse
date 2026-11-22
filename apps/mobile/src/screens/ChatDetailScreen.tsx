import React, { useEffect, useRef, useState } from 'react';
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
  Image,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { SOCKET_EVENTS, type ChatSummary, type MessageItem } from '@converse/shared';
import { HeaderCameraIcon, MicIcon, PlusIcon } from '../components/NavIcons';
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

  // Menu de anexos (+) & Arquivo
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileLink, setFileLink] = useState('');

  // Media (Foto, Vídeo & Áudio)
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'picture' | 'video'>('picture');
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [audioSec, setAudioSec] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const cameraRef = useRef<CameraView | null>(null);
  const audioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cameraPerm, requestCameraPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();

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

  const uriToDataUrl = async (uri: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
      reader.readAsDataURL(blob);
    });
  };

  const handleOpenMediaCamera = async (mode: 'picture' | 'video') => {
    if (!cameraPerm?.granted) {
      const res = await requestCameraPerm();
      if (!res.granted) {
        Alert.alert('Permissão necessária', 'Autorize o acesso à câmera para enviar fotos e vídeos.');
        return;
      }
    }
    if (mode === 'video' && !micPerm?.granted) {
      const resMic = await requestMicPerm();
      if (!resMic.granted) {
        Alert.alert('Permissão necessária', 'Autorize o microfone para gravar vídeos com áudio.');
        return;
      }
    }
    setCameraMode(mode);
    setCameraOpen(true);
  };

  const handleCaptureOrRecord = async () => {
    if (!cameraRef.current || sendingMedia) return;
    if (cameraMode === 'picture') {
      try {
        setSendingMedia(true);
        const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.45 });
        const mediaUrl = photo?.base64 ? `data:image/jpeg;base64,${photo.base64}` : photo?.uri;
        if (mediaUrl) {
          const res = await mobileApi.sendMessage(chat.id, '📷 Foto', replyTo?.id ?? null, {
            type: 'image',
            mediaUrl,
          });
          setReplyTo(null);
          setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
          setCameraOpen(false);
        }
      } catch {
        Alert.alert('Erro', 'Não foi possível enviar a foto.');
      } finally {
        setSendingMedia(false);
      }
      return;
    }

    if (isRecordingVideo) {
      cameraRef.current.stopRecording();
      return;
    }

    try {
      setIsRecordingVideo(true);
      const video = await cameraRef.current.recordAsync({ maxDuration: 12 });
      setIsRecordingVideo(false);
      if (video?.uri) {
        setSendingMedia(true);
        const dataUrl = await uriToDataUrl(video.uri);
        const res = await mobileApi.sendMessage(chat.id, '🎬 Vídeo', replyTo?.id ?? null, {
          type: 'video',
          mediaUrl: dataUrl || video.uri,
        });
        setReplyTo(null);
        setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
        setCameraOpen(false);
      }
    } catch {
      setIsRecordingVideo(false);
      Alert.alert('Erro', 'Não foi possível gravar/enviar o vídeo.');
    } finally {
      setSendingMedia(false);
    }
  };

  const handleToggleAudioRecord = async () => {
    if (!recordingAudio) {
      if (!micPerm?.granted) {
        await requestMicPerm().catch(() => {});
      }
      setAudioSec(0);
      setRecordingAudio(true);
      audioTimerRef.current = setInterval(() => {
        setAudioSec((s) => s + 1);
      }, 1000);
      return;
    }

    if (audioTimerRef.current) {
      clearInterval(audioTimerRef.current);
      audioTimerRef.current = null;
    }
    const duration = Math.max(1, audioSec);
    setRecordingAudio(false);
    setAudioSec(0);
    const formatted = `0:${duration < 10 ? '0' : ''}${duration}`;
    const res = await mobileApi.sendMessage(chat.id, `🎤 Áudio (${formatted})`, replyTo?.id ?? null, {
      type: 'audio',
      audioDurationSec: duration,
    });
    setReplyTo(null);
    setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
  };

  const handleCancelAudioRecord = () => {
    if (audioTimerRef.current) {
      clearInterval(audioTimerRef.current);
      audioTimerRef.current = null;
    }
    setRecordingAudio(false);
    setAudioSec(0);
  };

  const handleSendFile = async () => {
    if (!fileName.trim()) {
      Alert.alert('Informe o arquivo', 'Digite o nome do arquivo ou documento.');
      return;
    }
    const content = fileLink.trim()
      ? `📎 Arquivo: ${fileName.trim()}\n${fileLink.trim()}`
      : `📎 Arquivo: ${fileName.trim()}`;
    const res = await mobileApi.sendMessage(chat.id, content, replyTo?.id ?? null);
    setReplyTo(null);
    setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
    setFileName('');
    setFileLink('');
    setFileModalOpen(false);
  };

  const handleSendLocation = async () => {
    setAttachMenuOpen(false);
    const city = session?.user.city || 'Localização atual';
    const res = await mobileApi.sendMessage(chat.id, `📍 Localização compartilhada: ${city}`, replyTo?.id ?? null);
    setReplyTo(null);
    setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
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

              {item.type === 'image' && item.mediaUrl && !item.deletedAt ? (
                <TouchableOpacity onPress={() => setPreviewImageUrl(item.mediaUrl || null)} activeOpacity={0.9}>
                  <Image source={{ uri: item.mediaUrl }} style={styles.mediaImage} resizeMode="cover" />
                </TouchableOpacity>
              ) : item.type === 'video' && !item.deletedAt ? (
                <View style={styles.videoCard}>
                  <View style={styles.videoPlayCircle}>
                    <Text style={styles.videoPlayIcon}>▶</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.msgText}>🎬 Vídeo</Text>
                    <Text style={styles.videoSub}>Gravado e enviado no Converse</Text>
                  </View>
                </View>
              ) : item.type === 'audio' && !item.deletedAt ? (
                <TouchableOpacity
                  style={styles.audioRow}
                  onPress={() => setPlayingAudioId(playingAudioId === item.id ? null : item.id)}
                >
                  <View style={styles.audioPlayBtn}>
                    <Text style={styles.audioPlayText}>{playingAudioId === item.id ? '❚❚' : '▶'}</Text>
                  </View>
                  <View style={styles.audioBars}>
                    {[6, 12, 16, 9, 15, 11, 18, 8, 14, 7, 13, 9].map((h, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.audioBar,
                          { height: h, backgroundColor: playingAudioId === item.id ? '#00D4FF' : '#8BA4BE' },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.audioDuration}>
                    0:{String(item.audioDurationSec ?? 8).padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ) : item.type === 'poll' && item.poll ? (
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
        <TouchableOpacity style={styles.plusBtn} onPress={() => setAttachMenuOpen(true)} activeOpacity={0.85}>
          <PlusIcon color="#00D4FF" />
        </TouchableOpacity>

        {recordingAudio ? (
          <View style={styles.recordingBar}>
            <Text style={styles.recordingText}>🔴 Gravando áudio 0:{String(audioSec).padStart(2, '0')}</Text>
            <TouchableOpacity onPress={handleCancelAudioRecord}>
              <Text style={{ color: '#8BA4BE', fontSize: 12, fontWeight: '700' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={editingMsg ? 'Edite sua mensagem...' : 'Mensagem...'}
            placeholderTextColor="#8BA4BE"
            multiline
          />
        )}

        <TouchableOpacity
          style={styles.cameraQuickBtn}
          onPress={() => handleOpenMediaCamera('picture')}
          activeOpacity={0.85}
        >
          <HeaderCameraIcon color="#F0F7FF" />
        </TouchableOpacity>

        {text.trim() ? (
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend} activeOpacity={0.85}>
            <Text style={styles.sendText}>Enviar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.micBtn, recordingAudio && styles.micBtnRecording]}
            onPress={handleToggleAudioRecord}
            activeOpacity={0.85}
          >
            {recordingAudio ? (
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>Enviar</Text>
            ) : (
              <MicIcon color="#070B12" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Menu + (Vídeo, Arquivo, Enquete, Localização) */}
      <Modal visible={attachMenuOpen} transparent animationType="fade" onRequestClose={() => setAttachMenuOpen(false)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setAttachMenuOpen(false)}>
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>Adicionar à conversa</Text>
            <View style={styles.sheetGrid}>
              <TouchableOpacity
                style={styles.sheetItem}
                onPress={() => {
                  setAttachMenuOpen(false);
                  handleOpenMediaCamera('video');
                }}
              >
                <View style={[styles.sheetIcon, { backgroundColor: 'rgba(244,63,94,0.18)' }]}>
                  <Text style={{ fontSize: 22 }}>🎬</Text>
                </View>
                <Text style={styles.sheetLabel}>Vídeo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetItem}
                onPress={() => {
                  setAttachMenuOpen(false);
                  handleOpenMediaCamera('picture');
                }}
              >
                <View style={[styles.sheetIcon, { backgroundColor: 'rgba(0,212,255,0.18)' }]}>
                  <Text style={{ fontSize: 22 }}>📷</Text>
                </View>
                <Text style={styles.sheetLabel}>Foto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetItem}
                onPress={() => {
                  setAttachMenuOpen(false);
                  setFileModalOpen(true);
                }}
              >
                <View style={[styles.sheetIcon, { backgroundColor: 'rgba(139,92,246,0.2)' }]}>
                  <Text style={{ fontSize: 22 }}>📎</Text>
                </View>
                <Text style={styles.sheetLabel}>Arquivo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetItem}
                onPress={() => {
                  setAttachMenuOpen(false);
                  setPollModal(true);
                }}
              >
                <View style={[styles.sheetIcon, { backgroundColor: 'rgba(16,185,129,0.2)' }]}>
                  <Text style={{ fontSize: 22 }}>📊</Text>
                </View>
                <Text style={styles.sheetLabel}>Enquete</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sheetItem} onPress={handleSendLocation}>
                <View style={[styles.sheetIcon, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
                  <Text style={{ fontSize: 22 }}>📍</Text>
                </View>
                <Text style={styles.sheetLabel}>Localização</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal Enviar Arquivo */}
      <Modal visible={fileModalOpen} transparent animationType="slide" onRequestClose={() => setFileModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enviar Arquivo / Documento</Text>
            <TextInput
              style={styles.modalInput}
              value={fileName}
              onChangeText={setFileName}
              placeholder="Nome do arquivo (ex: Contrato.pdf)"
              placeholderTextColor="#8BA4BE"
            />
            <TextInput
              style={styles.modalInput}
              value={fileLink}
              onChangeText={setFileLink}
              placeholder="Link ou descrição (opcional)"
              placeholderTextColor="#8BA4BE"
              autoCapitalize="none"
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <TouchableOpacity
                style={[styles.sendBtn, { flex: 1, backgroundColor: '#1E3248' }]}
                onPress={() => setFileModalOpen(false)}
              >
                <Text style={{ color: '#F0F7FF', textAlign: 'center', fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sendBtn, { flex: 1 }]} onPress={handleSendFile}>
                <Text style={[styles.sendText, { textAlign: 'center' }]}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <View style={styles.cameraModal}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} mode={cameraMode} facing={cameraFacing}>
            <View style={styles.cameraTopBar}>
              <TouchableOpacity
                style={styles.cameraActionBtn}
                onPress={() => {
                  if (isRecordingVideo) cameraRef.current?.stopRecording();
                  setCameraOpen(false);
                }}
              >
                <Text style={styles.cameraActionText}>✕ Fechar</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.cameraActionBtn, cameraMode === 'picture' && styles.cameraModeActive]}
                  onPress={() => !isRecordingVideo && setCameraMode('picture')}
                >
                  <Text style={styles.cameraActionText}>Foto</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cameraActionBtn, cameraMode === 'video' && styles.cameraModeActive]}
                  onPress={() => !isRecordingVideo && setCameraMode('video')}
                >
                  <Text style={styles.cameraActionText}>Vídeo</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.cameraActionBtn}
                onPress={() => !isRecordingVideo && setCameraFacing((f) => (f === 'back' ? 'front' : 'back'))}
              >
                <Text style={styles.cameraActionText}>🔄</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cameraBottomBar}>
              <TouchableOpacity
                style={[styles.shutterOuter, isRecordingVideo && { borderColor: '#F43F5E' }]}
                onPress={handleCaptureOrRecord}
                disabled={sendingMedia}
              >
                {sendingMedia ? (
                  <ActivityIndicator color="#00D4FF" />
                ) : (
                  <View
                    style={[
                      styles.shutterInner,
                      cameraMode === 'video' && { backgroundColor: '#F43F5E' },
                      isRecordingVideo && { width: 28, height: 28, borderRadius: 6 },
                    ]}
                  />
                )}
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      </Modal>

      <Modal visible={Boolean(previewImageUrl)} transparent animationType="fade" onRequestClose={() => setPreviewImageUrl(null)}>
        <TouchableOpacity style={styles.imagePreviewBackdrop} activeOpacity={1} onPress={() => setPreviewImageUrl(null)}>
          {previewImageUrl && <Image source={{ uri: previewImageUrl }} style={styles.imagePreviewFull} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>

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
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    backgroundColor: '#0B121D',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,212,255,0.2)',
    alignItems: 'center',
    gap: 8,
  },
  plusBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#132030',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 110,
    backgroundColor: '#132030',
    color: '#F0F7FF',
    borderRadius: 23,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15.5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cameraQuickBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#132030',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00D4FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  micBtnRecording: {
    width: 64,
    backgroundColor: '#F43F5E',
    shadowColor: '#F43F5E',
  },
  sendBtn: {
    backgroundColor: '#00D4FF',
    paddingHorizontal: 16,
    height: 44,
    justifyContent: 'center',
    borderRadius: 22,
  },
  sendText: { color: '#0D1520', fontWeight: '800' },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#0D1520',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderColor: 'rgba(0,212,255,0.22)',
  },
  sheetTitle: { color: '#F0F7FF', fontSize: 16, fontWeight: '800', marginBottom: 16 },
  sheetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  sheetItem: { width: '28%', alignItems: 'center', gap: 6 },
  sheetIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sheetLabel: { color: '#D1DFEE', fontSize: 12.5, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#0D1520', borderRadius: 20, padding: 18, gap: 10 },
  modalTitle: { color: '#F0F7FF', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  modalInput: { backgroundColor: '#132030', color: '#F0F7FF', borderRadius: 12, padding: 12 },
  mediaImage: { width: 220, height: 220, borderRadius: 12, marginBottom: 4 },
  videoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 200, paddingVertical: 4 },
  videoPlayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#00D4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayIcon: { color: '#070B12', fontSize: 14, fontWeight: '800', marginLeft: 2 },
  videoSub: { color: '#8BA4BE', fontSize: 11 },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 205, paddingVertical: 4 },
  audioPlayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#00D4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPlayText: { color: '#070B12', fontSize: 12, fontWeight: '800' },
  audioBars: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, height: 22 },
  audioBar: { width: 3, borderRadius: 2 },
  audioDuration: { color: '#AEBAC1', fontSize: 11, fontWeight: '600' },
  recordingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(244,63,94,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.45)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recordingText: { color: '#FDA4AF', fontSize: 13, fontWeight: '700' },
  cameraModal: { flex: 1, backgroundColor: '#070B12' },
  cameraTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  cameraActionBtn: {
    backgroundColor: 'rgba(7,11,18,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  cameraModeActive: { borderColor: '#00D4FF', backgroundColor: 'rgba(0,212,255,0.22)' },
  cameraActionText: { color: '#F0F7FF', fontWeight: '700', fontSize: 13 },
  cameraBottomBar: { position: 'absolute', bottom: 44, left: 0, right: 0, alignItems: 'center' },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#00D4FF',
    backgroundColor: 'rgba(240,247,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#F0F7FF' },
  imagePreviewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  imagePreviewFull: { width: '100%', height: '85%' },
});
