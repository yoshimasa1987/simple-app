// 仮想そろばんの状態モデル。SwiftUI版 SorobanModel と同等の振る舞いを持つ。

export const COLUMN_COUNT = 13;

export class SorobanModel {
  constructor(columnCount = COLUMN_COUNT) {
    this.columnCount = columnCount;
    this.columns = Array.from({ length: columnCount }, () => ({
      heaven: false,
      earth: 0,
    }));
    this._listeners = new Set();
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _notify() {
    for (const fn of this._listeners) fn();
  }

  toggleHeaven(index) {
    if (index < 0 || index >= this.columnCount) return;
    this.columns[index].heaven = !this.columns[index].heaven;
    this._notify();
  }

  // row は梁から数えた一珠の位置 (1..4)
  tapEarth(index, row) {
    if (index < 0 || index >= this.columnCount) return;
    if (row < 1 || row > 4) return;
    const col = this.columns[index];
    if (col.earth >= row) {
      // この位置の珠は既に入っている → 自分以上を払う
      col.earth = row - 1;
    } else {
      // 払っている → 自分まで入れる
      col.earth = row;
    }
    this._notify();
  }

  reset() {
    for (const col of this.columns) {
      col.heaven = false;
      col.earth = 0;
    }
    this._notify();
  }

  // BigInt で合計を返す（13桁を超えても安全）
  get total() {
    let total = 0n;
    let place = 1n;
    for (let i = this.columns.length - 1; i >= 0; i--) {
      const c = this.columns[i];
      const v = (c.heaven ? 5 : 0) + c.earth;
      total += BigInt(v) * place;
      place *= 10n;
    }
    return total;
  }
}
