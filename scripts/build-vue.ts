import { build } from 'vite'
import config from '../config/vite'

export default function () {
  return build({
    base: './',
    ...config,
    mode: 'production'
  })
}
