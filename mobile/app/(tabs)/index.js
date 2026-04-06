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
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, OCCASIONS, CATEGORIES } from '../../constants/theme';
import { useOutfitStore, useWeatherStore, useAuthStore, useWardrobeStore } from '../../store';
import { wardrobeAPI } from '../../services/api';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { currentOutfit, isGenerating, generateOutfit, sendFeedback, wearOutfit, updateOutfitItems, addOutfitItem } = useOutfitStore();
  const { weather, fetchWeather, weatherError } = useWeatherStore();
  const { clothes, fetchClothes } = useWardrobeStore();
  const [occasion, setOccasion] = useState('gunluk');
  const [refreshing, setRefreshing] = useState(false);
  const [removedItems, setRemovedItems] = useState([]);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [addPickerCategory, setAddPickerCategory] = useState(null);

  // Hava durumu - sadece oturum varsa fetch et
  const { isAuthenticated, session } = useAuthStore();
  useEffect(() => {
    if (!isAuthenticated || !session?.access_token) return;
    if (weatherError) return; // Hata varsa tekrar fetch etme
    const city = user?.city || user?.user_metadata?.city || 'Istanbul';
    fetchWeather(city);
  }, [isAuthenticated, session, user, weatherError]);
  // Weather error mesajını ekranda göster
  useEffect(() => {
    if (weatherError) {
      Alert.alert('Hava Durumu Hatası', weatherError);
    }
  }, [weatherError]);

  // Kombin değişince removed items sıfırla
  useEffect(() => {
    setRemovedItems([]);
  }, [currentOutfit?.outfit_id]);

  const onRefresh = useCallback(async () => {
    if (!isAuthenticated || !session?.access_token) return;
    if (weatherError) return; // Hata varsa tekrar fetch etme
    setRefreshing(true);
    const city = user?.city || user?.user_metadata?.city || 'Istanbul';
    await fetchWeather(city);
    setRefreshing(false);
  }, [isAuthenticated, session, user, weatherError]);

  const handleGenerate = async () => {
    try {
      await generateOutfit(occasion, user?.city || user?.user_metadata?.city);
    } catch (error) {
      const msg = error.data || error;
      if (msg?.upgrade) {
        Alert.alert('Premium Gerekli', msg.message, [
          { text: 'Tamam', style: 'cancel' },
          { text: "Premium'a Geç", onPress: () => {} },
        ]);
      } else {
        Alert.alert('Hata', msg?.error || error?.message || 'Kombin oluşturulamadı');
      }
    }
  };

  const handleFeedback = async (liked) => {
    if (!currentOutfit?.outfit_id) return;
    try {
      await sendFeedback(currentOutfit.outfit_id, liked);
      if (liked) {
        Alert.alert('Harika! 🎉', 'Bu tarzı sevdiğini not ettik, önerilerimiz gelişecek!');
      } else {
        Alert.alert('Anladık 👍', 'Bu kombini beğenmediğini kaydettik. Bir dahakine daha iyi olacak!');
      }
    } catch {
      // ignore
    }
  };

  // Parça bazlı beğenmeme - o kıyafeti kombinden çıkar ve tercih öğren
  const handleRemoveItem = (item, index) => {
    const itemName = item.clothing?.name || 'Bu kıyafet';
    const category = item.clothing?.category;
    const categoryLabel = CATEGORIES[category]?.label || category;

    Alert.alert(
      `${itemName} Çıkarılsın mı?`,
      'Bu parçayı kombinden çıkarıp yerine başka bir öneri alabilirsin.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Beğenmedim, Çıkar',
          style: 'destructive',
          onPress: async () => {
            // Parçayı kaldır
            setRemovedItems((prev) => [...prev, index]);

            // Parça bazlı negatif feedback gönder (tercih öğrenme)
            if (item.clothing_id && currentOutfit?.outfit_id) {
              try {
                await sendFeedback(currentOutfit.outfit_id, false);
              } catch {
                // silent
              }
            }
          },
        },
        {
          text: 'Değiştir',
          onPress: () => handleSwapItem(item, index),
        },
      ]
    );
  };

  // Parçayı aynı kategoriden başka bir kıyafetle değiştir
  const handleSwapItem = async (item, index) => {
    const category = item.clothing?.category;
    if (!category) return;

    // Mevcut gardıroptan aynı kategorideki alternatifleri bul
    let alternatives = clothes.filter(
      (c) =>
        c.category === category &&
        c.status === 'temiz' &&
        !c.is_archived &&
        c.id !== item.clothing_id &&
        !currentOutfit.items.some((oi) => oi.clothing_id === c.id)
    );

    if (alternatives.length === 0) {
      // Gardırop yüklü değilse yükle ve tekrar dene
      try {
        await fetchClothes({ category });
      } catch {
        // ignore
      }
      Alert.alert('Alternatif Yok', 'Bu kategoride başka temiz kıyafet bulunamadı.');
      return;
    }

    // Rastgele bir alternatif seç
    const randomAlt = alternatives[Math.floor(Math.random() * alternatives.length)];

    // Outfit items'ı güncelle
    updateOutfitItems(index, {
      clothing_id: randomAlt.id,
      clothing: randomAlt,
      reason: 'Senin seçiminle değiştirildi',
    });
  };

  // Kombine parça ekleme
  const handleOpenAddPicker = async () => {
    // Gardırop yüklü değilse yükle
    if (clothes.length === 0) {
      try { await fetchClothes(); } catch { /* ignore */ }
    }
    setAddPickerCategory(null);
    setShowAddPicker(true);
  };

  const handleAddItem = (clothing) => {
    // Zaten kombinde mi kontrol et
    if (currentOutfit?.items?.some((i) => i.clothing_id === clothing.id)) {
      Alert.alert('Zaten Var', 'Bu kıyafet zaten kombinde.');
      return;
    }
    addOutfitItem(clothing);
    setShowAddPicker(false);
  };

  // Picker için filtrelenmiş kıyafetler
  const pickerClothes = clothes.filter((c) => {
    if (c.is_archived || c.status !== 'temiz') return false;
    if (currentOutfit?.items?.some((i) => i.clothing_id === c.id)) return false;
    if (addPickerCategory && c.category !== addPickerCategory) return false;
    return true;
  });

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

  // Görünür kıyafetler (çıkarılanlar hariç)
  const visibleItems = currentOutfit?.items?.filter((_, i) => !removedItems.includes(i)) || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Karşılama */}
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>
          {getGreeting()},{' '}
          {user?.full_name?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || ''} 👋
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

          {/* Kıyafet Listesi - swipe/tap ile çıkar */}
          {visibleItems.map((item, index) => {
            const actualIndex = currentOutfit.items.indexOf(item);
            return (
              <View key={actualIndex} style={styles.outfitItem}>
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
                {/* Parça bazlı kontroller */}
                <TouchableOpacity
                  style={styles.itemSwapButton}
                  onPress={() => handleRemoveItem(item, actualIndex)}
                >
                  <Ionicons name="swap-horizontal" size={18} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Parça Ekle Butonu */}
          <TouchableOpacity style={styles.addItemButton} onPress={handleOpenAddPicker}>
            <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
            <Text style={styles.addItemText}>Parça Ekle</Text>
          </TouchableOpacity>

          {/* Çıkarılan parça uyarısı */}
          {removedItems.length > 0 && (
            <View style={styles.removedNotice}>
              <Ionicons name="information-circle" size={16} color={COLORS.info} />
              <Text style={styles.removedNoticeText}>
                {removedItems.length} parça çıkarıldı. Tercihlerini kaydettik!
              </Text>
            </View>
          )}

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
              <Text style={[styles.actionText, { color: COLORS.textWhite }]}>Giyiyorum</Text>
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
      {/* Parça Ekle Modal */}
      <Modal visible={showAddPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Parça Ekle</Text>
              <TouchableOpacity onPress={() => setShowAddPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Kategori Filtresi */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalCategoryScroll}>
              <TouchableOpacity
                style={[styles.modalCategoryChip, !addPickerCategory && styles.modalCategoryChipActive]}
                onPress={() => setAddPickerCategory(null)}
              >
                <Text style={[styles.modalCategoryLabel, !addPickerCategory && styles.modalCategoryLabelActive]}>Tümü</Text>
              </TouchableOpacity>
              {Object.entries(CATEGORIES).map(([key, val]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.modalCategoryChip, addPickerCategory === key && styles.modalCategoryChipActive]}
                  onPress={() => setAddPickerCategory(addPickerCategory === key ? null : key)}
                >
                  <Text style={styles.modalCategoryEmoji}>{val.emoji}</Text>
                  <Text style={[styles.modalCategoryLabel, addPickerCategory === key && styles.modalCategoryLabelActive]}>{val.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Kıyafet Listesi */}
            <FlatList
              data={pickerClothes}
              keyExtractor={(item) => item.id}
              style={styles.modalList}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>Bu kategoride eklenecek kıyafet yok.</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => handleAddItem(item)}>
                  {item.thumbnail_url ? (
                    <Image source={{ uri: item.thumbnail_url }} style={styles.modalItemImage} />
                  ) : (
                    <View style={[styles.modalItemImage, styles.itemImagePlaceholder]}>
                      <Ionicons name="shirt" size={20} color={COLORS.textLight} />
                    </View>
                  )}
                  <View style={styles.modalItemInfo}>
                    <Text style={styles.modalItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.modalItemMeta}>
                      {CATEGORIES[item.category]?.label || item.category} · {item.color}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
  itemSwapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  removedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.info + '10',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    gap: 6,
  },
  removedNoticeText: { fontSize: 12, color: COLORS.info, flex: 1 },
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
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '40',
    borderStyle: 'dashed',
    borderRadius: 12,
    marginTop: 4,
    gap: 6,
  },
  addItemText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalCategoryScroll: { paddingHorizontal: 16, paddingVertical: 12 },
  modalCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  modalCategoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modalCategoryEmoji: { fontSize: 14, marginRight: 4 },
  modalCategoryLabel: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  modalCategoryLabelActive: { color: COLORS.textWhite },
  modalList: { paddingHorizontal: 16 },
  modalEmpty: { textAlign: 'center', color: COLORS.textLight, marginTop: 40, fontSize: 14 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  modalItemImage: { width: 48, height: 48, borderRadius: 10, marginRight: 12 },
  modalItemInfo: { flex: 1 },
  modalItemName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  modalItemMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
});
