// src/pages/Popup/Popup.tsx
import React, { useEffect, useState } from 'react';
import { COLORS } from '@/constants/colors';
import { SPACING } from '@/constants/styles';
import { ReusableToggle } from '@/components/ui/Toggle/ReusableToggle';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { extractDomain } from '@/utils/domain';
import { DomainStatus } from '@/types/domain';
import brandNameImage from '@/assets/photos/brand-name.png';
import { ENV } from '@/config/env';

export const Popup: React.FC = () => {
  const [globalDisabled, setGlobalDisabled] = useState<boolean>(false);
  const [domainStatus, setDomainStatus] = useState<DomainStatus | null>(null);
  const [currentDomain, setCurrentDomain] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);

      // Get current tab URL
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tabs.length > 0 && tabs[0].url) {
        const domain = extractDomain(tabs[0].url);
        setCurrentDomain(domain);

        // Load settings
        const globalDisabledValue = await ChromeStorage.getGlobalDisabled();
        const domainStatusValue = await ChromeStorage.getDomainStatus(domain);

        setGlobalDisabled(globalDisabledValue);
        setDomainStatus(domainStatusValue);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalToggle = async (checked: boolean) => {
    try {
      await ChromeStorage.setGlobalDisabled(!checked); // Inverted: checked = enabled
      setGlobalDisabled(!checked);
    } catch (error) {
      console.error('Error updating global setting:', error);
    }
  };

  const handleDomainToggle = async (checked: boolean) => {
    if (!currentDomain) return;

    try {
      const newStatus = checked ? DomainStatus.ENABLED : DomainStatus.DISABLED;
      await ChromeStorage.setDomainStatus(currentDomain, newStatus);
      setDomainStatus(newStatus);
    } catch (error) {
      console.error('Error updating domain setting:', error);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: COLORS.WHITE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: SPACING.XL,
        }}
      >
        <p style={{ color: COLORS.TEXT_SECONDARY }}>Loading...</p>
      </div>
    );
  }

  const handleGlobeClick = () => {
    chrome.tabs.create({ url: ENV.XPLAINO_WEBSITE_BASE_URL });
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.WHITE,
        display: 'flex',
        flexDirection: 'column',
        padding: SPACING.XL,
        gap: SPACING.MD,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Brand Image - Clickable */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          flexShrink: 0,
          marginTop: SPACING.MD,
          marginBottom: SPACING.SM,
        }}
      >
        <img
          src={brandNameImage}
          alt="Brand Name"
          onClick={handleGlobeClick}
          className="brand-logo"
          style={{
            maxWidth: '200px',
            height: 'auto',
            objectFit: 'contain',
            cursor: 'pointer',
            transition: 'transform 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        />
      </div>

      {/* Global Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.MD }}>
        <ReusableToggle
          checked={!globalDisabled}
          onChange={handleGlobalToggle}
        />
        <span
          style={{
            color: COLORS.TEXT_PRIMARY,
            fontSize: '15px',
            fontWeight: 600,
          }}
        >
          Enable globally
        </span>
      </div>

      {/* Domain Settings - Only show if extension is globally enabled and domain is not INVALID */}
      {currentDomain && !globalDisabled && domainStatus !== DomainStatus.INVALID && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING.SM,
          }}
        >
          {domainStatus === DomainStatus.BANNED ? (
            <p
              style={{
                color: COLORS.ERROR,
                fontSize: '14px',
                margin: 0,
                padding: SPACING.SM,
                backgroundColor: COLORS.ERROR_LIGHT,
                borderRadius: '12px',
                boxSizing: 'border-box',
                width: '100%',
                wordBreak: 'break-word',
              }}
            >
              Extension does not support{' '}
              <span
                style={{
                  color: COLORS.PRIMARY,
                  fontStyle: 'italic',
                  fontWeight: 700,
                }}
              >
                {currentDomain}
              </span>
            </p>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.MD,
              }}
            >
              <ReusableToggle
                checked={domainStatus === null || domainStatus === DomainStatus.ENABLED}
                onChange={handleDomainToggle}
              />
              <span
                style={{
                  color: COLORS.TEXT_PRIMARY,
                  fontSize: '15px',
                  fontWeight: 600,
                }}
              >
                Enable on{' '}
                <span
                  style={{
                    color: COLORS.PRIMARY,
                    fontStyle: 'italic',
                  }}
                >
                  {currentDomain}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Visit Website Link - Bottom Right */}
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          handleGlobeClick();
        }}
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          color: COLORS.PRIMARY,
          fontSize: '13px',
          fontWeight: 600,
          fontStyle: 'italic',
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        Visit website
      </a>
    </div>
  );
};

Popup.displayName = 'Popup';

