import { defineConfig, type HeadConfig } from 'vitepress'
import { version } from './_data/assets.json'

const siteUrl = 'https://masscode.io'
const siteTitle = 'massCode'
const description = 'Free, open-source developer workspace with code snippets, markdown notes, math notebook, and built-in dev tools.'
const ogImage = `${siteUrl}/og-image.png`
const gsv = 'h-rU1tSutO83wOyvi4syrk_XTvgennlUPkL6fMmq5cI'

function resolvePagePath(relativePath: string) {
  if (!relativePath || relativePath === 'index.md')
    return '/'

  if (relativePath.endsWith('/index.md'))
    return `/${relativePath.slice(0, -'index.md'.length)}`

  return `/${relativePath.replace(/\.md$/, '.html')}`
}

function resolvePageUrl(relativePath: string) {
  return new URL(resolvePagePath(relativePath), siteUrl).toString()
}

function buildSeoHead({
  relativePath,
  pageTitle,
  pageDescription,
  isNotFound,
}: {
  relativePath: string
  pageTitle: string
  pageDescription: string
  isNotFound?: boolean
}): HeadConfig[] {
  if (isNotFound)
    return [['meta', { name: 'robots', content: 'noindex, nofollow' }]]

  const pageUrl = resolvePageUrl(relativePath)

  return [
    ['link', { rel: 'canonical', href: pageUrl }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: siteTitle }],
    ['meta', { property: 'og:title', content: pageTitle }],
    ['meta', { property: 'og:description', content: pageDescription }],
    ['meta', { property: 'og:url', content: pageUrl }],
    ['meta', { property: 'og:image', content: ogImage }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: pageTitle }],
    ['meta', { name: 'twitter:description', content: pageDescription }],
    ['meta', { name: 'twitter:image', content: ogImage }],
  ]
}

export default defineConfig({
  title: siteTitle,
  description,

  sitemap: {
    hostname: siteUrl,
    transformItems(items) {
      return items.filter(item => !item.url.endsWith('/404.html'))
    },
  },

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/logo-64w.png' }],
    ['meta', { name: 'google-site-verification', content: gsv }],
  ],

  transformHead({ pageData, title, description }) {
    return buildSeoHead({
      relativePath: pageData.relativePath,
      pageTitle: title,
      pageDescription: description,
      isNotFound: pageData.isNotFound,
    })
  },

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
            { text: 'Dashboard', link: '/documentation/notes/dashboard' },
            { text: 'Library', link: '/documentation/notes/library' },
            { text: 'Folders', link: '/documentation/notes/folders' },
            { text: 'Tags', link: '/documentation/notes/tags' },
            { text: 'Internal Links', link: '/documentation/notes/internal-links' },
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
            { text: 'Overview', link: '/documentation/tools/' },
            { text: 'JSON Diff', link: '/documentation/tools/json-diff' },
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
