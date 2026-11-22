import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  ChatTabIcon,
  ConnectTabIcon,
  HeaderCameraIcon,
  HeaderDotsIcon,
  MomentsTabIcon,
  ProfileTabIcon,
} from '../components/NavIcons';
import { useAuth } from '../context/AuthContext';
import { AuthScreen } from '../screens/AuthScreen';
import { ChatsScreen } from '../screens/ChatsScreen';
import { ChatDetailScreen } from '../screens/ChatDetailScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { FeedScreen } from '../screens/FeedScreen';
import { ProfileDevicesScreen } from '../screens/ProfileDevicesScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const color = focused ? '#00D4FF' : '#9DB7D0';
  return (
    <View style={[styles.tabPill, focused && styles.tabPillActive]}>
      {name === 'Conversas' ? (
        <ChatTabIcon color={color} focused={focused} />
      ) : name === 'Conexões' ? (
        <ConnectTabIcon color={color} focused={focused} />
      ) : name === 'Momentos' ? (
        <MomentsTabIcon color={color} focused={focused} />
      ) : (
        <ProfileTabIcon color={color} focused={focused} />
      )}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerStyle: {
          backgroundColor: '#070B12',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        },
        headerTitleAlign: 'left',
        headerTintColor: '#F0F7FF',
        headerTitleStyle: { fontWeight: '800', fontSize: 22, letterSpacing: -0.3 },
        headerTitle: () =>
          route.name === 'Conversas' ? (
            <View style={styles.brandHeader}>
              <Image
                source={require('../../assets/logo-horizontal.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
            </View>
          ) : (
            <Text style={styles.screenHeaderTitle}>{route.name}</Text>
          ),
        headerRight: () => (
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Perfil')}
              style={styles.headerIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <HeaderCameraIcon color="#F0F7FF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Perfil')}
              style={styles.headerIconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <HeaderDotsIcon color="#F0F7FF" />
            </TouchableOpacity>
          </View>
        ),
        tabBarStyle: {
          backgroundColor: '#0B121D',
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(255,255,255,0.08)',
          height: 84,
          paddingTop: 8,
          paddingBottom: 20,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 4,
        },
        tabBarActiveTintColor: '#00D4FF',
        tabBarInactiveTintColor: '#9DB7D0',
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Conversas" component={ChatsScreen} />
      <Tab.Screen name="Conexões" component={DiscoverScreen} />
      <Tab.Screen name="Momentos" component={FeedScreen} />
      <Tab.Screen name="Perfil" component={ProfileDevicesScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { session, loading } = useAuth();

  if (loading) return null;

  return (
    <NavigationContainer
      theme={{
        ...DarkTheme,
        colors: { ...DarkTheme.colors, background: '#070B12', card: '#0B121D', text: '#F0F7FF' },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0B121D' },
          headerTintColor: '#F0F7FF',
        }}
      >
        {!session ? (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen
              name="ChatDetail"
              component={ChatDetailScreen}
              options={({ route }: any) => {
                const chat = route.params?.chat;
                const title = chat?.isSavedMessages ? 'Mensagens Salvas' : chat?.title || 'Conversa';
                const subtitle = chat?.isSavedMessages
                  ? 'Notas na nuvem'
                  : chat?.peerUser?.isOnline
                    ? 'online'
                    : 'toque para ver';
                return {
                  headerTitle: () => (
                    <View style={styles.chatHeader}>
                      {chat?.avatarUrl && !chat?.isSavedMessages ? (
                        <Image source={{ uri: chat.avatarUrl }} style={styles.chatHeaderAvatar} />
                      ) : (
                        <View style={styles.chatHeaderSaved}>
                          <Text style={{ fontSize: 14 }}>🔖</Text>
                        </View>
                      )}
                      <View>
                        <Text style={styles.chatHeaderName} numberOfLines={1}>
                          {title}
                        </Text>
                        <Text
                          style={[
                            styles.chatHeaderSub,
                            chat?.peerUser?.isOnline && { color: '#00D4FF' },
                          ]}
                        >
                          {subtitle}
                        </Text>
                      </View>
                    </View>
                  ),
                };
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  brandHeader: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: { width: 142, height: 42 },
  screenHeaderTitle: { color: '#F0F7FF', fontSize: 21, fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 14 },
  headerIconBtn: { padding: 4 },
  headerIconText: { color: '#F0F7FF', fontSize: 17 },
  tabPill: {
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabPillActive: {
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderColor: 'rgba(0, 212, 255, 0.45)',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
  },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatHeaderAvatar: { width: 34, height: 34, borderRadius: 17 },
  chatHeaderSaved: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0E4F7A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderName: { color: '#F0F7FF', fontSize: 16, fontWeight: '700', maxWidth: 200 },
  chatHeaderSub: { color: '#8BA4BE', fontSize: 11 },
});
