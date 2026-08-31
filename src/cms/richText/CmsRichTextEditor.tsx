import {
  Box,
  Button,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import { EditorContent, useEditor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { createLowlight, common } from 'lowlight';
import { useEffect, useMemo, useState } from 'react';

import { axisTokens } from '../../app/axisTheme';
import { ShellIcon } from '../../app/shell/ShellIcon';
import {
  cmsRichTextDocumentToText,
  type CmsRichTextDocument,
} from './cmsRichTextContract';
import { CmsRichTextDocumentRenderer } from './CmsRichTextRenderer';

const lowlight = createLowlight(common);

interface CmsRichTextEditorProps {
  readonly label: string;
  readonly onChange: (value: CmsRichTextDocument, plainText: string) => void;
  readonly placeholder?: string | undefined;
  readonly value: CmsRichTextDocument;
}

function isSameDocument(
  left: CmsRichTextDocument | JSONContent,
  right: CmsRichTextDocument | JSONContent,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function commandButton(
  label: string,
  icon: string,
  active: boolean,
  disabled: boolean,
  onClick: () => void,
) {
  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          size="small"
          sx={{
            bgcolor: active
              ? alpha(axisTokens.color.signatureGold, 0.18)
              : 'transparent',
            border: 1,
            borderColor: active
              ? alpha(axisTokens.color.signatureGold, 0.5)
              : 'transparent',
            color: active ? 'text.primary' : 'text.secondary',
            height: 28,
            minHeight: 28,
            minWidth: 28,
            p: 0,
            width: 28,
            '& .MuiSvgIcon-root': {
              fontSize: 17,
            },
            '&:hover': {
              bgcolor: alpha(axisTokens.color.charcoal[900], 0.05),
              borderColor: alpha(axisTokens.color.charcoal[900], 0.12),
            },
          }}
          onClick={onClick}
        >
          <ShellIcon fontSize="small" name={icon} />
        </IconButton>
      </span>
    </Tooltip>
  );
}

export function CmsRichTextEditor({
  label,
  onChange,
  placeholder = 'Write documentation content...',
  value,
}: CmsRichTextEditorProps) {
  const [linkText, setLinkText] = useState('Read more');
  const [linkUrl, setLinkUrl] = useState('https://nodics.ai');
  const [imageAlt, setImageAlt] = useState('Documentation image');
  const [imageUrl, setImageUrl] = useState('');

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: { rel: 'noreferrer', target: '_blank' },
        openOnClick: false,
      }),
      Image.configure({ allowBase64: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
    ],
    [placeholder],
  );

  const editor = useEditor({
    content: value as JSONContent,
    editorProps: {
      attributes: {
        'aria-label': label,
        class: 'cms-rich-text-editor',
      },
    },
    extensions,
    immediatelyRender: false,
    onUpdate: ({ editor: updatedEditor }) => {
      const next = updatedEditor.getJSON() as CmsRichTextDocument;
      onChange(next, cmsRichTextDocumentToText(next));
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getJSON() as CmsRichTextDocument;
    if (isSameDocument(current, value)) return;
    editor.commands.setContent(value as JSONContent, { emitUpdate: false });
  }, [editor, value]);

  const insertLink = () => {
    if (!editor) return;
    const href = linkUrl.trim();
    if (!href) return;
    const selectionEmpty = editor.state.selection.empty;
    if (selectionEmpty) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: linkText.trim() || href,
              marks: [{ type: 'link', attrs: { href } }],
            },
          ],
        })
        .run();
      return;
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
  };

  const insertImage = () => {
    if (!editor) return;
    const src = imageUrl.trim();
    if (!src) return;
    editor.chain().focus().setImage({ alt: imageAlt.trim(), src }).run();
  };

  const insertCodeBlock = () => {
    editor
      ?.chain()
      .focus()
      .insertContent({
        type: 'codeBlock',
        attrs: { language: 'javascript' },
        content: [{ type: 'text', text: 'const value = "Nodics";' }],
      })
      .run();
  };

  const insertTable = () => {
    editor
      ?.chain()
      .focus()
      .insertTable({ cols: 3, rows: 3, withHeaderRow: true })
      .run();
  };

  const previewDocument = editor?.getJSON() as CmsRichTextDocument | undefined;

  return (
    <Stack spacing={1.5}>
      <Paper
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: `${String(axisTokens.radius.small)}px`,
          overflow: 'hidden',
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
            bgcolor: alpha(axisTokens.color.charcoal[900], 0.025),
            borderBottom: 1,
            borderColor: 'divider',
            flexWrap: 'wrap',
            gap: 0.5,
            px: 1,
            py: 0.75,
          }}
        >
          <Typography
            color="text.secondary"
            sx={{ mr: 0.5, minWidth: 72 }}
            variant="overline"
          >
            Formatting
          </Typography>
          {commandButton(
            'H2',
            'format',
            Boolean(editor?.isActive('heading', { level: 2 })),
            !editor,
            () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
          )}
          {commandButton(
            'Bold',
            'format-bold',
            Boolean(editor?.isActive('bold')),
            !editor,
            () => editor?.chain().focus().toggleBold().run(),
          )}
          {commandButton(
            'Italic',
            'format-italic',
            Boolean(editor?.isActive('italic')),
            !editor,
            () => editor?.chain().focus().toggleItalic().run(),
          )}
          {commandButton(
            'Underline',
            'format-underline',
            Boolean(editor?.isActive('underline')),
            !editor,
            () => editor?.chain().focus().toggleUnderline().run(),
          )}
          {commandButton(
            'List',
            'format-list',
            Boolean(editor?.isActive('bulletList')),
            !editor,
            () => editor?.chain().focus().toggleBulletList().run(),
          )}
          {commandButton(
            'Quote',
            'format-quote',
            Boolean(editor?.isActive('blockquote')),
            !editor,
            () => editor?.chain().focus().toggleBlockquote().run(),
          )}
          <Tooltip title="Code block">
            <span>
              <IconButton
                aria-label="Code"
                disabled={!editor}
                size="small"
                sx={{
                  bgcolor: editor?.isActive('codeBlock')
                    ? alpha(axisTokens.color.signatureGold, 0.18)
                    : 'transparent',
                  border: 1,
                  borderColor: editor?.isActive('codeBlock')
                    ? alpha(axisTokens.color.signatureGold, 0.5)
                    : 'transparent',
                  color: editor?.isActive('codeBlock')
                    ? 'text.primary'
                    : 'text.secondary',
                  height: 28,
                  minHeight: 28,
                  minWidth: 28,
                  p: 0,
                  width: 28,
                  '& .MuiSvgIcon-root': {
                    fontSize: 17,
                  },
                }}
                onClick={insertCodeBlock}
              >
                <ShellIcon fontSize="small" name="format-code" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Insert table">
            <span>
              <IconButton
                aria-label="Table"
                disabled={!editor}
                size="small"
                sx={{
                  color: 'text.secondary',
                  height: 28,
                  minHeight: 28,
                  minWidth: 28,
                  p: 0,
                  width: 28,
                  '& .MuiSvgIcon-root': {
                    fontSize: 17,
                  },
                }}
                onClick={insertTable}
              >
                <ShellIcon fontSize="small" name="format-table" />
              </IconButton>
            </span>
          </Tooltip>
          <Divider flexItem orientation="vertical" />
          <Tooltip title="Undo">
            <span>
              <IconButton
                aria-label="Undo"
                disabled={!editor}
                size="small"
                sx={{
                  color: 'text.secondary',
                  height: 28,
                  minHeight: 28,
                  minWidth: 28,
                  p: 0,
                  width: 28,
                  '& .MuiSvgIcon-root': {
                    fontSize: 17,
                  },
                }}
                onClick={() => editor?.chain().focus().undo().run()}
              >
                <ShellIcon fontSize="small" name="undo" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo">
            <span>
              <IconButton
                aria-label="Redo"
                disabled={!editor}
                size="small"
                sx={{
                  color: 'text.secondary',
                  height: 28,
                  minHeight: 28,
                  minWidth: 28,
                  p: 0,
                  width: 28,
                  '& .MuiSvgIcon-root': {
                    fontSize: 17,
                  },
                }}
                onClick={() => editor?.chain().focus().redo().run()}
              >
                <ShellIcon fontSize="small" name="redo" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        <Box
          sx={{
            '& .cms-rich-text-editor': {
              color: 'text.primary',
              fontSize: '0.95rem',
              lineHeight: 1.65,
              minHeight: 300,
              outline: 0,
              p: 2,
            },
            '& .cms-rich-text-editor > *:first-of-type': { mt: 0 },
            '& .cms-rich-text-editor h1, & .cms-rich-text-editor h2, & .cms-rich-text-editor h3':
              {
                lineHeight: 1.18,
              },
            '& .cms-rich-text-editor img': {
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: `${String(axisTokens.radius.small)}px`,
              maxHeight: 420,
              maxWidth: '100%',
            },
            '& .cms-rich-text-editor pre': {
              bgcolor: 'grey.900',
              borderRadius: `${String(axisTokens.radius.small)}px`,
              color: 'grey.100',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              overflowX: 'auto',
              p: 2,
            },
            '& .cms-rich-text-editor table': {
              borderCollapse: 'collapse',
              width: '100%',
            },
            '& .cms-rich-text-editor td, & .cms-rich-text-editor th': {
              border: '1px solid',
              borderColor: 'divider',
              p: 1,
            },
            '& .is-editor-empty:first-of-type::before': {
              color: 'text.disabled',
              content: 'attr(data-placeholder)',
              float: 'left',
              height: 0,
              pointerEvents: 'none',
            },
          }}
        >
          <EditorContent editor={editor} />
        </Box>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          bgcolor: alpha(axisTokens.color.charcoal[900], 0.018),
          border: 1,
          borderColor: 'divider',
          borderRadius: `${String(axisTokens.radius.small)}px`,
          p: 1.25,
        }}
      >
        <Stack spacing={1}>
          <Typography color="text.secondary" variant="subtitle2">
            Add references and media
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr auto' },
            }}
          >
            <TextField
              label="Link text"
              size="small"
              value={linkText}
              onChange={(event) => setLinkText(event.target.value)}
            />
            <TextField
              label="Link URL"
              size="small"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
            />
            <Button
              disabled={!editor || !linkUrl.trim()}
              startIcon={<ShellIcon name="reference" />}
              sx={{ whiteSpace: 'nowrap' }}
              variant="text"
              onClick={insertLink}
            >
              Insert link
            </Button>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr auto' },
            }}
          >
            <TextField
              label="Image alt text"
              size="small"
              value={imageAlt}
              onChange={(event) => setImageAlt(event.target.value)}
            />
            <TextField
              label="Image URL"
              size="small"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
            />
            <Button
              disabled={!editor || !imageUrl.trim()}
              startIcon={<ShellIcon name="media" />}
              sx={{ whiteSpace: 'nowrap' }}
              variant="text"
              onClick={insertImage}
            >
              Insert image
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', xl: '0.7fr 1.3fr' },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            bgcolor: alpha(axisTokens.color.charcoal[900], 0.018),
            border: 1,
            borderColor: 'divider',
            borderRadius: `${String(axisTokens.radius.small)}px`,
            p: 1.75,
          }}
        >
          <Typography sx={{ mb: 0.75 }} variant="subtitle2">
            Staged rich text
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Content is saved as a reusable CMS rich text component and translated into
            documentation blocks for review before Online publication.
          </Typography>
        </Paper>
        <Paper
          elevation={0}
          sx={{
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: `${String(axisTokens.radius.small)}px`,
            minHeight: 340,
            p: 2.5,
          }}
        >
          <Typography color="text.secondary" sx={{ mb: 2 }} variant="subtitle2">
            Live preview
          </Typography>
          {previewDocument ? (
            <CmsRichTextDocumentRenderer
              code="cms-rich-text-preview"
              document={previewDocument}
            />
          ) : null}
        </Paper>
      </Box>
    </Stack>
  );
}
