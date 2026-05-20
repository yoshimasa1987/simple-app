import SwiftUI

struct ContentView: View {
    @StateObject private var model = SorobanModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                totalDisplay

                // そろばんは横長なので、横スクロールで全桁を見られるようにする
                ScrollView(.horizontal, showsIndicators: false) {
                    SorobanBoardView(model: model)
                        .frame(height: 220)
                        .padding(.horizontal, 8)
                }

                HStack {
                    Button(role: .destructive) {
                        model.reset()
                    } label: {
                        Label("ご破算", systemImage: "arrow.counterclockwise")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding(.horizontal)

                Spacer()
            }
            .padding(.top, 8)
            .navigationTitle("そろばん")
            .navigationBarTitleDisplayMode(.inline)
            .background(Color(.systemGroupedBackground).ignoresSafeArea())
        }
    }

    // MARK: - 合計表示

    private var totalDisplay: some View {
        VStack(spacing: 4) {
            Text("合計")
                .font(.caption)
                .foregroundColor(.secondary)
            Text(formatted(model.totalValue))
                .font(.system(size: 36, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .contentTransition(.numericText())
                .animation(.easeInOut(duration: 0.15), value: model.totalValue)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    private func formatted(_ value: Decimal) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = ","
        return f.string(from: value as NSDecimalNumber) ?? "0"
    }
}

#Preview {
    ContentView()
}
