import Foundation
import Combine

/// 1桁分の珠の状態。
/// - heaven: 五珠が梁に付いているか（true なら +5）
/// - earth:  梁に付いている一珠の数（0...4）
struct Column: Identifiable, Equatable {
    let id = UUID()
    var heaven: Bool = false
    var earth: Int = 0

    var value: Int { (heaven ? 5 : 0) + earth }

    mutating func clear() {
        heaven = false
        earth = 0
    }
}

final class SorobanModel: ObservableObject {
    /// 桁数（右が一の位）。標準的なそろばんは 13 桁。
    static let columnCount = 13

    @Published var columns: [Column] = Array(repeating: Column(), count: SorobanModel.columnCount)

    /// 十進表示用の合計値。
    /// 桁数が多いと Int64 を超えうるため Decimal で計算する。
    var totalValue: Decimal {
        var total: Decimal = 0
        var place: Decimal = 1
        for col in columns.reversed() {
            total += Decimal(col.value) * place
            place *= 10
        }
        return total
    }

    /// 五珠をタップした時の挙動。
    func toggleHeaven(at index: Int) {
        guard columns.indices.contains(index) else { return }
        columns[index].heaven.toggle()
    }

    /// 一珠をタップした時の挙動。
    /// row は梁から数えた位置 (1...4)。
    /// - row 以下の珠が全て梁に付くようにする / 既に付いていれば row 以上を払う。
    func tapEarth(at index: Int, row: Int) {
        guard columns.indices.contains(index), (1...4).contains(row) else { return }
        if columns[index].earth >= row {
            // 既にこの位置の珠は付いている → 自分以上の珠を払う
            columns[index].earth = row - 1
        } else {
            // 付いていない → 自分まで珠を上げる
            columns[index].earth = row
        }
    }

    func reset() {
        for i in columns.indices { columns[i].clear() }
    }
}
