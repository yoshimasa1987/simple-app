import SwiftUI

/// そろばん本体（横並びの全桁＋枠）
struct SorobanBoardView: View {
    @ObservedObject var model: SorobanModel

    var body: some View {
        // 枠
        ZStack {
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(red: 0.40, green: 0.22, blue: 0.10))
                .shadow(radius: 4)

            HStack(spacing: 4) {
                ForEach(model.columns.indices, id: \.self) { i in
                    ColumnView(
                        column: $model.columns[i],
                        placeLabel: placeLabel(for: i),
                        onToggleHeaven: { model.toggleHeaven(at: i) },
                        onTapEarth: { row in model.tapEarth(at: i, row: row) }
                    )
                }
            }
            .padding(12)
        }
    }

    /// 右端を 1、その左を 10 … と表示。
    private func placeLabel(for index: Int) -> String {
        let exponent = model.columns.count - 1 - index
        if exponent == 0 { return "1" }
        if exponent <= 4 {
            // 10, 100, 1k, 10k はそのまま
            return "10^\(exponent)"
        }
        return "10^\(exponent)"
    }
}
