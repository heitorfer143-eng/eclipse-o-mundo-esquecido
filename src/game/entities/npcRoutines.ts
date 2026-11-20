import * as THREE from 'three'
import type { NpcDef } from '../data/types'

export function npcDailyDestination(home: THREE.Vector3, routine: NpcDef['routine'], daypart: string, stormy: boolean): THREE.Vector3 {
  if (stormy || daypart === 'night' && routine !== 'vigiar') return home.clone()
  const shift = routine === 'forja' ? [1.1, -0.6]
    : routine === 'vender' ? [1.4, 0.7]
      : routine === 'pescar' ? [1.7, 1.1]
        : routine === 'vigiar' ? [0, daypart === 'night' ? -3 : -1.5]
          : routine === 'orar' ? [-1.1, 0.7]
            : routine === 'caminhar' ? [0.3, 0.2]
              : [0, 0]
  return new THREE.Vector3(home.x + shift[0], home.y, home.z + shift[1])
}

export function npcAmbientLine(
  barks: readonly string[],
  context: { timeOfDay: number; weather: string },
  roll = 0,
): string | undefined {
  const hour = Math.floor(((context.timeOfDay % 1) + 1) % 1 * 24)
  const contextual = context.weather === 'tempestade' ? ['Esse céu está carregado demais.']
    : context.weather === 'chuva' ? ['A chuva não vai parar tão cedo.']
      : context.weather === 'neve' ? ['O frio está mordendo hoje.']
        : context.weather === 'areia' ? ['Cubra o rosto; a areia está forte.']
          : context.weather === 'neblina' ? ['Mal consigo enxergar a trilha.']
            : hour < 6 || hour >= 21 ? ['A noite esconde mais do que devia.']
              : hour < 10 ? ['O dia mal começou.']
                : hour >= 18 ? ['As luzes da vila já vão acender.'] : []
  const lines = [...barks, ...contextual]
  return lines.length ? lines[Math.min(lines.length - 1, Math.floor(Math.max(0, Math.min(0.999999, roll)) * lines.length))] : undefined
}
