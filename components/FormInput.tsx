import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native';

interface FormInputProps extends TextInputProps {
  label?: string;
  required?: boolean;
  /** Shown in red under the field; also turns the border red */
  error?: string;
  /** Taller box for notes and descriptions */
  multilineHeight?: number;
}

// The one text field used on every form: uppercase label, 1.5px border, 12 radius, 15pt text
export function FormInput({ label, required, error, multilineHeight, style, ...inputProps }: FormInputProps) {
  const multiline = !!inputProps.multiline;
  return (
    <View style={styles.field}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {required ? <Text style={styles.required}>*</Text> : null}
        </View>
      ) : null}
      <TextInput
        placeholderTextColor={'#94A3B8'}
        textAlignVertical={multiline ? 'top' : undefined}
        {...inputProps}
        style={[styles.input, multiline && { height: multilineHeight ?? 100 }, !!error && styles.inputError, style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.3 },
  required: { fontSize: 16, color: '#EF4444', fontWeight: '700', lineHeight: 16 },
  input: { borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 15, backgroundColor: '#fff', color: '#1E293B' },
  inputError: { borderColor: '#EF4444' },
  error: { fontSize: 12, color: '#EF4444', marginTop: 6 },
});
