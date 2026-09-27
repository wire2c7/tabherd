import { render } from "preact";

import { App } from "./app";

const root = document.getElementById("app");
if (root === null) {
  throw new Error("#app が見つかりません");
}
render(<App />, root);
