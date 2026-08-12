import React from 'react';
import { TextInput as RNTextInput, TextInputProps } from 'react-native';
import { fonts } from '../constants/theme';

export default function TextInput({ style, ...props }: TextInputProps) {
  return <RNTextInput {...props} style={[{ fontFamily: fonts.regular }, style]} />;
}
