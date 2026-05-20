# SorobanApp（仮想そろばん）

iPhone 向けの SwiftUI 製シンプルそろばんアプリです。
タップ操作で五珠 / 一珠を上下させ、合計を十進数で表示します。

## 構成

```
SorobanApp/
├── SorobanApp.xcodeproj/        # Xcode プロジェクト
└── SorobanApp/
    ├── SorobanApp.swift         # @main エントリ
    ├── ContentView.swift        # 画面全体（合計表示 + 盤面 + ご破算）
    ├── SorobanBoardView.swift   # そろばん盤（13桁を横並びに）
    ├── ColumnView.swift         # 1桁ぶんの縦列（上段五珠＋梁＋下段一珠）
    ├── BeadView.swift           # 珠1個の見た目とタップ
    └── SorobanModel.swift       # 状態（@ObservableObject）と合計計算
```

## ビルド方法

このリポジトリでは Swift コードのみ生成しています。実機 / シミュレータで動かすには Mac + Xcode 15 以降が必要です。

1. macOS で `SorobanApp/SorobanApp.xcodeproj` を Xcode で開く
2. ターゲット「SorobanApp」を選択し iPhone シミュレータで Run

`IPHONEOS_DEPLOYMENT_TARGET = 17.0` を想定（`NavigationStack` / `contentTransition(.numericText())` のため）。

## 操作仕様

そろばんは 13 桁（最右が一の位）。

- 上段の珠（五珠）をタップ … 梁に付いていれば払う / 付いていなければ入れる（+5）
- 下段の珠（一珠 4個）をタップ
  - その珠が払われている場合: その位置までの珠を梁に詰める
  - その珠が既に入っている場合: その位置以上の珠を払う

合計値は `Decimal` で計算するため 13 桁でも桁あふれしません。

## 既知の簡略化

- 物理的なドラッグ操作ではなくタップで一括移動する方式（学習用に十分）
- App Icon / LaunchScreen は未同梱
- 効果音・触覚フィードバックなし
