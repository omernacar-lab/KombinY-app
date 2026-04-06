export const COLORS = {
  primary: '#6C63FF',
  primaryDark: '#5A52D5',
  primaryLight: '#8B85FF',
  secondary: '#FF6B6B',
  accent: '#4ECDC4',
  
  background: '#F8F9FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  textWhite: '#FFFFFF',
  
  border: '#E5E7EB',
  divider: '#F3F4F6',
  
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // Kıyafet durumu renkleri
  statusClean: '#10B981',
  statusDirty: '#EF4444',
  statusIroning: '#F59E0B',
  statusRepair: '#8B5CF6',
  statusDryCleaning: '#3B82F6',
};

export const FONTS = {
  regular: { fontSize: 14, color: COLORS.text },
  medium: { fontSize: 16, fontWeight: '500', color: COLORS.text },
  bold: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  caption: { fontSize: 12, color: COLORS.textSecondary },
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
};

export const CATEGORIES = {
  ust_giyim: { label: 'Üst Giyim', icon: 'shirt-outline', emoji: '👕' },
  alt_giyim: { label: 'Alt Giyim', icon: 'body-outline', emoji: '👖' },
  dis_giyim: { label: 'Dış Giyim', icon: 'cloudy-outline', emoji: '🧥' },
  elbise: { label: 'Elbise', icon: 'woman-outline', emoji: '👗' },
  ayakkabi: { label: 'Ayakkabı', icon: 'footsteps-outline', emoji: '👟' },
  aksesuar: { label: 'Aksesuar', icon: 'glasses-outline', emoji: '💍' },
  canta: { label: 'Çanta', icon: 'bag-outline', emoji: '👜' },
  ic_giyim: { label: 'İç Giyim', icon: 'layers-outline', emoji: '🩱' },
};

export const STATUS_MAP = {
  temiz: { label: 'Temiz', color: COLORS.statusClean, icon: 'checkmark-circle', emoji: '✅' },
  kirli: { label: 'Kirli', color: COLORS.statusDirty, icon: 'close-circle', emoji: '🧺' },
  utusuz: { label: 'Ütüsüz', color: COLORS.statusIroning, icon: 'flame', emoji: '🔥' },
  tamir_gerekli: { label: 'Tamir Gerekli', color: COLORS.statusRepair, icon: 'construct', emoji: '🪡' },
  kuru_temizleme: { label: 'Kuru Temizleme', color: COLORS.statusDryCleaning, icon: 'water', emoji: '💧' },
};

export const OCCASIONS = [
  { value: 'gunluk', label: 'Günlük', emoji: '🏠' },
  { value: 'is', label: 'İş', emoji: '💼' },
  { value: 'ozel', label: 'Özel Gün', emoji: '🎉' },
  { value: 'spor', label: 'Spor', emoji: '🏃' },
  { value: 'gece', label: 'Gece', emoji: '🌙' },
];

// API_URL artık gerekli değil — tüm istekler Supabase client veya Edge Functions üzerinden gidiyor
