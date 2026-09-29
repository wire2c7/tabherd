import { render } from "preact";

import { App } from "./app";

import "./style.css";

const root = document.querySelector("#app");
if (root === null) {
  throw new Error("#app が見つかりません");
}
render(<App />, root);
