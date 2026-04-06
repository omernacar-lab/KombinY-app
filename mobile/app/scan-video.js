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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SHADOWS, CATEGORIES } from '../constants/theme';
import { useWardrobeStore } from '../store';
import { wardrobeAPI } from '../services/api';

const FRAME_INTERVAL_MS = 2000;
const MAX_DURATION_SEC = 30;

export default function ScanVideoScreen() {
  const router = useRouter();
  const { bulkAddClothing } = useWardrobeStore();

  // Phase: 'select' | 'processing' | 'review' | 'uploading'
  const [phase, setPhase] = useState('select');
  const [videoUri, setVideoUri] = useState(null);
  const [videoThumb, setVideoThumb] = useState(null);
  const [progress, setProgress] = useState({ step: '', current: 0, total: 0 });
  const [detectedItems, setDetectedItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [itemPhotos, setItemPhotos] = useState({}); // { index: uri }
  const [submitting, setSubmitting] = useState(false);

  const pickVideo = async (source) => {
    let result;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Izin Gerekli', 'Kamera izni verin');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        videoMaxDuration: MAX_DURATION_SEC,
        quality: 0.5,
      });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Izin Gerekli', 'Galeri izni verin');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 0.5,
      });
    }

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setVideoUri(asset.uri);
      try {
        const thumb = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 0 });
        setVideoThumb(thumb.uri);
      } catch {
        setVideoThumb(null);
      }
    }
  };

  const takePhotoForItem = async (index) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Izin Gerekli', 'Kamera izni verin');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4],
    });

    if (!result.canceled && result.assets[0]) {
      setItemPhotos((prev) => ({ ...prev, [index]: result.assets[0].uri }));
    }
  };

  const pickPhotoForItem = async (index) => {
    Alert.alert('Fotoğraf Ekle', `"${detectedItems[index].suggested_name}" için`, [
      {
        text: 'Fotoğraf Çek',
        onPress: () => takePhotoForItem(index),
      },
      {
        text: 'Galeriden Seç',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: true,
            aspect: [3, 4],
          });
          if (!result.canceled && result.assets[0]) {
            setItemPhotos((prev) => ({ ...prev, [index]: result.assets[0].uri }));
          }
        },
      },
      { text: 'Iptal', style: 'cancel' },
    ]);
  };

  const startScan = async () => {
    if (!videoUri) return;
    setPhase('processing');

    try {
      setProgress({ step: 'Kareler cikariliyor...', current: 0, total: 0 });
      const frames = [];
      const maxFrames = Math.ceil(MAX_DURATION_SEC / (FRAME_INTERVAL_MS / 1000));

      for (let i = 0; i < maxFrames; i++) {
        const timeMs = i * FRAME_INTERVAL_MS;
        try {
          const thumb = await VideoThumbnails.getThumbnailAsync(videoUri, {
            time: timeMs,
            quality: 0.7,
          });
          frames.push(thumb.uri);
          setProgress({ step: 'Kareler cikariliyor...', current: frames.length, total: maxFrames });
        } catch {
          break;
        }
      }

      if (frames.length === 0) {
        Alert.alert('Hata', 'Videodan kare cikarilamadi');
        setPhase('select');
        return;
      }

      setProgress({ step: 'AI analiz ediyor...', current: 0, total: 1 });

      // Frame URI'larını base64'e çevir
      const framesBase64 = await Promise.all(
        frames.map((uri) =>
          FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
        )
      );

      const { data } = await wardrobeAPI.scanVideo(framesBase64);

      if (data.detected_items.length === 0) {
        Alert.alert('Sonuc', 'Hic kiyafet tespit edilemedi. Daha yakindan cekmeyi deneyin.');
        setPhase('select');
        return;
      }

      const allSelected = new Set(data.detected_items.map((_, i) => i));
      setDetectedItems(data.detected_items);
      setSelectedItems(allSelected);
      setItemPhotos({});
      setPhase('review');
    } catch (error) {
      Alert.alert('Hata', error.data?.error || error.message || 'Tarama basarisiz oldu');
      setPhase('select');
    }
  };

  const toggleItem = (index) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    const selectedIndices = Array.from(selectedItems);
    const items = selectedIndices.map((i) => detectedItems[i]);
    if (items.length === 0) {
      Alert.alert('Hata', 'En az bir kiyafet secin');
      return;
    }

    setSubmitting(true);
    setPhase('uploading');

    try {
      // 1. Kiyafetleri toplu ekle
      const result = await bulkAddClothing(items);
      const addedItems = result.added;

      // 2. Fotografi olan kiyafetlere fotoğraf yukle
      const photoIndices = selectedIndices.filter((i) => itemPhotos[i]);
      if (photoIndices.length > 0) {
        setProgress({ step: 'Fotograflar yukleniyor...', current: 0, total: photoIndices.length });

        for (let i = 0; i < photoIndices.length; i++) {
          const originalIndex = photoIndices[i];
          const addedIndex = selectedIndices.indexOf(originalIndex);
          const clothingId = addedItems[addedIndex]?.id;

          if (clothingId && itemPhotos[originalIndex]) {
            try {
              const photoBase64 = await FileSystem.readAsStringAsync(
                itemPhotos[originalIndex],
                { encoding: 'base64' }
              );
              await wardrobeAPI.uploadPhoto(clothingId, photoBase64);
            } catch {
              // Foto yuklenemezse devam et
            }
          }
          setProgress({ step: 'Fotograflar yukleniyor...', current: i + 1, total: photoIndices.length });
        }
      }

      const photoCount = photoIndices.length;
      Alert.alert(
        'Basarili!',
        `${result.count} kiyafet gardiroba eklendi!${photoCount > 0 ? `\n${photoCount} fotograf yuklendi.` : '\nSonra tek tek fotograflarini cekebilirsin.'}`,
        [{ text: 'Tamam', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Hata', error.response?.data?.error || 'Kiyafetler eklenemedi');
      setPhase('review');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = useCallback(({ item, index }) => {
    const isSelected = selectedItems.has(index);
    const cat = CATEGORIES[item.category];
    const hasPhoto = !!itemPhotos[index];

    return (
      <View style={[styles.itemCard, !isSelected && styles.itemCardUnselected]}>
        {/* Checkbox */}
        <TouchableOpacity style={styles.itemCheckbox} onPress={() => toggleItem(index)}>
          <Ionicons
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={24}
            color={isSelected ? COLORS.primary : COLORS.textLight}
          />
        </TouchableOpacity>

        {/* Foto alani */}
        <TouchableOpacity style={styles.photoArea} onPress={() => pickPhotoForItem(index)}>
          {hasPhoto ? (
            <Image source={{ uri: itemPhotos[index] }} style={styles.itemPhoto} />
          ) : (
            <View style={styles.itemPhotoPlaceholder}>
              <Ionicons name="camera" size={20} color={COLORS.textLight} />
            </View>
          )}
          <View style={styles.photoBadge}>
            <Ionicons
              name={hasPhoto ? 'checkmark-circle' : 'add-circle'}
              size={16}
              color={hasPhoto ? COLORS.success : COLORS.primary}
            />
          </View>
        </TouchableOpacity>

        {/* Bilgiler */}
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemEmoji}>{cat?.emoji || '👕'}</Text>
            <Text style={styles.itemName} numberOfLines={1}>{item.suggested_name}</Text>
          </View>
          <View style={styles.itemDetails}>
            <View style={styles.itemTag}>
              <Text style={styles.itemTagText}>{item.color}</Text>
            </View>
            <View style={styles.itemTag}>
              <Text style={styles.itemTagText}>{cat?.label || item.category}</Text>
            </View>
            {item.fabric && (
              <View style={styles.itemTag}>
                <Text style={styles.itemTagText}>{item.fabric}</Text>
              </View>
            )}
          </View>
          {item.position_hint && (
            <Text style={styles.itemPosition}>📍 {item.position_hint}</Text>
          )}
        </View>
      </View>
    );
  }, [selectedItems, itemPhotos, detectedItems]);

  // ==================== SELECT PHASE ====================
  if (phase === 'select') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Dolap Tarama</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.infoCard}>
            <Ionicons name="videocam" size={40} color={COLORS.primary} />
            <Text style={styles.infoTitle}>Dolabini Videoya Cek</Text>
            <Text style={styles.infoText}>
              Dolabini, raflarini veya katlanmis kiyafetlerini yavasca videoya cek.
              AI tum kiyafetleri otomatik tespit edecek!
            </Text>
          </View>

          {videoThumb ? (
            <View style={styles.videoPreview}>
              <Image source={{ uri: videoThumb }} style={styles.thumbImage} />
              <TouchableOpacity style={styles.removeVideo} onPress={() => { setVideoUri(null); setVideoThumb(null); }}>
                <Ionicons name="close-circle" size={28} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pickContainer}>
              <TouchableOpacity style={styles.pickButton} onPress={() => pickVideo('camera')}>
                <Ionicons name="videocam" size={40} color={COLORS.primary} />
                <Text style={styles.pickText}>Video Cek</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.pickButton} onPress={() => pickVideo('gallery')}>
                <Ionicons name="film" size={40} color={COLORS.accent} />
                <Text style={styles.pickText}>Galeriden Sec</Text>
              </TouchableOpacity>
            </View>
          )}

          {videoUri && (
            <TouchableOpacity style={styles.scanButton} onPress={startScan}>
              <Ionicons name="scan" size={22} color="#fff" />
              <Text style={styles.scanButtonText}>Taramayi Baslat</Text>
            </TouchableOpacity>
          )}

          <View style={styles.tipsList}>
            <Text style={styles.tipsTitle}>Ipuclari</Text>
            <Text style={styles.tipItem}>• Yavas ve sabit cekin</Text>
            <Text style={styles.tipItem}>• Iyi aydinlatma onemli</Text>
            <Text style={styles.tipItem}>• Max 30 saniye yeterli</Text>
            <Text style={styles.tipItem}>• Kiyafetlerin gorunur olmasina dikkat edin</Text>
          </View>
        </View>
      </View>
    );
  }

  // ==================== PROCESSING / UPLOADING PHASE ====================
  if (phase === 'processing' || phase === 'uploading') {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.processingStep}>{progress.step}</Text>
        {progress.total > 0 && (
          <Text style={styles.processingCount}>
            {progress.current} / {progress.total}
          </Text>
        )}
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              { width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' },
            ]}
          />
        </View>
        <Text style={styles.processingHint}>
          {phase === 'uploading' ? 'Kiyafetler ekleniyor...' : 'Bu islem biraz zaman alabilir...'}
        </Text>
      </View>
    );
  }

  // ==================== REVIEW PHASE ====================
  const photoCount = Object.keys(itemPhotos).filter((k) => selectedItems.has(Number(k))).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setPhase('select')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Tespit Edilen Kiyafetler</Text>
      </View>

      <View style={styles.reviewStats}>
        <Text style={styles.statsText}>
          {detectedItems.length} bulundu • {selectedItems.size} secili • {photoCount} foto
        </Text>
        <TouchableOpacity
          onPress={() => {
            if (selectedItems.size === detectedItems.length) {
              setSelectedItems(new Set());
            } else {
              setSelectedItems(new Set(detectedItems.map((_, i) => i)));
            }
          }}
        >
          <Text style={styles.selectAllText}>
            {selectedItems.size === detectedItems.length ? 'Hicbirini Secme' : 'Hepsini Sec'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Foto ipucu */}
      <View style={styles.photoHint}>
        <Ionicons name="camera-outline" size={16} color={COLORS.primary} />
        <Text style={styles.photoHintText}>
          Kiyafet karesine dokunarak tek tek fotograf ekleyebilirsin
        </Text>
      </View>

      <FlatList
        data={detectedItems}
        renderItem={renderItem}
        keyExtractor={(_, index) => index.toString()}
        contentContainerStyle={styles.listContent}
        extraData={[selectedItems, itemPhotos]}
      />

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.confirmButton, (submitting || selectedItems.size === 0) && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={submitting || selectedItems.size === 0}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.confirmButtonText}>
                {selectedItems.size} Kiyafeti Ekle
              </Text>
            </>
          )}
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
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  content: { padding: 20, flex: 1 },

  // Info card
  infoCard: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },
  infoTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 12 },
  infoText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  // Video pick
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

  // Video preview
  videoPreview: { position: 'relative', marginBottom: 20 },
  thumbImage: { width: '100%', height: 200, borderRadius: 16, resizeMode: 'cover' },
  removeVideo: { position: 'absolute', top: 10, right: 10 },

  // Scan button
  scanButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
    ...SHADOWS.medium,
  },
  scanButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // Tips
  tipsList: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  tipsTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  tipItem: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4, lineHeight: 20 },

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
  processingHint: { fontSize: 13, color: COLORS.textLight, marginTop: 16 },

  // Review
  reviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statsText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  selectAllText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },

  // Photo hint
  photoHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary + '08',
  },
  photoHintText: { fontSize: 13, color: COLORS.primary, flex: 1 },

  listContent: { padding: 16, paddingBottom: 100 },

  // Item card
  itemCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    ...SHADOWS.small,
  },
  itemCardUnselected: { opacity: 0.5 },
  itemCheckbox: { justifyContent: 'center', marginRight: 10 },

  // Photo area
  photoArea: { position: 'relative', marginRight: 12 },
  itemPhoto: { width: 56, height: 56, borderRadius: 10 },
  itemPhotoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: COLORS.divider,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  photoBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
  },

  itemContent: { flex: 1 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  itemEmoji: { fontSize: 18, marginRight: 6 },
  itemName: { fontSize: 15, fontWeight: '600', color: COLORS.text, flex: 1 },
  itemDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 4 },
  itemTag: {
    backgroundColor: COLORS.primary + '15',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  itemTagText: { fontSize: 11, color: COLORS.primary, fontWeight: '500' },
  itemPosition: { fontSize: 11, color: COLORS.textLight, marginTop: 3 },

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
  confirmButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonDisabled: { opacity: 0.5 },
  confirmButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
