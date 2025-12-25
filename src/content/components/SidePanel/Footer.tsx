// src/content/components/SidePanel/Footer.tsx
import React from 'react';
import { FileText, Settings, User } from 'lucide-react';
import styles from './Footer.module.css';
import { ButtonGroup, ButtonItem } from '@/components/ui/ButtonGroup';

export type TabType = 'summary' | 'settings' | 'my';

export interface FooterProps {
  /** Active tab */
  activeTab: TabType;
  /** Tab change handler */
  onTabChange: (tab: TabType) => void;
  /** Whether component is rendered in Shadow DOM (uses plain class names) */
  useShadowDom?: boolean;
}

const buttons: ButtonItem[] = [
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'summary', icon: FileText, label: 'Page Summary' },
  { id: 'my', icon: User, label: 'My' },
];

export const Footer: React.FC<FooterProps> = ({ activeTab, onTabChange, useShadowDom = false }) => {
  const getClassName = (baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    const styleClass = styles[baseClass as keyof typeof styles];
    return styleClass || baseClass;
  };

  const handleButtonChange = (buttonId: string) => {
    // Type guard to ensure buttonId is a valid TabType
    if (buttonId === 'summary' || buttonId === 'settings' || buttonId === 'my') {
      onTabChange(buttonId);
    }
  };

  return (
    <div className={getClassName('footer')}>
      <ButtonGroup
        buttons={buttons}
        activeButtonId={activeTab}
        onButtonChange={handleButtonChange}
        useShadowDom={useShadowDom}
        iconSize={20}
        strokeWidth={2.5}
        gap={12}
      />
    </div>
  );
};

Footer.displayName = 'Footer';
