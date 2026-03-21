import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, OCCASIONS } from '../../constants/theme';
import { useOutfitStore, useWeatherStore, useAuthStore } from '../../store';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { currentOutfit, isGenerating, generateOutfit, sendFeedback, wearOutfit } = useOutfitStore();
  const { weather, fetchWeather } = useWeatherStore();
  const [occasion, setOccasion] = useState('gunluk');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.city) {
      fetchWeather(user.city);
    }
  }, [user?.city]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWeather(user?.city || 'Istanbul');
    setRefreshing(false);
  }, [user?.city]);

  const handleGenerate = async () => {
    try {
      await generateOutfit(occasion, user?.city);
    } catch (error) {
      const msg = error.response?.data;
      if (msg?.upgrade) {
        Alert.alert('Premium Gerekli', msg.message, [
          { text: 'Tamam', style: 'cancel' },
          { text: 'Premium\'a Geç', onPress: () => {} },
        ]);
      } else {
        Alert.alert('Hata', msg?.error || 'Kombin oluşturulamadı');
      }
    }
  };

  const handleFeedback = async (liked) => {
    if (!currentOutfit?.outfit_id) return;
    try {
      await sendFeedback(currentOutfit.outfit_id, liked);
      if (liked) {
        Alert.alert('Harika! 🎉', 'Bu tarzı sevdiğini not ettik, önerilerimiz gelişecek!');
      }
    } catch {
      // ignore
    }
  };

  const handleWear = async () => {
    if (!currentOutfit?.outfit_id) return;
    try {
      await wearOutfit(currentOutfit.outfit_id);
      Alert.alert('Güle güle giy! 👗', 'Kombin giyim geçmişine eklendi.');
    } catch {
      Alert.alert('Hata', 'İşlem başarısız');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'İyi günler';
    return 'İyi akşamlar';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Karşılama */}
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>
          {getGreeting()}, {user?.full_name?.split(' ')[0]} 👋
        </Text>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('tr-TR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>
      </View>

      {/* Hava Durumu */}
      {weather && (
        <View style={styles.weatherCard}>
          <View style={styles.weatherLeft}>
            <Text style={styles.weatherTemp}>{weather.temp}°</Text>
            <Text style={styles.weatherDesc}>{weather.description}</Text>
          </View>
          <View style={styles.weatherRight}>
            <Ionicons
              name={weather.temp > 20 ? 'sunny' : weather.temp > 10 ? 'partly-sunny' : 'snow'}
              size={40}
              color={COLORS.warning}
            />
          </View>
        </View>
      )}

      {/* Ortam Seçimi */}
      <Text style={styles.sectionTitle}>Bugün ne yapıyorsun?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.occasionScroll}>
        {OCCASIONS.map((o) => (
          <TouchableOpacity
            key={o.value}
            style={[styles.occasionChip, occasion === o.value && styles.occasionChipActive]}
            onPress={() => setOccasion(o.value)}
          >
            <Text style={styles.occasionEmoji}>{o.emoji}</Text>
            <Text
              style={[styles.occasionLabel, occasion === o.value && styles.occasionLabelActive]}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Kombin Oluştur Butonu */}
      <TouchableOpacity
        style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
        onPress={handleGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <View style={styles.generatingContainer}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.generateButtonText}>AI düşünüyor...</Text>
          </View>
        ) : (
          <View style={styles.generatingContainer}>
            <Ionicons name="sparkles" size={24} color="#fff" />
            <Text style={styles.generateButtonText}>Kombin Öner</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Kombin Sonucu */}
      {currentOutfit && (
        <View style={styles.outfitCard}>
          <Text style={styles.outfitTitle}>Bugünün Kombini ✨</Text>

          {/* Kıyafet Listesi */}
          {currentOutfit.items?.map((item, index) => (
            <View key={index} style={styles.outfitItem}>
              {item.clothing?.thumbnail_url ? (
                <Image source={{ uri: item.clothing.thumbnail_url }} style={styles.itemImage} />
              ) : (
                <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                  <Ionicons name="shirt" size={24} color={COLORS.textLight} />
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.clothing?.name || 'Kıyafet'}</Text>
                <Text style={styles.itemReason}>{item.reason}</Text>
              </View>
            </View>
          ))}

          {/* Stil İpucu */}
          {currentOutfit.styling_tip && (
            <View style={styles.tipContainer}>
              <Ionicons name="bulb" size={18} color={COLORS.warning} />
              <Text style={styles.tipText}>{currentOutfit.styling_tip}</Text>
            </View>
          )}

          {/* Aksiyon Butonları */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.dislikeButton]}
              onPress={() => handleFeedback(false)}
            >
              <Ionicons name="thumbs-down" size={22} color={COLORS.error} />
              <Text style={[styles.actionText, { color: COLORS.error }]}>Beğenmedim</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.wearButton]}
              onPress={handleWear}
            >
              <Ionicons name="checkmark-circle" size={22} color={COLORS.textWhite} />
              <Text style={[styles.actionText, { color: COLORS.textWhite }]}>Bunu Giyiyorum</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.likeButton]}
              onPress={() => handleFeedback(true)}
            >
              <Ionicons name="heart" size={22} color={COLORS.secondary} />
              <Text style={[styles.actionText, { color: COLORS.secondary }]}>Beğendim</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  contentContainer: { padding: 20, paddingBottom: 40 },
  greeting: { marginBottom: 20 },
  greetingText: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  dateText: { fontSize: 15, color: COLORS.textSecondary, marginTop: 4 },
  weatherCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    ...SHADOWS.medium,
  },
  weatherLeft: {},
  weatherRight: {},
  weatherTemp: { fontSize: 36, fontWeight: '800', color: COLORS.text },
  weatherDesc: { fontSize: 14, color: COLORS.textSecondary, textTransform: 'capitalize' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  occasionScroll: { marginBottom: 20 },
  occasionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
  },
  occasionChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  occasionEmoji: { fontSize: 18, marginRight: 6 },
  occasionLabel: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  occasionLabelActive: { color: COLORS.textWhite },
  generateButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 24,
    ...SHADOWS.medium,
  },
  generateButtonDisabled: { opacity: 0.7 },
  generatingContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  generateButtonText: { color: COLORS.textWhite, fontSize: 18, fontWeight: '700' },
  outfitCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    ...SHADOWS.medium,
  },
  outfitTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  outfitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  itemImage: { width: 60, height: 60, borderRadius: 10, marginRight: 14 },
  itemImagePlaceholder: {
    backgroundColor: COLORS.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  itemReason: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.warning + '15',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  tipText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 20 },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 4,
  },
  dislikeButton: { backgroundColor: COLORS.error + '15' },
  wearButton: { backgroundColor: COLORS.primary },
  likeButton: { backgroundColor: COLORS.secondary + '15' },
  actionText: { fontSize: 12, fontWeight: '600' },
});
