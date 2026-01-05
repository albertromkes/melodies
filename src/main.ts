import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { initCapacitor } from './lib/utils/capacitor'

// Initialize Capacitor plugins (only runs on native platforms)
initCapacitor()

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
