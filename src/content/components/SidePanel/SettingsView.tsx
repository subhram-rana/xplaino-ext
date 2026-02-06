// src/content/components/SidePanel/SettingsView.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { Settings, LayoutDashboard, LogOut, RefreshCw, Layers } from 'lucide-react';
import { useAtomValue, useSetAtom } from 'jotai';
import { userAuthInfoAtom, showLoginModalAtom } from '@/store/uiAtoms';
import { ChromeStorage } from '@/storage/chrome-local/ChromeStorage';
import { DomainStatus } from '@/types/domain';
import { extractDomain } from '@/utils/domain';
import { Dropdown, type DropdownOption } from './Dropdown';
import { IconTabGroup } from '@/components/ui/IconTabGroup/IconTabGroup';
import { showDisableModal } from '@/content/index';
import { ENV } from '@/config/env';
import { AuthService } from '@/api-services/AuthService';
import { UserSettingsService } from '@/api-services/UserSettingsService';
import type { UpdateSettingsRequest } from '@/api-services/UserSettingsService';
import styles from './SettingsView.module.css';

export interface SettingsViewProps {
  /** Whether to use Shadow DOM styling */
  useShadowDom?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ useShadowDom = false }) => {
  const userAuthInfo = useAtomValue(userAuthInfoAtom);
  const setUserAuthInfo = useSetAtom(userAuthInfoAtom);
  const setShowLoginModal = useSetAtom(showLoginModalAtom);
  const isLoggedIn = userAuthInfo?.isLoggedIn ?? false;

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

  // Account settings state (populated from GET /api/user-settings)
  const [nativeLanguage, setNativeLanguage] = useState<string | null>(null);
  const [pageTranslationView, setPageTranslationView] = useState<'REPLACE' | 'APPEND'>('REPLACE');
  const [backendTheme, setBackendTheme] = useState<'LIGHT' | 'DARK'>('LIGHT');
  const [languageOptions, setLanguageOptions] = useState<DropdownOption[]>([]);
  const [, setSettingsUpdating] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
  }, [isLoggedIn]);

  // If user is not logged in and themeSelection is 'account', change it to 'LIGHT'
  useEffect(() => {
    if (!isLoggedIn && themeSelection === 'account') {
      setThemeSelection('LIGHT');
    }
  }, [isLoggedIn, themeSelection]);

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
        // If logged in, use 'account', otherwise default to 'LIGHT'
        setThemeSelection(isLoggedIn ? 'account' : 'LIGHT');
      }

      setGlobalDisabled(gDisabled);
      if (dStatus) setDomainStatus(dStatus);

      // Load account settings and languages (only when logged in)
      if (isLoggedIn) {
        try {
          // Fetch user account settings from storage (already synced on page load)
          const accountSettings = await ChromeStorage.getUserAccountSettings();
          if (accountSettings?.settings) {
            setNativeLanguage(accountSettings.settings.nativeLanguage ?? null);
            setPageTranslationView(accountSettings.settings.pageTranslationView || 'REPLACE');
            setBackendTheme(accountSettings.settings.theme || 'LIGHT');
          }

          // Fetch languages list (public endpoint)
          const langResponse = await UserSettingsService.getAllLanguages();
          const sortedLanguages = [...langResponse.languages].sort((a, b) =>
            a.languageNameInEnglish.localeCompare(b.languageNameInEnglish)
          );
          const dropdownOptions: DropdownOption[] = [
            { value: '', label: 'None' },
            ...sortedLanguages.map((lang) => ({
              value: lang.languageCode,
              label: `${lang.languageNameInEnglish} (${lang.languageNameInNative})`,
            })),
          ];
          setLanguageOptions(dropdownOptions);
        } catch (accountError) {
          console.error('[SettingsView] Error loading account settings / languages:', accountError);
        }
      }
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
        // CRITICAL: Fetch fresh account settings from API first
        console.log('[SettingsView] Fetching fresh account settings for theme sync...');
        await UserSettingsService.syncUserAccountSettings();
        console.log('[SettingsView] Account settings synced, removing domain override');
        
        // Remove domain override - will use fresh account settings
        await ChromeStorage.removeUserExtensionDomainTheme(currentDomain);
        setThemeSelection('account');
        console.log('[SettingsView] Removed domain theme override, using account settings');
      } else if (value === 'LIGHT' || value === 'DARK') {
        // Set domain-specific theme
        await ChromeStorage.setUserExtensionDomainTheme(currentDomain, value);
        setThemeSelection(value);
        console.log('[SettingsView] Set domain theme:', value, 'for domain:', currentDomain);
      }

      // Note: Theme change will be detected by storage listener in content/index.ts
      // No need to manually dispatch event - storage changes trigger automatic refresh
    } catch (error) {
      console.error('[SettingsView] Error updating theme:', error);
    }
  };

  // Helper to call updateUserSettings API with current state
  const saveAccountSettings = async (settings: {
    nativeLanguage: string | null;
    pageTranslationView: 'REPLACE' | 'APPEND';
  }) => {
    try {
      setSettingsUpdating(true);
      const body: UpdateSettingsRequest = {
        nativeLanguage: settings.nativeLanguage,
        pageTranslationView: settings.pageTranslationView,
        theme: backendTheme, // Always pass through the backend theme value
      };
      const updatedData = await UserSettingsService.updateUserSettings(body);
      // Keep backendTheme in sync with what the server returned
      if (updatedData?.settings?.theme) {
        setBackendTheme(updatedData.settings.theme);
      }
      console.log('[SettingsView] Account settings updated successfully');
    } catch (error) {
      console.error('[SettingsView] Error updating account settings:', error);
    } finally {
      setSettingsUpdating(false);
    }
  };

  const handleNativeLanguageChange = async (value: string) => {
    const newValue = value || null; // empty string => null (i.e. "None")
    setNativeLanguage(newValue);
    await saveAccountSettings({ nativeLanguage: newValue, pageTranslationView });
  };

  const handlePageTranslationViewChange = async (tabId: string) => {
    const newValue = tabId as 'REPLACE' | 'APPEND';
    setPageTranslationView(newValue);
    await saveAccountSettings({ nativeLanguage, pageTranslationView: newValue });
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

  const handleLogoutClick = async () => {
    console.log('[SettingsView] Logout button clicked, calling AuthService.logout()');
    try {
      await AuthService.logout();
      console.log('[SettingsView] Logout successful, updating auth info atom');
      
      // Get the updated auth info from storage
      const updatedAuthInfo = await ChromeStorage.getAuthInfo();
      console.log('[SettingsView] Retrieved updated auth info from storage:', {
        isLoggedIn: updatedAuthInfo?.isLoggedIn,
        hasAccessToken: !!updatedAuthInfo?.accessToken,
      });
      
      // Update atom with the merged auth info
      setUserAuthInfo(updatedAuthInfo);
    } catch (error) {
      console.error('[SettingsView] Logout error:', error);
    }
  };

  const handleLoginClick = () => {
    setShowLoginModal(true);
  };

  // Theme dropdown options - only show "As per account settings" when logged in
  const themeOptions = isLoggedIn
    ? [
        { value: 'account', label: 'As per account settings' },
        { value: 'LIGHT', label: 'Light' },
        { value: 'DARK', label: 'Dark' },
      ]
    : [
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
      {/* Account Section */}
      <div className={getClassName('section')}>
        {isLoggedIn && userAuthInfo?.user ? (
          <>
            <div className={getClassName('accountContent')}>
              {/* Left: Profile Picture */}
              <div className={getClassName('accountLeft')}>
                <div className={getClassName('accountPictureContainer')}>
                  <img 
                    src={userAuthInfo.user.picture || ''} 
                    alt={userAuthInfo.user.name || 'User'}
                    className={getClassName('accountPicture')}
                  />
                </div>
              </div>
              
              {/* Middle: Name + Badge + Email */}
              <div className={getClassName('accountMiddle')}>
                <div className={getClassName('accountNameRow')}>
                  <div className={getClassName('accountName')}>
                    {userAuthInfo.user.name || 'Name'}
                  </div>
                  <span className={getClassName('accountFreeTrialBadge')}>
                    Free trial
                  </span>
                </div>
                <div className={getClassName('accountEmail')}>
                  {userAuthInfo.user.email || 'Email'}
                </div>
              </div>
              
              {/* Right: Logout */}
              <div className={getClassName('accountRight')}>
                <button
                  onClick={handleLogoutClick}
                  className={getClassName('accountLogoutButton')}
                  type="button"
                >
                  <LogOut size={16} strokeWidth={2.5} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
            
            {/* Account Buttons Row */}
            <div className={getClassName('accountButtonsRow')}>
              <button
                onClick={handleAccountSettingsClick}
                type="button"
                className={getClassName('accountButton')}
              >
                <Settings size={16} />
                <span>My settings</span>
              </button>
              <button
                onClick={handleDashboardClick}
                type="button"
                className={getClassName('accountButton')}
              >
                <LayoutDashboard size={16} />
                <span>My Dashboard</span>
              </button>
            </div>
          </>
        ) : (
          <div className={getClassName('accountLoginSection')}>
            <div className={getClassName('accountLoginText')}>
              Login to explore more features
            </div>
            <button
              onClick={handleLoginClick}
              className={getClassName('accountLoginButton')}
              type="button"
            >
              LOGIN
            </button>
          </div>
        )}
      </div>

      {/* Horizontal Divider */}
      <div className={getClassName('sectionDivider')} />

      {/* Extension Settings Section */}
      <div className={getClassName('section')}>
        <div className={getClassName('sectionContent')}>
          {/* Native Language Dropdown (logged-in only) */}
          {isLoggedIn && languageOptions.length > 0 && (
            <div className={getClassName('settingItem')}>
              <div className={getClassName('languageSettingRow')}>
                <label className={getClassName('settingLabel')}>Native Language</label>
                <Dropdown
                  options={languageOptions}
                  value={nativeLanguage || ''}
                  onChange={handleNativeLanguageChange}
                  placeholder="None"
                  useShadowDom={useShadowDom}
                />
              </div>
            </div>
          )}

          {/* Page Translation View Toggle (logged-in only) */}
          {isLoggedIn && (
            <div className={getClassName('settingItem')}>
              <div className={getClassName('translationViewRow')}>
                <label className={getClassName('settingLabel')}>Page Translation View</label>
                <IconTabGroup
                  tabs={[
                    { id: 'REPLACE', icon: RefreshCw, label: 'Replace' },
                    { id: 'APPEND', icon: Layers, label: 'Append' },
                  ]}
                  activeTabId={pageTranslationView}
                  onTabChange={handlePageTranslationViewChange}
                  useShadowDom={useShadowDom}
                  iconSize={16}
                  tabSize={32}
                />
              </div>
            </div>
          )}

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
                  checked={domainStatus === null || domainStatus === DomainStatus.ENABLED}
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
