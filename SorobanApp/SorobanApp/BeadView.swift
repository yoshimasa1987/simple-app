import SwiftUI

/// 珠1個分の見た目。タップで親側にアクションを伝える。
struct BeadView: View {
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        ZStack {
            Capsule()
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.78, green: 0.45, blue: 0.20),
                            Color(red: 0.45, green: 0.22, blue: 0.08)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .overlay(
                    Capsule()
                        .stroke(Color.black.opacity(0.4), lineWidth: 0.5)
                )
                .shadow(color: .black.opacity(0.3), radius: 1, x: 0, y: 1)
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: action)
        .accessibilityElement()
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel(isActive ? "珠（入）" : "珠（払）")
    }
}
