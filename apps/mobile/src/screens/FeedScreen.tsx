import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet } from 'react-native';
import type { FeedPost } from '@converse/shared';
import { mobileApi } from '../config/api';

export function FeedScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([]);

  useEffect(() => {
    mobileApi.getPosts().then((res) => setPosts(res.posts)).catch(() => {});
  }, []);

  const handleLike = async (postId: string) => {
    const res = await mobileApi.toggleLike(postId);
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, likedByMe: res.liked, likesCount: res.likesCount } : p))
    );
  };

  return (
    <FlatList
      style={styles.container}
      data={posts}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 14, gap: 16 }}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070B12' },
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
});
