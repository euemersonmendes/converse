import { useEffect, useState } from 'react';
import {
  Heart,
  X,
  Zap,
  MapPin,
  BadgeCheck,
  Sparkles,
  MessageCircle,
  RotateCcw,
  Rocket,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type {
  BoostStatus,
  DiscoverCandidate,
  DiscoverFilters,
  MatchResult,
  ReceivedLikeItem,
} from '@converse/shared';

interface DiscoverViewProps {
  candidates: DiscoverCandidate[];
  likesReceived: ReceivedLikeItem[];
  boost: BoostStatus;
  onSwipe: (targetUserId: string, action: 'like' | 'super_spark' | 'pass') => Promise<MatchResult>;
  onRewind: () => Promise<void>;
  onActivateBoost: () => Promise<void>;
  onApplyFilters: (filters: DiscoverFilters) => Promise<void>;
  onOpenChat: (chatId: string) => void;
}

export function DiscoverView({
  candidates,
  likesReceived,
  boost,
  onSwipe,
  onRewind,
  onActivateBoost,
  onApplyFilters,
  onOpenChat,
}: DiscoverViewProps) {
  const [subTab, setSubTab] = useState<'deck' | 'likes'>('deck');
  const [photoIdx, setPhotoIdx] = useState(0);
  const [matchModal, setMatchModal] = useState<MatchResult | null>(null);
  const [busy, setBusy] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(45);
  const [maxDistanceKm, setMaxDistanceKm] = useState(30);
  const [lookingFor, setLookingFor] = useState<DiscoverFilters['lookingFor']>('all');

  const current = candidates[0];

  useEffect(() => {
    setPhotoIdx(0);
  }, [current?.user.id]);

  const handleAction = async (targetUserId: string, action: 'like' | 'super_spark' | 'pass') => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await onSwipe(targetUserId, action);
      if (result.matched) {
        setMatchModal(result);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 bg-[#070B12] flex flex-col items-center justify-center p-6 overflow-y-auto relative">
      <div className="max-w-md w-full">
        {/* Top Header + Tinder Controls */}
        <div className="flex items-center justify-between mb-3 gap-2">
          <div>
            <h2 className="text-xl font-bold text-[#F0F7FF] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#E1306C]" />
              Conexões & Match
            </h2>
            <p className="text-xs text-[#8BA4BE]">Descubra perfis compatíveis perto de você</p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onActivateBoost}
              title="Boost de Perfil (30 min)"
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition ${
                boost.active
                  ? 'bg-purple-500/25 text-purple-300 border border-purple-400/50'
                  : 'bg-[#132030] text-[#AEBAC1] hover:text-white'
              }`}
            >
              <Rocket className="w-3.5 h-3.5" />
              {boost.active ? 'Boost Ativo' : 'Boost'}
            </button>
            <button
              onClick={() => setShowFilters((s) => !s)}
              title="Filtros de Descoberta"
              className={`p-2 rounded-xl transition ${
                showFilters ? 'bg-[#00D4FF]/20 text-[#00D4FF]' : 'bg-[#132030] text-[#AEBAC1] hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-tabs: Explorar | Quem Curtiu Você */}
        <div className="grid grid-cols-2 gap-2 bg-[#0D1520] p-1 rounded-xl border border-[#1C2E42] mb-4">
          <button
            onClick={() => setSubTab('deck')}
            className={`py-2 rounded-lg text-xs font-bold transition ${
              subTab === 'deck' ? 'bg-[#1E3248] text-white' : 'text-[#8BA4BE] hover:text-white'
            }`}
          >
            Explorar ({candidates.length})
          </button>
          <button
            onClick={() => setSubTab('likes')}
            className={`py-2 rounded-lg text-xs font-bold transition ${
              subTab === 'likes'
                ? 'bg-gradient-to-r from-amber-500/25 to-rose-500/25 text-amber-300'
                : 'text-[#8BA4BE] hover:text-white'
            }`}
          >
            💛 Curtiram Você ({likesReceived.length})
          </button>
        </div>

        {/* Discovery Filters Drawer */}
        {showFilters && (
          <div className="bg-[#0D1520] border border-[#1C2E42] rounded-2xl p-4 mb-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] text-[#8BA4BE] block mb-1">Idade Mín.</label>
                <input
                  type="number"
                  min={18}
                  max={99}
                  value={minAge}
                  onChange={(e) => setMinAge(Number(e.target.value))}
                  className="w-full bg-[#132030] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#8BA4BE] block mb-1">Idade Máx.</label>
                <input
                  type="number"
                  min={18}
                  max={99}
                  value={maxAge}
                  onChange={(e) => setMaxAge(Number(e.target.value))}
                  className="w-full bg-[#132030] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#8BA4BE] block mb-1">Dist. (km)</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={maxDistanceKm}
                  onChange={(e) => setMaxDistanceKm(Number(e.target.value))}
                  className="w-full bg-[#132030] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={lookingFor}
                onChange={(e) => setLookingFor(e.target.value as DiscoverFilters['lookingFor'])}
                className="flex-1 bg-[#132030] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
              >
                <option value="all">Todos os objetivos</option>
                <option value="relationship">Relacionamento</option>
                <option value="friendship">Amizade</option>
                <option value="networking">Networking</option>
              </select>
              <button
                onClick={async () => {
                  await onApplyFilters({ minAge, maxAge, maxDistanceKm, lookingFor });
                  setShowFilters(false);
                }}
                className="px-4 py-1.5 rounded-lg bg-[#00D4FF] text-[#0D1520] text-xs font-bold"
              >
                Aplicar
              </button>
            </div>
          </div>
        )}

        {subTab === 'likes' ? (
          <div className="space-y-3">
            {likesReceived.length === 0 ? (
              <div className="bg-[#0D1520] border border-[#1C2E42] rounded-3xl p-10 text-center">
                <div className="text-3xl mb-2">💛</div>
                <p className="text-sm text-[#8BA4BE]">Nenhuma curtida pendente no momento.</p>
              </div>
            ) : (
              likesReceived.map((item) => (
                <div
                  key={item.user.id}
                  className="bg-[#0D1520] border border-[#1C2E42] rounded-2xl p-3.5 flex items-center gap-3.5"
                >
                  <img src={item.user.avatarUrl} alt={item.user.displayName} className="w-16 h-16 rounded-2xl object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white truncate">
                        {item.user.displayName}, {item.user.age}
                      </span>
                      {item.action === 'super_spark' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                          ⚡ Super Spark
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#8BA4BE] truncate">{item.user.city}</div>
                    <div className="text-xs text-[#D1D7DB] truncate mt-0.5">{item.user.bio}</div>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => handleAction(item.user.id, 'like')}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-tr from-[#E1306C] to-[#F77737] text-white text-xs font-bold shrink-0"
                  >
                    Curtir ❤️
                  </button>
                </div>
              ))
            )}
          </div>
        ) : current ? (
          <div className="bg-[#0D1520] border border-[#1C2E42] rounded-3xl overflow-hidden shadow-2xl">
            {/* Photo Carousel */}
            <div className="relative h-96 select-none">
              <img
                src={current.photos[photoIdx] || current.user.avatarUrl}
                alt={current.user.displayName}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D1520] via-transparent to-black/40" />

              {/* Photo progress bars */}
              {current.photos.length > 1 && (
                <div className="absolute top-3 inset-x-4 flex gap-1.5 z-10">
                  {current.photos.map((_, idx) => (
                    <div key={idx} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
                      <div className={`h-full bg-white ${idx === photoIdx ? 'w-full' : 'w-0'}`} />
                    </div>
                  ))}
                </div>
              )}

              {/* Left / Right photo click zones */}
              {current.photos.length > 1 && (
                <>
                  <button
                    onClick={() => setPhotoIdx((i) => Math.max(0, i - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/70"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setPhotoIdx((i) => Math.min(current.photos.length - 1, i + 1))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/70"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              <div className="absolute top-6 right-4 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-xs font-semibold text-[#00D4FF]">
                {current.compatibilityScore}% compatível
              </div>

              {current.isBoosted && (
                <div className="absolute top-6 left-4 px-2.5 py-1 rounded-full bg-purple-600/80 text-white text-[11px] font-bold flex items-center gap-1">
                  <Rocket className="w-3 h-3" /> Destaque
                </div>
              )}

              <div className="absolute bottom-4 inset-x-5">
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-bold text-white">
                    {current.user.displayName}, {current.user.age}
                  </h3>
                  {current.user.verified && <BadgeCheck className="w-5 h-5 text-[#53BDEB]" />}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/80 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>
                    {current.user.city} • a {current.distanceKm} km
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5">
              <p className="text-sm text-[#D1D7DB] leading-relaxed mb-4">{current.user.bio}</p>

              <div className="flex flex-wrap gap-1.5 mb-6">
                {current.user.interests.map((tag) => {
                  const isShared = current.sharedInterests.includes(tag);
                  return (
                    <span
                      key={tag}
                      className={`text-xs px-2.5 py-1 rounded-full border ${
                        isShared
                          ? 'bg-[#00D4FF]/15 border-[#00D4FF]/40 text-[#00D4FF] font-medium'
                          : 'bg-[#132030] border-[#1E3248] text-[#AEBAC1]'
                      }`}
                    >
                      {tag}
                    </span>
                  );
                })}
              </div>

              {/* Tinder Action Buttons: Rewind | Pass | Super Spark | Like */}
              <div className="flex items-center justify-center gap-4">
                <button
                  disabled={busy}
                  onClick={onRewind}
                  className="w-11 h-11 rounded-full bg-[#132030] hover:bg-amber-500/20 border border-[#1E3248] text-amber-400 flex items-center justify-center transition shadow"
                  title="Voltar último perfil (Rewind)"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>

                <button
                  disabled={busy}
                  onClick={() => handleAction(current.user.id, 'pass')}
                  className="w-14 h-14 rounded-full bg-[#132030] hover:bg-rose-500/20 border border-[#1E3248] hover:border-rose-500/50 text-rose-400 flex items-center justify-center transition shadow-lg"
                  title="Pular"
                >
                  <X className="w-7 h-7" />
                </button>

                <button
                  disabled={busy}
                  onClick={() => handleAction(current.user.id, 'super_spark')}
                  className="w-12 h-12 rounded-full bg-[#132030] hover:bg-sky-500/20 border border-[#1E3248] hover:border-sky-400/50 text-sky-400 flex items-center justify-center transition shadow-lg"
                  title="Super Spark"
                >
                  <Zap className="w-5 h-5" />
                </button>

                <button
                  disabled={busy}
                  onClick={() => handleAction(current.user.id, 'like')}
                  className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#E1306C] to-[#F77737] hover:scale-105 text-white flex items-center justify-center transition shadow-xl"
                  title="Curtir"
                >
                  <Heart className="w-8 h-8 fill-white" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#0D1520] border border-[#1C2E42] rounded-3xl p-10 text-center space-y-4">
            <div className="text-4xl">✨</div>
            <h3 className="text-lg font-semibold text-white">Você viu todos os perfis por enquanto!</h3>
            <button
              onClick={onRewind}
              className="px-4 py-2 rounded-xl bg-[#132030] hover:bg-[#1E3248] text-amber-400 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" /> Voltar último perfil (Rewind)
            </button>
          </div>
        )}
      </div>

      {/* Match Celebration Modal */}
      {matchModal?.matched && matchModal.matchedUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D1520] border border-[#1E3248] rounded-3xl max-w-sm w-full p-7 text-center shadow-2xl">
            <div className="inline-flex px-3 py-1 rounded-full bg-gradient-to-r from-[#E1306C] to-[#1D4ED8] text-white text-xs font-bold mb-4">
              NOVA CONEXÃO ✨
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Deu Match!</h3>
            <p className="text-sm text-[#AEBAC1] mb-5">
              Você e <strong className="text-white">{matchModal.matchedUser.displayName}</strong> se curtiram!
            </p>
            <img
              src={matchModal.matchedUser.avatarUrl}
              alt={matchModal.matchedUser.displayName}
              className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-[#00D4FF] mb-6"
            />
            <div className="flex flex-col gap-2.5">
              {matchModal.chatId && (
                <button
                  onClick={() => {
                    const cid = matchModal.chatId!;
                    setMatchModal(null);
                    onOpenChat(cid);
                  }}
                  className="w-full py-3 rounded-xl bg-[#00D4FF] hover:bg-[#38BDF8] text-[#0D1520] font-bold flex items-center justify-center gap-2 transition"
                >
                  <MessageCircle className="w-5 h-5" />
                  Enviar Mensagem Agora
                </button>
              )}
              <button
                onClick={() => setMatchModal(null)}
                className="w-full py-2.5 rounded-xl bg-[#132030] hover:bg-[#1E3248] text-[#F0F7FF] text-sm font-medium transition"
              >
                Continuar Explorando
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
