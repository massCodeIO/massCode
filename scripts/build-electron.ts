import { build } from 'electron-builder'
import config from '../config/electron-builder'

export default function () {
  return build({ config })
}
