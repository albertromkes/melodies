import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { initCapacitor } from './lib/utils/capacitor'

async function bootstrap() {
  await initCapacitor()

  mount(App, {
    target: document.getElementById('app')!,
  })
}

const app = bootstrap()

export default app
