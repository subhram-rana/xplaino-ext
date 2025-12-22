// src/content/components/TextExplanationSidePanel/TextExplanationFooter.tsx
import React, { useState, useEffect } from 'react';
import { MessageSquare, Languages } from 'lucide-react';
import styles from './TextExplanationFooter.module.css';
import { ButtonGroup, ButtonItem } from '@/components/ui/ButtonGroup';

export type ViewType = 'contextual' | 'translation';

export interface TextExplanationFooterProps {
  /** Active view type */
  activeView?: ViewType;
  /** View change handler */
  onViewChange?: (view: ViewType) => void;
  /** Whether component is rendered in Shadow DOM (uses plain class names) */
  useShadowDom?: boolean;
}

const buttons: ButtonItem[] = [
  { id: 'contextual', icon: MessageSquare, label: 'Contextual' },
  { id: 'translation', icon: Languages, label: 'Translation' },
];

export const TextExplanationFooter: React.FC<TextExplanationFooterProps> = ({ 
  activeView = 'contextual',
  onViewChange,
  useShadowDom = false 
}) => {
  const [currentView, setCurrentView] = useState<ViewType>(activeView);

  // Update local state when prop changes
  useEffect(() => {
    setCurrentView(activeView);
  }, [activeView]);

  const getClassName = (baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    const styleClass = styles[baseClass as keyof typeof styles];
    return styleClass || baseClass;
  };

  const handleButtonChange = (buttonId: string) => {
    // Type guard to ensure buttonId is a valid ViewType
    if (buttonId === 'contextual' || buttonId === 'translation') {
      setCurrentView(buttonId);
      onViewChange?.(buttonId);
    }
  };

  return (
    <div className={getClassName('footer')}>
      <ButtonGroup
        buttons={buttons}
        activeButtonId={currentView}
        onButtonChange={handleButtonChange}
        useShadowDom={useShadowDom}
        iconSize={20}
        strokeWidth={2.5}
        gap={12}
      />
    </div>
  );
};

TextExplanationFooter.displayName = 'TextExplanationFooter';

