// DOM 描画とイベント処理。Model の変更を購読して反映する。

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

function placeLabel(exponent) {
  if (exponent === 0) return "1";
  if (exponent === 1) return "10";
  if (exponent === 2) return "100";
  if (exponent === 3) return "1K";
  if (exponent === 4) return "10K";
  return `10^${exponent}`;
}

export class SorobanView {
  constructor({ model, boardEl, totalEl, resetEl }) {
    this.model = model;
    this.boardEl = boardEl;
    this.totalEl = totalEl;
    this.resetEl = resetEl;

    this._buildBoard();
    this._bindEvents();
    this._render();

    model.subscribe(() => this._render());
  }

  _buildBoard() {
    const count = this.model.columnCount;
    const frag = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const column = document.createElement("div");
      column.className = "column";
      column.dataset.col = String(i);

      // 上段（五珠）
      const heaven = document.createElement("div");
      heaven.className = "deck deck--heaven";
      const heavenBead = document.createElement("div");
      heavenBead.className = "bead";
      heavenBead.dataset.kind = "heaven";
      heaven.appendChild(heavenBead);

      // 梁
      const beam = document.createElement("div");
      beam.className = "beam";

      // 下段（一珠 ×4）
      const earth = document.createElement("div");
      earth.className = "deck deck--earth";
      for (let row = 1; row <= 4; row++) {
        const bead = document.createElement("div");
        bead.className = "bead";
        bead.dataset.kind = "earth";
        bead.dataset.row = String(row);
        earth.appendChild(bead);
      }

      // 桁ラベル
      const exponent = count - 1 - i;
      const place = document.createElement("div");
      place.className = "place";
      place.textContent = placeLabel(exponent);

      column.append(heaven, beam, earth, place);
      frag.appendChild(column);
    }

    this.boardEl.replaceChildren(frag);
  }

  _bindEvents() {
    // 盤面はイベント委譲で1箇所だけ
    this.boardEl.addEventListener("click", (e) => {
      const bead = e.target.closest(".bead");
      if (!bead) return;
      const colEl = bead.closest(".column");
      if (!colEl) return;
      const col = Number(colEl.dataset.col);
      const kind = bead.dataset.kind;

      if (kind === "heaven") {
        this.model.toggleHeaven(col);
      } else if (kind === "earth") {
        const row = Number(bead.dataset.row);
        this.model.tapEarth(col, row);
      }
    });

    this.resetEl.addEventListener("click", () => this.model.reset());
  }

  _render() {
    // 各列の珠の is-active を更新
    const columns = this.boardEl.querySelectorAll(".column");
    for (let i = 0; i < columns.length; i++) {
      const col = this.model.columns[i];
      const heaven = columns[i].querySelector('.bead[data-kind="heaven"]');
      heaven.classList.toggle("is-active", col.heaven);

      const earthBeads = columns[i].querySelectorAll('.bead[data-kind="earth"]');
      for (const bead of earthBeads) {
        const row = Number(bead.dataset.row);
        bead.classList.toggle("is-active", row <= col.earth);
      }
    }

    this.totalEl.textContent = NUMBER_FORMAT.format(this.model.total);
  }
}
