import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { DeviceSession } from '@converse/shared';
import { mobileApi } from '../config/api';
import { useAuth } from '../context/AuthContext';

export function ProfileDevicesScreen() {
  const { session, signOut } = useAuth();
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [pairingCode, setPairingCode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const loadDevices = () => {
    mobileApi.getDevices().then((res) => setDevices(res.devices)).catch(() => {});
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Permissão necessária', 'Autorize a câmera para ler o QR Code do Converse Web.');
        return;
      }
    }
    setScannerOpen(true);
  };

  const handleQrScanned = async (data: string) => {
    setScannerOpen(false);
    try {
      const parsed = JSON.parse(data);
      if (parsed.app === 'converse' && parsed.pairingId) {
        await mobileApi.approvePairing({ pairingId: parsed.pairingId });
        Alert.alert('Conectado!', 'Converse Web autorizado com sucesso.');
        loadDevices();
      } else {
        Alert.alert('QR inválido', 'Este QR Code não pertence ao Converse Web.');
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível ler o QR Code.');
    }
  };

  const handleApproveCode = async () => {
    if (!pairingCode.trim()) return;
    try {
      await mobileApi.approvePairing({ pairingCode: pairingCode.trim().toUpperCase() });
      setPairingCode('');
      Alert.alert('Conectado!', 'Converse Web autorizado com sucesso.');
      loadDevices();
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Código inválido.');
    }
  };

  const handleRevoke = async (sessionId: string) => {
    await mobileApi.revokeDevice(sessionId);
    loadDevices();
  };

  if (!session) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 18, gap: 18 }}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <Image source={{ uri: session.user.avatarUrl }} style={styles.avatar} />
        <Text style={styles.name}>{session.user.displayName}</Text>
        <Text style={styles.username}>@{session.user.username} • {session.user.city}</Text>
        <Text style={styles.bio}>{session.user.bio}</Text>
      </View>

      {/* Link WhatsApp Web Section */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Conectar Converse Web</Text>
        <Text style={styles.sectionSub}>
          Use o Converse no navegador escaneando o QR Code ou digitando o código de 8 dígitos.
        </Text>

        <TouchableOpacity style={styles.scanBtn} onPress={handleOpenScanner}>
          <Text style={styles.scanBtnText}>📷 Escanear QR Code do Web</Text>
        </TouchableOpacity>

        <View style={styles.codeRow}>
          <TextInput
            style={styles.codeInput}
            value={pairingCode}
            onChangeText={setPairingCode}
            placeholder="Código (ex: ABCD-1234)"
            placeholderTextColor="#8BA4BE"
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.codeBtn} onPress={handleApproveCode}>
            <Text style={styles.codeBtnText}>Conectar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Devices */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Aparelhos Conectados ({devices.length})</Text>
        {devices.map((d) => (
          <View key={d.id} style={styles.deviceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.deviceName}>{d.deviceName}</Text>
              <Text style={styles.deviceMeta}>
                {d.isPrimary ? 'Dispositivo Principal' : 'Sessão Web'} •{' '}
                {new Date(d.lastActiveAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            {!d.isPrimary && (
              <TouchableOpacity onPress={() => handleRevoke(d.id)}>
                <Text style={styles.revokeText}>Desconectar</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
        <Text style={styles.logoutText}>Sair da Conta</Text>
      </TouchableOpacity>

      {/* Camera QR Modal */}
      <Modal visible={scannerOpen} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => handleQrScanned(data)}
          />
          <TouchableOpacity
            style={styles.closeCamBtn}
            onPress={() => setScannerOpen(false)}
          >
            <Text style={{ color: '#FFF', fontWeight: '700' }}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070B12' },
  profileCard: {
    backgroundColor: '#0D1520',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1C2E42',
  },
  avatar: { width: 84, height: 84, borderRadius: 42, marginBottom: 10 },
  name: { color: '#F0F7FF', fontSize: 20, fontWeight: '700' },
  username: { color: '#00D4FF', fontSize: 13, marginTop: 2 },
  bio: { color: '#AEBAC1', fontSize: 13, textAlign: 'center', marginTop: 8 },
  sectionCard: {
    backgroundColor: '#0D1520',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1C2E42',
    gap: 12,
  },
  sectionTitle: { color: '#F0F7FF', fontSize: 16, fontWeight: '700' },
  sectionSub: { color: '#8BA4BE', fontSize: 12 },
  scanBtn: { backgroundColor: '#00D4FF', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  scanBtnText: { color: '#0D1520', fontWeight: '700', fontSize: 14 },
  codeRow: { flexDirection: 'row', gap: 8 },
  codeInput: {
    flex: 1,
    backgroundColor: '#132030',
    color: '#F0F7FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  codeBtn: { backgroundColor: '#1E3248', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  codeBtnText: { color: '#00D4FF', fontWeight: '700' },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#1C2E42',
  },
  deviceName: { color: '#F0F7FF', fontSize: 14, fontWeight: '600' },
  deviceMeta: { color: '#8BA4BE', fontSize: 12, marginTop: 2 },
  revokeText: { color: '#F43F5E', fontWeight: '700', fontSize: 12 },
  logoutBtn: {
    backgroundColor: '#132030',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 30,
  },
  logoutText: { color: '#F43F5E', fontWeight: '700' },
  closeCamBtn: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
  },
});
