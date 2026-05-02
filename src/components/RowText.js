// src/components/RowText.js
// iOS RTL fix: <Text style={{flex:1}}> inside a row ignores textAlign on iOS.
// Use <RowText> instead of <View style={{flex:1}}><Text>...</Text></View>.
import { Text, View } from 'react-native';

export default function RowText({ style, children, ...props }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={style} {...props}>{children}</Text>
    </View>
  );
}
