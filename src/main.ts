import { createApp } from "vue";
import App from "./App.vue";
import { dialogFocus } from "./dialogFocus";
import "./style.css";

createApp(App).directive("dialog-focus", dialogFocus).mount("#app");
