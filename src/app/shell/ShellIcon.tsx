import { SvgIcon, type SvgIconProps } from '@mui/material';

import { axisTokens } from '../axisTheme';

const iconPaths: Readonly<Record<string, string>> = Object.freeze({
  add: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z',
  assistant: 'M12 2a8 8 0 0 0-6.32 12.9L4 20l5.1-1.68A8 8 0 1 0 12 2Z',
  automation:
    'M7 3h10v4h-4v3.17A3.001 3.001 0 0 1 15 13v1h2v-2h4v6h-4v-2h-2v1a3 3 0 0 1-3 3H7v-4h5a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-2v2H3V9h6v2h2V7H7V3Z',
  approve: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z',
  bell: 'M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6v-5a7 7 0 0 0-5-6.71V3a2 2 0 0 0-4 0v1.29A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z',
  cart: 'M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM6.2 6l.8 2h11.8l-1.7 6H8.4L5 4H2V2h4l.2 4Z',
  commerce:
    'M4 4h16l1 5v2a3 3 0 0 1-1 2.24V21H4v-7.76A3 3 0 0 1 3 11V9l1-5Zm2 10v5h12v-5.1a3.02 3.02 0 0 1-3-1.18 3.02 3.02 0 0 1-6 0A3.02 3.02 0 0 1 6 13.9Zm-.2-8-.8 3v2a1 1 0 0 0 2 0V9l.4-3H5.8Zm3.82 0L9 9v2a1 1 0 0 0 2 0V6H9.62ZM13 6v5a1 1 0 0 0 2 0V9l-.62-3H13Zm3.4 0 .6 3v2a1 1 0 0 0 2 0V9l-.8-3h-1.8Z',
  content: 'M5 3h10l4 4v14H5V3Zm2 2v14h10V8h-3V5H7Zm2 7h6v2H9v-2Zm0 4h6v2H9v-2Z',
  cms: 'M4 5h12v12H4V5Zm2 2v8h8V7H6Zm2 2h4v2H8V9Zm9-1h3v12H8v-2h9V8Z',
  cronjob:
    'M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.01 8.01 0 0 1-8 8Zm1-13h-2v6l5 3 1-1.73-4-2.27V7Z',
  'chevron-down': 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41Z',
  'chevron-left': 'M15.41 7.41 10.83 12l4.58 4.59L14 18l-6-6 6-6 1.41 1.41Z',
  'chevron-right': 'M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41Z',
  'chevron-up': 'M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41Z',
  dashboard:
    'M3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v5h-8V3Zm2 2v1h4V5h-4Zm-2 5h8v11h-8V10Zm2 2v7h4v-7h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Z',
  download:
    'M11 3h2v9.17l3.59-3.58L18 10l-6 6-6-6 1.41-1.41L11 12.17V3ZM5 19h14v2H5v-2Z',
  health:
    'M3 4h18v16H3V4Zm2 2v12h14V6H5Zm1 5h3l1.25-3 2.5 7 1.5-4H18v2h-2.35l-2.9 7-2.5-7L9 16H6v-5Z',
  hidden:
    'M2 4.27 3.28 3 21 20.72 19.73 22l-3.08-3.08A10.78 10.78 0 0 1 12 20C7 20 3.27 16.89 1 12.5a16.96 16.96 0 0 1 4.13-5.18L2 4.27Zm4.55 4.47A14.98 14.98 0 0 0 3.28 12.5C5.18 15.74 8.13 18 12 18c1.1 0 2.13-.18 3.08-.51l-1.76-1.76A4 4 0 0 1 8.77 11.18L6.55 8.74Zm4.03 4.03a2 2 0 0 0 2.65 2.65l-2.65-2.65ZM12 5c5 0 8.73 3.11 11 7.5a16.97 16.97 0 0 1-3.23 4.34l-1.42-1.42a14.8 14.8 0 0 0 1.38-1.53c.36-.46.69-.92.99-1.39C18.82 9.26 15.87 7 12 7c-.71 0-1.39.08-2.04.22L8.35 5.6A10.78 10.78 0 0 1 12 5Zm.2 3.01A4 4 0 0 1 16 11.8l-3.8-3.79Z',
  info: 'M11 10h2v8h-2v-8Zm0-4h2v2h-2V6Zm1-4a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z',
  import:
    'M5 3h9l5 5v13H5V3Zm2 2v14h10V9h-4V5H7Zm4 4h2v5.17l1.59-1.58L16 14l-4 4-4-4 1.41-1.41L11 14.17V9Z',
  folder: 'M3 5h7l2 2h9v12H3V5Zm2 4v8h14V9H5Zm0-2h5.17l-2-2H5v2Z',
  format:
    'M4 4h16v4H4V4Zm2 2v1h12V6H6Zm-2 5h7v9H4v-9Zm2 2v5h3v-5H6Zm7-2h7v2h-7v-2Zm0 4h7v2h-7v-2Zm0 4h5v2h-5v-2Z',
  'format-bold':
    'M6 4h7.25a4.25 4.25 0 0 1 2.86 7.39A4.75 4.75 0 0 1 13.75 20H6V4Zm3 6.5h4.1a1.75 1.75 0 1 0 0-3.5H9v3.5Zm0 6.5h4.55a2 2 0 1 0 0-4H9v4Z',
  'format-code':
    'm8.7 16.3-5-5 5-5 1.4 1.4-3.58 3.6 3.58 3.6-1.4 1.4Zm6.6 0-1.4-1.4 3.58-3.6-3.58-3.6 1.4-1.4 5 5-5 5ZM12.7 4l1.9.62L11.3 20l-1.9-.62L12.7 4Z',
  'format-italic': 'M10 4h9v2h-3.25l-3.5 12H15v2H6v-2h3.25l3.5-12H10V4Z',
  'format-list':
    'M7 5h14v2H7V5Zm0 6h14v2H7v-2Zm0 6h14v2H7v-2ZM3 5h2v2H3V5Zm0 6h2v2H3v-2Zm0 6h2v2H3v-2Z',
  'format-quote':
    'M4 5h7v7H7.8A4.2 4.2 0 0 0 12 16.2V19a7 7 0 0 1-8-7V5Zm10 0h7v7h-3.2A4.2 4.2 0 0 0 22 16.2V19a7 7 0 0 1-8-7V5Z',
  'format-table':
    'M4 5h16v14H4V5Zm2 2v3h4V7H6Zm6 0v3h6V7h-6Zm6 5h-6v5h6v-5Zm-8 5v-5H6v5h4Z',
  'format-underline': 'M7 4h2v7a3 3 0 1 0 6 0V4h2v7a5 5 0 1 1-10 0V4Zm-1 15h12v2H6v-2Z',
  gallery:
    'M4 5h13v10H4V5Zm2 2v5.17l2.5-2.5 2 2L13.17 9 15 10.83V7H6Zm-1 10h14V8h2v11H5v-2Z',
  menu: 'M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z',
  media:
    'M4 5h16v14H4V5Zm2 2v10h12V7H6Zm2 8h8l-2.7-3.6-2 2.6-1.4-1.7L8 15Zm7.5-7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
  module: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
  moon: 'M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5ZM11.4 5.34a9 9 0 0 0 7.26 7.26 6.5 6.5 0 1 1-7.26-7.26Z',
  operations:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 5.5-2.07.8a7.1 7.1 0 0 1-.58 1.4l.9 2.03-1.52 1.52-2.03-.9a7.1 7.1 0 0 1-1.4.58L13.5 21h-3l-.8-2.07a7.1 7.1 0 0 1-1.4-.58l-2.03.9-1.52-1.52.9-2.03a7.1 7.1 0 0 1-.58-1.4L3 13.5v-3l2.07-.8c.15-.49.35-.96.58-1.4l-.9-2.03 1.52-1.52 2.03.9c.44-.23.91-.43 1.4-.58L10.5 3h3l.8 2.07c.49.15.96.35 1.4.58l2.03-.9 1.52 1.52-.9 2.03c.23.44.43.91.58 1.4l2.07.8v3Z',
  organization:
    'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 21v-3a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v3H2Zm13.5 0v-3a6.48 6.48 0 0 0-1.2-3.76A4.5 4.5 0 0 1 22 17.5V21h-6.5Z',
  pricing:
    'M3 4v7l9 9 9-9-7-7H3Zm2 2h8.17L18.17 11 12 17.17l-7-7V6Zm3 1.5A1.5 1.5 0 1 0 8 10.5a1.5 1.5 0 0 0 0-3Z',
  product:
    'M12 2 3 6.5v11L12 22l9-4.5v-11L12 2Zm0 2.24 5.74 2.87L12 10 6.26 7.11 12 4.24ZM5 8.74l6 3v7.74l-6-3V8.74Zm8 10.74v-7.74l6-3v7.74l-6 3Z',
  profile:
    'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-8a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM4 22v-3a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v3h-2v-3a5 5 0 0 0-5-5h-2a5 5 0 0 0-5 5v3H4Z',
  registry:
    'M4 3h6v6H4V3Zm10 0h6v6h-6V3ZM4 15h6v6H4v-6Zm10 0h6v6h-6v-6ZM9 6h6v2H9V6Zm2 1h2v10h-2V7Zm-2 9h6v2H9v-2Z',
  reference:
    'M8 12a4 4 0 0 1 4-4h3V6h-3a6 6 0 0 0 0 12h3v-2h-3a4 4 0 0 1-4-4Zm3 1h6v-2h-6v2Zm1-5h3a4 4 0 0 1 0 8h-3v2h3a6 6 0 0 0 0-12h-3v2Z',
  recent:
    'M12 2a10 10 0 1 0 9.54 13h-2.12A8 8 0 1 1 20 12h-3l4 4 4-4h-3A10 10 0 0 0 12 2Zm1 5h-2v6l5 3 1-1.73-4-2.27V7Z',
  refresh:
    'M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.45 5h-2.13A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h8V3l-3.35 3.35Z',
  search:
    'M10.5 4a6.5 6.5 0 1 0 3.98 11.64L19.85 21 21 19.85l-5.36-5.37A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z',
  schema:
    'M12 2 3 6.5v11L12 22l9-4.5v-11L12 2Zm0 2.24 5.36 2.68L12 9.6 6.64 6.92 12 4.24ZM5 8.54l6 3v7.94l-6-3V8.54Zm8 10.94v-7.94l6-3v7.94l-6 3Zm-5-5.72 2 1v2.24l-2-1v-2.24Zm6-1 2-1v2.24l-2 1v-2.24Z',
  tasks: 'M5 3h14v18H5V3Zm2 2v14h10V5H7Zm2 3h6v2H9V8Zm0 4h6v2H9v-2Zm0 4h4v2H9v-2Z',
  undo: 'M8 7V3L2 9l6 6v-4h7a4 4 0 0 1 0 8h-4v2h4a6 6 0 0 0 0-12H8V7Z',
  redo: 'M16 7V3l6 6-6 6v-4H9a4 4 0 0 0 0 8h4v2H9A6 6 0 0 1 9 9h7V7Z',
  visible:
    'M12 5c5 0 8.73 3.11 11 7.5C20.73 16.89 17 20 12 20S3.27 16.89 1 12.5C3.27 8.11 7 5 12 5Zm0 2c-3.87 0-6.82 2.26-8.72 5.5C5.18 15.74 8.13 18 12 18s6.82-2.26 8.72-5.5C18.82 9.26 15.87 7 12 7Zm0 2a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm0 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
  store:
    'M4 3h16l2 6v2a4 4 0 0 1-2 3.46V21H4v-6.54A4 4 0 0 1 2 11V9l2-6Zm1.44 2L4 9v2a2 2 0 0 0 4 0V9l.5-4H5.44ZM10.5 5 10 9v2a2 2 0 0 0 4 0V9l-.5-4h-3Zm5 0 .5 4v2a2 2 0 0 0 4 0V9l-1.44-4H15.5ZM6 15v4h12v-4.13a4 4 0 0 1-3-1.36A4 4 0 0 1 9 13.5 4 4 0 0 1 6 14.87V15Z',
  storage:
    'M12 3C7 3 4 4.34 4 6v12c0 1.66 3 3 8 3s8-1.34 8-3V6c0-1.66-3-3-8-3Zm0 2c3.87 0 6 .88 6 1s-2.13 1-6 1-6-.88-6-1 2.13-1 6-1Zm6 4.2V12c0 .12-2.13 1-6 1s-6-.88-6-1V9.2C7.37 9.7 9.45 10 12 10s4.63-.3 6-.8Zm0 5V18c0 .12-2.13 1-6 1s-6-.88-6-1v-3.8c1.37.5 3.45.8 6 .8s4.63-.3 6-.8Z',
  storefront:
    'M3 3h18v14H3V3Zm2 2v10h14V5H5Zm3 14h8v2H8v-2Zm1-11h6l1 3v1a2 2 0 0 1-4 0 2 2 0 0 1-4 0v-1l1-3Z',
  sun: 'M12 4V1h2v3h-2Zm0 19v-3h2v3h-2ZM4.22 5.64 2.1 3.52l1.42-1.42 2.12 2.12-1.42 1.42Zm13.44 13.44-2.12-2.12 1.42-1.42 2.12 2.12-1.42 1.42ZM4 13H1v-2h3v2Zm19 0h-3v-2h3v2ZM3.52 21.9 2.1 20.48l2.12-2.12 1.42 1.42-2.12 2.12Zm15.56-15.56-1.42-1.42 2.12-2.12 1.42 1.42-2.12 2.12ZM13 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
  workflow:
    'M5 3h6v6H5V3Zm2 2v2h2V5H7Zm6 10h6v6h-6v-6Zm2 2v2h2v-2h-2ZM9 8h2v3h4a3 3 0 0 1 3 3v1h-2v-1a1 1 0 0 0-1-1h-4a4 4 0 0 1-4-4V8h2Z',
});

const aliases: Readonly<Record<string, string>> = Object.freeze({
  price: 'pricing',
  inventory: 'product',
  process: 'automation',
  customer: 'organization',
  employee: 'organization',
  experience: 'content',
  platform: 'operations',
  integration: 'operations',
  settings: 'operations',
  notifications: 'bell',
  component: 'module',
  layout: 'dashboard',
  page: 'content',
  route: 'reference',
  template: 'cms',
});

interface ShellIconProps extends SvgIconProps {
  readonly name: string;
}

export function ShellIcon({ name, ...props }: ShellIconProps) {
  const normalizedName = name.trim().toLocaleLowerCase();
  const resolvedName = aliases[normalizedName] ?? normalizedName;
  const path = iconPaths[resolvedName] ?? iconPaths.module;

  return (
    <SvgIcon {...props}>
      <path d={path} />
      {resolvedName === 'assistant' ? (
        <path
          d="M9 10h2V8h2v2h2v2h-2v2h-2v-2H9v-2Z"
          fill={axisTokens.color.charcoal[950]}
        />
      ) : null}
    </SvgIcon>
  );
}
