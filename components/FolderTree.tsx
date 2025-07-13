import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { FolderNode, VideoFile } from '../utils/videoScanner';

interface FolderTreeProps {
  node: FolderNode;
  onVideoPress: (video: VideoFile) => void;
  level?: number;
}

const FolderTree: React.FC<FolderTreeProps> = ({ node, onVideoPress, level = 0 }) => {
  const [expanded, setExpanded] = useState(level === 0); // Root expanded by default

  return (
    <View style={{ marginLeft: level * 16 }}>
      <TouchableOpacity onPress={() => setExpanded(e => !e)} disabled={level === 0}>
        <Text style={{ fontWeight: 'bold', color: '#2a4d8f', fontSize: 16 - level }}>
          {level > 0 ? (expanded ? '▼ ' : '▶ ') : ''}{node.name}
        </Text>
      </TouchableOpacity>
      {expanded && node.children.map((child, idx) => {
        if (child.isFile) {
          return (
            <TouchableOpacity key={child.path} onPress={() => onVideoPress(child)}>
              <Text style={{ marginLeft: 16, color: '#333', fontSize: 14 }}>{child.name}</Text>
            </TouchableOpacity>
          );
        } else {
          return (
            <FolderTree key={child.path} node={child} onVideoPress={onVideoPress} level={level + 1} />
          );
        }
      })}
    </View>
  );
};

export default FolderTree; 