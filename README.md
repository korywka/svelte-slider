# svelte-slider

[Example with Svelte REPL](https://svelte.dev/repl/9b97b5175633420bb6b7211ca9765719?version=3.22.3)

```html
<Slider on:change={(event) => console.log(event.detail)} value={[0, 1]} />

<style>
    :root {
      --sliderPrimary: #FF9800;
      --sliderSecondary: rgba(0, 0, 0, 0.05);
    }
</style>
```

[Example without Svelte, vanilla JS](index.html)
