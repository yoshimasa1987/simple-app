import { SorobanModel } from "./model.js";
import { SorobanView } from "./view.js";

const model = new SorobanModel();

new SorobanView({
  model,
  boardEl: document.getElementById("board"),
  totalEl: document.getElementById("total"),
  resetEl: document.getElementById("reset"),
});
