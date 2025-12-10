import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
	plugins: [svelte()],
	// GitHub Pages で https://<USER>.github.io/text-speech/ に出す前提
	// リポジトリ名が違う場合は '/<REPO>/' に書き換え
	base: "/text-speech/"
});
