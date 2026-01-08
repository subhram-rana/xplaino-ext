// src/content/components/SidePanel/SettingsView.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { Settings, LayoutDashboard } from 'lucide-react';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { DomainStatus } from '@/types/domain';
import { extractDomain } from '@/utils/domain';
import { Dropdown } from './Dropdown';
import { showDisableModal } from '@/content/index';
import { ENV } from '@/config/env';
import styles from './SettingsView.module.css';

export interface SettingsViewProps {
  /** Whether to use Shadow DOM styling */
  useShadowDom?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ useShadowDom = false }) => {
  const getClassName = useCallback((baseClass: string) => {
    if (useShadowDom) {
      return baseClass;
    }
    return styles[baseClass as keyof typeof styles] || baseClass;
  }, [useShadowDom]);

  // Inline Toggle component for content script
  const Toggle: React.FC<{
    checked: boolean;
    onChange: (checked: boolean) => void;
  }> = ({ checked, onChange }) => {
    return (
      <div
        className={getClassName('toggleContainer')}
        onClick={() => onChange(!checked)}
      >
        <div className={`${getClassName('toggleTrack')} ${checked ? getClassName('checked') : ''}`}>
          <div className={`${getClassName('toggleThumb')} ${checked ? getClassName('thumbChecked') : ''}`} />
        </div>
      </div>
    );
  };

  const [themeSelection, setThemeSelection] = useState<'account' | 'LIGHT' | 'DARK'>('account');
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
      const domain = extractDomain(window.location.href);
      setCurrentDomain(domain);

      // Load extension settings and domain status
      const [extDomainTheme, gDisabled, dStatus] = await Promise.all([
        domain ? ChromeStorage.getUserExtensionDomainTheme(domain) : null,
        ChromeStorage.getGlobalDisabled(),
        domain ? ChromeStorage.getDomainStatus(domain) : null,
      ]);

      // Determine initial theme selection
      if (extDomainTheme) {
        setThemeSelection(extDomainTheme); // 'LIGHT' or 'DARK'
      } else {
        setThemeSelection('account'); // 'As per account settings'
      }

      setGlobalDisabled(gDisabled);
      if (dStatus) setDomainStatus(dStatus);
    } catch (error) {
      console.error('[SettingsView] Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = async (value: string) => {
    if (!currentDomain) {
      console.warn('[SettingsView] handleThemeChange called but currentDomain is not set');
      return;
    }

    try {
      if (value === 'account') {
        // Remove domain override - will use account settings
        await ChromeStorage.removeUserExtensionDomainTheme(currentDomain);
        setThemeSelection('account');
        console.log('[SettingsView] Removed domain theme override, using account settings');
      } else if (value === 'LIGHT' || value === 'DARK') {
        // Set domain-specific theme
        await ChromeStorage.setUserExtensionDomainTheme(currentDomain, value);
        setThemeSelection(value);
        console.log('[SettingsView] Set domain theme:', value, 'for domain:', currentDomain);
      }

      // Trigger theme change event to refresh UI
      window.dispatchEvent(new CustomEvent('theme-changed', { 
        detail: { type: 'extension', domain: currentDomain } 
      }));
    } catch (error) {
      console.error('[SettingsView] Error updating theme:', error);
    }
  };

  const handleGlobalToggle = async (checked: boolean) => {
    await ChromeStorage.setGlobalDisabled(!checked);
    setGlobalDisabled(!checked);
    // Show disable modal when toggling off
    if (!checked) {
      showDisableModal();
    }
  };

  const handleDomainToggle = async (checked: boolean) => {
    if (!currentDomain) return;
    const newStatus = checked ? DomainStatus.ENABLED : DomainStatus.DISABLED;
    await ChromeStorage.setDomainStatus(currentDomain, newStatus);
    setDomainStatus(newStatus);
    // Show disable modal when toggling off
    if (!checked) {
      showDisableModal();
    }
  };

  const handleAccountSettingsClick = () => {
    const accountSettingsUrl = `${ENV.XPLAINO_WEBSITE_BASE_URL}/user/account/settings`;
    window.open(accountSettingsUrl, '_blank');
  };

  const handleDashboardClick = () => {
    const dashboardUrl = `${ENV.XPLAINO_WEBSITE_BASE_URL}/user/dashboard`;
    window.open(dashboardUrl, '_blank');
  };

  // Theme dropdown options
  const themeOptions = [
    { value: 'account', label: 'As per account settings' },
    { value: 'LIGHT', label: 'Light' },
    { value: 'DARK', label: 'Dark' },
  ];

  if (loading) {
    return (
      <div className={getClassName('loading')}>
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className={getClassName('settingsView')}>
      {/* Account Settings Section */}
      <div className={getClassName('section')}>
        <div className={getClassName('sectionHeader')}>
          <div className={getClassName('sectionAccent')} />
          <h3 className={getClassName('sectionTitle')}>Account settings</h3>
          <div className={getClassName('sectionHeaderLine')} />
        </div>
        <div className={getClassName('sectionContent')}>
          <div className={getClassName('settingItem')}>
            <div className={getClassName('languageSettingRow')}>
              <span className={getClassName('settingLabel')}>Manage your account level settings</span>
              <button
                onClick={handleAccountSettingsClick}
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                <Settings size={16} />
                <span>Open settings</span>
              </button>
            </div>
          </div>
          <div className={getClassName('settingItem')}>
            <div className={getClassName('languageSettingRow')}>
              <span className={getClassName('settingLabel')}>My Dashboard</span>
              <button
                onClick={handleDashboardClick}
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                <LayoutDashboard size={16} />
                <span>My Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Extension Settings Section */}
      <div className={getClassName('section')}>
        <div className={getClassName('sectionHeader')}>
          <div className={getClassName('sectionAccent')} />
          <h3 className={getClassName('sectionTitle')}>Extension settings</h3>
          <div className={getClassName('sectionHeaderLine')} />
        </div>
        <div className={getClassName('sectionContent')}>
          {/* Theme Dropdown */}
          {currentDomain && (
            <div className={getClassName('settingItem')}>
              <div className={getClassName('languageSettingRow')}>
                <label className={getClassName('settingLabel')}>Theme</label>
                <Dropdown
                  options={themeOptions}
                  value={themeSelection}
                  onChange={handleThemeChange}
                  placeholder="Select theme"
                  useShadowDom={useShadowDom}
                />
              </div>
            </div>
          )}

          {/* Enable Globally Toggle */}
          <div className={getClassName('settingItem')}>
            <div className={getClassName('toggleSetting')}>
              <label className={getClassName('settingLabel')}>Enable globally</label>
              <Toggle
                checked={!globalDisabled}
                onChange={handleGlobalToggle}
              />
            </div>
          </div>

          {/* Enable on Domain Toggle */}
          {currentDomain && !globalDisabled && domainStatus !== DomainStatus.INVALID && (
            <div className={getClassName('settingItem')}>
              <div className={getClassName('toggleSetting')}>
                <label className={getClassName('settingLabel')}>
                  Enable on <span className={getClassName('domainName')}>{currentDomain}</span>
                </label>
                <Toggle
                  checked={domainStatus === DomainStatus.ENABLED}
                  onChange={handleDomainToggle}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

SettingsView.displayName = 'SettingsView';
