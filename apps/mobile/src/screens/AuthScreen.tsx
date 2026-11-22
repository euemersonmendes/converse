import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { API_URL, mobileApi, setApiUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';

export function AuthScreen() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Forgot password fields
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetMaskedPhone, setResetMaskedPhone] = useState<string | null>(null);
  const [devResetHint, setDevResetHint] = useState<string | null>(null);

  // Register fields
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [regPassword, setRegPassword] = useState('');

  const [serverUrl, setServerUrl] = useState(API_URL);
  const [connError, setConnError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert('Campos obrigatórios', 'Informe seu usuário/telefone e sua senha.');
      return;
    }
    try {
      setApiUrl(serverUrl);
      setConnError(null);
      setLoading(true);
      const session = await mobileApi.login(identifier.trim(), password);
      await signIn(session);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao entrar';
      if (msg.toLowerCase().includes('network')) setConnError(msg);
      Alert.alert('Erro ao entrar', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const cleanName = displayName.trim();
    const cleanUsername = username.trim().replace(/^@/, '').replace(/\s+/g, '.').toLowerCase();
    const cleanPhone = phone.trim();

    if (cleanName.length < 2) {
      Alert.alert('Nome inválido', 'Informe seu nome completo (mínimo 2 caracteres).');
      return;
    }
    if (cleanUsername.length < 3) {
      Alert.alert('Usuário inválido', 'O nome de usuário deve ter pelo menos 3 caracteres.');
      return;
    }
    if (cleanPhone.length < 6) {
      Alert.alert('Telefone inválido', 'Informe um telefone válido (mínimo 6 dígitos).');
      return;
    }
    if (regPassword.length < 4) {
      Alert.alert('Senha curta', 'A senha deve ter no mínimo 4 caracteres.');
      return;
    }

    try {
      setApiUrl(serverUrl);
      setLoading(true);
      const parsedAge = Number.parseInt(age, 10);
      const session = await mobileApi.register({
        displayName: cleanName,
        username: cleanUsername,
        phone: cleanPhone,
        password: regPassword,
        city: city.trim() || 'São Paulo, SP',
        age: Number.isFinite(parsedAge) && parsedAge >= 18 ? parsedAge : 25,
        bio: bio.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      });
      await signIn(session);
    } catch (err) {
      Alert.alert('Erro no cadastro', err instanceof Error ? err.message : 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Permissão necessária', 'Autorize o acesso à câmera para tirar sua foto de perfil.');
        return;
      }
    }
    setCameraOpen(true);
  };

  const handleCapturePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.45,
      });
      if (photo?.base64) {
        setAvatarUrl(`data:image/jpeg;base64,${photo.base64}`);
        setCameraOpen(false);
      } else if (photo?.uri) {
        setAvatarUrl(photo.uri);
        setCameraOpen(false);
      }
    } catch {
      Alert.alert('Erro na câmera', 'Não foi possível capturar a foto. Tente novamente.');
    } finally {
      setCapturing(false);
    }
  };

  const handleRequestReset = async () => {
    if (!resetIdentifier.trim()) {
      Alert.alert('Informe sua conta', 'Digite seu usuário ou telefone cadastrado.');
      return;
    }
    try {
      setApiUrl(serverUrl);
      setLoading(true);
      const res = await mobileApi.forgotPassword(resetIdentifier.trim());
      setResetMaskedPhone(res.maskedPhone ?? null);
      setDevResetHint(res.devCode ? `Modo Dev (SMS não configurado): código ${res.devCode}` : null);
      if (res.devCode) setResetCode(res.devCode);
      setResetStep(2);
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível enviar o código.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    if (resetCode.trim().length !== 6 || resetNewPass.length < 4) {
      Alert.alert('Dados inválidos', 'Informe o código de 6 dígitos e a nova senha (mín. 4 caracteres).');
      return;
    }
    try {
      setApiUrl(serverUrl);
      setLoading(true);
      await mobileApi.resetPassword({
        identifier: resetIdentifier.trim(),
        code: resetCode.trim(),
        newPassword: resetNewPass,
      });
      Alert.alert('Senha redefinida!', 'Agora você já pode entrar com sua nova senha.');
      setIdentifier(resetIdentifier.trim());
      setPassword(resetNewPass);
      setResetStep(1);
      setResetCode('');
      setResetNewPass('');
      setDevResetHint(null);
      setMode('login');
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Código inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.logoWrap}>
        <Image source={require('../../assets/logo-horizontal.png')} style={styles.logoImage} resizeMode="contain" />
      </View>
      <Text style={styles.subtitle}>Mensagens, Stories & Conexões Reais</Text>

      {/* Mode Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, mode === 'login' && styles.tabBtnActive]}
          onPress={() => setMode('login')}
        >
          <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Entrar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, mode === 'register' && styles.tabBtnActive]}
          onPress={() => setMode('register')}
        >
          <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>Criar Conta</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {connError && (
          <View style={styles.errBox}>
            <Text style={styles.errText}>Não conectou em {serverUrl} ({connError})</Text>
            <TextInput
              style={[styles.input, { marginTop: 8, marginBottom: 8 }]}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://192.168.x.x:3001"
              placeholderTextColor="#8BA4BE"
              autoCapitalize="none"
            />
            <TouchableOpacity style={{ marginTop: 4 }} onPress={() => setConnError(null)}>
              <Text style={{ color: '#00D4FF', fontWeight: '700', fontSize: 12 }}>Salvar servidor</Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === 'login' ? (
          <>
            <Text style={styles.label}>Usuário ou Telefone</Text>
            <TextInput
              style={styles.input}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="lucas.mendes"
              placeholderTextColor="#8BA4BE"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••"
              placeholderTextColor="#8BA4BE"
              secureTextEntry
            />

            <TouchableOpacity style={styles.primaryBtn} onPress={() => handleLogin()} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#0D1520" />
              ) : (
                <Text style={styles.primaryBtnText}>Entrar no Converse</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotLink}
              onPress={() => {
                setResetIdentifier(identifier);
                setResetStep(1);
                setDevResetHint(null);
                setMode('forgot');
              }}
            >
              <Text style={styles.forgotLinkText}>Esqueci minha senha</Text>
            </TouchableOpacity>
          </>
        ) : mode === 'forgot' ? (
          <>
            <Text style={styles.forgotTitle}>Recuperar Senha</Text>
            {resetStep === 1 ? (
              <>
                <Text style={styles.label}>Usuário ou Telefone cadastrado</Text>
                <TextInput
                  style={styles.input}
                  value={resetIdentifier}
                  onChangeText={setResetIdentifier}
                  placeholder="lucas.mendes ou +5511..."
                  placeholderTextColor="#8BA4BE"
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.primaryBtn} onPress={handleRequestReset} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#0D1520" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Enviar Código de 6 Dígitos</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {resetMaskedPhone && (
                  <View style={styles.hintBox}>
                    <Text style={styles.hintText}>
                      Enviamos um código de 6 dígitos por SMS para o número cadastrado ({resetMaskedPhone}).
                    </Text>
                  </View>
                )}
                {devResetHint && (
                  <View style={styles.hintBox}>
                    <Text style={styles.hintText}>{devResetHint}</Text>
                  </View>
                )}
                <Text style={styles.label}>Código de 6 Dígitos</Text>
                <TextInput
                  style={styles.input}
                  value={resetCode}
                  onChangeText={setResetCode}
                  placeholder="000000"
                  placeholderTextColor="#8BA4BE"
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <Text style={styles.label}>Nova Senha</Text>
                <TextInput
                  style={styles.input}
                  value={resetNewPass}
                  onChangeText={setResetNewPass}
                  placeholder="Mínimo 4 caracteres"
                  placeholderTextColor="#8BA4BE"
                  secureTextEntry
                />
                <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirmReset} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#0D1520" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Redefinir Senha</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.forgotLink} onPress={handleRequestReset} disabled={loading}>
                  <Text style={styles.forgotLinkText}>Reenviar código por SMS</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={styles.forgotLink} onPress={() => setMode('login')}>
              <Text style={styles.forgotLinkText}>Voltar para o Login</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.avatarPickerWrap}>
              <TouchableOpacity style={styles.avatarTouch} onPress={handleOpenCamera} activeOpacity={0.85}>
                {avatarUrl.trim() ? (
                  <Image source={{ uri: avatarUrl.trim() }} style={styles.avatarPreview} />
                ) : (
                  <View style={[styles.avatarPreview, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 28 }}>📷</Text>
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  <Text style={styles.cameraBadgeText}>📷</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.avatarHint}>
                {avatarUrl ? 'Toque na câmera para trocar a foto' : 'Toque na câmera para enviar sua foto'}
              </Text>
            </View>

            <Text style={styles.label}>Nome Completo *</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Ex: Ana Clara Silva"
              placeholderTextColor="#8BA4BE"
            />

            <Text style={styles.label}>Nome de Usuário *</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Ex: ana.silva"
              placeholderTextColor="#8BA4BE"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Telefone / WhatsApp *</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+5511999998888"
              placeholderTextColor="#8BA4BE"
              keyboardType="phone-pad"
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 2 }}>
                <Text style={styles.label}>Cidade</Text>
                <TextInput
                  style={styles.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="São Paulo, SP"
                  placeholderTextColor="#8BA4BE"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Idade</Text>
                <TextInput
                  style={styles.input}
                  value={age}
                  onChangeText={setAge}
                  placeholder="25"
                  placeholderTextColor="#8BA4BE"
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <Text style={styles.label}>Bio (opcional)</Text>
            <TextInput
              style={styles.input}
              value={bio}
              onChangeText={setBio}
              placeholder="Conte um pouco sobre você..."
              placeholderTextColor="#8BA4BE"
            />

            <Text style={styles.label}>Senha *</Text>
            <TextInput
              style={styles.input}
              value={regPassword}
              onChangeText={setRegPassword}
              placeholder="Mínimo 4 caracteres"
              placeholderTextColor="#8BA4BE"
              secureTextEntry
            />

            <TouchableOpacity style={styles.primaryBtn} onPress={handleRegister} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#0D1520" />
              ) : (
                <Text style={styles.primaryBtnText}>Cadastrar e Entrar</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <View style={styles.cameraModal}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing={cameraFacing}>
            <View style={styles.cameraTopBar}>
              <TouchableOpacity style={styles.cameraActionBtn} onPress={() => setCameraOpen(false)}>
                <Text style={styles.cameraActionText}>✕ Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cameraActionBtn}
                onPress={() => setCameraFacing((prev) => (prev === 'front' ? 'back' : 'front'))}
              >
                <Text style={styles.cameraActionText}>🔄 Inverter</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cameraBottomBar}>
              <TouchableOpacity
                style={styles.shutterOuter}
                onPress={handleCapturePhoto}
                disabled={capturing}
                activeOpacity={0.8}
              >
                {capturing ? <ActivityIndicator color="#070B12" /> : <View style={styles.shutterInner} />}
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#070B12',
    padding: 24,
    justifyContent: 'center',
  },
  logoWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoImage: { width: 320, height: 102 },
  subtitle: { fontSize: 13, color: '#8BA4BE', textAlign: 'center', marginBottom: 20 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0D1520',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1C2E42',
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#00D4FF' },
  tabText: { color: '#8BA4BE', fontWeight: '700', fontSize: 14 },
  tabTextActive: { color: '#0D1520' },
  card: {
    backgroundColor: '#0D1520',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1C2E42',
  },
  label: { color: '#AEBAC1', fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#132030',
    color: '#F0F7FF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14,
  },
  primaryBtn: {
    backgroundColor: '#00D4FF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#0D1520', fontWeight: '700', fontSize: 15 },
  demoSection: { marginTop: 24 },
  demoTitle: { color: '#8BA4BE', fontSize: 12, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase' },
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1520',
    padding: 10,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1C2E42',
  },
  avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 12 },
  demoName: { color: '#F0F7FF', fontWeight: '600', fontSize: 14 },
  demoSub: { color: '#8BA4BE', fontSize: 12 },
  demoAction: { color: '#00D4FF', fontWeight: '700', fontSize: 13 },
  errBox: {
    backgroundColor: 'rgba(244,63,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.4)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  errText: { color: '#FDA4AF', fontSize: 12 },
  forgotLink: { marginTop: 14, alignItems: 'center' },
  forgotLinkText: { color: '#00D4FF', fontSize: 13, fontWeight: '600' },
  forgotTitle: { color: '#F0F7FF', fontSize: 17, fontWeight: '700', marginBottom: 12 },
  hintBox: {
    backgroundColor: 'rgba(0,212,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.35)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  hintText: { color: '#00D4FF', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  avatarPickerWrap: { alignItems: 'center', marginBottom: 16, gap: 8 },
  avatarTouch: { position: 'relative' },
  avatarPreview: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2.5,
    borderColor: '#00D4FF',
    backgroundColor: '#132030',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#00D4FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0D1520',
  },
  cameraBadgeText: { fontSize: 13 },
  avatarHint: { color: '#8BA4BE', fontSize: 12, fontWeight: '600' },
  cameraModal: { flex: 1, backgroundColor: '#070B12' },
  cameraTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  cameraActionBtn: {
    backgroundColor: 'rgba(7, 11, 18, 0.72)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  cameraActionText: { color: '#F0F7FF', fontWeight: '700', fontSize: 13 },
  cameraBottomBar: {
    position: 'absolute',
    bottom: 44,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#00D4FF',
    backgroundColor: 'rgba(240, 247, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#F0F7FF',
  },
  presetRow: { flexDirection: 'row', gap: 10 },
  presetThumbWrap: { borderRadius: 20, padding: 2, borderWidth: 1.5, borderColor: 'transparent' },
  presetThumbActive: { borderColor: '#00D4FF' },
  presetThumb: { width: 34, height: 34, borderRadius: 17 },
});
