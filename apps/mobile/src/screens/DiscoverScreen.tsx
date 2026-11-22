import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  PanResponder,
  Dimensions,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import type { BoostStatus, DiscoverCandidate, ReceivedLikeItem } from '@converse/shared';
import { mobileApi } from '../config/api';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

export function DiscoverScreen({ navigation }: any) {
  const [subTab, setSubTab] = useState<'deck' | 'likes'>('deck');
  const [candidates, setCandidates] = useState<DiscoverCandidate[]>([]);
  const [likesReceived, setLikesReceived] = useState<ReceivedLikeItem[]>([]);
  const [boost, setBoost] = useState<BoostStatus>({ active: false, expiresAt: null });
  const [photoIdx, setPhotoIdx] = useState(0);

  const [filterModal, setFilterModal] = useState(false);
  const [minAge, setMinAge] = useState('18');
  const [maxAge, setMaxAge] = useState('45');
  const [maxDist, setMaxDist] = useState('30');

  const pan = useRef(new Animated.ValueXY()).current;

  const loadAll = async () => {
    const [dRes, lRes] = await Promise.all([mobileApi.getDiscover(), mobileApi.getLikesReceived()]);
    setCandidates(dRes.candidates);
    setBoost(dRes.boost);
    setLikesReceived(lRes.likes);
  };

  useEffect(() => {
    loadAll().catch(() => {});
  }, []);

  const current = candidates[0];

  useEffect(() => {
    setPhotoIdx(0);
    pan.setValue({ x: 0, y: 0 });
  }, [current?.user.id]);

  const handleSwipe = async (targetUserId: string, action: 'like' | 'super_spark' | 'pass') => {
    const res = await mobileApi.swipe(targetUserId, action);
    setCandidates((prev) => prev.filter((c) => c.user.id !== targetUserId));
    setLikesReceived((prev) => prev.filter((l) => l.user.id !== targetUserId));
    if (res.matched && res.matchedUser) {
      Alert.alert(
        'Deu Match! ✨',
        `Você e ${res.matchedUser.displayName} se curtiram!`,
        [
          { text: 'Continuar', style: 'cancel' },
          { text: 'Ir para Conversas', onPress: () => navigation.navigate('Conversas') },
        ]
      );
    }
  };

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      if (!current) return;
      if (g.dx > SWIPE_THRESHOLD) {
        Animated.timing(pan, { toValue: { x: SCREEN_WIDTH + 100, y: g.dy }, duration: 200, useNativeDriver: false }).start(
          () => handleSwipe(current.user.id, 'like')
        );
      } else if (g.dx < -SWIPE_THRESHOLD) {
        Animated.timing(pan, { toValue: { x: -SCREEN_WIDTH - 100, y: g.dy }, duration: 200, useNativeDriver: false }).start(
          () => handleSwipe(current.user.id, 'pass')
        );
      } else {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      }
    },
  });

  const handleRewind = async () => {
    try {
      const res = await mobileApi.rewindSwipe();
      setCandidates((prev) => [res.candidate, ...prev.filter((c) => c.user.id !== res.candidate.user.id)]);
    } catch (err) {
      Alert.alert('Rewind', err instanceof Error ? err.message : 'Nenhum perfil recente para voltar.');
    }
  };

  const handleBoost = async () => {
    const res = await mobileApi.activateBoost();
    setBoost(res.boost);
    Alert.alert('Boost Ativado 🚀', 'Seu perfil está em destaque por 30 minutos!');
  };

  const rotate = pan.x.interpolate({ inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH], outputRange: ['-12deg', '0deg', '12deg'] });
  const likeOpacity = pan.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const passOpacity = pan.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View style={styles.container}>
      {/* Top Toolbar: Boost + Subtabs + Filters */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={[styles.pillBtn, boost.active && styles.pillBoostActive]}
          onPress={handleBoost}
        >
          <Text style={styles.pillBtnText}>🚀 {boost.active ? 'Boost Ativo' : 'Boost'}</Text>
        </TouchableOpacity>

        <View style={styles.subTabs}>
          <TouchableOpacity
            style={[styles.subTab, subTab === 'deck' && styles.subTabActive]}
            onPress={() => setSubTab('deck')}
          >
            <Text style={[styles.subTabText, subTab === 'deck' && { color: '#FFF' }]}>Explorar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subTab, subTab === 'likes' && styles.subTabActive]}
            onPress={() => setSubTab('likes')}
          >
            <Text style={[styles.subTabText, subTab === 'likes' && { color: '#FBBF24' }]}>
              💛 ({likesReceived.length})
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.pillBtn} onPress={() => setFilterModal(true)}>
          <Text style={styles.pillBtnText}>🎛️</Text>
        </TouchableOpacity>
      </View>

      {subTab === 'likes' ? (
        <ScrollView contentContainerStyle={{ gap: 10 }}>
          {likesReceived.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>💛</Text>
              <Text style={styles.emptyTitle}>Sem curtidas pendentes</Text>
            </View>
          ) : (
            likesReceived.map((item) => (
              <View key={item.user.id} style={styles.likeRow}>
                <Image source={{ uri: item.user.avatarUrl }} style={styles.likeAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.likeName}>
                    {item.user.displayName}, {item.user.age} {item.action === 'super_spark' ? '⚡' : ''}
                  </Text>
                  <Text style={styles.likeCity}>{item.user.city}</Text>
                </View>
                <TouchableOpacity
                  style={styles.likeBackBtn}
                  onPress={() => handleSwipe(item.user.id, 'like')}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>Curtir ❤️</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      ) : !current ? (
        <View style={styles.emptyBox}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>✨</Text>
          <Text style={styles.emptyTitle}>Você viu todos os perfis!</Text>
          <TouchableOpacity style={styles.rewindPill} onPress={handleRewind}>
            <Text style={{ color: '#FBBF24', fontWeight: '700' }}>↩️ Voltar último perfil (Rewind)</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.card, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] }]}
        >
          <View style={styles.photoWrap}>
            <Image source={{ uri: current.photos[photoIdx] || current.user.avatarUrl }} style={styles.photo} />

            {/* Photo progress bars */}
            {current.photos.length > 1 && (
              <View style={styles.photoBars}>
                {current.photos.map((_, idx) => (
                  <View key={idx} style={[styles.photoBar, idx === photoIdx && styles.photoBarActive]} />
                ))}
              </View>
            )}

            {/* Tap left/right to switch photo */}
            {current.photos.length > 1 && (
              <View style={styles.tapZones}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => setPhotoIdx((i) => Math.max(0, i - 1))} />
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => setPhotoIdx((i) => Math.min(current.photos.length - 1, i + 1))}
                />
              </View>
            )}

            <Animated.View style={[styles.stamp, styles.stampLike, { opacity: likeOpacity }]}>
              <Text style={[styles.stampText, { color: '#00D4FF' }]}>CURTI</Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.stampPass, { opacity: passOpacity }]}>
              <Text style={[styles.stampText, { color: '#F43F5E' }]}>PASSAR</Text>
            </Animated.View>

            <View style={styles.compatBadge}>
              <Text style={styles.compatText}>{current.compatibilityScore}% compatível</Text>
            </View>
          </View>

          <View style={styles.info}>
            <Text style={styles.name}>
              {current.user.displayName}, {current.user.age}
            </Text>
            <Text style={styles.city}>
              {current.user.city} • a {current.distanceKm} km
            </Text>
            <Text style={styles.bio} numberOfLines={2}>{current.user.bio}</Text>

            <View style={styles.tags}>
              {current.user.interests.slice(0, 4).map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>{t}</Text>
                </View>
              ))}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.actionBtnSmall, styles.rewindBtn]} onPress={handleRewind}>
                <Text style={styles.actionEmoji}>↩️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.passBtn]} onPress={() => handleSwipe(current.user.id, 'pass')}>
                <Text style={styles.actionEmoji}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtnSmall, styles.sparkBtn]}
                onPress={() => handleSwipe(current.user.id, 'super_spark')}
              >
                <Text style={styles.actionEmoji}>⚡</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.likeBtn]} onPress={() => handleSwipe(current.user.id, 'like')}>
                <Text style={styles.actionEmoji}>❤️</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Discovery Filters Modal */}
      <Modal visible={filterModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Preferências de Descoberta</Text>
            <Text style={styles.modalLabel}>Idade Mínima</Text>
            <TextInput style={styles.modalInput} value={minAge} onChangeText={setMinAge} keyboardType="number-pad" />
            <Text style={styles.modalLabel}>Idade Máxima</Text>
            <TextInput style={styles.modalInput} value={maxAge} onChangeText={setMaxAge} keyboardType="number-pad" />
            <Text style={styles.modalLabel}>Distância Máxima (km)</Text>
            <TextInput style={styles.modalInput} value={maxDist} onChangeText={setMaxDist} keyboardType="number-pad" />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#1E3248' }]}
                onPress={() => setFilterModal(false)}
              >
                <Text style={{ color: '#F0F7FF', fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#00D4FF' }]}
                onPress={async () => {
                  const res = await mobileApi.getDiscover({
                    minAge: Number(minAge) || 18,
                    maxAge: Number(maxAge) || 60,
                    maxDistanceKm: Number(maxDist) || 50,
                  });
                  setCandidates(res.candidates);
                  setFilterModal(false);
                }}
              >
                <Text style={{ color: '#0D1520', fontWeight: '700' }}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070B12', padding: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 },
  pillBtn: { backgroundColor: '#0D1520', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#1C2E42' },
  pillBoostActive: { borderColor: '#A855F7', backgroundColor: 'rgba(168,85,247,0.2)' },
  pillBtnText: { color: '#F0F7FF', fontSize: 12, fontWeight: '700' },
  subTabs: { flex: 1, flexDirection: 'row', backgroundColor: '#0D1520', borderRadius: 12, padding: 3, borderWidth: 1, borderColor: '#1C2E42' },
  subTab: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 9 },
  subTabActive: { backgroundColor: '#1E3248' },
  subTabText: { color: '#8BA4BE', fontSize: 12, fontWeight: '700' },
  card: {
    flex: 1,
    backgroundColor: '#0D1520',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1C2E42',
  },
  photoWrap: { flex: 1, position: 'relative' },
  photo: { width: '100%', height: '100%' },
  photoBars: { position: 'absolute', top: 10, left: 12, right: 12, flexDirection: 'row', gap: 4, zIndex: 10 },
  photoBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  photoBarActive: { backgroundColor: '#FFFFFF' },
  tapZones: { position: 'absolute', inset: 0, flexDirection: 'row', zIndex: 5 },
  stamp: { position: 'absolute', top: 40, borderWidth: 3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, zIndex: 15 },
  stampLike: { left: 20, borderColor: '#00D4FF', transform: [{ rotate: '-15deg' }] },
  stampPass: { right: 20, borderColor: '#F43F5E', transform: [{ rotate: '15deg' }] },
  stampText: { fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  compatBadge: {
    position: 'absolute',
    top: 22,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10,
  },
  compatText: { color: '#00D4FF', fontWeight: '700', fontSize: 12 },
  info: { padding: 16 },
  name: { color: '#F0F7FF', fontSize: 21, fontWeight: '800' },
  city: { color: '#8BA4BE', fontSize: 12, marginTop: 2 },
  bio: { color: '#D1D7DB', fontSize: 13, marginTop: 6, lineHeight: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { backgroundColor: '#132030', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText: { color: '#AEBAC1', fontSize: 11 },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 14 },
  actionBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  actionBtnSmall: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  rewindBtn: { backgroundColor: '#132030', borderWidth: 1, borderColor: '#F59E0B' },
  passBtn: { backgroundColor: '#132030', borderWidth: 1, borderColor: '#F43F5E' },
  sparkBtn: { backgroundColor: '#132030', borderWidth: 1, borderColor: '#38BDF8' },
  likeBtn: { backgroundColor: '#E1306C' },
  actionEmoji: { fontSize: 20, color: '#FFF' },
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyTitle: { color: '#F0F7FF', fontSize: 18, fontWeight: '700' },
  rewindPill: { backgroundColor: '#132030', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1520',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1C2E42',
    gap: 12,
  },
  likeAvatar: { width: 54, height: 54, borderRadius: 14 },
  likeName: { color: '#F0F7FF', fontWeight: '700', fontSize: 15 },
  likeCity: { color: '#8BA4BE', fontSize: 12 },
  likeBackBtn: { backgroundColor: '#E1306C', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#0D1520', borderRadius: 20, padding: 18, gap: 8 },
  modalTitle: { color: '#F0F7FF', fontSize: 17, fontWeight: '700', marginBottom: 6 },
  modalLabel: { color: '#8BA4BE', fontSize: 12 },
  modalInput: { backgroundColor: '#132030', color: '#F0F7FF', borderRadius: 12, padding: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
});
