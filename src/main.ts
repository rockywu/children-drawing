import { createApp } from "vue";
import App from "./App.vue";
import { dialogFocus } from "./dialogFocus";
import { setupWebApp } from "./pwa";
import "./style.css";

setupWebApp();
createApp(App).directive("dialog-focus", dialogFocus).mount("#app");
