import { View, StyleSheet, Image } from 'react-native';
import Text from './Text';
import { colors } from '../constants/theme';
import { UserProfile } from '../types/models';
import { findSpecies, getSpeciesProgress } from '../services/characterService';

interface Props {
  profile: Pick<UserProfile, 'nickname' | 'photoURL' | 'avatarType' | 'characterSpeciesId' | 'characterStageOverride' | 'writingCount'>;
  size?: number;
}

// 프로필 사진(Storage) 없이도 쓸 수 있는 세 가지 표시 방식.
// photoURL이 있으면(추후 Storage를 켜는 경우 대비) 그게 항상 우선한다.
export default function Avatar({ profile, size = 56 }: Props) {
  const circleStyle = { width: size, height: size, borderRadius: size / 2 };

  if (profile.photoURL) {
    return <Image source={{ uri: profile.photoURL }} style={circleStyle} />;
  }

  const avatarType = profile.avatarType ?? 'name';

  if (avatarType === 'pet') {
    const species = findSpecies(profile.characterSpeciesId);
    if (species) {
      const progress = getSpeciesProgress(profile, species);
      if (progress.stage.sprite) {
        return (
          <View style={[styles.petFrame, circleStyle]}>
            <Image source={progress.stage.sprite} style={{ width: size * 0.8, height: size * 0.8 }} resizeMode="contain" />
          </View>
        );
      }
      return (
        <View style={[styles.petFrame, circleStyle]}>
          <Text style={{ fontSize: size * 0.5 }}>{progress.stage.emoji}</Text>
        </View>
      );
    }
    // 아직 알을 고르지 않았다면 이름 아바타로 자연스럽게 대체된다.
  }

  if (avatarType === 'default') {
    return (
      <View style={[styles.defaultFrame, circleStyle]}>
        <Text style={{ fontSize: size * 0.5 }}>👤</Text>
      </View>
    );
  }

  return (
    <View style={[styles.nameFrame, circleStyle]}>
      <Text style={[styles.nameInitial, { fontSize: size * 0.38 }]}>{profile.nickname.charAt(0)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  petFrame: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  defaultFrame: { backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  nameFrame: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  nameInitial: { fontWeight: '800', color: colors.primary },
});
