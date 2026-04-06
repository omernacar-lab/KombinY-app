import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, CATEGORIES, STATUS_MAP } from '../../constants/theme';
import { useAuthStore, useWardrobeStore } from '../../store';
import { userAPI } from '../../services/api';

// ==================== PROFIL DUZENLE MODAL ====================
function EditProfileModal({ visible, onClose, user, onSave }) {
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [city, setCity] = useState(user?.city || 'Istanbul');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setFullName(user?.full_name || '');
      setCity(user?.city || 'Istanbul');
    }
  }, [visible, user]);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Hata', 'Ad soyad boş bırakılamaz');
      return;
    }
    setSaving(true);
    try {
      await onSave({ full_name: fullName.trim(), city: city.trim() });
      Alert.alert('Başarılı', 'Profil güncellendi');
      onClose();
    } catch {
      Alert.alert('Hata', 'Profil güncellenirken bir sorun oluştu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Profili Düzenle</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <Text style={modalStyles.label}>Ad Soyad</Text>
          <TextInput
            style={modalStyles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Adınız Soyadınız"
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={modalStyles.label}>Şehir</Text>
          <TextInput
            style={modalStyles.input}
            value={city}
            onChangeText={setCity}
            placeholder="Şehriniz"
            placeholderTextColor={COLORS.textLight}
          />

          <TouchableOpacity
            style={[modalStyles.saveButton, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.textWhite} />
            ) : (
              <Text style={modalStyles.saveButtonText}>Kaydet</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ==================== ISTATISTIKLER MODAL ====================
function StatsModal({ visible, onClose, stats }) {
  if (!stats) return null;

  const categoryEntries = Object.entries(stats.by_category || {});
  const colorEntries = Object.entries(stats.by_color || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const statusEntries = Object.entries(stats.by_status || {});

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.container, { maxHeight: '85%' }]}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Gardırop İstatistikleri</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Genel */}
            <View style={statsStyles.section}>
              <Text style={statsStyles.sectionTitle}>Genel</Text>
              <View style={statsStyles.row}>
                <StatBox label="Toplam" value={stats.total} color={COLORS.primary} />
                <StatBox label="Favori" value={stats.favorites} color={COLORS.warning} />
                <StatBox label="Hiç Giyilmemiş" value={stats.never_worn} color={COLORS.error} />
              </View>
            </View>

            {/* Kategoriler */}
            <View style={statsStyles.section}>
              <Text style={statsStyles.sectionTitle}>Kategoriler</Text>
              {categoryEntries.map(([cat, count]) => (
                <View key={cat} style={statsStyles.barRow}>
                  <Text style={statsStyles.barLabel}>
                    {CATEGORIES[cat]?.emoji} {CATEGORIES[cat]?.label || cat}
                  </Text>
                  <View style={statsStyles.barContainer}>
                    <View
                      style={[
                        statsStyles.bar,
                        { width: `${(count / stats.total) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={statsStyles.barValue}>{count}</Text>
                </View>
              ))}
            </View>

            {/* Durum */}
            <View style={statsStyles.section}>
              <Text style={statsStyles.sectionTitle}>Durum</Text>
              {statusEntries.map(([status, count]) => (
                <View key={status} style={statsStyles.barRow}>
                  <Text style={statsStyles.barLabel}>
                    {STATUS_MAP[status]?.emoji} {STATUS_MAP[status]?.label || status}
                  </Text>
                  <View style={statsStyles.barContainer}>
                    <View
                      style={[
                        statsStyles.bar,
                        {
                          width: `${(count / stats.total) * 100}%`,
                          backgroundColor: STATUS_MAP[status]?.color || COLORS.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={statsStyles.barValue}>{count}</Text>
                </View>
              ))}
            </View>

            {/* Renkler */}
            <View style={statsStyles.section}>
              <Text style={statsStyles.sectionTitle}>En Çok Renk</Text>
              {colorEntries.map(([color, count]) => (
                <View key={color} style={statsStyles.barRow}>
                  <Text style={statsStyles.barLabel}>{color}</Text>
                  <View style={statsStyles.barContainer}>
                    <View
                      style={[
                        statsStyles.bar,
                        {
                          width: `${(count / stats.total) * 100}%`,
                          backgroundColor: COLORS.accent,
                        },
                      ]}
                    />
                  </View>
                  <Text style={statsStyles.barValue}>{count}</Text>
                </View>
              ))}
            </View>

            {/* En çok giyilen */}
            {stats.most_worn?.length > 0 && (
              <View style={statsStyles.section}>
                <Text style={statsStyles.sectionTitle}>En Çok Giyilen</Text>
                {stats.most_worn.map((item, i) => (
                  <View key={i} style={statsStyles.barRow}>
                    <Text style={statsStyles.barLabel} numberOfLines={1}>
                      {CATEGORIES[item.category]?.emoji} {item.name || item.category}
                    </Text>
                    <Text style={statsStyles.barValue}>{item.times_worn}x</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function StatBox({ label, value, color }) {
  return (
    <View style={statsStyles.statBox}>
      <Text style={[statsStyles.statValue, { color }]}>{value}</Text>
      <Text style={statsStyles.statLabel}>{label}</Text>
    </View>
  );
}

// ==================== ETKINLIKLER MODAL ====================
function EventsModal({ visible, onClose }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [occasion, setOccasion] = useState('ozel');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) loadEvents();
  }, [visible]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const { data } = await userAPI.getEvents();
      setEvents(data.events || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = async () => {
    if (!title.trim() || !eventDate.trim()) {
      Alert.alert('Hata', 'Başlık ve tarih gerekli (YYYY-MM-DD)');
      return;
    }
    setSaving(true);
    try {
      await userAPI.addEvent({
        title: title.trim(),
        eventDate: eventDate.trim(),
        occasion,
      });
      setTitle('');
      setEventDate('');
      setShowAdd(false);
      loadEvents();
    } catch {
      Alert.alert('Hata', 'Etkinlik eklenirken sorun oluştu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.container, { maxHeight: '80%' }]}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Etkinliklerim</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 30 }} />
          ) : events.length === 0 && !showAdd ? (
            <View style={{ alignItems: 'center', paddingVertical: 30 }}>
              <Ionicons name="calendar-outline" size={48} color={COLORS.textLight} />
              <Text style={{ color: COLORS.textSecondary, marginTop: 8 }}>
                Henüz etkinlik yok
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 300 }}>
              {events.map((evt) => (
                <View key={evt.id} style={evtStyles.card}>
                  <Ionicons name="calendar" size={20} color={COLORS.primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={evtStyles.title}>{evt.title}</Text>
                    <Text style={evtStyles.date}>{evt.event_date}</Text>
                  </View>
                  <Text style={evtStyles.occasion}>{evt.occasion}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {showAdd && (
            <View style={{ marginTop: 12 }}>
              <TextInput
                style={modalStyles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Etkinlik adı"
                placeholderTextColor={COLORS.textLight}
              />
              <TextInput
                style={modalStyles.input}
                value={eventDate}
                onChangeText={setEventDate}
                placeholder="Tarih (YYYY-MM-DD)"
                placeholderTextColor={COLORS.textLight}
              />
              <TouchableOpacity
                style={[modalStyles.saveButton, saving && { opacity: 0.6 }]}
                onPress={handleAddEvent}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.textWhite} />
                ) : (
                  <Text style={modalStyles.saveButtonText}>Etkinlik Ekle</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {!showAdd && (
            <TouchableOpacity
              style={[modalStyles.saveButton, { marginTop: 12 }]}
              onPress={() => setShowAdd(true)}
            >
              <Ionicons name="add" size={20} color={COLORS.textWhite} />
              <Text style={modalStyles.saveButtonText}>Yeni Etkinlik</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ==================== ANA EKRAN ====================
export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuthStore();
  const { stats, clothes, fetchClothes, fetchStats, bulkWash } = useWardrobeStore();

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [eventsModalVisible, setEventsModalVisible] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleLogout = () => {
    Alert.alert('Çıkış', 'Çıkış yapmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: logout },
    ]);
  };

  const handleSaveProfile = async (updates) => {
    const { data } = await userAPI.updateProfile(updates);
    updateUser(data.user);
  };

  const handleBulkWash = async () => {
    const dirtyClothes = clothes.filter(
      (c) => c.status === 'kirli' || c.status === 'utusuz'
    );
    if (dirtyClothes.length === 0) {
      Alert.alert('Zaten Temiz!', 'Kirli veya ütüsüz kıyafet bulunmuyor.');
      return;
    }
    Alert.alert(
      'Çamaşır Yıkandı! 🧺',
      `${dirtyClothes.length} kirli/ütüsüz kıyafet temiz olarak işaretlensin mi?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet, Temiz!',
          onPress: async () => {
            try {
              const ids = dirtyClothes.map((c) => c.id);
              await bulkWash(ids);
              Alert.alert('Harika! ✨', `${dirtyClothes.length} kıyafet temiz olarak güncellendi`);
            } catch {
              Alert.alert('Hata', 'Güncelleme sırasında bir sorun oluştu');
            }
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      icon: 'person-circle',
      title: 'Profili Düzenle',
      subtitle: 'İsim, şehir, stil tercihleri',
      action: () => setEditModalVisible(true),
    },
    {
      icon: 'notifications',
      title: 'Bildirimler',
      subtitle: 'Sabah kombin hatırlatması',
      action: () => Alert.alert('Yakında!', 'Bildirim ayarları yakında eklenecek.'),
    },
    {
      icon: 'calendar',
      title: 'Etkinliklerim',
      subtitle: 'Özel günler için kombin planla',
      action: () => setEventsModalVisible(true),
    },
    {
      icon: 'bar-chart',
      title: 'Gardırop İstatistikleri',
      subtitle: 'Giyim alışkanlıkların',
      action: () => {
        fetchStats();
        setStatsModalVisible(true);
      },
    },
    {
      icon: 'water',
      title: 'Çamaşır Yıkandı!',
      subtitle: 'Tüm kirli kıyafetleri temiz yap',
      color: COLORS.info,
      action: () => {
        if (clothes.length === 0) {
          fetchClothes().then(() => handleBulkWash());
        } else {
          handleBulkWash();
        }
      },
    },
    {
      icon: 'diamond',
      title: "Premium'a Geç",
      subtitle: 'Sınırsız kombin, gelişmiş özellikler',
      color: COLORS.warning,
      action: () => Alert.alert('Yakında!', 'Premium üyelik yakında aktif olacak.'),
    },
    {
      icon: 'help-circle',
      title: 'Yardım & Destek',
      subtitle: 'SSS, iletişim',
      action: () =>
        Alert.alert(
          'Yardım & Destek',
          'Sorularınız için:\nkombin.app@gmail.com\n\nVersiyon: 1.0.0'
        ),
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profil Kartı */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.full_name?.charAt(0)?.toUpperCase() ||
                user?.user_metadata?.full_name?.charAt(0)?.toUpperCase() ||
                '?'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {user?.full_name || user?.user_metadata?.full_name || 'Kullanıcı'}
            </Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            {user?.is_premium && (
              <View style={styles.premiumBadge}>
                <Ionicons name="diamond" size={12} color={COLORS.warning} />
                <Text style={styles.premiumText}>Premium</Text>
              </View>
            )}
          </View>
        </View>

        {/* Hızlı İstatistikler */}
        {stats && (
          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatNumber}>{stats.total}</Text>
              <Text style={styles.quickStatLabel}>Kıyafet</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatNumber}>{stats.favorites}</Text>
              <Text style={styles.quickStatLabel}>Favori</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatNumber}>
                {Object.keys(stats.by_category || {}).length}
              </Text>
              <Text style={styles.quickStatLabel}>Kategori</Text>
            </View>
          </View>
        )}

        {/* Menü */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={index} style={styles.menuItem} onPress={item.action}>
              <Ionicons name={item.icon} size={24} color={item.color || COLORS.primary} />
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Çıkış */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Kombin v1.0.0</Text>
      </ScrollView>

      {/* Modals */}
      <EditProfileModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        user={user}
        onSave={handleSaveProfile}
      />
      <StatsModal
        visible={statsModalVisible}
        onClose={() => setStatsModalVisible(false)}
        stats={stats}
      />
      <EventsModal
        visible={eventsModalVisible}
        onClose={() => setEventsModalVisible(false)}
      />
    </View>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 40 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.medium,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: { fontSize: 26, fontWeight: '800', color: COLORS.textWhite },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  profileEmail: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '20',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 6,
    gap: 4,
  },
  premiumText: { fontSize: 12, fontWeight: '700', color: COLORS.warning },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    ...SHADOWS.small,
  },
  quickStatItem: { flex: 1, alignItems: 'center' },
  quickStatNumber: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  quickStatLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  quickStatDivider: { width: 1, backgroundColor: COLORS.divider },
  menuSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
    ...SHADOWS.small,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: 14,
  },
  menuInfo: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  menuSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error + '10',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: COLORS.error },
  version: { textAlign: 'center', fontSize: 12, color: COLORS.textLight, marginTop: 20 },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  saveButtonText: { color: COLORS.textWhite, fontSize: 16, fontWeight: '700' },
});

const statsStyles = StyleSheet.create({
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  barLabel: { width: 100, fontSize: 13, color: COLORS.text },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  barValue: { width: 30, fontSize: 13, fontWeight: '600', color: COLORS.text, textAlign: 'right' },
});

const evtStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  title: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  date: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  occasion: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
});
