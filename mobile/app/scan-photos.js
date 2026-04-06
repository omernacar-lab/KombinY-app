import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SHADOWS, CATEGORIES } from '../constants/theme';
import { useWardrobeStore } from '../store';

const MAX_PHOTOS = 10;

export default function ScanPhotosScreen() {
  const router = useRouter();
  const { addClothing } = useWardrobeStore();

  // Phase: 'capture' | 'processing' | 'done'
  const [phase, setPhase] = useState('capture');
  const [photos, setPhotos] = useState([]); // [{ uri, base64 }]
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState([]); // [{ success, clothing, ai_analysis, error }]

  const takePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit', `En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsin`);
      return;
    }

    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('İzin Gerekli', 'Kamera kullanmak için izin verin');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setPhotos((prev) => [...prev, { uri: asset.uri, base64: asset.base64 }]);
      }
    } catch (error) {
      console.error('takePhoto error:', error);
      Alert.alert('Hata', 'Kamera açılırken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  const pickFromGallery = async () => {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      Alert.alert('Limit', `En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsin`);
      return;
    }

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('İzin Gerekli', 'Galeri erişimi için izin verin');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        base64: true,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const newPhotos = result.assets.map((asset) => ({
          uri: asset.uri,
          base64: asset.base64,
        }));
        setPhotos((prev) => [...prev, ...newPhotos].slice(0, MAX_PHOTOS));
      }
    } catch (error) {
      console.error('pickFromGallery error:', error);
      Alert.alert('Hata', 'Galeri açılırken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  const removePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const startProcessing = async () => {
    if (photos.length === 0) return;

    setPhase('processing');
    setProgress({ current: 0, total: photos.length });

    const processedResults = [];

    for (let i = 0; i < photos.length; i++) {
      setProgress({ current: i + 1, total: photos.length });

      try {
        const data = await addClothing(photos[i].base64);
        processedResults.push({
          success: true,
          clothing: data.clothing,
          ai_analysis: data.ai_analysis,
          photoUri: photos[i].uri,
        });
      } catch (error) {
        processedResults.push({
          success: false,
          error: error.data?.error || error.message || 'Analiz başarısız',
          photoUri: photos[i].uri,
        });
      }
    }

    setResults(processedResults);
    setPhase('done');
  };

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  // ==================== CAPTURE PHASE ====================
  if (phase === 'capture') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Toplu Fotoğraf Ekle</Text>
          <Text style={styles.counter}>{photos.length}/{MAX_PHOTOS}</Text>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.infoCard}>
            <Ionicons name="images" size={36} color={COLORS.primary} />
            <Text style={styles.infoTitle}>Kıyafetlerini Fotoğrafla</Text>
            <Text style={styles.infoText}>
              Her kıyafeti tek tek fotoğrafla veya galeriden birden fazla seç.
              AI her birini otomatik tanıyacak!
            </Text>
          </View>

          {/* Fotoğraf Ekleme Butonları */}
          <View style={styles.pickContainer}>
            <TouchableOpacity style={styles.pickButton} onPress={takePhoto}>
              <Ionicons name="camera" size={36} color={COLORS.primary} />
              <Text style={styles.pickText}>Fotoğraf Çek</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pickButton} onPress={pickFromGallery}>
              <Ionicons name="images" size={36} color={COLORS.accent} />
              <Text style={styles.pickText}>Galeriden Seç</Text>
            </TouchableOpacity>
          </View>

          {/* Eklenen Fotoğraflar Grid */}
          {photos.length > 0 && (
            <View style={styles.gridSection}>
              <Text style={styles.sectionTitle}>
                {photos.length} Fotoğraf Eklendi
              </Text>
              <View style={styles.photoGrid}>
                {photos.map((photo, index) => (
                  <View key={index} style={styles.gridItem}>
                    <Image source={{ uri: photo.uri }} style={styles.gridImage} />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removePhoto(index)}
                    >
                      <Ionicons name="close-circle" size={24} color={COLORS.error} />
                    </TouchableOpacity>
                    <View style={styles.gridIndex}>
                      <Text style={styles.gridIndexText}>{index + 1}</Text>
                    </View>
                  </View>
                ))}

                {/* Boş Slot - Fotoğraf Çek */}
                {photos.length < MAX_PHOTOS && (
                  <TouchableOpacity style={styles.addSlot} onPress={takePhoto}>
                    <Ionicons name="add" size={32} color={COLORS.textLight} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          <View style={styles.tipsList}>
            <Text style={styles.tipsTitle}>İpuçları</Text>
            <Text style={styles.tipItem}>• Her fotoğrafta tek bir kıyafet olsun</Text>
            <Text style={styles.tipItem}>• Kıyafeti düz bir zemine serin veya askıya asın</Text>
            <Text style={styles.tipItem}>• İyi aydınlatma altında çekin</Text>
            <Text style={styles.tipItem}>• Galeriden birden fazla fotoğraf seçebilirsin</Text>
          </View>
        </ScrollView>

        {/* Alt Buton */}
        {photos.length > 0 && (
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.startButton} onPress={startProcessing}>
              <Ionicons name="sparkles" size={22} color="#fff" />
              <Text style={styles.startButtonText}>
                {photos.length} Kıyafeti Analiz Et
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ==================== PROCESSING PHASE ====================
  if (phase === 'processing') {
    const pct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.processingStep}>AI analiz ediyor...</Text>
        <Text style={styles.processingCount}>
          {progress.current} / {progress.total}
        </Text>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.processingHint}>
          Her fotoğraf için AI kıyafeti tanıyor ve gardıroba ekliyor
        </Text>

        {/* Küçük önizlemeler */}
        <View style={styles.processingThumbs}>
          {photos.map((photo, i) => (
            <View key={i} style={styles.processingThumb}>
              <Image source={{ uri: photo.uri }} style={styles.processingThumbImg} />
              {i < progress.current && (
                <View style={styles.thumbDone}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
    );
  }

  // ==================== DONE PHASE ====================
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Sonuçlar</Text>
      </View>

      {/* Özet */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
            <Text style={styles.summaryNumber}>{successCount}</Text>
            <Text style={styles.summaryLabel}>Eklendi</Text>
          </View>
          {failCount > 0 && (
            <View style={styles.summaryItem}>
              <Ionicons name="close-circle" size={28} color={COLORS.error} />
              <Text style={styles.summaryNumber}>{failCount}</Text>
              <Text style={styles.summaryLabel}>Başarısız</Text>
            </View>
          )}
        </View>
      </View>

      {/* Sonuç Listesi */}
      <FlatList
        data={results}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={styles.resultList}
        renderItem={({ item }) => {
          const cat = item.success ? CATEGORIES[item.clothing.category] : null;
          return (
            <View style={[styles.resultCard, !item.success && styles.resultCardError]}>
              <Image source={{ uri: item.photoUri }} style={styles.resultImage} />
              <View style={styles.resultContent}>
                {item.success ? (
                  <>
                    <View style={styles.resultHeader}>
                      <Text style={styles.resultEmoji}>{cat?.emoji || '👕'}</Text>
                      <Text style={styles.resultName} numberOfLines={1}>
                        {item.clothing.name}
                      </Text>
                    </View>
                    <View style={styles.resultTags}>
                      <View style={styles.resultTag}>
                        <Text style={styles.resultTagText}>{item.ai_analysis.color}</Text>
                      </View>
                      <View style={styles.resultTag}>
                        <Text style={styles.resultTagText}>
                          {cat?.label || item.clothing.category}
                        </Text>
                      </View>
                      {item.ai_analysis.fabric && (
                        <View style={styles.resultTag}>
                          <Text style={styles.resultTagText}>{item.ai_analysis.fabric}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.resultMeta}>
                      {item.ai_analysis.season && (
                        <Text style={styles.resultMetaText}>
                          {item.ai_analysis.season.join(', ')}
                        </Text>
                      )}
                    </View>
                  </>
                ) : (
                  <View style={styles.errorContent}>
                    <Ionicons name="warning" size={20} color={COLORS.error} />
                    <Text style={styles.errorText}>{item.error}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Alt Butonlar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => router.back()}
        >
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.doneButtonText}>Tamam</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContent: { justifyContent: 'center', alignItems: 'center', padding: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: { marginRight: 12, padding: 4 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text, flex: 1 },
  counter: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  content: { flex: 1 },
  contentInner: { padding: 20, paddingBottom: 120 },

  // Info card
  infoCard: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },
  infoTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 10 },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // Pick buttons
  pickContainer: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  pickButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  pickText: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  // Photo grid
  gridSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { position: 'relative', width: '30%', aspectRatio: 3 / 4 },
  gridImage: { width: '100%', height: '100%', borderRadius: 12 },
  removeButton: { position: 'absolute', top: -6, right: -6, zIndex: 1 },
  gridIndex: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridIndexText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  addSlot: {
    width: '30%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },

  // Tips
  tipsList: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  tipsTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  tipItem: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4, lineHeight: 20 },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 34,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  startButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...SHADOWS.medium,
  },
  startButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // Processing
  processingStep: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 24 },
  processingCount: { fontSize: 16, color: COLORS.primary, marginTop: 8 },
  progressBarContainer: {
    width: '80%',
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBar: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
  processingHint: { fontSize: 13, color: COLORS.textLight, marginTop: 16, textAlign: 'center' },
  processingThumbs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  processingThumb: { position: 'relative' },
  processingThumbImg: { width: 48, height: 48, borderRadius: 10 },
  thumbDone: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
  },

  // Summary
  summaryCard: {
    backgroundColor: COLORS.surface,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'center', gap: 40 },
  summaryItem: { alignItems: 'center', gap: 4 },
  summaryNumber: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  summaryLabel: { fontSize: 13, color: COLORS.textSecondary },

  // Result list
  resultList: { padding: 16, paddingBottom: 100 },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    ...SHADOWS.small,
  },
  resultCardError: { borderWidth: 1, borderColor: COLORS.error + '40' },
  resultImage: { width: 64, height: 85, borderRadius: 10, marginRight: 12 },
  resultContent: { flex: 1, justifyContent: 'center' },
  resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  resultEmoji: { fontSize: 18, marginRight: 6 },
  resultName: { fontSize: 15, fontWeight: '600', color: COLORS.text, flex: 1 },
  resultTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 4 },
  resultTag: {
    backgroundColor: COLORS.primary + '15',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  resultTagText: { fontSize: 11, color: COLORS.primary, fontWeight: '500' },
  resultMeta: { marginTop: 2 },
  resultMetaText: { fontSize: 11, color: COLORS.textLight },
  errorContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { fontSize: 13, color: COLORS.error, flex: 1 },

  // Done button
  doneButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  doneButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
