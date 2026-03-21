import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, CATEGORIES, STATUS_MAP } from '../../constants/theme';
import { useWardrobeStore } from '../../store';

export default function WardrobeScreen() {
  const {
    clothes,
    isLoading,
    selectedCategory,
    fetchClothes,
    updateStatus,
    setCategory,
    fetchStats,
    stats,
  } = useWardrobeStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchClothes(selectedCategory ? { category: selectedCategory } : undefined);
    fetchStats();
  }, [selectedCategory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchClothes(selectedCategory ? { category: selectedCategory } : undefined);
    setRefreshing(false);
  }, [selectedCategory]);

  const handleStatusChange = (item) => {
    const statusOptions = Object.entries(STATUS_MAP).map(([key, val]) => ({
      text: `${val.emoji} ${val.label}`,
      onPress: () => updateStatus(item.id, key),
    }));

    Alert.alert(`${item.name} - Durum Değiştir`, 'Yeni durumu seçin:', [
      ...statusOptions,
      { text: 'İptal', style: 'cancel' },
    ]);
  };

  const renderClothingItem = ({ item }) => {
    const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.temiz;

    return (
      <TouchableOpacity style={styles.clothingCard} onPress={() => handleStatusChange(item)}>
        {item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} style={styles.clothingImage} />
        ) : (
          <View style={[styles.clothingImage, styles.imagePlaceholder]}>
            <Ionicons name="shirt" size={30} color={COLORS.textLight} />
          </View>
        )}

        <View style={styles.clothingInfo}>
          <Text style={styles.clothingName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.clothingColor}>{item.color}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.emoji} {statusInfo.label}
          </Text>
        </View>

        {item.is_favorite && (
          <Ionicons
            name="heart"
            size={16}
            color={COLORS.secondary}
            style={styles.favoriteIcon}
          />
        )}
      </TouchableOpacity>
    );
  };

  const categoryList = [{ key: null, label: 'Tümü', emoji: '👔' }, ...Object.entries(CATEGORIES).map(
    ([key, val]) => ({ key, label: val.label, emoji: val.emoji })
  )];

  return (
    <View style={styles.container}>
      {/* İstatistik Özet */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Toplam</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: COLORS.success }]}>
              {stats.by_status?.temiz || 0}
            </Text>
            <Text style={styles.statLabel}>Temiz</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: COLORS.error }]}>
              {stats.by_status?.kirli || 0}
            </Text>
            <Text style={styles.statLabel}>Kirli</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: COLORS.warning }]}>
              {stats.never_worn || 0}
            </Text>
            <Text style={styles.statLabel}>Hiç Giyilmedi</Text>
          </View>
        </View>
      )}

      {/* Kategori Filtreleri */}
      <FlatList
        data={categoryList}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => String(item.key)}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === item.key && styles.categoryChipActive]}
            onPress={() => setCategory(item.key)}
          >
            <Text style={styles.categoryEmoji}>{item.emoji}</Text>
            <Text
              style={[
                styles.categoryLabel,
                selectedCategory === item.key && styles.categoryLabelActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Kıyafet Listesi */}
      <FlatList
        data={clothes}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.clothesList}
        columnWrapperStyle={styles.row}
        renderItem={renderClothingItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>👗</Text>
            <Text style={styles.emptyText}>Gardırobun boş!</Text>
            <Text style={styles.emptySubtext}>İlk kıyafetini ekleyerek başla</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.surface,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  categoryList: { paddingHorizontal: 16, paddingVertical: 12 },
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
  clothesList: { padding: 12 },
  row: { justifyContent: 'space-between' },
  clothingCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  clothingImage: { width: '100%', height: 160, resizeMode: 'cover' },
  imagePlaceholder: {
    backgroundColor: COLORS.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clothingInfo: { padding: 10 },
  clothingName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  clothingColor: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: {
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  favoriteIcon: { position: 'absolute', top: 10, right: 10 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  emptySubtext: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
});
