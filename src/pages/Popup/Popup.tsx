// src/pages/Popup/Popup.tsx
import React from 'react';
import { Sparkles } from 'lucide-react';
import { COLORS } from '@/constants/colors';
import { BORDER_RADIUS, SHADOW } from '@/constants/styles';

export const Popup: React.FC = () => {
  return (
    <div
      style={{
        width: '400px',
        minHeight: '500px',
        backgroundColor: COLORS.BACKGROUND_SECONDARY,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          backgroundColor: COLORS.BACKGROUND_PRIMARY,
          borderRadius: BORDER_RADIUS.LARGE,
          padding: '48px',
          boxShadow: SHADOW.LG,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: BORDER_RADIUS.ROUND,
            backgroundColor: COLORS.PRIMARY_LIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles size={32} color={COLORS.PRIMARY} />
        </div>

        <h1
          style={{
            color: COLORS.PRIMARY,
            fontSize: '28px',
            fontWeight: 700,
            margin: 0,
          }}
        >
          Hello World
        </h1>

        <p
          style={{
            color: COLORS.TEXT_SECONDARY,
            fontSize: '16px',
            margin: 0,
          }}
        >
          Welcome to Xplaino AI
        </p>
      </div>
    </div>
  );
};

Popup.displayName = 'Popup';

