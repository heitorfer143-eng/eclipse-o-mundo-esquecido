import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { TreeKind } from './props'

export type TreePlacement = { x: number; y: number; z: number; s: number; variantRoll: number }

type TreeSource = { url: string; variants: string[] }
const BASE = `${import.meta.env.BASE_URL}assets/models/trees/temperate-forest-ecology/`
const sources: Partial<Record<TreeKind, TreeSource>> = {
  pinheiro: { url: `${BASE}temperate-forest-ecology-norway-spruce-mature-770657d8.glb`, variants: [] },
  carvalho: { url: `${BASE}temperate-forest-ecology-english-oak-mature-ac520af6.glb`, variants: [`${BASE}temperate-forest-ecology-silver-birch-mature-c3711d50.glb`] },
  morto: { url: `${BASE}temperate-forest-ecology-oak-snag-standing-7613f534.glb`, variants: [] },
}
const loader = new GLTFLoader()
const cache = new Map<string, Promise<THREE.Group>>()

function loadTree(url: string): Promise<THREE.Group> {
  let pending = cache.get(url)
  if (!pending) {
    pending = loader.loadAsync(url).then(gltf => {
      gltf.scene.updateMatrixWorld(true)
      return gltf.scene
    })
    cache.set(url, pending)
    pending.catch(() => cache.delete(url))
  }
  return pending
}

/** Replace procedural forest silhouettes with real GLB meshes, grouped by source mesh and variant. */
export function addInstancedTreeModels(group: THREE.Group, kind: TreeKind, placements: readonly TreePlacement[]): void {
  const source = sources[kind]
  if (!source || placements.length === 0) return
  const variants = [source.url, ...source.variants]
  const byVariant = new Map<string, TreePlacement[]>()
  for (const placement of placements) {
    const variant = variants[Math.min(variants.length - 1, Math.floor(placement.variantRoll * variants.length))]
    const bucket = byVariant.get(variant) ?? []
    bucket.push(placement)
    byVariant.set(variant, bucket)
  }
  for (const [url, trees] of byVariant) {
    void loadTree(url).then(scene => {
      if (!group.parent) return
      const sourceMeshes: THREE.Mesh[] = []
      scene.traverse(object => {
        const mesh = object as THREE.Mesh
        if (mesh.isMesh) sourceMeshes.push(mesh)
      })
      const positions = new THREE.Vector3()
      const scales = new THREE.Vector3()
      const quaternion = new THREE.Quaternion()
      const treeMatrix = new THREE.Matrix4()
      const instanceMatrix = new THREE.Matrix4()
      for (let meshIndex = 0; meshIndex < sourceMeshes.length; meshIndex += 1) {
        const sourceMesh = sourceMeshes[meshIndex]
        const instanced = new THREE.InstancedMesh(sourceMesh.geometry, sourceMesh.material, trees.length)
        instanced.name = 'world-tree-glb'
        instanced.castShadow = true
        instanced.receiveShadow = false
        trees.forEach((tree, index) => {
          positions.set(tree.x, tree.y - 0.15, tree.z)
          quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tree.variantRoll * Math.PI * 2)
          scales.set(tree.s * 0.27, tree.s * 0.27, tree.s * 0.27)
          treeMatrix.compose(positions, quaternion, scales)
          instanceMatrix.multiplyMatrices(treeMatrix, sourceMesh.matrixWorld)
          instanced.setMatrixAt(index, instanceMatrix)
        })
        instanced.instanceMatrix.needsUpdate = true
        instanced.computeBoundingSphere()
        group.add(instanced)
      }
      if (group.userData.glbTreeCount === undefined) {
        group.userData.glbTreeCount = trees.length
        for (const name of ['world-tree-bark', 'world-tree-foliage', 'world-nature-leaves']) {
          const fallback = group.getObjectByName(name)
          if (fallback) group.remove(fallback)
        }
      } else group.userData.glbTreeCount += trees.length
    }).catch(() => undefined)
  }
}
