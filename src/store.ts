import { writable } from 'svelte/store';

export const boxSizeStore = writable<BoxSize>({
    width: window.innerWidth,
    height: window.innerHeight,
    oldHeight: window.innerHeight,
    oldWidth: window.innerWidth
});
