// src/content/components/CreateCustomPromptModal/CreateCustomPromptModal.tsx
// Create / edit custom prompt modal with TipTap rich-text editor.
// Supports both shadow DOM (plain class names) and CSS Modules (useShadowDom=false).

import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { X, Loader2, Bold, Italic, List, ListOrdered } from 'lucide-react';
import styles from './CreateCustomPromptModal.module.css';
import { CustomPromptService } from '@/api-services/CustomPromptService';
import type { CustomPromptResponse } from '@/api-services/dto/CustomPromptDTO';

export const EXAMPLE_PROMPT_HTML =
`<p>Analyze as a research professional and provide:</p>
<ul>
<li><strong>Key Findings</strong>: Extract the main conclusions and contributions</li>
<li><strong>Methodology Notes</strong>: Identify the research approach and study design</li>
<li><strong>Evidence Quality</strong>: Assess the strength of evidence and potential biases</li>
<li><strong>Research Gaps</strong>: Highlight open questions or areas needing further investigation</li>
<li><strong>Implications</strong>: Describe the broader scientific or practical impact</li>
</ul>
<p>Respond in a structured, <em>academic tone</em> suitable for peer review.</p>`;

// ─── Rich Text Editor ──────────────────────────────────────────────────────────

interface RichTextEditorProps {
  initialContent?: string;
  placeholder?: string;
  onChange: (html: string) => void;
  useShadowDom: boolean;
  cn: (base: string) => string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  initialContent = '',
  placeholder = 'Prompt description / content…',
  onChange,
  cn,
}) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    autofocus: false,
    editorProps: {
      attributes: { 'data-placeholder': placeholder },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  useEffect(() => () => { editor?.destroy(); }, [editor]);

  if (!editor) return null;

  return (
    <div className={cn('cpmEditorWrapper')}>
      <div className={cn('cpmEditorToolbar')}>
        <button
          type="button"
          className={`${cn('cpmToolbarBtn')}${editor.isActive('bold') ? ` ${cn('cpmToolbarBtnActive')}` : ''}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
          title="Bold"
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          className={`${cn('cpmToolbarBtn')}${editor.isActive('italic') ? ` ${cn('cpmToolbarBtnActive')}` : ''}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
          title="Italic"
        >
          <Italic size={14} />
        </button>
        <div className={cn('cpmToolbarDivider')} />
        <button
          type="button"
          className={`${cn('cpmToolbarBtn')}${editor.isActive('bulletList') ? ` ${cn('cpmToolbarBtnActive')}` : ''}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
          title="Bullet list"
        >
          <List size={14} />
        </button>
        <button
          type="button"
          className={`${cn('cpmToolbarBtn')}${editor.isActive('orderedList') ? ` ${cn('cpmToolbarBtnActive')}` : ''}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
          title="Numbered list"
        >
          <ListOrdered size={14} />
        </button>
      </div>
      <div className={cn('cpmEditorContent')}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

// ─── Modal ─────────────────────────────────────────────────────────────────────

export interface CreateCustomPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (prompt: CustomPromptResponse) => void;
  existingPrompt?: CustomPromptResponse | null;
  onUpdated?: (prompt: CustomPromptResponse) => void;
  useShadowDom?: boolean;
}

export const CreateCustomPromptModal: React.FC<CreateCustomPromptModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  existingPrompt,
  onUpdated,
  useShadowDom = false,
}) => {
  const isEditMode = !!existingPrompt;

  const cn = useCallback(
    (base: string) => {
      if (useShadowDom) return base;
      // Map shadow class names to CSS module keys (strip 'cpm' prefix -> camelCase)
      const moduleKey = base.startsWith('cpm')
        ? base.charAt(3).toLowerCase() + base.slice(4)
        : base;
      return (styles[moduleKey as keyof typeof styles] ?? base) as string;
    },
    [useShadowDom]
  );

  const [title, setTitle] = useState('Research Analysis Framework');
  const [description, setDescription] = useState(EXAMPLE_PROMPT_HTML);
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (existingPrompt) {
        setTitle(existingPrompt.title);
        setDescription(existingPrompt.description ?? '');
      } else {
        setTitle('Research Analysis Framework');
        setDescription(EXAMPLE_PROMPT_HTML);
      }
      setEditorKey((k) => k + 1);
    }
  }, [isOpen, existingPrompt]);

  // Auto-clear toast
  useEffect(() => {
    if (!toastMsg) return;
    const id = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(id);
  }, [toastMsg]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      setSaving(true);
      if (isEditMode && existingPrompt) {
        const updated = await CustomPromptService.updateCustomPrompt(existingPrompt.id, {
          title: title.trim(),
          description,
        });
        setToastMsg({ text: 'Prompt updated', isError: false });
        onUpdated?.(updated);
      } else {
        const created = await CustomPromptService.createCustomPrompt({
          title: title.trim(),
          description,
        });
        setToastMsg({ text: 'Prompt created', isError: false });
        onCreated?.(created);
      }
      onClose();
    } catch (err) {
      setToastMsg({
        text: err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} prompt`,
        isError: true,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <div className={cn('cpmOverlay')} onClick={onClose}>
      <div className={cn('cpmPanel')} onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
        <div className={cn('cpmHeader')}>
          <h2 className={cn('cpmTitle')}>{isEditMode ? 'Edit Prompt' : 'New Custom Prompt'}</h2>
          <button type="button" className={cn('cpmCloseBtn')} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className={cn('cpmForm')} onSubmit={handleSubmit}>
          <div className={cn('cpmField')}>
            <label className={cn('cpmLabel')} htmlFor="cpm-title">Title</label>
            <input
              id="cpm-title"
              className={cn('cpmInput')}
              placeholder="e.g. Research Analysis Framework"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className={cn('cpmField')}>
            <label className={cn('cpmLabel')}>Description</label>
            {!isEditMode && (
              <p className={cn('cpmHint')}>
                This is an example for a research professional — edit or replace it with your own prompt.
              </p>
            )}
            <RichTextEditor
              key={editorKey}
              initialContent={isEditMode ? (existingPrompt?.description ?? '') : EXAMPLE_PROMPT_HTML}
              placeholder="Prompt description / content…"
              onChange={setDescription}
              useShadowDom={useShadowDom}
              cn={cn}
            />
          </div>

          <div className={cn('cpmActions')}>
            <button type="button" className={cn('cpmCancelBtn')} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={cn('cpmSaveBtn')} disabled={saving || !title.trim()}>
              {saving && <Loader2 size={14} className={cn('cpmSpin')} />}
              {isEditMode ? 'Save Changes' : 'Create Prompt'}
            </button>
          </div>
        </form>

        {toastMsg && (
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: toastMsg.isError ? '#b91c1c' : '#0d9488',
              color: '#fff',
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            {toastMsg.text}
          </div>
        )}
      </div>
    </div>
  );

  // In shadow DOM mode render inline (styles live inside shadow root).
  // In CSS Modules mode portal to document.body so the modal sits above everything.
  if (useShadowDom) return content;
  return ReactDOM.createPortal(content, document.body);
};

CreateCustomPromptModal.displayName = 'CreateCustomPromptModal';
