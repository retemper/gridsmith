import { defineConfig } from 'vitepress';

// VitePress requires a default export from .vitepress/config.ts
// eslint-disable-next-line import-x/no-default-export
export default defineConfig({
  title: 'Gridsmith',
  description: 'MIT-licensed data grid with Excel-grade editing.',
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,

  head: [
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#1e293b' }],
    ['meta', { property: 'og:title', content: 'Gridsmith' }],
    [
      'meta',
      {
        property: 'og:description',
        content: 'MIT-licensed data grid with Excel-grade editing. No Pro tier, ever.',
      },
    ],
  ],

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'Guides', link: '/guides/editing', activeMatch: '/guides/' },
      { text: 'API', link: '/api/', activeMatch: '/api/' },
      { text: 'Examples', link: '/examples/', activeMatch: '/examples/' },
      {
        text: 'Migration',
        items: [
          { text: 'From Handsontable', link: '/migration/handsontable' },
          { text: 'From AG Grid', link: '/migration/ag-grid' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Core Concepts', link: '/guide/concepts' },
          ],
        },
      ],

      '/guides/': [
        {
          text: 'Editing',
          items: [
            { text: 'Cell Editing', link: '/guides/editing' },
            { text: 'Custom Editors', link: '/guides/custom-editors' },
            { text: 'Validation', link: '/guides/validation' },
            { text: 'Undo / Redo', link: '/guides/undo-redo' },
          ],
        },
        {
          text: 'Interaction',
          items: [
            { text: 'Selection', link: '/guides/selection' },
            { text: 'Clipboard', link: '/guides/clipboard' },
            { text: 'Fill Handle', link: '/guides/fill-handle' },
            { text: 'Keyboard Navigation', link: '/guides/keyboard-navigation' },
          ],
        },
        {
          text: 'Data',
          items: [
            { text: 'Sort & Filter', link: '/guides/sort-filter' },
            { text: 'Async Data', link: '/guides/async-data' },
            { text: 'Change Tracking', link: '/guides/change-tracking' },
          ],
        },
        {
          text: 'Layout',
          items: [
            { text: 'Columns', link: '/guides/columns' },
            { text: 'Group Headers', link: '/guides/group-headers' },
          ],
        },
        {
          text: 'Quality',
          items: [{ text: 'Accessibility', link: '/guides/accessibility' }],
        },
      ],

      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Overview', link: '/examples/' },
            { text: 'Basic', link: '/examples/basic' },
            { text: 'Editing', link: '/examples/editing' },
            { text: 'Large Dataset', link: '/examples/large-dataset' },
            { text: 'Async Data', link: '/examples/async' },
            { text: 'Custom Editor', link: '/examples/custom-editor' },
          ],
        },
      ],

      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: '@gridsmith/core', link: '/api/core' },
            { text: '@gridsmith/react', link: '/api/react' },
            { text: 'Events', link: '/api/events' },
            { text: 'Types', link: '/api/types' },
          ],
        },
      ],

      '/migration/': [
        {
          text: 'Migration',
          items: [
            { text: 'From Handsontable', link: '/migration/handsontable' },
            { text: 'From AG Grid', link: '/migration/ag-grid' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/retemper/gridsmith' }],

    editLink: {
      pattern: 'https://github.com/retemper/gridsmith/edit/main/apps/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Retemper',
    },

    search: {
      provider: 'local',
    },

    outline: { level: [2, 3] },
  },
});
