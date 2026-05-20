import SwiftUI

/// そろばん1桁分の縦列。
/// 上段（五珠 1個）と下段（一珠 4個）を梁で区切って描く。
/// 入っている珠は梁に密着し、払った珠は反対側に寄る。
struct ColumnView: View {
    @Binding var column: Column
    /// 桁ラベル（最右が "1"、その左が "10" …）
    let placeLabel: String
    let onToggleHeaven: () -> Void
    let onTapEarth: (Int) -> Void

    private let beadHeight: CGFloat = 22
    private let beadWidth: CGFloat = 30
    private let upperHeight: CGFloat = 28   // 五珠 1個ぶんの可動域
    private let lowerHeight: CGFloat = 92   // 一珠 4個ぶんの可動域

    var body: some View {
        VStack(spacing: 2) {
            heavenDeck
            beam
            earthDeck
            Text(placeLabel)
                .font(.system(size: 10, weight: .medium, design: .monospaced))
                .foregroundColor(.secondary)
                .frame(height: 14)
        }
    }

    // MARK: - 上段（五珠）

    private var heavenDeck: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 4)
                .fill(Color(red: 0.95, green: 0.88, blue: 0.72))
                .frame(width: beadWidth + 6, height: upperHeight)

            VStack(spacing: 0) {
                if !column.heaven {
                    BeadView(isActive: false, action: onToggleHeaven)
                        .frame(width: beadWidth, height: beadHeight)
                    Spacer(minLength: 0)
                } else {
                    Spacer(minLength: 0)
                    BeadView(isActive: true, action: onToggleHeaven)
                        .frame(width: beadWidth, height: beadHeight)
                }
            }
            .frame(width: beadWidth + 6, height: upperHeight)
            .animation(.easeInOut(duration: 0.15), value: column.heaven)
        }
    }

    // MARK: - 梁

    private var beam: some View {
        Rectangle()
            .fill(Color(red: 0.30, green: 0.18, blue: 0.10))
            .frame(height: 4)
    }

    // MARK: - 下段（一珠）

    private var earthDeck: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 4)
                .fill(Color(red: 0.95, green: 0.88, blue: 0.72))
                .frame(width: beadWidth + 6, height: lowerHeight)

            VStack(spacing: 0) {
                // 梁側（上）に詰める入っている珠
                ForEach(activeRows, id: \.self) { row in
                    BeadView(isActive: true) { onTapEarth(row) }
                        .frame(width: beadWidth, height: beadHeight)
                }
                Spacer(minLength: 0)
                // 反対側（下）に詰める払った珠
                ForEach(inactiveRows, id: \.self) { row in
                    BeadView(isActive: false) { onTapEarth(row) }
                        .frame(width: beadWidth, height: beadHeight)
                }
            }
            .frame(width: beadWidth + 6, height: lowerHeight)
            .animation(.easeInOut(duration: 0.15), value: column.earth)
        }
    }

    private var activeRows: [Int] {
        guard column.earth >= 1 else { return [] }
        return Array(1...column.earth)
    }

    private var inactiveRows: [Int] {
        guard column.earth < 4 else { return [] }
        return Array((column.earth + 1)...4)
    }
}
