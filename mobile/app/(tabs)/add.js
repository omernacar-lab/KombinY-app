import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SHADOWS, CATEGORIES } from '../../constants/theme';
import { useWardrobeStore } from '../../store';

export default function AddClothingScreen() {
  const [image, setImage] = useState(null);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const { addClothing } = useWardrobeStore();
  const router = useRouter();

  const pickImage = async (source) => {
    try {
      let result;

      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('İzin Gerekli', 'Kamera kullanmak için izin verin');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          quality: 0.8,
          allowsEditing: true,
          aspect: [3, 4],
          base64: true,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('İzin Gerekli', 'Galeri erişimi için izin verin');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          quality: 0.8,
          allowsEditing: true,
          aspect: [3, 4],
          base64: true,
        });
      }

      if (!result.canceled && result.assets?.[0]) {
        setImage(result.assets[0]);
        setAiResult(null);
      }
    } catch (error) {
      console.error('pickImage error:', error);
      Alert.alert('Hata', 'Fotoğraf seçilirken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  const handleUpload = async () => {
    if (!image) {
      Alert.alert('Hata', 'Lütfen bir fotoğraf seçin');
      return;
    }

    setLoading(true);
    try {
      // base64 verisi yoksa URI'dan oku (crop sonrası kaybolabiliyor)
      let base64Data = image.base64;
      if (!base64Data && image.uri) {
        base64Data = await FileSystem.readAsStringAsync(image.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      if (!base64Data) {
        Alert.alert('Hata', 'Fotoğraf verisi okunamadı, tekrar deneyin');
        return;
      }

      // 30 saniye timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.')), 30000)
      );

      const result = await Promise.race([
        addClothing(base64Data, { name, brand, category: selectedCategory }),
        timeoutPromise,
      ]);

      setAiResult(result.ai_analysis);

      Alert.alert(
        'Başarılı! 🎉',
        `"${result.clothing.name}" gardırobuna eklendi!\n\nRenk: ${result.ai_analysis.color}\nKategori: ${CATEGORIES[result.clothing.category]?.label || result.clothing.category}`,
        [
          {
            text: 'Yeni Ekle',
            onPress: () => {
              setImage(null);
              setName('');
              setBrand('');
              setSelectedCategory(null);
              setAiResult(null);
            },
          },
          { text: 'Tamam' },
        ]
      );
    } catch (error) {
      Alert.alert('Hata', error.data?.error || error.message || 'Kıyafet eklenemedi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Kıyafet Ekle</Text>
      <Text style={styles.subtitle}>Fotoğraf çek veya galeriden seç, AI analiz etsin!</Text>

      {/* Toplu Fotoğraf Ekleme */}
      <TouchableOpacity style={styles.videoScanBanner} onPress={() => router.push('/scan-photos')}>
        <View style={styles.videoScanLeft}>
          <Ionicons name="images" size={28} color={COLORS.primary} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.videoScanTitle}>Toplu Fotoğraf Ekle</Text>
            <Text style={styles.videoScanDesc}>5-10 kıyafeti tek seferde fotoğrafla!</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={22} color={COLORS.textLight} />
      </TouchableOpacity>

      {/* Video ile Toplu Tarama */}
      <TouchableOpacity style={[styles.videoScanBanner, { backgroundColor: COLORS.accent + '10', borderColor: COLORS.accent + '25' }]} onPress={() => router.push('/scan-video')}>
        <View style={styles.videoScanLeft}>
          <Ionicons name="videocam" size={28} color={COLORS.accent} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.videoScanTitle}>Video ile Dolap Tara</Text>
            <Text style={styles.videoScanDesc}>Tüm dolabını tek seferde ekle!</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={22} color={COLORS.textLight} />
      </TouchableOpacity>

      {/* Fotoğraf Alanı */}
      {image ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: image.uri }} style={styles.preview} />
          <TouchableOpacity style={styles.removeImage} onPress={() => setImage(null)}>
            <Ionicons name="close-circle" size={28} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.pickContainer}>
          <TouchableOpacity style={styles.pickButton} onPress={() => pickImage('camera')}>
            <Ionicons name="camera" size={40} color={COLORS.primary} />
            <Text style={styles.pickText}>Fotoğraf Çek</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.pickButton} onPress={() => pickImage('gallery')}>
            <Ionicons name="images" size={40} color={COLORS.accent} />
            <Text style={styles.pickText}>Galeriden Seç</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* İsteğe Bağlı Bilgiler */}
      <View style={styles.formSection}>
        <TextInput
          style={styles.input}
          placeholder="Kıyafet adı (opsiyonel - AI belirleyecek)"
          placeholderTextColor={COLORS.textLight}
          value={name}
          onChangeText={setName}
        />

        <TextInput
          style={styles.input}
          placeholder="Marka (opsiyonel)"
          placeholderTextColor={COLORS.textLight}
          value={brand}
          onChangeText={setBrand}
        />

        {/* Kategori Seçimi */}
        <Text style={styles.label}>Kategori (opsiyonel - AI belirleyecek)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {Object.entries(CATEGORIES).map(([key, val]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.categoryChip,
                selectedCategory === key && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(selectedCategory === key ? null : key)}
            >
              <Text style={styles.categoryEmoji}>{val.emoji}</Text>
              <Text
                style={[
                  styles.categoryLabel,
                  selectedCategory === key && styles.categoryLabelActive,
                ]}
              >
                {val.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* AI Analiz Sonucu */}
      {aiResult && (
        <View style={styles.aiResultCard}>
          <Text style={styles.aiResultTitle}>🤖 AI Analiz Sonucu</Text>
          <View style={styles.aiRow}>
            <Text style={styles.aiLabel}>Renk:</Text>
            <Text style={styles.aiValue}>{aiResult.color}</Text>
          </View>
          <View style={styles.aiRow}>
            <Text style={styles.aiLabel}>Kumaş:</Text>
            <Text style={styles.aiValue}>{aiResult.fabric}</Text>
          </View>
          <View style={styles.aiRow}>
            <Text style={styles.aiLabel}>Mevsim:</Text>
            <Text style={styles.aiValue}>{aiResult.season?.join(', ')}</Text>
          </View>
          <View style={styles.aiRow}>
            <Text style={styles.aiLabel}>Ortam:</Text>
            <Text style={styles.aiValue}>{aiResult.occasion?.join(', ')}</Text>
          </View>
        </View>
      )}

      {/* Yükle Butonu */}
      <TouchableOpacity
        style={[styles.uploadButton, (!image || loading) && styles.uploadButtonDisabled]}
        onPress={handleUpload}
        disabled={!image || loading}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.uploadButtonText}>AI analiz ediyor...</Text>
          </View>
        ) : (
          <View style={styles.loadingContainer}>
            <Ionicons name="cloud-upload" size={22} color="#fff" />
            <Text style={styles.uploadButtonText}>Gardıroba Ekle</Text>
          </View>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: 20 },
  imageContainer: { position: 'relative', marginBottom: 20 },
  preview: {
    width: '100%',
    height: 350,
    borderRadius: 16,
    resizeMode: 'cover',
  },
  removeImage: { position: 'absolute', top: 10, right: 10 },
  pickContainer: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  pickButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  pickText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  formSection: { gap: 12, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryEmoji: { fontSize: 16, marginRight: 4 },
  categoryLabel: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  categoryLabelActive: { color: COLORS.textWhite },
  aiResultCard: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  aiResultTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primary, marginBottom: 10 },
  aiRow: { flexDirection: 'row', marginBottom: 4 },
  aiLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, width: 80 },
  aiValue: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },
  uploadButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  uploadButtonDisabled: { opacity: 0.5 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  uploadButtonText: { color: COLORS.textWhite, fontSize: 17, fontWeight: '700' },
  videoScanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary + '10',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primary + '25',
  },
  videoScanLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  videoScanTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  videoScanDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
});
