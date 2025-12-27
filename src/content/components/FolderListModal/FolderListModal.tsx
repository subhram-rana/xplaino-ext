// src/content/components/FolderListModal/FolderListModal.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FolderWithSubFoldersResponse } from '@/api-services/dto/FolderDTO';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, X } from 'lucide-react';
import styles from './FolderListModal.module.css';

export interface FolderListModalProps {
  /** Folders from API response */
  folders: FolderWithSubFoldersResponse[];
  /** Callback when Save Text button is clicked */
  onSave: (folderId: string | null, name?: string) => void;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Whether component is rendered in Shadow DOM */
  useShadowDom?: boolean;
  /** Whether save operation is in progress */
  isSaving?: boolean;
  /** Callback when Create Folder is clicked */
  onCreateFolder?: (folderName: string, parentFolderId: string | null) => void;
  /** Whether folder creation is in progress */
  isCreatingFolder?: boolean;
  /** Initially selected folder ID (for auto-selecting newly created folders) */
  initialSelectedFolderId?: string | null;
  /** Initially expanded folder IDs (for showing newly created folders) */
  initialExpandedFolders?: Set<string>;
  /** Whether the remember folder checkbox should be checked */
  rememberFolderChecked?: boolean;
  /** Callback when remember folder checkbox is toggled */
  onRememberFolderChange?: (checked: boolean) => void;
  /** Whether to show the name input field */
  showNameInput?: boolean;
  /** Initial value for the name input (pre-filled) */
  initialName?: string;
  /** Callback when name changes */
  onNameChange?: (name: string) => void;
  /** Custom modal title (defaults to "Choose folder") */
  modalTitle?: string;
}

interface FolderTreeItemProps {
  folder: FolderWithSubFoldersResponse;
  level: number;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string) => void;
  getClassName: (name: string) => string;
  expandedFolders: Set<string>;
  toggleFolder: (folderId: string) => void;
}

const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
  folder,
  level,
  selectedFolderId,
  onSelectFolder,
  getClassName,
  expandedFolders,
  toggleFolder,
}) => {
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const hasSubFolders = folder.subFolders && folder.subFolders.length > 0;

  return (
    <>
      <div
        className={`${getClassName('folderItem')} ${isSelected ? getClassName('folderItemSelected') : ''}`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        onClick={() => onSelectFolder(folder.id)}
      >
        {hasSubFolders && (
          <button
            className={getClassName('expandButton')}
            onClick={(e) => {
              e.stopPropagation();
              toggleFolder(folder.id);
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>
        )}
        {!hasSubFolders && <div className={getClassName('expandButtonSpacer')} />}
        <div className={getClassName('folderIcon')}>
          {isExpanded ? (
            <FolderOpen size={18} />
          ) : (
            <Folder size={18} />
          )}
        </div>
        <span className={getClassName('folderName')}>{folder.name}</span>
      </div>
      {hasSubFolders && isExpanded && (
        <div className={getClassName('subFolders')}>
          {folder.subFolders.map((subFolder) => (
            <FolderTreeItem
              key={subFolder.id}
              folder={subFolder}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
              getClassName={getClassName}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))}
        </div>
      )}
    </>
  );
};

export const FolderListModal: React.FC<FolderListModalProps> = ({
  folders,
  onSave,
  onClose,
  useShadowDom = false,
  isSaving = false,
  onCreateFolder,
  isCreatingFolder = false,
  initialSelectedFolderId = null,
  initialExpandedFolders,
  rememberFolderChecked = false,
  onRememberFolderChange,
  showNameInput = false,
  initialName = '',
  onNameChange,
  modalTitle = 'Choose folder',
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(initialSelectedFolderId);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    initialExpandedFolders ? new Set(initialExpandedFolders) : new Set()
  );
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [name, setName] = useState(initialName);
  const [internalRememberChecked, setInternalRememberChecked] = useState(rememberFolderChecked);
  const createInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Update selected folder when initialSelectedFolderId changes (e.g., after folder creation)
  useEffect(() => {
    if (initialSelectedFolderId !== null) {
      setSelectedFolderId(initialSelectedFolderId);
    }
  }, [initialSelectedFolderId]);

  // Update expanded folders when initialExpandedFolders changes (e.g., after folder creation)
  useEffect(() => {
    if (initialExpandedFolders) {
      setExpandedFolders(new Set(initialExpandedFolders));
    }
  }, [initialExpandedFolders]);

  // Sync checkbox state with props
  useEffect(() => {
    setInternalRememberChecked(rememberFolderChecked);
  }, [rememberFolderChecked]);

  // Sync name input with initialName prop
  useEffect(() => {
    if (initialName !== undefined) {
      setName(initialName);
    }
  }, [initialName]);

  // Handle folder selection - enable checkbox if folder is selected
  const handleSelectFolder = useCallback((folderId: string) => {
    setSelectedFolderId(folderId);
  }, []);

  const getClassName = useCallback(
    (name: string) => {
      return useShadowDom ? name : styles[name];
    },
    [useShadowDom]
  );

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }, []);

  const handleSave = useCallback(() => {
    onSave(selectedFolderId, showNameInput ? name : undefined);
  }, [selectedFolderId, showNameInput, name, onSave]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    onNameChange?.(newName);
  }, [onNameChange]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const handleCreateFolderClick = useCallback(() => {
    setShowCreateInput(true);
    setNewFolderName('');
  }, []);

  const handleCreateFolderSubmit = useCallback(() => {
    const trimmedName = newFolderName.trim();
    if (trimmedName && onCreateFolder) {
      onCreateFolder(trimmedName, selectedFolderId);
      setShowCreateInput(false);
      setNewFolderName('');
    }
  }, [newFolderName, selectedFolderId, onCreateFolder]);

  const handleCreateFolderCancel = useCallback(() => {
    setShowCreateInput(false);
    setNewFolderName('');
  }, []);

  const handleCreateInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateFolderSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCreateFolderCancel();
    }
  }, [handleCreateFolderSubmit, handleCreateFolderCancel]);

  // Focus input when it appears
  useEffect(() => {
    if (showCreateInput && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [showCreateInput]);

  // Handle remember folder checkbox change
  const handleRememberFolderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setInternalRememberChecked(checked);
    onRememberFolderChange?.(checked);
  }, [onRememberFolderChange]);

  // Prevent deselection when clicking on empty space in folder list or modal content
  const handleFolderListClick = useCallback((e: React.MouseEvent) => {
    // Only prevent default if clicking directly on the folderList container (not on a folder item)
    // This prevents accidental deselection when clicking on empty space
    if (e.target === e.currentTarget) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  // Prevent any unwanted behavior when clicking on modal content (but not on folder items)
  const handleModalContentClick = useCallback((e: React.MouseEvent) => {
    // Only stop propagation if clicking directly on modalContent (not on child elements)
    // This ensures folder item clicks still work normally
    if (e.target === e.currentTarget) {
      e.stopPropagation();
    }
  }, []);

  return (
    <div className={getClassName('modalBackdrop')} onClick={handleBackdropClick}>
      <div className={getClassName('modalContainer')} onClick={(e) => e.stopPropagation()}>
        <div className={getClassName('modalHeader')}>
          <h2 className={getClassName('modalTitle')}>{modalTitle}</h2>
        </div>

        <div className={getClassName('modalContent')} onClick={handleModalContentClick}>
          {/* Name input field (for link saving) */}
          {showNameInput && (
            <div className={getClassName('nameInputContainer')}>
              <label className={getClassName('nameInputLabel')}>Name</label>
              <input
                ref={nameInputRef}
                type="text"
                className={getClassName('nameInput')}
                placeholder="Page name..."
                value={name}
                onChange={handleNameChange}
                disabled={isSaving || isCreatingFolder}
                maxLength={100}
              />
              <div className={getClassName('nameInputCounter')}>
                {name.length}/100
              </div>
            </div>
          )}
          {/* Create folder input */}
          {showCreateInput && (
            <div className={getClassName('createFolderInput')}>
              <div className={getClassName('folderIcon')}>
                <Folder size={18} />
              </div>
              <input
                ref={createInputRef}
                type="text"
                className={getClassName('folderNameInput')}
                placeholder="Folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={handleCreateInputKeyDown}
                disabled={isCreatingFolder}
                maxLength={50}
              />
              {isCreatingFolder ? (
                <div className={getClassName('createInputSpinner')} />
              ) : (
                <button
                  className={getClassName('cancelCreateButton')}
                  onClick={handleCreateFolderCancel}
                  aria-label="Cancel"
                  title="Cancel"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          )}

          {folders.length === 0 && !showCreateInput ? (
            <div className={getClassName('emptyState')}>
              <p>No folders available. Please create a folder first.</p>
            </div>
          ) : (
            <div className={getClassName('folderList')} onClick={handleFolderListClick}>
              {/* Folder list label */}
              {folders.length > 0 && !showCreateInput && (
                <div className={getClassName('folderListLabel')}>Choose folder</div>
              )}
              {/* Folder tree */}
              {folders.map((folder) => (
                <FolderTreeItem
                  key={folder.id}
                  folder={folder}
                  level={0}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={handleSelectFolder}
                  getClassName={getClassName}
                  expandedFolders={expandedFolders}
                  toggleFolder={toggleFolder}
                />
              ))}
            </div>
          )}
        </div>

        <div className={getClassName('modalFooter')}>
          <div className={getClassName('footerLeft')}>
            <label className={getClassName('rememberFolderLabel')}>
              <input
                type="checkbox"
                className={getClassName('rememberFolderCheckbox')}
                checked={internalRememberChecked}
                onChange={handleRememberFolderChange}
                disabled={selectedFolderId === null || isSaving || isCreatingFolder}
              />
              <span>Remember my folder</span>
            </label>
          </div>
          <div className={getClassName('footerRight')}>
            <button
              className={getClassName('createFolderButton')}
              onClick={handleCreateFolderClick}
              disabled={isSaving || isCreatingFolder || showCreateInput}
            >
              <Plus size={16} />
              Create Folder
            </button>
            <div className={getClassName('footerButtons')}>
            <button
              className={getClassName('cancelButton')}
              onClick={onClose}
              disabled={isSaving || isCreatingFolder}
            >
              Cancel
            </button>
            <button
              className={getClassName('saveButton')}
              onClick={handleSave}
              disabled={isSaving || isCreatingFolder || selectedFolderId === null}
            >
              {isSaving ? 'Saving...' : 'Save Text'}
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

FolderListModal.displayName = 'FolderListModal';

