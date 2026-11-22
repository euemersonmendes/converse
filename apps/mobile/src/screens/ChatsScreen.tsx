import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SOCKET_EVENTS, type ChatSummary, type MessageItem, type StoryGroup, type UserProfile } from '@converse/shared';
import { mobileApi } from '../config/api';
import { useAuth } from '../context/AuthContext';

type MobileChatFilter = 'all' | 'following' | 'unread' | 'groups' | 'archived';

export function ChatsScreen({ navigation }: any) {
  const { session, socket } = useAuth();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [people, setPeople] = useState<Array<UserProfile & { isFollowing: boolean }>>([]);
  const [filter, setFilter] = useState<MobileChatFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [chatsRes, storiesRes, peopleRes] = await Promise.all([
      mobileApi.listChats(),
      mobileApi.getStories(),
      mobileApi.getPeople(),
    ]);
    setChats(chatsRes.chats);
    setStories(storiesRes.groups);
    setPeople(peopleRes.people);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load])
  );

  useEffect(() => {
    if (!socket) return;
    const onNewMsg = (msg: MessageItem) => {
      setChats((prev) =>
        prev
          .map((c) => (c.id === msg.chatId ? { ...c, lastMessage: msg, updatedAt: msg.createdAt } : c))
          .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
      );
    };
    socket.on(SOCKET_EVENTS.MESSAGE_NEW, onNewMsg);
    return () => {
      socket.off(SOCKET_EVENTS.MESSAGE_NEW, onNewMsg);
    };
  }, [socket]);

  const handleStartDirectChat = async (person: UserProfile) => {
    const res = await mobileApi.createDirectChat(person.id);
    const chatsRes = await mobileApi.listChats();
    setChats(chatsRes.chats);
    const chatObj: ChatSummary = res.chat || {
      id: res.chatId,
      isGroup: false,
      title: person.displayName,
      avatarUrl: person.avatarUrl,
      peerUser: person,
      lastMessage: null,
      unreadCount: 0,
      pinned: false,
      muted: false,
      archived: false,
      disappearingTtlSec: null,
      updatedAt: new Date().toISOString(),
    };
    setFilter('all');
    navigation.navigate('ChatDetail', { chat: chatObj });
  };

  const handleToggleFollow = async (userId: string) => {
    const res = await mobileApi.toggleFollow(userId);
    setPeople((prev) => prev.map((p) => (p.id === userId ? { ...p, isFollowing: res.following } : p)));
  };

  const filteredChats = chats.filter((c) => {
    if (filter === 'archived' && !c.archived) return false;
    if (filter !== 'archived' && c.archived) return false;
    if (filter === 'unread' && c.unreadCount === 0) return false;
    if (filter === 'groups' && !c.isGroup) return false;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return c.title.toLowerCase().includes(q) || Boolean(c.lastMessage?.content.toLowerCase().includes(q));
    }
    return true;
  });

  const filteredPeople = people.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q);
  });

  return (
    <View style={styles.container}>
      {/* WhatsApp-style Search Bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Pesquisar conversas ou pessoas..."
            placeholderTextColor="#8BA4BE"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={{ color: '#8BA4BE', fontWeight: '700', paddingHorizontal: 4 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {/* Stories Bar */}
      <View style={styles.storiesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 14 }}>
          {stories.map((g) => (
            <View key={g.user.id} style={styles.storyItem}>
              <View style={[styles.storyRing, g.hasUnseen ? styles.storyRingActive : styles.storyRingSeen]}>
                <Image source={{ uri: g.user.avatarUrl }} style={styles.storyAvatar} />
              </View>
              <Text style={styles.storyName} numberOfLines={1}>
                {g.user.id === session?.user.id ? 'Seu story' : g.user.displayName.split(' ')[0]}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {[
          { key: 'all', label: 'Todas' },
          { key: 'following', label: '👥 Seguindo' },
          { key: 'unread', label: 'Não lidas' },
          { key: 'groups', label: 'Grupos' },
          { key: 'archived', label: 'Arquivadas' },
        ].map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key as MobileChatFilter)}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Following People Directory OR Saved Chats List */}
      {filter === 'following' ? (
        <FlatList
          data={filteredPeople}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor="#00D4FF"
            />
          }
          renderItem={({ item }) => (
            <View style={styles.chatRow}>
              <View>
                <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                {item.isOnline && <View style={styles.onlineDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatTitle} numberOfLines={1}>
                  {item.displayName}
                </Text>
                <Text style={styles.lastMsg} numberOfLines={1}>
                  @{item.username} • {item.city}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.followBtn, item.isFollowing && styles.followBtnActive]}
                onPress={() => handleToggleFollow(item.id)}
              >
                <Text style={[styles.followBtnText, item.isFollowing && { color: '#8BA4BE' }]}>
                  {item.isFollowing ? 'Seguindo' : 'Seguir'}
                </Text>
              </TouchableOpacity>
              {item.isFollowing && (
                <TouchableOpacity style={styles.chatStartBtn} onPress={() => handleStartDirectChat(item)}>
                  <Text style={styles.chatStartText}>Conversar</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 6 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor="#00D4FF"
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chatRow}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('ChatDetail', { chat: item })}
            >
              <View>
                {item.isSavedMessages ? (
                  <View style={styles.savedAvatar}>
                    <Text style={{ fontSize: 22 }}>🔖</Text>
                  </View>
                ) : (
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                )}
                {!item.isSavedMessages && item.peerUser?.isOnline && <View style={styles.onlineDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text style={styles.chatTitle} numberOfLines={1}>
                    {item.isSavedMessages ? 'Mensagens Salvas' : item.title}
                  </Text>
                  <Text style={[styles.time, item.unreadCount > 0 && { color: '#00D4FF', fontWeight: '700' }]}>
                    {item.lastMessage
                      ? new Date(item.lastMessage.createdAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text style={styles.lastMsg} numberOfLines={1}>
                    {item.lastMessage?.content || (item.isSavedMessages ? 'Seu bloco de notas na nuvem' : 'Nova conversa')}
                  </Text>
                  <View style={styles.badges}>
                    {item.pinned && <Text style={{ fontSize: 11 }}>📌</Text>}
                    {item.muted && <Text style={{ fontSize: 11 }}>🔇</Text>}
                    {item.unreadCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070B12' },
  searchWrap: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, backgroundColor: '#070B12' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#132030',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: '#F0F7FF', fontSize: 14, padding: 0 },
  storiesContainer: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0B121D',
  },
  storyItem: { alignItems: 'center', width: 66 },
  storyRing: { padding: 2.5, borderRadius: 34 },
  storyRingActive: { borderWidth: 2.5, borderColor: '#00D4FF' },
  storyRingSeen: { borderWidth: 1.5, borderColor: '#1E3248' },
  storyAvatar: { width: 56, height: 56, borderRadius: 28 },
  storyName: { color: '#D1DFEE', fontSize: 11, fontWeight: '500', marginTop: 5 },
  filterScroll: {
    maxHeight: 54,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#0D1520',
    borderWidth: 1,
    borderColor: '#1C2E42',
  },
  filterPillActive: {
    backgroundColor: 'rgba(0,212,255,0.14)',
    borderColor: '#00D4FF',
  },
  filterText: { color: '#8BA4BE', fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#00D4FF' },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 3,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(13,21,32,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    gap: 12,
  },
  savedAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0E4F7A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.4)',
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#00D4FF',
    borderWidth: 2.5,
    borderColor: '#070B12',
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatTitle: { color: '#F0F7FF', fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  time: { color: '#8BA4BE', fontSize: 11 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  lastMsg: { color: '#8BA4BE', fontSize: 13, flex: 1, marginRight: 8 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: {
    backgroundColor: '#00D4FF',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#070B12', fontSize: 11, fontWeight: '800' },
  followBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(0,212,255,0.14)',
  },
  followBtnActive: {
    backgroundColor: '#132030',
  },
  followBtnText: { color: '#00D4FF', fontSize: 11, fontWeight: '700' },
  chatStartBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#00D4FF',
  },
  chatStartText: { color: '#070B12', fontSize: 12, fontWeight: '800' },
});
