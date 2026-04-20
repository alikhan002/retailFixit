import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite' // <-- Add this import

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(), 
    tailwindcss(), 
    tanstackStart(), 
    viteReact(),
    nitro() // <-- Add this to the array
  ],
})

export default config