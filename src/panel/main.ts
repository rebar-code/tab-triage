import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { store } from './store.svelte';

await store.start();
mount(App, { target: document.getElementById('app')! });
