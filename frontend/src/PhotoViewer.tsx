import React from 'react';
import { Modal, View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Icon } from './Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPO } from './theme';

export type PhotoItem = {
  id: string;
  image_base64?: string;
  caption?: string;
  photo_type?: string;
  worker?: { name?: string } | null;
  worker_name?: string;
  taken_at?: string;
};

export function PhotoViewer({
  visible, photo, onClose,
}: { visible: boolean; photo: PhotoItem | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get('window');
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.bg}>
        <TouchableOpacity onPress={onClose} style={[styles.close, { top: insets.top + 12 }]} testID="close-photo">
          <Icon name="close" size={28} color={COLORS.surface} />
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          {photo?.image_base64 ? (
            <Image source={{ uri: photo.image_base64 }} style={{ width, height: height * 0.7 }} resizeMode="contain" />
          ) : (
            <View style={{ alignItems: 'center', justifyContent: 'center', height: height * 0.7 }}>
              <Icon name="image-outline" size={64} color={COLORS.textTertiary} />
            </View>
          )}
        </ScrollView>
        <View style={[styles.info, { paddingBottom: insets.bottom + 16 }]}>
          {photo?.caption ? <Text style={[TYPO.h3, { color: COLORS.surface }]}>{photo.caption}</Text> : null}
          <Text style={{ color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
            {photo?.photo_type || ''}{photo?.worker?.name || photo?.worker_name ? ` · ${photo.worker?.name || photo.worker_name}` : ''}
            {photo?.taken_at ? ` · ${new Date(photo.taken_at).toLocaleDateString('es-ES')}` : ''}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#000' },
  close: { position: 'absolute', right: 16, zIndex: 2, padding: 8 },
  info: { padding: SPACING.lg, backgroundColor: 'rgba(0,0,0,0.85)' },
});
