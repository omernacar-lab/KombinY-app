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
  Modal,
  TextInput,
  ScrollView,
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
    updateClothing,
    deleteClothing,
    setCategory,
    fetchStats,
    stats,
  } = useWardrobeStore();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    fetchClothes(selectedCategory ? { category: selectedCategory } : undefined);
    fetchStats();
  }, [selectedCategory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchClothes(selectedCategory ? { category: selectedCategory } : undefined);
    await fetchStats();
    setRefreshing(false);
  }, [selectedCategory]);

  const openDetail = (item) => {
    setSelectedItem(item);
    setEditData({
      name: item.name,
      category: item.category,
      subcategory: item.subcategory,
      color: item.color,
      brand: item.brand || '',
    });
    setEditMode(false);
  };

  const closeDetail = () => {
    setSelectedItem(null);
    setEditMode(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Kıyafeti Sil',
      `"${selectedItem.name}" gardırobundan silinecek. Emin misin?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteClothing(selectedItem.id);
              closeDetail();
              fetchStats();
            } catch {
              Alert.alert('Hata', 'Silme işlemi başarısız');
            }
          },
        },
      ]
    );
  };

  const handleSaveEdit = async () => {
    try {
      await updateClothing(selectedItem.id, editData);
      setSelectedItem({ ...selectedItem, ...editData });
      setEditMode(false);
      fetchStats();
    } catch {
      Alert.alert('Hata', 'Güncelleme başarısız');
    }
  };

  const handleStatusChange = (status) => {
    updateStatus(selectedItem.id, status);
    setSelectedItem({ ...selectedItem, status });
  };

  const renderClothingItem = ({ item }) => {
    const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.temiz;

    return (
      <TouchableOpacity style={styles.clothingCard} onPress={() => openDetail(item)}>
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

      {/* Kıyafet Detay / Düzenleme Modal */}
      <Modal visible={!!selectedItem} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedItem && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Üst Bar */}
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={closeDetail}>
                    <Ionicons name="close" size={26} color={COLORS.text} />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>
                    {editMode ? 'Düzenle' : 'Kıyafet Detayı'}
                  </Text>
                  <View style={styles.modalActions}>
                    {!editMode ? (
                      <>
                        <TouchableOpacity onPress={() => setEditMode(true)} style={styles.headerBtn}>
                          <Ionicons name="pencil" size={20} color={COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleDelete} style={styles.headerBtn}>
                          <Ionicons name="trash" size={20} color={COLORS.error} />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity onPress={handleSaveEdit} style={styles.saveBtn}>
                        <Text style={styles.saveBtnText}>Kaydet</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Fotoğraf */}
                {selectedItem.image_url && (
                  <Image
                    source={{ uri: selectedItem.image_url }}
                    style={styles.detailImage}
                  />
                )}

                {editMode ? (
                  /* Düzenleme Formu */
                  <View style={styles.editForm}>
                    <Text style={styles.fieldLabel}>İsim</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editData.name}
                      onChangeText={(t) => setEditData({ ...editData, name: t })}
                    />

                    <Text style={styles.fieldLabel}>Kategori</Text>
                    <View style={styles.chipRow}>
                      {Object.entries(CATEGORIES).map(([key, val]) => (
                        <TouchableOpacity
                          key={key}
                          style={[styles.chip, editData.category === key && styles.chipActive]}
                          onPress={() => setEditData({ ...editData, category: key })}
                        >
                          <Text style={styles.chipEmoji}>{val.emoji}</Text>
                          <Text style={[styles.chipText, editData.category === key && styles.chipTextActive]}>
                            {val.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.fieldLabel}>Renk</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editData.color}
                      onChangeText={(t) => setEditData({ ...editData, color: t })}
                    />

                    <Text style={styles.fieldLabel}>Marka</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editData.brand}
                      onChangeText={(t) => setEditData({ ...editData, brand: t })}
                      placeholder="Opsiyonel"
                      placeholderTextColor={COLORS.textLight}
                    />
                  </View>
                ) : (
                  /* Detay Görünümü */
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailName}>{selectedItem.name}</Text>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Kategori</Text>
                      <Text style={styles.detailValue}>
                        {CATEGORIES[selectedItem.category]?.emoji} {CATEGORIES[selectedItem.category]?.label}
                      </Text>
                    </View>

                    {selectedItem.subcategory && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Alt Kategori</Text>
                        <Text style={styles.detailValue}>{selectedItem.subcategory}</Text>
                      </View>
                    )}

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Renk</Text>
                      <Text style={styles.detailValue}>{selectedItem.color}</Text>
                    </View>

                    {selectedItem.brand && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Marka</Text>
                        <Text style={styles.detailValue}>{selectedItem.brand}</Text>
                      </View>
                    )}

                    {selectedItem.fabric && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Kumaş</Text>
                        <Text style={styles.detailValue}>{selectedItem.fabric}</Text>
                      </View>
                    )}

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Giyilme</Text>
                      <Text style={styles.detailValue}>{selectedItem.times_worn || 0} kez</Text>
                    </View>

                    {/* Durum Değiştir */}
                    <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Durum</Text>
                    <View style={styles.statusRow}>
                      {Object.entries(STATUS_MAP).map(([key, val]) => (
                        <TouchableOpacity
                          key={key}
                          style={[
                            styles.statusOption,
                            selectedItem.status === key && { backgroundColor: val.color + '20', borderColor: val.color },
                          ]}
                          onPress={() => handleStatusChange(key)}
                        >
                          <Text style={styles.statusEmoji}>{val.emoji}</Text>
                          <Text style={[styles.statusLabel, selectedItem.status === key && { color: val.color }]}>
                            {val.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalActions: { flexDirection: 'row', gap: 12 },
  headerBtn: { padding: 4 },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  detailImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },

  // Detay
  detailInfo: { padding: 20 },
  detailName: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  detailLabel: { fontSize: 14, color: COLORS.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  // Durum
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  statusOption: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  statusEmoji: { fontSize: 18 },
  statusLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },

  // Edit Form
  editForm: { padding: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  editInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 12, color: COLORS.text },
  chipTextActive: { color: '#fff' },
});
