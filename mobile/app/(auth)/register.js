import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { useAuthStore } from '../../store';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState(null);
  const [city, setCity] = useState('Istanbul');
  const [loading, setLoading] = useState(false);
  const { register } = useAuthStore();
  const router = useRouter();

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Hata', 'İsim, email ve şifre gerekli');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalı');
      return;
    }

    setLoading(true);
    try {
      await register({ fullName: fullName.trim(), email: email.trim(), password, gender, city });
      // Basarili kayit - eger email onay gerekiyorsa kullaniciya bildir
      // Supabase varsayilan olarak email onay bekler
    } catch (error) {
      // Supabase hatalari error.message olarak gelir
      Alert.alert('Kayıt Hatası', error.message || 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Hesap Oluştur</Text>
          <Text style={styles.subtitle}>Gardırobunu dijitalleştir, her gün şık ol!</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Ad Soyad"
            placeholderTextColor={COLORS.textLight}
            value={fullName}
            onChangeText={setFullName}
          />

          <TextInput
            style={styles.input}
            placeholder="E-posta"
            placeholderTextColor={COLORS.textLight}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Şifre (en az 6 karakter)"
            placeholderTextColor={COLORS.textLight}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {/* Cinsiyet seçimi */}
          <Text style={styles.label}>Cinsiyet</Text>
          <View style={styles.genderRow}>
            {[
              { value: 'female', label: 'Kadın', emoji: '👩' },
              { value: 'male', label: 'Erkek', emoji: '👨' },
              { value: 'other', label: 'Diğer', emoji: '🧑' },
            ].map((g) => (
              <TouchableOpacity
                key={g.value}
                style={[styles.genderOption, gender === g.value && styles.genderSelected]}
                onPress={() => setGender(g.value)}
              >
                <Text style={styles.genderEmoji}>{g.emoji}</Text>
                <Text style={[styles.genderText, gender === g.value && styles.genderTextSelected]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Şehir"
            placeholderTextColor={COLORS.textLight}
            value={city}
            onChangeText={setCity}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Kayıt Ol</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={() => router.back()}>
            <Text style={styles.linkText}>
              Zaten hesabın var mı? <Text style={styles.linkBold}>Giriş Yap</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  header: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center' },
  form: { gap: 14 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 4 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  genderRow: { flexDirection: 'row', gap: 12 },
  genderOption: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  genderSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  genderEmoji: { fontSize: 24, marginBottom: 4 },
  genderText: { fontSize: 13, color: COLORS.textSecondary },
  genderTextSelected: { color: COLORS.primary, fontWeight: '600' },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: COLORS.textWhite, fontSize: 18, fontWeight: '700' },
  linkButton: { alignItems: 'center', marginTop: 16 },
  linkText: { fontSize: 14, color: COLORS.textSecondary },
  linkBold: { color: COLORS.primary, fontWeight: '700' },
});
