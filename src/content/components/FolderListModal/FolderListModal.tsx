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
  /** Mode: 'paragraph', 'link', 'word', or 'image' - used for context-aware labels */
  mode?: 'paragraph' | 'link' | 'word' | 'image';
}

interface FolderTreeItemProps {
  folder: FolderWithSubFoldersResponse;
  level: number;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string) => void;
  getClassName: (name: string) => string;
  expandedFolders: Set<string>;
  toggleFolder: (folderId: string) => void;
  editingFolderId: string | null;
  editingFolderParentId: string | null;
  editingFolderName: string;
  onEditingFolderNameChange: (name: string) => void;
  onEditingFolderSubmit: (parentFolderId: string | null) => void;
  onEditingFolderCancel: () => void;
  editingInputRef: React.RefObject<HTMLInputElement>;
  isCreatingFolder: boolean;
}

const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
  folder,
  level,
  selectedFolderId,
  onSelectFolder,
  getClassName,
  expandedFolders,
  toggleFolder,
  editingFolderId,
  editingFolderParentId,
  editingFolderName,
  onEditingFolderNameChange,
  onEditingFolderSubmit,
  onEditingFolderCancel,
  editingInputRef,
  isCreatingFolder,
}) => {
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const hasSubFolders = folder.subFolders && folder.subFolders.length > 0;
  const isEditingThisFolder = editingFolderId === folder.id;
  const isEditingChild = editingFolderParentId === folder.id;

  const handleEditingKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onEditingFolderSubmit(folder.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onEditingFolderCancel();
    }
  }, [folder.id, onEditingFolderSubmit, onEditingFolderCancel]);

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
        {isEditingThisFolder ? (
          <>
            <input
              ref={editingInputRef}
              type="text"
              className={getClassName('editingFolderInput')}
              value={editingFolderName}
              onChange={(e) => onEditingFolderNameChange(e.target.value)}
              onKeyDown={handleEditingKeyDown}
              onClick={(e) => e.stopPropagation()}
              disabled={isCreatingFolder}
              maxLength={50}
            />
            <button
              className={getClassName('cancelEditButton')}
              onClick={(e) => {
                e.stopPropagation();
                onEditingFolderCancel();
              }}
              title="Cancel"
              aria-label="Cancel"
              disabled={isCreatingFolder}
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <span className={getClassName('folderName')}>{folder.name}</span>
        )}
      </div>
      {(hasSubFolders || isEditingChild) && isExpanded && (
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
              editingFolderId={editingFolderId}
              editingFolderParentId={editingFolderParentId}
              editingFolderName={editingFolderName}
              onEditingFolderNameChange={onEditingFolderNameChange}
              onEditingFolderSubmit={onEditingFolderSubmit}
              onEditingFolderCancel={onEditingFolderCancel}
              editingInputRef={editingInputRef}
              isCreatingFolder={isCreatingFolder}
            />
          ))}
          {isEditingChild && (
            <div
              className={`${getClassName('folderItem')} ${getClassName('editingFolderItem')}`}
              style={{ paddingLeft: `${(level + 1) * 20 + 12}px` }}
            >
              <div className={getClassName('expandButtonSpacer')} />
              <div className={getClassName('folderIcon')}>
                <Folder size={18} />
              </div>
              <input
                ref={editingInputRef}
                type="text"
                className={getClassName('editingFolderInput')}
                value={editingFolderName}
                onChange={(e) => onEditingFolderNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    onEditingFolderSubmit(folder.id);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    onEditingFolderCancel();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                disabled={isCreatingFolder}
                maxLength={50}
              />
              <button
                className={getClassName('cancelEditButton')}
                onClick={(e) => {
                  e.stopPropagation();
                  onEditingFolderCancel();
                }}
                title="Cancel"
                aria-label="Cancel"
                disabled={isCreatingFolder}
              >
                <X size={16} />
              </button>
            </div>
          )}
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
  mode = 'paragraph',
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(initialSelectedFolderId);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    initialExpandedFolders ? new Set(initialExpandedFolders) : new Set()
  );
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderParentId, setEditingFolderParentId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('Untitled');
  const [name, setName] = useState(initialName);
  const [internalRememberChecked, setInternalRememberChecked] = useState(rememberFolderChecked);
  const editingInputRef = useRef<HTMLInputElement>(null);
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

  const handleAddRootFolder = useCallback(() => {
    setEditingFolderId('temp-root');
    setEditingFolderParentId(null);
    setEditingFolderName('Untitled');
  }, []);

  const handleEditingFolderSubmit = useCallback((parentFolderId: string | null) => {
    const trimmedName = editingFolderName.trim();
    if (trimmedName && onCreateFolder) {
      onCreateFolder(trimmedName, parentFolderId);
      // Don't clear editing state here - let it persist until API call completes
      // The editing state will be cleared when folders list updates (on success)
      // or when user cancels (on error)
    }
  }, [editingFolderName, onCreateFolder]);

  const handleEditingFolderCancel = useCallback(() => {
    setEditingFolderId(null);
    setEditingFolderParentId(null);
    setEditingFolderName('Untitled');
  }, []);

  // Focus and select input when editing starts
  useEffect(() => {
    if (editingFolderId && editingInputRef.current) {
      editingInputRef.current.focus();
      editingInputRef.current.select();
    }
  }, [editingFolderId]);

  // Track previous state to detect when a folder is successfully added
  const prevFoldersLengthRef = useRef(folders.length);
  const prevSubFoldersCountRef = useRef<Map<string, number>>(new Map());
  
  // Initialize subfolders count
  useEffect(() => {
    const updateCounts = (folderList: FolderWithSubFoldersResponse[]): void => {
      folderList.forEach(folder => {
        prevSubFoldersCountRef.current.set(folder.id, folder.subFolders.length);
        if (folder.subFolders.length > 0) {
          updateCounts(folder.subFolders);
        }
      });
    };
    updateCounts(folders);
  }, []);

  // Clear editing state when a folder is successfully added
  useEffect(() => {
    if (editingFolderId && !isCreatingFolder) {
      let folderAdded = false;
      
      if (editingFolderParentId === null) {
        // Root level: check if folder count increased
        folderAdded = folders.length > prevFoldersLengthRef.current;
        prevFoldersLengthRef.current = folders.length;
      } else {
        // Subfolder: check if parent's subfolder count increased
        const findParent = (folderList: FolderWithSubFoldersResponse[]): FolderWithSubFoldersResponse | null => {
          for (const folder of folderList) {
            if (folder.id === editingFolderParentId) return folder;
            if (folder.subFolders.length > 0) {
              const found = findParent(folder.subFolders);
              if (found) return found;
            }
          }
          return null;
        };
        const parent = findParent(folders);
        if (parent) {
          const prevCount = prevSubFoldersCountRef.current.get(editingFolderParentId) || 0;
          folderAdded = parent.subFolders.length > prevCount;
          prevSubFoldersCountRef.current.set(editingFolderParentId, parent.subFolders.length);
        }
      }

      if (folderAdded) {
        // Folder was added successfully, clear editing state
        setEditingFolderId(null);
        setEditingFolderParentId(null);
        setEditingFolderName('Untitled');
      }
      // If folderAdded is false, keep editing state so user can retry on error
    }
  }, [folders, isCreatingFolder, editingFolderId, editingFolderParentId]);

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
          <button
            className={getClassName('closeButton')}
            onClick={onClose}
            disabled={isSaving || isCreatingFolder}
            aria-label="Close"
            title="Close"
          >
            <X size={20} />
          </button>
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
          <div className={getClassName('folderList')} onClick={handleFolderListClick}>
            {/* Folder list label */}
            {folders.length > 0 && !editingFolderId && (
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
                editingFolderId={editingFolderId}
                editingFolderParentId={editingFolderParentId}
                editingFolderName={editingFolderName}
                onEditingFolderNameChange={setEditingFolderName}
                onEditingFolderSubmit={handleEditingFolderSubmit}
                onEditingFolderCancel={handleEditingFolderCancel}
                editingInputRef={editingInputRef}
                isCreatingFolder={isCreatingFolder}
              />
            ))}
            {/* Root-level editing folder */}
            {editingFolderId === 'temp-root' && (
              <div
                className={`${getClassName('folderItem')} ${getClassName('editingFolderItem')}`}
                style={{ paddingLeft: '12px' }}
              >
                <div className={getClassName('expandButtonSpacer')} />
                <div className={getClassName('folderIcon')}>
                  <Folder size={18} />
                </div>
                <input
                  ref={editingInputRef}
                  type="text"
                  className={getClassName('editingFolderInput')}
                  value={editingFolderName}
                  onChange={(e) => setEditingFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleEditingFolderSubmit(null);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      handleEditingFolderCancel();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  disabled={isCreatingFolder}
                  maxLength={50}
                />
                <button
                  className={getClassName('cancelEditButton')}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditingFolderCancel();
                  }}
                  title="Cancel"
                  aria-label="Cancel"
                  disabled={isCreatingFolder}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {/* Root-level add folder button */}
            {!editingFolderId && (
              <div className={getClassName('addFolderButtonRoot')}>
                {folders.length === 0 && (
                  <div className={getClassName('createFolderPrompt')}>
                    Please create folder to save
                  </div>
                )}
                <button
                  className={getClassName('addFolderButtonRootButton')}
                  onClick={handleAddRootFolder}
                  title="Add new folder"
                  aria-label="Add new folder"
                >
                  <Plus size={16} />
                  <span>Add new folder</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={getClassName('modalFooter')}>
          {/* Remember my folder checkbox - shown only when folder is selected */}
          {selectedFolderId !== null && !isSaving && !isCreatingFolder && (
            <div className={getClassName('footerLeft')}>
              <label className={getClassName('rememberFolderLabel')}>
                <input
                  type="checkbox"
                  className={getClassName('rememberFolderCheckbox')}
                  checked={internalRememberChecked}
                  onChange={handleRememberFolderChange}
                />
                <span>
                  {mode === 'link' ? 'Remember my folder for links' : mode === 'word' ? 'Remember my folder for word bookmark' : mode === 'image' ? 'Remember my folder for image bookmark' : 'Remember my folder for paragraph'}
                </span>
              </label>
            </div>
          )}
          {selectedFolderId !== null && !isCreatingFolder && (
            <div className={getClassName('footerRight')}>
              <div className={getClassName('footerButtons')}>
                <button
                  className={getClassName('saveButton')}
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Text'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

FolderListModal.displayName = 'FolderListModal';

