import { useEffect, useRef, useState } from 'react';
import {
  Send,
  Mic,
  Image as ImageIcon,
  Reply,
  Check,
  CheckCheck,
  Pin,
  SmilePlus,
  X,
  Play,
  Pause,
  BadgeCheck,
  Search,
  Phone,
  Video,
  Timer,
  VolumeX,
  Volume2,
  Archive,
  Star,
  Pencil,
  Trash2,
  Forward,
  BarChart3,
  Bookmark,
} from 'lucide-react';
import { REACTION_EMOJIS, type ChatSummary, type MessageItem } from '@converse/shared';

interface ChatWindowProps {
  chat: ChatSummary | null;
  allChats: ChatSummary[];
  messages: MessageItem[];
  currentUserId: string;
  typingUserIds: string[];
  onSendMessage: (payload: {
    type?: 'text' | 'image' | 'audio' | 'video';
    content: string;
    mediaUrl?: string;
    audioDurationSec?: number;
    replyToId?: string | null;
  }) => void;
  onTyping: (isTyping: boolean) => void;
  onReact: (messageId: string, emoji: string) => void;
  onEditMessage: (messageId: string, newContent: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onToggleStar: (messageId: string) => Promise<void>;
  onPinMessage: (chatId: string, messageId: string | null) => Promise<void>;
  onForwardMessage: (messageId: string, targetChatIds: string[]) => Promise<void>;
  onCreatePoll: (chatId: string, question: string, options: string[], allowMultiple: boolean) => Promise<void>;
  onVotePoll: (messageId: string, optionId: string) => Promise<void>;
  onTogglePin: (chatId: string) => void;
  onToggleMute: (chatId: string) => void;
  onToggleArchive: (chatId: string) => void;
  onSetDisappearing: (chatId: string, ttlSec: number | null) => void;
  onStartCall: (mode: 'audio' | 'video') => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function ChatWindow({
  chat,
  allChats,
  messages,
  currentUserId,
  typingUserIds,
  onSendMessage,
  onTyping,
  onReact,
  onEditMessage,
  onDeleteMessage,
  onToggleStar,
  onPinMessage,
  onForwardMessage,
  onCreatePoll,
  onVotePoll,
  onTogglePin,
  onToggleMute,
  onToggleArchive,
  onSetDisappearing,
  onStartCall,
}: ChatWindowProps) {
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
  const [editingMsg, setEditingMsg] = useState<MessageItem | null>(null);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordStartRef = useRef<number>(0);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // In-chat search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Disappearing timer menu
  const [timerMenuOpen, setTimerMenuOpen] = useState(false);

  // Poll Modal
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollMulti, setPollMulti] = useState(false);

  // Forward Modal
  const [forwardMsg, setForwardMsg] = useState<MessageItem | null>(null);
  const [forwardTargets, setForwardTargets] = useState<string[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, chat?.id]);

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setEditingMsg(null);
    setReplyTo(null);
    setTimerMenuOpen(false);
  }, [chat?.id]);

  if (!chat) {
    return (
      <div className="flex-1 bg-[#1C2E42] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 rounded-3xl bg-[#00D4FF]/15 border border-[#00D4FF]/30 flex items-center justify-center mb-4">
          <span className="text-3xl">💬</span>
        </div>
        <h3 className="text-2xl font-light text-[#F0F7FF] mb-2">Converse Web</h3>
        <p className="text-sm text-[#8BA4BE] max-w-md">
          Selecione uma conversa ao lado ou explore novos perfis na aba <strong className="text-[#F0F7FF]">Conexões & Match</strong>.
        </p>
      </div>
    );
  }

  const isTyping = typingUserIds.length > 0;
  const visibleMessages = searchQuery.trim()
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const handleInputChange = (val: string) => {
    setText(val);
    onTyping(true);
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => onTyping(false), 1500);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (editingMsg) {
      await onEditMessage(editingMsg.id, text.trim());
      setEditingMsg(null);
      setText('');
      return;
    }
    onSendMessage({
      type: 'text',
      content: text.trim(),
      replyToId: replyTo?.id ?? null,
    });
    setText('');
    setReplyTo(null);
    onTyping(false);
  };

  const stopAudioRecording = (send: boolean) => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        if (!send) {
          audioChunksRef.current = [];
          return;
        }
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        audioChunksRef.current = [];
        const duration = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
          onSendMessage({
            type: 'audio',
            content: `🎤 Áudio (0:${duration < 10 ? '0' : ''}${duration})`,
            mediaUrl: dataUrl,
            audioDurationSec: duration,
            replyToId: replyTo?.id ?? null,
          });
          setReplyTo(null);
        };
        reader.readAsDataURL(blob);
      };
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    setRecordingAudio(false);
    setRecordingSec(0);
  };

  const handleToggleAudioRecord = async () => {
    if (recordingAudio) {
      stopAudioRecording(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      mediaRecorderRef.current = recorder;
      recordStartRef.current = Date.now();
      setRecordingSec(0);
      setRecordingAudio(true);
      recorder.start();
      recordTimerRef.current = window.setInterval(() => {
        setRecordingSec(Math.round((Date.now() - recordStartRef.current) / 1000));
      }, 500);
    } catch {
      const duration = Math.floor(Math.random() * 12) + 4;
      onSendMessage({
        type: 'audio',
        content: `🎤 Áudio (0:${duration < 10 ? '0' : ''}${duration})`,
        audioDurationSec: duration,
        replyToId: replyTo?.id ?? null,
      });
      setReplyTo(null);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>, kind: 'image' | 'video') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 14 * 1024 * 1024) {
      window.alert('Arquivo muito grande. Escolha um arquivo de até 14 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      onSendMessage({
        type: kind,
        content: kind === 'image' ? '📷 Foto' : '🎬 Vídeo',
        mediaUrl: dataUrl,
        replyToId: replyTo?.id ?? null,
      });
      setShowImagePrompt(false);
      setReplyTo(null);
    };
    reader.readAsDataURL(file);
  };

  const handleTogglePlayAudio = (msg: MessageItem) => {
    if (playingAudioId === msg.id) {
      audioElRef.current?.pause();
      setPlayingAudioId(null);
      return;
    }
    if (msg.mediaUrl) {
      audioElRef.current?.pause();
      const audio = new Audio(msg.mediaUrl);
      audioElRef.current = audio;
      audio.onended = () => setPlayingAudioId(null);
      audio.play().catch(() => {});
    }
    setPlayingAudioId(msg.id);
  };

  const handleSendImage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrlInput.trim()) return;
    onSendMessage({
      type: 'image',
      content: '📷 Foto',
      mediaUrl: imageUrlInput.trim(),
      replyToId: replyTo?.id ?? null,
    });
    setImageUrlInput('');
    setShowImagePrompt(false);
    setReplyTo(null);
  };

  const handleSubmitPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() || validOpts.length < 2) return;
    await onCreatePoll(chat.id, pollQuestion.trim(), validOpts, pollMulti);
    setPollQuestion('');
    setPollOptions(['', '']);
    setPollMulti(false);
    setPollOpen(false);
  };

  const timerLabel = (ttl: number | null) => {
    if (!ttl) return 'Desativadas';
    if (ttl === 30) return '30 seg (Demo)';
    if (ttl === 86400) return '24 horas';
    if (ttl === 604800) return '7 dias';
    return `${ttl}s`;
  };

  return (
    <div className="flex-1 flex flex-col chat-bg-pattern min-w-0 relative">
      {/* Header */}
      <header className="h-16 bg-[#0D1520]/85 backdrop-blur-xl border-b border-white/[0.07] px-5 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {chat.isSavedMessages ? (
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-white shrink-0">
              <Bookmark className="w-5 h-5 fill-white" />
            </div>
          ) : (
            <img src={chat.avatarUrl} alt={chat.title} className="w-10 h-10 rounded-full object-cover shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#F0F7FF] truncate">
                {chat.isSavedMessages ? 'Mensagens Salvas' : chat.title}
              </span>
              {chat.peerUser?.verified && <BadgeCheck className="w-4 h-4 text-[#53BDEB] shrink-0" />}
              {chat.disappearingTtlSec && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 flex items-center gap-0.5">
                  <Timer className="w-3 h-3" /> {timerLabel(chat.disappearingTtlSec)}
                </span>
              )}
            </div>
            <p className="text-xs text-[#8BA4BE] truncate">
              {chat.isSavedMessages ? (
                'Seu espaço pessoal na nuvem • Notas & Links'
              ) : isTyping ? (
                <span className="text-[#00D4FF] font-medium">digitando...</span>
              ) : chat.isGroup ? (
                'Grupo • Converse'
              ) : chat.peerUser?.isOnline ? (
                <span className="text-[#00D4FF]">online agora</span>
              ) : (
                `visto por último às ${chat.peerUser ? formatTime(chat.peerUser.lastSeenAt) : '--:--'}`
              )}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1 shrink-0 relative">
          {!chat.isGroup && !chat.isSavedMessages && (
            <>
              <button
                onClick={() => onStartCall('audio')}
                title="Chamada de Voz"
                className="p-2 rounded-lg text-[#AEBAC1] hover:bg-[#1E3248] hover:text-[#00D4FF] transition"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                onClick={() => onStartCall('video')}
                title="Chamada de Vídeo"
                className="p-2 rounded-lg text-[#AEBAC1] hover:bg-[#1E3248] hover:text-[#00D4FF] transition"
              >
                <Video className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            onClick={() => setSearchOpen((s) => !s)}
            title="Buscar nesta conversa"
            className={`p-2 rounded-lg transition ${searchOpen ? 'bg-[#00D4FF]/20 text-[#00D4FF]' : 'text-[#AEBAC1] hover:bg-[#1E3248]'}`}
          >
            <Search className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              onClick={() => setTimerMenuOpen((s) => !s)}
              title="Mensagens temporárias"
              className={`p-2 rounded-lg transition ${
                chat.disappearingTtlSec ? 'bg-amber-500/20 text-amber-300' : 'text-[#AEBAC1] hover:bg-[#1E3248]'
              }`}
            >
              <Timer className="w-4 h-4" />
            </button>
            {timerMenuOpen && (
              <div className="absolute right-0 top-10 w-48 bg-[#132030] border border-[#1E3248] rounded-xl shadow-2xl p-1.5 z-30">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-[#8BA4BE]">Mensagens temporárias</div>
                {[
                  { label: 'Desativadas', val: null },
                  { label: '30 segundos (Demo)', val: 30 },
                  { label: '24 horas', val: 86400 },
                  { label: '7 dias', val: 604800 },
                ].map((opt) => (
                  <button
                    key={String(opt.val)}
                    onClick={() => {
                      onSetDisappearing(chat.id, opt.val);
                      setTimerMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition ${
                      chat.disappearingTtlSec === opt.val
                        ? 'bg-[#00D4FF]/20 text-[#00D4FF] font-semibold'
                        : 'text-[#F0F7FF] hover:bg-[#1E3248]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => onToggleMute(chat.id)}
            title={chat.muted ? 'Ativar som' : 'Silenciar'}
            className={`p-2 rounded-lg transition ${chat.muted ? 'text-amber-400 bg-amber-500/15' : 'text-[#AEBAC1] hover:bg-[#1E3248]'}`}
          >
            {chat.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => onToggleArchive(chat.id)}
            title={chat.archived ? 'Desarquivar' : 'Arquivar'}
            className={`p-2 rounded-lg transition ${chat.archived ? 'text-[#00D4FF] bg-[#00D4FF]/15' : 'text-[#AEBAC1] hover:bg-[#1E3248]'}`}
          >
            <Archive className="w-4 h-4" />
          </button>

          <button
            onClick={() => onTogglePin(chat.id)}
            title={chat.pinned ? 'Desafixar conversa' : 'Fixar conversa'}
            className={`p-2 rounded-lg transition ${chat.pinned ? 'bg-[#00D4FF]/20 text-[#00D4FF]' : 'text-[#AEBAC1] hover:bg-[#1E3248]'}`}
          >
            <Pin className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* In-Chat Search Bar */}
      {searchOpen && (
        <div className="px-4 py-2 bg-[#101B29] border-b border-[#1C2E42] flex items-center gap-2">
          <Search className="w-4 h-4 text-[#8BA4BE]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar palavras nesta conversa..."
            className="flex-1 bg-transparent text-sm text-[#F0F7FF] outline-none"
            autoFocus
          />
          <span className="text-xs text-[#8BA4BE]">{visibleMessages.length} msg</span>
          <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="text-[#8BA4BE] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pinned Message Banner (Telegram/WhatsApp style) */}
      {chat.pinnedMessage && (
        <div className="px-4 py-2 bg-[#101B29]/95 border-b border-[#1C2E42] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Pin className="w-4 h-4 text-[#00D4FF] shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[#00D4FF]">Mensagem fixada</div>
              <div className="text-xs text-[#D1D7DB] truncate">{chat.pinnedMessage.content}</div>
            </div>
          </div>
          <button
            onClick={() => onPinMessage(chat.id, null)}
            title="Desafixar mensagem"
            className="p-1 text-[#8BA4BE] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-10 py-4 space-y-2.5">
        {visibleMessages.map((msg) => {
          const isMine = msg.senderId === currentUserId;
          const isDeleted = Boolean(msg.deletedAt);

          if (msg.type === 'match_intro') {
            return (
              <div key={msg.id} className="flex justify-center my-3">
                <span className="px-4 py-1.5 rounded-full bg-[#101B29] border border-[#1E3248] text-xs text-[#00D4FF] shadow">
                  {msg.content}
                </span>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`group flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
              <div className="relative max-w-[82%] md:max-w-[65%]">
                {/* Hover Action Bar */}
                {!isDeleted && (
                  <div
                    className={`absolute -top-8 ${
                      isMine ? 'right-0' : 'left-0'
                    } hidden group-hover:flex items-center gap-0.5 bg-[#132030] border border-[#1E3248] rounded-lg p-1 shadow-xl z-20`}
                  >
                    <button onClick={() => setReplyTo(msg)} className="p-1 hover:bg-[#1E3248] rounded text-[#AEBAC1] hover:text-white" title="Responder">
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id)}
                      className="p-1 hover:bg-[#1E3248] rounded text-[#AEBAC1] hover:text-white"
                      title="Reagir"
                    >
                      <SmilePlus className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onToggleStar(msg.id)} className="p-1 hover:bg-[#1E3248] rounded text-[#AEBAC1] hover:text-amber-400" title="Favoritar">
                      <Star className={`w-3.5 h-3.5 ${msg.isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                    <button onClick={() => onPinMessage(chat.id, msg.id)} className="p-1 hover:bg-[#1E3248] rounded text-[#AEBAC1] hover:text-[#00D4FF]" title="Fixar no topo">
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setForwardMsg(msg);
                        setForwardTargets([]);
                      }}
                      className="p-1 hover:bg-[#1E3248] rounded text-[#AEBAC1] hover:text-white"
                      title="Encaminhar"
                    >
                      <Forward className="w-3.5 h-3.5" />
                    </button>
                    {isMine && msg.type === 'text' && (
                      <button
                        onClick={() => {
                          setEditingMsg(msg);
                          setText(msg.content);
                        }}
                        className="p-1 hover:bg-[#1E3248] rounded text-[#AEBAC1] hover:text-sky-400"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isMine && (
                      <button
                        onClick={() => onDeleteMessage(msg.id)}
                        className="p-1 hover:bg-[#1E3248] rounded text-[#AEBAC1] hover:text-rose-400"
                        title="Apagar para todos"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Reaction picker */}
                {activeReactionMsgId === msg.id && (
                  <div
                    className={`absolute -top-11 ${
                      isMine ? 'right-0' : 'left-0'
                    } bg-[#132030] border border-[#1E3248] rounded-full px-2.5 py-1 flex items-center gap-1.5 shadow-xl z-30`}
                  >
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onReact(msg.id, emoji);
                          setActiveReactionMsgId(null);
                        }}
                        className="hover:scale-125 transition text-base"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {/* Bubble */}
                <div
                  className={`rounded-2xl px-4 py-2.5 shadow-md ${
                    isMine
                      ? 'converse-bubble-mine text-[#F0F7FF] rounded-tr-sm'
                      : 'converse-bubble-peer text-[#F0F7FF] rounded-tl-sm'
                  } ${isDeleted ? 'opacity-70 italic' : ''}`}
                >
                  {msg.isForwarded && !isDeleted && (
                    <div className="flex items-center gap-1 text-[11px] text-[#AEBAC1] italic mb-1">
                      <Forward className="w-3 h-3" /> Encaminhada
                    </div>
                  )}

                  {msg.replyToPreview && (
                    <div className="mb-1.5 px-2.5 py-1.5 rounded-lg bg-black/25 border-l-4 border-[#00D4FF] text-xs">
                      <div className="font-semibold text-[#00D4FF]">{msg.replyToPreview.senderName}</div>
                      <div className="text-[#D1D7DB] truncate">{msg.replyToPreview.content}</div>
                    </div>
                  )}

                  {msg.type === 'image' && msg.mediaUrl && (
                    <img src={msg.mediaUrl} alt="Mídia" className="rounded-lg max-h-64 w-full object-cover mb-1.5" />
                  )}

                  {msg.type === 'video' && msg.mediaUrl && (
                    <video
                      src={msg.mediaUrl}
                      controls
                      playsInline
                      className="rounded-lg max-h-64 w-full object-cover mb-1.5 bg-black"
                    />
                  )}

                  {/* Interactive Poll */}
                  {msg.type === 'poll' && msg.poll ? (
                    <div className="min-w-[240px] space-y-2 py-1">
                      <div className="font-semibold text-sm flex items-center gap-1.5">
                        <BarChart3 className="w-4 h-4 text-[#00D4FF]" />
                        {msg.poll.question}
                      </div>
                      <div className="space-y-1.5">
                        {(() => {
                          const totalVotes = msg.poll!.options.reduce((acc, o) => acc + o.voterIds.length, 0);
                          return msg.poll!.options.map((opt) => {
                            const votedByMe = opt.voterIds.includes(currentUserId);
                            const pct = totalVotes > 0 ? Math.round((opt.voterIds.length / totalVotes) * 100) : 0;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => onVotePoll(msg.id, opt.id)}
                                className={`w-full text-left rounded-lg p-2 border relative overflow-hidden transition ${
                                  votedByMe ? 'border-[#00D4FF] bg-black/20' : 'border-white/15 bg-black/15 hover:bg-black/25'
                                }`}
                              >
                                <div
                                  className="absolute inset-y-0 left-0 bg-[#00D4FF]/25 transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                                <div className="relative flex items-center justify-between text-xs gap-2">
                                  <span className="font-medium">{votedByMe ? '✓ ' : ''}{opt.text}</span>
                                  <span className="text-[#AEBAC1]">{opt.voterIds.length} ({pct}%)</span>
                                </div>
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  ) : msg.type === 'audio' && !isDeleted ? (
                    <div className="flex items-center gap-3 min-w-[200px] py-1">
                      <button
                        onClick={() => handleTogglePlayAudio(msg)}
                        className="w-8 h-8 rounded-full bg-[#00D4FF] text-[#0D1520] flex items-center justify-center shrink-0"
                      >
                        {playingAudioId === msg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </button>
                      <div className="flex-1 flex items-center gap-0.5 h-6">
                        {[4, 8, 12, 6, 14, 10, 16, 7, 11, 5, 13, 9, 6, 10, 4].map((h, i) => (
                          <span
                            key={i}
                            style={{ height: `${h + 4}px` }}
                            className={`w-1 rounded-full ${
                              playingAudioId === msg.id ? 'bg-[#00D4FF] animate-pulse' : 'bg-[#8BA4BE]/60'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-[#AEBAC1]">
                        0:{(msg.audioDurationSec ?? 12).toString().padStart(2, '0')}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                  )}

                  {/* Footer timestamp + edited + starred + receipts */}
                  <div className="flex items-center justify-end gap-1.5 mt-1">
                    {msg.isStarred && <Star className="w-3 h-3 fill-amber-400 text-amber-400" />}
                    {msg.editedAt && !isDeleted && <span className="text-[10px] text-[#AEBAC1]/80 italic">editada</span>}
                    <span className="text-[10px] text-[#AEBAC1]/80">{formatTime(msg.createdAt)}</span>
                    {isMine &&
                      !isDeleted &&
                      (msg.status === 'read' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
                      ) : msg.status === 'delivered' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-[#AEBAC1]/80" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-[#AEBAC1]/80" />
                      ))}
                  </div>
                </div>

                {msg.reactions.length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                    {msg.reactions.map((r) => (
                      <button
                        key={`${r.userId}-${r.emoji}`}
                        onClick={() => onReact(msg.id, r.emoji)}
                        title={r.userDisplayName}
                        className="px-1.5 py-0.5 rounded-full bg-[#132030] border border-[#1E3248] text-xs shadow"
                      >
                        {r.emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Image URL quick bar */}
      {showImagePrompt && (
        <form onSubmit={handleSendImage} className="px-4 py-2.5 bg-[#101B29] border-t border-[#1C2E42] flex items-center gap-2">
          <input
            type="url"
            value={imageUrlInput}
            onChange={(e) => setImageUrlInput(e.target.value)}
            placeholder="Cole a URL da imagem (ex: https://images.unsplash.com/...)"
            className="flex-1 bg-[#1E3248] rounded-lg px-3 py-1.5 text-sm text-[#F0F7FF] outline-none"
            autoFocus
          />
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#00D4FF] text-[#0D1520] text-xs font-bold">
            Enviar foto
          </button>
          <button type="button" onClick={() => setShowImagePrompt(false)} className="p-1.5 text-[#8BA4BE] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Reply or Edit Bar */}
      {(replyTo || editingMsg) && (
        <div className="px-4 py-2 bg-[#101B29] border-t border-[#1C2E42] flex items-center justify-between">
          <div className={`border-l-4 ${editingMsg ? 'border-sky-400' : 'border-[#00D4FF]'} pl-3 min-w-0`}>
            <div className={`text-xs font-semibold ${editingMsg ? 'text-sky-400' : 'text-[#00D4FF]'}`}>
              {editingMsg ? 'Editando mensagem' : 'Respondendo'}
            </div>
            <div className="text-xs text-[#AEBAC1] truncate">{editingMsg ? editingMsg.content : replyTo?.content}</div>
          </div>
          <button
            onClick={() => {
              setReplyTo(null);
              if (editingMsg) {
                setEditingMsg(null);
                setText('');
              }
            }}
            className="p-1 text-[#8BA4BE] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Composer */}
      <form onSubmit={handleSend} className="px-4 py-3 bg-[#0D1520]/90 backdrop-blur-xl border-t border-white/[0.07] flex items-center gap-2 shrink-0">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelected(e, 'image')}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => handleFileSelected(e, 'video')}
        />

        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowImagePrompt((s) => !s);
          }}
          title="Enviar Imagem"
          className="p-2.5 rounded-xl text-[#8BA4BE] hover:text-[#00D4FF] hover:bg-[#132030] transition"
        >
          <ImageIcon className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => videoInputRef.current?.click()}
          title="Enviar Vídeo"
          className="p-2.5 rounded-xl text-[#8BA4BE] hover:text-[#00D4FF] hover:bg-[#132030] transition"
        >
          <Video className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setPollOpen(true)}
          title="Criar Enquete"
          className="p-2.5 rounded-xl text-[#8BA4BE] hover:text-[#00D4FF] hover:bg-[#132030] transition"
        >
          <BarChart3 className="w-5 h-5" />
        </button>

        {recordingAudio ? (
          <div className="flex-1 flex items-center justify-between bg-rose-500/15 border border-rose-500/40 rounded-2xl px-4 py-2 text-sm text-rose-300">
            <span className="flex items-center gap-2 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              Gravando áudio... 0:{recordingSec < 10 ? '0' : ''}{recordingSec}
            </span>
            <button
              type="button"
              onClick={() => stopAudioRecording(false)}
              className="text-xs text-[#8BA4BE] hover:text-white"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <input
            type="text"
            value={text}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={editingMsg ? 'Edite sua mensagem...' : 'Digite uma mensagem...'}
            className="flex-1 bg-[#132030] border border-white/[0.07] focus:border-[#00D4FF]/50 rounded-2xl px-4 py-2.5 text-sm text-[#F0F7FF] placeholder-[#8BA4BE] outline-none transition"
          />
        )}

        {text.trim() ? (
          <button
            type="submit"
            className="w-10 h-10 rounded-2xl converse-btn-gradient text-[#070B12] flex items-center justify-center transition shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleToggleAudioRecord}
            title={recordingAudio ? 'Parar e enviar áudio' : 'Gravar mensagem de voz'}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition shrink-0 ${
              recordingAudio
                ? 'bg-rose-500 text-white shadow-[0_0_16px_rgba(244,63,94,0.5)]'
                : 'bg-[#132030] border border-white/[0.07] hover:border-[#00D4FF]/50 text-[#8BA4BE] hover:text-[#00D4FF]'
            }`}
          >
            {recordingAudio ? <Send className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        )}
      </form>

      {/* Poll Modal */}
      {pollOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form onSubmit={handleSubmitPoll} className="bg-[#0D1520] border border-[#1E3248] rounded-2xl max-w-md w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#00D4FF]" /> Criar Enquete
              </h3>
              <button type="button" onClick={() => setPollOpen(false)} className="text-[#8BA4BE] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              required
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Pergunta da enquete..."
              className="w-full bg-[#132030] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
            />
            <div className="space-y-2">
              {pollOptions.map((opt, idx) => (
                <input
                  key={idx}
                  type="text"
                  required={idx < 2}
                  value={opt}
                  onChange={(e) => setPollOptions((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))}
                  placeholder={`Opção ${idx + 1}`}
                  className="w-full bg-[#132030] rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                />
              ))}
              {pollOptions.length < 5 && (
                <button
                  type="button"
                  onClick={() => setPollOptions((prev) => [...prev, ''])}
                  className="text-xs text-[#00D4FF] font-semibold"
                >
                  + Adicionar opção
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs text-[#AEBAC1]">
              <input type="checkbox" checked={pollMulti} onChange={(e) => setPollMulti(e.target.checked)} />
              Permitir múltiplas respostas
            </label>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-[#00D4FF] text-[#0D1520] font-bold text-sm">
              Enviar Enquete
            </button>
          </form>
        </div>
      )}

      {/* Forward Modal */}
      {forwardMsg && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#0D1520] border border-[#1E3248] rounded-2xl max-w-md w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Forward className="w-5 h-5 text-[#00D4FF]" /> Encaminhar Mensagem
              </h3>
              <button onClick={() => setForwardMsg(null)} className="text-[#8BA4BE] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {allChats.map((c) => {
                const checked = forwardTargets.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() =>
                      setForwardTargets((prev) => (checked ? prev.filter((id) => id !== c.id) : [...prev, c.id]))
                    }
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition ${
                      checked ? 'border-[#00D4FF] bg-[#00D4FF]/15' : 'border-[#1C2E42] bg-[#132030]'
                    }`}
                  >
                    <span className="text-sm font-medium text-white flex-1 truncate">
                      {c.isSavedMessages ? 'Mensagens Salvas' : c.title}
                    </span>
                    {checked && <Check className="w-4 h-4 text-[#00D4FF]" />}
                  </button>
                );
              })}
            </div>
            <button
              disabled={forwardTargets.length === 0}
              onClick={async () => {
                await onForwardMessage(forwardMsg.id, forwardTargets);
                setForwardMsg(null);
              }}
              className="w-full py-2.5 rounded-xl bg-[#00D4FF] disabled:opacity-40 text-[#0D1520] font-bold text-sm"
            >
              Encaminhar ({forwardTargets.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
