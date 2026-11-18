import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

/** GitHub Pages needs public copies; Manus builds use the registered Storage CDN URLs. */
export function omitManagedModelCopies() {
  return {
    name: 'eclipse-omit-cdn-model-copies',
    apply: 'build',
    async closeBundle() {
      if (process.env.GITHUB_ACTIONS === 'true' || !process.env.MANUS_API_URL) return
      await rm(resolve('dist/models'), { recursive: true, force: true })
    },
  }
}
