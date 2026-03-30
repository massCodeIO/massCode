import { defineConfig } from 'vitepress'
import { version } from './_data/assets.json'

const description = 'Free, open-source developer workspace with code snippets, markdown notes, math notebook, and built-in dev tools.'
const ogDescription = 'Free, open-source developer workspace: code snippets, notes, math notebook, and 20+ dev tools. All data stored locally.'
const ogImage = 'https://masscode.io/og-image.png'
const ogTitle = 'massCode'
const ogUrl = 'https://masscode.io'
const gsv = 'h-rU1tSutO83wOyvi4syrk_XTvgennlUPkL6fMmq5cI'

export default defineConfig({
  title: 'massCode',
  description,

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/logo-64w.png' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: ogTitle }],
    ['meta', { property: 'og:image', content: ogImage }],
    ['meta', { property: 'og:url', content: ogUrl }],
    ['meta', { property: 'og:description', content: ogDescription }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'google-site-verification', content: gsv }],
  ],

  themeConfig: {
    logo: '/logo-64w.png',

    nav: [
      { text: 'Documentation', link: '/documentation/' },
      { text: 'Donate', link: '/donate/' },
      {
        text: version,
        items: [
          { text: 'Download', link: '/download/' },
          { text: 'Change Log', link: 'https://github.com/massCodeIO/massCode/releases' },
        ],
      },
    ],

    sidebar: {
      '/documentation/': [
        {
          text: 'General',
          items: [
            { text: 'Overview', link: '/documentation/' },
            { text: 'Storage', link: '/documentation/storage' },
            { text: 'Sync', link: '/documentation/sync' },
            { text: 'Themes', link: '/documentation/themes' },
          ],
        },
        {
          text: 'Code',
          items: [
            { text: 'Library', link: '/documentation/code/library' },
            { text: 'Folders', link: '/documentation/code/folders' },
            { text: 'Tags', link: '/documentation/code/tags' },
            { text: 'Snippets', link: '/documentation/code/snippets' },
            { text: 'Fragments', link: '/documentation/code/fragments' },
            { text: 'Description', link: '/documentation/code/description' },
            { text: 'Search', link: '/documentation/code/search' },
          ],
        },
        {
          text: 'Notes',
          items: [
            { text: 'Notes', link: '/documentation/notes/' },
            { text: 'Library', link: '/documentation/notes/library' },
            { text: 'Folders', link: '/documentation/notes/folders' },
            { text: 'Tags', link: '/documentation/notes/tags' },
            { text: 'Mermaid', link: '/documentation/notes/mermaid' },
            { text: 'Mindmap', link: '/documentation/notes/mindmap' },
            { text: 'Presentation', link: '/documentation/notes/presentation' },
            { text: 'Search', link: '/documentation/notes/search' },
          ],
        },
        {
          text: 'Math',
          items: [
            { text: 'Math Notebook', link: '/documentation/math/' },
          ],
        },
        {
          text: 'Tools',
          items: [
            { text: 'Developer Tools', link: '/documentation/tools/' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'twitter', link: 'https://twitter.com/anton_reshetov' },
      { icon: 'github', link: 'https://github.com/massCodeIO/massCode' },
    ],

    footer: {
      message: 'massCode released under the AGPL v3 License.<br>Snippet collection released under the CC-BY-4.0 License.',
      copyright: 'Copyright © 2019-present Anton Reshetov',
    },

    editLink: {
      pattern: 'https://github.com/massCodeIO/massCode/edit/main/docs/website/:path',
      text: 'Edit this page on GitHub',
    },

    carbonAds: {
      code: 'CE7DEKQM',
      placement: 'masscodeio',
    },

    algolia: {
      appId: '92Q94XIWQY',
      apiKey: '2d71b8791faff1435f75479ffbea2f2e',
      indexName: 'masscode',
    },
  },
})
