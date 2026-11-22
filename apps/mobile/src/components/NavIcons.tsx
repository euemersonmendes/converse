import React from 'react';
import { StyleSheet, View } from 'react-native';

interface IconProps {
  color: string;
  focused?: boolean;
}

/** Ícone vetorial em geometria nativa para Conversas (balão de mensagem com linhas). */
export function ChatTabIcon({ color, focused }: IconProps) {
  return (
    <View style={styles.box}>
      <View
        style={[
          styles.chatBubble,
          {
            borderColor: color,
            backgroundColor: focused ? 'rgba(0, 212, 255, 0.16)' : 'transparent',
          },
        ]}
      >
        <View style={[styles.chatLineLong, { backgroundColor: color }]} />
        <View style={[styles.chatLineShort, { backgroundColor: color }]} />
      </View>
      <View style={[styles.chatTail, { borderTopColor: color }]} />
    </View>
  );
}

/** Ícone vetorial em geometria nativa para Conexões (dois círculos/corações interligados). */
export function ConnectTabIcon({ color, focused }: IconProps) {
  return (
    <View style={styles.box}>
      <View style={styles.connectWrap}>
        <View
          style={[
            styles.connectRingLeft,
            {
              borderColor: color,
              backgroundColor: focused ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
            },
          ]}
        />
        <View
          style={[
            styles.connectRingRight,
            {
              borderColor: color,
              backgroundColor: focused ? 'rgba(0, 212, 255, 0.28)' : 'transparent',
            },
          ]}
        />
      </View>
    </View>
  );
}

/** Ícone vetorial em geometria nativa para Momentos (moldura Stories/Feed com lente). */
export function MomentsTabIcon({ color, focused }: IconProps) {
  return (
    <View style={styles.box}>
      <View
        style={[
          styles.momentsFrame,
          {
            borderColor: color,
            backgroundColor: focused ? 'rgba(0, 212, 255, 0.16)' : 'transparent',
          },
        ]}
      >
        <View style={[styles.momentsLens, { borderColor: color }]} />
        <View style={[styles.momentsDot, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

/** Ícone vetorial em geometria nativa para Perfil (silhueta de usuário). */
export function ProfileTabIcon({ color, focused }: IconProps) {
  return (
    <View style={styles.box}>
      <View
        style={[
          styles.profileHead,
          {
            borderColor: color,
            backgroundColor: focused ? color : 'transparent',
          },
        ]}
      />
      <View
        style={[
          styles.profileBody,
          {
            borderColor: color,
            backgroundColor: focused ? 'rgba(0, 212, 255, 0.22)' : 'transparent',
          },
        ]}
      />
    </View>
  );
}

/** Ícone de câmera para o cabeçalho superior. */
export function HeaderCameraIcon({ color = '#F0F7FF' }: { color?: string }) {
  return (
    <View style={styles.headerCamWrap}>
      <View style={[styles.headerCamBump, { backgroundColor: color }]} />
      <View style={[styles.headerCamBody, { borderColor: color }]}>
        <View style={[styles.headerCamLens, { borderColor: color }]} />
      </View>
    </View>
  );
}

/** Ícone de 3 pontos verticais para o cabeçalho superior. */
export function HeaderDotsIcon({ color = '#F0F7FF' }: { color?: string }) {
  return (
    <View style={styles.dotsWrap}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

/** Ícone de sinal + para abrir menu de anexos na conversa. */
export function PlusIcon({ color = '#00D4FF' }: { color?: string }) {
  return (
    <View style={styles.box}>
      <View style={[styles.plusH, { backgroundColor: color }]} />
      <View style={[styles.plusV, { backgroundColor: color }]} />
    </View>
  );
}

/** Ícone de microfone ligado para gravação de áudio. */
export function MicIcon({ color = '#070B12' }: { color?: string }) {
  return (
    <View style={styles.box}>
      <View style={[styles.micHead, { borderColor: color, backgroundColor: color }]} />
      <View style={[styles.micArc, { borderColor: color }]} />
      <View style={[styles.micStem, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBubble: {
    width: 20,
    height: 16,
    borderRadius: 6,
    borderWidth: 2,
    paddingHorizontal: 3,
    justifyContent: 'center',
    gap: 2.5,
  },
  chatLineLong: {
    width: 10,
    height: 2,
    borderRadius: 1,
  },
  chatLineShort: {
    width: 6,
    height: 2,
    borderRadius: 1,
  },
  chatTail: {
    position: 'absolute',
    bottom: 1,
    left: 4,
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  connectWrap: {
    width: 22,
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectRingLeft: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2,
    marginRight: -4,
  },
  connectRingRight: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2,
  },
  momentsFrame: {
    width: 19,
    height: 19,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  momentsLens: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
  momentsDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
  },
  profileHead: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    marginBottom: 2,
  },
  profileBody: {
    width: 16,
    height: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderWidth: 2,
  },
  headerCamWrap: {
    width: 22,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCamBump: {
    width: 8,
    height: 2.5,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    marginBottom: -1,
  },
  headerCamBody: {
    width: 20,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCamLens: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.6,
  },
  dotsWrap: {
    width: 16,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
  },
  plusH: {
    width: 16,
    height: 2.4,
    borderRadius: 1.2,
  },
  plusV: {
    position: 'absolute',
    width: 2.4,
    height: 16,
    borderRadius: 1.2,
  },
  micHead: {
    width: 8,
    height: 12,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  micArc: {
    width: 14,
    height: 7,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    borderWidth: 2,
    borderTopWidth: 0,
    marginTop: -4,
  },
  micStem: {
    width: 2,
    height: 3.5,
    borderRadius: 1,
  },
});
