import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/Icon';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { COLORS, SPACING, TYPO, PHOTO_TYPES } from '../../src/theme';
import { Button, HeaderBar, Skeleton } from '../../src/ui';
import { api, apiError } from '../../src/api';

export default function PhotoCapture() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const [projects, setProjects] = useState<any[] | null>(null);
  const [projectId, setProjectId] = useState<string>(params.projectId || '');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [photoType, setPhotoType] = useState<typeof PHOTO_TYPES[number]['key']>('PROGRESS');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get('/projects').then((r) => {
      setProjects(r.data);
      if (!projectId && r.data?.length) setProjectId(r.data[0].id);
    });
  }, []);

  const pickImage = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permiso', 'Concede permiso para continuar.'); return; }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const manipulated = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    setImageUri(manipulated.uri);
    setImageBase64(`data:image/jpeg;base64,${manipulated.base64}`);
  };

  const submit = async () => {
    if (!projectId) { Alert.alert('Falta obra', 'Selecciona una obra.'); return; }
    if (!imageBase64) { Alert.alert('Falta foto', 'Selecciona o captura una foto.'); return; }
    setUploading(true);
    try {
      await api.post('/photos', { project_id: projectId, image_base64: imageBase64, caption, photo_type: photoType });
      router.back();
    } catch (e) { Alert.alert('Error', apiError(e)); }
    finally { setUploading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
      <HeaderBar title="Subir foto" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 32 }}>
        <Text style={[TYPO.caption, { marginBottom: 8 }]}>OBRA</Text>
        {projects === null ? <Skeleton height={48} /> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {projects.map((p) => (
              <TouchableOpacity key={p.id} onPress={() => setProjectId(p.id)} style={[styles.chip, projectId === p.id && styles.chipActive]}>
                <Text style={{ color: projectId === p.id ? COLORS.surface : COLORS.textPrimary, fontWeight: '600' }} numberOfLines={1}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: 8 }]}>FOTOGRAFÍA</Text>
        {imageUri ? (
          <View>
            <Image source={{ uri: imageUri }} style={styles.preview} />
            <TouchableOpacity onPress={() => { setImageUri(null); setImageBase64(null); }} style={styles.removeBtn}>
              <Icon name="trash-outline" size={18} color={COLORS.danger} />
              <Text style={{ color: COLORS.danger, marginLeft: 6, fontWeight: '600' }}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button title="Cámara" icon="camera-outline" onPress={() => pickImage(true)} testID="open-camera" /></View>
            <View style={{ flex: 1 }}><Button title="Galería" variant="secondary" icon="images-outline" onPress={() => pickImage(false)} testID="open-gallery" /></View>
          </View>
        )}

        <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: 8 }]}>TIPO</Text>
        <View style={styles.typeGrid}>
          {PHOTO_TYPES.map((pt) => (
            <TouchableOpacity key={pt.key} onPress={() => setPhotoType(pt.key)} style={[styles.typeBtn, photoType === pt.key && styles.typeBtnActive]}>
              <Text style={{ color: photoType === pt.key ? COLORS.surface : COLORS.textPrimary, fontWeight: '600' }}>{pt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[TYPO.caption, { marginTop: SPACING.xl, marginBottom: 8 }]}>DESCRIPCIÓN</Text>
        <TextInput
          value={caption} onChangeText={setCaption} placeholder="Pie de foto (opcional)"
          placeholderTextColor={COLORS.textTertiary}
          style={styles.input}
        />

        <View style={{ marginTop: SPACING.xl }}>
          <Button title="Subir foto" icon="cloud-upload-outline" loading={uploading} onPress={submit} testID="submit-photo" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, maxWidth: 220 },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  preview: { width: '100%', aspectRatio: 4/3, borderRadius: 4, backgroundColor: '#000' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 8, padding: 8 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  input: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 4, paddingHorizontal: 14, height: 48, fontSize: 15, color: COLORS.textPrimary },
});
