import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { FeedPost } from '@converse/shared';
import { mobileApi } from '../config/api';

export function FeedScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Criar novo momento
  const [composeOpen, setComposeOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Câmera para foto do momento
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const loadPosts = useCallback(async () => {
    try {
      const res = await mobileApi.getPosts();
      setPosts(res.posts);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const handleLike = async (postId: string) => {
    const res = await mobileApi.toggleLike(postId);
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, likedByMe: res.liked, likesCount: res.likesCount } : p))
    );
  };

  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Permissão necessária', 'Autorize o acesso à câmera para fotografar seu Momento.');
        return;
      }
    }
    setCameraOpen(true);
  };

  const handleCapturePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      if (photo?.base64) {
        setImageUrl(`data:image/jpeg;base64,${photo.base64}`);
        setCameraOpen(false);
      } else if (photo?.uri) {
        setImageUrl(photo.uri);
        setCameraOpen(false);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível capturar a foto.');
    } finally {
      setCapturing(false);
    }
  };

  const handlePublish = async () => {
    if (!imageUrl.trim()) {
      Alert.alert('Foto obrigatória', 'Tire uma foto pela câmera para publicar seu Momento.');
      return;
    }
    if (!caption.trim()) {
      Alert.alert('Legenda obrigatória', 'Escreva uma legenda para o seu Momento.');
      return;
    }
    try {
      setPublishing(true);
      const res = await mobileApi.createPost({
        imageUrl: imageUrl.trim(),
        caption: caption.trim(),
        location: location.trim() || undefined,
      });
      setPosts((prev) => [res.post, ...prev]);
      setCaption('');
      setLocation('');
      setImageUrl('');
      setComposeOpen(false);
    } catch (err) {
      Alert.alert('Erro ao publicar', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={{ padding: 14, gap: 16, paddingBottom: 90 }}
        ListHeaderComponent={
          <TouchableOpacity style={styles.newMomentBanner} onPress={() => setComposeOpen(true)} activeOpacity={0.85}>
            <View style={styles.newMomentIcon}>
              <Text style={{ fontSize: 18 }}>📷</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.newMomentTitle}>Compartilhar um Momento</Text>
              <Text style={styles.newMomentSub}>Tire uma foto e publique no feed agora</Text>
            </View>
            <View style={styles.newMomentPill}>
              <Text style={styles.newMomentPillText}>+ Postar</Text>
            </View>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Nenhum momento publicado ainda</Text>
            <Text style={styles.emptySub}>Seja o primeiro a compartilhar uma foto com suas conexões.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.header}>
              <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} />
              <View>
                <Text style={styles.name}>{item.user.displayName}</Text>
                {item.location && <Text style={styles.loc}>{item.location}</Text>}
              </View>
            </View>
            <Image source={{ uri: item.imageUrl }} style={styles.image} />
            <View style={styles.footer}>
              <TouchableOpacity style={styles.likeRow} onPress={() => handleLike(item.id)}>
                <Text style={{ fontSize: 18 }}>{item.likedByMe ? '❤️' : '🤍'}</Text>
                <Text style={styles.likesCount}>{item.likesCount} curtidas</Text>
              </TouchableOpacity>
              <Text style={styles.caption}>
                <Text style={{ fontWeight: '700' }}>{item.user.username} </Text>
                {item.caption}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Modal Criar Momento */}
      <Modal visible={composeOpen} animationType="slide" transparent onRequestClose={() => setComposeOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo Momento</Text>
              <TouchableOpacity onPress={() => setComposeOpen(false)}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.photoBox} onPress={handleOpenCamera} activeOpacity={0.85}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.photoPreview} resizeMode="cover" />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={{ fontSize: 34, marginBottom: 6 }}>📷</Text>
                  <Text style={styles.photoHint}>Toque para tirar foto pela câmera</Text>
                </View>
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              value={caption}
              onChangeText={setCaption}
              placeholder="Escreva uma legenda para este momento..."
              placeholderTextColor="#8BA4BE"
              multiline
            />

            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Localização (opcional)"
              placeholderTextColor="#8BA4BE"
            />

            <TouchableOpacity
              style={[styles.publishBtn, publishing && { opacity: 0.7 }]}
              onPress={handlePublish}
              disabled={publishing}
            >
              {publishing ? (
                <ActivityIndicator color="#070B12" />
              ) : (
                <Text style={styles.publishBtnText}>Publicar Momento</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Câmera */}
      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <View style={styles.cameraModal}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing={cameraFacing}>
            <View style={styles.cameraTopBar}>
              <TouchableOpacity style={styles.cameraActionBtn} onPress={() => setCameraOpen(false)}>
                <Text style={styles.cameraActionText}>✕ Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cameraActionBtn}
                onPress={() => setCameraFacing((f) => (f === 'back' ? 'front' : 'back'))}
              >
                <Text style={styles.cameraActionText}>🔄 Inverter</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cameraBottomBar}>
              <TouchableOpacity
                style={styles.shutterOuter}
                onPress={handleCapturePhoto}
                disabled={capturing}
              >
                {capturing ? <ActivityIndicator color="#00D4FF" /> : <View style={styles.shutterInner} />}
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070B12' },
  newMomentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1520',
    borderRadius: 18,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.28)',
  },
  newMomentIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,212,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newMomentTitle: { color: '#F0F7FF', fontWeight: '700', fontSize: 14 },
  newMomentSub: { color: '#8BA4BE', fontSize: 11.5 },
  newMomentPill: {
    backgroundColor: '#00D4FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  newMomentPillText: { color: '#070B12', fontWeight: '800', fontSize: 12 },
  emptyBox: {
    backgroundColor: '#0D1520',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyTitle: { color: '#F0F7FF', fontWeight: '700', fontSize: 15, marginBottom: 4 },
  emptySub: { color: '#8BA4BE', fontSize: 12.5, textAlign: 'center' },
  card: {
    backgroundColor: '#0D1520',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: '#00D4FF' },
  name: { color: '#F0F7FF', fontWeight: '700', fontSize: 15 },
  loc: { color: '#8BA4BE', fontSize: 11 },
  image: { width: '100%', height: 340 },
  footer: { padding: 14 },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  likesCount: { color: '#F0F7FF', fontWeight: '700', fontSize: 13 },
  caption: { color: '#D1DFEE', fontSize: 13.5, lineHeight: 20 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: '#0D1520',
    borderRadius: 22,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1C2E42',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: '#F0F7FF', fontSize: 18, fontWeight: '800' },
  closeText: { color: '#8BA4BE', fontSize: 18, fontWeight: '700', padding: 4 },
  photoBox: {
    height: 210,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#132030',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.35)',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoHint: { color: '#8BA4BE', fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: '#132030',
    color: '#F0F7FF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#1C2E42',
  },
  publishBtn: {
    backgroundColor: '#00D4FF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  publishBtnText: { color: '#070B12', fontWeight: '800', fontSize: 15 },
  cameraModal: { flex: 1, backgroundColor: '#070B12' },
  cameraTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  cameraActionBtn: {
    backgroundColor: 'rgba(7,11,18,0.72)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
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
});
