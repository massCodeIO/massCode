import { defineConfig } from 'vitepress'
import { version } from './_data/assets.json'

const description = 'Code snippets manager for developers, developed using web technologies.'
const ogDescription = 'A free and open source code snippets manager for developers'
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
          text: 'Essentials',
          items: [
            { text: 'Layout', link: '/documentation/' },
            { text: 'Library', link: '/documentation/library' },
            { text: 'Folders', link: '/documentation/folders' },
            { text: 'Tags', link: '/documentation/tags' },
            { text: 'Snippets', link: '/documentation/snippets' },
            { text: 'Fragments', link: '/documentation/fragments' },
            { text: 'Description', link: '/documentation/description' },
            { text: 'Search', link: '/documentation/search' },
            { text: 'Storage', link: '/documentation/storage' },
            { text: 'Sync', link: '/documentation/sync' },
            { text: 'Themes', link: '/documentation/themes' },
          ],
        },
        {
          text: 'Markdown',
          items: [
            { text: 'Markdown', link: '/documentation/markdown.md' },
          ],
        },
        {
          text: 'Math',
          items: [
            { text: 'Math Notebook', link: '/documentation/math-notebook.md' },
          ],
        },
        {
          text: 'Tools',
          items: [
            { text: 'Developers Tools', link: '/documentation/devtools.md' },
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
